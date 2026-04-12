"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendManualSingleEmail, sendEmail, buildTemplateVariables } from "@/lib/mail";
import { createCampaignRecord } from "@/lib/mvp-data";
import { prisma } from "@/lib/db";
import { EmailLogStatus, CampaignContactStatus, CampaignStatus } from "@prisma/client";
import {
  campaignPayloadSchema,
  getFormBooleanValue,
  getFormStringValue,
  manualSendPayloadSchema,
} from "@/lib/schemas";

function redirectWithState(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  redirect(query ? `/campaigns?${query}` : "/campaigns");
}

function revalidateAll() {
  revalidatePath("/campaigns");
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/status");
}

export async function createCampaignAction(formData: FormData) {
  const parsed = campaignPayloadSchema.safeParse({
    name: getFormStringValue(formData, "name"),
    description: getFormStringValue(formData, "description"),
    templateId: getFormStringValue(formData, "templateId"),
    contactIds: formData.getAll("contactIds").filter((value): value is string => typeof value === "string"),
    status: "DRAFT",
    scheduledAt: null,
  });

  if (!parsed.success) {
    return redirectWithState({
      error: parsed.error.issues[0]?.message ?? "Invalid campaign payload",
    });
  }

  try {
    await createCampaignRecord(parsed.data);
  } catch {
    return redirectWithState({
      error: "Unable to create campaign",
    });
  }

  revalidateAll();
  redirectWithState({
    message: "营销活动草稿已创建",
  });
}

export async function executeCampaignAction(formData: FormData) {
  const campaignId = formData.get("campaignId") as string;
  if (!campaignId) {
    return redirectWithState({ error: "缺少营销活动 ID" });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      template: true,
      targets: {
        include: { contact: true },
      },
    },
  });

  if (!campaign) {
    return redirectWithState({ error: "营销活动不存在" });
  }

  if (!campaign.template) {
    return redirectWithState({ error: "关联模板不存在" });
  }

  let submittedCount = 0;
  let skippedCount = 0;

  for (const target of campaign.targets) {
    if (target.status === CampaignContactStatus.SENT) {
      skippedCount++;
      continue;
    }

    const contact = target.contact;
    const templateVariables = Array.isArray(campaign.template.variables)
      ? (campaign.template.variables as string[])
      : [];
    const variables = buildTemplateVariables(contact, templateVariables);

    // Create email log (PENDING)
    const emailLog = await prisma.emailLog.create({
      data: {
        campaignId,
        contactId: contact.id,
        templateId: campaign.template.id,
        direction: "OUTBOUND",
        status: EmailLogStatus.PENDING,
        subject: campaign.template.subject.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? ""),
        recipientEmail: contact.email,
        provider: "smtp",
        maxRetries: 3,
        metadata: { variables, campaignExecution: true },
      },
    });

    // Create PENDING approval
    const { createApprovalRecord } = await import("@/lib/approval");
    const { ApprovalTargetType } = await import("@prisma/client");
    await createApprovalRecord(
      ApprovalTargetType.SEND,
      emailLog.id,
      0,
      ["manual_review_required"],
      "PENDING",
      "需要人工审批后才能发送"
    );

    submittedCount++;
  }

  // Update campaign status to SCHEDULED (waiting for approval)
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.SCHEDULED },
  });

  revalidateAll();
  revalidatePath("/approvals");
  redirectWithState({
    message: `已提交 ${submittedCount} 封邮件待审批（跳过 ${skippedCount} 封已发送），请到审批工作台批准`,
  });
}

export async function deleteCampaignAction(formData: FormData) {
  const campaignId = formData.get("campaignId") as string;
  if (!campaignId) {
    return redirectWithState({ error: "缺少营销活动 ID" });
  }

  try {
    await prisma.campaignContact.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
  } catch (error) {
    return redirectWithState({
      error: error instanceof Error ? error.message : "删除失败",
    });
  }

  revalidateAll();
  redirectWithState({ message: "营销活动已删除" });
}

export async function sendManualSingleEmailAction(formData: FormData) {
  const parsed = manualSendPayloadSchema.safeParse({
    templateId: getFormStringValue(formData, "templateId"),
    contactId: getFormStringValue(formData, "contactId"),
    confirmSingleSend: getFormBooleanValue(formData, "confirmSingleSend"),
  });

  if (!parsed.success) {
    return redirectWithState({
      error: parsed.error.issues[0]?.message ?? "Invalid manual send request",
    });
  }

  let result: Awaited<ReturnType<typeof sendManualSingleEmail>>;
  try {
    result = await sendManualSingleEmail(parsed.data);
  } catch (error) {
    return redirectWithState({
      error: error instanceof Error ? error.message : "Unable to send email",
    });
  }

  revalidateAll();
  revalidatePath("/approvals");
  if (result.pendingApproval) {
    redirectWithState({
      message: `已提交审批，请到审批页面批准后发送至 ${result.recipientEmail}`,
    });
  } else {
    redirectWithState({
      message: `已发送至 ${result.recipientEmail}`,
    });
  }
}
