import { NextResponse } from "next/server";
import { z } from "zod";

import { getContacts } from "@/lib/app-data";

const createContactSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email(),
  countryCode: z.string().min(2),
  jobTitle: z.string().optional(),
  source: z.string().optional(),
  status: z.string().default("NEW"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export async function GET() {
  const data = await getContacts();

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createContactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Contact payload is invalid",
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
        message: "Contact creation persistence is planned for the next milestone.",
      },
    },
    { status: 501 },
  );
}
