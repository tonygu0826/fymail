"use client";

import { SearchHistoryEntry, getSearchHistory, removeSearchHistoryEntry } from "@/lib/searchHistory";
import { Search, Clock, Trash2, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

interface SearchHistoryProps {
  onSelectSearch?: (entry: SearchHistoryEntry) => void;
  maxItems?: number;
}

export default function SearchHistory({ onSelectSearch, maxItems = 5 }: SearchHistoryProps) {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  
  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);
  
  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSearchHistoryEntry(id);
    setHistory(getSearchHistory());
  };
  
  const handleSelect = (entry: SearchHistoryEntry) => {
    if (onSelectSearch) {
      onSelectSearch(entry);
    }
  };
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };
  
  const displayed = history.slice(0, maxItems);
  
  if (displayed.length === 0) {
    return (
      <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-intelligence-accent-light p-3 mb-4">
            <Clock className="h-6 w-6 text-intelligence-accent" />
          </div>
          <h3 className="text-sm font-semibold text-theme-heading mb-1">暂无搜索历史</h3>
          <p className="text-sm text-theme-secondary">开始搜索后，您的搜索记录将显示在这里。</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-theme-heading">最近搜索</h3>
        <button
          onClick={() => {
            if (confirm('确定要清除所有搜索历史吗？')) {
              localStorage.removeItem('fymail_intelligence_search_history');
              setHistory([]);
            }
          }}
          className="text-xs text-theme-secondary hover:text-theme-heading"
        >
          清除全部
        </button>
      </div>
      
      <div className="space-y-3">
        {displayed.map((entry) => (
          <div
            key={entry.id}
            onClick={() => handleSelect(entry)}
            className="group cursor-pointer rounded-2xl border border-theme-border bg-theme-card p-4 hover:border-theme-border hover:bg-theme-card-muted transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="h-3 w-3 text-theme-secondary shrink-0" />
                  <span className="text-sm font-medium text-theme-heading truncate">
                    {entry.query || '无关键词'}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-theme-secondary mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(entry.timestamp)}
                  </span>
                  <span>•</span>
                  <span>{entry.totalResults} 个结果</span>
                  {entry.filters.countries.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{entry.filters.countries.length} 个国家</span>
                    </>
                  )}
                </div>
                
                {(entry.filters.countries.length > 0 || entry.filters.services.length > 0 || entry.filters.companySize.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {entry.filters.countries.map(country => (
                      <span key={country} className="inline-flex items-center rounded-full bg-intelligence-accent-light px-2 py-0.5 text-xs text-intelligence-accent">
                        {country}
                      </span>
                    ))}
                    {entry.filters.services.map(service => (
                      <span key={service} className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        {service}
                      </span>
                    ))}
                    {entry.filters.companySize.map(size => (
                      <span key={size} className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                        {size}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                onClick={(e) => handleRemove(entry.id, e)}
                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-theme-secondary hover:text-theme-heading"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {history.length > maxItems && (
        <div className="pt-2 border-t border-theme-border">
          <button
            onClick={() => setHistory(getSearchHistory())}
            className="text-xs text-intelligence-accent hover:text-intelligence-accent-dark font-medium"
          >
            显示全部 ({history.length})
          </button>
        </div>
      )}
    </div>
  );
}