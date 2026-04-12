/**
 * Real‑time search — 统一使用 SearXNG 作为唯一搜索源
 * SearXNG 是自托管的元搜索引擎，无限额，聚合多个搜索引擎结果
 */

import { searchWithSearxng } from './searxng-search';

export interface CompanySearchResult {
  name: string;
  website?: string;
  description?: string;
  country?: string;
  services?: string[];
  contact?: {
    email?: string;
    phone?: string;
    linkedin?: string;
  };
  source: 'tavily' | 'gemini' | 'duckduckgo' | 'google' | 'bing' | 'brave' | 'jina' | 'fallback';
  confidence: number;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  useGemini?: boolean;
  useGoogle?: boolean;
  useBing?: boolean;
  allowFallback?: boolean;
}

/**
 * 带重试的 SearXNG 搜索
 */
async function searchWithRetry(
  query: string,
  limit: number,
  maxRetries = 2
): Promise<CompanySearchResult[]> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const searxResults = await searchWithSearxng({ query, limit });
      return searxResults.map(s => ({
        name: s.name,
        website: s.website,
        description: s.description,
        country: s.country,
        services: s.services,
        contact: s.contact,
        source: 'brave' as const,
        confidence: s.confidence,
      }));
    } catch (error) {
      if (attempt < maxRetries) {
        // 指数退避: 1s, 2s
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      console.warn(`[realtime-search] SearXNG failed after ${maxRetries + 1} attempts for "${query}": ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  return [];
}

/**
 * Main real‑time search entry point.
 */
export async function searchRealTime(
  options: SearchOptions
): Promise<CompanySearchResult[]> {
  const { query, limit = 20 } = options;

  const results = await searchWithRetry(query, limit * 2);

  // Deduplicate by website or name
  const seen = new Set<string>();
  const deduped: CompanySearchResult[] = [];
  for (const r of results) {
    const key = r.website ? r.website.toLowerCase() : r.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  deduped.sort((a, b) => b.confidence - a.confidence);
  return deduped.slice(0, limit);
}
