import * as cheerio from 'cheerio';
import { USER_AGENTS, CONTACT_PAGE_PATTERNS } from './constants';

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPage(url: string, timeoutMs = 15000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function findContactPageUrls(baseUrl: string, html: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    let fullUrl: string;
    try {
      fullUrl = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    // Only same-origin links
    try {
      if (new URL(fullUrl).hostname !== new URL(baseUrl).hostname) return;
    } catch {
      return;
    }

    if (seen.has(fullUrl)) return;
    if (CONTACT_PAGE_PATTERNS.some(p => p.test(fullUrl))) {
      seen.add(fullUrl);
      urls.push(fullUrl);
    }
  });

  return urls.slice(0, 4); // max 4 contact-like pages
}

export function extractEmails(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];
  const filtered = matches.filter(e => {
    const lower = e.toLowerCase();
    // Exclude common non-personal emails and image artifacts
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(lower)) return false;
    if (/^(noreply|no-reply|webmaster|postmaster|mailer-daemon|root)@/.test(lower)) return false;
    if (lower.includes('example.com') || lower.includes('sentry.io')) return false;
    return true;
  });
  return [...new Set(filtered)];
}

export function extractPhones(html: string): string[] {
  // European phone formats
  const phoneRegex = /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g;
  const matches = html.match(phoneRegex) || [];
  return [...new Set(matches.map(p => p.trim()).filter(p => p.length >= 10))].slice(0, 5);
}

export interface ScrapeResult {
  emails: string[];
  phones: string[];
  address?: string;
  contactPageUrl?: string;
}

export async function scrapeCompanyWebsite(url: string): Promise<ScrapeResult> {
  const result: ScrapeResult = { emails: [], phones: [] };

  // Fetch homepage
  const homepage = await fetchPage(url);
  if (!homepage) return result;

  // Extract from homepage
  result.emails.push(...extractEmails(homepage));
  result.phones.push(...extractPhones(homepage));

  // Extract from footer specifically (often contains email)
  const $home = cheerio.load(homepage);
  const footerHtml = $home('footer').html() || '';
  if (footerHtml) {
    result.emails.push(...extractEmails(footerHtml));
    result.phones.push(...extractPhones(footerHtml));
  }

  // Extract mailto: links
  $home('a[href^="mailto:"]').each((_, el) => {
    const href = $home(el).attr('href') || '';
    const email = href.replace('mailto:', '').split('?')[0].trim();
    if (email && email.includes('@')) result.emails.push(email);
  });

  // Find and fetch contact pages
  const contactUrls = findContactPageUrls(url, homepage);
  for (const contactUrl of contactUrls) {
    await delay(300 + Math.random() * 500);
    const page = await fetchPage(contactUrl);
    if (!page) continue;

    result.emails.push(...extractEmails(page));
    result.phones.push(...extractPhones(page));

    // Also check mailto: links on contact pages
    const $page = cheerio.load(page);
    $page('a[href^="mailto:"]').each((_, el) => {
      const href = $page(el).attr('href') || '';
      const email = href.replace('mailto:', '').split('?')[0].trim();
      if (email && email.includes('@')) result.emails.push(email);
    });

    if (!result.contactPageUrl) result.contactPageUrl = contactUrl;
  }

  // Deduplicate
  result.emails = [...new Set(result.emails)].slice(0, 10);
  result.phones = [...new Set(result.phones)].slice(0, 5);

  // Pick best email: prefer info@, sales@, contact@ over personal
  result.emails.sort((a, b) => {
    const priority = (e: string) => {
      const prefix = e.split('@')[0].toLowerCase();
      if (['info', 'sales', 'contact', 'enquiry', 'office'].some(p => prefix.includes(p))) return 0;
      return 1;
    };
    return priority(a) - priority(b);
  });

  return result;
}
