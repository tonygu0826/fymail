/**
 * Intelligence API client with fallback mock data
 */

// Use relative paths for Next.js API routes
const API_BASE = '/api';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  return headers;
}

export interface SearchFilters {
  query?: string;
  countries?: string[];
  services?: string[];
  companySize?: string[];
  page?: number;
  limit?: number;
}

export interface SearchResult {
  searchId: string;
  total: number;
  page: number;
  limit: number;
  companies: Company[];
  error?: string;
  source?: string;
  realTimeSuccess?: boolean;
  fallbackTriggered?: boolean;
  url?: string; // for debugging
}

export interface Company {
  id: string;
  name: string;
  country: string;
  countryLabel: string;
  services: string[];
  serviceLabels: string[];
  opportunityScore: number;
  contact: {
    email?: string;
    phone?: string;
    website?: string;
    linkedin?: string;
  };
  companySize: string;
  description?: string;
  lastUpdated: string;
  dataSource?: 'real' | 'mock';
  contactSource?: {
    email?: 'scraped' | 'missing' | 'mock';
    phone?: 'scraped' | 'missing' | 'mock';
    website?: 'search_result' | 'missing' | 'mock';
  };
}

export interface ImportRequest {
  searchId: string;
  companyIds: string[];
  listId?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  listId?: string;
}

