import { NextResponse } from "next/server";
import { z } from "zod";

import { getCampaigns } from "@/lib/app-data";

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string().min(1),
  status: z.string().default("DRAFT"),
  audienceFilter: z.record(z.string(), z.any()).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const data = await getCampaigns();

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createCampaignSchema.safeParse(body);

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

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Campaign persistence and send execution are planned for the next milestone.",
      },
    },
    { status: 501 },
  );
}
