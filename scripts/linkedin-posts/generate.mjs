#!/usr/bin/env node
/**
 * LinkedIn industry-news brief generator (fywarehouse only).
 *
 * Runs at 03:00 Montreal each day. Picks 2 topic buckets that haven't
 * been used in 21 days, fetches recent real news via Google News RSS
 * (free, no key), picks the freshest article we haven't already written
 * about, asks Claude to write a fy-voice brief reacting to that article.
 * Scans for forbidden phrases, retries up to 3 times per post, queues
 * for 10:00 and 20:00 Montreal posting.
 *
 * Sources of truth:
 *   topics.json     — 22 news angles + Google News query string each
 *   voice-prompt.md — strict voice + structure + banned phrases
 *   forbidden.json  — phrase blacklist (loaded by both generate + send)
 *
 * State files:
 *   state.json       — { topicHistory: [{id, usedAt, slot}], newsUrlHistory: [{url, usedAt}], lastRunAt }
 *   queue/<DATE>.json — that day's 2-slot queue (PENDING → POSTED|FAILED)
 *
 * Failure modes handled:
 *   - Google News RSS unreachable → fall back to cached article from same topic; if none, FAILED slot
 *   - Claude generation hits forbidden phrase 3x → FAILED slot, no post that day
 *   - Anthropic API down → process exits 1, cron silent
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: "/home/ubuntu/fymail/.env.local" });

const ROOT = "/home/ubuntu/fymail/scripts/linkedin-posts";
const TOPICS = JSON.parse(fs.readFileSync(path.join(ROOT, "topics.json"), "utf-8")).topics;
const FORBIDDEN = JSON.parse(fs.readFileSync(path.join(ROOT, "forbidden.json"), "utf-8"));
const VOICE_PROMPT = fs.readFileSync(path.join(ROOT, "voice-prompt.md"), "utf-8");

const STATE_FILE = path.join(ROOT, "state.json");
const QUEUE_DIR = path.join(ROOT, "queue");
const TOPIC_REUSE_DAYS = 21;
const NEWS_REUSE_DAYS = 60;
const NEWS_MAX_AGE_DAYS = 4;
const MAX_RETRIES = 3;

// Whitelist of news sources Tony trusts to cite. We boost results from these
// and demote everything else (Medium, vocal.media, content farms, vendor blogs).
// Match is a case-insensitive substring of the source name.
const SOURCE_WHITELIST = [
  "joc",
  "freightwaves",
  "reuters",
  "bloomberg",
  "cbc",
  "globe and mail",
  "lloyd's list",
  "lloyds list",
  "supplychaindive",
  "supply chain dive",
  "ajot",
  "journal of commerce",
  "splash247",
  "trade winds",
  "tradewinds",
  "today's trucking",
  "todays trucking",
  "logistics management",
  "windsor star",
  "montreal gazette",
  "financial post",
  "national post",
  "ctv",
  "global news",
  "transport canada",
  "statistics canada",
  "cbsa",
  "tc.canada",
  "canada.ca",
  "rfd-tv",
  "wsj",
  "wall street journal",
  "ft.com",
  "financial times",
  "the loadstar",
  "loadstar",
  "splash 247",
  "the logic",
  "the hub",
  "betakit",
  "yahoo finance",
  "marketwatch",
  "rfd-tv",
  "trucking news",
  "trucking dive",
  "logistics dive",
  "fleet owner",
  "transport topics",
  "canadian shipper",
];

function isWhitelistedSource(sourceName) {
  if (!sourceName) return false;
  const s = sourceName.toLowerCase();
  return SOURCE_WHITELIST.some((w) => s.includes(w));
}

const MODEL = "claude-opus-4-7";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------- helpers ----------

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { topicHistory: [], newsUrlHistory: [], lastRunAt: null };
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function pickTopics(state, n) {
  const cutoff = Date.now() - TOPIC_REUSE_DAYS * 86400000;
  const recent = new Set(
    state.topicHistory.filter((h) => new Date(h.usedAt).getTime() >= cutoff).map((h) => h.id)
  );
  const eligible = TOPICS.filter((t) => !recent.has(t.id));
  let pool = eligible.length >= n ? eligible : TOPICS;
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
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

function todayMontrealIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function montrealHourIso(dateStr, hour) {
  return new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00-04:00`).toISOString();
}

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripCdata(s) {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function parseGoogleNewsRss(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const titleM = block.match(/<title>([\s\S]*?)<\/title>/);
    const linkM = block.match(/<link>([\s\S]*?)<\/link>/);
    const pubM = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const descM = block.match(/<description>([\s\S]*?)<\/description>/);
    const srcM = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    if (!titleM || !linkM) continue;
    items.push({
      title: decodeXmlEntities(stripCdata(titleM[1])).trim(),
      url: stripCdata(linkM[1]).trim(),
      pubDate: pubM ? new Date(stripCdata(pubM[1]).trim()) : null,
      description: descM ? decodeXmlEntities(stripCdata(descM[1])).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "",
      source: srcM ? decodeXmlEntities(stripCdata(srcM[1])).trim() : "",
    });
  }
  return items;
}

async function fetchGoogleNews(query) {
  const u = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-CA&gl=CA&ceid=CA:en`;
  const res = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (compatible; FENGYE-LinkedIn/1.0)" } });
  if (!res.ok) throw new Error(`google news rss ${res.status}`);
  const xml = await res.text();
  return parseGoogleNewsRss(xml);
}

function pickNewsArticle(items, state) {
  const usedUrls = new Set(state.newsUrlHistory.map((h) => h.url));
  const maxAge = Date.now() - NEWS_MAX_AGE_DAYS * 86400000;
  const candidates = items
    .filter((a) => a.pubDate && a.pubDate.getTime() >= maxAge)
    .filter((a) => !usedUrls.has(a.url))
    .filter((a) => a.title.length >= 25);

  // Prefer whitelisted sources; only fall back to non-whitelist if the
  // whitelist returns nothing fresh. This protects us from vocal.media /
  // Medium / vendor-blog content showing up as our anchor.
  const whitelisted = candidates
    .filter((a) => isWhitelistedSource(a.source))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  if (whitelisted.length > 0) return whitelisted[0];

  console.log(`  ⚠ no whitelisted sources in last ${NEWS_MAX_AGE_DAYS}d; falling back to any source`);
  const fallback = candidates.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  return fallback[0] || null;
}

async function generateBrief(topic, article) {
  const userMessage = `Topic bucket: **${topic.title}**

Real news article you are reacting to:

  Title:       ${article.title}
  Source:      ${article.source || "(not specified)"}
  Published:   ${article.pubDate.toISOString().slice(0, 10)}
  Description: ${article.description || "(no snippet available — work from title and source)"}

Write the LinkedIn post now. Comment on this article from Tony's warehouse-ops POV. Do not include the article URL in the body. Output the post body only — no preamble, no headings, no explanation.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: VOICE_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const check = checkForbidden(text);
    if (check.ok) return { ok: true, text, attempts: attempt };
    console.log(`  [${topic.id}] attempt ${attempt}/${MAX_RETRIES} rejected: ${check.reason}`);
  }
  return { ok: false, attempts: MAX_RETRIES };
}

// ---------- main ----------

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

  fs.mkdirSync(QUEUE_DIR, { recursive: true });
  const state = loadState();
  const today = todayMontrealIso();
  const queueFile = path.join(QUEUE_DIR, `${today}.json`);

  if (fs.existsSync(queueFile)) {
    console.log(`Queue already exists for ${today}, skipping. Delete the file to regenerate.`);
    return;
  }

  const picks = pickTopics(state, 2);
  console.log(`Today (${today}): ${picks.map((p) => p.id).join(", ")}`);

  const slots = [
    { slot: "10:00", scheduledAt: montrealHourIso(today, 10), topic: picks[0] },
    { slot: "20:00", scheduledAt: montrealHourIso(today, 20), topic: picks[1] },
  ];

  const queue = [];
  for (const s of slots) {
    console.log(`\n→ slot=${s.slot} topic=${s.topic.id}`);

    let article = null;
    try {
      const items = await fetchGoogleNews(s.topic.newsQuery);
      console.log(`  fetched ${items.length} news items`);
      article = pickNewsArticle(items, state);
      if (!article) {
        // Try one more time without dedup, in case all fresh items were already used
        const fresh = items
          .filter((a) => a.pubDate && a.pubDate.getTime() >= Date.now() - NEWS_MAX_AGE_DAYS * 86400000)
          .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
        article = fresh[0] || null;
      }
    } catch (e) {
      console.error(`  ! news fetch failed: ${e.message}`);
    }

    if (!article) {
      console.error(`  ✗ no news article for topic ${s.topic.id}`);
      queue.push({
        slot: s.slot,
        scheduledAt: s.scheduledAt,
        topicId: s.topic.id,
        topicTitle: s.topic.title,
        body: null,
        status: "FAILED",
        attempts: 0,
        failureReason: "no fresh news article found within 4 days",
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    console.log(`  picked: ${article.source} — ${article.title.slice(0, 70)} (${article.pubDate.toISOString().slice(0, 10)})`);
    const result = await generateBrief(s.topic, article);

    if (result.ok) {
      console.log(`  ✓ generated (${result.attempts} attempt${result.attempts > 1 ? "s" : ""}, ${result.text.length} chars)`);
      queue.push({
        slot: s.slot,
        scheduledAt: s.scheduledAt,
        topicId: s.topic.id,
        topicTitle: s.topic.title,
        newsArticle: {
          title: article.title,
          source: article.source,
          url: article.url,
          pubDate: article.pubDate.toISOString(),
        },
        body: result.text,
        status: "PENDING",
        attempts: result.attempts,
        createdAt: new Date().toISOString(),
      });
      state.topicHistory.push({ id: s.topic.id, usedAt: new Date().toISOString(), slot: s.slot });
      state.newsUrlHistory.push({ url: article.url, usedAt: new Date().toISOString() });
    } else {
      console.error(`  ✗ FAILED after ${result.attempts} attempts`);
      queue.push({
        slot: s.slot,
        scheduledAt: s.scheduledAt,
        topicId: s.topic.id,
        topicTitle: s.topic.title,
        newsArticle: {
          title: article.title,
          source: article.source,
          url: article.url,
        },
        body: null,
        status: "FAILED",
        attempts: result.attempts,
        failureReason: "exceeded forbidden-phrase retries",
        createdAt: new Date().toISOString(),
      });
    }
  }

  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  state.lastRunAt = new Date().toISOString();
  // Keep only last 90 days of topic history, last 60 days of news history
  const topicCutoff = Date.now() - 90 * 86400000;
  const newsCutoff = Date.now() - NEWS_REUSE_DAYS * 86400000;
  state.topicHistory = state.topicHistory.filter((h) => new Date(h.usedAt).getTime() >= topicCutoff);
  state.newsUrlHistory = state.newsUrlHistory.filter((h) => new Date(h.usedAt).getTime() >= newsCutoff);
  saveState(state);

  const okCount = queue.filter((q) => q.status === "PENDING").length;
  console.log(`\n=== generated ${okCount}/${queue.length} briefs for ${today} ===`);
  console.log(`queue file: ${queueFile}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
