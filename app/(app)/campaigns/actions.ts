"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createCampaignRecord } from "@/lib/mvp-data";
import { campaignPayloadSchema, getFormStringValue } from "@/lib/schemas";

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
    redirect(`/campaigns?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid campaign payload")}`);
  }

  try {
    await createCampaignRecord(parsed.data);
  } catch {
    redirect(`/campaigns?error=${encodeURIComponent("Unable to create campaign")}`);
  }

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/status");
  redirect("/campaigns?message=Campaign draft created");
}
