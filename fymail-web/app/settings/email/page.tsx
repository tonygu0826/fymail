"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { campaignsApi, SenderAccount } from "@/lib/api/campaigns";
import { apiClient } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils/cn";

const inputCls =
  "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

const blankForm = {
  name: "", email: "", smtpHost: "", smtpPort: 587,
  smtpUser: "", smtpPass: "", dailyLimit: 50,
};

export default function SettingsEmailPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["sender-accounts"],
    queryFn: () => campaignsApi.senderAccounts(),
  });

  const createMutation = useMutation({
    mutationFn: (d: typeof blankForm) =>
      apiClient.post("/settings/sender-accounts", d).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sender-accounts"] });
      setShowAdd(false);
      setForm(blankForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/settings/sender-accounts/${id}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sender-accounts"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient
        .post<any>(`/settings/sender-accounts/${id}/test`)
        .then((r) => r.data.data.success as boolean),
    onSuccess: (ok, id) =>
      setTestResults((p) => ({ ...p, [id]: ok })),
  });

  const accounts = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Email Accounts"
        description="配置活动发件邮箱账号"
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加账号
          </button>
        }
      />

      {/* Existing accounts */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : accounts.length === 0 && !showAdd ? (
        <EmptyState
          icon={Mail}
          title="暂无邮件账号"
          description="添加SMTP账号以开始发送活动邮件."
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" /> 添加账号
            </button>
          }
        />
      ) : (
        <div className="space-y-3 mb-6">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              testResult={testResults[account.id]}
              onTest={() => testMutation.mutate(account.id)}
              onDelete={() => {
                if (confirm(`Remove ${account.email}?`)) deleteMutation.mutate(account.id);
              }}
              testing={testMutation.isPending && testMutation.variables === account.id}
            />
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="border border-border rounded-xl p-5 bg-card max-w-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">新增SMTP账号</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account name">
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="ops@fywarehouse" className={inputCls} />
              </Field>
              <Field label="From email *">
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="ops@fywarehouse.com" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="SMTP host *">
                  <input value={form.smtpHost} onChange={(e) => setForm((p) => ({ ...p, smtpHost: e.target.value }))} placeholder="smtp.gmail.com" className={inputCls} />
                </Field>
              </div>
              <Field label="Port">
                <input type="number" value={form.smtpPort} onChange={(e) => setForm((p) => ({ ...p, smtpPort: Number(e.target.value) }))} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SMTP username *">
                <input value={form.smtpUser} onChange={(e) => setForm((p) => ({ ...p, smtpUser: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="SMTP password *">
                <input type="password" value={form.smtpPass} onChange={(e) => setForm((p) => ({ ...p, smtpPass: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            <Field label="Daily send limit">
              <input type="number" value={form.dailyLimit} onChange={(e) => setForm((p) => ({ ...p, dailyLimit: Number(e.target.value) }))} min={1} max={500} className={inputCls} />
            </Field>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => { setShowAdd(false); setForm(blankForm); }}
              className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.email || !form.smtpHost || !form.smtpUser || !form.smtpPass || createMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              保存账号
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function AccountRow({
  account, testResult, onTest, onDelete, testing,
}: {
  account: SenderAccount;
  testResult: boolean | null | undefined;
  onTest: () => void;
  onDelete: () => void;
  testing: boolean;
}) {
  return (
    <div className="flex items-center gap-4 border border-border rounded-xl px-4 py-3 bg-card">
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{account.name}</p>
        <p className="text-xs text-muted-foreground">
          {account.email} · Limit: {account.dailyLimit}/day
        </p>
      </div>
      {testResult !== undefined && testResult !== null && (
        <div className="flex items-center gap-1.5">
          {testResult ? (
            <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-emerald-600">Connected</span></>
          ) : (
            <><XCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-red-600">Failed</span></>
          )}
        </div>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={onTest}
          disabled={testing}
          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Test
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
