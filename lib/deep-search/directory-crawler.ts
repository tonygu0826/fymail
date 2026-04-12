/**
 * 行业目录爬虫
 * 直接从货代行业目录、黄页、协会网站提取公司列表
 */

import * as cheerio from 'cheerio';
import { USER_AGENTS } from './constants';
import { extractDomain } from './dedup';

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

interface DirectoryCompany {
  companyName: string;
  website?: string;
  domain?: string;
  country?: string;
  services?: string[];
  description?: string;
  email?: string;
  phone?: string;
  source: string;
  confidence: number;
}

/**
 * 爬取目录页面，提取公司信息
 */
export async function scrapeDirectoryPage(
  url: string,
  defaultCountry?: string
): Promise<DirectoryCompany[]> {
  const companies: DirectoryCompany[] = [];

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`[directory-crawler] ${url} returned ${response.status}`);
      return [];
    }

    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    // 策略 1: 从链接中提取公司
    const seenDomains = new Set<string>();

    // 查找所有外部链接（可能是公司网站）
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (!text || text.length < 3 || text.length > 100) return;
      if (!href.startsWith('http')) return;

      // 跳过同域链接和常见非公司链接
      try {
        const linkHost = new URL(href).hostname.replace(/^www\./, '');
        const pageHost = new URL(url).hostname.replace(/^www\./, '');
        if (linkHost === pageHost) return;

        // 跳过社交媒体、搜索引擎等
        const skipDomains = [
          'google.com', 'facebook.com', 'twitter.com', 'linkedin.com',
          'youtube.com', 'instagram.com', 'wikipedia.org', 'amazon.com',
          'github.com', 'reddit.com', 'bing.com', 'yahoo.com',
          'apple.com', 'microsoft.com', 'cloudflare.com',
        ];
        if (skipDomains.some(d => linkHost.includes(d))) return;

        if (seenDomains.has(linkHost)) return;
        seenDomains.add(linkHost);

        // 检查文本是否像公司名
        const lowerText = text.toLowerCase();
        if (lowerText.includes('privacy') || lowerText.includes('cookie') ||
            lowerText.includes('terms') || lowerText.includes('login') ||
            lowerText.includes('sign up') || lowerText.includes('read more') ||
            lowerText.includes('click here') || lowerText.includes('learn more')) return;

        // 获取周围文本作为描述
        const parent = $(el).parent();
        const parentText = parent.text().trim().substring(0, 200);

        // 检测服务类型
        const services: string[] = [];
        const context = (text + ' ' + parentText).toLowerCase();
        if (/\blcl\b|less.than.container/i.test(context)) services.push('LCL');
        if (/\bfcl\b|full.container/i.test(context)) services.push('FCL');
        if (/\bair.?freight\b|\bair.?cargo\b/i.test(context)) services.push('AIR');
        if (/\bsea.?freight\b|\bocean.?freight\b/i.test(context)) services.push('SEA');
        if (/\bcustoms\b|\bclearance\b/i.test(context)) services.push('CUSTOMS');
        if (/\bwarehousing\b|\bstorage\b/i.test(context)) services.push('WAREHOUSING');

        // 检测国家
        let country = defaultCountry;
        if (!country) {
          country = detectCountryFromText(parentText);
        }

        // 提取邮箱
        const emailMatch = parentText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
        const phoneMatch = parentText.match(/\+[\d\s()-]{8,20}/);

        companies.push({
          companyName: text.split(/[-–—:|·]/)[0].trim().substring(0, 80),
          website: href,
          domain: linkHost,
          country,
          services: services.length > 0 ? services : undefined,
          description: parentText !== text ? parentText.substring(0, 200) : undefined,
          email: emailMatch?.[0],
          phone: phoneMatch?.[0]?.trim(),
          source: 'directory',
          confidence: 0.7,
        });
      } catch {
        // skip invalid URLs
      }
    });

    // 策略 2: 查找结构化列表（表格、列表等）
    $('table tr, .member, .company, .listing, [class*="member"], [class*="company"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 5 || text.length > 500) return;

      // 尝试从行中提取公司名和网站
      const link = $(el).find('a[href^="http"]').first();
      const href = link.attr('href') || '';
      let name = link.text().trim() || text.split('\n')[0].trim();

      if (!name || name.length < 3) return;
      name = name.split(/[-–—:|·]/)[0].trim().substring(0, 80);

      if (href) {
        try {
          const domain = new URL(href).hostname.replace(/^www\./, '');
          if (seenDomains.has(domain)) return;
          seenDomains.add(domain);

          const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
          const phoneMatch = text.match(/\+[\d\s()-]{8,20}/);

          companies.push({
            companyName: name,
            website: href,
            domain,
            country: defaultCountry || detectCountryFromText(text),
            description: text.substring(0, 200),
            email: emailMatch?.[0],
            phone: phoneMatch?.[0]?.trim(),
            source: 'directory',
            confidence: 0.75,
          });
        } catch {}
      }
    });

    console.log(`[directory-crawler] ${url} → ${companies.length} companies`);
  } catch (err) {
    console.warn(`[directory-crawler] Failed to scrape ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return companies;
}

function detectCountryFromText(text: string): string | undefined {
  const patterns: [RegExp, string][] = [
    [/\bgermany\b|\bgerman\b|\bdeutschland\b/i, 'DE'],
    [/\bfrance\b|\bfrench\b/i, 'FR'],
    [/\bnetherlands\b|\bdutch\b|\bholland\b/i, 'NL'],
    [/\bbelgium\b|\bbelgian\b/i, 'BE'],
    [/\bitaly\b|\bitalian\b/i, 'IT'],
    [/\bspain\b|\bspanish\b/i, 'ES'],
    [/\bunited kingdom\b|\bbritain\b|\buk\b/i, 'GB'],
    [/\bswitzerland\b|\bswiss\b/i, 'CH'],
    [/\baustria\b/i, 'AT'],
    [/\bpoland\b|\bpolish\b/i, 'PL'],
    [/\bdenmark\b/i, 'DK'],
    [/\bsweden\b/i, 'SE'],
    [/\bnorway\b/i, 'NO'],
    [/\bfinland\b/i, 'FI'],
    [/\bchina\b/i, 'CN'],
    [/\bindia\b/i, 'IN'],
    [/\bturkey\b|\btürkiye\b/i, 'TR'],
    [/\brussia\b/i, 'RU'],
  ];
  for (const [p, code] of patterns) {
    if (p.test(text)) return code;
  }
  return undefined;
}
