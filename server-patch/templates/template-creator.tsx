"use client";

import { useState } from "react";
import { Eye, EyeOff, FileText } from "lucide-react";

// ── Preset Templates ──────────────────────────────────────────────────

interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  signature: string;
}

const PRESETS: PresetTemplate[] = [
  {
    id: "lcl-intro",
    name: "LCL 合作开发信",
    description: "面向欧洲货代，介绍加拿大 LCL 拼箱服务",
    subject: "Partnership Opportunity — LCL Import Consoles to Canada via {{companyName}}",
    bodyHtml: `<p>Dear {{contactName}},</p>

<p>I hope this message finds you well. My name is Tony from <strong>FENGYE LOGISTICS</strong>, based in Montreal, Canada.</p>

<p>I am reaching out to explore potential cooperation regarding your import consoles (LCL) originating from Europe to Canada. As an officially certified CBSA Sufferance Warehouse and Bonded Warehouse, we serve as a strategic hub for European freight forwarders seeking reliable destination handling and "last-mile" distribution in Canada.</p>

<p><strong>Why Route Your Montreal Consoles Through FENGYE LOGISTICS?</strong></p>

<ul>
  <li><strong>Official CBSA Status:</strong> Our facility is fully authorized for customs supervision and bonded storage, ensuring high compliance and reduced inspection delays.</li>
  <li><strong>Professional Devanning:</strong> We specialize in the rapid unstuffing and sorting of import consoles, maintaining cargo integrity for multiple consignees.</li>
  <li><strong>Strategic Gateway:</strong> Montreal is the primary entry point for European trade lanes; our location ensures your shipments bypass unnecessary inland delays.</li>
  <li><strong>Canada-Wide Transshipment:</strong> Post-devanning, we offer seamless inland transit via road and rail to Toronto, Vancouver, Calgary, and beyond.</li>
  <li><strong>Final Mile Delivery:</strong> Comprehensive local delivery services, including FBA (Amazon) appointments and residential/commercial tail-lift deliveries.</li>
</ul>

<p>We would be pleased to provide you with a competitive handling tariff for your upcoming Montreal consoles. Please feel free to send your inquiries or master BL details to our operations team.</p>

<p>We look forward to supporting your North American operations with our local expertise and official customs status.</p>`,
    signature: `<p>Best regards,</p>
<p><strong>Tony Gu</strong><br/>
Business Development<br/>
FENGYE LOGISTICS / FYWarehouse<br/>
Operations Desk: <a href="mailto:ops@fywarehouse.com">ops@fywarehouse.com</a><br/>
Website: <a href="https://fywarehouse.com">fywarehouse.com</a></p>`,
  },
  {
    id: "warehouse-intro",
    name: "仓储服务推介",
    description: "面向需要加拿大仓储的客户",
    subject: "Bonded Warehouse & Distribution Services in Montreal — {{companyName}}",
    bodyHtml: `<p>Dear {{contactName}},</p>

<p>I hope this email finds you well. I'm reaching out from <strong>FENGYE LOGISTICS</strong> in Montreal, Canada.</p>

<p>We noticed that {{companyName}} handles freight forwarding across European trade lanes, and I wanted to introduce our <strong>bonded warehouse and distribution capabilities</strong> here in Montreal.</p>

<p><strong>Our Services Include:</strong></p>

<ul>
  <li><strong>CBSA-Certified Bonded Warehouse:</strong> Customs-supervised storage with full compliance for import goods.</li>
  <li><strong>Container Devanning & Sorting:</strong> Efficient breakdown of LCL/FCL shipments with cargo verification.</li>
  <li><strong>Pick & Pack / Value-Added Services:</strong> Labeling, palletizing, re-packaging for final distribution.</li>
  <li><strong>Last-Mile Delivery:</strong> Canada-wide distribution including FBA prep and residential deliveries.</li>
</ul>

<p>We'd love to discuss how we can support your Canadian supply chain. Would you be available for a brief call this week?</p>`,
    signature: `<p>Kind regards,</p>
<p><strong>Tony Gu</strong><br/>
Business Development<br/>
FENGYE LOGISTICS / FYWarehouse<br/>
Email: <a href="mailto:ops@fywarehouse.com">ops@fywarehouse.com</a><br/>
Web: <a href="https://fywarehouse.com">fywarehouse.com</a></p>`,
  },
  {
    id: "follow-up",
    name: "跟进邮件",
    description: "首次联系后的跟进",
    subject: "Following Up — LCL Services in Canada for {{companyName}}",
    bodyHtml: `<p>Dear {{contactName}},</p>

<p>I wanted to follow up on my previous email regarding our warehouse and distribution services in Montreal, Canada.</p>

<p>I understand you may be busy, so I'll keep this brief — we help European freight forwarders with:</p>

<ul>
  <li>Bonded warehouse storage (CBSA-certified)</li>
  <li>LCL console devanning and sorting</li>
  <li>Canada-wide last-mile delivery</li>
</ul>

<p>If you have any upcoming shipments to Canada, I'd be happy to provide a competitive quote. Even a quick reply letting me know if this is relevant would be appreciated.</p>`,
    signature: `<p>Best regards,</p>
<p><strong>Tony Gu</strong><br/>
FENGYE LOGISTICS / FYWarehouse<br/>
<a href="mailto:ops@fywarehouse.com">ops@fywarehouse.com</a></p>`,
  },
  {
    id: "blank",
    name: "空白模板",
    description: "从零开始编写邮件",
    subject: "",
    bodyHtml: "",
    signature: `<p>Best regards,</p>
<p><strong>Your Name</strong><br/>
Your Title<br/>
Company Name<br/>
Email: <a href="mailto:your@email.com">your@email.com</a></p>`,
  },
];

