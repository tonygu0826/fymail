#!/usr/bin/env node
/**
 * Gmail → fymail reply sync.
 *
 * Reads recent messages from the authorized Gmail mailbox
 * (tonygu0826@gmail.com, which receives forwarded mail from
 * ops@fywarehouse.com), matches sender email to a fymail Contact, and:
 *   - inserts an INBOUND EmailLog row (so dedup works)
 *   - sets contact.status = REPLIED (so auto-followup skips them)
 *
 * Only messages that were originally addressed to ops@fywarehouse.com
 * are scanned, so personal emails in tonygu0826@gmail.com are ignored.
 *
 * Idempotent: messages already mirrored (matched by metadata.gmailId)
 * are skipped, so the script can run as often as you like.
 *
 * Usage: node scripts/sync-gmail-replies.mjs
 * Cron:  every 30 minutes (use 0,30 * * * * in crontab)
 *
 * Required env vars (in .env.local):
 *   GMAIL_CLIENT_ID         OAuth client ID from Google Cloud Console
 *   GMAIL_CLIENT_SECRET     OAuth client secret
 *   GMAIL_REFRESH_TOKEN     Refresh token (obtain via OAuth Playground —
 *                           see GMAIL_SETUP.md for instructions)
 *   GMAIL_USER_ADDRESS      Optional. Defaults to "me" which means the
 *                           OAuth-authorized user (tonygu0826@gmail.com).
 *   GMAIL_SEARCH_QUERY      Optional. Defaults to scanning recent inbox
 *                           messages addressed to ops@fywarehouse.com.
 *
 * Required npm package: googleapis
 *   Run once: cd /home/ubuntu/fymail && npm install googleapis
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------
// Env loader (same pattern as auto-followup.mjs)
// ------------------------------------------------------------------
try {
  const envPath = resolve(__dirname, '..', '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* ok if missing */ }

const prisma = new PrismaClient();

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
// "me" means the OAuth-authorized user (tonygu0826@gmail.com).
// Override only if you ever migrate ops@fywarehouse.com to its own Workspace.
const GMAIL_USER_ADDRESS = process.env.GMAIL_USER_ADDRESS || 'me';

// Search query: scan all recent inbox messages. Personal mail is filtered
// out later by the contact-email match (only senders that exist in the fymail
// Contact table get an INBOUND row written). 7d lookback gives plenty of
// overlap; idempotency is enforced by gmailId dedup.
const LOOKBACK_QUERY = process.env.GMAIL_SEARCH_QUERY ||
  'in:inbox newer_than:7d';
const PAGE_SIZE = 100;

function log(msg, extra) {
  const ts = new Date().toISOString();
  if (extra !== undefined) {
    console.log(`[${ts}] ${msg}`, JSON.stringify(extra));
  } else {
    console.log(`[${ts}] ${msg}`);
  }
}

function abortIfMisconfigured() {
  const missing = [];
  if (!GMAIL_CLIENT_ID) missing.push('GMAIL_CLIENT_ID');
  if (!GMAIL_CLIENT_SECRET) missing.push('GMAIL_CLIENT_SECRET');
  if (!GMAIL_REFRESH_TOKEN) missing.push('GMAIL_REFRESH_TOKEN');
  if (missing.length > 0) {
    log(`FATAL: missing env vars: ${missing.join(', ')}`);
    log('See scripts/auth-gmail-once.mjs to obtain a refresh token.');
    process.exit(1);
  }
}

// Parse "Tony <ops@example.com>" or "ops@example.com" → "ops@example.com"
function extractSenderEmail(fromHeader) {
  if (!fromHeader) return null;
  const angleMatch = fromHeader.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();
  const bareMatch = fromHeader.match(/([^\s,;]+@[^\s,;]+)/);
  if (bareMatch) return bareMatch[1].trim().toLowerCase();
  return null;
}

