"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Play,
  Square,
  Download,
  Globe,
  Mail,
  Phone,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Users,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface ProgressInfo {
  phase: string;
  searchProgress?: { completed: number; total: number; currentQuery?: string };
  scrapeProgress?: { completed: number; total: number; currentCompany?: string };
  companiesFound: number;
  companiesAfterDedup: number;
  companiesScraped: number;
  errors: string[];
}

interface TaskInfo {
  id: string;
  status: string;
  progress: ProgressInfo | null;
  totalCompanies: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface Company {
  id: string;
  companyName: string;
  domain: string | null;
  website: string | null;
  country: string | null;
  services: string[];
  email: string | null;
  phone: string | null;
  contactPageUrl: string | null;
  description: string | null;
  source: string;
  scrapeStatus: string;
  confidence: number;
}

interface ResultsData {
  companies: Company[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: {
    total: number;
    withEmail: number;
    byCountry: { country: string; count: number }[];
  };
}

// ── Country labels ─────────────────────────────────────────────────────

const COUNTRY_LABELS: Record<string, string> = {
  DE: "德国", FR: "法国", NL: "荷兰", BE: "比利时", LU: "卢森堡",
  AT: "奥地利", CH: "瑞士", LI: "列支敦士登", MC: "摩纳哥",
  GB: "英国", IE: "爱尔兰", DK: "丹麦", SE: "瑞典", NO: "挪威",
  FI: "芬兰", IS: "冰岛",
  IT: "意大利", ES: "西班牙", PT: "葡萄牙", GR: "希腊",
  MT: "马耳他", CY: "塞浦路斯", AD: "安道尔", SM: "圣马力诺",
  PL: "波兰", CZ: "捷克", SK: "斯洛伐克", HU: "匈牙利",
  RO: "罗马尼亚", BG: "保加利亚", HR: "克罗地亚", SI: "斯洛文尼亚",
  RS: "塞尔维亚", BA: "波黑", ME: "黑山", MK: "北马其顿",
  AL: "阿尔巴尼亚", XK: "科索沃",
  LT: "立陶宛", LV: "拉脱维亚", EE: "爱沙尼亚",
  UA: "乌克兰", MD: "摩尔多瓦", BY: "白俄罗斯",
  GE: "格鲁吉亚", AM: "亚美尼亚", AZ: "阿塞拜疆",
  TR: "土耳其", RU: "俄罗斯",
};

const COUNTRY_OPTIONS = Object.entries(COUNTRY_LABELS).map(([code, label]) => ({ code, label }));

// ── Component ──────────────────────────────────────────────────────────

export default function DeepSearchPanel() {
  // Config
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [enableScraping, setEnableScraping] = useState(true);
  const [showConfig, setShowConfig] = useState(true);

  // Task state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskInfo | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results
  const [results, setResults] = useState<ResultsData | null>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterHasEmail, setFilterHasEmail] = useState(false);

  // Import
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; message: string } | null>(null);

