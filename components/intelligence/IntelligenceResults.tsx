"use client";

import { useState, useEffect } from "react";
import { Check, Globe, Mail, Phone, ExternalLink, Upload, Users, AlertCircle, Search, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashMessage } from "@/components/ui/flash-message";
import { Company, SearchResult, getSearchResults, importCompanies } from "@/lib/intelligence";

interface IntelligenceResultsProps {
  searchId?: string;
  initialResults?: SearchResult;
  onImportSuccess?: (imported: number) => void;
}

export default function IntelligenceResults({ 
  searchId, 
  initialResults,
  onImportSuccess 
}: IntelligenceResultsProps) {
  const [results, setResults] = useState<SearchResult | null>(initialResults || null);
  const [loading, setLoading] = useState(!!searchId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Update results when initialResults changes
  useEffect(() => {
    if (initialResults) {
      setResults(initialResults);
      setLoading(false);
    }
  }, [initialResults]);

  // Load results if searchId provided (and no initialResults)
  // Skip if initialResults is provided — parent already has the data
  useEffect(() => {
    if (searchId && !initialResults && !results) {
      loadResults();
    }
  }, [searchId, initialResults]);

  const loadResults = async () => {
    if (!searchId) return;
    setLoading(true);
    try {
      const data = await getSearchResults(searchId);
      setResults(data);
    } catch (error) {
      console.error("Failed to load results:", error);
      setMessage({ type: 'error', text: `加载搜索结果失败: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!results) return;
    if (selectedIds.length === results.companies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(results.companies.map(c => c.id));
    }
  };

  const handleImport = async () => {
    if (!searchId || selectedIds.length === 0) {
      setMessage({ type: 'error', text: '请先选择要导入的公司' });
      return;
    }

    setImporting(true);
    try {
      const result = await importCompanies({
        searchId,
        companyIds: selectedIds,
      });
      
      setMessage({ 
        type: 'success', 
        text: `成功导入 ${result.imported} 个联系人${result.skipped > 0 ? `，跳过 ${result.skipped} 个` : ''}` 
      });
      
      if (onImportSuccess) {
        onImportSuccess(result.imported);
      }
      
      // Clear selection after successful import
      setSelectedIds([]);
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({ type: 'error', text: `导入失败: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setImporting(false);
    }
  };

  const getOpportunityColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const getCountryFlag = (countryCode: string) => {
    const flags: Record<string, string> = {
      DE: "🇩🇪",
      NL: "🇳🇱",
      FR: "🇫🇷",
      BE: "🇧🇪",
      UK: "🇬🇧",
      IT: "🇮🇹",
      ES: "🇪🇸",
      CH: "🇨🇭",
    };
    return flags[countryCode] || "🌐";
  };

  console.log('IntelligenceResults render:', { loading, results, searchId, initialResults });

  if (loading) {
    return (
      <div className="rounded-2xl border border-theme-border bg-theme-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-theme-border border-t-slate-950"></div>
        <p className="mt-4 text-theme-secondary">正在加载搜索结果...</p>
      </div>
    );
  }

  if (!results || !results.companies || results.companies.length === 0) {
    const errorTitle = results?.error ? '搜索失败' : '未找到匹配的公司';
    const errorDescription = results?.error 
      ? `搜索过程中出现错误：${results.error}`
      : results && results.total === 0
        ? "当前搜索条件未找到任何公司。请尝试更宽泛的关键词、减少筛选条件，或选择不同的服务类型和国家。"
        : "尝试不同的搜索关键词或筛选条件，找到欧洲货代公司";
    return (
      <>
        {results && (
          <div className="mb-4 rounded-2xl border border-theme-border bg-theme-card-muted p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-theme-heading">搜索详情</h4>
              <div className="flex flex-wrap items-center gap-3 text-sm text-theme-body">
                {results.source && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">数据来源:</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      results.source === 'gemini' || results.source === 'realtime' || results.source === 'duckduckgo' || results.source === 'google' || results.source === 'bing'
                        ? 'bg-blue-50 text-blue-700'
                        : results.source === 'local_dataset'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {getSourceLabel(results.source)}
                    </span>
                  </div>
                )}
                {results.realTimeSuccess !== undefined && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">实时搜索:</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      results.realTimeSuccess
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {results.realTimeSuccess ? '成功' : '失败'}
                    </span>
                  </div>
                )}
                {results.fallbackTriggered !== undefined && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">回退触发:</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      results.fallbackTriggered
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {results.fallbackTriggered ? '已触发' : '未触发'}
                    </span>
                  </div>
                )}
                {results.error && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">错误:</span>
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      {results.error}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <EmptyState
          icon={<Search className="h-12 w-12 text-slate-400" />}
          title={errorTitle}
          description={errorDescription}
          actions={
            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadResults}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
              >
                <RefreshCw className="h-4 w-4" />
                重新加载
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                清除筛选条件
              </button>
            </div>
          }
        />
      </>
    );
  }

  // Source mapping to Chinese labels
  function getSourceLabel(source?: string) {
    switch (source) {
      case 'gemini': return 'Gemini 实时搜索';
      case 'realtime': return '实时网络搜索';
      case 'duckduckgo': return 'DuckDuckGo 搜索';
      case 'google': return 'Google 搜索';
      case 'bing': return 'Bing 搜索';
      case 'local_dataset': return '本地数据集';
      case 'mock_fallback': return '模拟数据回退';
      case 'error': return '搜索错误';
      default: return source || '未知来源';
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="mb-4">
          <FlashMessage
            tone={message.type}
            message={message.text}
          />
        </div>
      )}

      {/* Search Metadata Bar */}
      {results && (
        <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-theme-heading">搜索详情</h4>
              <div className="flex flex-wrap items-center gap-3 text-sm text-theme-body">
                <div className="flex items-center gap-1">
                  <span className="font-medium">数据来源:</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    results.source === 'gemini' || results.source === 'realtime' || results.source === 'duckduckgo' || results.source === 'google' || results.source === 'bing'
                      ? 'bg-blue-50 text-blue-700'
                      : results.source === 'local_dataset'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {getSourceLabel(results.source)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">实时搜索:</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    results?.realTimeSuccess
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {results.realTimeSuccess ? '成功' : '失败'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">回退触发:</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    results.fallbackTriggered
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {results.fallbackTriggered ? '已触发' : '未触发'}
                  </span>
                </div>
                {results.error && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">错误:</span>
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      {results.error}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-sm text-theme-secondary">
              搜索 ID: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{results?.searchId ?? ''}</code>
            </div>
          </div>
        </div>
      )}

      {/* Batch Import Bar */}
      <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-4">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.length > 0 && selectedIds.length === results.companies.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-theme-border text-slate-950"
              />
              <span className="text-sm font-medium text-theme-heading">
                {selectedIds.length > 0 ? `已选择 ${selectedIds.length} 个公司` : '选择全部'}
              </span>
            </div>
            <div className="text-sm text-theme-secondary">
              共 {results?.total ?? 0} 个结果，第 {results?.page ?? 1} 页
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="text-sm text-theme-secondary hover:text-theme-heading disabled:opacity-50"
            >
              清除选择
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.length === 0 || importing}
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-teal-700"
            >
              {importing ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent"></div>
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  导入选中联系人 ({selectedIds.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-hidden rounded-2xl border border-theme-border">
        <table className="w-full">
          <thead className="border-b border-theme-border bg-slate-100">
            <tr>
              <th className="w-12 py-3 pl-4 pr-2 text-left">
                <span className="sr-only">选择</span>
              </th>
              <th className="py-3 pl-2 pr-4 text-left text-sm font-semibold text-slate-950">
                公司信息
              </th>
              <th className="hidden py-3 px-4 text-left text-sm font-semibold text-slate-950 md:table-cell">
                服务类型
              </th>
              <th className="hidden py-3 px-4 text-left text-sm font-semibold text-slate-950 lg:table-cell">
                联系方式
              </th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-slate-950">
                机会评分
              </th>
              <th className="py-3 pl-4 pr-2 text-right text-sm font-semibold text-slate-950">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.companies.map(company => (
              <tr key={company.id} className="hover:bg-theme-card-muted">
                <td className="py-3 pl-4 pr-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(company.id)}
                    onChange={() => toggleSelect(company.id)}
                    className="h-4 w-4 rounded border-theme-border text-slate-950"
                  />
                </td>
                <td className="py-3 pl-2 pr-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCountryFlag(company.country)}</span>
                      <h4 className="font-medium text-theme-heading">{company.name}</h4>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-theme-secondary">{company.countryLabel}</span>
                      <span className="text-xs text-theme-secondary">•</span>
                      <span className="text-sm text-theme-secondary capitalize">{company.companySize.toLowerCase()}</span>
                    </div>
                    {company.description && (
                      <p className="mt-2 text-sm text-theme-body line-clamp-2">
                        {company.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="hidden py-3 px-4 md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(company.serviceLabels || []).map((service, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs text-theme-secondary"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="hidden py-3 px-4 lg:table-cell">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-theme-body">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{company.contact?.email || '未提供'}</span>
                      </div>
                      {company.contactSource?.email === 'scraped' && (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                          抓取
                        </span>
                      )}
                      {company.contactSource?.email === 'missing' && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                          缺失
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-theme-body">
                        <Phone className="h-3 w-3" />
                        <span>{company.contact?.phone || '未提供'}</span>
                      </div>
                      {company.contactSource?.phone === 'scraped' && (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                          抓取
                        </span>
                      )}
                      {company.contactSource?.phone === 'missing' && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                          缺失
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-theme-body">
                        <Globe className="h-3 w-3" />
                        <span className="truncate">{company.contact?.website ? company.contact.website.replace(/^https?:\/\//, '') : '未提供'}</span>
                      </div>
                      {company.contactSource?.website === 'search_result' && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          搜索结果
                        </span>
                      )}
                      {company.contactSource?.website === 'missing' && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                          缺失
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${getOpportunityColor(company.opportunityScore)}`}>
                    <span>{company.opportunityScore}</span>
                    <span className="text-xs">机会分</span>
                  </div>
                  <div className="mt-1 text-xs text-theme-secondary">
                    {company.opportunityScore >= 80 ? '高机会' : company.opportunityScore >= 60 ? '中等机会' : '低机会'}
                  </div>
                </td>
                <td className="py-3 pl-4 pr-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => company.contact?.website && window.open(company.contact.website, '_blank')}
                      className="rounded-2xl border border-theme-border bg-theme-card px-3 py-1.5 text-sm font-medium text-theme-body hover:bg-theme-card-muted"
                      title="访问网站"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleSelect(company.id)}
                      className={`rounded-2xl px-3 py-1.5 text-sm font-medium ${
                        selectedIds.includes(company.id)
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'border border-theme-border bg-theme-card text-theme-body hover:bg-theme-card-muted'
                      }`}
                    >
                      {selectedIds.includes(company.id) ? (
                        <>
                          <Check className="mr-1 inline h-3 w-3" />
                          已选
                        </>
                      ) : (
                        '选择'
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(results?.total ?? 0) > (results?.limit ?? 20) && (
        <div className="flex items-center justify-between border-t border-theme-border pt-4">
          <div className="text-sm text-theme-secondary">
            显示 {Math.min(((results?.page ?? 1) - 1) * (results?.limit ?? 20) + 1, (results?.total ?? 0))} - {Math.min((results?.page ?? 1) * (results?.limit ?? 20), (results?.total ?? 0))} 条，共 {results?.total ?? 0} 条
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {/* TODO: previous page */}}
              disabled={(results?.page ?? 1) === 1}
              className="rounded-2xl border border-theme-border bg-theme-card px-4 py-2 text-sm font-medium text-theme-body disabled:opacity-50 hover:bg-theme-card-muted"
            >
              上一页
            </button>
            <button
              onClick={() => {/* TODO: next page */}}
              disabled={(results?.page ?? 1) * (results?.limit ?? 20) >= (results?.total ?? 0)}
              className="rounded-2xl border border-theme-border bg-theme-card px-4 py-2 text-sm font-medium text-theme-body disabled:opacity-50 hover:bg-theme-card-muted"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* Import Help */}
      <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <h4 className="text-sm font-semibold text-theme-heading">批量导入说明</h4>
            <ul className="mt-2 space-y-1 text-sm text-theme-body">
              <li>• 选择公司后点击&quot;导入选中联系人&quot;，系统将自动创建联系人记录</li>
              <li>• 已有重复联系人将自动跳过，不会重复创建</li>
              <li>• 导入后可在&quot;联系人&quot;页面查看和管理这些公司</li>
              <li>• 如需导入到特定联系人列表，请先创建列表后再执行导入</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

