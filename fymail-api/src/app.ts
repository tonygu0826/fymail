import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { env } from "./config/env";
import { registerRoutes } from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { startWorkers } from "./workers";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "warn" : "info",
      transport:
        env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ── Plugins ────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: "7d" },
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  });

  // ── Error Handler ──────────────────────────────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }));

  // ── Routes ────────────────────────────────────────────────────────────────
  await registerRoutes(app);

  // ── Workers (pg-boss) ─────────────────────────────────────────────────────
  if (env.NODE_ENV !== "test") {
    startWorkers().catch((err) => app.log.error(err, "Failed to start workers"));
  }

  return app;
}
