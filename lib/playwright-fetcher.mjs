/**
 * Smart HTML fetcher: plain fetch first, Playwright fallback on JS-heavy
 * empty shells. Shared by canflow enrich-worker.mjs and the deep-search
 * crawler. Single browser singleton, launched lazily, context-per-call.
 *
 * L3 Gap: optional residential/datacenter proxy pool via Webshare or
 * similar. Parsed from `WEBSHARE_PROXIES` env var (comma-separated
 * host:port:user:pass tuples). Assignment is per-apex so the same site
 * always gets the same proxy — consistent fingerprint + avoids tripping
 * anomaly detection.
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { fetch as undiciFetch, ProxyAgent } from "undici";

// L3 — proxy pool
function parseProxies(raw) {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((line) => {
    const [host, port, user, pass] = line.split(":");
    if (!host || !port) return null;
    return { host, port: Number(port), user: user || null, pass: pass || null };
  }).filter(Boolean);
}
// Lazy init — dotenv may load .env.local *after* this module is imported
// (e.g. in enrich-worker.mjs dotenv.config happens below the import line),
// so reading process.env at module top is too early. Compute on first use.
let _proxiesCache = null;
function getProxies() {
  if (_proxiesCache !== null) return _proxiesCache;
  _proxiesCache = parseProxies(process.env.WEBSHARE_PROXIES || "");
  return _proxiesCache;
}

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  return browserPromise;
}

// L4 Gap: per-domain session + fingerprint pool. Each apex domain gets a
// pinned UA + locale combination and a persistent BrowserContext so cookies
// stick across calls, mimicking a returning browser.
const UA_POOL = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-US",
    acceptLanguage: "en-US,en;q=0.9",
    viewport: { width: 1280, height: 800 },
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-US",
    acceptLanguage: "en-US,en;q=0.9,de;q=0.7",
    viewport: { width: 1440, height: 900 },
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    locale: "en-US",
    acceptLanguage: "en-US,en;q=0.9,zh;q=0.6",
    viewport: { width: 1366, height: 768 },
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
    locale: "en-US",
    acceptLanguage: "en-US,en;q=0.9,fr;q=0.6",
    viewport: { width: 1920, height: 1080 },
  },
];

// Deterministic fingerprint per apex — the same site always gets the same
// UA/locale/viewport combo, so the site sees a consistent "browser".
function apexKey(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const parts = host.split(".");
    return parts.length >= 2 ? parts.slice(-2).join(".") : host;
  } catch {
    return "default";
  }
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function fingerprintFor(apex) {
  return UA_POOL[hashStr(apex) % UA_POOL.length];
}

// Per-apex BrowserContext cache — cookies persist across calls to the
// same site. Contexts are lazily created and cleaned up at shutdown.
const contextCache = new Map(); // apex → BrowserContext

async function getContextForApex(apex) {
  if (contextCache.has(apex)) return contextCache.get(apex);
  const browser = await getBrowser();
  const fp = fingerprintFor(apex);
  const proxy = proxyForApex(apex);
  const opts = {
    userAgent: fp.ua,
    viewport: fp.viewport,
    locale: fp.locale,
    extraHTTPHeaders: {
      "Accept-Language": fp.acceptLanguage,
    },
  };
  if (proxy) {
    opts.proxy = {
      server: `http://${proxy.host}:${proxy.port}`,
      username: proxy.user || undefined,
      password: proxy.pass || undefined,
    };
  }
  const ctx = await browser.newContext(opts);
  contextCache.set(apex, ctx);
  return ctx;
}

// Fallback UA for plain fetch — rotated per-apex via the same pool so
// session-less fetches also look consistent to a given host.
function uaForApex(apex) {
  return fingerprintFor(apex).ua;
}
function acceptLanguageForApex(apex) {
  return fingerprintFor(apex).acceptLanguage;
}

// Per-apex proxy assignment — stable so the same site always routes
// through the same IP, making our traffic pattern look like a normal
// returning visitor rather than a rotating scraper.
function proxyForApex(apex) {
  const proxies = getProxies();
  if (proxies.length === 0) return null;
  return proxies[hashStr("proxy:" + apex) % proxies.length];
}

// Cache ProxyAgents — one per proxy endpoint. Creating these is cheap
// but reusing keeps the TCP pool warm.
const proxyAgentCache = new Map();
function getProxyAgent(p) {
  const key = `${p.host}:${p.port}`;
  if (!proxyAgentCache.has(key)) {
    const auth = p.user && p.pass ? `${p.user}:${p.pass}@` : "";
    const url = `http://${auth}${p.host}:${p.port}`;
    proxyAgentCache.set(
      key,
      new ProxyAgent({ uri: url, connectTimeout: 10000, keepAliveTimeout: 30000 }),
    );
  }
  return proxyAgentCache.get(key);
}

async function renderWithPlaywright(url, timeoutMs) {
  const apex = apexKey(url);
  let page = null;
  try {
    const context = await getContextForApex(apex);
    page = await context.newPage();
    // Block heavy assets to save bandwidth/CPU — we only want DOM text.
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font", "stylesheet"].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(url, { timeout: timeoutMs, waitUntil: "domcontentloaded" });
    // Short settle for client-rendered content.
    await page.waitForTimeout(800);
    const html = await page.content();
    return html;
  } catch {
    return null;
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
}

const SPA_MARKERS = [
  /<div[^>]*\sid=["']root["'][^>]*>\s*<\/div>/i,
  /<div[^>]*\sid=["']app["'][^>]*>\s*<\/div>/i,
  /<div[^>]*\sid=["']__next["'][^>]*>\s*<\/div>/i,
  /you need to enable javascript/i,
  /please enable javascript/i,
  /please turn on javascript/i,
];

function looksLikeEmptyShell(html) {
  if (!html) return true;
  // Clear SPA markers — unambiguous JS-required shell.
  for (const re of SPA_MARKERS) if (re.test(html)) return true;
  // Visible text after stripping scripts/styles.
  const textLen = html.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
  // Truly empty: <100 chars of text = definitely JS shell.
  if (textLen < 100) return true;
  return false;
}

// ─────────────── proxy stats (per-fetch outcome log) ───────────────
// 每次 fetch 打一行 JSONL 到 proxy-stats.jsonl，供 daily proxy-health-check
// 聚合 → 识别被封 IP → 自动 replace。直连不记（proxy=null）。
const PROXY_STATS_PATH = "/home/ubuntu/fymail/logs/proxy-stats.jsonl";
function logProxyStats(proxy, apex, outcome, extra = {}) {
  if (!proxy) return;
  try {
    fs.appendFileSync(
      PROXY_STATS_PATH,
      JSON.stringify({
        at: new Date().toISOString(),
        proxy: `${proxy.host}:${proxy.port}`,
        apex,
        outcome, // "ok" | "fail"
        ...extra,
      }) + "\n",
    );
  } catch {
    // 写 stats 失败不影响主流程
  }
}

/**
 * Fetch a page HTML. Tries plain fetch first; if the result looks like a
 * JS-heavy empty shell, falls back to Playwright rendering.
 * Returns HTML string or null.
 */
