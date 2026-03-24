import { NextResponse } from "next/server";

import { getDashboardSummary } from "@/lib/app-data";

export async function GET() {
  const data = await getDashboardSummary();

  return NextResponse.json({
    success: true,
    data,
  });
}
