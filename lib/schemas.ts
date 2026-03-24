import {
  CampaignStatus,
  ContactStatus,
  TemplateLanguage,
  TemplateStatus,
} from "@prisma/client";
import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().optional(),
);

const normalizedStringArray = z.array(z.string().trim().min(1)).default([]);

export const templatePayloadSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  language: z.nativeEnum(TemplateLanguage),
  subject: z.string().trim().min(1, "Subject is required"),
  bodyHtml: z.string().trim().min(1, "Body HTML is required"),
  bodyText: optionalTrimmedString,
  variables: normalizedStringArray,
  status: z.nativeEnum(TemplateStatus).default(TemplateStatus.DRAFT),
  notes: optionalTrimmedString,
});

export const contactPayloadSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  contactName: optionalTrimmedString,
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  countryCode: z.string().trim().toUpperCase().min(2, "Country code is required").max(3),
  marketRegion: optionalTrimmedString,
  jobTitle: optionalTrimmedString,
  source: optionalTrimmedString,
  status: z.nativeEnum(ContactStatus).default(ContactStatus.NEW),
  tags: normalizedStringArray,
  notes: optionalTrimmedString,
});

export const campaignPayloadSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required"),
  description: optionalTrimmedString,
  templateId: z.string().trim().min(1, "Template selection is required"),
  contactIds: z.array(z.string().trim().min(1)).min(1, "Select at least one contact"),
  status: z.nativeEnum(CampaignStatus).default(CampaignStatus.DRAFT),
  scheduledAt: z
    .preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      },
      z.string().datetime().optional(),
    )
    .nullable()
    .optional(),
});

export const manualSendPayloadSchema = z.object({
  templateId: z.string().trim().min(1, "Template selection is required"),
  contactId: z.string().trim().min(1, "Contact selection is required"),
  confirmSingleSend: z.literal(true, "Confirm the guarded single-send checkbox before sending."),
});

export function parseCommaSeparatedList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getFormStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function getFormBooleanValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return false;
  }

  return ["on", "true", "1", "yes"].includes(value.toLowerCase());
}
