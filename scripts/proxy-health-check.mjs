#!/usr/bin/env node
/**
 * Proxy health check → auto-replace bad IPs → refresh .env.local → notify Telegram.
 *
 * Cron: 0 7 * * *   (Montreal 07:00，在 6AM daily-health-check 之后，所有爬虫 cron 完成后)
 * Log:  /home/ubuntu/fymail/logs/proxy-health-check.log
 *
 * 流程:
 *   1. 读 proxy-stats.jsonl (playwright-fetcher 每次 fetch 打一行)
 *   2. 聚合过去 24h 每个 proxy 的 success/fail
 *   3. 识别"疑似被封"(成功率 <50% 且 total >= 10)
 *   4. 调 Webshare API replace
 *   5. 拉新 proxy list 写回 .env.local
 *   6. Kill enrich-worker + chromium 让新 proxy 生效 (worker 会被外部重启/下次 cron 自动拉起)
 *   7. Telegram 汇报
 */

import fs from "node:fs";
import { execSync } from "node:child_process";

// ───────────── env ─────────────
for (const p of ["/home/ubuntu/fymail/.env.local"]) {
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const TOKEN = process.env.WEBSHARE_API_TOKEN;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
if (!TOKEN) { console.error("WEBSHARE_API_TOKEN missing"); process.exit(1); }

const STATS_PATH = "/home/ubuntu/fymail/logs/proxy-stats.jsonl";
const ENV_PATH = "/home/ubuntu/fymail/.env.local";
const WINDOW_HOURS = 24;
const MIN_SAMPLES = 10;        // 至少 10 次 fetch 才判定（避免偶发误杀）
const UNHEALTHY_RATE = 0.5;    // 成功率 <50% 判为不健康
const RESERVE_QUOTA = 5;       // 每月保留 5 次 replace 额度给紧急情况

// ───────────── helpers ─────────────
async function webshareApi(path, init = {}) {
  const res = await fetch(`https://proxy.webshare.io/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`webshare ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) {
    console.log("(Telegram 未配置，跳过通知)");
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    console.error(`Telegram 发送失败: ${e.message}`);
  }
}

// ───────────── 1. 聚合 stats ─────────────
function aggregateStats() {
  if (!fs.existsSync(STATS_PATH)) return new Map();
  const cutoff = Date.now() - WINDOW_HOURS * 3600 * 1000;
  const byProxy = new Map();
  const content = fs.readFileSync(STATS_PATH, "utf-8");
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const t = new Date(rec.at).getTime();
    if (!t || t < cutoff) continue;
    const key = rec.proxy;
    if (!byProxy.has(key)) byProxy.set(key, { ok: 0, fail: 0 });
    byProxy.get(key)[rec.outcome === "ok" ? "ok" : "fail"]++;
  }
  return byProxy;
}

function identifyUnhealthy(stats) {
  const out = [];
  for (const [proxy, s] of stats) {
    const total = s.ok + s.fail;
    if (total < MIN_SAMPLES) continue;
    const rate = s.ok / total;
    if (rate < UNHEALTHY_RATE) {
      out.push({ proxy, ok: s.ok, fail: s.fail, total, rate });
    }
  }
  // 最烂的排前面
  out.sort((a, b) => a.rate - b.rate);
  return out;
}

// ───────────── 2. Webshare API ─────────────
async function listProxies() {
  const all = [];
  let page = 1;
  while (true) {
    const r = await webshareApi(`/proxy/list/?mode=direct&page=${page}&page_size=100`);
    all.push(...(r.results || []));
    if (!r.next) break;
    page++;
  }
  return all;
}

async function getPlan() {
  const r = await webshareApi("/subscription/plan/");
  const active = (r.results || []).find((p) => p.status === "active");
  return active;
}

async function replaceProxyId(proxyId) {
  // Webshare v2: POST /proxy/list/replace/ with id
  return await webshareApi("/proxy/list/replace/", {
    method: "POST",
    body: JSON.stringify({ id: proxyId }),
  });
}

function toProxyLine(p) {
  return `${p.proxy_address}:${p.port}:${p.username}:${p.password}`;
}

// ───────────── 3. env.local rewrite ─────────────
function rewriteEnvProxies(list) {
  const newLine = `WEBSHARE_PROXIES="${list.map(toProxyLine).join(",")}"`;
  const content = fs.readFileSync(ENV_PATH, "utf-8");
  const updated = content.replace(/^WEBSHARE_PROXIES=.*/m, newLine);
  if (updated === content) {
    console.log("  ⚠ .env.local 里没找到 WEBSHARE_PROXIES= 行，跳过写入");
    return false;
  }
  // 备份后写入
  fs.copyFileSync(ENV_PATH, `${ENV_PATH}.bak-proxy-${Date.now()}`);
  fs.writeFileSync(ENV_PATH, updated, { mode: 0o600 });
  return true;
}

