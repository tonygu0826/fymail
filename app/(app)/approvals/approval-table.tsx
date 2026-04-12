"use client";

import { useState, useCallback } from "react";
import { CheckCircle, XCircle, Clock, Check, X, Mail } from "lucide-react";
import type { ApprovalBatch } from "./actions";
import { approveChunkAction, rejectChunkAction, revalidateApprovalPages } from "./actions";

const CHUNK_SIZE = 10;

type Progress = {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  action: "approve" | "reject";
};

type Props = {
  batches: ApprovalBatch[];
};

export function ApprovalTable({ batches }: Props) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const isProcessing = progress !== null;

  const totalPending = batches.reduce((sum, b) => sum + b.pendingCount, 0);

  const processInChunks = useCallback(async (ids: string[], action: "approve" | "reject", label: string) => {
    setResult(null);
    const total = ids.length;
    let sent = 0;
    let failed = 0;

    setProgress({ total, processed: 0, sent: 0, failed: 0, action });

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);

      if (action === "approve") {
        const res = await approveChunkAction(chunk);
        sent += res.sent;
        failed += res.failed;
      } else {
        const res = await rejectChunkAction(chunk);
        sent += res.rejected;
      }

      setProgress({ total, processed: Math.min(i + CHUNK_SIZE, total), sent, failed, action });
    }

    await revalidateApprovalPages();
    setProgress(null);

    if (action === "approve") {
      setResult({
        message: `${label}完成：${sent} 封发送成功${failed > 0 ? `，${failed} 封失败` : ""}`,
        tone: failed > 0 ? "error" : "success",
      });
    } else {
      setResult({ message: `${label}完成：已拒绝 ${sent} 封`, tone: "success" });
    }
  }, []);

  const pct = progress ? Math.round((progress.processed / progress.total) * 100) : 0;

  const statusBadge = (batch: ApprovalBatch) => (
    <div className="flex flex-wrap gap-2 text-xs">
      {batch.pendingCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
          <Clock className="h-3 w-3" /> 待审批 {batch.pendingCount}
        </span>
      )}
      {batch.approvedCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-green-700">
          <CheckCircle className="h-3 w-3" /> 已批准 {batch.approvedCount}
        </span>
      )}
      {batch.rejectedCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-red-700">
          <XCircle className="h-3 w-3" /> 已拒绝 {batch.rejectedCount}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 结果提示 */}
      {result && (
        <div className={`rounded-2xl border p-4 text-sm font-medium ${result.tone === "success" ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"}`}>
          {result.message}
        </div>
      )}

      {/* 进度条 */}
      {progress && (
        <div className="rounded-2xl border border-blue-300 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-blue-800">
              {progress.action === "approve" ? "批准发送中" : "拒绝处理中"}...
            </span>
            <span className="text-blue-700">
              {progress.processed} / {progress.total} ({pct}%)
              {progress.action === "approve" && progress.sent > 0 && (
                <span className="ml-2 text-green-700">✓ {progress.sent} 成功</span>
              )}
              {progress.failed > 0 && (
                <span className="ml-2 text-red-600">✗ {progress.failed} 失败</span>
              )}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* 全部待审批快捷操作 */}
      {totalPending > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-amber-800">共 {totalPending} 封邮件待审批</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => processInChunks(batches.flatMap(b => b.approvalIds), "approve", "全部批准")}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> 全部批准
            </button>
            <button
              onClick={() => processInChunks(batches.flatMap(b => b.approvalIds), "reject", "全部拒绝")}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> 全部拒绝
            </button>
          </div>
        </div>
      )}

      {/* 按批次显示 */}
      {batches.length > 0 ? (
        <div className="space-y-4">
          {batches.map((batch) => (
            <div key={batch.key} className="rounded-2xl border border-theme-border bg-theme-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-theme-secondary" />
                    <h3 className="font-semibold text-theme-heading">{batch.templateName}</h3>
                  </div>
                  <p className="mt-1 text-sm text-theme-secondary">
                    提交于 {new Date(batch.createdAt).toLocaleString()} · 共 {batch.totalCount} 封
                  </p>
                  <div className="mt-2">{statusBadge(batch)}</div>
                  {batch.sampleContacts.length > 0 && (
                    <p className="mt-2 text-xs text-theme-secondary">
                      收件人：{batch.sampleContacts.join(", ")}
                      {batch.totalCount > batch.sampleContacts.length && ` 等 ${batch.totalCount} 人`}
                    </p>
                  )}
                </div>

                {batch.pendingCount > 0 && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => processInChunks(batch.approvalIds, "approve", batch.templateName)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> 批准 {batch.pendingCount} 封
                    </button>
                    <button
                      onClick={() => processInChunks(batch.approvalIds, "reject", batch.templateName)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> 拒绝
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-green-400" />
          <p className="mt-3 text-sm text-theme-secondary">没有审批记录</p>
        </div>
      )}
    </div>
  );
}
