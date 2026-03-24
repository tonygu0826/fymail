import { CampaignStatus, ContactStatus, TemplateStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getEnvironmentStatus, isDatabaseConfigured } from "@/lib/env";
import { getDatabaseHealth } from "@/lib/health";

const fallbackData = {
  templates: [
    {
      id: "tmpl_demo_en",
      name: "EU LCL Intro",
      slug: "eu-lcl-intro",
      language: "EN",
      status: "ACTIVE",
      subject: "Reliable LCL to Canada for European forwarders",
      updatedAt: new Date("2026-03-20T10:30:00Z"),
    },
    {
      id: "tmpl_demo_de",
      name: "Germany Follow-Up",
      slug: "germany-follow-up",
      language: "DE",
      status: "DRAFT",
      subject: "China to Canada consolidation support",
      updatedAt: new Date("2026-03-19T09:15:00Z"),
    },
  ],
  contacts: [
    {
      id: "contact_1",
      companyName: "Forwarder GmbH",
      contactName: "Anna Meyer",
      email: "anna@forwarder.example",
      countryCode: "DE",
      status: "READY",
      tags: ["germany", "lcl"],
      createdAt: new Date("2026-03-18T08:45:00Z"),
    },
    {
      id: "contact_2",
      companyName: "Nordic Cargo BV",
      contactName: "Lars de Vries",
      email: "lars@nordiccargo.example",
      countryCode: "NL",
      status: "NEW",
      tags: ["netherlands"],
      createdAt: new Date("2026-03-17T12:00:00Z"),
    },
    {
      id: "contact_3",
      companyName: "Channel Freight Ltd",
      contactName: "Emma Clarke",
      email: "emma@channelfreight.example",
      countryCode: "UK",
      status: "CONTACTED",
      tags: ["uk", "priority"],
      createdAt: new Date("2026-03-16T15:20:00Z"),
    },
  ],
  campaigns: [
    {
      id: "camp_1",
      name: "Germany Forwarders Batch",
      status: "DRAFT",
      updatedAt: new Date("2026-03-21T11:00:00Z"),
      templateName: "EU LCL Intro",
      contactCount: 36,
    },
    {
      id: "camp_2",
      name: "Benelux Week 1",
      status: "SCHEDULED",
      updatedAt: new Date("2026-03-22T07:30:00Z"),
      templateName: "Germany Follow-Up",
      contactCount: 24,
    },
  ],
};

function isPrismaRuntimeError(error: unknown) {
  return error instanceof Error;
}

export async function getDashboardSummary() {
  if (!isDatabaseConfigured()) {
    return {
      source: "fallback",
      counts: {
        templates: fallbackData.templates.length,
        contacts: fallbackData.contacts.length,
        campaigns: fallbackData.campaigns.length,
        readyContacts: fallbackData.contacts.filter((contact) => contact.status === "READY")
          .length,
      },
      campaignBreakdown: [
        { status: "DRAFT", count: 1 },
        { status: "SCHEDULED", count: 1 },
      ],
      recentContacts: fallbackData.contacts.slice(0, 3),
      recentCampaigns: fallbackData.campaigns.slice(0, 3),
    };
  }

  try {
    const [
      templates,
      contacts,
      campaigns,
      readyContacts,
      recentContacts,
      recentCampaigns,
      campaignBreakdown,
    ] = await Promise.all([
      prisma.emailTemplate.count(),
      prisma.contact.count(),
      prisma.campaign.count(),
      prisma.contact.count({
        where: {
          status: ContactStatus.READY,
        },
      }),
      prisma.contact.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      }),
      prisma.campaign.findMany({
        orderBy: {
          updatedAt: "desc",
        },
        take: 5,
        include: {
          template: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              targets: true,
            },
          },
        },
      }),
      Promise.all(
        Object.values(CampaignStatus).map(async (status) => ({
          status,
          count: await prisma.campaign.count({ where: { status } }),
        })),
      ),
    ]);

    return {
      source: "database",
      counts: {
        templates,
        contacts,
        campaigns,
        readyContacts,
      },
      campaignBreakdown,
      recentContacts,
      recentCampaigns: recentCampaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        updatedAt: campaign.updatedAt,
        templateName: campaign.template.name,
        contactCount: campaign._count.targets,
      })),
    };
  } catch (error) {
    if (isPrismaRuntimeError(error)) {
      return {
        source: "fallback",
        counts: {
          templates: fallbackData.templates.length,
          contacts: fallbackData.contacts.length,
          campaigns: fallbackData.campaigns.length,
          readyContacts: fallbackData.contacts.filter((contact) => contact.status === "READY")
            .length,
        },
        campaignBreakdown: [
          { status: "DRAFT", count: 1 },
          { status: "SCHEDULED", count: 1 },
        ],
        recentContacts: fallbackData.contacts.slice(0, 3),
        recentCampaigns: fallbackData.campaigns.slice(0, 3),
        databaseError: error.message,
      };
    }

    throw error;
  }
}

