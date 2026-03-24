"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendManualSingleEmail } from "@/lib/mail";
import { createCampaignRecord } from "@/lib/mvp-data";
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
    redirectWithState({
      error: "Unable to create campaign",
    });
  }

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/status");
  redirectWithState({
    message: "Campaign draft created",
  });
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

  try {
    const result = await sendManualSingleEmail(parsed.data);

    revalidatePath("/campaigns");
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/status");

    redirectWithState({
      message: `Sent to ${result.recipientEmail}`,
    });
  } catch (error) {
    redirectWithState({
      error: error instanceof Error ? error.message : "Unable to send email",
    });
  }
}
