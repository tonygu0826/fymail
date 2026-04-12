/**
 * SearXNG search integration — 支持分页，最大化结果数量
 */

export interface SearxngCompanyResult {
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
  source: 'searxng';
  confidence: number;
}

/**
 * 搜索并自动翻页，获取更多结果
 */
export async function searchWithSearxng(
  options: { query: string; limit?: number; pages?: number }
): Promise<SearxngCompanyResult[]> {
  const { query, limit = 30, pages = 2 } = options;
  const baseUrl = process.env.SEARXNG_URL || 'http://localhost:8888';

  const allResults: SearxngCompanyResult[] = [];
  const seenUrls = new Set<string>();

  for (let page = 1; page <= pages; page++) {
    try {
      const searchQuery = `${query} freight forwarder logistics company`;
      const url = `${baseUrl}/search?q=${encodeURIComponent(searchQuery)}&format=json&categories=general&pageno=${page}`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (page === 1) throw new Error(`SearXNG HTTP ${response.status}`);
        break; // 翻页失败就停
      }

      const data = await response.json();
      const rawResults = data.results || [];
      if (rawResults.length === 0) break;

      for (const item of rawResults) {
        const title = item.title || '';
        const link = item.url || '';
        const snippet = item.content || '';

        if (!link || seenUrls.has(link)) continue;

        // 宽松的相关性过滤
        const text = `${title} ${snippet}`.toLowerCase();
        const keywords = [
          'freight', 'forwarding', 'logistics', 'shipping', 'cargo',
          'transport', 'warehouse', 'supply chain', 'forwarder',
          'spedition', 'logistik', 'fret', 'trasporto', 'transporte',
          'expediteur', 'spediteur', 'carrier', 'broker', 'clearance',
          'customs', 'import', 'export', 'container', 'lcl', 'fcl',
        ];
        const isRelevant = keywords.some(kw => text.includes(kw));
        if (!isRelevant) continue;

        // 跳过搜索引擎自身
        if (/google\.com|bing\.com|duckduckgo\.com|yahoo\.com|baidu\.com/.test(link)) continue;
        // 跳过社交/百科
        if (/wikipedia\.org|facebook\.com|twitter\.com|youtube\.com|linkedin\.com\/(?!company)/.test(link)) continue;

        seenUrls.add(link);

        let name = title.split(/[-–—:|·]/)[0].trim();
        if (name.length > 80) name = title.substring(0, 80) + '…';

        const country = detectCountry(title + ' ' + snippet);
        const services = detectServices(snippet);

        // 提取邮箱和电话
        const emailMatch = snippet.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
        const phoneMatch = snippet.match(/\+[\d\s()-]{8,20}/);

        allResults.push({
          name,
          website: link,
          description: snippet || undefined,
          country,
          services: services.length > 0 ? services : undefined,
          contact: (emailMatch || phoneMatch) ? {
            email: emailMatch?.[0],
            phone: phoneMatch?.[0]?.trim(),
          } : undefined,
          source: 'searxng',
          confidence: 0.85 - (page - 1) * 0.05, // 第二页稍低
        });

        if (allResults.length >= limit) break;
      }
    } catch (error) {
      if (page === 1) throw error;
      // 翻页失败不抛异常
      break;
    }
  }

  console.log(`[searxng] "${query}" → ${allResults.length} results (${pages} pages)`);
  return allResults;
}

function detectCountry(text: string): string | undefined {
  const patterns: [RegExp, string][] = [
    [/\bgermany\b|\bgerman\b|\bdeutschland\b/i, 'DE'],
    [/\bfrance\b|\bfrench\b|\bfrançais\b/i, 'FR'],
    [/\bnetherlands\b|\bdutch\b|\bholland\b|\bnederland\b/i, 'NL'],
    [/\bbelgium\b|\bbelgian\b|\bbelgië\b/i, 'BE'],
    [/\bitaly\b|\bitalian\b|\bitalia\b/i, 'IT'],
    [/\bspain\b|\bspanish\b|\bespaña\b/i, 'ES'],
    [/\bunited kingdom\b|\bbritain\b|\b\.uk\b/i, 'GB'],
    [/\bswitzerland\b|\bswiss\b|\bschweiz\b/i, 'CH'],
    [/\baustria\b|\bösterreich\b/i, 'AT'],
    [/\bpoland\b|\bpolish\b|\bpolska\b/i, 'PL'],
    [/\bdenmark\b|\bdanish\b|\bdanmark\b/i, 'DK'],
    [/\bsweden\b|\bswedish\b|\bsverige\b/i, 'SE'],
    [/\bnorway\b|\bnorwegian\b|\bnorge\b/i, 'NO'],
    [/\bfinland\b|\bfinnish\b|\bsuomi\b/i, 'FI'],
    [/\bczech\b|\bčesko\b/i, 'CZ'],
    [/\bhungary\b|\bmagyar\b/i, 'HU'],
    [/\bromania\b|\bromânia\b/i, 'RO'],
    [/\bbulgaria\b/i, 'BG'],
    [/\bcroatia\b|\bhrvatska\b/i, 'HR'],
    [/\bslovenia\b/i, 'SI'],
    [/\bserbia\b/i, 'RS'],
    [/\blithuania\b/i, 'LT'],
    [/\blatvia\b/i, 'LV'],
    [/\bestonia\b/i, 'EE'],
    [/\bireland\b|\béire\b/i, 'IE'],
    [/\bportugal\b/i, 'PT'],
    [/\bgreece\b|\bgreek\b/i, 'GR'],
    [/\bturkey\b|\btürkiye\b/i, 'TR'],
    [/\brussia\b|\bросси\b/i, 'RU'],
    [/\bukraine\b/i, 'UA'],
    [/\busa\b|\bunited states\b|\bamerica\b/i, 'US'],
    [/\bchina\b|\bchinese\b/i, 'CN'],
    [/\bindia\b|\bindian\b/i, 'IN'],
    [/\bcanada\b|\bcanadian\b|\bmontreal\b|\btoronto\b/i, 'CA'],
    [/\bjapan\b|\bjapanese\b/i, 'JP'],
    [/\bsingapore\b/i, 'SG'],
    [/\baustralia\b/i, 'AU'],
    [/\bbrazil\b/i, 'BR'],
    [/\bmexico\b/i, 'MX'],
    [/\bsouth africa\b/i, 'ZA'],
    [/\bvietnam\b/i, 'VN'],
    [/\bthai\b|\bthailand\b/i, 'TH'],
    [/\bmalaysia\b/i, 'MY'],
    [/\bindonesia\b/i, 'ID'],
    [/\bphilippines\b/i, 'PH'],
  ];
  for (const [p, code] of patterns) {
    if (p.test(text)) return code;
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
  if (/\brail\b|\brailway\b/i.test(lower)) services.push('RAIL');
  if (/\bcustoms\b|\bclearance\b/i.test(lower)) services.push('CUSTOMS');
  if (/\bwarehousing\b|\bstorage\b/i.test(lower)) services.push('WAREHOUSING');
  return services;
}
