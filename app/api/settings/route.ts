import { NextResponse } from "next/server";

import { getSettingsSummary } from "@/lib/app-data";

export async function GET() {
  const data = await getSettingsSummary();

  return NextResponse.json({
    success: true,
    data,
  });
}