// ------------------------------------------------------------------
// Main sync
// ------------------------------------------------------------------
async function syncInbox() {
  abortIfMisconfigured();

  log('=== Gmail reply sync started ===');

  const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // List recent inbox messages (handles pagination)
  let messages = [];
  let pageToken = undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: GMAIL_USER_ADDRESS,
      q: LOOKBACK_QUERY,
      maxResults: PAGE_SIZE,
      pageToken,
    });
    messages = messages.concat(res.data.messages || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken && messages.length < 5000); // hard cap to avoid runaway

  log(`Found ${messages.length} candidate messages in last 7 days`);

  let newReplies = 0;
  let skippedAlreadyMirrored = 0;
  let skippedNoContact = 0;
  let skippedSelfSent = 0;

  for (const m of messages) {
    // Skip if we already mirrored this gmail message
    const existing = await prisma.emailLog.findFirst({
      where: {
        direction: 'INBOUND',
        // metadata->>'gmailId' = m.id  (Prisma JSON path filter)
        AND: [
          { metadata: { path: ['gmailId'], equals: m.id } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      skippedAlreadyMirrored++;
      continue;
    }

    // Fetch headers only (cheapest call)
    let msgRes;
    try {
      msgRes = await gmail.users.messages.get({
        userId: GMAIL_USER_ADDRESS,
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'Message-Id', 'In-Reply-To', 'References'],
      });
    } catch (err) {
      log(`WARN: failed to fetch message ${m.id}: ${err.message}`);
      continue;
    }

    const headers = msgRes.data.payload?.headers || [];
    const getHeader = (name) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const fromHeader = getHeader('From');
    const subject = getHeader('Subject') || '(no subject)';
    const messageIdHeader = getHeader('Message-Id');
    const inReplyTo = getHeader('In-Reply-To');
    const references = getHeader('References');
    const internalDate = msgRes.data.internalDate
      ? new Date(parseInt(msgRes.data.internalDate, 10))
      : new Date();

    const senderEmail = extractSenderEmail(fromHeader);
    if (!senderEmail) {
      log(`SKIP: cannot parse sender from "${fromHeader}" (gmail ${m.id})`);
      continue;
    }

    // Skip emails sent FROM us (Gmail shows sent-with-cc-to-self in inbox)
    if (senderEmail.endsWith('@fywarehouse.com')) {
      skippedSelfSent++;
      continue;
    }

    // Match contact by email (case-insensitive)
    const contact = await prisma.contact.findFirst({
      where: { email: { equals: senderEmail, mode: 'insensitive' } },
      select: { id: true, email: true, status: true, contactName: true },
    });

    if (!contact) {
      skippedNoContact++;
      continue;
    }

    // Insert INBOUND EmailLog row (the "we received a reply" record)
    await prisma.emailLog.create({
      data: {
        contactId: contact.id,
        direction: 'INBOUND',
        status: 'DELIVERED',
        subject,
        // The semantic recipient is ops@fywarehouse.com even though the
        // physical mailbox we read from is tonygu0826@gmail.com (forwarded).
        recipientEmail: 'ops@fywarehouse.com',
        provider: 'gmail',
        sentAt: internalDate,
        metadata: {
          gmailId: m.id,
          gmailThreadId: msgRes.data.threadId,
          fromHeader,
          messageIdHeader,
          inReplyTo,
          references,
          syncedAt: new Date().toISOString(),
          source: 'sync-gmail-replies.mjs',
        },
      },
    });

    // Promote contact status to REPLIED unless they're already in a stop state
    if (contact.status !== 'BOUNCED' && contact.status !== 'UNSUBSCRIBED') {
      if (contact.status !== 'REPLIED') {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { status: 'REPLIED' },
        });
      }
    }

    newReplies++;
    log(`REPLIED: ${contact.email} (${contact.contactName || 'no name'})`);
  }

  log(`=== Done: candidates=${messages.length} new_replies=${newReplies} already_mirrored=${skippedAlreadyMirrored} no_contact=${skippedNoContact} self_sent=${skippedSelfSent} ===`);
}

// ------------------------------------------------------------------
// Entry point
// ------------------------------------------------------------------
syncInbox()
  .catch((err) => {
    log(`FATAL: ${err.message}`);
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
