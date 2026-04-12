#!/usr/bin/env node
/**
 * LinkedIn Daily Action Plan — sends Tony a daily reminder email with:
 *   - today's LinkedIn tasks (post, engagement, connection targets)
 *   - the full draft post copy to paste
 *   - recommended connection types
 *
 * Content cycles on day-of-week (Montreal time).
 * Sends via Resend from ops@fywarehouse.com → tonygu0826@gmail.com.
 *
 * Cron: 0 12 * * *   (UTC 12:00 = Montreal 8:00 AM EDT / 7:00 AM EST)
 * Log:  /var/log/linkedin-reminder.log
 */

import { readFileSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = '/var/log/linkedin-reminder.log';

// ---------------------------------------------------------------------------
// Env loading (.env.local from fymail root)
// ---------------------------------------------------------------------------
try {
  const envPath = resolve(__dirname, '..', '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  /* ok — env may come from the cron environment */
}

// ---------------------------------------------------------------------------
// Logging helper — writes to /var/log/linkedin-reminder.log and stdout.
// ---------------------------------------------------------------------------
function log(level, msg, extra) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}${
    extra ? ' ' + JSON.stringify(extra) : ''
  }\n`;
  try {
    appendFileSync(LOG_PATH, line);
  } catch {
    /* fall back silently — stdout still works under cron */
  }
  process.stdout.write(line);
}

// ---------------------------------------------------------------------------
// Weekly content library — index 0 = Sunday … index 6 = Saturday
// (JS Date.getDay() convention).
// ---------------------------------------------------------------------------
const WEEK = {
  monday: {
    mode: 'post',
    theme: 'CETA tariff savings for European exporters',
    tasks: [
      'Publish today\'s LinkedIn post (copy below)',
      'Engage with 5 comments on the post within 2 hours',
      'Send 3 connection requests to German freight forwarders',
      'Spend 15 min scrolling feed, like 5 relevant posts',
    ],
    connections: {
      country: 'Germany',
      count: 3,
      profile:
        'Freight forwarders or Außenhandelsleiter at German mid-market exporters. Target companies shipping automotive parts, machinery, or food to North America. Search filters: "Freight Forwarder" + "Germany" + "Canada"; or "Export Manager" + "Germany" + "Transatlantic".',
    },
    post: `🇪🇺→🇨🇦 If you're a European exporter still paying MFN duty on shipments into Canada, you're leaving real money on the table.

Under CETA (Canada-EU Comprehensive Economic and Trade Agreement), 98% of tariff lines are duty-free for goods of EU origin — but only if you claim the preference correctly.

What I see most often with new clients:
→ No origin declaration on the commercial invoice
→ No REX number cited (required for shipments >€6,000)
→ Wrong HS classification that doesn't match the preference rule
→ CBSA rejecting the claim months later, with interest owed

The good news: Canada's refund window is 4 years. If you've been overpaying, you can usually claim it back.

One German client saved CAD $180,000 on two years of machinery imports just by fixing their CETA declaration workflow. The paperwork took about three hours.

If you're exporting to Canada and not sure whether CETA is being applied correctly, DM me — I'll review one of your commercial invoices for free and tell you exactly what's missing.

#CETA #EUCanada #CustomsBrokerage #FreightForwarding #InternationalTrade #Logistics #Export #Canada #TradeCompliance`,
  },
  tuesday: {
    mode: 'post',
    theme: 'Sufferance vs bonded warehouse explained',
    tasks: [
      'Publish today\'s LinkedIn post (copy below)',
      'Reply to every comment on yesterday\'s post',
      'Send 3 connection requests to Dutch freight forwarders',
      'Check notifications, accept any relevant incoming invites',
    ],
    connections: {
      country: 'Netherlands',
      count: 3,
      profile:
        'Forwarders, customs agents, and operations managers at companies around the Port of Rotterdam. Target: "Douane-expediteur", "Forwarding agent Rotterdam", "Export Manager Netherlands". Bias toward companies already shipping to North America.',
    },
    post: `Sufferance warehouse vs bonded warehouse — importers confuse these constantly, and the difference costs real money. Here's the 60-second version.

🏭 SUFFERANCE WAREHOUSE
A CBSA-licensed facility where in-bond cargo can sit temporarily (up to 40 days) before it's either released or moved to another customs location. Think of it as a waiting room: the goods are inside Canada, but they haven't been "imported" yet. No duty, no GST — yet. Perfect for cargo awaiting classification review, document fixes, or a decision on whether to re-export.

🏭 BONDED WAREHOUSE
A CBSA-licensed facility where goods can be stored for up to 4 years without paying duty or GST. The clock doesn't start until the goods leave the warehouse into Canadian commerce. Great for staging inventory you'll distribute regionally, or for goods destined for re-export.

When to use which:
→ Sufferance: short-term, you're fixing paperwork
→ Bonded: long-term, you're deferring cash outflow

At FENGYE LOGISTICS in Montreal, we run both under one roof — which means if a customer starts in sufferance and needs to convert to bonded, we do it in place, no second cartage.

Question: how many Canadian importers do you know who use bonded for cash-flow reasons? Drop a comment.

#CustomsBrokerage #BondedWarehouse #Logistics #SupplyChain #Canada #ImportExport #CBSA #Montreal #FreightForwarding`,
  },
  wednesday: {
    mode: 'post',
    theme: 'Port of Montreal for European trade',
    tasks: [
      'Publish today\'s LinkedIn post (copy below)',
      'Engage with 8 posts in the #Logistics and #SupplyChain hashtags',
      'Send 3 connection requests to French freight forwarders',
      'Comment on 2 posts from people you connected with this week',
    ],
    connections: {
      country: 'France',
      count: 3,
      profile:
        'Transitaires, commissionnaires en douane, and responsables export at French companies around Le Havre and Marseille. Target: "Transitaire", "Commissionnaire en douane", "Export Manager France". French-Canadian bilingual profiles are a bonus.',
    },
    post: `Why does the Port of Montreal beat every other Canadian port for European trade? Three reasons most US-focused importers miss:

1️⃣ GEOGRAPHY. Montreal is the closest full-service container port to Europe on the North American continent. Transatlantic transit from Antwerp or Hamburg is 7–9 days. Compare that to 14+ days for West Coast ports via Panama, and you see why European importers route through Montreal when time matters.

2️⃣ RAIL REACH. Canadian National and Canadian Pacific both terminate at Montreal, giving direct intermodal reach to Toronto (5 hours), Chicago (24 hours), and the US Midwest (36 hours). For European exporters targeting the Great Lakes region, Montreal often beats New York/New Jersey on door-to-door cost.

3️⃣ BILINGUAL OPERATIONS. It's the only Canadian port where French-language documentation and French-speaking operations teams are the norm. For European exporters whose paperwork arrives in French, Italian, or Spanish, that's one less translation layer.

Fun fact: Montreal's port handles more than 1.6 million TEUs a year, and roughly 40% of that volume comes from Europe.

If you're a European exporter shipping to North America and not evaluating Montreal as your entry port, you're probably paying too much. Happy to talk through a lane comparison — just DM.

#PortOfMontreal #Logistics #EuropeanTrade #SupplyChain #CustomsBrokerage #Canada #FreightForwarding #Intermodal #Montreal`,
  },
  thursday: {
    mode: 'engagement',
    theme: 'Engagement day — no new post',
    tasks: [
      'Like 10 posts in your feed from target industries (logistics, customs, European trade)',
      'Leave 3 thoughtful comments (2+ sentences each) on posts from prospects or existing connections',
      'Send 2 connection requests to Belgian freight forwarders',
      'Reshare 1 valuable industry post with your own 1-paragraph take',
      'Spend 10 min checking who viewed your profile this week — send a connection request to 2–3 relevant viewers',
    ],
    connections: {
      country: 'Belgium',
      count: 2,
      profile:
        'Forwarders and customs agents at companies around the Port of Antwerp — the second-largest port in Europe. Target: "Forwarding agent Antwerp", "Customs broker Belgium", "Export Manager Antwerp". Antwerp handles huge transatlantic volume, so this is high-leverage.',
    },
    post: null,
  },
  friday: {
    mode: 'post',
    theme: 'Common mistakes when importing to Canada',
    tasks: [
      'Publish today\'s LinkedIn post (copy below)',
      'Post is the most engagement-friendly of the week — be ready to reply fast',
      'Send 3 connection requests to Italian freight forwarders',
      'Wrap up the week: review which posts performed best, note for next week',
    ],
    connections: {
      country: 'Italy',
      count: 3,
      profile:
        'Spedizionieri and export managers at Italian companies around Genoa, Livorno, and Milan. Target: "Spedizioniere", "Export Manager Italia", "Freight Forwarder Italy". Italian exports to Canada skew heavily toward food, fashion, and machinery.',
    },
    post: `5 mistakes I see European exporters make when shipping to Canada — every single week.

❌ 1. Using the 6-digit HS code from their own country.
Canada's HS tariff is 10 digits. The last 4 digits are specific to the Canadian tariff schedule. If your commercial invoice shows a 6-digit code, your broker has to guess the last 4 — and guesses cost money.

❌ 2. Declaring origin as "Made in EU".
There is no such country. CBSA requires a specific member state (Germany, France, Italy, etc.) for CETA preference to apply. "Made in EU" gets you MFN duty.

❌ 3. Forgetting the REX number on shipments >€6,000.
Under CETA, EU exporters need a Registered Exporter (REX) number to claim preference. No REX, no preference, full duty.

❌ 4. Incoterms ambiguity.
"DAP Montreal" doesn't specify who clears customs. If your Canadian buyer isn't set up as importer of record, your shipment sits in sufferance. Use DDP if you want the door-to-door experience, or be explicit about who files the entry.

❌ 5. Ignoring OGD (Other Government Department) permits.
Food, cosmetics, electronics, wood packaging — all need permits or certifications beyond CBSA. CFIA, Health Canada, ECCC. Missing paperwork = 5-day delay minimum.

Which of these have you run into? Curious to hear war stories in the comments. 👇

#CustomsBrokerage #ImportExport #Canada #CETA #InternationalTrade #Logistics #SupplyChain #EUexports #FreightForwarding`,
  },
  saturday: {
    mode: 'rest',
    theme: 'Rest day — light engagement only',
    tasks: [
      'Browse LinkedIn feed for 10–15 min, no pressure',
      'Like 5 posts from connections (no comments needed)',
      'Do NOT send connection requests today — save the quota for weekday targeting',
      'Do NOT post — Saturday reach is the worst of the week',
      'Optional: bookmark 1–2 interesting posts for Monday\'s response',
    ],
    connections: null,
    post: null,
  },
  sunday: {
    mode: 'post',
    theme: 'Week recap / industry insight',
    tasks: [
      'Publish today\'s LinkedIn post (copy below) — aim for Sunday evening Montreal time',
      'Comment thoughtfully on 3 industry posts from the weekend',
      'Send 2 connection requests to Polish freight forwarders',
      'Plan next week: check Monday\'s post theme and draft any tweaks needed',
    ],
    connections: {
      country: 'Poland',
      count: 2,
      profile:
        'Forwarders and export managers at Polish companies, particularly around Gdansk. Target: "Spedytor", "Export Manager Poland", "Freight Forwarder Gdansk". Polish manufacturing exports to Canada are growing 15% year over year.',
    },
    post: `Week recap: three things I learned talking to European exporters about Canada this week. 🧵

1️⃣ Most of them have no idea how CBSA's CARM system changed the game. Under CARM, importers post their own financial security — not their broker. European exporters setting up as Non-Resident Importers are getting caught off-guard because their broker "used to handle it." Under CARM, the importer of record (you) is the responsible party. If you're exporting to Canada under DDP and haven't posted CARM security, your shipments will stall.

2️⃣ Ocean carrier contracts for 2026 are softening fast. Rates Antwerp → Montreal are down ~18% from Q4 2025. If you signed an annual contract in October, you're overpaying. Good time to re-negotiate or benchmark against spot.

3️⃣ The Port of Montreal's new automated terminal at Contrecœur is on track for 2027 and will add ~1.15M TEU capacity. For European exporters, that means less congestion and faster dwell times on the east coast. Worth factoring into 2026–2027 supply chain planning.

The common thread: the rules for importing into Canada keep moving, and most European teams don't have anyone watching the changes full-time. That's the gap we fill — half of our customers only call us after they've already gotten burned.

What trade shifts are you tracking for 2026? Curious to hear in the comments.

#InternationalTrade #Logistics #CustomsBrokerage #EuropeanTrade #Canada #CARM #SupplyChain #PortOfMontreal #FreightForwarding`,
  },
};

