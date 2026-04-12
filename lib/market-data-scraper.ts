/**
 * Market data scraper — 4 free data sources for European freight trends.
 *
 * 1. Drewry WCI      — weekly container freight index (Shanghai→Rotterdam/Genoa)
 * 2. All-Forward AFX  — daily container rates to European destinations
 * 3. BDI (stockq)     — daily Baltic Dry Index
 * 4. Eurostat API     — EU trade volume & port throughput
 *
 * Data is cached in-memory + file to avoid hammering sources.
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FreightRate {
  route: string;
  rate: number;        // USD per 40ft or per TEU
  unit: string;
  change?: number;     // percent change
  source: string;
  updatedAt: string;
}

export interface MarketIndex {
  name: string;
  value: number;
  unit: string;
  change?: number;
  source: string;
  updatedAt: string;
}

export interface TradeVolume {
  region: string;
  exports: number;     // million EUR
  imports: number;
  unit: string;
  period: string;
  source: string;
  updatedAt: string;
}

export interface PortThroughput {
  port: string;
  country: string;
  tonnage: number;     // thousand tonnes
  unit: string;
  period: string;
  source: string;
  updatedAt: string;
}

export interface MarketSnapshot {
  freightRates: FreightRate[];
  indices: MarketIndex[];
  tradeVolumes: TradeVolume[];
  ports: PortThroughput[];
  fetchedAt: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_DIR = path.join(process.cwd(), 'data', 'market-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'snapshot.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let memoryCache: MarketSnapshot | null = null;
let memoryCacheTime = 0;

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readFileCache(): MarketSnapshot | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const stat = fs.statSync(CACHE_FILE);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeFileCache(snap: MarketSnapshot) {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(snap, null, 2));
  } catch (e) {
    console.error('[market-cache] write error:', e);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (compatible; FYMailBot/1.0)';

async function fetchHTML(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJSON(url: string, timeoutMs = 15000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 1. Drewry World Container Index (WCI)
// ---------------------------------------------------------------------------

async function scrapeDrewryWCI(): Promise<FreightRate[]> {
  const url = 'https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry';
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const rates: FreightRate[] = [];
  const now = new Date().toISOString();

  // Extract from meta description and page text
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const bodyText = $('body').text();

  // Parse WCI composite value: look for patterns like "$2,287" or "2,287 per 40-foot"
  const compositeMatch = metaDesc.match(/\$?([\d,]+)\s*(?:per\s*40|\/40)/i)
    || bodyText.match(/composite[^$]*\$?([\d,]+)/i);
  if (compositeMatch) {
    rates.push({
      route: 'WCI Composite',
      rate: parseFloat(compositeMatch[1].replace(/,/g, '')),
      unit: 'USD/40ft',
      source: 'Drewry WCI',
      updatedAt: now,
    });
  }

  // Shanghai→Rotterdam
  const rotMatch = bodyText.match(/Shanghai\s*(?:[-–to]+|→)\s*Rotterdam[^$]*\$?([\d,]+)/i)
    || bodyText.match(/Rotterdam[^$]*\$?([\d,]+)/i);
  if (rotMatch) {
    rates.push({
      route: 'Shanghai → Rotterdam',
      rate: parseFloat(rotMatch[1].replace(/,/g, '')),
      unit: 'USD/40ft',
      source: 'Drewry WCI',
      updatedAt: now,
    });
  }

  // Shanghai→Genoa
  const genMatch = bodyText.match(/Shanghai\s*(?:[-–to]+|→)\s*Genoa[^$]*\$?([\d,]+)/i)
    || bodyText.match(/Genoa[^$]*\$?([\d,]+)/i);
  if (genMatch) {
    rates.push({
      route: 'Shanghai → Genoa',
      rate: parseFloat(genMatch[1].replace(/,/g, '')),
      unit: 'USD/40ft',
      source: 'Drewry WCI',
      updatedAt: now,
    });
  }

  // Try to extract percentage changes
  const changePatterns = [
    { route: 'WCI Composite', pattern: /composite[^%]*?([-+]?\d+(?:\.\d+)?)\s*%/i },
    { route: 'Shanghai → Rotterdam', pattern: /Rotterdam[^%]*?([-+]?\d+(?:\.\d+)?)\s*%/i },
  ];
  for (const cp of changePatterns) {
    const m = bodyText.match(cp.pattern);
    if (m) {
      const found = rates.find(r => r.route === cp.route);
      if (found) found.change = parseFloat(m[1]);
    }
  }

  return rates;
}

// ---------------------------------------------------------------------------
// 2. All-Forward AFX Container Rates
// ---------------------------------------------------------------------------

async function scrapeAllForwardAFX(): Promise<FreightRate[]> {
  const url = 'https://all-forward.com/ContainerFreightRates';
  const html = await fetchHTML(url);
  const rates: FreightRate[] = [];
  const now = new Date().toISOString();

  // AFX embeds JSON data in <script> tags
  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const script of scriptMatches) {
    // Look for rate data objects
    const jsonMatch = script.match(/\{[^{}]*"origin"[^{}]*"destination"[^{}]*"rate"[^{}]*\}/g)
      || script.match(/\{[^{}]*China[^{}]*Germany[^{}]*\}/gi);
    if (jsonMatch) {
      for (const j of jsonMatch) {
        try {
          const obj = JSON.parse(j);
          if (obj.rate && obj.destination) {
            rates.push({
              route: `${obj.origin || 'China'} → ${obj.destination}`,
              rate: parseFloat(obj.rate),
              unit: 'USD/40ft',
              change: obj.change ? parseFloat(obj.change) : undefined,
              source: 'All-Forward AFX',
              updatedAt: now,
            });
          }
        } catch { /* not valid JSON */ }
      }
    }
  }

  // Fallback: parse from visible HTML table/cards
  if (rates.length === 0) {
    const $ = cheerio.load(html);
    // Look for rate cards or table rows with European destinations
    $('td, .rate-card, [data-rate]').each((_, el) => {
      const text = $(el).text();
      const euroDestMatch = text.match(/(Germany|Spain|Netherlands|France|Italy|Belgium|UK)\D*([\d,]+)/i);
      if (euroDestMatch) {
        rates.push({
          route: `China → ${euroDestMatch[1]}`,
          rate: parseFloat(euroDestMatch[2].replace(/,/g, '')),
          unit: 'USD/40ft',
          source: 'All-Forward AFX',
          updatedAt: now,
        });
      }
    });
  }

  return rates;
}

