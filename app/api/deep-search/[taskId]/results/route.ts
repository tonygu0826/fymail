import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/deep-search/[taskId]/results — 获取搜索结果列表
 *
 * Query params:
 *   country  — 按国家过滤 e.g. ?country=DE
 *   hasEmail — 仅有邮箱的 e.g. ?hasEmail=true
 *   page     — 页码，默认1
 *   limit    — 每页数量，默认50
 */
export async function GET(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  const url = new URL(request.url);
  const country = url.searchParams.get('country');
  const hasEmail = url.searchParams.get('hasEmail') === 'true';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

  // 确认任务存在
  const task = await prisma.deepSearchTask.findUnique({
    where: { id: taskId },
    select: { id: true, status: true, totalCompanies: true },
  });

  if (!task) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      { status: 404 }
    );
  }

  // 构建过滤条件
  const where: any = { taskId };
  if (country) where.country = country;
  if (hasEmail) where.email = { not: null };

  const [companies, total] = await Promise.all([
    prisma.deepSearchCompany.findMany({
      where,
      orderBy: [{ confidence: 'desc' }, { companyName: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.deepSearchCompany.count({ where }),
  ]);

  // 按国家统计
  const countryStats = await prisma.deepSearchCompany.groupBy({
    by: ['country'],
    where: { taskId },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  return NextResponse.json({
    success: true,
    data: {
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: task.totalCompanies,
        withEmail: await prisma.deepSearchCompany.count({
          where: { taskId, email: { not: null } },
        }),
        byCountry: countryStats.map(s => ({
          country: s.country || 'unknown',
          count: s._count.id,
        })),
      },
    },
  });
}
