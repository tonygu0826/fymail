import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../../config/database";
import { approvals, campaigns } from "../../db/schema";
import { z } from "zod";

// ── Service ───────────────────────────────────────────────────────────────────
const reviewSchema = z.object({ comment: z.string().optional() });
const requireCommentSchema = z.object({ comment: z.string().min(1) });

async function listApprovals(status?: string) {
  return db
    .select({
      id: approvals.id,
      campaignId: approvals.campaignId,
      campaignName: campaigns.name,
      status: approvals.status,
      requestedBy: approvals.requestedBy,
      reviewerId: approvals.reviewerId,
      reviewedAt: approvals.reviewedAt,
      comment: approvals.comment,
      createdAt: approvals.createdAt,
      contactCount: campaigns.statTotal,
      senderEmail: campaigns.senderAccountId,
      dailyLimit: campaigns.dailyLimit,
    })
    .from(approvals)
    .leftJoin(campaigns, eq(approvals.campaignId, campaigns.id))
    .where(status ? eq(approvals.status, status as any) : undefined)
    .orderBy(desc(approvals.createdAt));
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleList(request: FastifyRequest, reply: FastifyReply) {
  const { status } = request.query as any;
  const rows = await listApprovals(status);
  return reply.send({ data: rows, error: null });
}

async function handleGet(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const [row] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, request.params.id))
    .limit(1);
  if (!row) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Approval not found" } });
  return reply.send({ data: row, error: null });
}

async function handleApprove(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { comment } = reviewSchema.parse(request.body);

  const [approval] = await db
    .update(approvals)
    .set({ status: "approved", reviewerId: request.userId, comment, reviewedAt: new Date() })
    .where(eq(approvals.id, request.params.id))
    .returning();

  if (!approval) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Approval not found" } });

  // Advance campaign to approved
  await db
    .update(campaigns)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(campaigns.id, approval.campaignId));

  return reply.send({ data: approval, error: null });
}

async function handleReject(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { comment } = requireCommentSchema.parse(request.body);

  const [approval] = await db
    .update(approvals)
    .set({ status: "rejected", reviewerId: request.userId, comment, reviewedAt: new Date() })
    .where(eq(approvals.id, request.params.id))
    .returning();

  if (!approval) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Approval not found" } });

  await db
    .update(campaigns)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(campaigns.id, approval.campaignId));

  return reply.send({ data: approval, error: null });
}

async function handleRevision(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { comment } = requireCommentSchema.parse(request.body);

  const [approval] = await db
    .update(approvals)
    .set({ status: "revision_requested", reviewerId: request.userId, comment, reviewedAt: new Date() })
    .where(eq(approvals.id, request.params.id))
    .returning();

  if (!approval) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Approval not found" } });

  await db
    .update(campaigns)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(campaigns.id, approval.campaignId));

  return reply.send({ data: approval, error: null });
}

// ── Route registration ─────────────────────────────────────────────────────────
export async function approvalRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get("/approvals", { ...auth }, handleList);
  fastify.get("/approvals/:id", { ...auth }, handleGet);
  fastify.post("/approvals/:id/approve", { ...auth }, handleApprove);
  fastify.post("/approvals/:id/reject", { ...auth }, handleReject);
  fastify.post("/approvals/:id/request-revision", { ...auth }, handleRevision);
}
