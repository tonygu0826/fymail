import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq, asc } from "drizzle-orm";
import { db } from "../../config/database";
import { automationRules } from "../../db/schema";
import { z } from "zod";

const conditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.string().optional(),
});

const actionSchema = z.object({
  type: z.string(),
  params: z.record(z.union([z.string(), z.number()])),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  isEnabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
  triggerType: z.enum([
    "contact_created",
    "contact_imported",
    "campaign_replied",
    "status_changed",
    "score_changed",
  ]),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).min(1),
});

const updateRuleSchema = createRuleSchema.partial();

// ── Handlers ──────────────────────────────────────────────────────────────────
async function listRules(_req: FastifyRequest, reply: FastifyReply) {
  const rows = await db
    .select()
    .from(automationRules)
    .orderBy(asc(automationRules.priority));
  return reply.send({ data: rows, error: null });
}

async function getRule(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const [row] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, request.params.id))
    .limit(1);
  if (!row)
    return reply.status(404).send({
      data: null,
      error: { code: "NOT_FOUND", message: "Rule not found" },
    });
  return reply.send({ data: row, error: null });
}

async function createRule(request: FastifyRequest, reply: FastifyReply) {
  const input = createRuleSchema.parse(request.body);
  const [row] = await db
    .insert(automationRules)
    .values({ ...input, createdBy: request.userId })
    .returning();
  return reply.status(201).send({ data: row, error: null });
}

async function updateRule(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const input = updateRuleSchema.parse(request.body);
  const [row] = await db
    .update(automationRules)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(automationRules.id, request.params.id))
    .returning();
  if (!row)
    return reply.status(404).send({
      data: null,
      error: { code: "NOT_FOUND", message: "Rule not found" },
    });
  return reply.send({ data: row, error: null });
}

async function deleteRule(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await db
    .delete(automationRules)
    .where(eq(automationRules.id, request.params.id));
  return reply.status(204).send();
}

async function toggleRule(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const [current] = await db
    .select({ isEnabled: automationRules.isEnabled })
    .from(automationRules)
    .where(eq(automationRules.id, request.params.id))
    .limit(1);
  if (!current)
    return reply.status(404).send({
      data: null,
      error: { code: "NOT_FOUND", message: "Rule not found" },
    });

  const [updated] = await db
    .update(automationRules)
    .set({ isEnabled: !current.isEnabled, updatedAt: new Date() })
    .where(eq(automationRules.id, request.params.id))
    .returning();

  return reply.send({ data: updated, error: null });
}

async function reorderRules(request: FastifyRequest, reply: FastifyReply) {
  const { ids } = request.body as { ids: string[] };
  await Promise.all(
    ids.map((id, idx) =>
      db
        .update(automationRules)
        .set({ priority: idx, updatedAt: new Date() })
        .where(eq(automationRules.id, id))
    )
  );
  return reply.send({ data: { reordered: ids.length }, error: null });
}

// ── Route registration ─────────────────────────────────────────────────────────
export async function automationRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get("/automation/rules", { ...auth }, listRules);
  fastify.get("/automation/rules/:id", { ...auth }, getRule);
  fastify.post("/automation/rules", { ...auth }, createRule);
  fastify.put("/automation/rules/:id", { ...auth }, updateRule);
  fastify.delete("/automation/rules/:id", { ...auth }, deleteRule);
  fastify.patch("/automation/rules/:id/toggle", { ...auth }, toggleRule);
  fastify.put("/automation/rules/reorder", { ...auth }, reorderRules);
}