// JS getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ---------------------------------------------------------------------------
// Date helpers — everything is computed in Montreal (America/Toronto) time.
// ---------------------------------------------------------------------------
function getMontrealParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const weekdayName = parts.weekday.toLowerCase();
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;
  return { weekdayName, isoDate, prettyDate: `${parts.weekday}, ${parts.year}-${parts.month}-${parts.day}` };
}

// ---------------------------------------------------------------------------
// Render plain-text + HTML email from the day's plan.
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPlan(plan, prettyDate) {
  const lines = [];
  lines.push(`Daily LinkedIn Action Plan — ${prettyDate}`);
  lines.push('');
  lines.push(`MODE: ${plan.mode.toUpperCase()}`);
  lines.push(`THEME: ${plan.theme}`);
  lines.push('');
  lines.push("TODAY'S TASKS");
  lines.push('-------------');
  plan.tasks.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  lines.push('');

  if (plan.connections) {
    lines.push('CONNECTIONS TO ADD');
    lines.push('------------------');
    lines.push(`Country: ${plan.connections.country}`);
    lines.push(`Count:   ${plan.connections.count}`);
    lines.push(`Profile: ${plan.connections.profile}`);
    lines.push('');
  }

  if (plan.post) {
    lines.push('POST COPY (ready to paste)');
    lines.push('--------------------------');
    lines.push(plan.post);
    lines.push('');
  }

  lines.push('— Sent by linkedin-daily-reminder.mjs on ' + new Date().toISOString());
  return lines.join('\n');
}

