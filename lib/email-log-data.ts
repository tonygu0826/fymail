import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

export async function getRecentEmailLogs(limit: number = 5) {
  if (!isDatabaseConfigured()) {
    return {
      source: "fallback",
      items: [
        {
          id: "log_1",
          recipientEmail: "demo@example.com",
          subject: "Test email",
          status: "SENT",
          sentAt: new Date("2026-03-28T10:30:00Z"),
          createdAt: new Date("2026-03-28T10:30:00Z"),
          contact: {
            companyName: "Demo Company",
            contactName: "Demo Contact",
          },
          template: {
            name: "Demo Template",
          },
          retryCount: 0,
        },
        {
          id: "log_2",
          recipientEmail: "demo2@example.com",
          subject: "Test email 2",
          status: "FAILED",
          errorMessage: "SMTP connection failed",
          sentAt: null,
          createdAt: new Date("2026-03-28T09:15:00Z"),
          contact: {
            companyName: "Demo Company 2",
            contactName: "Demo Contact 2",
          },
          template: {
            name: "Demo Template 2",
          },
          retryCount: 2,
        },
      ],
    };
  }

  try {
    const items = await prisma.emailLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        recipientEmail: true,
        subject: true,
        status: true,
        errorMessage: true,
        retryCount: true,
        sentAt: true,
        createdAt: true,
        contact: {
          select: {
            companyName: true,
            contactName: true,
          },
        },
        template: {
          select: {
            name: true,
          },
        },
        campaign: {
          select: {
            name: true,
          },
        },
      },
    });

    return { source: "database", items };
  } catch (error) {
    return {
      source: "fallback",
      items: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}