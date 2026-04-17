#!/usr/bin/env node
/**
 * Unified enrichment worker for canflow staging JSONL files.
 *
 * Reads every *.jsonl file in /home/ubuntu/fymail/data/canflow-sources/
 * (except *-state.json), finds rows where enrichedAt is null, and:
 *   1. Guesses/searches a website for the company (SearXNG self-hosted :8888)
 *   2. Fetches homepage + common contact pages via playwright-fetcher
 *      (local Chromium + Webshare proxy pool)
 *   3. Extracts an email on the same apex domain
 *   4. Writes enrichedAt, website, email back into the SAME row
 *
 * The JSONL file is rewritten atomically after every batch of writes so it
 * stays resumable.  Stop with:
 *     touch /home/ubuntu/fymail/data/canflow-sources/enrich.stop
 *
 * Per row this does 1 SearXNG search + 1-5 Chromium fetches.
 * With FETCH_DELAY_MS=600 + Chromium overhead that's ~30s/row in practice
 * (single-threaded, IO-bound). Plan multi-day runtime for 20-30k records,
 * or shard the JSONL across N parallel workers if you need to go faster.
 */
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import dotenv from "dotenv";
import { smartFetchPage, shutdownBrowser } from "../../lib/playwright-fetcher.mjs";
import { llmPickWebsite, llmExtractContact } from "../../lib/llm-extractor.mjs";

dotenv.config({ path: "/home/ubuntu/fymail/.env.local" });

const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8888";

// L2 LLM fallback — gated + budgeted to cap spend.
// LLM_FALLBACK=1 enables Haiku fallbacks; LLM_BUDGET caps total calls per
// run (default 500). Burns through ~$0.01 per 2 calls (pick + extract),
// so budget 500 ≈ $2.50 max.
const LLM_FALLBACK = process.env.LLM_FALLBACK === "1";
const LLM_BUDGET = Number(process.env.LLM_BUDGET || 500);
let llmCallsUsed = 0;
function llmBudgetLeft() { return llmCallsUsed < LLM_BUDGET; }

const SOURCES_DIR = "/home/ubuntu/fymail/data/canflow-sources";
const STOP_FILE = path.join(SOURCES_DIR, "enrich.stop");
const STATE_FILE = path.join(SOURCES_DIR, "enrich.state.json");
const FETCH_DELAY_MS = 600;
const MAX_ROWS_PER_PASS = Number(process.env.ENRICH_LIMIT || 9999999);

// ─────────────── HTTP ───────────────
// Search = SearXNG (self-hosted, 8888). Page scrape = smartFetchPage —
// plain fetch first, Playwright fallback on JS-heavy empty shells.
let lastFetchAt = 0;
async function throttle() {
  const wait = FETCH_DELAY_MS - (Date.now() - lastFetchAt);
  if (wait > 0) await sleep(wait);
  lastFetchAt = Date.now();
}

async function searxngSearch(query) {
  await throttle();
  const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`SearXNG ${res.status}`);
  const data = await res.json();
  return (data.results || [])
    .filter((r) => r.url)
    .map((r) => ({ url: r.url, title: r.title || "", content: r.content || "" }));
}

