#!/usr/bin/env node
/**
 * LinkedIn post sender (fywarehouse only).
 *
 * Runs at 10:00 and 20:00 Montreal. Reads today's queue file, picks the
 * one slot scheduled at-or-before now with status=PENDING, scans for
 * forbidden phrases ONE LAST TIME, then POSTs to LinkedIn /v2/ugcPosts
 * as the authenticated member (Tony Gu personal profile).
 *
 * On success: status=POSTED + saves the post URN.
 * On 401: token expired — sends an email alert and marks status=FAILED.
 * On other failure: status=FAILED with error logged. NO automatic retry
 * (we don't want to re-post the same content twice).
 *
 * Token expiry warning: if access token expires within 7 days, sends a
 * pre-emptive email (idempotent: only once per token-rotation).
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/fymail/.env.local" });

const ROOT = "/home/ubuntu/fymail/scripts/linkedin-posts";
const FORBIDDEN = JSON.parse(fs.readFileSync(path.join(ROOT, "forbidden.json"), "utf-8"));
const QUEUE_DIR = path.join(ROOT, "queue");
const ALERT_STATE = path.join(ROOT, "alert-state.json");

const ALERT_EMAIL = "ops@fywarehouse.com";

function todayMontrealIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function checkForbidden(text) {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN.phrases) {
    if (lower.includes(phrase)) return { ok: false, reason: `forbidden phrase: "${phrase}"` };
  }
  const emDashes = (text.match(/—/g) || []).length;
  if (emDashes >= 3) return { ok: false, reason: `too many em-dashes (${emDashes})` };
  return { ok: true };
}

async function sendAlert(subject, body) {
  // Use Resend (already configured in fymail .env.local). If RESEND_API_KEY
  // is missing we just log to stderr — better to log loud than to silently swallow.
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error(`[ALERT] (no RESEND_API_KEY, logging only)\nSubject: ${subject}\n\n${body}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "LinkedIn Bot <ops@fywarehouse.com>",
        to: [ALERT_EMAIL],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      console.error(`[ALERT] Resend ${res.status}: ${await res.text()}`);
    }
  } catch (e) {
    console.error(`[ALERT] Resend network: ${e.message}`);
  }
}

function loadAlertState() {
  if (!fs.existsSync(ALERT_STATE)) return { tokenExpiryWarnedFor: null };
  return JSON.parse(fs.readFileSync(ALERT_STATE, "utf-8"));
}

function saveAlertState(s) {
  fs.writeFileSync(ALERT_STATE, JSON.stringify(s, null, 2));
}

async function checkTokenExpiry() {
  const expiresAt = process.env.LINKEDIN_TOKEN_EXPIRES_AT;
  if (!expiresAt) return;
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86400000;
  if (days > 7) return;

  const alertState = loadAlertState();
  if (alertState.tokenExpiryWarnedFor === expiresAt) return;

  await sendAlert(
    `LinkedIn token expires in ${Math.ceil(days)} days (${expiresAt})`,
    `Tony,

The LinkedIn access token in /home/ubuntu/fymail/.env.local expires on ${expiresAt}.

After it expires, daily LinkedIn posts will fail with 401.

To rotate: rerun the OAuth authorization flow (open the LinkedIn /oauth/v2/authorization
URL in your browser, allow, copy the callback URL with code= back to Claude in a session
and let it exchange for a new token).

— linkedin-posts/send.mjs`
  );
  alertState.tokenExpiryWarnedFor = expiresAt;
  saveAlertState(alertState);
}

async function postToLinkedin(body) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const memberUrn = process.env.LINKEDIN_MEMBER_URN;
  if (!accessToken || !memberUrn) throw new Error("LINKEDIN_ACCESS_TOKEN or LINKEDIN_MEMBER_URN missing");

  const payload = {
    author: memberUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: body },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`linkedin ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  const postUrn = data.id || res.headers.get("x-restli-id") || "";
  return {
    postUrn,
    externalUrl: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : "",
  };
}

async function main() {
  await checkTokenExpiry();

  const today = todayMontrealIso();
  const queueFile = path.join(QUEUE_DIR, `${today}.json`);
  if (!fs.existsSync(queueFile)) {
    console.log(`No queue file for ${today} (run generate.mjs first). Exiting.`);
    return;
  }

  const queue = JSON.parse(fs.readFileSync(queueFile, "utf-8"));
  const now = new Date();
  const due = queue.find(
    (q) => q.status === "PENDING" && new Date(q.scheduledAt).getTime() <= now.getTime()
  );

  if (!due) {
    console.log(`No PENDING post due. Queue status: ${queue.map((q) => `${q.slot}=${q.status}`).join(", ")}`);
    return;
  }

  console.log(`→ posting ${due.slot} (${due.topicId})`);
  console.log(`  body length: ${due.body.length}`);

  const recheck = checkForbidden(due.body);
  if (!recheck.ok) {
    due.status = "FAILED";
    due.failureReason = `pre-send recheck: ${recheck.reason}`;
    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
    console.error(`  ✗ rejected at send-time: ${recheck.reason}`);
    await sendAlert(
      `LinkedIn post BLOCKED at send-time (${due.slot})`,
      `Topic: ${due.topicId}\nReason: ${recheck.reason}\n\nBody:\n${due.body}`
    );
    return;
  }

  if (process.env.DRY_RUN === "1") {
    console.log(`  [DRY_RUN=1] would post:\n${due.body}\n`);
    return;
  }

  try {
    const { postUrn, externalUrl } = await postToLinkedin(due.body);
    due.status = "POSTED";
    due.postedAt = new Date().toISOString();
    due.postUrn = postUrn;
    due.externalUrl = externalUrl;
    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
    console.log(`  ✓ posted: ${externalUrl || postUrn}`);
  } catch (e) {
    due.status = "FAILED";
    due.failureReason = e.message;
    due.failedAt = new Date().toISOString();
    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
    console.error(`  ✗ ${e.message}`);

    if (e.status === 401) {
      await sendAlert(
        `LinkedIn 401 — token expired or revoked`,
        `Today's ${due.slot} post failed with 401. Rotate the LinkedIn access token.\n\nBody that didn't post:\n${due.body}`
      );
    } else {
      await sendAlert(
        `LinkedIn post FAILED (${due.slot})`,
        `Topic: ${due.topicId}\nError: ${e.message}\n\nBody:\n${due.body}`
      );
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
