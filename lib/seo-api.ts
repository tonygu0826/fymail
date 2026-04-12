// SEO API client - fetches data from fywarehouse.com SEO endpoints

const SEO_API_BASE = process.env.SEO_API_BASE || 'http://localhost:3001';
const SEO_API_KEY = process.env.SEO_API_KEY || process.env.NEWS_API_KEY || '';

async function seoFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${SEO_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${SEO_API_KEY}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`SEO API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ==================== Types ====================

export type SeoHealthReport = {
  timestamp: string;
  overview: {
    totalArticles: number;
    publishedArticles: number;
    avgSeoScore: number;
    avgFreshnessScore: number;
    avgWordCount: number;
    articlesNeedingRefresh: number;
  };
  keywordCoverage: {
    totalKeywords: number;
    publishedKeywords: number;
    unusedKeywords: number;
    topFunnelCoverage: number;
    bottomFunnelCoverage: number;
  };
  contentHealth: {
    healthy: number;
    needsAttention: number;
    critical: number;
  };
  topIssues: string[];
  recommendations: string[];
  articles: ArticlePerformance[];
};

export type ArticlePerformance = {
  slug: string;
  title: string;
  publishedAt: string;
  daysSincePublish: number;
  seoScore: number;
  freshnessScore: number;
  wordCount: number;
  hasTargetKeyword: boolean;
  internalLinkCount: number;
  moneyPageLinkCount: number;
  status: 'healthy' | 'needs-attention' | 'critical';
};

export type KeywordStats = {
  total: number;
  byStatus: Record<string, number>;
  byFunnel: Record<string, number>;
  byCategory: Record<string, number>;
  avgOpportunity: number;
  topOpportunities: Array<{
    id: string;
    keyword: string;
    opportunity: number;
    funnelPosition: string;
    intent: string;
    status: string;
    category: string;
  }>;
};

export type NewsArticleSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  status: string;
  source: string;
  publishedAt: string | null;
  createdAt: string;
  readingTimeMinutes: number;
  author: string;
};

// ==================== API Calls ====================

export async function getSeoHealth(): Promise<SeoHealthReport> {
  return seoFetch('/api/seo/monitoring');
}

export async function getKeywordStats(): Promise<KeywordStats> {
  return seoFetch('/api/seo/keywords/stats');
}

export async function getArticles(): Promise<{ articles: NewsArticleSummary[] }> {
  return seoFetch('/api/news/articles?status=published');
}

export async function getContentAudit(): Promise<{
  total: number;
  needsRefresh: Array<{ slug: string; title: string; freshnessScore: number; seoScore: number; priority: string; issues: string[] }>;
  healthy: number;
  avgFreshness: number;
}> {
  return seoFetch('/api/news/audit');
}

export async function triggerRefresh(slug?: string): Promise<unknown> {
  return seoFetch('/api/news/refresh', {
    method: 'POST',
    body: JSON.stringify(slug ? { slug } : { maxArticles: 5 }),
  });
}

export async function triggerGenerate(): Promise<unknown> {
  return seoFetch('/api/news/generate/auto', { method: 'POST' });
}

export async function triggerKeywordDiscovery(): Promise<unknown> {
  return seoFetch('/api/seo/keywords/discover', {
    method: 'POST',
    body: JSON.stringify({ maxKeywords: 30 }),
  });
}
