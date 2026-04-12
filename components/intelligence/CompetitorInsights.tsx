"use client";

import { Users, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { getCompetitors, Competitor } from "@/lib/intelligence";





const threatLevelConfig = {
  high: { color: "text-red-600", bg: "bg-red-50", label: "高威胁" },
  medium: { color: "text-amber-600", bg: "bg-amber-50", label: "中威胁" },
  low: { color: "text-green-600", bg: "bg-green-50", label: "低威胁" },
};

const positionConfig = {
  领导者: { color: "text-purple-600", bg: "bg-purple-50" },
  挑战者: { color: "text-blue-600", bg: "bg-blue-50" },
  跟随者: { color: "text-theme-secondary", bg: "bg-theme-card-muted" },
  新进入者: { color: "text-teal-600", bg: "bg-teal-50" },
};

export default function CompetitorInsights() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompetitors();
  }, [selectedService]);

  const serviceOptions = [
    { value: "all", label: "全部服务" },
    { value: "LCL", label: "LCL" },
    { value: "FCL", label: "FCL" },
    { value: "AIR", label: "空运" },
    { value: "RAIL", label: "铁路" },
    { value: "CUSTOMS", label: "报关" },
    { value: "WAREHOUSING", label: "仓储" },
  ];

  const filteredCompetitors = selectedService === "all" 
    ? competitors 
    : competitors.filter(c => c.services.includes(selectedService));

  const loadCompetitors = async () => {
    setLoading(true);
    try {
      const competitorsData = await getCompetitors(selectedService === "all" ? undefined : selectedService);
      setCompetitors(competitorsData);
    } catch (error) {
      console.error("Failed to load competitors:", error);
      // Keep existing data as fallback
    } finally {
      setLoading(false);
    }
  };

  const getOpportunityColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-theme-secondary" />
          <h3 className="text-sm font-semibold text-theme-heading">竞争对手分析</h3>
        </div>
        <button
          onClick={loadCompetitors}
          className="rounded-2xl bg-theme-card-muted px-3 py-1.5 text-sm font-medium text-theme-secondary hover:bg-theme-border"
        >
          更新数据
        </button>
      </div>

      {/* Service Filter */}
      <div className="flex flex-wrap gap-2">
        {serviceOptions.map(option => (
          <button
            key={option.value}
            onClick={() => setSelectedService(option.value)}
            className={`rounded-2xl px-3 py-1.5 text-sm font-medium ${
              selectedService === option.value
                ? "bg-intelligence-accent text-white"
                : "bg-theme-card-muted text-theme-secondary hover:bg-theme-border"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Competitors List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border border-theme-border bg-theme-card p-4">
              <div className="animate-pulse">
                <div className="h-4 w-32 rounded bg-slate-200"></div>
                <div className="mt-2 h-3 w-24 rounded bg-slate-200"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredCompetitors.length === 0 ? (
        <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-8 text-center">
          <p className="text-theme-secondary">暂无竞争对手数据</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCompetitors.map(competitor => {
            const threatConfig = threatLevelConfig[competitor.threatLevel];
            const positionConfigItem = positionConfig[competitor.marketPosition as keyof typeof positionConfig] || positionConfig.跟随者;

            return (
              <div
                key={competitor.id}
                className="rounded-2xl border border-theme-border bg-theme-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-theme-heading">{competitor.name}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${positionConfigItem.bg} ${positionConfigItem.color}`}>
                        {competitor.marketPosition}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {competitor.services.map(service => (
                        <span
                          key={service}
                          className="rounded-full bg-theme-card-muted px-2 py-0.5 text-xs text-theme-secondary"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`rounded-full px-2 py-0.5 text-xs font-medium ${threatConfig.bg} ${threatConfig.color}`}>
                        {threatConfig.label}
                      </div>
                      <div className="mt-1 text-xs text-theme-secondary">威胁等级</div>
                    </div>
                    <div className="text-right">
                      <div className={`rounded-full px-2 py-0.5 text-xs font-medium ${getOpportunityColor(competitor.opportunityScore)}`}>
                        {competitor.opportunityScore} 机会分
                      </div>
                      <div className="mt-1 text-xs text-theme-secondary">机会评分</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Key Insights */}
      <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-theme-heading">
            <Target className="h-4 w-4" />
            竞争策略建议
          </h4>
          <div className="rounded-full bg-intelligence-accent-light px-2 py-1 text-xs font-medium text-intelligence-accent">
            来自 competitor-intelligence skill
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-theme-heading">针对新进入者</p>
              <p className="text-sm text-theme-secondary">数字化体验优秀的敏捷型公司机会评分高，可借鉴其模式。</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-theme-heading">市场领导者</p>
              <p className="text-sm text-theme-secondary">传统巨头威胁高但数字化较慢，可在中小企业市场差异化竞争。</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button className="text-sm font-medium text-intelligence-accent hover:text-intelligence-accent-dark">
            查看完整竞争分析 →
          </button>
          <div className="text-xs text-theme-secondary">
            数据生成时间: {new Date().toLocaleDateString('zh-CN')}
          </div>
        </div>
      </div>
    </div>
  );
}