async function fetchPage(url, timeoutMs = 12000) {
  await throttle();
  // Hard wall timeout — catches Playwright CDP deadlocks where the inner
  // navigation timeout never fires. Without this the worker can hang for
  // hours on a single row (observed 2026-04-17: 15h stall at idx 4912).
  //
  // setTimeout is cleared whichever branch wins so the losing timer doesn't
  // leak — previous Promise.race version leaked one timer per hard-timeout
  // (438 timers accumulated in the first few hours before fix).
  const HARD_MS = timeoutMs * 2.5;
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[enrich] hard-timeout ${HARD_MS}ms on ${url}`);
      resolve(null);
    }, HARD_MS);
  });
  try {
    return await Promise.race([
      smartFetchPage(url, { timeoutMs }),
      timeoutPromise,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─────────────── domain utilities ───────────────
const CC_TLD = {
  CN: [".com.cn", ".cn", ".com"],
  HK: [".com.hk", ".hk", ".com"],
  TW: [".com.tw", ".tw", ".com"],
  KR: [".co.kr", ".kr", ".com"],
  JP: [".co.jp", ".jp", ".com"],
  SG: [".com.sg", ".sg", ".com"],
  VN: [".com.vn", ".vn", ".com"],
  TH: [".co.th", ".com"],
  MY: [".com.my", ".my", ".com"],
  ID: [".co.id", ".com"],
  PH: [".com.ph", ".ph", ".com"],
  IN: [".co.in", ".in", ".com"],
  PK: [".com.pk", ".pk", ".com"],
  BD: [".com.bd", ".com"],
  LK: [".lk", ".com"],
  US: [".com", ".us"],
  CA: [".ca", ".com"],
  MX: [".com.mx", ".com"],
  BR: [".com.br", ".com"],
  DE: [".de", ".com"],
  FR: [".fr", ".com"],
  IT: [".it", ".com"],
  ES: [".es", ".com"],
  NL: [".nl", ".com"],
  BE: [".be", ".com"],
  CH: [".ch", ".com"],
  AT: [".at", ".com"],
  GB: [".co.uk", ".com"],
  IE: [".ie", ".com"],
  DK: [".dk", ".com"],
  SE: [".se", ".com"],
  NO: [".no", ".com"],
  FI: [".fi", ".com"],
  PL: [".pl", ".com"],
  CZ: [".cz", ".com"],
  GR: [".gr", ".com"],
  PT: [".pt", ".com"],
  TR: [".com.tr", ".com"],
  AE: [".ae", ".com"],
  AU: [".com.au", ".com"],
  NZ: [".co.nz", ".com"],
  ZA: [".co.za", ".com"],
};

function slugifyName(name) {
  if (!name) return null;
  let s = name.toLowerCase();
  // Only strip strict legal-entity suffixes — keep industry words like
  // "logistics" / "freight" / "shipping" since they're usually PART of the
  // company's actual domain (e.g. youngseacargo.com, not youngsea.com).
  const suffixes = [
    "co\\.,\\s*ltd\\.?", "co\\., ltd\\.?", "co\\., ltd", "co\\.? ltd\\.?",
    "company limited", "limited", " ltd\\.?",
    "corporation", " corp\\.?",
    "incorporated", " inc\\.?",
    "\\(pvt\\)", "private",
    "gmbh( & co\\.? kg)?", " kg", " ohg", " ag", " e\\.?k\\.?", " ug",
    "s\\.?l\\.?", "s\\.?a\\.?s?\\.?", " sarl", " sas", " srl", "s\\.?r\\.?l\\.?",
    "b\\.?v\\.?", "n\\.?v\\.?",
    " oy", " ab", " a/s", " aps", " asa",
    "sp\\.? z o\\.?o\\.?", "spz oo",
    "s\\.?r\\.?o\\.?", "s\\.?p\\.?a\\.?",
    " llc", " co\\.?",
  ];
  for (const suf of suffixes) {
    s = s.replace(new RegExp(`\\s+${suf}\\s*$`, "gi"), "");
  }
  // Also kill standalone "co." and "ltd." that appear mid-string
  s = s.replace(/\s+(co\.|ltd\.?|inc\.?|corp\.?)\s+/gi, " ");
  s = s.replace(/[&']/g, " and ");
  s = s.replace(/[^a-z0-9]+/g, "");
  if (s.length < 3) return null;
  return s;
}

function candidateDomains(name, cc) {
  const slug = slugifyName(name);
  if (!slug) return [];
  const tlds = CC_TLD[cc] || [".com"];
  const out = [];
  for (const tld of tlds) {
    out.push(`www.${slug}${tld}`);
    out.push(`${slug}${tld}`);
  }
  return out;
}

function apex(domain) {
  if (!domain) return null;
  const parts = domain.replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const twoPart = ["co.uk", "co.jp", "co.kr", "co.nz", "co.in", "co.th", "co.za", "co.id",
                   "com.cn", "com.hk", "com.tw", "com.sg", "com.my", "com.vn",
                   "com.au", "com.br", "com.mx", "com.ph", "com.pk", "com.bd", "com.tr"];
  const last2 = parts.slice(-2).join(".");
  if (twoPart.includes(last2)) return parts.slice(-3).join(".");
  return last2;
}

function domainOf(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

const DOMAIN_BLOCKLIST_PATTERNS = [
  /(^|\.)port[a-z-]*\./i,
  /(^|\.)airport[a-z-]*\./i,
  /\.gc\.ca$/i, /\.gov(\.[a-z]{2})?$/i, /\.gouv\./i, /\.mil$/i,
  /(^|\.)beian\./i, /(^|\.)infogram\./i,
  /(^|\.)alibaba\./i, /(^|\.)aliexpress\./i, /(^|\.)1688\./i,
  /(^|\.)linkedin\./i, /(^|\.)facebook\./i, /(^|\.)twitter\./i,
  /(^|\.)youtube\./i, /(^|\.)instagram\./i, /(^|\.)yyc\.com$/i, /(^|\.)yvr\.ca$/i,
  /(^|\.)wikipedia\./i, /(^|\.)google\./i, /(^|\.)baidu\./i,
  /(^|\.)europages\./i, /(^|\.)yellowpages\./i, /(^|\.)kompass\./i,
  /(^|\.)indiamart\./i, /(^|\.)made-in-china\./i, /(^|\.)globalsources\./i,
  /(^|\.)trustpilot\./i, /(^|\.)glassdoor\./i, /(^|\.)crunchbase\./i,
  /(^|\.)bloomberg\./i, /(^|\.)reuters\./i,
  /(^|\.)fmc\.gov$/i, /(^|\.)cbsa-asfc\./i,
  /(^|\.)apple\./i, /(^|\.)microsoft\./i, /(^|\.)cloudflare\./i,
];
function isBlocklisted(domain) {
  if (!domain) return true;
  return DOMAIN_BLOCKLIST_PATTERNS.some((re) => re.test(domain));
}

// ─────────────── email extraction ───────────────
const EMAIL_LOCAL_BLOCKLIST = new Set([
  "noreply", "no-reply", "do-not-reply", "donotreply",
  "postmaster", "abuse", "hostmaster", "unsubscribe",
  "privacy", "legal", "your", "name", "email", "admin-noreply", "mailer-daemon",
]);
const EMAIL_DOMAIN_BLOCKLIST = new Set([
  "example.com", "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "qq.com", "163.com", "126.com", "sina.com", "sohu.com", "foxmail.com",
  "aol.com", "icloud.com", "yandex.com", "mail.ru",
  "sentry.io", "cloudflare.com", "github.com", "wixpress.com",
  "wordpress.com", "shopify.com", "squarespace.com", "wix.com",
]);
function extractEmails(text, apexFilter) {
  if (!text) return [];
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].toLowerCase();
    if (raw.length < 6 || raw.length > 80) continue;
    const [local, dom] = raw.split("@");
    if (!local || !dom) continue;
    if (EMAIL_LOCAL_BLOCKLIST.has(local)) continue;
    if (EMAIL_DOMAIN_BLOCKLIST.has(dom)) continue;
    if (dom.includes("..")) continue;
    if (apexFilter && !dom.endsWith(apexFilter)) continue;
    found.add(raw);
  }
  return Array.from(found);
}
const PREFERRED_LOCAL = ["info", "contact", "sales", "hello", "enquiries", "enquiry",
  "imports", "import", "export", "exports", "customs", "ops", "operations",
  "office", "booking", "quote", "cs", "support"];
function pickBestEmail(emails) {
  if (!emails.length) return null;
  const scored = emails.map((e) => {
    const local = e.split("@")[0];
    let s = 0;
    if (PREFERRED_LOCAL.includes(local)) s += 10;
    if (PREFERRED_LOCAL.some((p) => local.startsWith(p))) s += 3;
    if (local.length < 20) s += 1;
    return { e, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].e;
}

// ─────────────── website discovery ───────────────
// Extracts "distinctive" tokens from a company name — removes legal
// suffixes and generic industry words so we're left with the part that
// actually identifies the company.
const GENERIC_TOKENS = new Set([
  "international", "logistics", "freight", "shipping", "transport",
  "transportation", "company", "group", "global", "worldwide", "ltd",
  "limited", "inc", "corp", "llc", "co", "gmbh", "srl", "sas", "bv",
  "nv", "oy", "ab", "kg", "sa", "sl", "spa", "sarl", "pvt", "private",
  "cargo", "express", "forwarding", "forwarders", "supply", "chain",
  "services", "service", "holdings", "trading", "exports", "imports",
  "import", "export", "agency", "agencies", "lines", "line",
]);

function nameTokens(name) {
  if (!name) return [];
  const cleaned = name
    .toLowerCase()
    .replace(/[()[\]]/g, " ")
    .replace(/[.,;:!?'"]/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const all = cleaned.split(" ").filter((t) => t.length >= 2);
  const distinctive = all.filter((t) => !GENERIC_TOKENS.has(t));
  return distinctive.length ? distinctive : all;
}

function hostContainsSlug(host, slug) {
  // Candidate rule — host's letters contain the first 6 chars of the slug.
  // Paired with pageMentionsCompany() content verification to kill
  // false positives (e.g. "carson.com" when slug="carson").
  if (!host || !slug || slug.length < 6) return false;
  const clean = host.replace(/[^a-z0-9]/g, "");
  return clean.includes(slug.slice(0, 6));
}

function titleMatchesAllTokens(title, tokens) {
  // Need at least 2 distinctive tokens — single-token title matches
  // false-fire on unrelated pages ("casia" vs "Casia Lodge").
  if (!title || tokens.length < 2) return false;
  const haystack = ` ${title.toLowerCase()} `;
  return tokens.every((t) => {
    if (/[\u4e00-\u9fff]/.test(t)) return haystack.includes(t);
    const re = new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`, "i");
    return re.test(haystack);
  });
}

