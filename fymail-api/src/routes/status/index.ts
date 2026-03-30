import { FastifyInstance } from "fastify";
import { db } from "../../config/database";
import { sql } from "drizzle-orm";
import { outreachLogs } from "../../db/schema";
import { getQueue } from "../../services/queue.service";

export async function statusRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get("/status", { ...auth }, async (_req, reply) => {
    const modules = [];
    let overallStatus: "ok" | "degraded" | "down" = "ok";

    // ── Database check ─────────────────────────────────────────────────────
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      modules.push({
        name: "Database (PostgreSQL)",
        status: "ok",
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      });
    } catch (err: any) {
      overallStatus = "down";
      modules.push({
        name: "Database (PostgreSQL)",
        status: "down",
        lastChecked: new Date().toISOString(),
        message: err.message,
      });
    }

    // ── Queue stats ────────────────────────────────────────────────────────
    let queueStats = { pending: 0, processing: 0, failed: 0, completed24h: 0 };
    try {
      const [stats] = await db
        .select({
          pending: sql<number>`count(*) filter (where status = 'queued')`,
          sent: sql<number>`count(*) filter (where status = 'sent')`,
          failed: sql<number>`count(*) filter (where status = 'failed')`,
          completed24h: sql<number>`count(*) filter (where status = 'sent' and sent_at > now() - interval '24 hours')`,
        })
        .from(outreachLogs);

      queueStats = {
        pending: Number(stats.pending),
        processing: 0, // would come from pg-boss
        failed: Number(stats.failed),
        completed24h: Number(stats.completed24h),
      };

      modules.push({
        name: "Email Queue",
        status: "ok",
        lastChecked: new Date().toISOString(),
      });
    } catch {
      modules.push({
        name: "Email Queue",
        status: "degraded",
        lastChecked: new Date().toISOString(),
        message: "Could not fetch queue stats",
      });
      if (overallStatus === "ok") overallStatus = "degraded";
    }

    return reply.send({
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? "1.0.0",
        modules,
        queue: queueStats,
        alerts: [], // TODO: implement alert storage
      },
      error: null,
    });
  });
}