// ---------------------------------------------------------------------------
// 3. Baltic Dry Index (BDI) from stockq
// ---------------------------------------------------------------------------

async function scrapeBDI(): Promise<MarketIndex[]> {
  const url = 'https://en.stockq.org/index/BDI.php';
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const now = new Date().toISOString();
  const indices: MarketIndex[] = [];

  // stockq shows BDI value in a table
  const bodyText = $('body').text();

  // Pattern: "Baltic Dry Index" followed by a number
  const bdiMatch = bodyText.match(/Baltic\s*Dry\s*Index[^0-9]*([\d,]+(?:\.\d+)?)/i)
    || bodyText.match(/BDI[^0-9]*([\d,]+(?:\.\d+)?)/i);
  const changeMatch = bodyText.match(/BDI[^%]*([-+]?\d+(?:\.\d+)?)\s*%/i)
    || bodyText.match(/([-+]?\d+(?:\.\d+)?)\s*%/);

  if (bdiMatch) {
    indices.push({
      name: 'Baltic Dry Index (BDI)',
      value: parseFloat(bdiMatch[1].replace(/,/g, '')),
      unit: 'points',
      change: changeMatch ? parseFloat(changeMatch[1]) : undefined,
      source: 'Baltic Exchange via stockq',
      updatedAt: now,
    });
  }

  // Also try tradingeconomics as backup
  if (indices.length === 0) {
    try {
      const teHtml = await fetchHTML('https://tradingeconomics.com/commodity/baltic', 10000);
      const te$ = cheerio.load(teHtml);
      const teText = te$('body').text();
      const teMatch = teText.match(/Baltic[^0-9]*([\d,]+(?:\.\d+)?)/i);
      if (teMatch) {
        indices.push({
          name: 'Baltic Dry Index (BDI)',
          value: parseFloat(teMatch[1].replace(/,/g, '')),
          unit: 'points',
          source: 'Trading Economics',
          updatedAt: now,
        });
      }
    } catch { /* backup failed, ok */ }
  }

  return indices;
}

