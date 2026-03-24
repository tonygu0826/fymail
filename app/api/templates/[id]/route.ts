import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getTemplateById } from "@/lib/app-data";
import { updateTemplateRecord } from "@/lib/mvp-data";
import { templatePayloadSchema } from "@/lib/schemas";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: RouteContext) {
  const template = await getTemplateById(params.id);

  if (!template) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Template not found",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data: template,
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
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
    const template = await updateTemplateRecord(params.id, parsed.data);

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? "Template slug must be unique"
        : "Unable to update template";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UPDATE_FAILED",
          message,
        },
      },
      { status: 400 },
    );
  }
}
