import { CampaignContactStatus, ContactStatus, EmailLogStatus, Prisma, ApprovalTargetType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

import { evaluateApproval, createApprovalRecord } from "@/lib/approval";
import { auditSend, auditSendRetry } from "@/lib/audit";
import { processEmailLog } from "@/lib/queue";

type ManualSingleSendInput = {
  templateId: string;
  contactId: string;
  campaignId?: string | null;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  variables?: Record<string, string>;
};

export type SendEmailOutput = {
  success: boolean;
  error?: string;
  messageId?: string;
  attempts: number;
};

function renderTemplateValue(template: string, variables: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? "");
}

/**
 * Build template variables mapping from contact and template.
 * Uses template.variables (array of string) to determine which fields to include.
 */
export function buildTemplateVariables(
  contact: { companyName: string; contactName?: string | null; countryCode: string; [key: string]: any },
  templateVariables: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of templateVariables) {
    switch (key) {
      case 'companyName':
        result.companyName = contact.companyName;
        break;
      case 'contactName':
        result.contactName = contact.contactName ?? contact.companyName;
        break;
      case 'countryCode':
        result.countryCode = contact.countryCode;
        break;
      default:
        // Try to get from contact object (e.g., marketRegion, jobTitle)
        result[key] = (contact as any)[key] ?? '';
    }
  }
  return result;
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

function getEmailSignature() {
  const fromName = process.env.SMTP_FROM_NAME || "FYWarehouse";
  const fromEmail = process.env.SMTP_FROM_EMAIL || "";
  return {
    html: `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:20px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="padding-right:16px;vertical-align:top;">
            <div style="width:4px;height:48px;background:#2563eb;border-radius:2px;"></div>
          </td>
          <td style="vertical-align:top;">
            <div style="font-size:15px;font-weight:600;color:#111827;">${fromName}</div>
            ${fromEmail ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">${fromEmail}</div>` : ""}
            <div style="font-size:13px;color:#6b7280;margin-top:2px;">fywarehouse.com</div>
          </td>
        </tr>
      </table>`,
    text: `\n\n--\n${fromName}${fromEmail ? `\n${fromEmail}` : ""}\nfywarehouse.com`,
  };
}

/**
 * Check whether a string already contains HTML markup.
 */
function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Convert plain text newlines to <br> tags if the content is not already HTML.
 */
function ensureHtmlLineBreaks(text: string): string {
  if (isHtml(text)) return text;
  // Escape HTML entities in plain text, then convert newlines to <br>
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>\n");
}

function wrapHtmlEmail(bodyHtml: string, customSignature?: string | null) {
  const signature = getEmailSignature();
  const formattedBody = ensureHtmlLineBreaks(bodyHtml);

  // Build custom signature block if provided
  let customSignatureHtml = "";
  if (customSignature && customSignature.trim()) {
    const sigContent = ensureHtmlLineBreaks(customSignature);
    customSignatureHtml = `
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.6;color:#555;">
        ${sigContent}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Email</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:32px 40px;font-size:15px;line-height:1.7;color:#374151;">
              ${formattedBody}
              ${customSignatureHtml}
              ${signature.html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
        variables: true,
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
        marketRegion: true,
        jobTitle: true,
        source: true,
        status: true,
        priority: true,
        score: true,
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

  const provider = "Resend";
  const templateVariables = Array.isArray(template.variables) ? template.variables as string[] : [];
  const variables = buildTemplateVariables(contact, templateVariables);
  const subject = renderTemplateValue(template.subject, variables).trim();
  const html = renderTemplateValue(template.bodyHtml, variables);
  const text = renderTemplateValue(template.bodyText ?? getTextBodyFromHtml(template.bodyHtml), variables);
  const logMetadata = {
    mode: "manual-single-send",
    templateName: template.name,
    templateStatus: template.status,
    contactStatusAtAttempt: contact.status,
    variables,
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
      maxRetries: 3,
      metadata: logMetadata,
    },
  });

  // Evaluate send approval gate
  const approvalResult = await evaluateApproval(
    ApprovalTargetType.SEND,
    emailLog.id,
    { contact, template }
  );

  // Create approval record
  const approval = await createApprovalRecord(
    ApprovalTargetType.SEND,
    emailLog.id,
    approvalResult.score,
    approvalResult.rules,
    approvalResult.status,
    approvalResult.reason
  );

  // Update metadata with approval info
  await prisma.emailLog.update({
    where: { id: emailLog.id },
    data: {
      metadata: {
        ...(logMetadata as object),
        approvalId: approval.id,
        approvalStatus: approvalResult.status,
      } as Prisma.InputJsonValue,
    },
  });

  // All sends require manual approval — do not send immediately
  return {
    messageId: undefined,
    recipientEmail: contact.email,
    provider,
    pendingApproval: true,
    approvalId: approval.id,
  };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
  const { to, subject, html, text, variables = {} } = input;

  const renderedSubject = renderTemplateValue(subject, variables);
  const rawHtml = renderTemplateValue(html, variables);
  const customSignature = text ? renderTemplateValue(text, variables) : null;
  const renderedHtml = wrapHtmlEmail(rawHtml, customSignature);
  const signature = getEmailSignature();
  const renderedText = (customSignature ?? getTextBodyFromHtml(rawHtml)) + signature.text;
  
  // Resend API configuration
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return { success: false, error: "RESEND_API_KEY is not configured", attempts: 1 };
  }

  const fromAddress = "FENGYE LOGISTICS <ops@fywarehouse.com>";

  // Retry configuration
  const maxRetries = 3;
  const baseDelayMs = 1000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject: renderedSubject,
          html: renderedHtml,
          text: renderedText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Resend API error: ${response.status}`);
      }

      if (attempt > 1) {
        console.log(`Email sent successfully on retry attempt ${attempt} to ${to}`);
      }

      return {
        success: true,
        messageId: data.id,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = getErrorMessage(error);

      console.warn(`Email send attempt ${attempt}/${maxRetries} failed: ${errorMessage}`);

      if (attempt === maxRetries) {
        break;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const finalErrorMessage = getErrorMessage(lastError);
  return {
    success: false,
    error: finalErrorMessage,
    attempts: maxRetries,
  };
}
