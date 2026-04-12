import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Baseline competitor data
const BASELINE_COMPETITORS = [
  {
    name: 'Kuehne + Nagel',
    marketPosition: 'LEADER',
    threatLevel: 'HIGH',
    opportunityScore: 35,
    services: ['LCL', 'FCL', 'AIR', 'SEA', 'RAIL', 'CUSTOMS', 'WAREHOUSING'],
    description: '全球第一大海运货代，强大的数字化平台和全球网络覆盖。',
    strengths: ['全球网络', '数字化平台', '海运规模'],
    weaknesses: ['价格较高', '大企业流程慢'],
    marketShare: '12%',
    growthRate: '3.5%',
  },
  {
    name: 'DHL Global Forwarding',
    marketPosition: 'LEADER',
    threatLevel: 'HIGH',
    opportunityScore: 30,
    services: ['LCL', 'FCL', 'AIR', 'SEA', 'CUSTOMS'],
    description: '全球最大物流公司旗下货代品牌，空运市场领导者。',
    strengths: ['品牌知名度', '空运网络', 'DHL集团资源'],
    weaknesses: ['LCL价格不具竞争力', '客户服务响应慢'],
    marketShare: '10%',
    growthRate: '2.8%',
  },
  {
    name: 'DB Schenker',
    marketPosition: 'LEADER',
    threatLevel: 'MEDIUM',
    opportunityScore: 45,
    services: ['LCL', 'FCL', 'RAIL', 'SEA'],
    description: '德国铁路旗下货代，欧洲陆运和铁路运输优势明显。',
    strengths: ['铁路运输', '欧洲陆运网络', '价格竞争力'],
    weaknesses: ['数字化转型慢', '海运规模较小'],
    marketShare: '8%',
    growthRate: '2.1%',
  },
  {
    name: 'DSV',
    marketPosition: 'CHALLENGER',
    threatLevel: 'HIGH',
    opportunityScore: 40,
    services: ['LCL', 'FCL', 'AIR', 'SEA'],
    description: '丹麦货代巨头，通过收购Panalpina和Agility GIL快速扩张。',
    strengths: ['收购整合能力', '增长速度快', '空运实力'],
    weaknesses: ['整合期间服务质量波动', '品牌统一度低'],
    marketShare: '9%',
    growthRate: '5.2%',
  },
  {
    name: 'Geodis',
    marketPosition: 'CHALLENGER',
    threatLevel: 'MEDIUM',
    opportunityScore: 55,
    services: ['LCL', 'FCL', 'CUSTOMS', 'WAREHOUSING'],
    description: '法国SNCF旗下货代，合同物流和欧洲分销能力强。',
    strengths: ['合同物流', '法国市场主导', '铁路连接'],
    weaknesses: ['全球网络覆盖有限', '数字化工具落后'],
    marketShare: '5%',
    growthRate: '3.0%',
  },
  {
    name: 'Dachser',
    marketPosition: 'FOLLOWER',
    threatLevel: 'LOW',
    opportunityScore: 65,
    services: ['LCL', 'FCL', 'SEA'],
    description: '德国家族企业，欧洲公路运输和仓储物流专家。',
    strengths: ['欧洲公路运输', '可靠服务', '家族企业稳定性'],
    weaknesses: ['海运规模小', '亚洲市场薄弱'],
    marketShare: '3%',
    growthRate: '2.5%',
  },
  {
    name: 'Hellmann Worldwide',
    marketPosition: 'FOLLOWER',
    threatLevel: 'LOW',
    opportunityScore: 70,
    services: ['LCL', 'FCL', 'AIR', 'SEA'],
    description: '德国中型货代，在中小企业市场有较好口碑。',
    strengths: ['中小企业服务', '灵活性', '德国市场深耕'],
    weaknesses: ['全球规模有限', '技术投入不足'],
    marketShare: '2%',
    growthRate: '1.8%',
  },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const service = searchParams.get('service') || 'all';

    // Try to get from database first
    let competitors: any[] = [];
    try {
      const dbCompetitors = await prisma.competitor.findMany({
        orderBy: { opportunityScore: 'desc' },
      });
      if (dbCompetitors.length > 0) {
        competitors = dbCompetitors;
      }
    } catch {
      // DB might not have the table yet
    }

    // Fall back to baseline data
    if (competitors.length === 0) {
      competitors = BASELINE_COMPETITORS;
    }

    // Filter by service if specified
    let filtered = competitors;
    if (service && service !== 'all') {
      const svc = service.toUpperCase();
      filtered = competitors.filter((c: any) =>
        (c.services || []).some((s: string) => s.toUpperCase() === svc)
      );
    }

    return NextResponse.json({
      competitors: filtered,
      summary: {
        service,
        count: filtered.length,
        generatedAt: new Date().toISOString(),
        source: competitors === BASELINE_COMPETITORS ? 'baseline_data' : 'database',
        realtime: false,
        note: '欧洲货代市场竞争对手分析',
      },
    });
  } catch (error) {
    console.error('Competitors API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitor intelligence', details: (error as Error).message },
      { status: 500 }
    );
  }
}
