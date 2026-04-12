import { ApprovalStatus, ApprovalTargetType } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * All sends require manual approval — no scoring, no auto-approve.
 */
export async function evaluateApproval(
  targetType: ApprovalTargetType,
  targetId: string,
  context: Record<string, any>
): Promise<{ status: ApprovalStatus; score: number; rules: string[]; reason?: string }> {
  return {
    status: 'PENDING',
    score: 0,
    rules: ['manual_review_required'],
    reason: '需要人工审批后才能发送',
  };
}

export async function createApprovalRecord(
  targetType: ApprovalTargetType,
  targetId: string,
  score: number,
  rulesApplied: string[],
  status: ApprovalStatus,
  reason?: string
) {
  return prisma.approval.create({
    data: {
      targetType,
      targetId,
      score,
      rulesApplied,
      status,
      decisionReason: reason,
      decisionAt: status !== 'PENDING' ? new Date() : undefined,
    },
  });
}
