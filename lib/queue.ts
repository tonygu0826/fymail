import { EmailLogStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mail";
import { auditSendRetry } from "@/lib/audit";

export interface EnqueueEmailInput {
  campaignId?: string | null;
  contactId: string;
  templateId: string;
  subject: string;
  html: string;
  text?: string;
  variables?: Record<string, string>;
  scheduledAt?: Date;
  maxRetries?: number;
}

/**
 * Enqueue an email for sending (status = PENDING).
 * Returns the created EmailLog record.
 */
export async function enqueueEmail(input: EnqueueEmailInput) {
  const {
    campaignId,
    contactId,
    templateId,
    subject,
    html,
    text,
    variables = {},
    scheduledAt,
    maxRetries = 3,
  } = input;

  const emailLog = await prisma.emailLog.create({
    data: {
      campaignId: campaignId ?? null,
      contactId,
      templateId,
      direction: "OUTBOUND",
      status: EmailLogStatus.PENDING,
      subject,
      recipientEmail: "", // we need to fetch contact email
      provider: "smtp",
      maxRetries,
      scheduledAt,
      metadata: {
        variables,
        enqueuedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  // Fetch contact email to update recipientEmail
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { email: true },
  });
  if (contact) {
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { recipientEmail: contact.email },
    });
  }

  return emailLog;
}

/**
 * Process pending email queue items.
 * Fetches emails that are PENDING and scheduledAt <= now,
 * or FAILED with nextRetryAt <= now and retryCount < maxRetries.
 * Processes them sequentially (in production you'd want concurrency limits).
 */
export async function processQueue(options?: {
  limit?: number;
  concurrency?: number;
}) {
  const limit = options?.limit ?? 10;
  // For simplicity, we process sequentially; concurrency can be added later.
  const now = new Date();
  
  // Find eligible emails
  const pendingEmails = await prisma.emailLog.findMany({
    where: {
      OR: [
        // Pending emails ready to send
        {
          status: EmailLogStatus.PENDING,
          OR: [
            { scheduledAt: null },
            { scheduledAt: { lte: now } },
          ],
        },
        // Failed emails eligible for retry
        {
          status: EmailLogStatus.FAILED,
          retryCount: { lt: prisma.emailLog.fields.maxRetries },
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: now } },
          ],
        },
      ],
    },
    include: {
      contact: true,
      template: true,
      campaign: true,
    },
    orderBy: [
      { scheduledAt: 'asc' },
      { createdAt: 'asc' },
    ],
    take: limit,
  });

  // Sync any still-PENDING Approval records for the batch to AUTO_APPROVED.
  // The queue worker commits to sending these; leaving Approval PENDING would
  // cause stale "待审批" entries in the UI (earlier design gap where processQueue
  // bypassed the approval gate while the UI counted raw PENDING approvals).
  if (pendingEmails.length > 0) {
    await prisma.approval.updateMany({
      where: {
        targetType: 'SEND',
        status: 'PENDING',
        targetId: { in: pendingEmails.map(e => e.id) },
      },
      data: {
        status: 'AUTO_APPROVED',
        decisionAt: now,
        decisionReason: 'Auto-approved by queue worker (cron-processed)',
      },
    });
  }

  const results = [];
  for (let i = 0; i < pendingEmails.length; i++) {
    const email = pendingEmails[i];
    try {
      const result = await processEmailLog(email);
      results.push({ id: email.id, success: true, result });
    } catch (error) {
      results.push({ id: email.id, success: false, error: error instanceof Error ? error.message : String(error) });
    }
    // 250ms delay between sends (4/sec) — Resend free tier limit is 5/sec; stay under
    if (i < pendingEmails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return results;
}

/**
 * Process a single EmailLog record.
 * Attempts to send email, updates status accordingly.
 * Optionally pass contact and template objects to avoid extra queries.
 */
export async function processEmailLog(emailLog: any, options?: { contact?: any; template?: any; campaign?: any }) {
  let { contact, template, campaign } = options || {};
  if (!contact) {
    if (!emailLog.contactId) {
      // Mark as permanently failed — contact was deleted
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: EmailLogStatus.FAILED, errorMessage: "Contact deleted (contactId is null)" },
      });
      throw new Error(`Email log ${emailLog.id} has no associated contact (deleted)`);
    }
    contact = await prisma.contact.findUnique({
      where: { id: emailLog.contactId },
    });
    if (!contact) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: EmailLogStatus.FAILED, errorMessage: "Contact not found" },
      });
      throw new Error(`Contact not found for email log ${emailLog.id}`);
    }
  }
  if (!template) {
    if (!emailLog.templateId) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: EmailLogStatus.FAILED, errorMessage: "Template deleted (templateId is null)" },
      });
      throw new Error(`Email log ${emailLog.id} has no associated template (deleted)`);
    }
    template = await prisma.emailTemplate.findUnique({
      where: { id: emailLog.templateId },
    });
    if (!template) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: EmailLogStatus.FAILED, errorMessage: "Template not found" },
      });
      throw new Error(`Template not found for email log ${emailLog.id}`);
    }
  }
  if (!campaign && emailLog.campaignId) {
    campaign = await prisma.campaign.findUnique({
      where: { id: emailLog.campaignId },
    });
  }

  const variables = (emailLog.metadata as any)?.variables || {};
  const renderedSubject = renderTemplateValue(emailLog.subject, variables);
  const renderedHtml = renderTemplateValue(template.bodyHtml, variables);
  // Pass bodyText (custom signature) separately — sendEmail handles combining
  const customSignature = template.bodyText
    ? renderTemplateValue(template.bodyText, variables)
    : undefined;

  try {
    const result = await sendEmail({
      to: contact.email,
      subject: renderedSubject,
      html: renderedHtml,
      text: customSignature,
      variables,
    });

    if (!result.success) {
      throw new Error(result.error || "SMTP delivery failed");
    }

    const sentAt = new Date();
    const transactionSteps: Prisma.PrismaPromise<unknown>[] = [
      prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.SENT,
          messageId: result.messageId,
          sentAt,
          retryCount: result.attempts ? result.attempts - 1 : 0,
          metadata: {
            ...(emailLog.metadata as object),
            attempts: result.attempts,
            sentAt: sentAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      }),
      prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastContactedAt: sentAt,
          status: contact.status === 'NEW' || contact.status === 'READY' ? 'CONTACTED' : contact.status,
        },
      }),
    ];

    if (campaign) {
      transactionSteps.push(
        prisma.campaignContact.updateMany({
          where: {
            campaignId: campaign.id,
            contactId: contact.id,
          },
          data: {
            status: 'SENT',
            sentAt,
            failureReason: null,
          },
        }),
      );
    }

    await prisma.$transaction(transactionSteps);

    // Audit log
    await auditSendRetry("EmailLog", emailLog.id, {
      recipientEmail: contact.email,
      messageId: result.messageId,
      templateId: template.id,
      contactId: contact.id,
      campaignId: campaign?.id,
      attempts: result.attempts,
    });

    return { messageId: result.messageId, recipientEmail: contact.email };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const retryCount = emailLog.retryCount + 1;
    const maxRetries = emailLog.maxRetries;
    const shouldRetry = retryCount < maxRetries;
    const nextRetryAt = shouldRetry ? new Date(Date.now() + exponentialBackoffMs(retryCount)) : null;

    const transactionSteps: Prisma.PrismaPromise<unknown>[] = [
      prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.FAILED,
          errorMessage,
          retryCount,
          nextRetryAt,
          metadata: {
            ...(emailLog.metadata as object),
            failure: errorMessage,
            retryCount,
            nextRetryAt: nextRetryAt?.toISOString(),
          } as Prisma.InputJsonValue,
        },
      }),
    ];

    if (campaign) {
      transactionSteps.push(
        prisma.campaignContact.updateMany({
          where: {
            campaignId: campaign.id,
            contactId: contact.id,
          },
          data: {
            status: 'FAILED',
            failureReason: errorMessage,
          },
        }),
      );
    }

    await prisma.$transaction(transactionSteps);

    throw error; // rethrow for caller
  }
}

// Helper functions copied from mail.ts
function renderTemplateValue(template: string, variables: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? "");
}

function getTextBodyFromHtml(bodyHtml: string) {
  return bodyHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function exponentialBackoffMs(attempt: number) {
  const baseDelayMs = 1000; // 1 second
  return baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
}