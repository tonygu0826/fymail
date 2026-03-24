import { NextResponse } from "next/server";
import { z } from "zod";

import { getTemplates } from "@/lib/app-data";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  language: z.string().min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  variables: z.array(z.string()).default([]),
  status: z.string().default("DRAFT"),
  notes: z.string().optional(),
});

export async function GET() {
  const data = await getTemplates();

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);

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

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Template creation UI/API persistence is planned for the next milestone.",
      },
    },
    { status: 501 },
  );
}
