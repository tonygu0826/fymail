import { Prisma, type CampaignStatus, type ContactStatus, type TemplateLanguage, type TemplateStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

export const defaultOperator = {
  email: "operator@local.fymail",
  name: "Local Operator",
};

export type TemplateMutationInput = {
  name: string;
  slug: string;
  language: TemplateLanguage;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: string[];
  status: TemplateStatus;
  notes?: string;
};

export type ContactMutationInput = {
  companyName: string;
  contactName?: string;
  email: string;
  countryCode: string;
  marketRegion?: string;
  jobTitle?: string;
  source?: string;
  status: ContactStatus;
  tags: string[];
  notes?: string;
};

export type CampaignMutationInput = {
  name: string;
  description?: string;
  templateId: string;
  contactIds: string[];
  status: CampaignStatus;
  scheduledAt?: string | null;
};

export async function ensureDefaultOperator() {
  return prisma.user.upsert({
    where: {
      email: defaultOperator.email,
    },
    update: {
      name: defaultOperator.name,
    },
    create: {
      email: defaultOperator.email,
      name: defaultOperator.name,
    },
  });
}

export async function createTemplateRecord(input: TemplateMutationInput) {
  const owner = await ensureDefaultOperator();

  try {
    return await prisma.emailTemplate.create({
      data: {
        ...input,
        bodyText: input.bodyText || null,
        notes: input.notes || null,
        variables: [...new Set(input.variables)] as Prisma.InputJsonValue,
        ownerId: owner.id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Template slug must be unique.");
    }

    throw error;
  }
}

export async function updateTemplateRecord(id: string, input: TemplateMutationInput) {
  try {
    return await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...input,
        bodyText: input.bodyText || null,
        notes: input.notes || null,
        variables: [...new Set(input.variables)] as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Template slug must be unique.");
    }

    throw error;
  }
}

export async function createContactRecord(input: ContactMutationInput) {
  const owner = await ensureDefaultOperator();

  try {
    return await prisma.contact.create({
      data: {
        ...input,
        contactName: input.contactName || null,
        marketRegion: input.marketRegion || null,
        jobTitle: input.jobTitle || null,
        source: input.source || null,
        notes: input.notes || null,
        tags: [...new Set(input.tags)] as Prisma.InputJsonValue,
        ownerId: owner.id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Contact email must be unique.");
    }

    throw error;
  }
}

export async function createCampaignRecord(input: CampaignMutationInput) {
  const owner = await ensureDefaultOperator();
  const uniqueContactIds = [...new Set(input.contactIds)];

  const [template, contacts] = await Promise.all([
    prisma.emailTemplate.findUnique({
      where: { id: input.templateId },
      select: { id: true },
    }),
    prisma.contact.findMany({
      where: {
        id: {
          in: uniqueContactIds,
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!template) {
    throw new Error("Selected template was not found.");
  }

  if (contacts.length === 0) {
    throw new Error("Select at least one valid contact.");
  }

  return prisma.campaign.create({
    data: {
      name: input.name,
      description: input.description || null,
      status: input.status,
      templateId: input.templateId,
      ownerId: owner.id,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      audienceFilter: {
        contactIds: contacts.map((contact) => contact.id),
      } as Prisma.InputJsonValue,
      targets: {
        create: contacts.map((contact) => ({
          contactId: contact.id,
        })),
      },
    },
    include: {
      _count: {
        select: {
          targets: true,
        },
      },
      template: {
        select: {
          name: true,
        },
      },
    },
  });
}

export async function seedLocalMvpData() {
  const owner = await ensureDefaultOperator();

  const template = await prisma.emailTemplate.upsert({
    where: { slug: "eu-lcl-intro" },
    update: {
      name: "EU LCL Intro",
      language: "EN",
      subject: "Reliable LCL to Canada for European forwarders",
      bodyHtml:
        "<p>Hello {{contactName}},</p><p>We help European forwarders move Canada-bound LCL with steady consolidation support.</p>",
      bodyText:
        "Hello {{contactName}}, we help European forwarders move Canada-bound LCL with steady consolidation support.",
      variables: ["contactName", "companyName", "countryCode"] as Prisma.InputJsonValue,
      status: "ACTIVE",
      ownerId: owner.id,
      notes: "Seed template for local MVP testing.",
    },
    create: {
      name: "EU LCL Intro",
      slug: "eu-lcl-intro",
      language: "EN",
      subject: "Reliable LCL to Canada for European forwarders",
      bodyHtml:
        "<p>Hello {{contactName}},</p><p>We help European forwarders move Canada-bound LCL with steady consolidation support.</p>",
      bodyText:
        "Hello {{contactName}}, we help European forwarders move Canada-bound LCL with steady consolidation support.",
      variables: ["contactName", "companyName", "countryCode"] as Prisma.InputJsonValue,
      status: "ACTIVE",
      ownerId: owner.id,
      notes: "Seed template for local MVP testing.",
    },
  });

  const contacts = await Promise.all([
    prisma.contact.upsert({
      where: { email: "anna@forwarder.example" },
      update: {
        companyName: "Forwarder GmbH",
        contactName: "Anna Meyer",
        countryCode: "DE",
        marketRegion: "DACH",
        jobTitle: "Sales Manager",
        source: "manual-seed",
        status: "READY",
        tags: ["germany", "lcl"] as Prisma.InputJsonValue,
        ownerId: owner.id,
      },
      create: {
        companyName: "Forwarder GmbH",
        contactName: "Anna Meyer",
        email: "anna@forwarder.example",
        countryCode: "DE",
        marketRegion: "DACH",
        jobTitle: "Sales Manager",
        source: "manual-seed",
        status: "READY",
        tags: ["germany", "lcl"] as Prisma.InputJsonValue,
        ownerId: owner.id,
      },
    }),
    prisma.contact.upsert({
      where: { email: "lars@nordiccargo.example" },
      update: {
        companyName: "Nordic Cargo BV",
        contactName: "Lars de Vries",
        countryCode: "NL",
        marketRegion: "Benelux",
        jobTitle: "Managing Director",
        source: "manual-seed",
        status: "NEW",
        tags: ["netherlands"] as Prisma.InputJsonValue,
        ownerId: owner.id,
      },
      create: {
        companyName: "Nordic Cargo BV",
        contactName: "Lars de Vries",
        email: "lars@nordiccargo.example",
        countryCode: "NL",
        marketRegion: "Benelux",
        jobTitle: "Managing Director",
        source: "manual-seed",
        status: "NEW",
        tags: ["netherlands"] as Prisma.InputJsonValue,
        ownerId: owner.id,
      },
    }),
  ]);

  const existingCampaign = await prisma.campaign.findFirst({
    where: {
      name: "Germany Forwarders Batch",
      ownerId: owner.id,
    },
  });

  if (!existingCampaign) {
    await prisma.campaign.create({
      data: {
        name: "Germany Forwarders Batch",
        description: "Seed draft campaign for local testing.",
        status: "DRAFT",
        templateId: template.id,
        ownerId: owner.id,
        audienceFilter: {
          contactIds: contacts.map((contact) => contact.id),
        } as Prisma.InputJsonValue,
        targets: {
          create: contacts.map((contact) => ({
            contactId: contact.id,
          })),
        },
      },
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "tenant_mode" },
    update: {
      value: "single-user",
      description: "Current tenancy mode for the local MVP.",
    },
    create: {
      key: "tenant_mode",
      value: "single-user",
      description: "Current tenancy mode for the local MVP.",
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "campaign_execution" },
    update: {
      value: "draft-only",
      description: "Campaign execution stays manual in the MVP.",
    },
    create: {
      key: "campaign_execution",
      value: "draft-only",
      description: "Campaign execution stays manual in the MVP.",
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "contact_import" },
    update: {
      value: "manual-form",
      description: "Contacts are created through forms in the MVP.",
    },
    create: {
      key: "contact_import",
      value: "manual-form",
      description: "Contacts are created through forms in the MVP.",
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "mail_delivery" },
    update: {
      value: "smtp-manual-single-send",
      description: "Outbound delivery is limited to guarded single sends through SMTP.",
    },
    create: {
      key: "mail_delivery",
      value: "smtp-manual-single-send",
      description: "Outbound delivery is limited to guarded single sends through SMTP.",
    },
  });
}

export function formatJsonValue(value: Prisma.JsonValue) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}
