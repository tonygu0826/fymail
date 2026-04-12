import { EXCLUDED_DOMAINS, EXCLUDED_NAMES } from './constants';

export function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|ltd|bv|nv|sa|sas|ag|plc|co|inc|corp|pty|s\.r\.l|s\.p\.a|ab|as|oy|a\/s)\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isExcludedCompany(name: string, website?: string): boolean {
  if (website) {
    const domain = extractDomain(website);
    if (domain && EXCLUDED_DOMAINS.has(domain)) return true;
  }
  const normalized = normalizeCompanyName(name);
  return EXCLUDED_NAMES.has(normalized);
}

export interface CompanyCandidate {
  companyName: string;
  website?: string;
  domain?: string;
  [key: string]: unknown;
}

export function deduplicateCompanies<T extends CompanyCandidate>(companies: T[]): T[] {
  const seenDomains = new Set<string>();
  const seenNames = new Set<string>();
  const unique: T[] = [];

  for (const company of companies) {
    if (isExcludedCompany(company.companyName, company.website)) continue;

    const domain = company.domain || (company.website ? extractDomain(company.website) : null);
    if (domain) {
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);
    }

    const normalized = normalizeCompanyName(company.companyName);
    if (normalized.length > 2) {
      if (seenNames.has(normalized)) continue;
      seenNames.add(normalized);
    }

    unique.push({ ...company, domain: domain || undefined });
  }

  return unique;
}
