"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { contactsApi } from "@/lib/api/contacts";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";

type Step = "upload" | "importing" | "done";

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    inserted: number;
    skipped: number;
    parseErrors: string[];
  } | null>(null);

  const mutation = useMutation({
    mutationFn: (f: File) => contactsApi.import(f),
    onSuccess: (res) => {
      setResult(res.data as any);
      setStep("done");
    },
    onError: () => setStep("upload"),
  });

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) return alert("Only CSV files supported");
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = () => {
    if (!file) return;
    setStep("importing");
    mutation.mutate(file);
  };

  return (
    <>
      <PageHeader
        title="Import Contacts"
        description="Upload a CSV file to bulk-import contacts into your pool"
        actions={
          <button
            onClick={() => router.push("/contacts")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Contacts
          </button>
        }
      />

      <div className="max-w-2xl">
        {/* Step: upload */}
        {step === "upload" && (
          <div className="space-y-5">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              {file ? (
                <>
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(1)} KB — click to change
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Drop CSV file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 10 MB · UTF-8 encoded
                  </p>
                </>
              )}
            </div>

            {/* CSV format guide */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                Required CSV format
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {["email*", "firstName", "lastName", "phone", "jobTitle", "country", "website", "serviceTypes", "tags", "notes"].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-muted-foreground">
                      <td className="px-2 py-1.5 font-mono">john@dhl.de</td>
                      <td className="px-2 py-1.5 font-mono">John</td>
                      <td className="px-2 py-1.5 font-mono">Müller</td>
                      <td className="px-2 py-1.5 font-mono">+49 170...</td>
                      <td className="px-2 py-1.5 font-mono">Manager</td>
                      <td className="px-2 py-1.5 font-mono">DE</td>
                      <td className="px-2 py-1.5 font-mono">dhl.de</td>
                      <td className="px-2 py-1.5 font-mono">LCL|FCL</td>
                      <td className="px-2 py-1.5 font-mono">germany|warm</td>
                      <td className="px-2 py-1.5 font-mono">Met at fair</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                * Required. Use <code className="bg-muted px-1 rounded">|</code> to separate multiple service types or tags.
                Duplicate emails are automatically skipped.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleImport}
                disabled={!file}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Import contacts
              </button>
            </div>
          </div>
        )}

        {/* Step: importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium text-foreground">Importing contacts...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Processing <strong>{file?.name}</strong>
            </p>
          </div>
        )}

        {/* Step: done */}
        {step === "done" && result && (
          <div className="space-y-5">
            <div className="border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <h3 className="text-sm font-semibold text-foreground">
                  Import complete
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-5">
                <StatCard label="Total rows" value={result.total} color="default" />
                <StatCard label="Imported" value={result.inserted} color="success" />
                <StatCard label="Skipped (duplicate)" value={result.skipped} color="warning" />
              </div>

              {result.parseErrors.length > 0 && (
                <div className="border border-red-200 dark:border-red-900 rounded-lg p-3 bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">
                      {result.parseErrors.length} row(s) had errors
                    </p>
                  </div>
                  <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                    {result.parseErrors.slice(0, 5).map((e, i) => (
                      <li key={i} className="font-mono">{e}</li>
                    ))}
                    {result.parseErrors.length > 5 && (
                      <li>...and {result.parseErrors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setStep("upload"); setFile(null); setResult(null); }}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
              >
                Import another file
              </button>
              <button
                onClick={() => router.push("/contacts")}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                View contacts
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "default" | "success" | "warning";
}) {
  return (
    <div className="border border-border rounded-lg p-3 text-center">
      <p
        className={cn(
          "text-2xl font-bold mb-0.5",
          color === "success" && "text-emerald-600 dark:text-emerald-400",
          color === "warning" && "text-amber-600 dark:text-amber-400",
          color === "default" && "text-foreground"
        )}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
