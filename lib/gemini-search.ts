/**
 * Gemini‑driven real‑time search for freight forwarder companies.
 * Uses Gemini's web search capabilities (via Google Search grounding) 
 * to find and extract structured company information.
 */

export interface GeminiCompanyResult {
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
  source: 'gemini';
  confidence: number; // 0-1
}

export interface GeminiSearchOptions {
  query: string;
  limit?: number;
  enableSearchTool?: boolean;
  fallbackToLocal?: boolean;
}

/**
 * Search for freight forwarder companies using Gemini's web search.
 * Returns structured company results extracted by Gemini.
 */
export async function searchWithGemini(
  options: GeminiSearchOptions
): Promise<GeminiCompanyResult[]> {
  const { query, limit = 10, enableSearchTool = true } = options;
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('[gemini-search] GEMINI_API_KEY not configured, skipping Gemini search');
    return [];
  }
  
  console.log(`[gemini-search] Starting Gemini search for: "${query}"`);
  
  try {
    // Use Gemini's generateContent with web search grounding
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000), // 30s timeout
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: buildPrompt(query, limit)
            }]
          }],
          // Enable web search grounding if requested
          tools: enableSearchTool ? [{ googleSearch: {} }] : undefined,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000,
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[gemini-search] Gemini API error: ${response.status} ${errorBody}`);
      throw new Error(`Gemini API ${response.status}: ${errorBody}`);
    }
    
    const data = await response.json();
    
    // Parse Gemini's response which should be a JSON array of companies
    const companies = parseGeminiResponse(data);
    
    console.log(`[gemini-search] Gemini returned ${companies.length} structured results`);
    return companies;
    
  } catch (error) {
    console.error('[gemini-search] Gemini search failed:', error);
    return []; // empty array indicates failure, caller can fallback
  }
}

/**
 * Build a prompt that instructs Gemini to perform a web search and return structured data.
 */
function buildPrompt(query: string, limit: number): string {
  return `You are a freight forwarder market intelligence assistant. Perform a web search for "${query}" and return a JSON array of freight forwarding companies that match the search.

Search requirements:
- Focus on companies that provide freight forwarding, logistics, shipping, cargo, or transport services.
- Prefer companies with explicit contact information (website, email, phone).
- Include companies from any country but prioritize those in Europe, US, China, India.

For each company, extract the following fields:
- name: company name (required)
- website: official website URL if available
- description: brief description of services (1-2 sentences)
- country: 2-letter country code (e.g., DE, US, CN) or full country name if code unknown
- services: array of service types (choose from: LCL, FCL, AIR, SEA, RAIL, CUSTOMS, WAREHOUSING, DIGITAL)
- contact: object with optional email, phone, linkedin fields
- confidence: estimated confidence score (0.0-1.0) based on information completeness

Return ONLY a valid JSON array of objects, no additional text. Maximum ${limit} companies.

Example:
[
  {
    "name": "Kuehne + Nagel",
    "website": "https://www.kuehne-nagel.com",
    "description": "Global logistics company offering sea freight, air freight, road and rail, contract logistics, and supply chain management.",
    "country": "CH",
    "services": ["LCL", "FCL", "AIR", "SEA", "RAIL", "CUSTOMS", "WAREHOUSING"],
    "contact": {
      "email": "info@kuehne-nagel.com",
      "phone": "+41 44 438 00 00",
      "linkedin": "https://linkedin.com/company/kuehne-nagel"
    },
    "confidence": 0.95
  }
]

Now search for "${query}" and return the JSON array.`;
}

/**
 * Parse Gemini's response and extract the JSON array.
 */
function parseGeminiResponse(data: Record<string, any>): GeminiCompanyResult[] {
  try {
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!text) {
      console.warn('[gemini-search] No text in Gemini response:', JSON.stringify(data).slice(0, 500));
      return [];
    }
    
    // Extract JSON from text (might be wrapped in ```json ... ```)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\[\s*{[\s\S]*}\s*\]/);
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
    
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      console.warn('[gemini-search] Parsed response is not an array:', typeof parsed);
      return [];
    }
    
    // Map to our result format
    return parsed.map((item: Record<string, any>) => ({
      name: String(item.name || ''),
      website: item.website ? String(item.website) : undefined,
      description: item.description ? String(item.description) : undefined,
      country: normalizeCountryCode(item.country),
      services: normalizeServices(item.services),
      contact: item.contact ? {
        email: item.contact.email ? String(item.contact.email) : undefined,
        phone: item.contact.phone ? String(item.contact.phone) : undefined,
        linkedin: item.contact.linkedin ? String(item.contact.linkedin) : undefined,
      } : undefined,
      source: 'gemini' as const,
      confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.7,
    }));
  } catch (error) {
    console.error('[gemini-search] Failed to parse Gemini response:', error);
    return [];
  }
}

function normalizeCountryCode(country: unknown): string | undefined {
  if (!country) return undefined;
  const str = String(country).trim().toUpperCase();
  // If it's already a 2‑letter code, return as‑is
  if (/^[A-Z]{2}$/.test(str)) return str;
  // Map common country names to codes
  const mapping: Record<string, string> = {
    'GERMANY': 'DE',
    'FRANCE': 'FR',
    'NETHERLANDS': 'NL',
    'BELGIUM': 'BE',
    'ITALY': 'IT',
    'SPAIN': 'ES',
    'UNITED KINGDOM': 'GB',
    'UK': 'GB',
    'USA': 'US',
    'UNITED STATES': 'US',
    'CHINA': 'CN',
    'INDIA': 'IN',
    'SWITZERLAND': 'CH',
    'AUSTRIA': 'AT',
    'POLAND': 'PL',
    'SWEDEN': 'SE',
    'DENMARK': 'DK',
    'NORWAY': 'NO',
    'FINLAND': 'FI',
    'RUSSIA': 'RU',
    'JAPAN': 'JP',
    'SOUTH KOREA': 'KR',
    'SINGAPORE': 'SG',
    'AUSTRALIA': 'AU',
    'CANADA': 'CA',
    'BRAZIL': 'BR',
    'MEXICO': 'MX',
  };
  const upper = str.toUpperCase();
  return mapping[upper] || str.substring(0, 2).toUpperCase();
}

function normalizeServices(services: unknown): string[] {
  if (!services) return [];
  if (Array.isArray(services)) {
    return services.map(s => String(s).trim().toUpperCase())
      .filter(s => ['LCL', 'FCL', 'AIR', 'SEA', 'RAIL', 'CUSTOMS', 'WAREHOUSING', 'DIGITAL'].includes(s));
  }
  return [];
}

/**
 * Hybrid search: use Gemini as primary, fall back to traditional web search if Gemini fails.
 */
export async function hybridSearch(
  options: GeminiSearchOptions & { fallbackToWebSearch?: boolean }
): Promise<GeminiCompanyResult[]> {
  const geminiResults = await searchWithGemini(options);
  if (geminiResults.length > 0) {
    return geminiResults;
  }
  
  // If Gemini returns nothing and fallback is allowed, callers can use other search sources.
  // This function does not implement fallback itself; the caller decides.
  return [];
}