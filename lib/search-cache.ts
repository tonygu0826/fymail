import { prisma } from '@/lib/db';
import { ensureDefaultOperator } from '@/lib/mvp-data';

export async function saveSearchResult(
  searchId: string,
  query: string,
  filters: Record<string, unknown> | null,
  companies: unknown[],
  metadata: { source?: string; realTimeSuccess?: boolean }
) {
  const owner = await ensureDefaultOperator();
  await prisma.searchResult.upsert({
    where: { searchId },
    update: {
      companies: companies as any,
      totalResults: companies.length,
      source: metadata.source || 'local_dataset',
      realTimeSuccess: metadata.realTimeSuccess || false,
    },
    create: {
      searchId,
      query: query || '',
      filters: filters as any,
      companies: companies as any,
      totalResults: companies.length,
      source: metadata.source || 'local_dataset',
      realTimeSuccess: metadata.realTimeSuccess || false,
      ownerId: owner.id,
    },
  });
}

export async function getSearchResult(searchId: string) {
  const result = await prisma.searchResult.findUnique({
    where: { searchId },
  });
  if (!result) return null;
  return {
    companies: result.companies as unknown[],
    metadata: {
      source: result.source,
      realTimeSuccess: result.realTimeSuccess,
      query: result.query,
    },
  };
}

export async function getCompanyFromSearch(searchId: string, companyId: string) {
  const result = await getSearchResult(searchId);
  if (!result) return null;
  const companies = result.companies as any[];
  return companies.find((c: any) =>
    c.dedupe_key === companyId ||
    c.company_name === companyId ||
    c.name === companyId ||
    c.id === companyId
  ) || null;
}

export async function getSearchHistory(limit = 20) {
  return prisma.searchResult.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      searchId: true,
      query: true,
      filters: true,
      totalResults: true,
      source: true,
      realTimeSuccess: true,
      createdAt: true,
    },
  });
}
