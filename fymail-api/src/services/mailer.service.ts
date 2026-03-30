import nodemailer from "nodemailer";
import { db } from "../config/database";
import { senderAccounts, outreachLogs, contacts, templates, campaigns } from "../db/schema";
import { eq } from "drizzle-orm";
import { env } from "../config/env";
import crypto from "crypto";

// ── Encryption helpers ────────────────────────────────────────────────────────
const ALGO = "aes-256-cbc";
const KEY = Buffer.from(env.ENCRYPTION_KEY.padEnd(32).slice(0, 32));

export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPassword(enc: string): string {
  const [ivHex, dataHex] = enc.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ── Variable renderer ─────────────────────────────────────────────────────────
export function renderTemplate(
  template: string,
  vars: Record<string, string | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Transporter factory ───────────────────────────────────────────────────────
async function getTransporter(accountId: string) {
  const [account] = await db
    .select()
    .from(senderAccounts)
    .where(eq(senderAccounts.id, accountId))
    .limit(1);

  if (!account) throw new Error(`Sender account ${accountId} not found`);

  const pass = decryptPassword(account.smtpPassEnc);

  return {
    transporter: nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpPort === 465,
      auth: { user: account.smtpUser, pass },
    }),
    account,
  };
}

// ── Test SMTP connection ──────────────────────────────────────────────────────
export async function testSmtpConnection(accountId: string): Promise<boolean> {
  try {
    const { transporter } = await getTransporter(accountId);
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

// ── Send a single outreach email ──────────────────────────────────────────────
export interface SendEmailOptions {
  logId: string;
  campaignId: string;
  contactId: string;
  senderAccountId: string;
  templateId: string;
}

export async function sendOutreachEmail(opts: SendEmailOptions): Promise<void> {
  const { logId, campaignId, contactId, senderAccountId, templateId } = opts;

  // Fetch contact + template
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, templateId))
    .limit(1);

  if (!contact || !template) {
    await db
      .update(outreachLogs)
      .set({ status: "failed", errorMessage: "Contact or template not found" })
      .where(eq(outreachLogs.id, logId));
    return;
  }

  // Build variable map
  const vars: Record<string, string> = {
    first_name: contact.firstName ?? "",
    last_name: contact.lastName ?? "",
    company: "", // resolved from company join if needed
    job_title: contact.jobTitle ?? "",
    country: contact.country ?? "",
    service_type: contact.serviceTypes?.[0] ?? "",
    website: contact.website ?? "",
    email: contact.email,
  };

  const subjectRendered = renderTemplate(template.subject, vars);
  const bodyRendered = renderTemplate(template.bodyHtml, vars);

  // Inject tracking pixel
  const trackingUrl = `${env.TRACKING_BASE_URL}/v1/t/${logId}.gif`;
  const bodyWithTracking =
    bodyRendered +
    `\n<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`;

  // Get transporter
  const { transporter, account } = await getTransporter(senderAccountId);

  try {
    await transporter.sendMail({
      from: `FYWarehouse <${account.email}>`,
      to: contact.email,
      subject: subjectRendered,
      html: bodyWithTracking,
      text: renderTemplate(template.bodyText ?? "", vars),
    });

    await db
      .update(outreachLogs)
      .set({
        status: "sent",
        subjectRendered,
        sentAt: new Date(),
      })
      .where(eq(outreachLogs.id, logId));

    // Update last used
    await db
      .update(senderAccounts)
      .set({ lastUsedAt: new Date() })
      .where(eq(senderAccounts.id, senderAccountId));

    // Update campaign stats
    await db.execute(
      `UPDATE campaigns SET stat_sent = stat_sent + 1, updated_at = NOW() WHERE id = '${campaignId}'`
    );
  } catch (err: any) {
    await db
      .update(outreachLogs)
      .set({
        status: "failed",
        errorMessage: err.message?.slice(0, 500),
      })
      .where(eq(outreachLogs.id, logId));
  }
}

// ── Record tracking pixel open ────────────────────────────────────────────────
export async function recordOpen(logId: string): Promise<void> {
  const [log] = await db
    .select({ status: outreachLogs.status, campaignId: outreachLogs.campaignId })
    .from(outreachLogs)
    .where(eq(outreachLogs.id, logId))
    .limit(1);

  if (!log || log.status === "replied") return;

  await db
    .update(outreachLogs)
    .set({ status: "opened", openedAt: new Date() })
    .where(eq(outreachLogs.id, logId));

  await db.execute(
    `UPDATE campaigns SET stat_opened = stat_opened + 1 WHERE id = '${log.campaignId}'`
  );
}