export async function smartFetchPage(url, { timeoutMs = 12000 } = {}) {
  const apex = apexKey(url);
  const proxy = proxyForApex(apex);
  let fetchStatus = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const init = {
      headers: {
        "User-Agent": uaForApex(apex),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": acceptLanguageForApex(apex),
      },
      signal: controller.signal,
      redirect: "follow",
    };
    if (proxy) init.dispatcher = getProxyAgent(proxy);
    const res = await undiciFetch(url, init);
    clearTimeout(timer);
    fetchStatus = res.status;
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html") || ct.includes("application/xhtml")) {
        const html = await res.text();
        if (!looksLikeEmptyShell(html)) {
          logProxyStats(proxy, apex, "ok", { status: fetchStatus, via: "fetch" });
          return html;
        }
      }
    }
  } catch {}

  const rendered = await renderWithPlaywright(url, Math.max(timeoutMs * 2, 25000));
  if (rendered) {
    logProxyStats(proxy, apex, "ok", { status: fetchStatus, via: "playwright" });
  } else {
    logProxyStats(proxy, apex, "fail", { status: fetchStatus });
  }
  return rendered;
}

export async function shutdownBrowser() {
  // Close all per-apex contexts first, then the browser.
  for (const ctx of contextCache.values()) {
    try { await ctx.close(); } catch {}
  }
  contextCache.clear();
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {}
  browserPromise = null;
}

process.on("SIGINT", async () => { await shutdownBrowser(); process.exit(0); });
process.on("SIGTERM", async () => { await shutdownBrowser(); process.exit(0); });
