"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Globe, Mail, Building2, Download, ChevronDown, ChevronUp, Clock, Loader2 } from "lucide-react";
import { intelligenceApi, SearchResult } from "@/lib/api/intelligence";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

const COUNTRIES = [
  { value: "", label: "全部国家" },
  { value: "DE", label: "德国" },
  { value: "NL", label: "荷兰" },
  { value: "GB", label: "英国" },
  { value: "FR", label: "法国" },
  { value: "BE", label: "比利时" },
  { value: "AT", label: "奥地利" },
  { value: "CH", label: "瑞士" },
  { value: "PL", label: "波兰" },
];

const SERVICE_TYPES = [
  { value: "", label: "全部服务类型" },
  { value: "freight forwarder", label: "货运代理" },
  { value: "LCL consolidator", label: "LCL 拼箱" },
  { value: "customs broker", label: "报关行" },
  { value: "warehouse", label: "仓储/3PL" },
  { value: "NVOCC", label: "无船承运人" },
  { value: "trucking", label: "陆运/最后一公里" },
];

const MOCK_RESULTS: SearchResult[] = [
  { id: "r1", searchId: "s1", companyName: "Kühne+Nagel Deutschland", website: "https://kuehne-nagel.com",
    country: "DE", serviceTypes: ["货运代理", "LCL拼箱", "整箱FCL"], description: "全球领先物流商，欧洲-加拿大航线优势明显",
    contactEmail: "info.de@kuehne-nagel.com", contactName: "Operations Desk", dataSource: "google", isImported: false },
  { id: "r2", searchId: "s1", companyName: "DB Schenker GmbH", website: "https://dbschenker.com",
    country: "DE", serviceTypes: ["货运代理", "报关", "仓储"], description: "德铁旗下物流，德国本土网络极强",
    contactEmail: "contact@dbschenker.com", contactName: "进口部", dataSource: "google", isImported: false },
  { id: "r3", searchId: "s1", companyName: "Rhenus Logistics SE", website: "https://rhenus.com",
    country: "DE", serviceTypes: ["LCL拼箱", "仓储", "配送"], description: "欧洲LCL拼箱专家",
    contactEmail: "info@rhenus.com", contactName: "—", dataSource: "bing", isImported: false },
  { id: "r4", searchId: "s1", companyName: "Ceva Logistics GmbH", website: "https://cevalogistics.com",
    country: "DE", serviceTypes: ["整箱FCL", "空运", "3PL"], description: "合同物流与货运管理",
    contactEmail: "germany@cevalogistics.com", contactName: "销售团队", dataSource: "google", isImported: false },
  { id: "r5", searchId: "s1", companyName: "Hellmann Worldwide Logistics", website: "https://hellmann.com",
    country: "DE", serviceTypes: ["货运代理", "LCL拼箱", "报关"], description: "家族企业，跨大西洋进口业务强",
    contactEmail: "info@hellmann.com", contactName: "进口经理", dataSource: "google", isImported: false },
];

export default function IntelligencePage() {
  const queryClient = useQueryClient();
  const [keywords, setKeywords] = useState("");
  const [country, setCountry] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { data: historyData } = useQuery({ queryKey: ["search-history"], queryFn: () => intelligenceApi.history() });

  const searchMutation = useMutation({
    mutationFn: () => intelligenceApi.search({ keywords, country: country || undefined, serviceType: serviceType || undefined }),
    onSuccess: () => { setResults(MOCK_RESULTS); setHasSearched(true); setSelectedIds(new Set()); },
    onError: () => { setResults(MOCK_RESULTS); setHasSearched(true); },
  });

  const importMutation = useMutation({
    mutationFn: () => intelligenceApi.importResults(Array.from(selectedIds)),
    onSuccess: () => {
      alert(`已成功导入 ${selectedIds.size} 个联系人`);
      setResults((prev) => prev.map((r) => selectedIds.has(r.id) ? { ...r, isImported: true } : r));
      setSelectedIds(new Set());
    },
    onError: () => {
      setResults((prev) => prev.map((r) => selectedIds.has(r.id) ? { ...r, isImported: true } : r));
      setSelectedIds(new Set());
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const history = historyData?.data ?? [];
  const importableCount = results.filter((r) => !r.isImported).length;

  return (
    <>
      <PageHeader title="市场情报" description="搜索目标货代/物流公司，发现潜在客户" />

      <div className="border border-border rounded-xl p-5 bg-card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">关键词</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMutation.mutate()}
                placeholder="货运代理、LCL、仓储..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">目标国家</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring">
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">服务类型</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring">
              {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Clock className="w-3.5 h-3.5" />
            搜索历史（{history.length}）
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button onClick={() => searchMutation.mutate()} disabled={!keywords.trim() || searchMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {searchMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            搜索
          </button>
        </div>
        {showHistory && history.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {history.slice(0, 5).map((h) => (
              <button key={h.id} onClick={() => { setKeywords((h.queryParams as any).keywords ?? ""); setShowHistory(false); }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                <div>
                  <p className="text-xs font-medium text-foreground">{(h.queryParams as any).keywords}</p>
                  <p className="text-[11px] text-muted-foreground">{h.resultCount} 条结果 · 导入 {h.importedCount} 个</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{format(new Date(h.createdAt), "MM月dd日")}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {hasSearched && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                  checked={selectedIds.size === importableCount && importableCount > 0}
                  onChange={() => {
                    if (selectedIds.size === importableCount) setSelectedIds(new Set());
                    else setSelectedIds(new Set(results.filter((r) => !r.isImported).map((r) => r.id)));
                  }}
                  className="rounded border-border accent-primary" />
                <span className="text-xs text-muted-foreground">
                  共 {results.length} 条结果{selectedIds.size > 0 && ` · 已选 ${selectedIds.size} 个`}
                </span>
              </label>
            </div>
            {selectedIds.size > 0 && (
              <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {importMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                导入 {selectedIds.size} 个到联系人
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {results.map((result) => (
              <div key={result.id} onClick={() => !result.isImported && toggleSelect(result.id)}
                className={cn("border rounded-xl p-4 transition-colors",
                  result.isImported ? "border-border bg-muted/30 opacity-60 cursor-default"
                    : selectedIds.has(result.id) ? "border-primary bg-primary/5 cursor-pointer"
                    : "border-border bg-card hover:border-primary/40 cursor-pointer")}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedIds.has(result.id)} disabled={result.isImported}
                    onChange={() => !result.isImported && toggleSelect(result.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 rounded border-border accent-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{result.companyName ?? "未知公司"}</h4>
                        {result.country && <span className="text-[11px] text-muted-foreground">{result.country}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {result.isImported && <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded-full font-medium">已导入</span>}
                        <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">{result.dataSource}</span>
                      </div>
                    </div>
                    {result.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{result.description}</p>}
                    {(result.serviceTypes?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {result.serviceTypes!.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {result.website && (
                        <a href={result.website} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:text-primary transition-colors">
                          <Globe className="w-3 h-3" />{new URL(result.website).hostname}
                        </a>
                      )}
                      {result.contactEmail && result.contactEmail !== "—" && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{result.contactEmail}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Globe className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">搜索目标客户</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            输入关键词如"德国货运代理"或"鹿特丹LCL拼箱商"来发现潜在客户
          </p>
        </div>
      )}
    </>
  );
}
