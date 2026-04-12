import { prisma } from "@/lib/db";

/**
 * Get the default operator user ID.
 * In the MVP, there's a single operator user created by seed.
 */
export async function getDefaultOperatorId(): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { email: "operator@local.fymail" },
    select: { id: true },
  });

  if (!user) {
    throw new Error("Default operator user not found. Please run the seed script.");
  }

  return user.id;
}

/**
 * Get the current user ID for approval decisions.
 * In the MVP, we always use the default operator.
 */
export async function getCurrentUserId(): Promise<string> {
  return getDefaultOperatorId();
}