#!/usr/bin/env node
/**
 * CSCB (Canadian Society of Customs Brokers) → CanFlow Global article pipeline.
 *
 * MX setup reality check (as of 2026-04-16):
 *   canflow-global.com MX → Cloudflare route{1,2,3}.mx.cloudflare.net
 *   CF Email Routing: info@canflow-global.com → ops@fywarehouse.com
 *   So CSCB emails physically arrive in ops@fywarehouse.com (Workspace),
 *   and we authenticate with the existing GMAIL_REFRESH_TOKEN (ops@ user).
 *
 * Flow:
 *   1. OAuth into ops@fywarehouse.com (reuse existing token from sync-gmail-replies.mjs)
 *   2. Find recent messages from info@cscb.ca
 *   3. Parse article links out of each newsletter body
 *   4. Jina Reader → full article text
 *   5. Claude rewrite → CanFlow Global insight article
 *   6. Write markdown to canflow-global/src/content/insights/en/<slug>.md
 *   7. Build + wrangler deploy (only if any articles were created)
 *
 * Dedup:
 *   - Processed Gmail message IDs tracked in cscb-state.json (rerunnable)
 *   - Source article URLs checked against existing canflow insights too
 *
 * Env (all in /home/ubuntu/fymail/.env.local):
 *   GMAIL_CLIENT_ID          Existing (shared with sync-gmail-replies.mjs)
 *   GMAIL_CLIENT_SECRET      Existing
 *   GMAIL_REFRESH_TOKEN      Existing (ops@fywarehouse.com)
 *   ANTHROPIC_API_KEY        Claude API
 *   JINA_API_KEY             Optional but recommended
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------
// Env loader
// ------------------------------------------------------------------
const ENV_PATHS = [
  '/home/ubuntu/fymail/.env.local',
  '/home/ubuntu/.openclaw/workspace/canflow-global/.env.local',
];
for (const p of ENV_PATHS) {
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
// Reuses the ops@fywarehouse.com refresh token — CSCB emails arrive there
// via Cloudflare Email Routing (info@canflow-global.com → ops@fywarehouse.com).
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const JINA_API_KEY = process.env.JINA_API_KEY;

const CANFLOW_ROOT = '/home/ubuntu/.openclaw/workspace/canflow-global';
const INSIGHTS_DIR = path.join(CANFLOW_ROOT, 'src/content/insights/en');
const STATE_FILE = path.join(__dirname, 'cscb-state.json');

const CSCB_SENDER = 'info@cscb.ca';
const LOOKBACK_DAYS = parseInt(process.env.CSCB_LOOKBACK_DAYS || '30', 10);
const MAX_ARTICLES_PER_RUN = parseInt(process.env.CSCB_MAX_ARTICLES || '5', 10);
const DRY_RUN = process.env.CSCB_DRY_RUN === '1';
const SKIP_DEPLOY = process.env.CSCB_SKIP_DEPLOY === '1';

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function requireEnv() {
  const missing = [];
  if (!GMAIL_CLIENT_ID) missing.push('GMAIL_CLIENT_ID');
  if (!GMAIL_CLIENT_SECRET) missing.push('GMAIL_CLIENT_SECRET');
  if (!REFRESH_TOKEN) missing.push('GMAIL_REFRESH_TOKEN');
  if (!ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
  if (missing.length) {
    log(`FATAL: missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ------------------------------------------------------------------
// State (processed Gmail message IDs)
// ------------------------------------------------------------------
function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { processedGmailIds: [], processedUrls: [] };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { processedGmailIds: [], processedUrls: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ------------------------------------------------------------------
// Gmail reader
// ------------------------------------------------------------------
async function listCscbMessages(gmail) {
  const q = `from:${CSCB_SENDER} newer_than:${LOOKBACK_DAYS}d`;
  const messages = [];
  let pageToken;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 100,
      pageToken,
    });
    messages.push(...(res.data.messages || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken && messages.length < 500);
  return messages;
}

async function fetchMessageBody(gmail, id) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full',
  });
  return res.data;
}

function getHeader(headers, name) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function b64urlToString(data) {
  if (!data) return '';
  const fixed = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(fixed, 'base64').toString('utf-8');
}

function extractHtmlAndText(payload) {
  let html = '';
  let text = '';
  function walk(part) {
    if (!part) return;
    const mime = part.mimeType || '';
    const body = part.body?.data;
    if (mime === 'text/html' && body) {
      html += b64urlToString(body);
    } else if (mime === 'text/plain' && body) {
      text += b64urlToString(body);
    }
    for (const p of part.parts || []) walk(p);
  }
  walk(payload);
  return { html, text };
}

// ------------------------------------------------------------------
// Article extraction from CSCB newsletter plain-text body.
//
// CSCB Digest emails have a predictable plain-text format:
//   ARTICLES
//
//     Article Title Here
//   [https://cscb.ca/en/article/slug]
//
//     Summary paragraph with 2-5 sentences of actual article content...
//
//             Learn more
//   [https://cscb.ca/en/article/slug]  <-- same URL repeated
//
// We split on the repeated-URL "Learn more" marker and build
// {title, url, summary} tuples. No external fetch needed — the
// summary in the email is substantial enough for Claude to rewrite.
// ------------------------------------------------------------------

function extractArticlesFromText(text) {
  if (!text) return [];

  // Only process content after the "ARTICLES" header (skip TOC + intro).
  const articlesMarker = text.search(/^\s*ARTICLES\s*$/m);
  const body = articlesMarker >= 0 ? text.slice(articlesMarker) : text;

  // Split into blocks on the "Learn more\n[URL]" marker.
  // Each block ends just before a "Learn more" CTA.
  const parts = body.split(/\n\s*Learn more\s*\n\[[^\]]+\]\s*\n+/);

  const results = [];
  const seen = new Set();

  for (const part of parts) {
    // Find the first title + URL pair in this block.
    // Title: a non-blank line that's not in brackets.
    // URL:   the next line containing [http...].
    const m = part.match(
      /^\s*([^\[\n][^\n]{3,200})\n\s*\[(https?:\/\/cscb\.ca\/en\/article\/[^\]]+)\]\s*\n([\s\S]*)$/m,
    );
    if (!m) continue;
    const title = m[1].trim().replace(/\s+/g, ' ');
    const url = m[2].trim();
    const summary = m[3]
      .replace(/^\s+|\s+$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .slice(0, 3000);

    if (!title || !url || summary.length < 100) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({ title, url, summary });
  }

  return results;
}

// ------------------------------------------------------------------
// Claude rewrite
// ------------------------------------------------------------------
async function rewriteWithClaude(source) {
  const prompt = `You are a senior Canadian licensed customs broker with 15+ years on the trade floor, writing for CanFlow Global — our own brokerage and freight forwarder. The readers are import managers, supply chain leads, and in-house trade compliance people at mid-market Canadian importers. They already know the basics. Don't explain what CBSA is. Talk to them like a peer in the industry.

The source is a short entry from the CSCB (Canadian Society of Customs Brokers) daily digest. Use it as the springboard — expand into a real, substantive piece using your own domain knowledge of CARM, CBSA, SIMA, eManifest, HS classification, D-memos, drawback, NRI, CUSMA / CETA / CPTPP origin, B3, ACI, FIRMS codes, etc.

SOURCE TITLE: ${source.title}
SOURCE URL: ${source.url}
SOURCE SUMMARY:
${source.summary}

VOICE — read this carefully, it's the most important part:
- Write like a working broker, not a journalist or an AI summarizer.
- Zero AI fluff. No "in today's fast-paced world". No "it is important to note". No "in conclusion". No "let's explore". No "navigating the complexities of…". No generic openers.
- Do NOT use "First, Second, Finally" or "To begin with / Next / In summary". No student-essay scaffolding.
- Do NOT use em-dashes as filler pauses.
- No template structure (Intro / Key points / Conclusion). Start wherever the actual insight is.
- Have a point of view. Make calls. If something is a bad idea, say so. If a delay is routine noise vs a real issue, say which.
- Use real operational detail: specific release types (PARS / RMD / release prior to payment), specific CBSA service areas, actual day-to-day consequences ("if your broker files at 4pm Friday on a Thursday arrival, expect…"), cost numbers where reasonable, deadlines.
- Use the industry's real language. B3, SIMA, NRM, subject goods, the GST account, SIN/BN15 registration, the RPP bond math, NRI penalty rates, D17-1-10 — name things the way brokers actually name them.
- Take sides. "This part of CARM is fine, this part is a trap." "Most CBSA processing delay notices are shrug-and-wait; this one isn't."
- Allow asides, short sentences, and one-liners. Mix paragraph rhythm.

HARD REQUIREMENTS:
1. Specifically about Canadian import / customs / freight into Canada. If the source is tangential, pivot hard to the Canadian importer angle. Don't fake-bridge.
2. Length: 700-1100 words.
3. Format: Markdown. Use H2/H3 for real section shifts, not decoration. Short paragraphs okay. Bullet lists only where they'd actually help a reader skim — not as default structure.
4. Internal links: naturally weave in 1-2 of these where a reader would genuinely want them. Never force all five:
   - /en/services/brokerage/
   - /en/services/freight/
   - /en/services/duty/
   - /en/services/compliance/
   - /en/tools/hs-classify/
5. End with ONE short paragraph (2-3 sentences max) that's a soft CTA linking to /en/contact/. Not a hype close. Something like "If you want a second opinion on your RPP bond sizing, that's the kind of call we take all day. [Get in touch](/en/contact/)."
6. Tags: 3-5, lowercase, hyphenated if multi-word.
7. imageCategory: ONE best fit from: warehouse, shipping, customs, logistics, trade, technology, montreal, cold-chain, ecommerce, security, port.

Respond as RAW JSON only, no markdown code fences:
{
  "title": "...",
  "summary": "...",
  "tags": ["tag1","tag2","tag3"],
  "imageCategory": "customs",
  "body": "Markdown body starting with a first paragraph or H2..."
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = json.content?.[0]?.text || '';
  // Empty-response guard: if Claude returns no text (refusal / stop_sequence
  // at start / truncation past max_tokens before any content), don't generate
  // an empty article. Callers treat the throw as "skip this CSCB email" and
  // move on — far better than publishing a placeholder-body article.
  if (!text.trim()) {
    throw new Error(`Claude 返回空内容（stop_reason=${json.stop_reason}, usage=${JSON.stringify(json.usage)}）— 跳过`);
  }
  const parsed = parseClaudeJson(text);
  // Post-parse guard: parseClaudeJson's last-layer fallback can return a
  // partial object; we require all of title/body at minimum or we skip.
  if (!parsed?.title?.trim() || !parsed?.body?.trim()) {
    throw new Error(`Claude 响应缺必要字段 title/body — 跳过`);
  }
  return parsed;
}

// ------------------------------------------------------------------
// Robust Claude-JSON parser. Claude occasionally emits invalid JSON
// when markdown body contains unescaped quotes or bare newlines inside
// the "body" value. Three-layer fallback keeps the article instead
// of throwing the whole rewrite away.
// ------------------------------------------------------------------
function parseClaudeJson(raw) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  // Layer 1: strict JSON parse
  try { return JSON.parse(cleaned); } catch {}

  // Layer 2: extract outermost {...} by brace-counting that respects strings+escapes
  const start = cleaned.indexOf('{');
  if (start >= 0) {
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > 0) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
    }
  }

  // Layer 3: tolerant field-by-field regex extraction. Picks up each
  // known field individually and peels "body" (always last, multiline
  // markdown) from after "body":" to the last quote before closing }.
  log(`    claude JSON parse failed — falling back to field extraction`);
  const out = {};
  const unesc = (s) => s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\\//g, '/');

  const titleM = cleaned.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (titleM) out.title = unesc(titleM[1]);
  const summaryM = cleaned.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (summaryM) out.summary = unesc(summaryM[1]);
  const tagsM = cleaned.match(/"tags"\s*:\s*\[([^\]]*)\]/);
  if (tagsM) {
    out.tags = Array.from(tagsM[1].matchAll(/"((?:\\.|[^"\\])*)"/g)).map((m) => unesc(m[1]));
  }
  const imgM = cleaned.match(/"imageCategory"\s*:\s*"([^"]*)"/);
  if (imgM) out.imageCategory = imgM[1];

  const bodyTag = cleaned.match(/"body"\s*:\s*"/);
  if (bodyTag) {
    const tail = cleaned.slice(bodyTag.index + bodyTag[0].length);
    const lastQuote = tail.lastIndexOf('"');
    if (lastQuote > 0) out.body = unesc(tail.slice(0, lastQuote));
  }

  if (!out.title || !out.body) {
    throw new Error(`parseClaudeJson: could not recover required fields. Preview: ${cleaned.slice(0, 300)}`);
  }
  out.tags = out.tags || [];
  out.imageCategory = out.imageCategory || 'customs';
  out.summary = out.summary || '';
  return out;
}

// ------------------------------------------------------------------
// Image picker (copied verbatim from generate-daily-articles.mjs so we stay
// in sync with the canflow image pool)
// ------------------------------------------------------------------
const U = 'https://images.unsplash.com/';
const S = '?auto=format&fit=crop&w=1200&q=80';

const IMAGE_POOL = {
  warehouse: ['photo-1586528116311-ad8dd3c8310d','photo-1553413077-190dd305871c','photo-1565891741441-64926e441838','photo-1578575437130-527eed3abbec','photo-1601598851547-4302969d0614','photo-1587293852726-70cdb56c2866','photo-1600880292203-757bb62b4baf','photo-1595079676339-1534801ad6cf','photo-1581091226825-a6a2a5aee158','photo-1556761175-5973dc0f32e7','photo-1504917595217-d4dc5ebe6122','photo-1416339306562-f3d12fefd36f','photo-1504711331083-9c895941bf81','photo-1562832135-14a35d25edef'],
  shipping: ['photo-1559136555-9303baea8ebd','photo-1591261730799-ee4e6c2d16d7','photo-1577563908411-5077b6dc7624','photo-1520697830682-bbb6e85e2b0b','photo-1611117775350-ac3950990985','photo-1567789884554-0b844b597180','photo-1605732562742-3023a888e56e','photo-1570710891163-6d3b5c47248b','photo-1541185933-ef5d8ed016c2','photo-1494412685616-a5d310fbb07d','photo-1541354329998-f4d9a9f9297f','photo-1579532536935-619928decd08'],
  customs: ['photo-1450101499163-c8848c66ca85','photo-1554224155-6726b3ff858f','photo-1507679799987-c73779587ccf','photo-1589829085413-56de8ae18c73','photo-1521791136064-7986c2920216','photo-1434030216411-0b793f4b4173','photo-1568992687947-868a62a9f521','photo-1542744173-8e7e53415bb0','photo-1497366216548-37526070297c','photo-1454165804606-c3d57bc86b40','photo-1664575602554-2087b04935a5'],
  logistics: ['photo-1519003722824-194d4455a60c','photo-1566576912321-d58ddd7a6088','photo-1580674285054-bed31e145f59','photo-1616432043562-3671ea2e5242','photo-1505682634904-d7c8d95cdc50','photo-1462989856370-729a9c1e2c91','photo-1543499459-d1460946bdc6','photo-1498049794561-7780e7231661','photo-1533473359331-0135ef1b58bf'],
  trade: ['photo-1526304640581-d334cdbbf45e','photo-1611974789855-9c2a0a7236a3','photo-1460925895917-afdab827c52f','photo-1444653614773-995cb1ef9efa','photo-1486406146926-c627a92ad1ab','photo-1590283603385-17ffb3a7f29f','photo-1604689598793-b8bf1dc445a1','photo-1560520653-9e0e4c89eb11','photo-1579532537598-459ecdaf39cc','photo-1535320903710-d993d3d77d29','photo-1507003211169-0a1dd7228f2d'],
  technology: ['photo-1485827404703-89b55fcc595e','photo-1518770660439-4636190af475','photo-1531297484001-80022131f5a1','photo-1550751827-4bd374c3f58b','photo-1620712943543-bcc4688e7485','photo-1558494949-ef010cbdcc31','photo-1504639725590-34d0984388bd','photo-1555949963-ff9fe0c870eb','photo-1535378917042-10a22c95931a','photo-1563986768494-4dee2763ff3f','photo-1526374965328-7f61d4dc18c5','photo-1516321318423-f06f85e504b3'],
  montreal: ['photo-1519178614-68673b201f36','photo-1519817914152-22d216bb9170','photo-1544027993-37dbfe43562a','photo-1517935706615-2717063c2225','photo-1519974719765-e6559eac2575','photo-1477959858617-67f85cf4f1df','photo-1502602898657-3e91760cbb34','photo-1503023345310-bd7c1de61c7d','photo-1444723121867-7a241cacace9','photo-1480714378408-67cf0d13bc1b'],
  'cold-chain': ['photo-1584568694244-14fbdf83bd30','photo-1530103862676-de8c9debad1d','photo-1609840114035-3c981b782dfe','photo-1585771724684-38269d6639fd','photo-1628260412297-a3377e45006f','photo-1504674900247-0877df9cc836','photo-1587049352851-8d4e89133924','photo-1560717789-0ac7c58ac90a','photo-1501430654243-c934cec2e1c0','photo-1575224300306-1b8da36134ec','photo-1559827260-dc66d52bef19','photo-1518843875459-f738682238a6'],
  ecommerce: ['photo-1556742049-0cfed4f6a45d','photo-1563013544-824ae1b704d3','photo-1472851294608-062f824d29cc','photo-1523474253046-8cd2748b5fd2','photo-1441986300917-64674bd600d8','photo-1586880244386-8b3e34c8382c','photo-1607083206869-4c7672e72a8a','photo-1556742111-a301076d9d18','photo-1580674684081-7617fbf3d745','photo-1516321497487-e288fb19713f'],
  security: ['photo-1555949963-aa79dcee981c','photo-1510511459019-5dda7724fd87','photo-1614064641938-3bbee52942c7','photo-1510915361894-db8b60106cb1','photo-1542831371-29b0f74f9713'],
  port: ['photo-1552083375-1447ce886485','photo-1524492412937-b28074a5d7da','photo-1544620347-c4fd4a3d5957','photo-1501700493788-fa1a4fc9fe62','photo-1523275335684-37898b6baf30','photo-1517142089942-ba376ce32a2e'],
};

function getUsedImages() {
  const used = new Set();
  if (!fs.existsSync(INSIGHTS_DIR)) return used;
  for (const f of fs.readdirSync(INSIGHTS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const txt = fs.readFileSync(path.join(INSIGHTS_DIR, f), 'utf-8');
    const m = txt.match(/featuredImage:\s*"?([^"\n]+)"?/);
    if (m) used.add(m[1]);
  }
  return used;
}

function pickImage(category) {
  const used = getUsedImages();
  const fallbackOrder = ['customs', 'trade', 'shipping', 'logistics', 'warehouse', 'port'];
  const order = [category, ...fallbackOrder.filter((c) => c !== category)];
  for (const cat of order) {
    const pool = IMAGE_POOL[cat];
    if (!pool) continue;
    const available = pool.filter((p) => !used.has(`${U}${p}${S}`));
    if (available.length > 0) {
      const pick = available[Math.floor(Math.random() * available.length)];
      return `${U}${pick}${S}`;
    }
  }
  const pool = IMAGE_POOL.customs;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return `${U}${pick}${S}`;
}

// ------------------------------------------------------------------
// Writer
// ------------------------------------------------------------------
function getExistingSourceUrls() {
  const urls = new Set();
  if (!fs.existsSync(INSIGHTS_DIR)) return urls;
  for (const f of fs.readdirSync(INSIGHTS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const txt = fs.readFileSync(path.join(INSIGHTS_DIR, f), 'utf-8');
    const m = txt.match(/sourceUrl:\s*"?([^"\n]+)"?/);
    if (m) urls.add(m[1].trim());
  }
  return urls;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function writeArticle({ slug, title, summary, tags, body, image, sourceUrl, sourceName }) {
  const esc = (s) => (s || '').replace(/"/g, '\\"');
  const tagYaml = (tags || []).map((t) => `"${String(t).replace(/"/g, '')}"`).join(', ');
  const frontmatter = `---
lang: en
title: "${esc(title)}"
summary: "${esc(summary)}"
date: ${todayIso()}
tags: [${tagYaml}]
featuredImage: "${image}"
sourceUrl: "${sourceUrl}"
sourceName: "${sourceName}"
---

${body.trim()}
`;
  const filePath = path.join(INSIGHTS_DIR, `${slug}.md`);
  fs.writeFileSync(filePath, frontmatter);
  return filePath;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  requireEnv();
  log('=== CSCB → CanFlow sync started ===');
  log(`lookback=${LOOKBACK_DAYS}d, max_articles=${MAX_ARTICLES_PER_RUN}, dry_run=${DRY_RUN}`);

  const oauth2 = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  const state = loadState();
  const seenIds = new Set(state.processedGmailIds || []);
  const seenUrls = new Set([...(state.processedUrls || []), ...getExistingSourceUrls()]);

  const messages = await listCscbMessages(gmail);
  log(`Found ${messages.length} CSCB messages in last ${LOOKBACK_DAYS} days`);

  const generated = [];
  let articlesBudget = MAX_ARTICLES_PER_RUN;

  for (const m of messages) {
    if (articlesBudget <= 0) break;
    if (seenIds.has(m.id)) continue;

    let full;
    try {
      full = await fetchMessageBody(gmail, m.id);
    } catch (e) {
      log(`WARN: fetch ${m.id}: ${e.message}`);
      continue;
    }

    const headers = full.payload?.headers || [];
    const subject = getHeader(headers, 'Subject') || '(no subject)';
    const { html, text } = extractHtmlAndText(full.payload);
    if (!text && !html) {
      log(`SKIP: ${m.id} "${subject}" — no body`);
      seenIds.add(m.id);
      continue;
    }

    const articles = extractArticlesFromText(text);
    log(`MSG "${subject}" (${m.id}) — ${articles.length} articles found`);

    for (const art of articles) {
      if (articlesBudget <= 0) break;
      if (seenUrls.has(art.url)) continue;

      log(`  → ${art.title.slice(0, 80)}`);
      log(`    ${art.url}`);
      log(`    summary: ${art.summary.length} chars`);

      let rewritten;
      try {
        rewritten = await rewriteWithClaude(art);
      } catch (e) {
        log(`    claude failed: ${e.message}`);
        continue;
      }

      const baseSlug = slugify(rewritten.title);
      if (!baseSlug) {
        log(`    skip: empty slug`);
        continue;
      }
      let slug = baseSlug;
      let i = 2;
      while (fs.existsSync(path.join(INSIGHTS_DIR, `${slug}.md`))) {
        slug = `${baseSlug}-${i++}`;
      }

      const image = pickImage(rewritten.imageCategory || 'customs');

      if (DRY_RUN) {
        log(`    [DRY] would write ${slug}.md`);
      } else {
        const filePath = writeArticle({
          slug,
          title: rewritten.title,
          summary: rewritten.summary,
          tags: rewritten.tags || [],
          body: rewritten.body,
          image,
          sourceUrl: art.url,
          sourceName: 'CSCB',
        });
        log(`    ✓ wrote ${path.basename(filePath)}`);
      }

      generated.push(slug);
      seenUrls.add(art.url);
      articlesBudget--;
    }

    seenIds.add(m.id);
  }

  if (!DRY_RUN) {
    state.processedGmailIds = Array.from(seenIds).slice(-500);
    state.processedUrls = Array.from(seenUrls).slice(-2000);
    saveState(state);
  }

  log(`Generated ${generated.length} articles`);

  if (generated.length === 0 || DRY_RUN || SKIP_DEPLOY) {
    log('Skipping build/deploy');
    return;
  }

  log('Building canflow-global...');
  try {
    execSync('npm run build', { cwd: CANFLOW_ROOT, stdio: 'inherit' });
    log('Deploying to Cloudflare Pages...');
    execSync(
      'wrangler pages deploy dist --project-name=canflow-global --branch=main --commit-dirty=true',
      { cwd: CANFLOW_ROOT, stdio: 'inherit' },
    );
    log('✓ Deploy complete');
  } catch (e) {
    log(`Build/deploy failed: ${e.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  log('FATAL:', err.message);
  console.error(err);
  process.exit(1);
});
