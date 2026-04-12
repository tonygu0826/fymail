export async function register() {
  // 仅在 Node.js 运行时执行（不在 Edge 运行时）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { resumeInterruptedTasks } = await import('./lib/deep-search/orchestrator');
    // 延迟几秒让数据库连接就绪
    setTimeout(() => {
      resumeInterruptedTasks().catch(err => {
        console.error('[deep-search] Failed to resume interrupted tasks:', err);
      });
    }, 5000);
  }
}
