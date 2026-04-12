import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ApprovalStatus } from "@prisma/client";
import { getCurrentUserId } from "@/lib/user";
import { auditApprove, auditReject } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { approvalIds, action } = body;

    if (!approvalIds || !Array.isArray(approvalIds) || approvalIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_IDS", message: "请提供审批记录ID数组" } },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ACTION", message: "操作必须是 'approve' 或 'reject'" } },
        { status: 400 }
      );
    }

    // 检查所有审批记录是否存在且状态为PENDING
    const approvals = await prisma.approval.findMany({
      where: {
        id: { in: approvalIds },
      },
    });

    const notFoundIds = approvalIds.filter(id => !approvals.find(a => a.id === id));
    if (notFoundIds.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: `以下审批记录不存在: ${notFoundIds.join(", ")}` } },
        { status: 404 }
      );
    }

    const notPending = approvals.filter(a => a.status !== ApprovalStatus.PENDING);
    if (notPending.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_PENDING", message: `以下审批记录不是待处理状态: ${notPending.map(a => a.id).join(", ")}` } },
        { status: 400 }
      );
    }

    // 批量更新
    const newStatus = action === "approve" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    const decisionBy = await getCurrentUserId();
    const updated = await prisma.approval.updateMany({
      where: {
        id: { in: approvalIds },
        status: ApprovalStatus.PENDING,
      },
      data: {
        status: newStatus,
        decisionAt: new Date(),
        decisionBy,
      },
    });

    // 为每个更新的审批记录添加审计日志
    const updatedApprovals = await prisma.approval.findMany({
      where: {
        id: { in: approvalIds },
        status: newStatus,
      },
    });

    for (const approval of updatedApprovals) {
      if (action === "approve") {
        await auditApprove("Approval", approval.id, {
          targetType: approval.targetType,
          targetId: approval.targetId,
          decisionBy,
          previousStatus: ApprovalStatus.PENDING,
          newStatus: approval.status,
          score: approval.score,
        });
      } else {
        await auditReject("Approval", approval.id, {
          targetType: approval.targetType,
          targetId: approval.targetId,
          decisionBy,
          previousStatus: ApprovalStatus.PENDING,
          newStatus: approval.status,
          score: approval.score,
        });
      }
    }

    // 如果审批目标是邮件发送（SEND），并且是批准操作，可以触发后续处理（如发送邮件）
    // 这里可以添加后续逻辑，但为了简化，目前只更新状态

    // Revalidate pages that show approvals and contacts
    revalidatePath('/approvals');
    revalidatePath('/contacts');
    revalidatePath('/dashboard');

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: updated.count,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("批量审批失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BATCH_UPDATE_FAILED",
          message: error instanceof Error ? error.message : "批量审批操作失败",
        },
      },
      { status: 500 }
    );
  }
}