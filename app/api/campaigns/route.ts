import { NextResponse } from "next/server";

import { getCampaigns } from "@/lib/app-data";
import { createCampaignRecord } from "@/lib/mvp-data";
import { campaignPayloadSchema } from "@/lib/schemas";

export async function GET() {
  const data = await getCampaigns();

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = campaignPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Campaign payload is invalid",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const campaign = await createCampaignRecord(parsed.data);

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CREATE_FAILED",
          message: error instanceof Error ? error.message : "Campaign creation failed",
        },
      },
      { status: 400 },
    );
  }
}
