"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import { ApprovalStatus, EmailLogStatus, CampaignContactStatus, CampaignStatus } from "@prisma/client";
import { sendEmail, buildTemplateVariables } from "@/lib/mail";
import { getCurrentUserId } from "@/lib/user";

export type ApprovalBatch = {
  key: string; // templateName + date as group key
  templateName: string;
  createdAt: string;
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalIds: string[]; // all PENDING approval IDs in this batch
  sampleContacts: string[]; // first few emails for preview
};

export async function getApprovalBatches(): Promise<ApprovalBatch[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const approvals = await prisma.approval.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Group by template + creation time (within 5 minute window)
    const groups = new Map<string, {
      templateName: string;
      createdAt: Date;
      items: { id: string; status: string; targetId: string }[];
    }>();

    for (const a of approvals) {
      let templateName = "";
      let contactEmail = "";
      try {
        const emailLog = await prisma.emailLog.findUnique({
          where: { id: a.targetId },
          include: {
            template: { select: { name: true } },
          },
        });
        templateName = emailLog?.template?.name ?? "未知模板";
        contactEmail = emailLog?.recipientEmail ?? "";
      } catch {}

      // Group key: template + rounded time (5 min window)
      const timeKey = new Date(Math.floor(a.createdAt.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000)).toISOString();
      const groupKey = `${templateName}||${timeKey}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          templateName,
          createdAt: a.createdAt,
          items: [],
        });
      }
      const group = groups.get(groupKey)!;
      group.items.push({ id: a.id, status: a.status, targetId: a.targetId });

      // Store contact email in item for sample
      (group as any).emails = (group as any).emails || [];
      if (contactEmail) (group as any).emails.push(contactEmail);
    }

    const batches: ApprovalBatch[] = [];
    for (const [key, group] of groups) {
      const pendingItems = group.items.filter(i => i.status === "PENDING");
      batches.push({
        key,
        templateName: group.templateName,
        createdAt: group.createdAt.toISOString(),
        totalCount: group.items.length,
        pendingCount: pendingItems.length,
        approvedCount: group.items.filter(i => i.status === "APPROVED").length,
        rejectedCount: group.items.filter(i => i.status === "REJECTED" || i.status === "AUTO_REJECTED").length,
        approvalIds: pendingItems.map(i => i.id),
        sampleContacts: ((group as any).emails || []).slice(0, 5),
      });
    }

    return batches;
  } catch {
    return [];
  }
}

async function processApproval(approvalId: string, action: "approve" | "reject") {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
  if (!approval || approval.status !== "PENDING") return;

  const decisionBy = await getCurrentUserId();
  const newStatus = action === "approve" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

  await prisma.approval.update({
    where: { id: approvalId },
    data: { status: newStatus, decisionAt: new Date(), decisionBy },
  });

  if (action === "approve") {
    // Send email
    try {
      const emailLog = await prisma.emailLog.findUnique({
        where: { id: approval.targetId },
        include: { template: true, contact: true },
      });

      if (emailLog && emailLog.status === EmailLogStatus.PENDING && emailLog.template) {
        const templateVariables = Array.isArray(emailLog.template.variables)
          ? (emailLog.template.variables as string[])
          : [];
        const variables = emailLog.contact
          ? buildTemplateVariables(emailLog.contact, templateVariables)
          : {};

        const result = await sendEmail({
          to: emailLog.recipientEmail,
          subject: emailLog.subject,
          html: emailLog.template.bodyHtml,
          text: emailLog.template.bodyText || undefined,
          variables,
        });

        const sentAt = new Date();
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            status: result.success ? EmailLogStatus.SENT : EmailLogStatus.FAILED,
            messageId: result.messageId,
            sentAt: result.success ? sentAt : undefined,
            errorMessage: result.error,
          },
        });

        if (result.success && emailLog.contactId) {
          await prisma.contact.update({
            where: { id: emailLog.contactId },
            data: { lastContactedAt: sentAt },
          });
        }

        if (emailLog.campaignId && emailLog.contactId) {
          await prisma.campaignContact.updateMany({
            where: { campaignId: emailLog.campaignId, contactId: emailLog.contactId },
            data: {
              status: result.success ? CampaignContactStatus.SENT : CampaignContactStatus.FAILED,
              sentAt: result.success ? sentAt : undefined,
              failureReason: result.error,
            },
          });
        }
      }
    } catch (error) {
      console.error("审批后发送失败:", error);
    }
  } else {
    // Reject — mark email log as failed
    try {
      await prisma.emailLog.update({
        where: { id: approval.targetId },
        data: { status: EmailLogStatus.FAILED, errorMessage: "审批被拒绝" },
      });
    } catch {}
  }

  // Check if all emails in the campaign are done → update campaign to COMPLETED
  try {
    const emailLog = await prisma.emailLog.findUnique({
      where: { id: approval.targetId },
      select: { campaignId: true },
    });
    if (emailLog?.campaignId) {
      const pendingCount = await prisma.emailLog.count({
        where: { campaignId: emailLog.campaignId, status: EmailLogStatus.PENDING },
      });
      if (pendingCount === 0) {
        await prisma.campaign.update({
          where: { id: emailLog.campaignId },
          data: { status: CampaignStatus.COMPLETED },
        });
      }
    }
  } catch {}
}

/**
 * Process a small chunk of approvals (called repeatedly from client).
 */
export async function approveChunkAction(approvalIds: string[]) {
  let sent = 0;
  let failed = 0;
  for (const id of approvalIds) {
    try {
      await processApproval(id, "approve");
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

export async function rejectChunkAction(approvalIds: string[]) {
  let rejected = 0;
  for (const id of approvalIds) {
    try {
      await processApproval(id, "reject");
      rejected++;
    } catch {}
  }
  return { rejected };
}

export async function revalidateApprovalPages() {
  revalidatePath("/approvals");
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
}
