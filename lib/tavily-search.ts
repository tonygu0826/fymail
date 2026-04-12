/**
 * Tavily Search API integration for freight forwarder company search.
 * Free tier: 1,000 credits/month, auto-refreshing.
 * Docs: https://docs.tavily.com/documentation/api-reference/endpoint/search
 */

export interface TavilyCompanyResult {
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
  source: 'tavily';
  confidence: number;
}

export interface TavilySearchOptions {
  query: string;
  limit?: number;
}

/**
 * Search for freight forwarder companies using Tavily Search API.
 */
export async function searchWithTavily(
  options: TavilySearchOptions
): Promise<TavilyCompanyResult[]> {
  const { query, limit = 10 } = options;
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.warn('[tavily-search] TAVILY_API_KEY not configured, skipping');
    return [];
  }

  console.log(`[tavily-search] Starting Tavily search for: "${query}"`);

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `${query} freight forwarder logistics company contact`,
        search_depth: 'advanced',
        max_results: Math.min(limit, 20),
        topic: 'general',
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[tavily-search] Tavily API error: ${response.status} ${errorBody}`);
      throw new Error(`Tavily API ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const results = parseTavilyResults(data.results || []);

    console.log(`[tavily-search] Tavily returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error('[tavily-search] Tavily search failed:', error);
    return [];
  }
}

/**
 * Parse Tavily search results into structured company data.
 */
function parseTavilyResults(results: any[]): TavilyCompanyResult[] {
  const companies: TavilyCompanyResult[] = [];

  for (const result of results) {
    const title = result.title || '';
    const url = result.url || '';
    const content = result.content || '';
    const score = result.score || 0;

    // Check relevance
    const combined = (title + ' ' + content).toLowerCase();
    const keywords = ['freight', 'forwarding', 'logistics', 'shipping', 'cargo', 'transport', 'lcl', 'fcl', 'forwarder'];
    const isRelevant = keywords.some(kw => combined.includes(kw));
    if (!isRelevant) continue;

    // Extract company name from title
    let name = title.split(/[-–—:|·]/)[0].trim();
    if (name.length > 80) name = name.substring(0, 80) + '…';
    if (!name) continue;

    // Detect country
    const country = detectCountry(title + ' ' + content);

    // Detect services
    const services = detectServices(content);

    // Try to extract contact info from content
    const contact = extractContact(content, url);

    companies.push({
      name,
      website: url || undefined,
      description: content ? content.substring(0, 200) : undefined,
      country,
      services: services.length > 0 ? services : undefined,
      contact: (contact.email || contact.phone || contact.linkedin) ? contact : undefined,
      source: 'tavily',
      confidence: Math.min(0.95, Math.max(0.5, score)),
    });
  }

  return companies;
}

function detectCountry(text: string): string | undefined {
  const patterns: [RegExp, string][] = [
    [/\bgermany\b|\bgerman\b|\bdeutschland\b/i, 'DE'],
    [/\bfrance\b|\bfrench\b|\bfrançais/i, 'FR'],
    [/\bnetherlands\b|\bdutch\b|\bholland\b/i, 'NL'],
    [/\bbelgium\b|\bbelgian\b/i, 'BE'],
    [/\bitaly\b|\bitalian\b/i, 'IT'],
    [/\bspain\b|\bspanish\b/i, 'ES'],
    [/\bunited kingdom\b|\bbritain\b|\b\.uk\b/i, 'GB'],
    [/\bswitzerland\b|\bswiss\b/i, 'CH'],
    [/\baustria\b/i, 'AT'],
    [/\bpoland\b|\bpolish\b/i, 'PL'],
    [/\bdenmark\b|\bdanish\b/i, 'DK'],
    [/\bsweden\b|\bswedish\b/i, 'SE'],
    [/\bnorway\b|\bnorwegian\b/i, 'NO'],
    [/\bfinland\b|\bfinnish\b/i, 'FI'],
    [/\bgreece\b|\bgreek\b/i, 'GR'],
    [/\bportugal\b|\bportuguese\b/i, 'PT'],
    [/\bczech\b/i, 'CZ'],
    [/\bhungary\b/i, 'HU'],
    [/\bromania\b/i, 'RO'],
    [/\bireland\b|\birish\b/i, 'IE'],
    [/\bluxembourg\b/i, 'LU'],
  ];
  for (const [pattern, code] of patterns) {
    if (pattern.test(text)) return code;
  }
  return undefined;
}

function detectServices(text: string): string[] {
  const services: string[] = [];
  const lower = text.toLowerCase();
  if (/\blcl\b|less.than.container/i.test(lower)) services.push('LCL');
  if (/\bfcl\b|full.container/i.test(lower)) services.push('FCL');
  if (/\bair.?freight\b|\bair.?cargo\b|\bair.?transport/i.test(lower)) services.push('AIR');
  if (/\bsea.?freight\b|\bocean.?freight\b|\bsea.?cargo/i.test(lower)) services.push('SEA');
  if (/\brail\b|\brailway/i.test(lower)) services.push('RAIL');
  if (/\bcustoms\b|\bclearance/i.test(lower)) services.push('CUSTOMS');
  if (/\bwarehousing\b|\bstorage/i.test(lower)) services.push('WAREHOUSING');
  return services;
}

function extractContact(content: string, url: string): { email?: string; phone?: string; linkedin?: string } {
  const contact: { email?: string; phone?: string; linkedin?: string } = {};

  // Extract email
  const emailMatch = content.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) contact.email = emailMatch[0];

  // Extract phone
  const phoneMatch = content.match(/\+[\d\s()-]{8,20}/);
  if (phoneMatch) contact.phone = phoneMatch[0].trim();

  // Extract LinkedIn
  const linkedinMatch = content.match(/linkedin\.com\/company\/[\w-]+/);
  if (linkedinMatch) contact.linkedin = `https://www.${linkedinMatch[0]}`;

  return contact;
}
