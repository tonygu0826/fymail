import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { senderAccounts } from "../../db/schema";
import { encryptPassword, testSmtpConnection } from "../../services/mailer.service";
import { z } from "zod";

const createSenderSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().default(587),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1), // plaintext, will be encrypted on save
  dailyLimit: z.number().int().min(1).max(500).default(50),
});

export async function senderAccountRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  // List
  fastify.get("/settings/sender-accounts", { ...auth }, async (_req, reply) => {
    const rows = await db
      .select({
        id: senderAccounts.id,
        name: senderAccounts.name,
        email: senderAccounts.email,
        smtpHost: senderAccounts.smtpHost,
        smtpPort: senderAccounts.smtpPort,
        smtpUser: senderAccounts.smtpUser,
        dailyLimit: senderAccounts.dailyLimit,
        isActive: senderAccounts.isActive,
        lastUsedAt: senderAccounts.lastUsedAt,
        createdAt: senderAccounts.createdAt,
      })
      .from(senderAccounts);
    return reply.send({ data: rows, error: null });
  });

  // Create
  fastify.post("/settings/sender-accounts", { ...auth }, async (request, reply) => {
    const input = createSenderSchema.parse(request.body);
    const { smtpPass, ...rest } = input;
    const [row] = await db
      .insert(senderAccounts)
      .values({ ...rest, smtpPassEnc: encryptPassword(smtpPass) })
      .returning({
        id: senderAccounts.id,
        name: senderAccounts.name,
        email: senderAccounts.email,
        isActive: senderAccounts.isActive,
      });
    return reply.status(201).send({ data: row, error: null });
  });

  // Update
  fastify.put(
    "/settings/sender-accounts/:id",
    { ...auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const input = createSenderSchema.partial().parse(request.body);
      const { smtpPass, ...rest } = input as any;
      const updateData: any = { ...rest };
      if (smtpPass) updateData.smtpPassEnc = encryptPassword(smtpPass);

      const [row] = await db
        .update(senderAccounts)
        .set(updateData)
        .where(eq(senderAccounts.id, request.params.id))
        .returning({ id: senderAccounts.id, name: senderAccounts.name });

      if (!row) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Account not found" } });
      return reply.send({ data: row, error: null });
    }
  );

  // Delete
  fastify.delete(
    "/settings/sender-accounts/:id",
    { ...auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await db.delete(senderAccounts).where(eq(senderAccounts.id, request.params.id));
      return reply.status(204).send();
    }
  );

  // Test SMTP
  fastify.post(
    "/settings/sender-accounts/:id/test",
    { ...auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const ok = await testSmtpConnection(request.params.id);
      return reply.send({
        data: { success: ok, message: ok ? "SMTP connection successful" : "Connection failed" },
        error: null,
      });
    }
  );
}
