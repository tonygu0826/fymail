import { NextRequest, NextResponse } from 'next/server';
import {
  getMarketSnapshot,
  snapshotToTrends,
  rotatePreviousSnapshot,
  type TrendDataOutput,
  type MarketSnapshot,
} from '@/lib/market-data-scraper';

/**
 * GET /api/intelligence/trends
 *
 * Returns real market data from 4 sources:
 *   1. Drewry WCI — weekly container freight index
 *   2. All-Forward AFX — daily container rates
 *   3. Baltic Dry Index — daily
 *   4. Eurostat — EU trade volume & port throughput
 *
 * Query params:
 *   region  — EUROPE (default) | GERMANY | NETHERLANDS | FRANCE | UK | BELGIUM
 *   timeframe — MONTH | QUARTER | YEAR (currently informational)
 *   refresh — "true" to force re-fetch
 */

// Region → route keywords for filtering freight rates
const REGION_ROUTES: Record<string, string[]> = {
  EUROPE:      [],  // show all
  GERMANY:     ['Germany', 'Hamburg', 'Bremerhaven'],
  NETHERLANDS: ['Netherlands', 'Rotterdam'],
  FRANCE:      ['France', 'Le Havre', 'Marseille'],
  UK:          ['UK', 'Felixstowe', 'London'],
  BELGIUM:     ['Belgium', 'Antwerp'],
};

function filterByRegion(trends: TrendDataOutput[], region: string): TrendDataOutput[] {
  if (region === 'EUROPE' || !REGION_ROUTES[region]) return trends;

  const keywords = REGION_ROUTES[region];
  return trends.filter(t => {
    // Always include BDI, EU trade indices, and port data
    if (['BDI', 'EU_EXPORT_INDEX', 'EU_IMPORT_INDEX', 'EU_PORT_THROUGHPUT'].includes(t.metric)) return true;
    // Filter freight rates by route keyword match
    return keywords.some(kw => t.name.toLowerCase().includes(kw.toLowerCase()));
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = (searchParams.get('region') || 'EUROPE').toUpperCase();
    const timeframe = (searchParams.get('timeframe') || 'MONTH').toUpperCase();
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Fetch real market data (cached 6h)
    const snapshot: MarketSnapshot = await getMarketSnapshot(forceRefresh);

    // Rotate previous snapshot for change tracking
    if (forceRefresh) {
      rotatePreviousSnapshot();
    }

    // Convert to frontend TrendData format
    let trends = snapshotToTrends(snapshot);

    // Filter by region
    trends = filterByRegion(trends, region);

    // Build source summary
    const sources = [
      ...new Set([
        ...snapshot.freightRates.map(r => r.source),
        ...snapshot.indices.map(i => i.source),
        ...snapshot.tradeVolumes.map(t => t.source),
        ...(snapshot.ports.length > 0 ? ['Eurostat'] : []),
      ]),
    ];

    return NextResponse.json({
      trends,
      summary: {
        region,
        timeframe,
        generatedAt: snapshot.fetchedAt,
        sources,
        realtime: true,
        dataPoints: {
          freightRates: snapshot.freightRates.length,
          indices: snapshot.indices.length,
          tradeVolumes: snapshot.tradeVolumes.length,
          ports: snapshot.ports.length,
        },
        errors: snapshot.errors.length > 0 ? snapshot.errors : undefined,
        note: '数据来源: Drewry WCI (周更), All-Forward AFX (日更), Baltic Exchange BDI (日更), Eurostat (季/年)',
      },
      // Include raw port data for region-specific views
      ports: snapshot.ports.slice(0, 5).map(p => ({
        name: p.port,
        country: p.country,
        tonnage: p.tonnage,
        period: p.period,
      })),
    });
  } catch (error) {
    console.error('Trends API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market trends', details: (error as Error).message },
      { status: 500 },
    );
  }
}
