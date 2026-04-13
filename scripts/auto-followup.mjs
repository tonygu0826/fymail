#!/usr/bin/env node
/**
 * Auto follow-up email script for FENGYE LOGISTICS.
 *
 * Checks SENT emails and creates follow-up emails on a schedule:
 *   - 1st email SENT → +3 days → Follow-up #2 (PENDING)
 *   - Follow-up #2 SENT → +4 days → Follow-up #3 (PENDING)
 *   - Follow-up #3 SENT → +7 days → Follow-up #4 (PENDING)
 *
 * Skips contacts that have REPLIED, UNSUBSCRIBED, or BOUNCED.
 * Skips if a follow-up with the same subject already exists (dedup).
 * New emails are created as PENDING — the existing queue cron sends them.
 *
 * Usage: node scripts/auto-followup.mjs
 * Cron:  0 13 * * * (daily at UTC 13:00 = Montreal 9AM EDT)
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually for cron context
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

// -----------------------------------------------------------------------
// Follow-up definitions
// -----------------------------------------------------------------------

const SENDER_NAME = 'Tony Gu';
const SENDER_TITLE = 'FENGYE LOGISTICS';
const SENDER_EMAIL = 'ops@fywarehouse.com';
// Owner for auto-managed follow-up EmailTemplate rows (Local Operator admin)
const FOLLOWUP_TEMPLATE_OWNER_ID = 'cmn47vjzp0000wmr67ypp6zyz';

const FOLLOWUPS = [
  {
    // Follow-up #2: 3 days after 1st email
    sequence: 2,
    slug: 'auto-followup-2-quick',
    daysAfterPrev: 3,
    subject: 'Quick follow-up – FENGYE LOGISTICS',
    bodyHtml: `<p>Hi {{contactName}},</p>
<p>I wanted to follow up on my previous email. I understand you're busy, so I'll keep this brief.</p>
<p>FENGYE LOGISTICS is a CBSA-authorized warehouse in Montreal. Our three core services that help European exporters succeed in Canada:</p>
<ul>
  <li><strong>Bonded Warehousing</strong> — CBSA-authorized sufferance warehouse, duty deferral until goods clear customs</li>
  <li><strong>Cargo Consolidation</strong> — LCL/FCL handling, deconsolidation, and local distribution across Canada</li>
  <li><strong>Customs & Logistics</strong> — End-to-end import clearance, last-mile delivery in Montreal metro area</li>
</ul>
<p>Would you be open to a quick call or email exchange to explore how we might support your Canadian distribution?</p>
<p>Best regards,<br>${SENDER_NAME}<br>${SENDER_TITLE}<br>${SENDER_EMAIL} | +1 438-488-5382<br><a href="https://www.fywarehouse.com">www.fywarehouse.com</a></p>`,
  },
  {
    // Follow-up #3: 4 days after #2
    sequence: 3,
    slug: 'auto-followup-3-ceta-guide',
    daysAfterPrev: 4,
    subject: 'Importing to Canada? Free guide inside',
    bodyHtml: `<p>Hi {{contactName}},</p>
<p>I thought this might be useful for your team — here's a quick overview of importing goods into Canada from Europe:</p>
<h3>CETA Advantage</h3>
<p>Under the Canada-EU Comprehensive Economic and Trade Agreement (CETA), most European goods enter Canada with <strong>zero or reduced tariffs</strong>. This makes Canada one of the most cost-effective markets for European exporters.</p>
<h3>Typical Shipping Flow</h3>
<ol>
  <li><strong>Europe → Port of Montreal</strong> — Ocean freight (LCL or FCL), typically 10-14 days transit</li>
  <li><strong>Customs Clearance</strong> — Our CBSA-authorized sufferance warehouse handles bonded storage and examination</li>
  <li><strong>Distribution</strong> — We deconsolidate and deliver across Montreal, Quebec, and all of Canada</li>
</ol>
<p>Many of our European clients save 15-30% on logistics costs by using Montreal as their Canadian entry point instead of Toronto or Vancouver.</p>
<p>If you'd like a no-obligation logistics assessment for your products, just reply to this email.</p>
<p>Best regards,<br>${SENDER_NAME}<br>${SENDER_TITLE}<br>${SENDER_EMAIL} | +1 438-488-5382<br><a href="https://www.fywarehouse.com">www.fywarehouse.com</a></p>`,
  },
  {
    // Follow-up #4: 7 days after #3
    sequence: 4,
    slug: 'auto-followup-4-last-note',
    daysAfterPrev: 7,
    subject: 'Last note from FENGYE LOGISTICS',
    bodyHtml: `<p>Hi {{contactName}},</p>
<p>I don't want to fill your inbox, so this will be my last message.</p>
<p>If expanding into the Canadian market is on your roadmap — now or in the future — we'd be happy to help. FENGYE LOGISTICS has been supporting European exporters with warehousing and distribution in Montreal since 2019.</p>
<p>Feel free to reach out anytime:</p>
<ul>
  <li>Email: <a href="mailto:${SENDER_EMAIL}">${SENDER_EMAIL}</a></li>
  <li>Phone: +1 438-488-5382</li>
  <li>Website: <a href="https://www.fywarehouse.com">www.fywarehouse.com</a></li>
</ul>
<p>Wishing you and your team all the best.</p>
<p>Warm regards,<br>${SENDER_NAME}<br>${SENDER_TITLE}</p>`,
  },
];

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function personalize(html, contactName) {
  const name = contactName || 'there';
  return html.replace(/\{\{contactName\}\}/g, name);
}

// -----------------------------------------------------------------------
// Main logic
// -----------------------------------------------------------------------

/**
 * Ensure each follow-up sequence has a corresponding EmailTemplate row in
 * the database so that queue worker (lib/queue.ts) can render its body when
 * sending. Upserts by slug, idempotent — safe to call on every cron run.
 * Returns a Map<sequence, templateId>.
 */
