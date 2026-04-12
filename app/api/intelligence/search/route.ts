import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { searchRealTime } from '@/lib/realtime-search';
import { saveSearchResult } from '@/lib/search-cache';

// Wrapper with timeout to prevent hanging
async function searchRealTimeWithTimeout(options: Parameters<typeof searchRealTime>[0], timeoutMs = 5000) {
  console.log(`[search] searchRealTimeWithTimeout called, timeout ${timeoutMs}ms`);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      console.warn(`[search] Real‑time search timed out after ${timeoutMs}ms`);
      reject(new Error(`Real‑time search timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([searchRealTime(options), timeoutPromise]);
    console.log(`[search] searchRealTimeWithTimeout succeeded with ${Array.isArray(result) ? result.length : '?'} results`);
    return result;
  } catch (error) {
    console.warn(`[search] searchRealTimeWithTimeout caught error: ${error}`);
    throw error; // Let caller handle fallback
  }
}


export async function POST(request: NextRequest) {
  console.log('[search] POST request received', new Date().toISOString());
  try {
    const body = await request.json();
    // Support both formats: frontend sends { query, filters: { countries, services, companySize }, page, limit }
    // Legacy format: { query, countries, services, companySize, page, limit }
    let { query, page = 1, limit = 20 } = body;
    let countries: string[] = [];
    let services: string[] = [];
    let companySize: string[] = [];
    
    if (body.filters && typeof body.filters === 'object') {
      countries = body.filters.countries || [];
      services = body.filters.services || [];
      companySize = body.filters.companySize || [];
    } else {
      countries = body.countries || [];
      services = body.services || [];
      companySize = body.companySize || [];
    }
    
    // Generate search ID
    const searchId = `search-${Date.now()}`;
    let companies: any[] = [];
    let source = 'local_dataset';
    let realTimeSuccess = false;
    
    // Attempt real‑time web search if query is provided (non‑empty)
    if (query && query.trim()) {
      try {
        console.log(`[search] Attempting real‑time search for query: "${query}"`);
        const realTimeResults = await searchRealTimeWithTimeout({
          query: query.trim(),
          limit: limit * 2, // fetch extra for filtering
          useGemini: !!process.env.GEMINI_API_KEY,
          useGoogle: !!process.env.GOOGLE_SEARCH_API_KEY,
          useBing: !!process.env.BING_SEARCH_API_KEY,
          allowFallback: false, // we handle fallback ourselves
        }, 30000);
        
        if (realTimeResults.length > 0) {
          console.log(`[search] Real‑time search returned ${realTimeResults.length} raw results`);
          // Determine primary source based on results
          const geminiCount = realTimeResults.filter(r => r.source === 'gemini').length;
          // Count occurrences of each source
          const sourceCounts: Record<string, number> = {};
          realTimeResults.forEach(r => {
            sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
          });
          // Determine primary source: gemini if present, otherwise the source with highest count
          let primarySource = 'realtime';
          if (geminiCount > 0) {
            primarySource = 'gemini';
          } else {
            let maxCount = 0;
            for (const [src, count] of Object.entries(sourceCounts)) {
              if (count > maxCount) {
                maxCount = count;
                primarySource = src;
              }
            }
          }
          
          // Convert real‑time results to internal company format
          const mappedCompanies = realTimeResults.map((rt, idx) => {
            // Determine country label
            const countryCode = rt.country || 'EU';
            const countryLabels: Record<string, string> = {
              'DE': '德国',
              'FR': '法国',
              'NL': '荷兰',
              'BE': '比利时',
              'IT': '意大利',
              'ES': '西班牙',
              'GB': '英国',
              'US': '美国',
              'CN': '中国',
              'IN': '印度',
              'EU': '欧洲',
            };
            const countryLabel = countryLabels[countryCode] || countryCode;
            
            // Determine service labels
            const serviceLabelsMapping: Record<string, string> = {
              'LCL': 'LCL拼箱',
              'FCL': 'FCL整箱',
              'AIR': '空运',
              'SEA': '海运',
              'RAIL': '铁路',
              'CUSTOMS': '报关服务',
              'WAREHOUSING': '仓储',
            };
            const rtServices = rt.services || ['LCL']; // default LCL
            const serviceLabels = rtServices.map(s => serviceLabelsMapping[s] || s);
            
            // Generate an ID
            const id = `rt-${searchId}-${idx}`;
            
            // Estimate opportunity score based on confidence and presence of contact info
            let opportunityScore = Math.round(rt.confidence * 100);
            if (rt.contact?.email || rt.contact?.phone) opportunityScore += 10;
            if (rt.website) opportunityScore += 5;
            opportunityScore = Math.min(opportunityScore, 99);
            
            // Determine company size (guess from description)
            let size = 'MEDIUM';
            const desc = (rt.description || '').toLowerCase();
            if (desc.includes('large') || desc.includes('global') || desc.includes('leading')) size = 'LARGE';
            if (desc.includes('small') || desc.includes('startup')) size = 'SMALL';
            
            return {
              id,
              name: rt.name,
              country: countryCode,
              countryLabel,
              services: rtServices,
              serviceLabels,
              opportunityScore,
              contact: {
                email: rt.contact?.email || '',
                phone: rt.contact?.phone || '',
                website: rt.website || '',
                linkedin: rt.contact?.linkedin || '',
              },
              companySize: size,
              description: rt.description || '货运代理公司，提供物流及运输服务。',
              lastUpdated: new Date().toISOString().split('T')[0], // today
              dataSource: 'real' as const,
              contactSource: {
                email: rt.contact?.email ? 'scraped' : 'missing',
                phone: rt.contact?.phone ? 'scraped' : 'missing',
                website: rt.website ? 'search_result' : 'missing',
              },
              // Preserve original search source for transparency
              searchSource: rt.source,
            };
          });
          
          companies = mappedCompanies;
          source = primarySource; // 'gemini', 'duckduckgo', 'google', 'bing', or 'realtime'
          realTimeSuccess = true;
          console.log(`[search] Mapped ${companies.length} companies from real‑time search, primary source: ${primarySource}, source counts: ${JSON.stringify(sourceCounts)}`);
        } else {
          console.log('[search] Real‑time search returned zero results');
        }
      } catch (rtError) {
        console.warn('[search] Real‑time search failed:', rtError);
        // Continue to fallback
      }
    }
    
    // If real‑time search didn't produce results, fall back to local dataset
    if (!realTimeSuccess) {
      console.log('[search] Falling back to local dataset');
      const localDataPath = path.join(process.cwd(), 'data', 'europe_freight_companies.json');
      try {
        const data = await fs.readFile(localDataPath, 'utf-8');
        companies = JSON.parse(data);
        source = 'local_dataset';
        console.log(`[search] Loaded ${companies.length} companies from local dataset`);
      } catch (localError) {
        console.error('[search] Failed to load local dataset:', localError);
        // Fallback to mock data
        companies = [
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
        ];
        source = 'mock_fallback';
        console.log(`[search] Using ${companies.length} mock companies as fallback`);
      }
    }
    
    // Apply filters
    let filtered = companies;
    if (countries && countries.length > 0) {
      filtered = filtered.filter((c: any) => countries.includes(c.country));
    }
    if (services && services.length > 0) {
      filtered = filtered.filter((c: any) => 
        c.services.some((s: string) => services.includes(s))
      );
    }
    if (companySize && companySize.length > 0) {
      filtered = filtered.filter((c: any) => companySize.includes(c.companySize));
    }
    
    // Apply text query filter (if not already satisfied by real‑time search)
    if (query && query.trim() && !realTimeSuccess) {
      const q = query.toLowerCase().trim();
      const originalCount = filtered.length;
      filtered = filtered.filter((c: any) => 
        c.name.toLowerCase().includes(q) || 
        c.description?.toLowerCase().includes(q) ||
        c.countryLabel.toLowerCase().includes(q) ||
        c.services.some((s: string) => s.toLowerCase().includes(q))
      );
      console.log(`[search] Query filter applied: ${originalCount} -> ${filtered.length}`);
      
      // If query filtering removed all results, try to extract country/service from query
      if (filtered.length === 0 && originalCount > 0) {
        console.log(`[search] No matches with strict query, attempting keyword extraction`);
        const { countries: extractedCountries, services: extractedServices } = extractFiltersFromQuery(q);
        console.log(`[search] Extracted from query: countries=${extractedCountries}, services=${extractedServices}`);
        
        // Re-apply filters with extracted countries/services (in addition to existing filters)
        let relaxed = companies; // start from original companies before filters
        // Apply existing filters (countries, services, companySize from request)
        if (countries && countries.length > 0) {
          relaxed = relaxed.filter((c: any) => countries.includes(c.country));
        }
        if (services && services.length > 0) {
          relaxed = relaxed.filter((c: any) => 
            c.services.some((s: string) => services.includes(s))
          );
        }
        if (companySize && companySize.length > 0) {
          relaxed = relaxed.filter((c: any) => companySize.includes(c.companySize));
        }
        // Add extracted filters (OR with existing? We'll AND them)
        if (extractedCountries.length > 0) {
          relaxed = relaxed.filter((c: any) => extractedCountries.includes(c.country));
        }
        if (extractedServices.length > 0) {
          relaxed = relaxed.filter((c: any) => 
            c.services.some((s: string) => extractedServices.includes(s))
          );
        }
        filtered = relaxed;
        console.log(`[search] After relaxed filtering: ${filtered.length} companies`);
      }
      
      // If still empty, ignore query filter entirely (show all after other filters)
      if (filtered.length === 0) {
        console.log(`[search] Still empty, ignoring query filter`);
        filtered = companies;
        // Re-apply non‑query filters
        if (countries && countries.length > 0) {
          filtered = filtered.filter((c: any) => countries.includes(c.country));
        }
        if (services && services.length > 0) {
          filtered = filtered.filter((c: any) => 
            c.services.some((s: string) => services.includes(s))
          );
        }
        if (companySize && companySize.length > 0) {
          filtered = filtered.filter((c: any) => companySize.includes(c.companySize));
        }
      }
    }
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = filtered.slice(start, end);
    
    // Save search results to database for persistence
    console.log(`[search] Saving ${companies.length} companies to DB with searchId: ${searchId}`);
    try {
      await saveSearchResult(searchId, query || '', { countries, services, companySize }, companies, {
        source,
        realTimeSuccess,
      });
      console.log(`[search] DB save completed for ${searchId}`);
    } catch (cacheError) {
      console.warn(`[search] DB save failed, continuing: ${cacheError}`);
    }
    
    console.log(`[search] Returning successful response with ${paginated.length} companies, total ${filtered.length}`);
    return NextResponse.json({
      searchId,
      total: filtered.length,
      page,
      limit,
      companies: paginated,
      source,
      realTimeSuccess,
      fallbackTriggered: !realTimeSuccess,
    });
    
  } catch (error) {
    console.error('[search] Search API error:', error);
    if (error instanceof Error) {
      console.error('[search] Error stack:', error.stack);
    }
    console.log('[search] Returning error response');
    return NextResponse.json(
      { 
        error: 'Search failed', 
        details: (error as Error).message,
        stack: error instanceof Error ? error.stack : undefined,
        source: 'error',
        realTimeSuccess: false,
        fallbackTriggered: false,
      },
      { status: 500 }
    );
  }
}

// Helper functions
function mapCountryToCode(countryRegion: string): string {
  if (countryRegion.includes('Germany')) return 'DE';
  if (countryRegion.includes('Netherlands')) return 'NL';
  if (countryRegion.includes('France')) return 'FR';
  if (countryRegion.includes('Belgium')) return 'BE';
  if (countryRegion.includes('UK')) return 'UK';
  if (countryRegion.includes('Italy')) return 'IT';
  if (countryRegion.includes('Spain')) return 'ES';
  if (countryRegion.includes('Canada')) return 'CA';
  if (countryRegion.includes('Singapore')) return 'SG';
  if (countryRegion.includes('Greece')) return 'GR';
  return 'EU';
}

function extractServicesFromCompany(company: any): string[] {
  const services: string[] = [];
  const evidence = (company.business_evidence || '').toLowerCase();
  
  // Check for service keywords
  if (evidence.includes('lcl') || company.lcl_related === true) {
    services.push('LCL');
  }
  if (evidence.includes('fcl') || evidence.includes('整箱')) {
    services.push('FCL');
  }
  if (evidence.includes('air') || evidence.includes('空运')) {
    services.push('AIR');
  }
  if (evidence.includes('rail') || evidence.includes('铁路')) {
    services.push('RAIL');
  }
  if (evidence.includes('customs') || evidence.includes('报关')) {
    services.push('CUSTOMS');
  }
  if (evidence.includes('warehousing') || evidence.includes('仓储')) {
    services.push('WAREHOUSING');
  }
  
  // Default to LCL if no services detected (most companies will have LCL)
  if (services.length === 0) {
    services.push('LCL');
  }
  
  return services;
}

function mapServiceLabels(services: string[]): string[] {
  const mapping: Record<string, string> = {
    'LCL': 'LCL拼箱',
    'FCL': 'FCL整箱',
    'AIR': '空运',
    'RAIL': '铁路',
    'CUSTOMS': '报关服务',
    'WAREHOUSING': '仓储',
  };
  return services.map(s => mapping[s] || s);
}

function mapCompanySize(sizeIndicator: string): string {
  if (sizeIndicator?.toLowerCase().includes('small')) return 'SMALL';
  if (sizeIndicator?.toLowerCase().includes('medium')) return 'MEDIUM';
  if (sizeIndicator?.toLowerCase().includes('large')) return 'LARGE';
  return 'MEDIUM';
}

// Extract country codes and service keywords from Chinese query
function extractFiltersFromQuery(query: string): { countries: string[], services: string[] } {
  const countries: string[] = [];
  const services: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  // Map Chinese country names to codes
  const countryMap: Record<string, string> = {
    '德国': 'DE',
    '法国': 'FR',
    '荷兰': 'NL',
    '比利时': 'BE',
    '意大利': 'IT',
    '西班牙': 'ES',
    '英国': 'GB',
    '美国': 'US',
    '中国': 'CN',
    '印度': 'IN',
    '欧洲': 'EU',
  };
  for (const [chinese, code] of Object.entries(countryMap)) {
    if (lowerQuery.includes(chinese.toLowerCase())) {
      countries.push(code);
    }
  }
  
  // Map Chinese service keywords to service codes
  const serviceMap: Record<string, string> = {
    'lcl': 'LCL',
    '拼箱': 'LCL',
    'fcl': 'FCL',
    '整箱': 'FCL',
    '空运': 'AIR',
    '海运': 'SEA',
    '铁路': 'RAIL',
    '报关': 'CUSTOMS',
    '仓储': 'WAREHOUSING',
    '数字化': 'DIGITAL',
  };
  for (const [keyword, code] of Object.entries(serviceMap)) {
    if (lowerQuery.includes(keyword)) {
      services.push(code);
    }
  }
  
  // Also check for English service codes
  if (lowerQuery.includes('lcl')) services.push('LCL');
  if (lowerQuery.includes('fcl')) services.push('FCL');
  if (lowerQuery.includes('air')) services.push('AIR');
  if (lowerQuery.includes('sea')) services.push('SEA');
  if (lowerQuery.includes('rail')) services.push('RAIL');
  if (lowerQuery.includes('customs')) services.push('CUSTOMS');
  if (lowerQuery.includes('warehousing')) services.push('WAREHOUSING');
  if (lowerQuery.includes('digital')) services.push('DIGITAL');
  
  return { countries, services };
}