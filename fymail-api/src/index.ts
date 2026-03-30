import { buildApp } from "./app";
import { env } from "./config/env";
import { closeDb } from "./config/database";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`🚀 FYMail API running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    await closeDb();
    process.exit(1);
  }

  const graceful = async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGTERM", graceful);
  process.on("SIGINT", graceful);
}

start();