export async function getTemplates() {
  if (!isDatabaseConfigured()) {
    return { source: "fallback", items: fallbackData.templates };
  }

  try {
    const items = await prisma.emailTemplate.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    });

    return { source: "database", items };
  } catch (error) {
    if (isPrismaRuntimeError(error)) {
      return { source: "fallback", items: fallbackData.templates, databaseError: error.message };
    }

    throw error;
  }
}

export async function getContacts() {
  if (!isDatabaseConfigured()) {
    return { source: "fallback", items: fallbackData.contacts };
  }

  try {
    const items = await prisma.contact.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return { source: "database", items };
  } catch (error) {
    if (isPrismaRuntimeError(error)) {
      return { source: "fallback", items: fallbackData.contacts, databaseError: error.message };
    }

    throw error;
  }
}

export async function getCampaigns() {
  if (!isDatabaseConfigured()) {
    return { source: "fallback", items: fallbackData.campaigns };
  }

  try {
    const items = await prisma.campaign.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        template: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            targets: true,
          },
        },
      },
    });

    return {
      source: "database",
      items: items.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        updatedAt: campaign.updatedAt,
        templateName: campaign.template.name,
        contactCount: campaign._count.targets,
      })),
    };
  } catch (error) {
    if (isPrismaRuntimeError(error)) {
      return { source: "fallback", items: fallbackData.campaigns, databaseError: error.message };
    }

    throw error;
  }
}

export async function getSettingsSummary() {
  const database = await getDatabaseHealth();

  let appSettings: Array<{ key: string; value: string }> = [
    { key: "tenant_mode", value: "single-user" },
    { key: "campaign_execution", value: "manual shell only" },
    { key: "contact_import", value: "planned" },
    { key: "mail_delivery", value: "not implemented" },
  ];

  if (isDatabaseConfigured()) {
    try {
      const settings = await prisma.appSetting.findMany({
        orderBy: {
          key: "asc",
        },
      });

      if (settings.length > 0) {
        appSettings = settings.map((setting) => ({
          key: setting.key,
          value: JSON.stringify(setting.value),
        }));
      }
    } catch {
      // Ignore Prisma read errors here and keep safe defaults.
    }
  }

  return {
    appSettings,
    environment: getEnvironmentStatus(),
    database,
  };
}

export async function getStatusSummary() {
  const dashboard = await getDashboardSummary();
  const database = await getDatabaseHealth();

  return {
    app: "FyMail",
    environment: process.env.NODE_ENV ?? "development",
    version: "mvp",
    database,
    dataSource: dashboard.source,
    counts: dashboard.counts,
  };
}

export const mvpOptions = {
  languages: ["EN", "FR", "DE", "NL"],
  templateStatuses: Object.values(TemplateStatus),
  contactStatuses: Object.values(ContactStatus),
  campaignStatuses: Object.values(CampaignStatus),
};
