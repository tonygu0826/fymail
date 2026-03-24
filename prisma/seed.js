const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function ensureDefaultOperator() {
  return prisma.user.upsert({
    where: {
      email: "operator@local.fymail",
    },
    update: {
      name: "Local Operator",
    },
    create: {
      email: "operator@local.fymail",
      name: "Local Operator",
    },
  });
}

async function main() {
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
      variables: ["contactName", "companyName", "countryCode"],
      status: "ACTIVE",
      notes: "Seed template for local MVP testing.",
      ownerId: owner.id,
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
      variables: ["contactName", "companyName", "countryCode"],
      status: "ACTIVE",
      notes: "Seed template for local MVP testing.",
      ownerId: owner.id,
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
        source: "seed",
        status: "READY",
        tags: ["germany", "lcl"],
        ownerId: owner.id,
      },
      create: {
        companyName: "Forwarder GmbH",
        contactName: "Anna Meyer",
        email: "anna@forwarder.example",
        countryCode: "DE",
        marketRegion: "DACH",
        jobTitle: "Sales Manager",
        source: "seed",
        status: "READY",
        tags: ["germany", "lcl"],
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
        source: "seed",
        status: "NEW",
        tags: ["netherlands"],
        ownerId: owner.id,
      },
      create: {
        companyName: "Nordic Cargo BV",
        contactName: "Lars de Vries",
        email: "lars@nordiccargo.example",
        countryCode: "NL",
        marketRegion: "Benelux",
        jobTitle: "Managing Director",
        source: "seed",
        status: "NEW",
        tags: ["netherlands"],
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
        },
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
      value: "not-implemented",
      description: "Outbound delivery remains intentionally disabled in the MVP.",
    },
    create: {
      key: "mail_delivery",
      value: "not-implemented",
      description: "Outbound delivery remains intentionally disabled in the MVP.",
    },
  });

  console.log("Seeded FyMail local MVP data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
