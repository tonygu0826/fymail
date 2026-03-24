import { NextResponse } from "next/server";

import { getDatabaseHealth } from "@/lib/health";

export async function GET() {
  const database = await getDatabaseHealth();

  return NextResponse.json({
    success: true,
    data: {
      status: database.reachable || !database.configured ? "ok" : "degraded",
      app: "FyMail",
      time: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      database,
    },
  });
}