// Content verification — fetch the candidate page and check that the
// company's distinctive tokens or slug root actually appear in body
// text. This is the false-positive killer.
function pageMentionsCompany(text, slug, tokens) {
  if (!text) return false;
  const body = text.toLowerCase().slice(0, 15000);
  if (slug && slug.length >= 6 && body.includes(slug.slice(0, 6))) return true;
  if (tokens.length >= 2) {
    const hits = tokens.filter((t) => {
      if (/[\u4e00-\u9fff]/.test(t)) return body.includes(t);
      const re = new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`, "i");
      return re.test(body);
    });
    if (hits.length >= Math.max(2, Math.ceil(tokens.length * 0.6))) return true;
  }
  if (tokens.length === 1 && tokens[0].length >= 5 && body.includes(tokens[0])) return true;
  return false;
}

async function discoverWebsite(name, cc, addrHint) {
  const slug = slugifyName(name);
  const tokens = nameTokens(name);

  // 1. Domain guesses — accept only if body also mentions the company.
  const candidates = candidateDomains(name, cc);
  for (const c of candidates.slice(0, 4)) {
    if (isBlocklisted(c)) continue;
    const text = await fetchPage(`https://${c}/`);
    if (pageMentionsCompany(text, slug, tokens)) {
      return `https://${c}/`;
    }
  }

  // 2. SearXNG — pull candidates via slug prefix OR all title tokens,
  //    then verify via page content. The content check is what allows
  //    us to relax the candidate rules without re-admitting garbage.
  const query = `${name} ${addrHint || cc} official website`;
  let results = [];
  try {
    results = await searxngSearch(query);
  } catch {
    return null;
  }
  const filtered = results.filter((r) => {
    const d = domainOf(r.url);
    return d && !isBlocklisted(d);
  });
  for (const r of filtered.slice(0, 10)) {
    const host = (domainOf(r.url) || "").replace(/^www\./, "");
    const slugMatch = hostContainsSlug(host, slug);
    const titleMatch = titleMatchesAllTokens(r.title, tokens);
    if (!slugMatch && !titleMatch) continue;
    // Verify — fetch the actual page, check the company is mentioned.
    const text = await fetchPage(r.url);
    if (pageMentionsCompany(text, slug, tokens)) {
      return r.url.replace(/[),.;]+$/, "");
    }
  }

  // 3. LLM fallback — ask Haiku to pick the best candidate out of the
  //    SearXNG results, then content-verify the winner. Gated behind
  //    LLM_FALLBACK env var + budget to cap spend.
  if (LLM_FALLBACK && llmBudgetLeft() && filtered.length) {
    llmCallsUsed++;
    const picked = await llmPickWebsite(filtered.slice(0, 8), { companyName: name, country: cc });
    if (picked) {
      const text = await fetchPage(picked);
      if (pageMentionsCompany(text, slug, tokens)) {
        return picked.replace(/[),.;]+$/, "");
      }
    }
  }
  return null;
}

