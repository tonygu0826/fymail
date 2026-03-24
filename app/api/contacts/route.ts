import { NextResponse } from "next/server";

import { getContacts } from "@/lib/app-data";
import { createContactRecord } from "@/lib/mvp-data";
import { contactPayloadSchema } from "@/lib/schemas";

export async function GET() {
  const data = await getContacts();

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = contactPayloadSchema.safeParse(body);

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

  try {
    const contact = await createContactRecord(parsed.data);

    return NextResponse.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CREATE_FAILED",
          message: error instanceof Error ? error.message : "Contact creation failed",
        },
      },
      { status: 400 },
    );
  }
}
