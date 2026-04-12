import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ensureDefaultOperator } from '@/lib/mvp-data';

/**
 * POST /api/deep-search/[taskId]/import — 将搜索结果导入联系人系统
 *
 * Body:
 * {
 *   companyIds?: string[]   // 指定要导入的公司ID，不传则导入全部有邮箱的
 *   tags?: string[]         // 额外标签
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  try {
    const body = await request.json().catch(() => ({}));
    const companyIds: string[] | undefined = body.companyIds;
    const extraTags: string[] = body.tags || [];

    // 确认任务存在
    const task = await prisma.deepSearchTask.findUnique({
      where: { id: taskId },
      select: { id: true, status: true },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // 查询要导入的公司（必须有邮箱）
    const where: any = { taskId, email: { not: null } };
    if (companyIds?.length) {
      where.id = { in: companyIds };
    }

    const companies = await prisma.deepSearchCompany.findMany({
      where,
      orderBy: { confidence: 'desc' },
    });

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        data: { imported: 0, skipped: 0, errors: [], message: '没有可导入的公司（需要有邮箱）' },
      });
    }

    const owner = await ensureDefaultOperator();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const company of companies) {
      if (!company.email) continue;

      // 构建标签
      const tags: string[] = [
        'deep-search',
        ...(company.services || []).map(s => s.toLowerCase()),
        ...(company.country ? [company.country.toLowerCase()] : []),
        ...extraTags,
      ];

      // 区域映射
      const marketRegion = getMarketRegion(company.country);

      try {
        await prisma.contact.upsert({
          where: { email: company.email },
          create: {
            companyName: company.companyName,
            email: company.email,
            countryCode: company.country || 'XX',
            marketRegion,
            source: `deep-search:${company.source}`,
            status: 'NEW',
            priority: Math.max(7, Math.round(company.confidence * 10)),
            score: company.confidence,
            tags: [...new Set(tags)] as Prisma.InputJsonValue,
            notes: buildNotes(company),
            ownerId: owner.id,
          },
          update: {
            // 如果联系人已存在，追加标签和更新 notes，不覆盖其他字段
            tags: [...new Set(tags)] as Prisma.InputJsonValue,
            notes: buildNotes(company),
            score: { set: Math.max(company.confidence) },
          },
        });
        imported++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          skipped++;
        } else {
          errors.push(`${company.companyName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        total: companies.length,
        errors,
        message: `成功导入 ${imported} 个联系人${skipped > 0 ? `，${skipped} 个已存在被跳过` : ''}`,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'IMPORT_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    }, { status: 500 });
  }
}

function getMarketRegion(country: string | null): string | undefined {
  if (!country) return undefined;
  const regions: Record<string, string> = {
    DE: 'DACH', AT: 'DACH', CH: 'DACH',
    NL: 'Benelux', BE: 'Benelux', LU: 'Benelux',
    FR: 'Western Europe', GB: 'Western Europe', IE: 'Western Europe',
    IT: 'Southern Europe', ES: 'Southern Europe', PT: 'Southern Europe', GR: 'Southern Europe',
    DK: 'Nordics', SE: 'Nordics', NO: 'Nordics', FI: 'Nordics',
    PL: 'Eastern Europe', CZ: 'Eastern Europe', HU: 'Eastern Europe',
    RO: 'Eastern Europe', BG: 'Eastern Europe', SK: 'Eastern Europe',
    HR: 'Eastern Europe', SI: 'Eastern Europe',
    LT: 'Baltics', LV: 'Baltics', EE: 'Baltics',
  };
  return regions[country];
}

function buildNotes(company: any): string {
  const lines: string[] = [];
  if (company.description) lines.push(company.description);
  if (company.website) lines.push(`官网: ${company.website}`);
  if (company.phone) lines.push(`电话: ${company.phone}`);
  if (company.contactPageUrl) lines.push(`联系页: ${company.contactPageUrl}`);
  if (company.services?.length) lines.push(`服务: ${company.services.join(', ')}`);
  lines.push(`来源: ${company.source} | 置信度: ${(company.confidence * 100).toFixed(0)}%`);
  return lines.join('\n');
}
