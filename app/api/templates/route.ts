import { NextResponse } from "next/server";

import { getTemplates } from "@/lib/app-data";
import { createTemplateRecord } from "@/lib/mvp-data";
import { templatePayloadSchema } from "@/lib/schemas";

export async function GET() {
  const data = await getTemplates();

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = templatePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Template payload is invalid",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const template = await createTemplateRecord(parsed.data);

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CREATE_FAILED",
          message: error instanceof Error ? error.message : "Template creation failed",
        },
      },
      { status: 400 },
    );
  }
}
