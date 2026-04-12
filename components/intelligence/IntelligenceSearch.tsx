"use client";

import { useState } from "react";
import { Search, Filter, Download, Upload } from "lucide-react";
import { searchCompanies } from "@/lib/intelligence";
import { addSearchHistory } from "@/lib/searchHistory";

interface SearchFilters {
  query: string;
  countries: string[];
  services: string[];
  companySize: string[];
}

interface IntelligenceSearchProps {
  onSearchComplete?: (result: any) => void;
}

const countryOptions = [
  { value: "DE", label: "德国" },
  { value: "NL", label: "荷兰" },
  { value: "FR", label: "法国" },
  { value: "BE", label: "比利时" },
  { value: "UK", label: "英国" },
  { value: "IT", label: "意大利" },
  { value: "ES", label: "西班牙" },
];

const serviceOptions = [
  { value: "LCL", label: "LCL拼箱" },
  { value: "FCL", label: "FCL整箱" },
  { value: "AIR", label: "空运" },
  { value: "CUSTOMS", label: "报关服务" },
  { value: "WAREHOUSING", label: "仓储" },
];

const sizeOptions = [
  { value: "SMALL", label: "小型 (1-50人)" },
  { value: "MEDIUM", label: "中型 (50-200人)" },
  { value: "LARGE", label: "大型 (200-1000人)" },
  { value: "ENTERPRISE", label: "企业级 (1000+人)" },
];

export default function IntelligenceSearch({ onSearchComplete }: IntelligenceSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    countries: [],
    services: [],
    companySize: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = async () => {
    if (!filters.query.trim() && filters.countries.length === 0 && filters.services.length === 0) {
      alert("请输入搜索关键词或选择筛选条件");
      return;
    }

    setIsSearching(true);
    
    try {
      const result = await searchCompanies({
        query: filters.query,
        countries: filters.countries,
        services: filters.services,
        companySize: filters.companySize,
        page: 1,
        limit: 20,
      });
      
      console.log("Search results:", result);
      
      // Add to search history
      addSearchHistory({
        query: filters.query,
        filters: {
          countries: filters.countries,
          services: filters.services,
          companySize: filters.companySize,
        },
        totalResults: result.total,
        searchId: result.searchId,
      });
      
      // Notify parent component
      console.log('IntelligenceSearch: search completed, result:', result);
      if (onSearchComplete) {
        onSearchComplete(result);
      }
      
    } catch (error) {
      console.error("Search error:", error);
      alert(`搜索时出错: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleFilter = (type: keyof Omit<SearchFilters, "query">, value: string) => {
    setFilters(prev => {
      const current = prev[type] as string[];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-theme-secondary" />
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
              onKeyPress={handleKeyPress}
              placeholder="搜索欧洲货代公司，例如：德国LCL货代、荷兰物流公司..."
              className="w-full rounded-2xl border border-theme-border bg-theme-card py-3 pl-12 pr-4 text-sm placeholder:text-theme-secondary"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="inline-flex items-center gap-2 rounded-2xl bg-intelligence-accent px-6 py-3 text-sm font-semibold text-white hover:bg-intelligence-accent-dark disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {isSearching ? "搜索中..." : "搜索"}
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-2 rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-sm font-semibold text-theme-heading hover:bg-theme-card-muted"
          >
            <Filter className="h-4 w-4" />
            高级筛选
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Country Filter */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-theme-heading">国家/地区</h3>
              <div className="space-y-2">
                {countryOptions.map(country => (
                  <label key={country.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.countries.includes(country.value)}
                      onChange={() => toggleFilter("countries", country.value)}
                      className="h-4 w-4 rounded border-theme-border text-theme-heading"
                    />
                    <span className="text-sm text-theme-body">{country.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Service Filter */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-theme-heading">服务类型</h3>
              <div className="space-y-2">
                {serviceOptions.map(service => (
                  <label key={service.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.services.includes(service.value)}
                      onChange={() => toggleFilter("services", service.value)}
                      className="h-4 w-4 rounded border-theme-border text-theme-heading"
                    />
                    <span className="text-sm text-theme-body">{service.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Company Size Filter */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-theme-heading">公司规模</h3>
              <div className="space-y-2">
                {sizeOptions.map(size => (
                  <label key={size.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.companySize.includes(size.value)}
                      onChange={() => toggleFilter("companySize", size.value)}
                      className="h-4 w-4 rounded border-theme-border text-theme-heading"
                    />
                    <span className="text-sm text-theme-body">{size.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-theme-border pt-6">
            <div className="text-sm text-theme-secondary">
              已选择: {filters.countries.length} 个国家, {filters.services.length} 项服务, {filters.companySize.length} 种规模
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFilters({ query: "", countries: [], services: [], companySize: [] })}
                className="text-sm text-theme-secondary hover:text-theme-heading"
              >
                清除筛选
              </button>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="inline-flex items-center gap-2 rounded-2xl bg-intelligence-accent px-4 py-2 text-sm font-semibold text-white hover:bg-intelligence-accent-dark disabled:opacity-50"
              >
                <Search className="h-3 w-3" />
                应用筛选
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Search Suggestions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-theme-heading">快速搜索建议</h3>
        <div className="flex flex-wrap gap-2">
          {["德国LCL货代", "荷兰物流公司", "法国国际货运", "比利时报关服务", "欧洲到加拿大拼箱", "空运专家"].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setFilters(prev => ({ ...prev, query: suggestion }))}
              className="rounded-2xl border border-theme-border bg-theme-card px-3 py-2 text-sm text-theme-body hover:border-theme-border hover:bg-theme-card-muted"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t border-theme-border pt-6">
        <div className="text-sm text-theme-secondary">
          搜索到公司后，可批量导入到联系人 • 数据来源: 实时网络搜索（Gemini + 多引擎）与本地数据集
        </div>
        <div className="flex gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-2xl border border-theme-border bg-theme-card px-4 py-2 text-sm font-semibold text-theme-heading hover:bg-theme-card-muted"
          >
            <Download className="h-4 w-4" />
            导出结果
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-intelligence-accent px-4 py-2 text-sm font-semibold text-white hover:bg-intelligence-accent-dark"
          >
            <Upload className="h-4 w-4" />
            批量导入
          </button>
        </div>
      </div>
    </div>
  );
}