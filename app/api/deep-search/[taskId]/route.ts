import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cancelDeepSearch } from '@/lib/deep-search/orchestrator';

/**
 * GET /api/deep-search/[taskId] — 查询任务状态和进度
 */
export async function GET(
  _request: Request,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  const task = await prisma.deepSearchTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      config: true,
      progress: true,
      totalCompanies: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  if (!task) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: task,
  });
}

/**
 * DELETE /api/deep-search/[taskId] — 取消任务
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  try {
    await cancelDeepSearch(taskId);
    return NextResponse.json({ success: true, data: { cancelled: true } });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'CANCEL_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    }, { status: 500 });
  }
}