// ---------------------------------------------------------------------------
// 4. Eurostat API — EU trade volume & port throughput
// ---------------------------------------------------------------------------

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

async function fetchEurostatTrade(): Promise<TradeVolume[]> {
  // EU27 international trade volume indices — dataset: ext_lt_intertrd
  // Dimensions: freq, indic_et, sitc06, partner, geo, time
  // indic_et: IVOL_EXP (export volume index, 2021=100), IVOL_IMP (import volume index)
  // partner=EXT_EU27_2020 = EU trade with non-EU countries (international trade)
  // Don't filter indic_et — API rejects comma-separated values; filter in code instead
  const url = `${EUROSTAT_BASE}/ext_lt_intertrd?sinceTimePeriod=2023&geo=EU27_2020&partner=EXT_EU27_2020&sitc06=TOTAL&format=JSON&lang=en`;
  const data = await fetchJSON(url, 20000);
  const now = new Date().toISOString();

  try {
    const dims = data.dimension;
    const values = data.value || {};
    const timeIds = Object.keys(dims.time?.category?.index || {}).sort();
    const latestYear = timeIds.pop() || '2024';
    const prevYear = timeIds.pop() || '';

    const expKey = calculateIndex(data, { indic_et: 'IVOL_EXP', partner: 'WORLD', time: latestYear });
    const impKey = calculateIndex(data, { indic_et: 'IVOL_IMP', partner: 'WORLD', time: latestYear });
    const prevExpKey = prevYear ? calculateIndex(data, { indic_et: 'IVOL_EXP', partner: 'WORLD', time: prevYear }) : -1;
    const prevImpKey = prevYear ? calculateIndex(data, { indic_et: 'IVOL_IMP', partner: 'WORLD', time: prevYear }) : -1;

    const expVal = values[expKey] ?? 0;
    const impVal = values[impKey] ?? 0;
    const prevExpVal = prevExpKey >= 0 ? (values[prevExpKey] ?? 0) : 0;
    const prevImpVal = prevImpKey >= 0 ? (values[prevImpKey] ?? 0) : 0;

    const results: TradeVolume[] = [];
    if (expVal > 0) {
      results.push({
        region: 'EU27',
        exports: Math.round(expVal * 10) / 10,
        imports: Math.round(impVal * 10) / 10,
        unit: 'index (2021=100)',
        period: latestYear,
        source: 'Eurostat',
        updatedAt: now,
      });
    }

    // Store YoY change in the exports/imports fields for trend calculation
    if (results.length > 0 && prevExpVal > 0) {
      (results[0] as any)._expChange = ((expVal - prevExpVal) / prevExpVal) * 100;
      (results[0] as any)._impChange = ((impVal - prevImpVal) / prevImpVal) * 100;
    }

    return results;
  } catch (e) {
    console.error('[eurostat-trade] parse error:', e);
  }

  return [];
}

/** Calculate flat index for Eurostat JSON-stat format */
function calculateIndex(data: any, selections: Record<string, string>): number {
  const ids: string[] = data.id;
  const dims = data.dimension;
  let idx = 0;
  let multiplier = 1;

  // Iterate dimensions in reverse to calculate flat index
  for (let i = ids.length - 1; i >= 0; i--) {
    const dimId = ids[i];
    const catIndex = dims[dimId]?.category?.index || {};
    const selectedValue = selections[dimId];
    const position = selectedValue !== undefined ? (catIndex[selectedValue] ?? 0) : 0;
    idx += position * multiplier;
    multiplier *= Object.keys(catIndex).length;
  }
  return idx;
}

