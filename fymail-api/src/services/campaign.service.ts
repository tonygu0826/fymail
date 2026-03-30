import { eq, inArray, sql, desc } from "drizzle-orm";
import { db } from "../config/database";
import { campaigns, outreachLogs, approvals, contacts } from "../db/schema";
import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string().uuid(),
  senderAccountId: z.string().uuid(),
  contactIds: z.array(z.string().uuid()).min(1),
  dailyLimit: z.number().int().min(1).max(500).default(50),
  sendIntervalMin: z.number().int().min(30).default(90),
  sendIntervalMax: z.number().int().min(30).default(180),
  scheduledAt: z.string().datetime().optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export class CampaignService {
  async list(filters: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 25 } = filters;
    const offset = (page - 1) * limit;

    return db
      .select()
      .from(campaigns)
      .where(status ? eq(campaigns.status, status as any) : undefined)
      .orderBy(desc(campaigns.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);
    return row ?? null;
  }

  async create(
    input: z.infer<typeof createCampaignSchema>,
    createdBy: string
  ) {
    const [campaign] = await db
      .insert(campaigns)
      .values({
        ...input,
        statTotal: input.contactIds.length,
        createdBy,
      })
      .returning();

    // Pre-create outreach log entries (queued)
    if (input.contactIds.length > 0) {
      await db.insert(outreachLogs).values(
        input.contactIds.map((contactId) => ({
          campaignId: campaign.id,
          contactId,
          status: "queued" as const,
        }))
      );
    }

    return campaign;
  }

  async update(id: string, input: z.infer<typeof updateCampaignSchema>) {
    const [row] = await db
      .update(campaigns)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return row ?? null;
  }

  // ── State transitions ──────────────────────────────────────────────────────

  async submit(id: string, requestedBy: string) {
    const campaign = await this.getById(id);
    if (!campaign || campaign.status !== "draft") {
      throw new Error("Campaign must be in draft status to submit");
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: "pending_approval", updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();

    // Create approval record
    await db.insert(approvals).values({
      campaignId: id,
      requestedBy,
    });

    return updated;
  }

  async approve(id: string, reviewerId: string, comment?: string) {
    const [updated] = await db
      .update(campaigns)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();

    await db
      .update(approvals)
      .set({
        status: "approved",
        reviewerId,
        comment,
        reviewedAt: new Date(),
      })
      .where(eq(approvals.campaignId, id));

    return updated;
  }

  async start(id: string) {
    const campaign = await this.getById(id);
    if (!campaign || campaign.status !== "approved") {
      throw new Error("Campaign must be approved before starting");
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();

    // TODO: enqueue pg-boss job to process send queue
    return updated;
  }

  async pause(id: string) {
    const [updated] = await db
      .update(campaigns)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async resume(id: string) {
    const [updated] = await db
      .update(campaigns)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async getLogs(
    campaignId: string,
    params: { page?: number; limit?: number; status?: string }
  ) {
    const { page = 1, limit = 50, status } = params;
    const offset = (page - 1) * limit;

    return db
      .select({
        id: outreachLogs.id,
        campaignId: outreachLogs.campaignId,
        contactId: outreachLogs.contactId,
        contactEmail: contacts.email,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        status: outreachLogs.status,
        subjectRendered: outreachLogs.subjectRendered,
        sentAt: outreachLogs.sentAt,
        openedAt: outreachLogs.openedAt,
        repliedAt: outreachLogs.repliedAt,
        bounceReason: outreachLogs.bounceReason,
        errorMessage: outreachLogs.errorMessage,
      })
      .from(outreachLogs)
      .leftJoin(contacts, eq(outreachLogs.contactId, contacts.id))
      .where(eq(outreachLogs.campaignId, campaignId))
      .orderBy(desc(outreachLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

export const campaignService = new CampaignService();
