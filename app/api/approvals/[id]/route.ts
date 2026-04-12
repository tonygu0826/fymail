import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ApprovalStatus, EmailLogStatus, CampaignContactStatus } from "@prisma/client";
import { sendEmail, buildTemplateVariables } from "@/lib/mail";
import { getCurrentUserId } from "@/lib/user";
import { auditApprove, auditReject } from "@/lib/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();
    const { action } = body;

    if (!action || (action !== "approve" && action !== "reject")) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ACTION", message: "操作必须是 'approve' 或 'reject'" } },
        { status: 400 }
      );
    }

    // 检查审批记录是否存在
    const approval = await prisma.approval.findUnique({
      where: { id },
    });

    if (!approval) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "审批记录不存在" } },
        { status: 404 }
      );
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_PENDING", message: "审批记录不是待处理状态" } },
        { status: 400 }
      );
    }

    // 更新审批记录
    const newStatus = action === "approve" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    const decisionBy = await getCurrentUserId();
    const updated = await prisma.approval.update({
      where: { id },
      data: {
        status: newStatus,
        decisionAt: new Date(),
        decisionBy,
      },
    });

    // 审计日志
    if (action === "approve") {
      await auditApprove("Approval", updated.id, {
        targetType: approval.targetType,
        targetId: approval.targetId,
        decisionBy,
        previousStatus: approval.status,
        newStatus: updated.status,
        score: approval.score,
      });
    } else {
      await auditReject("Approval", updated.id, {
        targetType: approval.targetType,
        targetId: approval.targetId,
        decisionBy,
        previousStatus: approval.status,
        newStatus: updated.status,
        score: approval.score,
      });
    }

    // 如果是批准操作且目标类型为SEND，触发邮件发送
    if (action === "approve" && approval.targetType === "SEND") {
      try {
        // 获取邮件日志
        const emailLog = await prisma.emailLog.findUnique({
          where: { id: approval.targetId },
          include: {
            template: true,
            contact: true,
            campaign: true,
          },
        });

        if (emailLog && emailLog.status === EmailLogStatus.PENDING) {
          // 如果模板存在，发送邮件
          if (emailLog.template) {
            // Build template variables from template.variables and contact
            const templateVariables = Array.isArray(emailLog.template.variables) ? emailLog.template.variables as string[] : [];
            const contact = emailLog.contact;
            const variables = contact ? buildTemplateVariables(contact, templateVariables) : {};
            
            const result = await sendEmail({
              to: emailLog.recipientEmail,
              subject: emailLog.subject,
              html: emailLog.template.bodyHtml,
              text: emailLog.template.bodyText || undefined,
              variables,
            });

            // 更新邮件日志状态
            await prisma.emailLog.update({
              where: { id: emailLog.id },
              data: {
                status: result.success ? EmailLogStatus.SENT : EmailLogStatus.FAILED,
                messageId: result.messageId,
                sentAt: result.success ? new Date() : undefined,
                errorMessage: result.error,
                metadata: {
                  ...(emailLog.metadata as any),
                  approvalTriggered: true,
                  approvalId: approval.id,
                },
              },
            });

          // 更新联系人最后联系时间
          if (emailLog.contactId) {
            await prisma.contact.update({
              where: { id: emailLog.contactId },
              data: {
                lastContactedAt: new Date(),
              },
            });
          }

          // 如果关联了营销活动，更新营销活动联系人状态
          if (emailLog.campaignId && emailLog.contactId) {
            await prisma.campaignContact.updateMany({
              where: {
                campaignId: emailLog.campaignId,
                contactId: emailLog.contactId,
              },
              data: {
                status: CampaignContactStatus.SENT,
                sentAt: new Date(),
              },
            });
          }

            // 如果发送成功，更新联系人最后联系时间
            if (result.success && emailLog.contactId) {
              await prisma.contact.update({
                where: { id: emailLog.contactId },
                data: {
                  lastContactedAt: new Date(),
                },
              });
            }

            // 如果关联了营销活动，更新营销活动联系人状态
            if (emailLog.campaignId && emailLog.contactId) {
              await prisma.campaignContact.updateMany({
                where: {
                  campaignId: emailLog.campaignId,
                  contactId: emailLog.contactId,
                },
                data: {
                  status: result.success ? CampaignContactStatus.SENT : CampaignContactStatus.FAILED,
                  sentAt: result.success ? new Date() : undefined,
                  failureReason: result.error,
                },
              });
            }

            console.log(`Approval ${id} approved, email sent to ${emailLog.recipientEmail}, success: ${result.success}`);
          } else {
            console.warn(`Email log ${emailLog.id} has no template, cannot send`);
            // 邮件日志没有模板，标记为失败
            await prisma.emailLog.update({
              where: { id: emailLog.id },
              data: {
                status: EmailLogStatus.FAILED,
                errorMessage: '邮件模板不存在，无法发送',
              },
            });
          }
        }
      } catch (error) {
        console.error(`Failed to send email for approval ${id}:`, error);
        // 邮件发送失败，但不回滚审批状态
        // 可以记录错误或更新邮件日志状态为FAILED
        try {
          await prisma.emailLog.update({
            where: { id: approval.targetId },
            data: {
              status: EmailLogStatus.FAILED,
              errorMessage: error instanceof Error ? error.message : '发送失败',
            },
          });
        } catch (updateError) {
          console.error('Failed to update email log status:', updateError);
        }
      }
    }

    // Revalidate pages that show approvals and contacts
    revalidatePath('/approvals');
    revalidatePath('/contacts');
    revalidatePath('/dashboard');

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("单条审批失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UPDATE_FAILED",
          message: error instanceof Error ? error.message : "单条审批操作失败",
        },
      },
      { status: 500 }
    );
  }
}