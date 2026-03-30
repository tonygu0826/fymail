import PgBoss from "pg-boss";
import { db } from "../config/database";
import { campaigns, outreachLogs } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { sendOutreachEmail } from "../services/mailer.service";
import { enqueueSingleEmail, JOBS } from "../services/queue.service";

interface SendEmailJob {
  logId: string;
  campaignId: string;
  contactId: string;
  senderAccountId: string;
  templateId: string;
}

interface ProcessCampaignJob {
  campaignId: string;
}

// ── Worker: send a single email ───────────────────────────────────────────────
export async function registerSendEmailWorker(boss: PgBoss) {
  await boss.work<SendEmailJob>(
    JOBS.SEND_EMAIL,
    { teamSize: 3, teamConcurrency: 1 },
    async (job) => {
      const { logId, campaignId, contactId, senderAccountId, templateId } = job.data;

      // Check campaign is still running
      const [campaign] = await db
        .select({ status: campaigns.status })
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1);

      if (!campaign || campaign.status !== "running") {
        console.log(`[worker] Campaign ${campaignId} is not running, skipping log ${logId}`);
        return;
      }

      await sendOutreachEmail({ logId, campaignId, contactId, senderAccountId, templateId });
      console.log(`[worker] Email sent for log ${logId}`);
    }
  );
}

// ── Worker: process a campaign (schedules all emails with intervals) ──────────
export async function registerProcessCampaignWorker(boss: PgBoss) {
  await boss.work<ProcessCampaignJob>(
    JOBS.PROCESS_CAMPAIGN,
    { teamSize: 1 },
    async (job) => {
      const { campaignId } = job.data;

      // Load campaign
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1);

      if (!campaign || campaign.status !== "running") {
        console.log(`[worker] Campaign ${campaignId} not in running state`);
        return;
      }

      // Get queued logs
      const queuedLogs = await db
        .select({
          id: outreachLogs.id,
          contactId: outreachLogs.contactId,
        })
        .from(outreachLogs)
        .where(
          and(
            eq(outreachLogs.campaignId, campaignId),
            eq(outreachLogs.status, "queued")
          )
        )
        .limit(campaign.dailyLimit ?? 50);

      if (queuedLogs.length === 0) {
        // Campaign complete
        await db
          .update(campaigns)
          .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
          .where(eq(campaigns.id, campaignId));
        console.log(`[worker] Campaign ${campaignId} completed`);
        return;
      }

      // Schedule emails with random intervals
      const minInterval = campaign.sendIntervalMin ?? 90;
      const maxInterval = campaign.sendIntervalMax ?? 180;

      let cumulativeDelay = 0;
      for (const log of queuedLogs) {
        const interval =
          Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
        cumulativeDelay += interval;

        await enqueueSingleEmail({
          logId: log.id,
          campaignId,
          contactId: log.contactId,
          senderAccountId: campaign.senderAccountId,
          templateId: campaign.templateId,
          delaySeconds: cumulativeDelay,
        });
      }

      console.log(
        `[worker] Campaign ${campaignId}: scheduled ${queuedLogs.length} emails over ~${Math.round(cumulativeDelay / 60)} min`
      );

      // Schedule next batch check after all emails sent + buffer
      const nextCheckDelay = cumulativeDelay + 60;
      await boss.sendAfter(
        JOBS.PROCESS_CAMPAIGN,
        { campaignId },
        {},
        nextCheckDelay
      );
    }
  );
}
