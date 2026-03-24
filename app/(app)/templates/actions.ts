"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTemplateRecord, updateTemplateRecord } from "@/lib/mvp-data";
import { getFormStringValue, parseCommaSeparatedList, templatePayloadSchema } from "@/lib/schemas";

function getTemplatePayload(formData: FormData) {
  return templatePayloadSchema.safeParse({
    name: getFormStringValue(formData, "name"),
    slug: getFormStringValue(formData, "slug"),
    language: getFormStringValue(formData, "language"),
    subject: getFormStringValue(formData, "subject"),
    bodyHtml: getFormStringValue(formData, "bodyHtml"),
    bodyText: getFormStringValue(formData, "bodyText"),
    variables: parseCommaSeparatedList(getFormStringValue(formData, "variables")),
    status: getFormStringValue(formData, "status"),
    notes: getFormStringValue(formData, "notes"),
  });
}

export async function createTemplateAction(formData: FormData) {
  const parsed = getTemplatePayload(formData);

  if (!parsed.success) {
    redirect(`/templates?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid template payload")}`);
  }

  try {
    await createTemplateRecord(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create template";

    redirect(`/templates?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/templates");
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
  revalidatePath("/settings");
  revalidatePath("/status");
  redirect("/templates?message=Template created");
}

export async function updateTemplateAction(id: string, formData: FormData) {
  const parsed = getTemplatePayload(formData);

  if (!parsed.success) {
    redirect(`/templates/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid template payload")}`);
  }

  try {
    await updateTemplateRecord(id, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update template";

    redirect(`/templates/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
  revalidatePath("/settings");
  revalidatePath("/status");
  redirect(`/templates/${id}?message=${encodeURIComponent("Template updated")}`);
}
