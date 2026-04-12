import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startDeepSearch, type DeepSearchConfig } from '@/lib/deep-search/orchestrator';

const DEFAULT_OWNER_ID = 'cmn47vjzp0000wmr67ypp6zyz';

/**
 * GET /api/deep-search — 列出所有任务
 */
export async function GET() {
  const tasks = await prisma.deepSearchTask.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      config: true,
      progress: true,
      totalCompanies: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: tasks });
}

/**
 * POST /api/deep-search — 启动新的深度搜索任务
 *
 * Body (全部可选):
 * {
 *   countries?: string[],       // 国家代码 e.g. ["DE","NL","FR"]
 *   customQueries?: string[],   // 自定义搜索词
 *   resultsPerQuery?: number,   // 每次搜索返回数量，默认20
 *   enableScraping?: boolean,   // 是否爬取官网，默认true
 *   scrapeConcurrency?: number, // 爬取并发，默认3
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const config: DeepSearchConfig = {
      countries: body.countries,
      customQueries: body.customQueries,
      resultsPerQuery: body.resultsPerQuery ?? 20,
      enableScraping: body.enableScraping ?? true,
      scrapeConcurrency: body.scrapeConcurrency ?? 3,
      scrapeDelayMs: body.scrapeDelayMs ?? 1500,
    };

    const taskId = await startDeepSearch(DEFAULT_OWNER_ID, config);

    return NextResponse.json({
      success: true,
      data: { taskId },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'DEEP_SEARCH_START_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    }, { status: 500 });
  }
}
