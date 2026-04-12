"use server";

import { revalidatePath } from "next/cache";
import { runAutomation } from "@/lib/automation";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

export async function runAutomationAction() {
  try {
    const result = await runAutomation();

    revalidatePath("/contacts");
    revalidatePath("/automation");
    revalidatePath("/dashboard");

    return result;
  } catch (error) {
    return {
      success: false,
      steps: [],
      summary: { totalContacts: 0, uniqueContacts: 0, duplicatesRemoved: 0, scoredContacts: 0 },
      errors: [error instanceof Error ? error.message : "自动化运行失败"],
    };
  }
}

export async function getRunHistory() {
  if (!isDatabaseConfigured()) return [];
  try {
    return await prisma.automationRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 });
  } catch {
    return [];
  }
}

export async function getTotalContactCount() {
  if (!isDatabaseConfigured()) return 0;
  try {
    return await prisma.contact.count();
  } catch {
    return 0;
  }
}
