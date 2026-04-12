import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AutomationStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 10;
    const offset = Number(searchParams.get("offset")) || 0;
    
    const runs = await prisma.automationRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    });
    
    const total = await prisma.automationRun.count();
    
    return NextResponse.json({
      success: true,
      data: runs,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("获取自动化运行记录失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch automation runs",
        },
      },
      { status: 500 }
    );
  }
}