async function fetchEurostatPorts(): Promise<PortThroughput[]> {
  // Top EU ports gross weight — dataset: mar_mg_aa_pwhd
  const url = `${EUROSTAT_BASE}/mar_mg_aa_pwhd?sinceTimePeriod=2022&unit=THS_T&direct=TOTAL&format=JSON&lang=en`;
  const ports: PortThroughput[] = [];
  const now = new Date().toISOString();

  try {
    const data = await fetchJSON(url, 20000);
    const dims = data.dimension;
    const values = data.value || {};
    const repPorts = dims.rep_mar?.category?.label || {};
    const timeIndex = dims.time?.category?.index || {};
    const latestYear = Object.keys(timeIndex).sort().pop() || '2023';

    // Map port codes to country
    const portCountry: Record<string, string> = {
      'NLRTM': 'Netherlands', 'BEANR': 'Belgium', 'DEHAM': 'Germany',
      'DEBRV': 'Germany', 'ESALG': 'Spain', 'ESVLC': 'Spain',
      'FRMRS': 'France', 'ITGOA': 'Italy', 'GKPIR': 'Greece',
      'GBFXT': 'UK', 'GBLON': 'UK',
    };

    for (const [portCode, portName] of Object.entries(repPorts)) {
      const key = calculateIndex(data, { rep_mar: portCode, time: latestYear });
      const val = values[key];
      if (val !== undefined && val > 0) {
        ports.push({
          port: portName as string,
          country: portCountry[portCode] || '',
          tonnage: val,
          unit: 'thousand tonnes',
          period: latestYear,
          source: 'Eurostat',
          updatedAt: now,
        });
      }
    }

    // Sort by tonnage and keep top 10
    ports.sort((a, b) => b.tonnage - a.tonnage);
    return ports.slice(0, 10);
  } catch (e) {
    console.error('[eurostat-ports] parse error:', e);
  }

  return ports;
}

// ---------------------------------------------------------------------------
// Main: fetch all sources, return unified snapshot
// ---------------------------------------------------------------------------

export async function getMarketSnapshot(forceRefresh = false): Promise<MarketSnapshot> {
  // Check memory cache
  if (!forceRefresh && memoryCache && Date.now() - memoryCacheTime < CACHE_TTL_MS) {
    return memoryCache;
  }

  // Check file cache
  if (!forceRefresh) {
    const fileCached = readFileCache();
    if (fileCached) {
      memoryCache = fileCached;
      memoryCacheTime = Date.now();
      return fileCached;
    }
  }

  // Fetch all sources in parallel
  const errors: string[] = [];

  const [drewryResult, afxResult, bdiResult, tradeResult, portsResult] = await Promise.allSettled([
    scrapeDrewryWCI(),
    scrapeAllForwardAFX(),
    scrapeBDI(),
    fetchEurostatTrade(),
    fetchEurostatPorts(),
  ]);

  const freightRates: FreightRate[] = [];
  const indices: MarketIndex[] = [];
  const tradeVolumes: TradeVolume[] = [];
  const ports: PortThroughput[] = [];

  if (drewryResult.status === 'fulfilled') {
    freightRates.push(...drewryResult.value);
  } else {
    errors.push(`Drewry WCI: ${drewryResult.reason}`);
  }

  if (afxResult.status === 'fulfilled') {
    freightRates.push(...afxResult.value);
  } else {
    errors.push(`All-Forward AFX: ${afxResult.reason}`);
  }

  if (bdiResult.status === 'fulfilled') {
    indices.push(...bdiResult.value);
  } else {
    errors.push(`BDI: ${bdiResult.reason}`);
  }

  if (tradeResult.status === 'fulfilled') {
    tradeVolumes.push(...tradeResult.value);
  } else {
    errors.push(`Eurostat Trade: ${tradeResult.reason}`);
  }

  if (portsResult.status === 'fulfilled') {
    ports.push(...portsResult.value);
  } else {
    errors.push(`Eurostat Ports: ${portsResult.reason}`);
  }

  const snapshot: MarketSnapshot = {
    freightRates,
    indices,
    tradeVolumes,
    ports,
    fetchedAt: new Date().toISOString(),
    errors,
  };

  // Cache it
  memoryCache = snapshot;
  memoryCacheTime = Date.now();
  writeFileCache(snapshot);

  if (errors.length > 0) {
    console.warn('[market-scraper] partial errors:', errors);
  }

  return snapshot;
}

