import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");
    
    if (!isDatabaseConfigured()) {
      // Return fallback data
      const fallbackLogs = [
        {
          id: "log_1",
          recipientEmail: "demo@example.com",
          subject: "Test email",
          status: "SENT",
          sentAt: new Date("2026-03-28T10:30:00Z").toISOString(),
          createdAt: new Date("2026-03-28T10:30:00Z").toISOString(),
        },
        {
          id: "log_2",
          recipientEmail: "demo2@example.com",
          subject: "Test email 2",
          status: "FAILED",
          errorMessage: "SMTP connection failed",
          sentAt: null,
          createdAt: new Date("2026-03-28T09:15:00Z").toISOString(),
        },
      ];
      return NextResponse.json({
        success: true,
        data: fallbackLogs,
        source: "fallback",
      });
    }

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    const logs = await prisma.emailLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: Math.min(limit, 50),
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

    return NextResponse.json({
      success: true,
      data: logs,
      source: "database",
    });
  } catch (error) {
    console.error("Failed to fetch email logs:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch email logs",
        },
      },
      { status: 500 }
    );
  }
}