import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUserId, getDefaultOperatorId } from "@/lib/user";

export type AuditLogInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Create an audit log entry.
 * If userId is not provided, tries to get the current user ID.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    let userId = input.userId;
    if (!userId) {
      try {
        userId = await getCurrentUserId();
      } catch (error) {
        // If no user is authenticated, use default operator
        userId = await getDefaultOperatorId();
      }
    }

    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: userId ?? undefined,
        userEmail: input.userEmail,
        details: input.details as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    // Don't throw if audit logging fails - we don't want to break the main operation
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Convenience functions for common audit actions.
 */
export async function auditCreate(
  entityType: string,
  entityId: string,
  details?: Record<string, any>,
  options?: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    action: AuditAction.CREATE,
    entityType,
    entityId,
    details,
    ...options,
  });
}

export async function auditUpdate(
  entityType: string,
  entityId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  options?: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    action: AuditAction.UPDATE,
    entityType,
    entityId,
    details: { oldValues, newValues },
    ...options,
  });
}

export async function auditDelete(
  entityType: string,
  entityId: string,
  deletedEntity: Record<string, any>,
  options?: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    action: AuditAction.DELETE,
    entityType,
    entityId,
    details: { deletedEntity },
    ...options,
  });
}

export async function auditApprove(
  entityType: string,
  entityId: string,
  details?: Record<string, any>,
  options?: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    action: AuditAction.APPROVE,
    entityType,
    entityId,
    details,
    ...options,
  });
}

export async function auditReject(
  entityType: string,
  entityId: string,
  details?: Record<string, any>,
  options?: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    action: AuditAction.REJECT,
    entityType,
    entityId,
    details,
    ...options,
  });
}

export async function auditSend(
  entityType: string,
  entityId: string,
  details?: Record<string, any>,
  options?: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    action: AuditAction.SEND,
    entityType,
    entityId,
    details,
    ...options,
  });
}

export async function auditSendRetry(
  entityType: string,
  entityId: string,
  details?: Record<string, any>,
  options?: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    action: AuditAction.SEND_RETRY,
    entityType,
    entityId,
    details,
    ...options,
  });
}

export async function auditSystem(
  entityType: string,
  entityId: string,
  details?: Record<string, any>,
  options?: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    action: AuditAction.SYSTEM,
    entityType,
    entityId,
    details,
    ...options,
  });
}