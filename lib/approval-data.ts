import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

const fallbackApprovals = [
  {
    id: "app_1",
    targetType: "SEND" as const,
    targetId: "log_1",
    status: "AUTO_APPROVED" as const,
    score: 8.5,
    rulesApplied: ["contact_ready", "high_priority"],
    decisionReason: "High score automatically approved",
    decisionAt: new Date("2026-03-28T10:30:00Z"),
    createdAt: new Date("2026-03-28T10:30:00Z"),
    updatedAt: new Date("2026-03-28T10:30:00Z"),
  },
  {
    id: "app_2",
    targetType: "SEND" as const,
    targetId: "log_2",
    status: "PENDING" as const,
    score: 5.5,
    rulesApplied: ["active_template"],
    decisionReason: "Score requires manual review",
    decisionAt: null,
    createdAt: new Date("2026-03-28T09:15:00Z"),
    updatedAt: new Date("2026-03-28T09:15:00Z"),
  },
];

export async function getApprovals() {
  if (!isDatabaseConfigured()) {
    return { source: "fallback", items: fallbackApprovals };
  }

  try {
    const items = await prisma.approval.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return { source: "database", items };
  } catch (error) {
    if (error instanceof Error) {
      return { source: "fallback", items: fallbackApprovals, databaseError: error.message };
    }
    throw error;
  }
}