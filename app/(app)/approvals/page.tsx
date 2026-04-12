import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getApprovalBatches } from "./actions";
import { ApprovalTable } from "./approval-table";

export default async function ApprovalsPage() {
  const batches = await getApprovalBatches();
  const totalPending = batches.reduce((sum, b) => sum + b.pendingCount, 0);

  return (
    <>
      <PageHeader
        eyebrow="审批"
        title="审批工作台"
        description={totalPending > 0 ? `${totalPending} 封邮件待审批` : "所有邮件发送前需要人工审批确认。"}
      />
      <Panel title="审批批次" description="按提交批次分组，支持一键批准整批邮件。">
        <ApprovalTable batches={batches} />
      </Panel>
    </>
  );
}
