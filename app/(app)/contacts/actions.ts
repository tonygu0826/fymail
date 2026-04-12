"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createContactRecord } from "@/lib/mvp-data";
import { contactPayloadSchema, getFormStringValue, parseCommaSeparatedList } from "@/lib/schemas";

export async function createContactAction(formData: FormData) {
  const parsed = contactPayloadSchema.safeParse({
    companyName: getFormStringValue(formData, "companyName"),
    contactName: getFormStringValue(formData, "contactName"),
    email: getFormStringValue(formData, "email"),
    countryCode: getFormStringValue(formData, "countryCode"),
    marketRegion: getFormStringValue(formData, "marketRegion"),
    jobTitle: getFormStringValue(formData, "jobTitle"),
    source: getFormStringValue(formData, "source"),
    status: getFormStringValue(formData, "status"),
    tags: parseCommaSeparatedList(getFormStringValue(formData, "tags")),
    notes: getFormStringValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirect(`/contacts?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid contact payload")}`);
  }

  try {
    await createContactRecord(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create contact";

    redirect(`/contacts?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
  revalidatePath("/settings");
  revalidatePath("/status");
  redirect("/contacts?message=Contact created");
}

export async function updateContactStatusAction(contactId: string, newStatus: string) {
  const { prisma } = await import("@/lib/db");
  const validStatuses = ["NEW", "READY", "CONTACTED", "REPLIED", "BOUNCED", "UNSUBSCRIBED"];

  if (!validStatuses.includes(newStatus)) {
    return { error: "无效状态" };
  }

  try {
    await prisma.contact.update({
      where: { id: contactId },
      data: { status: newStatus as any },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "更新失败" };
  }

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/automation");
  return { success: true };
}

export async function bulkUpdateStatusAction(contactIds: string[], newStatus: string) {
  const { prisma } = await import("@/lib/db");
  const validStatuses = ["NEW", "READY", "CONTACTED", "REPLIED", "BOUNCED", "UNSUBSCRIBED"];

  if (!validStatuses.includes(newStatus)) {
    return { error: "无效状态" };
  }

  if (!contactIds.length) {
    return { error: "未选择联系人" };
  }

  try {
    const result = await prisma.contact.updateMany({
      where: { id: { in: contactIds } },
      data: { status: newStatus as any },
    });
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    return { success: true, count: result.count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "批量更新失败" };
  }
}

export async function deleteContactAction(formData: FormData) {
  const id = formData.get("contactId") as string;

  if (!id) {
    redirect("/contacts?error=Missing contact ID");
  }

  const { prisma } = await import("@/lib/db");

  try {
    // Remove related campaign targets first
    await prisma.campaignContact.deleteMany({ where: { contactId: id } });
    await prisma.contact.delete({ where: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete contact";
    redirect(`/contacts?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
  revalidatePath("/settings");
  revalidatePath("/status");
  redirect("/contacts?message=联系人已删除");
}