async function ensureFollowupTemplates() {
  const map = new Map();
  for (const fu of FOLLOWUPS) {
    const tpl = await prisma.emailTemplate.upsert({
      where: { slug: fu.slug },
      update: {
        subject: fu.subject,
        bodyHtml: fu.bodyHtml,
        status: 'ACTIVE',
      },
      create: {
        name: `Auto Follow-up #${fu.sequence}`,
        slug: fu.slug,
        language: 'EN',
        subject: fu.subject,
        bodyHtml: fu.bodyHtml,
        variables: { contactName: 'string' },
        status: 'ACTIVE',
        ownerId: FOLLOWUP_TEMPLATE_OWNER_ID,
        notes: 'Managed by scripts/auto-followup.mjs — do not edit in UI',
      },
    });
    map.set(fu.sequence, tpl.id);
  }
  return map;
}

async function processFollowups() {
  log('=== Auto follow-up run started ===');

  const templateIds = await ensureFollowupTemplates();
  log(`Ensured ${templateIds.size} follow-up templates`);

  // Get contacts to skip: REPLIED, UNSUBSCRIBED, BOUNCED
  const skipStatuses = ['REPLIED', 'UNSUBSCRIBED', 'BOUNCED'];

  let created = 0;
  let skipped = 0;

  for (const fu of FOLLOWUPS) {
    log(`Processing follow-up #${fu.sequence} (${fu.subject})...`);

    // Determine which subject triggers this follow-up
    let prevSubject;
    if (fu.sequence === 2) {
      // Triggered by ANY first email (any subject that isn't a follow-up)
      prevSubject = null; // special handling below
    } else {
      // Triggered by previous follow-up being SENT
      prevSubject = FOLLOWUPS.find(f => f.sequence === fu.sequence - 1)?.subject;
    }

    // Find SENT emails that are old enough to trigger this follow-up
    const cutoffDate = daysAgo(fu.daysAfterPrev);

    let candidateEmails;
    if (fu.sequence === 2) {
      // First follow-up: find all SENT emails that are NOT follow-up subjects
      const followupSubjects = FOLLOWUPS.map(f => f.subject);
      candidateEmails = await prisma.emailLog.findMany({
        where: {
          status: 'SENT',
          direction: 'OUTBOUND',
          sentAt: { lte: cutoffDate },
          subject: { notIn: followupSubjects },
          contactId: { not: null },
        },
        include: { contact: true },
      });
    } else {
      // Subsequent follow-ups: find SENT emails with previous follow-up subject
      candidateEmails = await prisma.emailLog.findMany({
        where: {
          status: 'SENT',
          direction: 'OUTBOUND',
          sentAt: { lte: cutoffDate },
          subject: prevSubject,
          contactId: { not: null },
        },
        include: { contact: true },
      });
    }

    log(`  Found ${candidateEmails.length} candidate emails`);

    for (const email of candidateEmails) {
      if (!email.contact || !email.contactId) continue;

      // Skip if contact status is bad
      if (skipStatuses.includes(email.contact.status)) {
        skipped++;
        continue;
      }

      // Skip if contact has any INBOUND email (they replied)
      const hasReply = await prisma.emailLog.findFirst({
        where: {
          contactId: email.contactId,
          direction: 'INBOUND',
        },
      });
      if (hasReply) {
        skipped++;
        continue;
      }

      // Skip if this follow-up already exists for this contact (dedup)
      const existing = await prisma.emailLog.findFirst({
        where: {
          contactId: email.contactId,
          subject: fu.subject,
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Create PENDING follow-up email
      const bodyHtml = personalize(fu.bodyHtml, email.contact.contactName);

      await prisma.emailLog.create({
        data: {
          contactId: email.contactId,
          campaignId: email.campaignId || null,
          templateId: templateIds.get(fu.sequence),
          direction: 'OUTBOUND',
          status: 'PENDING',
          subject: fu.subject,
          recipientEmail: email.recipientEmail,
          metadata: {
            followupSequence: fu.sequence,
            triggeredBy: email.id,
            bodyHtml,
          },
        },
      });

      created++;
    }

    log(`  Follow-up #${fu.sequence}: processed`);
  }

  log(`=== Run complete: ${created} follow-ups created, ${skipped} skipped ===`);
}

// -----------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------

processFollowups()
  .catch((err) => {
    log(`FATAL ERROR: ${err.message}`);
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