export interface TrendData {
  metric: string;
  name: string;
  currentValue: number;
  change: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

export interface Competitor {
  id: string;
  name: string;
  marketPosition: string;
  threatLevel: 'low' | 'medium' | 'high';
  opportunityScore: number;
  services: string[];
}

/**
 * Perform a search with filters
 */
export async function searchCompanies(filters: SearchFilters): Promise<SearchResult> {
  const url = `${API_BASE}/intelligence/search`;
  const payload = {
    query: filters.query || '',
    filters: {
      countries: filters.countries || [],
      services: filters.services || [],
      companySize: filters.companySize || [],
    },
    page: filters.page || 1,
    limit: filters.limit || 20,
  };

  console.log('[searchCompanies] Fetching URL:', url, 'payload:', payload);
  const timeoutMs = 30000; // 30 seconds total timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    console.log('[searchCompanies] Response status:', response.status, response.statusText);
    if (response.ok) {
      const data = await response.json();
      // Ensure searchId is present
      if (!data.searchId) {
        data.searchId = `search-${Date.now()}`;
      }
      console.log('[searchCompanies] Search succeeded, total:', data.total);
      return data;
    } else {
      const errorText = await response.text();
      console.error('Search API failed', response.status, errorText);
      // Return empty result with error indication
      return {
        searchId: `error-${Date.now()}`,
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 20,
        companies: [],
        error: `Search failed: ${response.status} ${errorText.substring(0, 100)}`,
        source: 'API error',
        url, // include requested URL for debugging
      };
    }
  } catch (error) {
    console.error('Search API error', error);
    // Log additional details for network errors
    if (error instanceof TypeError) {
      console.error('Fetch TypeError details:', error.message, error.stack);
    }
    // Return empty result with error indication
    const errorMessage = error instanceof Error && error.name === 'AbortError' 
      ? `Request timeout after ${timeoutMs}ms`
      : `Network error: ${error instanceof Error ? error.message : String(error)}`;
    return {
      searchId: `error-${Date.now()}`,
      total: 0,
      page: filters.page || 1,
      limit: filters.limit || 20,
      companies: [],
      error: errorMessage,
      source: 'Network error',
      url, // include requested URL for debugging
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch search results by searchId
 */
export async function getSearchResults(searchId: string, page = 1, limit = 20): Promise<SearchResult> {
  const url = `${API_BASE}/intelligence/results/${searchId}?page=${page}&limit=${limit}`;

  const timeoutMs = 30000; // 30 seconds total timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { headers: authHeaders(), signal: controller.signal });
    if (response.ok) {
      const data = await response.json();
      // Ensure searchId is present
      if (!data.searchId) {
        data.searchId = searchId;
      }
      return data;
    } else {
      const errorText = await response.text();
      console.error('Results API failed', response.status, errorText);
      // Return empty result with error indication
      return {
        searchId,
        total: 0,
        page,
        limit,
        companies: [],
        error: `Results API failed: ${response.status} ${errorText.substring(0, 100)}`,
        source: 'API error',
      };
    }
  } catch (error) {
    console.error('Results API error', error);
    // Return empty result with error indication
    const errorMessage = error instanceof Error && error.name === 'AbortError' 
      ? `Request timeout after ${timeoutMs}ms`
      : `Network error: ${error instanceof Error ? error.message : String(error)}`;
    return {
      searchId,
      total: 0,
      page,
      limit,
      companies: [],
      error: errorMessage,
      source: 'Network error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Import selected companies to contacts
 */
export async function importCompanies(request: ImportRequest): Promise<ImportResult> {
  const url = `${API_BASE}/intelligence/import`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(request),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorText = await response.text();
      console.error('Import API failed', response.status, errorText);
      throw new Error(`Import API failed: ${response.status} ${errorText.substring(0, 100)}`);
    }
  } catch (error) {
    console.error('Import API error', error);
    throw error;
  }
}

/**
 * Fetch market trends
 */
export async function getMarketTrends(region = 'EUROPE', timeframe = 'MONTH'): Promise<TrendData[]> {
  const url = `${API_BASE}/intelligence/trends?region=${region.toUpperCase()}&timeframe=${timeframe.toUpperCase()}`;

  try {
    const response = await fetch(url, { headers: authHeaders() });
    if (response.ok) {
      const data = await response.json();
      return data.trends || [];
    } else {
      const errorText = await response.text();
      console.error('Trends API failed', response.status, errorText);
      throw new Error(`Trends API failed: ${response.status} ${errorText.substring(0, 100)}`);
    }
  } catch (error) {
    console.error('Trends API error', error);
    throw error;
  }
}

/**
 * Fetch competitor insights
 */
export async function getCompetitors(service?: string): Promise<Competitor[]> {
  const url = `${API_BASE}/intelligence/competitors${service && service !== 'all' ? `?service=${service}` : ''}`;

  try {
    const response = await fetch(url, { headers: authHeaders() });
    if (response.ok) {
      const data = await response.json();
      const competitors = data.competitors || [];
      // Map threatLevel from Chinese to English
      const mapped = competitors.map((c: any) => ({
        ...c,
        threatLevel: c.threatLevel === '高' ? 'high' : c.threatLevel === '中' ? 'medium' : 'low',
      }));
      return mapped;
    } else {
      const errorText = await response.text();
      console.error('Competitors API failed', response.status, errorText);
      throw new Error(`Competitors API failed: ${response.status} ${errorText.substring(0, 100)}`);
    }
  } catch (error) {
    console.error('Competitors API error', error);
    throw error;
  }
}

// ----------------------------------------------------------------------
// Mock data for fallback
// ----------------------------------------------------------------------

function getMockSearchResult(filters: SearchFilters, searchId?: string): SearchResult {
  const countries = filters.countries || [];
  const services = filters.services || [];
  const query = filters.query || '';

  const mockCompanies: Company[] = [
    {
      id: '1',
      name: '德迅国际',
      country: 'DE',
      countryLabel: '德国',
      services: ['LCL', 'FCL', '空运'],
      serviceLabels: ['LCL拼箱', 'FCL整箱', '空运'],
      opportunityScore: 85,
      contact: {
        email: 'info@kuehne-nagel.com',
        phone: '+49 40 3088‑0',
        website: 'https://www.kuehne-nagel.com',
        linkedin: 'https://linkedin.com/company/kuehne-nagel',
      },
      companySize: 'LARGE',
      description: '全球领先的物流公司，提供全方位的海运、空运和陆运服务。',
      lastUpdated: '2025-03-28',
    },
    {
      id: '2',
      name: '德铁信可',
      country: 'DE',
      countryLabel: '德国',
      services: ['LCL', '铁路'],
      serviceLabels: ['LCL拼箱', '铁路'],
      opportunityScore: 78,
      contact: {
        email: 'contact@dbschenker.com',
        phone: '+49 69 2385‑0',
        website: 'https://www.dbschenker.com',
        linkedin: 'https://linkedin.com/company/dbschenker',
      },
      companySize: 'LARGE',
      description: '欧洲领先的物流服务商，铁路运输实力强劲。',
      lastUpdated: '2025-03-27',
    },
    {
      id: '3',
      name: '敏捷物流',
      country: 'NL',
      countryLabel: '荷兰',
      services: ['LCL', '数字化'],
      serviceLabels: ['LCL拼箱', '数字化'],
      opportunityScore: 92,
      contact: {
        email: 'hello@agility.com',
        phone: '+31 20 504 5000',
        website: 'https://www.agility.com',
        linkedin: 'https://linkedin.com/company/agility',
      },
      companySize: 'MEDIUM',
      description: '数字化物流创新者，专注于欧洲中小企业市场。',
      lastUpdated: '2025-03-26',
    },
    {
      id: '4',
      name: '乔达国际',
      country: 'FR',
      countryLabel: '法国',
      services: ['合同物流'],
      serviceLabels: ['合同物流'],
      opportunityScore: 65,
      contact: {
        email: 'contact@geodis.com',
        phone: '+33 1 56 76 20 00',
        website: 'https://www.geodis.com',
        linkedin: 'https://linkedin.com/company/geodis',
      },
      companySize: 'LARGE',
      description: '法国领先的合同物流和供应链解决方案提供商。',
      lastUpdated: '2025-03-25',
    },
    {
      id: '5',
      name: '泛亚班拿',
      country: 'CH',
      countryLabel: '瑞士',
      services: ['LCL', 'FCL', '空运'],
      serviceLabels: ['LCL拼箱', 'FCL整箱', '空运'],
      opportunityScore: 70,
      contact: {
        email: 'info@panalpina.com',
        phone: '+41 61 226 11 11',
        website: 'https://www.panalpina.com',
        linkedin: 'https://linkedin.com/company/panalpina',
      },
      companySize: 'LARGE',
      description: '国际货运和物流专家，尤其在空运和海运领域。',
      lastUpdated: '2025-03-24',
    },
    {
      id: '6',
      name: '德莎物流',
      country: 'DE',
      countryLabel: '德国',
      services: ['LCL', 'FCL'],
      serviceLabels: ['LCL拼箱', 'FCL整箱'],
      opportunityScore: 73,
      contact: {
        email: 'info@dachser.com',
        phone: '+49 831 5916‑0',
        website: 'https://www.dachser.com',
        linkedin: 'https://linkedin.com/company/dachser',
      },
      companySize: 'LARGE',
      description: '欧洲领先的物流服务商，网络覆盖广泛。',
      lastUpdated: '2025-03-23',
    },
  ];

  // Simple filtering for mock purposes
  let filtered = mockCompanies;
  if (countries.length > 0) {
    filtered = filtered.filter(c => countries.includes(c.country));
  }
  if (services.length > 0) {
    filtered = filtered.filter(c => c.services.some(s => services.includes(s)));
  }
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.description?.toLowerCase().includes(q) ||
      c.countryLabel.toLowerCase().includes(q)
    );
  }

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginated = filtered.slice(start, end);

  return {
    searchId: searchId || `mock-${Date.now()}`,
    total: filtered.length,
    page,
    limit,
    companies: paginated,
  };
}

function getMockTrends(): TrendData[] {
  return [
    {
      metric: 'LCL_VOLUME',
      name: 'LCL拼箱运量',
      currentValue: 1245,
      change: 8.2,
      unit: 'TEU',
      trend: 'up',
    },
    {
      metric: 'FREIGHT_RATE',
      name: '货运费率',
      currentValue: 1850,
      change: -2.1,
      unit: 'USD/TEU',
      trend: 'down',
    },
    {
      metric: 'CAPACITY',
      name: '运力利用率',
      currentValue: 78,
      change: 3.5,
      unit: '%',
      trend: 'up',
    },
    {
      metric: 'DEMAND',
      name: '市场需求指数',
      currentValue: 82,
      change: 0.5,
      unit: '指数',
      trend: 'stable',
    },
  ];
}

function getMockCompetitors(): Competitor[] {
  return [
    {
      id: '1',
      name: '德迅国际',
      marketPosition: '领导者',
      threatLevel: 'high',
      opportunityScore: 35,
      services: ['LCL', 'FCL', '空运'],
    },
    {
      id: '2',
      name: '德铁信可',
      marketPosition: '领导者',
      threatLevel: 'high',
      opportunityScore: 40,
      services: ['LCL', '铁路'],
    },
    {
      id: '3',
      name: '敏捷物流',
      marketPosition: '新进入者',
      threatLevel: 'low',
      opportunityScore: 85,
      services: ['LCL', '数字化'],
    },
    {
      id: '4',
      name: '乔达国际',
      marketPosition: '挑战者',
      threatLevel: 'medium',
      opportunityScore: 65,
      services: ['合同物流'],
    },
  ];
}