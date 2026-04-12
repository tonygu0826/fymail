import { EmailLogStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface QueueStats {
  pending: number;
  failed: number;
  failedEligibleRetry: number; // failed with retryCount < maxRetries
  sent: number;
  total: number;
  recentFailed: Array<{
    id: string;
    recipientEmail: string;
    errorMessage?: string | null;
    retryCount: number;
    maxRetries: number;
    nextRetryAt?: Date | null;
    createdAt: Date;
  }>;
  recentPending: Array<{
    id: string;
    recipientEmail: string;
    scheduledAt?: Date | null;
    createdAt: Date;
  }>;
}

export async function getQueueStats(): Promise<QueueStats> {
  const now = new Date();
  
  const [pending, failed, sent, total] = await Promise.all([
    prisma.emailLog.count({
      where: { status: EmailLogStatus.PENDING },
    }),
    prisma.emailLog.count({
      where: { status: EmailLogStatus.FAILED },
    }),
    prisma.emailLog.count({
      where: { status: EmailLogStatus.SENT },
    }),
    prisma.emailLog.count(),
  ]);

  const failedEligibleRetry = await prisma.emailLog.count({
    where: {
      status: EmailLogStatus.FAILED,
      retryCount: { lt: prisma.emailLog.fields.maxRetries },
    },
  });

  const recentFailed = await prisma.emailLog.findMany({
    where: {
      status: EmailLogStatus.FAILED,
    },
    select: {
      id: true,
      recipientEmail: true,
      errorMessage: true,
      retryCount: true,
      maxRetries: true,
      nextRetryAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const recentPending = await prisma.emailLog.findMany({
    where: {
      status: EmailLogStatus.PENDING,
    },
    select: {
      id: true,
      recipientEmail: true,
      scheduledAt: true,
      createdAt: true,
    },
    orderBy: { scheduledAt: 'asc' },
    take: 5,
  });

  return {
    pending,
    failed,
    failedEligibleRetry,
    sent,
    total,
    recentFailed,
    recentPending,
  };
}