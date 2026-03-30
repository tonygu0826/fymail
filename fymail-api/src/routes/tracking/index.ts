import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { recordOpen } from "../../services/mailer.service";
import { readFileSync } from "fs";
import { join } from "path";

// 1x1 transparent GIF in base64
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function trackingRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/t/:logId.gif",
    async (
      request: FastifyRequest<{ Params: { logId: string } }>,
      reply: FastifyReply
    ) => {
      // Fire and forget — don't block the response
      const { logId } = request.params;
      recordOpen(logId).catch((err) =>
        fastify.log.error({ err, logId }, "Failed to record open")
      );

      return reply
        .header("Content-Type", "image/gif")
        .header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        .header("Pragma", "no-cache")
        .send(PIXEL_GIF);
    }
  );
}