// ── Component ─────────────────────────────────────────────────────────

export default function TemplateCreator({
  createAction,
}: {
  createAction: (formData: FormData) => Promise<void>;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [signature, setSignature] = useState(PRESETS[0].signature);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    setSubject(preset.subject);
    setBodyHtml(preset.bodyHtml);
    setSignature(preset.signature);
  };

  const fullHtml = signature
    ? `${bodyHtml}\n<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />\n${signature}`
    : bodyHtml;

  const handleSubmit = async () => {
    if (!subject || !bodyHtml) return;
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("bodyHtml", fullHtml);
    formData.set("bodyText", fullHtml.replace(/<[^>]+>/g, "\n").replace(/\n{3,}/g, "\n\n").trim());

    try {
      await createAction(formData);
    } catch {
      // redirect will throw
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* ── Preset Selection ── */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-theme-heading">选择模板样式</h4>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedPreset === p.id
                  ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                  : "border-theme-border bg-theme-card hover:border-teal-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-semibold text-theme-heading">{p.name}</span>
              </div>
              <p className="mt-1 text-xs text-theme-secondary">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Editor / Preview Toggle ── */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-theme-heading">
          {showPreview ? "邮件预览" : "编辑内容"}
        </h4>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-theme-border px-3 py-1.5 text-xs font-medium text-theme-secondary hover:bg-theme-card-muted"
        >
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPreview ? "返回编辑" : "预览邮件"}
        </button>
      </div>

      {showPreview ? (
        /* ── Preview Mode ── */
        <div className="overflow-hidden rounded-2xl border border-theme-border bg-white shadow-sm">
          {/* Email header */}
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium text-gray-700">Subject:</span>
              <span>{subject || "(未填写主题)"}</span>
            </div>
          </div>
          {/* Email body */}
          <div
            className="px-6 py-6 text-sm leading-relaxed text-gray-800"
            style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
            dangerouslySetInnerHTML={{ __html: fullHtml || "<p style='color:#999'>（正文为空）</p>" }}
          />
        </div>
      ) : (
        /* ── Edit Mode ── */
        <div className="overflow-hidden rounded-2xl border border-theme-border">
          {/* Subject */}
          <div className="border-b border-theme-border bg-theme-card-muted px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-sm font-medium text-theme-secondary">主题</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="输入邮件主题..."
                className="flex-1 bg-transparent text-sm text-theme-heading outline-none placeholder:text-theme-secondary/50"
              />
            </div>
          </div>

          {/* Body HTML */}
          <div className="px-5 py-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-theme-secondary">正文内容（HTML）</span>
              <span className="text-[10px] text-theme-secondary">支持 HTML 标签：&lt;p&gt; &lt;ul&gt; &lt;li&gt; &lt;strong&gt; &lt;a&gt;</span>
            </div>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<p>Dear {{contactName}},</p>&#10;&#10;<p>邮件正文...</p>"
              rows={14}
              className="w-full rounded-xl border border-theme-border bg-theme-card px-4 py-3 font-mono text-xs leading-relaxed text-theme-heading placeholder:text-theme-secondary/50 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Signature */}
          <div className="border-t border-dashed border-theme-border/60 px-5 py-4">
            <div className="mb-2">
              <span className="text-xs font-medium text-theme-secondary">邮件签名（HTML）</span>
            </div>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-theme-border bg-theme-card-muted px-4 py-3 font-mono text-xs leading-relaxed text-theme-heading placeholder:text-theme-secondary/50 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end border-t border-theme-border bg-theme-card-muted/50 px-5 py-3">
            <button
              onClick={handleSubmit}
              disabled={!subject || !bodyHtml || isSubmitting}
              className="inline-flex items-center justify-center rounded-2xl bg-theme-button px-5 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover disabled:opacity-50"
            >
              {isSubmitting ? "保存中..." : "保存模板"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
