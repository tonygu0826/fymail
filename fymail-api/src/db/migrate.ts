import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { config } from "dotenv";
import { join } from "path";

config();

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  const db = drizzle(pool);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: join(__dirname, "migrations") });
  console.log("Migrations complete.");

  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
