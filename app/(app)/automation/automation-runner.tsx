"use client";

import { useState } from "react";
import { Play, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, History } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { runAutomationAction, getRunHistory, getTotalContactCount } from "./actions";

type StepStatus = "pending" | "running" | "completed" | "failed";

interface AutomationStep {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  result?: string;
  duration?: number;
}

const defaultSteps: AutomationStep[] = [
  { id: "deduplication", name: "去重", description: "基于邮箱、公司名、域名等多维度移除重复联系人", status: "pending" },
  { id: "scoring", name: "统计", description: "统计就绪联系人数据", status: "pending" },
];

type Props = {
  initialContactCount: number;
  initialHistory: any[];
};

export function AutomationRunner({ initialContactCount, initialHistory }: Props) {
  const [steps, setSteps] = useState<AutomationStep[]>(defaultSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [runHistory, setRunHistory] = useState<any[]>(initialHistory);
  const [contactCount, setContactCount] = useState(initialContactCount);

  const runAutomation = async () => {
    setIsRunning(true);
    setSteps(defaultSteps.map((s) => ({ ...s, status: "running" as StepStatus })));
    setSummary(null);
    setErrors([]);

    try {
      const data = await runAutomationAction();

      const updatedSteps = [...defaultSteps];
      for (const rs of data.steps) {
        const idx = updatedSteps.findIndex((s) => s.id === rs.step);
        if (idx >= 0) {
          updatedSteps[idx] = {
            ...updatedSteps[idx],
            status: rs.status === "completed" ? "completed" : rs.status === "failed" ? "failed" : "pending",
            result: rs.message,
            duration: rs.duration ? rs.duration / 1000 : undefined,
          };
        }
      }
      setSteps(updatedSteps);
      setSummary(data.summary);
      setErrors(data.errors || []);

      const [history, count] = await Promise.all([getRunHistory(), getTotalContactCount()]);
      setRunHistory(history);
      setContactCount(count);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "未知错误"]);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "failed" as StepStatus })));
    } finally {
      setIsRunning(false);
    }
  };

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "running": return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case "failed": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <section className="space-y-6">
      {errors.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
          <h4 className="font-semibold text-red-800">运行错误</h4>
          <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* 运行配置 */}
      <Panel title="数据处理" description="对所有联系人执行去重，删除重复项">
        <div className="space-y-4">
          <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-sm text-theme-body">
                当前共 <span className="font-semibold text-theme-heading">{contactCount}</span> 个联系人。
                去重会直接删除重复的联系人记录。
              </p>
            </div>
          </div>

          <button type="button" onClick={runAutomation} disabled={isRunning} className="inline-flex items-center gap-2 rounded-2xl bg-theme-button px-5 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover disabled:opacity-50">
            <Play className="h-4 w-4" />
            {isRunning ? "运行中..." : "运行去重"}
          </button>
        </div>
      </Panel>

      {/* 工作流步骤 */}
      <Panel title="执行步骤">
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="rounded-2xl border border-theme-border bg-theme-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {statusIcon(step.status)}
                  <div>
                    <h4 className="font-semibold text-theme-heading">{step.name}</h4>
                    <p className="mt-1 text-sm text-theme-body">{step.description}</p>
                    {step.result && <p className="mt-2 text-sm font-medium text-theme-heading">{step.result}</p>}
                  </div>
                </div>
                {step.duration != null && <span className="text-xs text-theme-secondary">{step.duration.toFixed(1)}s</span>}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* 运行摘要 */}
      {summary && (
        <Panel title="运行摘要">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-theme-border bg-theme-card p-4">
              <p className="text-sm text-theme-secondary">处理联系人</p>
              <p className="mt-1 text-2xl font-semibold text-theme-heading">{summary.totalContacts}</p>
            </div>
            <div className="rounded-2xl border border-theme-border bg-theme-card p-4">
              <p className="text-sm text-theme-secondary">去除重复</p>
              <p className="mt-1 text-2xl font-semibold text-theme-heading">{summary.duplicatesRemoved}</p>
            </div>
            <div className="rounded-2xl border border-theme-border bg-theme-card p-4">
              <p className="text-sm text-theme-secondary">就绪联系人</p>
              <p className="mt-1 text-2xl font-semibold text-theme-heading">{summary.uniqueContacts}</p>
            </div>
          </div>
        </Panel>
      )}

      {/* 运行历史 */}
      <Panel title="运行历史">
        {runHistory.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-theme-border">
            <table className="min-w-full divide-y divide-theme-border text-sm">
              <thead className="bg-theme-card-muted">
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-theme-secondary">
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3">联系人</th>
                  <th className="px-4 py-3">去重</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border bg-theme-card">
                {runHistory.map((run: any) => (
                  <tr key={run.id}>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-2 py-1 text-xs font-medium" style={{
                        backgroundColor: run.status === "COMPLETED" ? "#D1FAE5" : "#FEE2E2",
                        color: run.status === "COMPLETED" ? "#065F46" : "#991B1B",
                      }}>
                        {run.status === "COMPLETED" ? "已完成" : "失败"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-theme-body">{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-theme-body">{(run.metrics as any)?.totalContacts ?? "—"}</td>
                    <td className="px-4 py-3 text-theme-body">{(run.metrics as any)?.duplicatesRemoved ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <History className="mx-auto h-8 w-8 text-theme-secondary" />
            <p className="mt-3 text-sm text-theme-secondary">暂无运行记录</p>
          </div>
        )}
      </Panel>
    </section>
  );
}
