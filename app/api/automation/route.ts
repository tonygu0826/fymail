import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runAutomation, defaultConfig } from '@/lib/automation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = {
      ...defaultConfig,
      ...body,
    };

    const result = await runAutomation(config);

    // Revalidate pages that show updated data
    revalidatePath('/contacts');
    revalidatePath('/approvals');
    revalidatePath('/automation');
    revalidatePath('/dashboard');

    return NextResponse.json({
      success: result.success,
      runId: result.runId,
      steps: result.steps,
      summary: result.summary,
      errors: result.errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AUTOMATION_FAILED',
          message: error instanceof Error ? error.message : '自动化运行失败',
        },
      },
      { status: 500 }
    );
  }
}