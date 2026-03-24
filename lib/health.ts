import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

export async function getDatabaseHealth() {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      reachable: false,
      detail: "DATABASE_URL is not configured",
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      configured: true,
      reachable: true,
      detail: "Database connection succeeded",
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      detail: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
