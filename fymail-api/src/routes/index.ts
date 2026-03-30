import { FastifyInstance } from "fastify";
import authPlugin from "../plugins/auth.plugin";
import { contactRoutes } from "./contacts";
import { templateRoutes } from "./templates";
import { campaignRoutes } from "./campaigns";
import { approvalRoutes } from "./approvals";
import { trackingRoutes } from "./tracking";
import { senderAccountRoutes } from "./settings";
import { statusRoutes } from "./status";
import { automationRoutes } from "./automation";
import { intelligenceRoutes } from "./intelligence";

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(authPlugin);

  await fastify.register(trackingRoutes, { prefix: "/v1" });

  fastify.register(
    async (v1) => {
      v1.post("/auth/login", async (_req, reply) =>
        reply.status(501).send({
          data: null,
          error: { code: "NOT_IMPLEMENTED", message: "Use Supabase Auth SDK on the frontend." },
        })
      );

      v1.get("/auth/me", {
        preHandler: [v1.authenticate],
        handler: async (request, reply) =>
          reply.send({
            data: { id: request.userId, email: request.userEmail, role: request.userRole },
            error: null,
          }),
      });

      await v1.register(contactRoutes);
      await v1.register(templateRoutes);
      await v1.register(campaignRoutes);
      await v1.register(approvalRoutes);
      await v1.register(automationRoutes);
      await v1.register(intelligenceRoutes);
      await v1.register(senderAccountRoutes);
      await v1.register(statusRoutes);
    },
    { prefix: "/v1" }
  );
}
