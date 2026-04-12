"use client";

import { Search, Globe } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import DeepSearchPanel from "@/components/deep-search/DeepSearchPanel";

export default function DeepSearchPage() {
  return (
    <>
      <PageHeader
        eyebrow="深度搜索"
        title="欧洲货代公司发现"
        description="多源广域搜索：货代公司、行业协会目录、港口服务商、对加拿大出口企业、公司注册数据库。自动爬取官网提取邮箱联系方式，排除大型跨国物流巨头。"
        actions={
          <div className="flex items-center gap-2 rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-sm text-theme-secondary">
            <Globe className="h-4 w-4 text-intelligence-accent" />
            Tavily + Gemini + DuckDuckGo
          </div>
        }
      />

      <Panel
        title="深度搜索引擎"
        description="选择目标国家，启动后台搜索任务，实时查看进度和结果"
      >
        <DeepSearchPanel />
      </Panel>
    </>
  );
}