// ---------------------------------------------------------------------------
// Convert snapshot to TrendData[] for the frontend
// ---------------------------------------------------------------------------

export interface TrendDataOutput {
  metric: string;
  name: string;
  currentValue: number;
  change: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  source: string;
  updatedAt: string;
}

/** Read previous snapshot for change calculation */
function getPreviousSnapshot(): MarketSnapshot | null {
  const histFile = path.join(CACHE_DIR, 'snapshot-prev.json');
  try {
    if (!fs.existsSync(histFile)) return null;
    return JSON.parse(fs.readFileSync(histFile, 'utf-8'));
  } catch {
    return null;
  }
}

/** Save current as previous (call after successful fetch) */
export function rotatePreviousSnapshot() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const histFile = path.join(CACHE_DIR, 'snapshot-prev.json');
      fs.copyFileSync(CACHE_FILE, histFile);
    }
  } catch { /* ok */ }
}

export function snapshotToTrends(snap: MarketSnapshot): TrendDataOutput[] {
  const prev = getPreviousSnapshot();
  const trends: TrendDataOutput[] = [];

  // Freight rates → trends
  for (const fr of snap.freightRates) {
    let change = fr.change ?? 0;
    // Try to calculate from previous snapshot if no embedded change
    if (!fr.change && prev) {
      const prevRate = prev.freightRates.find(p => p.route === fr.route);
      if (prevRate && prevRate.rate > 0) {
        change = ((fr.rate - prevRate.rate) / prevRate.rate) * 100;
      }
    }
    trends.push({
      metric: fr.route.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
      name: fr.route,
      currentValue: fr.rate,
      change: Math.round(change * 10) / 10,
      unit: fr.unit,
      trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
      source: fr.source,
      updatedAt: fr.updatedAt,
    });
  }

  // BDI → trend
  for (const idx of snap.indices) {
    let change = idx.change ?? 0;
    if (!idx.change && prev) {
      const prevIdx = prev.indices.find(p => p.name === idx.name);
      if (prevIdx && prevIdx.value > 0) {
        change = ((idx.value - prevIdx.value) / prevIdx.value) * 100;
      }
    }
    trends.push({
      metric: 'BDI',
      name: idx.name,
      currentValue: idx.value,
      change: Math.round(change * 10) / 10,
      unit: idx.unit,
      trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
      source: idx.source,
      updatedAt: idx.updatedAt,
    });
  }

  // EU trade volume → trends (export + import indices)
  for (const tv of snap.tradeVolumes) {
    const expChange = (tv as any)._expChange ?? 0;
    const impChange = (tv as any)._impChange ?? 0;

    trends.push({
      metric: 'EU_EXPORT_INDEX',
      name: `EU27 出口量指数 (${tv.period})`,
      currentValue: tv.exports,
      change: Math.round(expChange * 10) / 10,
      unit: tv.unit,
      trend: expChange > 1 ? 'up' : expChange < -1 ? 'down' : 'stable',
      source: tv.source,
      updatedAt: tv.updatedAt,
    });

    trends.push({
      metric: 'EU_IMPORT_INDEX',
      name: `EU27 进口量指数 (${tv.period})`,
      currentValue: tv.imports,
      change: Math.round(impChange * 10) / 10,
      unit: tv.unit,
      trend: impChange > 1 ? 'up' : impChange < -1 ? 'down' : 'stable',
      source: tv.source,
      updatedAt: tv.updatedAt,
    });
  }

  // Top ports → trend (aggregate as total throughput)
  if (snap.ports.length > 0) {
    const totalTonnage = snap.ports.reduce((sum, p) => sum + p.tonnage, 0);
    trends.push({
      metric: 'EU_PORT_THROUGHPUT',
      name: `欧洲主要港口吞吐量 (${snap.ports[0]?.period || ''})`,
      currentValue: Math.round(totalTonnage),
      change: 0,
      unit: 'thousand tonnes',
      trend: 'stable',
      source: 'Eurostat',
      updatedAt: snap.ports[0]?.updatedAt || new Date().toISOString(),
    });
  }

  return trends;
}
