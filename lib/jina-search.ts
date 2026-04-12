/**
 * Jina Search API integration for freight forwarder company search.
 * Free tier: no API key required for basic usage.
 * s.jina.ai returns search results in structured JSON format.
 * Docs: https://jina.ai/reader
 */

export interface JinaCompanyResult {
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
  source: 'jina';
  confidence: number;
}

export interface JinaSearchOptions {
  query: string;
  limit?: number;
}

export async function searchWithJina(
  options: JinaSearchOptions
): Promise<JinaCompanyResult[]> {
  const { query, limit = 10 } = options;

  console.log(`[jina-search] Starting Jina search for: "${query}"`);

  try {
    const searchQuery = `${query} freight forwarder logistics company`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Return-Format': 'json',
    };

    // Use API key for higher rate limits
    if (process.env.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const response = await fetch(`https://s.jina.ai/${encodeURIComponent(searchQuery)}`, {
      headers,
      signal: AbortSignal.timeout(30000), // 30s timeout for Jina
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[jina-search] Jina API error: ${response.status} ${errorBody.substring(0, 200)}`);
      throw new Error(`Jina API ${response.status}`);
    }

    const data = await response.json();
    const results = parseJinaResults(data, limit);

    console.log(`[jina-search] Jina returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error('[jina-search] Jina search failed:', error);
    return [];
  }
}

function parseJinaResults(data: any, limit: number): JinaCompanyResult[] {
  const companies: JinaCompanyResult[] = [];

  // Jina returns { data: [ { title, url, content, description } ] }
  const items = data?.data || [];

  for (const item of items) {
    if (companies.length >= limit) break;

    const title = item.title || '';
    const url = item.url || '';
    const content = item.content || item.description || '';

    const combined = (title + ' ' + content).toLowerCase();
    const keywords = ['freight', 'forwarding', 'logistics', 'shipping', 'cargo', 'transport', 'lcl', 'fcl', 'forwarder'];
    const isRelevant = keywords.some(kw => combined.includes(kw));
    if (!isRelevant) continue;

    let name = title.split(/[-–—:|·]/)[0].trim();
    if (name.length > 80) name = name.substring(0, 80) + '...';
    if (!name) continue;

    const country = detectCountry(title + ' ' + content);
    const services = detectServices(content);
    const contact = extractContact(content);

    companies.push({
      name,
      website: url || undefined,
      description: content ? content.substring(0, 200) : undefined,
      country,
      services: services.length > 0 ? services : undefined,
      contact: (contact.email || contact.phone || contact.linkedin) ? contact : undefined,
      source: 'jina',
      confidence: 0.75,
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

function extractContact(content: string): { email?: string; phone?: string; linkedin?: string } {
  const contact: { email?: string; phone?: string; linkedin?: string } = {};
  const emailMatch = content.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) contact.email = emailMatch[0];
  const phoneMatch = content.match(/\+[\d\s()-]{8,20}/);
  if (phoneMatch) contact.phone = phoneMatch[0].trim();
  const linkedinMatch = content.match(/linkedin\.com\/company\/[\w-]+/);
  if (linkedinMatch) contact.linkedin = `https://www.${linkedinMatch[0]}`;
  return contact;
}
