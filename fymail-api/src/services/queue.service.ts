import PgBoss from "pg-boss";
import { env } from "../config/env";

let boss: PgBoss | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    retentionDays: 7,
    monitorStateIntervalSeconds: 30,
  });

  boss.on("error", (err) => {
    console.error("[pg-boss] Error:", err);
  });

  await boss.start();
  console.log("[pg-boss] Queue started");
  return boss;
}

export async function stopQueue() {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}

// ── Job names ──────────────────────────────────────────────────────────────────
export const JOBS = {
  SEND_EMAIL: "send-email",
  PROCESS_CAMPAIGN: "process-campaign",
  REFRESH_CAMPAIGN_STATS: "refresh-campaign-stats",
} as const;

// ── Enqueue a campaign's send batch ───────────────────────────────────────────
export async function enqueueCampaignSend(campaignId: string) {
  const q = await getQueue();
  await q.send(JOBS.PROCESS_CAMPAIGN, { campaignId }, {
    retryLimit: 3,
    retryDelay: 60,
    expireInSeconds: 3600,
  });
  console.log(`[queue] Enqueued campaign ${campaignId}`);
}

// ── Enqueue a single email send ───────────────────────────────────────────────
export async function enqueueSingleEmail(payload: {
  logId: string;
  campaignId: string;
  contactId: string;
  senderAccountId: string;
  templateId: string;
  delaySeconds: number;
}) {
  const q = await getQueue();
  const { delaySeconds, ...data } = payload;
  await q.sendAfter(JOBS.SEND_EMAIL, data, {}, delaySeconds);
}