async function scrapeEmailFromSite(website, { companyName, country } = {}) {
  const d = domainOf(website);
  if (!d || isBlocklisted(d)) return null;
  const a = apex(d);
  const origin = `https://${d}`;
  const text = await fetchPage(`${origin}/`);
  if (!text) return null;

  let emails = extractEmails(text, a);
  let pagesVisited = [text];
  if (emails.length === 0) {
    const paths = ["/contact", "/contact-us", "/contacts", "/about",
      "/about-us", "/imprint", "/impressum", "/kontakt", "/contacto",
      "/nous-contacter", "/en/contact", "/en/contact-us"];
    for (const p of paths) {
      const t = await fetchPage(`${origin}${p}`);
      if (!t) continue;
      pagesVisited.push(t);
      const found = extractEmails(t, a);
      if (found.length > 0) { emails = found; break; }
    }
  }
  const best = pickBestEmail(emails);
  if (best) return best;

  // LLM fallback — regex missed. Ask Haiku to extract from combined page text.
  if (LLM_FALLBACK && llmBudgetLeft()) {
    llmCallsUsed++;
    const combined = pagesVisited.join("\n\n").slice(0, 40000);
    const info = await llmExtractContact(combined, { apexDomain: a, companyName, country });
    if (info?.emails?.length && info.confidenceScore >= 60) {
      const llmEmails = info.emails.filter((e) => {
        if (typeof e !== "string") return false;
        const dom = e.split("@")[1];
        return dom && dom.endsWith(a);
      });
      if (llmEmails.length) return pickBestEmail(llmEmails) || llmEmails[0];
    }
  }
  return null;
}