function renderHtml(plan, prettyDate) {
  const taskList = plan.tasks.map((t) => `<li style="margin-bottom:6px">${escapeHtml(t)}</li>`).join('');
  const modeColor = { post: '#C41E3A', engagement: '#E8A13A', rest: '#6b7280' }[plan.mode] || '#C41E3A';

  const connectionsBlock = plan.connections
    ? `
      <h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:18px;color:#2B1E0F;margin:32px 0 8px">Connections to Add</h2>
      <table style="width:100%;border-collapse:collapse;background:#FAF6EF;border-radius:8px">
        <tr>
          <td style="padding:12px 16px;border-right:1px solid #F0E9DB"><strong>Country</strong><br>${escapeHtml(plan.connections.country)}</td>
          <td style="padding:12px 16px"><strong>Count</strong><br>${plan.connections.count}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:12px 16px;border-top:1px solid #F0E9DB;font-size:14px;color:#5a4a37">${escapeHtml(plan.connections.profile)}</td>
        </tr>
      </table>`
    : '';

  const postBlock = plan.post
    ? `
      <h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:18px;color:#2B1E0F;margin:32px 0 8px">Post Copy (ready to paste)</h2>
      <div style="background:#fff;border:1px solid #F0E9DB;border-left:4px solid #C41E3A;border-radius:8px;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#2B1E0F;white-space:pre-wrap">${escapeHtml(plan.post)}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Daily LinkedIn Action Plan</title></head>
<body style="margin:0;padding:0;background:#F0E9DB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#2B1E0F">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0E9DB;padding:24px 0">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#FAF6EF;border-radius:12px;overflow:hidden;max-width:640px">
        <tr><td style="background:#2B1E0F;padding:24px 32px">
          <div style="font-family:'Space Grotesk',Arial,sans-serif;font-size:20px;font-weight:700;color:#FAF6EF">
            <span style="color:#C41E3A">FENGYE</span> LOGISTICS
          </div>
          <div style="font-size:13px;color:#E8A13A;margin-top:4px;letter-spacing:0.1em;text-transform:uppercase">Daily LinkedIn Action Plan</div>
        </td></tr>

        <tr><td style="padding:32px">
          <div style="font-size:13px;color:#5a4a37;letter-spacing:0.08em;text-transform:uppercase">${escapeHtml(prettyDate)}</div>
          <div style="margin-top:8px">
            <span style="display:inline-block;background:${modeColor};color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:0.1em;text-transform:uppercase">${escapeHtml(plan.mode)}</span>
          </div>
          <h1 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:26px;font-weight:700;color:#2B1E0F;margin:12px 0 0">${escapeHtml(plan.theme)}</h1>

          <h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:18px;color:#2B1E0F;margin:32px 0 8px">Today's Tasks</h2>
          <ol style="padding-left:20px;font-size:15px;line-height:1.6;color:#2B1E0F;margin:0">${taskList}</ol>

          ${connectionsBlock}
          ${postBlock}

          <hr style="border:0;border-top:1px solid #F0E9DB;margin:32px 0">
          <div style="font-size:12px;color:#5a4a37">Sent by <code>linkedin-daily-reminder.mjs</code> · ${escapeHtml(new Date().toISOString())}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send via Resend.
// ---------------------------------------------------------------------------
async function sendViaResend({ subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FENGYE LOGISTICS <ops@fywarehouse.com>',
      to: ['tonygu0826@gmail.com'],
      subject,
      text,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend API ${response.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data.id || null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { weekdayName, isoDate, prettyDate } = getMontrealParts();
  const plan = WEEK[weekdayName];
  if (!plan) {
    log('ERROR', 'No plan found for weekday', { weekdayName });
    process.exit(1);
  }

  log('INFO', 'Preparing LinkedIn daily reminder', { weekdayName, mode: plan.mode, theme: plan.theme });

  const subject = `Daily LinkedIn Action Plan - ${isoDate}`;
  const text = renderPlan(plan, prettyDate);
  const html = renderHtml(plan, prettyDate);

  try {
    const messageId = await sendViaResend({ subject, text, html });
    log('INFO', 'Email sent', { messageId, to: 'tonygu0826@gmail.com', weekday: weekdayName });
  } catch (err) {
    log('ERROR', 'Email send failed', { error: err?.message || String(err) });
    process.exit(2);
  }
}

main().catch((err) => {
  log('ERROR', 'Unhandled error', { error: err?.message || String(err) });
  process.exit(3);
});
