// canflow keyword catalog — read from PG SeoKeyword table where site=canflow.

import { prisma } from "@/lib/db";

export type CanflowKeywordStats = {
  total: number;
  byStatus: Record<string, number>;
  byFunnel: Record<string, number>;
  byCategory: Record<string, number>;
  avgOpportunity: number;
  topOpportunities: Array<{
    id: string;
    keyword: string;
    opportunity: number;
    funnelPosition: string;
    intent: string;
    status: string;
    category: string;
  }>;
};

export async function getCanflowKeywordStats(): Promise<CanflowKeywordStats> {
  const all = await prisma.seoKeyword.findMany({
    where: { site: "canflow" },
    orderBy: { opportunity: "desc" },
  });

  const total = all.length;
  const byStatus: Record<string, number> = {};
  const byFunnel: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let oppSum = 0;

  for (const k of all) {
    byStatus[k.status] = (byStatus[k.status] || 0) + 1;
    byFunnel[k.funnelPosition] = (byFunnel[k.funnelPosition] || 0) + 1;
    byCategory[k.category] = (byCategory[k.category] || 0) + 1;
    oppSum += k.opportunity;
  }

  return {
    total,
    byStatus,
    byFunnel,
    byCategory,
    avgOpportunity: total === 0 ? 0 : Math.round(oppSum / total),
    topOpportunities: all.slice(0, 10).map((k) => ({
      id: k.id,
      keyword: k.keyword,
      opportunity: k.opportunity,
      funnelPosition: k.funnelPosition,
      intent: k.intent,
      status: k.status,
      category: k.category,
    })),
  };
}

export type AvailableCanflowKeyword = {
  id: string;
  keyword: string;
  opportunity: number;
  funnel: string;
  intent: string;
  category: string;
};

export async function fetchAvailableCanflowKeywords(
  limit: number,
  minOpportunity = 90,
): Promise<AvailableCanflowKeyword[]> {
  const rows = await prisma.seoKeyword.findMany({
    where: {
      site: "canflow",
      status: { in: ["discovered", "approved"] },
      opportunity: { gte: minOpportunity },
    },
    orderBy: [{ opportunity: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      keyword: true,
      opportunity: true,
      funnelPosition: true,
      intent: true,
      category: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    opportunity: r.opportunity,
    funnel: r.funnelPosition,
    intent: r.intent,
    category: r.category,
  }));
}

export async function markCanflowKeywordPublished(keywordId: string, slug: string) {
  await prisma.seoKeyword.update({
    where: { id: keywordId },
    data: {
      status: "published",
      relatedSlug: slug,
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  });
}

export async function getCanflowKeywordCoverage() {
  const all = await prisma.seoKeyword.findMany({ where: { site: "canflow" } });
  const total = all.length;
  const published = all.filter((k) => k.status === "published").length;
  const unused = all.filter((k) => k.status === "discovered" || k.status === "approved").length;
  const topFunnel = all.filter((k) => k.funnelPosition === "top").length;
  const bottomFunnel = all.filter((k) => k.funnelPosition === "bottom").length;
  return {
    totalKeywords: total,
    publishedKeywords: published,
    unusedKeywords: unused,
    topFunnelCoverage: total === 0 ? 0 : Math.round((topFunnel / total) * 100),
    bottomFunnelCoverage: total === 0 ? 0 : Math.round((bottomFunnel / total) * 100),
  };
}
