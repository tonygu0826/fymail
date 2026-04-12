import { BarChart3, FileText, Key, AlertTriangle, CheckCircle, XCircle, TrendingUp, ExternalLink } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SeoActions } from "@/components/seo/SeoActions";
import { GscCharts } from "@/components/seo/GscCharts";
import { getSeoHealth, getKeywordStats, getArticles } from "@/lib/seo-api";

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-theme-secondary">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-theme-card-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-theme-heading">{score}</span>
    </div>
  );
}

export default async function SeoDashboardPage() {
  let health, keywords, articles;

  try {
    [health, keywords, articles] = await Promise.all([
      getSeoHealth(),
      getKeywordStats(),
      getArticles(),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader
          eyebrow="SEO 监控"
          title="SEO 数据看板"
          description="无法连接到 SEO 数据源。请检查 fywarehouse 服务是否运行。"
        />
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="font-semibold">连接失败</p>
          <p className="mt-2 text-sm">错误: {error instanceof Error ? error.message : "未知错误"}</p>
          <p className="mt-2 text-sm">确保设置了 SEO_API_BASE 和 SEO_API_KEY 环境变量。</p>
        </div>
      </>
    );
  }

  const o = health.overview;
  const k = health.keywordCoverage;
  const c = health.contentHealth;

  return (
    <>
      <PageHeader
        eyebrow="SEO 监控"
        title="SEO 数据看板"
        description="FENGYE LOGISTICS 官网 SEO 内容自动化系统实时监控。"
        actions={
          <Link
            href="https://fywarehouse.com/news"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl bg-theme-button px-4 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover"
          >
            查看线上新闻 <ExternalLink className="h-4 w-4" />
          </Link>
        }
      />

      {/* 操作按钮 */}
      <Panel title="快速操作" description="一键触发内容生成、刷新和关键词发现">
        <SeoActions />
      </Panel>

      {/* Google Search Console 流量数据 */}
      <Panel title="搜索流量分析" description="来自 Google Search Console 的实时搜索数据（点击量、展现量、搜索词、热门页面）">
        <GscCharts />
      </Panel>

      {/* 核心指标 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="已发布文章" value={o.publishedArticles} hint={`总计 ${o.totalArticles} 篇`} />
        <StatCard label="SEO 均分" value={o.avgSeoScore} tone={o.avgSeoScore >= 60 ? "accent" : "default"} hint="满分 100" />
        <StatCard label="新鲜度均分" value={o.avgFreshnessScore} tone={o.avgFreshnessScore >= 60 ? "accent" : "default"} hint="满分 100" />
        <StatCard label="平均字数" value={o.avgWordCount} hint="建议 800+" />
      </div>

      {/* 内容健康 + 关键词覆盖 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="内容健康度" description="文章状态分布">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-theme-body">健康</span>
              </div>
              <span className="text-lg font-semibold text-emerald-600">{c.healthy}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-theme-body">需关注</span>
              </div>
              <span className="text-lg font-semibold text-amber-600">{c.needsAttention}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-500" />
                <span className="text-sm text-theme-body">严重</span>
              </div>
              <span className="text-lg font-semibold text-rose-600">{c.critical}</span>
            </div>
            {o.articlesNeedingRefresh > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {o.articlesNeedingRefresh} 篇文章需要刷新
              </p>
            )}
          </div>
        </Panel>

        <Panel title="关键词覆盖" description="关键词库使用情况">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-theme-body">关键词总数</span>
              <span className="font-semibold text-theme-heading">{k.totalKeywords}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-theme-body">已发布</span>
              <span className="font-semibold text-emerald-600">{k.publishedKeywords}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-theme-body">待使用</span>
              <span className="font-semibold text-amber-600">{k.unusedKeywords}</span>
            </div>
            <hr className="border-theme-border" />
            <ScoreBar score={k.bottomFunnelCoverage} label="BOF 覆盖" />
            <ScoreBar score={k.topFunnelCoverage} label="TOF 覆盖" />
          </div>
        </Panel>
      </div>

      {/* 关键词分类分布 */}
      <Panel title="关键词分类" description="各类别关键词数量">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(keywords.byCategory || {}).map(([cat, count]) => (
            <div key={cat} className="flex items-center justify-between rounded-xl bg-theme-card-muted px-3 py-2">
              <span className="text-sm text-theme-body">{cat}</span>
              <span className="text-sm font-semibold text-theme-heading">{count as number}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* 高机会关键词 TOP 10 */}
      <Panel title="高机会关键词 TOP 10" description="按机会分排序，优先用于内容生成">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-theme-border text-left text-xs uppercase tracking-wider text-theme-secondary">
                <th className="pb-3 pr-4">关键词</th>
                <th className="pb-3 pr-4">机会分</th>
                <th className="pb-3 pr-4">漏斗</th>
                <th className="pb-3 pr-4">意图</th>
                <th className="pb-3 pr-4">状态</th>
                <th className="pb-3">分类</th>
              </tr>
            </thead>
            <tbody>
              {(keywords.topOpportunities || []).map((kw: any) => (
                <tr key={kw.id} className="border-b border-theme-border/50">
                  <td className="py-2.5 pr-4 font-medium text-theme-heading">{kw.keyword}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${kw.opportunity >= 70 ? 'text-emerald-600' : kw.opportunity >= 50 ? 'text-amber-600' : 'text-theme-body'}`}>
                      {kw.opportunity}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusPill status={kw.funnelPosition === 'bottom' ? 'READY' : kw.funnelPosition === 'middle' ? 'SCHEDULED' : 'DRAFT'} />
                  </td>
                  <td className="py-2.5 pr-4 text-theme-body">{kw.intent}</td>
                  <td className="py-2.5 pr-4">
                    <StatusPill status={kw.status?.toUpperCase() || 'PENDING'} />
                  </td>
                  <td className="py-2.5 text-theme-body">{kw.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* 文章列表 */}
      <Panel title="文章表现" description="所有已发布文章的 SEO 评分和健康状态">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-theme-border text-left text-xs uppercase tracking-wider text-theme-secondary">
                <th className="pb-3 pr-4">标题</th>
                <th className="pb-3 pr-4">SEO</th>
                <th className="pb-3 pr-4">新鲜度</th>
                <th className="pb-3 pr-4">字数</th>
                <th className="pb-3 pr-4">内链</th>
                <th className="pb-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {health.articles.map((a) => (
                <tr key={a.slug} className="border-b border-theme-border/50">
                  <td className="py-2.5 pr-4 max-w-xs truncate">
                    <Link href={`https://fywarehouse.com/news/${a.slug}`} target="_blank" className="font-medium text-theme-heading hover:text-intelligence-accent">
                      {a.title}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${a.seoScore >= 70 ? 'text-emerald-600' : a.seoScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {a.seoScore}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${a.freshnessScore >= 70 ? 'text-emerald-600' : a.freshnessScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {a.freshnessScore}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-theme-body">{a.wordCount}</td>
                  <td className="py-2.5 pr-4 text-theme-body">{a.moneyPageLinkCount}/{a.internalLinkCount}</td>
                  <td className="py-2.5">
                    <StatusPill status={a.status === 'healthy' ? 'ACTIVE' : a.status === 'needs-attention' ? 'SCHEDULED' : 'FAILED'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* 问题 & 建议 */}
      {(health.topIssues.length > 0 || health.recommendations.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {health.topIssues.length > 0 && (
            <Panel title="当前问题" description="需要关注的 SEO 问题">
              <ul className="space-y-2">
                {health.topIssues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span className="text-theme-body">{issue}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {health.recommendations.length > 0 && (
            <Panel title="优化建议" description="系统自动生成的改进建议">
              <ul className="space-y-2">
                {health.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    <span className="text-theme-body">{rec}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
