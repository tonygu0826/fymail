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
