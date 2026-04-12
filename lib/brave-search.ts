/**
 * Brave Search API integration for freight forwarder company search.
 * Free tier: 2,000 queries/month, no credit card required.
 * Docs: https://api.search.brave.com/app/documentation/web-search
 */

export interface BraveCompanyResult {
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
  source: 'brave';
  confidence: number;
}

export interface BraveSearchOptions {
  query: string;
  limit?: number;
}

export async function searchWithBrave(
  options: BraveSearchOptions
): Promise<BraveCompanyResult[]> {
  const { query, limit = 20 } = options;
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    console.warn('[brave-search] BRAVE_SEARCH_API_KEY not configured, skipping');
    return [];
  }

  console.log(`[brave-search] Starting Brave search for: "${query}"`);

  try {
    const params = new URLSearchParams({
      q: `${query} freight forwarder logistics company`,
      count: String(Math.min(limit, 20)),
      text_decorations: 'false',
      search_lang: 'en',
    });

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[brave-search] Brave API error: ${response.status} ${errorBody}`);
      throw new Error(`Brave API ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const results = parseBraveResults(data);

    console.log(`[brave-search] Brave returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error('[brave-search] Brave search failed:', error);
    return [];
  }
}

function parseBraveResults(data: any): BraveCompanyResult[] {
  const companies: BraveCompanyResult[] = [];
  const webResults = data?.web?.results || [];

  for (const result of webResults) {
    const title = result.title || '';
    const url = result.url || '';
    const description = result.description || '';

    const combined = (title + ' ' + description).toLowerCase();
    const keywords = ['freight', 'forwarding', 'logistics', 'shipping', 'cargo', 'transport', 'lcl', 'fcl', 'forwarder'];
    const isRelevant = keywords.some(kw => combined.includes(kw));
    if (!isRelevant) continue;

    let name = title.split(/[-–—:|·]/)[0].trim();
    if (name.length > 80) name = name.substring(0, 80) + '...';
    if (!name) continue;

    const country = detectCountry(title + ' ' + description);
    const services = detectServices(description);
    const contact = extractContact(description, url);

    companies.push({
      name,
      website: url || undefined,
      description: description ? description.substring(0, 200) : undefined,
      country,
      services: services.length > 0 ? services : undefined,
      contact: (contact.email || contact.phone || contact.linkedin) ? contact : undefined,
      source: 'brave',
      confidence: 0.8,
    });
  }

  return companies;
}

function detectCountry(text: string): string | undefined {
  const patterns: [RegExp, string][] = [
    [/\bgermany\b|\bgerman\b|\bdeutschland\b/i, 'DE'],
    [/\bfrance\b|\bfrench\b/i, 'FR'],
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
    [/\busa\b|\bunited states\b|\bamerica\b/i, 'US'],
    [/\bchina\b|\bchinese\b/i, 'CN'],
    [/\bindia\b|\bindian\b/i, 'IN'],
    [/\bcanada\b|\bcanadian\b/i, 'CA'],
    [/\baustralia\b|\baustralian\b/i, 'AU'],
    [/\bjapan\b|\bjapanese\b/i, 'JP'],
    [/\bsingapore\b/i, 'SG'],
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
  if (/\bair.?freight\b|\bair.?cargo\b/i.test(lower)) services.push('AIR');
  if (/\bsea.?freight\b|\bocean.?freight\b/i.test(lower)) services.push('SEA');
  if (/\brail\b|\brailway/i.test(lower)) services.push('RAIL');
  if (/\bcustoms\b|\bclearance/i.test(lower)) services.push('CUSTOMS');
  if (/\bwarehousing\b|\bstorage/i.test(lower)) services.push('WAREHOUSING');
  return services;
}

function extractContact(content: string, url: string): { email?: string; phone?: string; linkedin?: string } {
  const contact: { email?: string; phone?: string; linkedin?: string } = {};
  const emailMatch = content.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) contact.email = emailMatch[0];
  const phoneMatch = content.match(/\+[\d\s()-]{8,20}/);
  if (phoneMatch) contact.phone = phoneMatch[0].trim();
  const linkedinMatch = content.match(/linkedin\.com\/company\/[\w-]+/);
  if (linkedinMatch) contact.linkedin = `https://www.${linkedinMatch[0]}`;
  return contact;
}