// ─────────────── staging file I/O ───────────────
function listStagingFiles() {
  return fs.readdirSync(SOURCES_DIR)
    .filter((f) => f.endsWith(".jsonl") && !f.endsWith(".tmp.jsonl"))
    .map((f) => path.join(SOURCES_DIR, f));
}

function readJsonl(file) {
  const raw = fs.readFileSync(file, "utf8");
  return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function writeJsonlAtomic(file, rows) {
  const tmp = file + ".tmp";
  const fd = fs.openSync(tmp, "w");
  for (const r of rows) fs.writeSync(fd, JSON.stringify(r) + "\n");
  fs.closeSync(fd);
  fs.renameSync(tmp, file);
}

function shouldStop() { return fs.existsSync(STOP_FILE); }

function loadState() {
  const defaults = {
    startedAt: new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    currentFile: null,
    currentIndex: 0,
    processed: 0,
    enriched: 0,
    noWebsite: 0,
    noEmail: 0,
    errors: 0,
    llmCalls: 0,
    recentEnriched: [],
    recentErrors: [],
  };
  if (!fs.existsSync(STATE_FILE)) return defaults;
  const loaded = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  return { ...defaults, ...loaded,
    recentEnriched: Array.isArray(loaded.recentEnriched) ? loaded.recentEnriched : [],
    recentErrors: Array.isArray(loaded.recentErrors) ? loaded.recentErrors : [],
    enriched: typeof loaded.enriched === "number" ? loaded.enriched : 0,
  };
}
function saveState(s) {
  s.lastUpdate = new Date().toISOString();
  s.llmCalls = llmCallsUsed;
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ─────────────── main ───────────────
async function main() {
  const files = listStagingFiles();
  console.log(`Staging files: ${files.join(", ")}`);
  const state = loadState();

  for (const file of files) {
    if (shouldStop()) break;
    console.log(`\n→ ${path.basename(file)}`);
    const rows = readJsonl(file);
    const pending = rows.filter((r) => !r.enrichedAt);
    console.log(`  rows=${rows.length} pending=${pending.length}`);
    state.currentFile = path.basename(file);
    saveState(state);

    let dirty = 0;
    for (let i = 0; i < rows.length; i++) {
      if (shouldStop()) break;
      const r = rows[i];
      if (r.enrichedAt) continue;
      // Fast path: if the source already gave us an email, mark enriched
      // immediately and skip the expensive Jina fetch.  Rows without an
      // email are the ones that truly need website discovery + scraping.
      if (r.email) {
        r.enrichedAt = new Date().toISOString();
        state.enriched++;
        dirty++;
        if (dirty >= 100) { writeJsonlAtomic(file, rows); saveState(state); dirty = 0; }
        continue;
      }
      if (state.processed >= MAX_ROWS_PER_PASS) break;

      state.processed++;
      state.currentIndex = i;

      const addr = r.address || r.city || "";
      let website = r.website;
      let email = r.email;

      try {
        if (!website) {
          website = await discoverWebsite(r.name, r.countryCode, addr);
        }
        if (website && !email) {
          email = await scrapeEmailFromSite(website, { companyName: r.name, country: r.countryCode });
        }
      } catch (err) {
        state.errors++;
        state.recentErrors.unshift({
          at: new Date().toISOString(),
          name: r.name,
          err: String(err).slice(0, 120),
        });
        state.recentErrors = state.recentErrors.slice(0, 20);
      }

      r.website = website || null;
      r.email = email || null;
      r.enrichedAt = new Date().toISOString();
      dirty++;

      if (website && email) {
        state.enriched++;
        state.recentEnriched.unshift({
          at: r.enrichedAt,
          cc: r.countryCode,
          name: r.name,
          email,
          website,
        });
        state.recentEnriched = state.recentEnriched.slice(0, 20);
        console.log(`  ✓ ${r.countryCode} ${r.name} → ${email}`);
      } else if (website) {
        state.noEmail++;
      } else {
        state.noWebsite++;
      }

      if (dirty >= 5) {
        writeJsonlAtomic(file, rows);
        saveState(state);
        dirty = 0;
      }
    }
    if (dirty > 0) {
      writeJsonlAtomic(file, rows);
      saveState(state);
    }
  }

  console.log("\n=== enrich pass done ===");
  console.log(JSON.stringify(state, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownBrowser();
  });
