import { PageHeader } from "@/components/ui/page-header";
import { AutomationRunner } from "./automation-runner";
import { getRunHistory, getTotalContactCount } from "./actions";

export default async function AutomationPage() {
  const [contactCount, history] = await Promise.all([
    getTotalContactCount(),
    getRunHistory(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="自动化"
        title="数据处理"
        description="对联系人进行去重清洗。处理后在营销活动中选择联系人并发送邮件。"
      />
      <AutomationRunner
        initialContactCount={contactCount}
        initialHistory={JSON.parse(JSON.stringify(history))}
      />
    </>
  );
}
