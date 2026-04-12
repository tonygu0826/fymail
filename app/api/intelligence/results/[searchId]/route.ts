import { NextRequest, NextResponse } from 'next/server';
import { getSearchResult } from '@/lib/search-cache';

export async function GET(
  request: NextRequest,
  { params }: { params: { searchId: string } }
) {
  try {
    const searchId = params.searchId;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const result = await getSearchResult(searchId);

    if (!result || !(result.companies as any[]).length) {
      return NextResponse.json({
        searchId,
        total: 0,
        page,
        limit,
        companies: [],
        error: 'Search results expired or not found',
        source: 'cache_miss',
      });
    }

    const companies = result.companies as any[];
    const start = (page - 1) * limit;
    const paginated = companies.slice(start, start + limit);

    return NextResponse.json({
      searchId,
      total: companies.length,
      page,
      limit,
      companies: paginated,
      source: result.metadata.source || 'database',
      realTimeSuccess: result.metadata.realTimeSuccess || false,
    });
  } catch (error) {
    console.error('Results API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results', details: (error as Error).message },
      { status: 500 }
    );
  }
}
