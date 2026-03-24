import { CampaignContactStatus, ContactStatus, EmailLogStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import { getSmtpRuntimeConfig, getSmtpTransporter } from "@/lib/smtp";

type ManualSingleSendInput = {
  templateId: string;
  contactId: string;
  campaignId?: string | null;
};

function renderTemplateValue(template: string, variables: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? "");
}

function getTextBodyFromHtml(bodyHtml: string) {
  return bodyHtml
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown SMTP error";
}

export async function sendManualSingleEmail(input: ManualSingleSendInput) {
  if (!isDatabaseConfigured()) {
    throw new Error("Sending requires a configured database.");
  }

  const [template, contact] = await Promise.all([
    prisma.emailTemplate.findUnique({
      where: { id: input.templateId },
      select: {
        id: true,
        name: true,
        subject: true,
        bodyHtml: true,
        bodyText: true,
        status: true,
      },
    }),
    prisma.contact.findUnique({
      where: { id: input.contactId },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        email: true,
        countryCode: true,
        status: true,
      },
    }),
  ]);

  if (!template) {
    throw new Error("Selected template was not found.");
  }

  if (!contact) {
    throw new Error("Selected contact was not found.");
  }

  if (
    contact.status === ContactStatus.BOUNCED ||
    contact.status === ContactStatus.UNSUBSCRIBED
  ) {
    throw new Error(`Manual send is blocked for contacts in ${contact.status} status.`);
  }

  const smtp = getSmtpRuntimeConfig();
  const variables = {
    companyName: contact.companyName,
    contactName: contact.contactName ?? contact.companyName,
    countryCode: contact.countryCode,
  };
  const subject = renderTemplateValue(template.subject, variables).trim();
  const html = renderTemplateValue(template.bodyHtml, variables);
  const text = renderTemplateValue(template.bodyText ?? getTextBodyFromHtml(template.bodyHtml), variables);
  const provider = smtp.provider;
  const logMetadata = {
    mode: "manual-single-send",
    templateName: template.name,
    templateStatus: template.status,
    contactStatusAtAttempt: contact.status,
  } as Prisma.InputJsonValue;

  const emailLog = await prisma.emailLog.create({
    data: {
      campaignId: input.campaignId ?? null,
      contactId: contact.id,
      templateId: template.id,
      direction: "OUTBOUND",
      status: EmailLogStatus.PENDING,
      subject,
      recipientEmail: contact.email,
      provider,
      metadata: logMetadata,
    },
  });

  try {
    const info = await getSmtpTransporter().sendMail({
      from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
      to: contact.email,
      subject,
      html,
      text,
    });
    const sentAt = new Date();
    const nextContactStatus =
      contact.status === ContactStatus.NEW || contact.status === ContactStatus.READY
        ? ContactStatus.CONTACTED
        : contact.status;
    const transactionSteps: Prisma.PrismaPromise<unknown>[] = [
      prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.SENT,
          messageId: info.messageId,
          sentAt,
          metadata: {
            mode: "manual-single-send",
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
          } as Prisma.InputJsonValue,
        },
      }),
      prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastContactedAt: sentAt,
          status: nextContactStatus,
        },
      }),
    ];

    if (input.campaignId) {
      transactionSteps.push(
        prisma.campaignContact.updateMany({
          where: {
            campaignId: input.campaignId,
            contactId: contact.id,
          },
          data: {
            status: CampaignContactStatus.SENT,
            sentAt,
            failureReason: null,
          },
        }),
      );
    }

    await prisma.$transaction(transactionSteps);

    return {
      messageId: info.messageId,
      recipientEmail: contact.email,
      provider,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const transactionSteps: Prisma.PrismaPromise<unknown>[] = [
      prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.FAILED,
          errorMessage,
          metadata: {
            mode: "manual-single-send",
            templateName: template.name,
            failure: errorMessage,
          } as Prisma.InputJsonValue,
        },
      }),
    ];

    if (input.campaignId) {
      transactionSteps.push(
        prisma.campaignContact.updateMany({
          where: {
            campaignId: input.campaignId,
            contactId: contact.id,
          },
          data: {
            status: CampaignContactStatus.FAILED,
            failureReason: errorMessage,
          },
        }),
      );
    }

    await prisma.$transaction(transactionSteps);

    throw new Error(`SMTP delivery failed: ${errorMessage}`);
  }
}
