#!/usr/bin/env node
/**
 * Daily market briefing → Telegram (@FYwarehouse_bot)
 *
 * 每天 10:30 Montreal 跑，取代 OpenClaw 原有的"全球市场简报" cron。
 *
 * Pipeline:
 *   1. 拉 7 个 Google News RSS query（覆盖海运 / 清关 / 汇率 / 大宗 / 关税 / 物流 / 加拿大进口）
 *   2. 每个 query 取最近 48h 的 top 3 headlines
 *   3. 把 headlines 喂给 Claude (claude-opus-4-7)，按 FENGYE 业务视角生成简报
 *   4. 发到 @FYwarehouse_bot (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
 *
 * Cron: 30 10 * * * /usr/bin/node /home/ubuntu/fymail/scripts/market-briefing.mjs >> /home/ubuntu/fymail/logs/market-briefing.log 2>&1
 */

import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// ───────────── env ─────────────
for (const p of ["/home/ubuntu/fymail/.env.local"]) {
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY missing"); process.exit(1); }
if (!TOKEN || !CHAT_ID) { console.error("TELEGRAM_BOT_TOKEN/CHAT_ID missing"); process.exit(1); }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const MODEL = "claude-opus-4-7";
const MAX_AGE_HOURS = 48;

// ───────────── topics (与 OpenClaw prompt 覆盖一致) ─────────────
const TOPICS = [
  { label: "海运 / 集装箱",    query: "ocean freight container shipping rates" },
  { label: "港口 / 北美物流", query: "Port of Montreal Canada logistics" },
  { label: "加拿大清关 / 关税", query: "CBSA Canada customs tariff import" },
  { label: "美中贸易",         query: "US China trade tariff container" },
  { label: "汇率",              query: "USD CAD exchange rate Canadian dollar" },
  { label: "大宗 / 油价",        query: "crude oil WTI price commodity" },
  { label: "全球经济 / 贸易",    query: "global trade economy shipping April 2026" },
];

// ───────────── Google News RSS ─────────────
function stripCdata(s) { return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, ""); }
function decodeXmlEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

function parseGoogleNewsRss(xml) {
  const items = [];
  const itemBlocks = xml.split("<item>").slice(1);
  for (const block of itemBlocks) {
    const raw = block.split("</item>")[0];
    const titleM = raw.match(/<title>([\s\S]*?)<\/title>/);
    const pubM = raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const descM = raw.match(/<description>([\s\S]*?)<\/description>/);
    const srcM = raw.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    if (!titleM) continue;
    items.push({
      title: decodeXmlEntities(stripCdata(titleM[1]).trim()),
      pubDate: pubM ? new Date(stripCdata(pubM[1]).trim()) : null,
      description: descM
        ? decodeXmlEntities(stripCdata(descM[1])).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : "",
      source: srcM ? decodeXmlEntities(stripCdata(srcM[1])).trim() : "",
    });
  }
  return items;
}

async function fetchGoogleNews(query) {
  const u = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-CA&gl=CA&ceid=CA:en`;
  try {
    const res = await fetch(u, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; FENGYE-Briefing/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`rss ${res.status}`);
    return parseGoogleNewsRss(await res.text());
  } catch (e) {
    console.error(`  ! ${query}: ${e.message}`);
    return [];
  }
}

function pickFresh(items, limit = 3) {
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
  return items
    .filter((a) => a.pubDate && a.pubDate.getTime() >= cutoff)
    .filter((a) => a.title.length >= 20)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, limit);
}

// ───────────── gather news ─────────────
async function gatherHeadlines() {
  const results = await Promise.all(
    TOPICS.map(async (t) => ({
      label: t.label,
      items: pickFresh(await fetchGoogleNews(t.query), 3),
    })),
  );
  return results.filter((r) => r.items.length > 0);
}

function formatHeadlinesForClaude(groups) {
  return groups.map((g) => {
    const lines = g.items.map((i) => {
      const date = i.pubDate.toISOString().slice(0, 10);
      return `  - [${i.source || "?"} ${date}] ${i.title}${i.description ? " — " + i.description.slice(0, 180) : ""}`;
    });
    return `### ${g.label}\n${lines.join("\n")}`;
  }).join("\n\n");
}

// ───────────── Claude 生成 ─────────────
const SYSTEM_PROMPT = `你是 FENGYE LOGISTICS 的市场观察助手。

FENGYE 业务：
- 加拿大 Montreal 持牌 CBSA sufferance/bonded 保税仓
- 主推欧洲货代客户（荷德法）通过 CETA 进加拿大
- canflow 品牌做加拿大清关（ACI eManifest / CBSA bonded）
- 服务：drayage、保税 hold、拼箱/LCL、CARM 注册代理、last-mile

写每日全球市场简报。格式：
1. 按对 FENGYE 业务影响重要性排序 5-7 条（不是新闻有多大就排多高，而是对我们业务多相关）
2. 每条 2-3 句白话，点出事件 + 对加拿大进口/海运/清关/北美仓储的潜在关联
3. 最后单独一段「对我业务的影响」3-5 条具体动作建议（报价调整/outreach 切入点/运营准备）
4. 全部中文
5. 大白话从业者口吻，禁咨询顾问腔（不要"战略性"/"赋能"/"精准把握"这种）
6. 禁 emoji 堆砌（可以段落前用 1 个作为标记）
7. 只用给你的头条数据，不要瞎编数字
8. 长度控制在 2500 字符以内（Telegram 单条限制）

输出纯文本，不要 markdown 包装。`;

async function generateBriefing(headlinesText) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `今天的全球头条（过去 48h 内）：\n\n${headlinesText}\n\n现在生成今日全球市场简报。`,
      },
    ],
  });
  return resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

// ───────────── Telegram ─────────────
async function sendTelegram(text) {
  const today = new Date().toISOString().slice(0, 10);
  const message = `📊 全球市场简报 ${today}\n\n${text}`;
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: message }),
    signal: AbortSignal.timeout(15000),
  });
  const r = await res.json();
  if (!r.ok) throw new Error(`telegram: ${JSON.stringify(r)}`);
  return r.result.message_id;
}

// ───────────── main ─────────────
async function main() {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] gather headlines...`);
  const groups = await gatherHeadlines();
  const totalHeadlines = groups.reduce((s, g) => s + g.items.length, 0);
  console.log(`  gathered ${totalHeadlines} headlines across ${groups.length} topics`);
  if (totalHeadlines < 5) {
    console.log(`  ! too few headlines (${totalHeadlines}) — sending fallback notice`);
    await sendTelegram(`⚠️ 今天 Google News 源只抓到 ${totalHeadlines} 条头条，信号不够，简报跳过。`);
    return;
  }

  const headlinesText = formatHeadlinesForClaude(groups);
  console.log(`  calling Claude (${MODEL})...`);
  const briefing = await generateBriefing(headlinesText);
  console.log(`  got ${briefing.length} chars`);

  // Telegram hard cap 4096，给 emoji header 留点 buffer
  const clipped = briefing.length > 3500 ? briefing.slice(0, 3500) + "\n\n…（截断）" : briefing;
  const msgId = await sendTelegram(clipped);
  console.log(`  sent → message_id=${msgId}`);
  console.log(`[done] ${Math.round((Date.now() - start) / 1000)}s`);
}

main().catch(async (e) => {
  console.error("FATAL:", e.message || e);
  // 失败也发一条到 Telegram，不要静默挂掉
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `⚠️ 今日市场简报生成失败：${(e.message || "").slice(0, 200)}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    /* fire-and-forget，失败也 exit */
  }
  process.exit(1);
});