function restartWorker() {
  try {
    execSync(`pkill -9 -f "scripts/canflow-sources/enrich-worker\\.mjs" 2>/dev/null; true`);
    execSync(`pkill -9 -f "chrome-headless-shell" 2>/dev/null; true`);
    execSync(`rm -rf /tmp/playwright_chromiumdev_profile-* 2>/dev/null; true`);
    // 让 worker 自己被重启的责任交给外部 cron 或手动
    // （当前没有 watchdog 自动拉起 enrich-worker，但 worker 已经被 kill，下次需要时手动起）
    console.log("  ✓ enrich-worker + chromium 清理完毕（不自动重启，等外部触发）");
  } catch (e) {
    console.log(`  ⚠ 清理进程出错: ${e.message}`);
  }
}

// ───────────── main ─────────────
async function main() {
  const started = Date.now();
  console.log(`[${new Date().toISOString()}] proxy-health-check start`);

  const plan = await getPlan();
  if (!plan) {
    await sendTelegram("🔌 proxy-health-check: 找不到 active Webshare plan，跳过");
    return;
  }
  const quotaAvail = plan.proxy_replacements_available ?? 0;
  const quotaTotal = plan.proxy_replacements_total ?? 0;
  console.log(`  本月 replace 额度: ${plan.proxy_replacements_used}/${quotaTotal} 已用 (剩 ${quotaAvail})`);

  const stats = aggregateStats();
  console.log(`  过去 ${WINDOW_HOURS}h 有 ${stats.size} 个 proxy 有 fetch 记录`);
  const bad = identifyUnhealthy(stats);
  console.log(`  疑似被封: ${bad.length} 个`);

  if (bad.length === 0) {
    console.log("  全部健康，静默");
    return;
  }

  // 决定能换几个
  const spendable = Math.max(0, quotaAvail - RESERVE_QUOTA);
  const toReplace = bad.slice(0, Math.min(bad.length, spendable));
  const skipped = bad.length - toReplace.length;

  // 映射 proxy address → Webshare proxy id
  const all = await listProxies();
  const addrToId = new Map();
  for (const p of all) {
    addrToId.set(`${p.proxy_address}:${p.port}`, p.id);
  }

  const replaceSummary = [];
  for (const b of toReplace) {
    const id = addrToId.get(b.proxy);
    if (!id) {
      replaceSummary.push(`${b.proxy} rate=${(b.rate*100).toFixed(0)}% — ❌ 找不到 proxy id，跳过`);
      continue;
    }
    try {
      await replaceProxyId(id);
      replaceSummary.push(`${b.proxy} rate=${(b.rate*100).toFixed(0)}% (${b.ok}/${b.total}) → ✓ 已替换`);
    } catch (e) {
      replaceSummary.push(`${b.proxy} rate=${(b.rate*100).toFixed(0)}% — ❌ ${e.message.slice(0, 80)}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // 拉新 list 写 env
  const newList = await listProxies();
  const validList = newList.filter((p) => p.valid);
  const wrote = rewriteEnvProxies(validList);
  if (wrote) restartWorker();

  // 构建 Telegram 通知
  const lines = [];
  lines.push(`🔌 Webshare proxy auto-rotation ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`疑似被封: ${bad.length}，自动替换: ${toReplace.length}，跳过（额度不足）: ${skipped}`);
  lines.push("");
  for (const s of replaceSummary) lines.push(`  ${s}`);
  lines.push("");
  const newPlan = await getPlan();
  lines.push(`本月 replace: ${newPlan.proxy_replacements_used}/${newPlan.proxy_replacements_total} 已用 (剩 ${newPlan.proxy_replacements_available})`);
  if ((newPlan.proxy_replacements_available ?? 0) <= RESERVE_QUOTA) {
    lines.push(`⚠️ 额度只剩 ${newPlan.proxy_replacements_available}，接近保留线 ${RESERVE_QUOTA}，后续被封可能无法自动替换`);
  }
  lines.push(`.env.local ${wrote ? "已刷新" : "未变"}，enrich-worker 已清理`);
  const elapsed = Math.round((Date.now() - started) / 1000);
  lines.push(`耗时 ${elapsed}s`);

  await sendTelegram(lines.join("\n"));
  console.log("  ✓ 完成");
}

main().catch(async (e) => {
  console.error("FATAL:", e.message || e);
  await sendTelegram(`⚠️ proxy-health-check 失败: ${(e.message || "").slice(0, 200)}`);
  process.exit(1);
});