  // ── Start task ──
  const handleStart = async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/deep-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countries: selectedCountries.length > 0 ? selectedCountries : undefined,
          enableScraping,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTaskId(data.data.taskId);
        setShowConfig(false);
        setResults(null);
      } else {
        alert("启动失败: " + (data.error?.message || "未知错误"));
      }
    } catch (err) {
      alert("启动失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsStarting(false);
    }
  };

  // ── Cancel task ──
  const handleCancel = async () => {
    if (!taskId) return;
    await fetch(`/api/deep-search/${taskId}`, { method: "DELETE" });
    stopPolling();
    setTask(prev => prev ? { ...prev, status: "CANCELLED" } : null);
  };

  // ── Poll progress ──
  const pollProgress = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/deep-search/${taskId}`);
      const data = await res.json();
      if (data.success) {
        setTask(data.data);
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(data.data.status)) {
          stopPolling();
          if (data.data.status === "COMPLETED") {
            fetchResults(taskId, 1);
          }
        }
      }
    } catch {
      // ignore poll errors
    }
  }, [taskId]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (taskId) {
      pollProgress();
      pollRef.current = setInterval(pollProgress, 2000);
    }
    return () => stopPolling();
  }, [taskId, pollProgress]);

  // ── Fetch results ──
  const fetchResults = async (tid: string, page: number) => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filterCountry) params.set("country", filterCountry);
    if (filterHasEmail) params.set("hasEmail", "true");

    const res = await fetch(`/api/deep-search/${tid}/results?${params}`);
    const data = await res.json();
    if (data.success) {
      setResults(data.data);
      setResultsPage(page);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    if (taskId && task?.status === "COMPLETED") {
      fetchResults(taskId, 1);
    }
  }, [filterCountry, filterHasEmail]);

  // ── Export CSV ──
  const handleExport = () => {
    if (!results) return;
    const header = "公司名,域名,网站,国家,邮箱,电话,服务,来源,置信度\n";
    const rows = results.companies.map(c =>
      [
        `"${c.companyName}"`,
        c.domain || "",
        c.website || "",
        COUNTRY_LABELS[c.country || ""] || c.country || "",
        c.email || "",
        c.phone || "",
        `"${c.services.join(", ")}"`,
        c.source,
        c.confidence.toFixed(2),
      ].join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deep-search-${taskId?.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import to contacts ──
  const handleImport = async (mode: "selected" | "all") => {
    if (!taskId) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const body: any = {};
      if (mode === "selected" && selectedIds.size > 0) {
        body.companyIds = Array.from(selectedIds);
      }
      body.tags = ["europe-freight"];

      const res = await fetch(`/api/deep-search/${taskId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult(data.data);
        setSelectedIds(new Set());
      } else {
        alert("导入失败: " + (data.error?.message || "未知错误"));
      }
    } catch (err) {
      alert("导入失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!results) return;
    const emailCompanies = results.companies.filter(c => c.email);
    if (selectedIds.size === emailCompanies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emailCompanies.map(c => c.id)));
    }
  };

  // ── Load recent task on mount ──
  useEffect(() => {
    fetch("/api/deep-search")
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.length > 0) {
          const latest = data.data[0];
          if (latest.status === "RUNNING" || latest.status === "PENDING") {
            setTaskId(latest.id);
            setTask(latest);
            setShowConfig(false);
          } else if (latest.status === "COMPLETED") {
            setTaskId(latest.id);
            setTask(latest);
            setShowConfig(false);
            fetchResults(latest.id, 1);
          }
        }
      })
      .catch(() => {});
  }, []);

  // ── Progress bar ──
  const progress = task?.progress as ProgressInfo | null;
  const getProgressPercent = (): number => {
    if (!progress) return 0;
    switch (progress.phase) {
      case "searching": {
        const s = progress.searchProgress;
        return s ? Math.round((s.completed / Math.max(s.total, 1)) * 45) : 5;
      }
      case "directories":
        return 48;
      case "deduplicating":
        return 52;
      case "saving":
        return 58;
      case "scraping": {
        const s = progress.scrapeProgress;
        return s ? 60 + Math.round((s.completed / Math.max(s.total, 1)) * 35) : 65;
      }
      case "completed":
        return 100;
      case "failed":
        return 100;
      default:
        return 0;
    }
  };

  const phaseLabels: Record<string, string> = {
    searching: "搜索中",
    directories: "爬取行业目录中",
    deduplicating: "去重中",
    saving: "保存中",
    scraping: "爬取官网中",
    completed: "已完成",
    failed: "失败",
  };

  const isRunning = task?.status === "RUNNING" || task?.status === "PENDING";
  const isCompleted = task?.status === "COMPLETED";

  return (
    <div className="space-y-6">
      {/* ── Config Panel ── */}
      <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-6">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex w-full items-center justify-between text-left"
        >
          <div>
            <h3 className="text-lg font-semibold text-theme-heading">搜索配置</h3>
            <p className="text-sm text-theme-secondary">
              选择目标国家和搜索选项，开始批量发现欧洲货代公司
            </p>
          </div>
          {showConfig ? <ChevronUp className="h-5 w-5 text-theme-secondary" /> : <ChevronDown className="h-5 w-5 text-theme-secondary" />}
        </button>

        {showConfig && (
          <div className="mt-6 space-y-4">
            {/* Country selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-theme-heading">
                目标国家 <span className="text-theme-secondary">(不选则搜索全部欧洲)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {COUNTRY_OPTIONS.map((c) => (
                  <button
                    key={c.code}
                    onClick={() =>
                      setSelectedCountries(prev =>
                        prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code]
                      )
                    }
                    className={`rounded-xl px-3 py-1.5 text-sm transition ${
                      selectedCountries.includes(c.code)
                        ? "bg-intelligence-accent text-white"
                        : "border border-theme-border bg-theme-card text-theme-secondary hover:border-intelligence-accent"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-theme-heading">
                <input
                  type="checkbox"
                  checked={enableScraping}
                  onChange={e => setEnableScraping(e.target.checked)}
                  className="rounded"
                />
                爬取官网提取联系方式
              </label>
            </div>

            {/* Start button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleStart}
                disabled={isStarting || isRunning}
                className="inline-flex items-center gap-2 rounded-2xl bg-intelligence-accent px-6 py-3 text-sm font-semibold text-white hover:bg-intelligence-accent-dark disabled:opacity-50"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isStarting ? "启动中..." : "开始深度搜索"}
              </button>

              {isRunning && (
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <Square className="h-4 w-4" />
                  取消
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Progress Panel ── */}
      {task && (
        <div className="rounded-2xl border border-theme-border bg-theme-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-theme-heading">
              {isRunning ? "任务进行中" : isCompleted ? "任务完成" : `任务状态: ${task.status}`}
            </h3>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              isRunning ? "bg-blue-100 text-blue-700" :
              isCompleted ? "bg-green-100 text-green-700" :
              task.status === "FAILED" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-700"
            }`}>
              {task.status}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="h-3 w-full overflow-hidden rounded-full bg-theme-card-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  task.status === "FAILED" ? "bg-red-500" : "bg-intelligence-accent"
                }`}
                style={{ width: `${getProgressPercent()}%` }}
              />
            </div>
          </div>

          {/* Phase details */}
          {progress && (
            <div className="space-y-2 text-sm">
              <p className="text-theme-secondary">
                <span className="font-medium text-theme-heading">
                  {phaseLabels[progress.phase] || progress.phase}
                </span>
                {progress.searchProgress && progress.phase === "searching" && (
                  <> — 查询 {progress.searchProgress.completed}/{progress.searchProgress.total}
                    {progress.searchProgress.currentQuery && (
                      <span className="ml-2 text-theme-secondary">&ldquo;{progress.searchProgress.currentQuery}&rdquo;</span>
                    )}
                  </>
                )}
                {progress.scrapeProgress && progress.phase === "scraping" && (
                  <> — 爬取 {progress.scrapeProgress.completed}/{progress.scrapeProgress.total}
                    {progress.scrapeProgress.currentCompany && (
                      <span className="ml-2 text-theme-secondary">{progress.scrapeProgress.currentCompany}</span>
                    )}
                  </>
                )}
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 rounded-xl bg-theme-card-muted p-3">
                <div>
                  <span className="text-theme-secondary">搜索发现:</span>{" "}
                  <span className="font-medium text-theme-heading">{progress.companiesFound}</span>
                </div>
                <div>
                  <span className="text-theme-secondary">去重后:</span>{" "}
                  <span className="font-medium text-theme-heading">{progress.companiesAfterDedup}</span>
                </div>
                <div>
                  <span className="text-theme-secondary">已爬取:</span>{" "}
                  <span className="font-medium text-theme-heading">{progress.companiesScraped}</span>
                </div>
              </div>

              {/* Errors */}
              {progress.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-red-500">
                    {progress.errors.length} 个错误
                  </summary>
                  <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-red-400">
                    {progress.errors.map((e, i) => (
                      <li key={i} className="truncate">{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {task.errorMessage && (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{task.errorMessage}</p>
          )}
        </div>
      )}

      {/* ── Results Panel ── */}
      {isCompleted && results && (
        <div className="rounded-2xl border border-theme-border bg-theme-card p-6">
          {/* Stats cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-theme-card-muted p-4 text-center">
              <p className="text-2xl font-bold text-theme-heading">{results.stats.total}</p>
              <p className="text-sm text-theme-secondary">总公司数</p>
            </div>
            <div className="rounded-xl bg-theme-card-muted p-4 text-center">
              <p className="text-2xl font-bold text-intelligence-accent">{results.stats.withEmail}</p>
              <p className="text-sm text-theme-secondary">有邮箱</p>
            </div>
            <div className="rounded-xl bg-theme-card-muted p-4 text-center">
              <p className="text-2xl font-bold text-theme-heading">{results.stats.byCountry.length}</p>
              <p className="text-sm text-theme-secondary">覆盖国家</p>
            </div>
            <div className="rounded-xl bg-theme-card-muted p-4 text-center">
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleExport}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-intelligence-accent px-4 py-2 text-sm font-semibold text-white hover:bg-intelligence-accent-dark"
                >
                  <Download className="h-4 w-4" />
                  导出 CSV
                </button>
                <button
                  onClick={() => handleImport("all")}
                  disabled={isImporting || results.stats.withEmail === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-intelligence-accent px-4 py-2 text-sm font-semibold text-intelligence-accent hover:bg-intelligence-accent hover:text-white disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  全部导入联系人
                </button>
              </div>
            </div>
          </div>

          {/* Import result banner */}
          {importResult && (
            <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-center justify-between">
              <span>
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                {importResult.message}
              </span>
              <button onClick={() => setImportResult(null)} className="text-green-500 hover:text-green-700">&times;</button>
            </div>
          )}

          {/* Selected import bar */}
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-intelligence-accent-light p-3">
              <span className="text-sm font-medium text-intelligence-accent-dark">
                已选择 {selectedIds.size} 家公司
              </span>
              <button
                onClick={() => handleImport("selected")}
                disabled={isImporting}
                className="inline-flex items-center gap-2 rounded-xl bg-intelligence-accent px-4 py-2 text-sm font-semibold text-white hover:bg-intelligence-accent-dark disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                导入选中
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-intelligence-accent hover:underline"
              >
                取消选择
              </button>
            </div>
          )}

          {/* Country distribution */}
          {results.stats.byCountry.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {results.stats.byCountry.slice(0, 15).map((s) => (
                <span
                  key={s.country}
                  className="rounded-lg bg-theme-card-muted px-2 py-1 text-xs text-theme-secondary"
                >
                  {COUNTRY_LABELS[s.country] || s.country}: {s.count}
                </span>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            <select
              value={filterCountry}
              onChange={e => setFilterCountry(e.target.value)}
              className="rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-sm text-theme-heading"
            >
              <option value="">全部国家</option>
              {results.stats.byCountry.map(s => (
                <option key={s.country} value={s.country}>
                  {COUNTRY_LABELS[s.country] || s.country} ({s.count})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-theme-heading">
              <input
                type="checkbox"
                checked={filterHasEmail}
                onChange={e => setFilterHasEmail(e.target.checked)}
                className="rounded"
              />
              仅显示有邮箱
            </label>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-theme-border text-xs uppercase text-theme-secondary">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={results.companies.filter(c => c.email).length > 0 && selectedIds.size === results.companies.filter(c => c.email).length}
                      onChange={toggleSelectAll}
                      className="rounded"
                      title="全选有邮箱的"
                    />
                  </th>
                  <th className="px-3 py-3">公司名</th>
                  <th className="px-3 py-3">国家</th>
                  <th className="px-3 py-3">邮箱</th>
                  <th className="px-3 py-3">电话</th>
                  <th className="px-3 py-3">服务</th>
                  <th className="px-3 py-3">来源</th>
                  <th className="px-3 py-3">爬取</th>
                </tr>
              </thead>
              <tbody>
                {results.companies.map((c) => (
                  <tr key={c.id} className={`border-b border-theme-border/50 hover:bg-theme-card-muted/50 ${selectedIds.has(c.id) ? "bg-intelligence-accent-light/30" : ""}`}>
                    <td className="px-3 py-3">
                      {c.email ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded"
                        />
                      ) : (
                        <span className="text-theme-secondary">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-theme-heading">{c.companyName}</div>
                      {c.website && (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-intelligence-accent hover:underline"
                        >
                          <Globe className="h-3 w-3" />
                          {c.domain}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-3 text-theme-secondary">
                      {COUNTRY_LABELS[c.country || ""] || c.country || "-"}
                    </td>
                    <td className="px-3 py-3">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-intelligence-accent hover:underline">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-theme-secondary">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {c.phone ? (
                        <span className="inline-flex items-center gap-1 text-theme-heading">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
                      ) : (
                        <span className="text-theme-secondary">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.services.slice(0, 3).map(s => (
                          <span key={s} className="rounded bg-theme-card-muted px-1.5 py-0.5 text-xs text-theme-secondary">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded bg-theme-card-muted px-2 py-0.5 text-xs text-theme-secondary">
                        {c.source}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {c.scrapeStatus === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : c.scrapeStatus === "error" ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : c.scrapeStatus === "pending" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-theme-secondary" />
                      ) : (
                        <span className="text-xs text-theme-secondary">{c.scrapeStatus}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {results.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-theme-secondary">
                第 {results.pagination.page} / {results.pagination.totalPages} 页，共 {results.pagination.total} 条
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => taskId && fetchResults(taskId, resultsPage - 1)}
                  disabled={resultsPage <= 1}
                  className="rounded-xl border border-theme-border px-3 py-1.5 text-sm text-theme-heading disabled:opacity-30"
                >
                  上一页
                </button>
                <button
                  onClick={() => taskId && fetchResults(taskId, resultsPage + 1)}
                  disabled={resultsPage >= results.pagination.totalPages}
                  className="rounded-xl border border-theme-border px-3 py-1.5 text-sm text-theme-heading disabled:opacity-30"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── New search button when completed ── */}
      {isCompleted && (
        <div className="text-center">
          <button
            onClick={() => {
              setTaskId(null);
              setTask(null);
              setResults(null);
              setShowConfig(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-theme-border px-4 py-3 text-sm font-semibold text-theme-heading hover:bg-theme-card-muted"
          >
            <Search className="h-4 w-4" />
            新建深度搜索
          </button>
        </div>
      )}
    </div>
  );
}
