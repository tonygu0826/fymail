import { Contact } from '@prisma/client';
import { prisma } from '@/lib/db';
import { deduplicateContactList } from '@/lib/deduplication';

/**
 * 自动化运行配置
 */
export interface AutomationConfig {
  deduplicationEnabled: boolean;
  batchSize: number; // 0 = 不限制
}

export const defaultConfig: AutomationConfig = {
  deduplicationEnabled: true,
  batchSize: 0,
};

export interface AutomationStepResult {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
  details?: any;
  duration: number;
}

export interface AutomationRunResult {
  success: boolean;
  runId?: string;
  steps: AutomationStepResult[];
  summary: {
    totalContacts: number;
    uniqueContacts: number;
    duplicatesRemoved: number;
    scoredContacts: number;
  };
  errors: string[];
}

/**
 * 运行自动化流程：去重 + 评分
 * 发送功能由营销活动负责。
 */
export async function runAutomation(
  config: Partial<AutomationConfig> = {}
): Promise<AutomationRunResult> {
  const startTime = Date.now();
  const finalConfig = { ...defaultConfig, ...config };
  const steps: AutomationStepResult[] = [];
  const errors: string[] = [];

  let totalContacts = 0;
  let uniqueContactList: Contact[] = [];
  let uniqueContacts = 0;
  let duplicatesRemoved = 0;
  let scoredContacts = 0;

  try {
    // 步骤1：去重
    const dedupStart = Date.now();
    try {
      steps.push({ step: 'deduplication', status: 'running', message: '正在查找重复联系人...', duration: 0 });

      const contacts = await prisma.contact.findMany({
        ...(finalConfig.batchSize > 0 ? { take: finalConfig.batchSize } : {}),
      });
      totalContacts = contacts.length;

      if (finalConfig.deduplicationEnabled && totalContacts > 0) {
        const { uniqueContacts: deduped, duplicates } = await deduplicateContactList(contacts);
        uniqueContactList = deduped;
        uniqueContacts = deduped.length;
        duplicatesRemoved = totalContacts - uniqueContacts;

        // 直接删除重复联系人
        const duplicateIds = contacts
          .filter(c => !deduped.find(d => d.id === c.id))
          .map(c => c.id);

        if (duplicateIds.length > 0) {
          await prisma.campaignContact.deleteMany({ where: { contactId: { in: duplicateIds } } });
          await prisma.emailLog.deleteMany({ where: { contactId: { in: duplicateIds } } });
          await prisma.contact.deleteMany({ where: { id: { in: duplicateIds } } });
        }

        steps[steps.length - 1] = {
          step: 'deduplication',
          status: 'completed',
          message: `处理 ${totalContacts} 个联系人，移除 ${duplicatesRemoved} 个重复，保留 ${uniqueContacts} 个`,
          details: {
            duplicates: Array.from(duplicates.entries()).slice(0, 10).map(([key, contacts]) => ({
              key,
              count: contacts.length,
              emails: contacts.map(c => c.email),
            })),
          },
          duration: Date.now() - dedupStart,
        };
      } else {
        uniqueContacts = totalContacts;
        uniqueContactList = contacts;
        steps[steps.length - 1] = {
          step: 'deduplication',
          status: 'completed',
          message: totalContacts === 0
            ? '没有 READY 状态的联系人需要处理'
            : `跳过去重，保留全部 ${totalContacts} 个联系人`,
          duration: Date.now() - dedupStart,
        };
      }
    } catch (error) {
      steps[steps.length - 1] = {
        step: 'deduplication',
        status: 'failed',
        message: `去重失败: ${error instanceof Error ? error.message : '未知错误'}`,
        duration: Date.now() - dedupStart,
      };
      errors.push('去重步骤失败');
    }

    // 步骤2：评分统计
    const scoringStart = Date.now();
    try {
      steps.push({ step: 'scoring', status: 'running', message: '正在统计联系人...', duration: 0 });

      if (uniqueContacts > 0) {
        const contacts = await prisma.contact.findMany({
          where: { id: { in: uniqueContactList.map(c => c.id) } },
        });
        scoredContacts = contacts.length;

        steps[steps.length - 1] = {
          step: 'scoring',
          status: 'completed',
          message: `${scoredContacts} 个联系人已就绪，可在营销活动中创建发送任务`,
          details: {
            byCountry: contacts.reduce((acc, c) => {
              acc[c.countryCode] = (acc[c.countryCode] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          },
          duration: Date.now() - scoringStart,
        };
      } else {
        steps[steps.length - 1] = {
          step: 'scoring',
          status: 'completed',
          message: '没有联系人需要统计',
          duration: Date.now() - scoringStart,
        };
      }
    } catch (error) {
      steps[steps.length - 1] = {
        step: 'scoring',
        status: 'failed',
        message: `统计失败: ${error instanceof Error ? error.message : '未知错误'}`,
        duration: Date.now() - scoringStart,
      };
      errors.push('统计步骤失败');
    }

    // 创建运行记录
    let runId: string | undefined;
    try {
      const run = await prisma.automationRun.create({
        data: {
          status: errors.length === 0 ? 'COMPLETED' : 'PARTIAL',
          stepsCompleted: steps.map(s => s.step),
          errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          metrics: {
            totalContacts,
            uniqueContacts,
            duplicatesRemoved,
            scoredContacts,
          },
        },
      });
      runId = run.id;
    } catch {}

    return {
      success: errors.length === 0,
      runId,
      steps,
      summary: { totalContacts, uniqueContacts, duplicatesRemoved, scoredContacts },
      errors,
    };
  } catch (error) {
    return {
      success: false,
      steps,
      summary: { totalContacts, uniqueContacts, duplicatesRemoved, scoredContacts },
      errors: [...errors, `自动化运行失败: ${error instanceof Error ? error.message : '未知错误'}`],
    };
  }
}
