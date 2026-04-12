import { Contact } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * 计算联系人的重复匹配键。
 * 返回一组字符串键，用于识别重复项。
 */
export function getDuplicateKeys(contact: Contact): string[] {
  const keys: string[] = [];
  
  // 1. 邮箱地址（全小写）
  keys.push(`email:${contact.email.toLowerCase()}`);
  
  // 2. 公司名 + 域名（从邮箱中提取）
  const domain = contact.email.split('@')[1]?.toLowerCase();
  if (domain) {
    // 移除常见子域名如 www., mail., info. 等
    const cleanDomain = domain.replace(/^(www\.|mail\.|info\.|contact\.|sales\.)/, '');
    keys.push(`company_domain:${contact.companyName.toLowerCase()}:${cleanDomain}`);
  }
  
  // 3. 公司名 + 联系人姓名（如果联系人姓名存在）
  if (contact.contactName && contact.contactName.trim()) {
    const normalizedName = contact.contactName.toLowerCase().trim();
    keys.push(`company_name:${contact.companyName.toLowerCase()}:${normalizedName}`);
  }
  
  // 4. 公司名 + 国家代码（针对跨国公司）
  keys.push(`company_country:${contact.companyName.toLowerCase()}:${contact.countryCode}`);
  
  // 5. 仅公司名（宽松匹配，可能产生误报，但可用于警告）
  keys.push(`company:${contact.companyName.toLowerCase()}`);
  
  return keys;
}

/**
 * 查找与给定联系人重复的现有联系人。
 * 返回重复联系人的数组，每个重复项包含匹配的键和相似度分数。
 */
export async function findDuplicateContacts(
  contact: Contact,
  existingContacts?: Contact[]
): Promise<Array<{ contact: Contact; matchedKey: string; confidence: number }>> {
  const duplicates: Array<{ contact: Contact; matchedKey: string; confidence: number }> = [];
  const keys = getDuplicateKeys(contact);
  
  // 如果未提供 existingContacts，则从数据库查询
  let contactsToCheck = existingContacts;
  if (!contactsToCheck) {
    contactsToCheck = await prisma.contact.findMany({
      where: {
        // 排除自己（如果是更新操作）
        id: contact.id ? { not: contact.id } : undefined,
      },
    });
  }
  
  for (const existing of contactsToCheck) {
    const existingKeys = getDuplicateKeys(existing);
    // 查找匹配的键
    for (const key of keys) {
      if (existingKeys.includes(key)) {
        // 根据匹配的键分配置信度
        let confidence = 0.5;
        if (key.startsWith('email:')) {
          confidence = 1.0; // 邮箱地址完全匹配
        } else if (key.startsWith('company_domain:')) {
          confidence = 0.9; // 公司名 + 域名匹配
        } else if (key.startsWith('company_name:')) {
          confidence = 0.8; // 公司名 + 联系人姓名匹配
        } else if (key.startsWith('company_country:')) {
          confidence = 0.7; // 公司名 + 国家匹配
        } else if (key.startsWith('company:')) {
          confidence = 0.6; // 仅公司名匹配（可能误报）
        }
        
        // 避免重复添加同一个现有联系人（多个匹配键）
        const alreadyAdded = duplicates.some(d => d.contact.id === existing.id);
        if (!alreadyAdded) {
          duplicates.push({ contact: existing, matchedKey: key, confidence });
        }
        break; // 每个现有联系人只需一个匹配键
      }
    }
  }
  
  return duplicates;
}

/**
 * 对联系人列表执行去重，返回唯一联系人列表和重复项映射。
 * 保留较高优先级或较新创建的联系人。
 */
export async function deduplicateContactList(
  contacts: Contact[]
): Promise<{
  uniqueContacts: Contact[];
  duplicates: Map<string, Contact[]>; // 键 -> 重复联系人数组
  duplicateKeys: Map<string, string[]>; // 联系人ID -> 匹配的重复键
}> {
  const uniqueContacts: Contact[] = [];
  const duplicates = new Map<string, Contact[]>();
  const duplicateKeys = new Map<string, string[]>();
  
  // 按优先级（降序）和创建时间（降序）排序，以便优先保留较高优先级的联系人
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  
  const processedKeys = new Set<string>();
  
  for (const contact of sortedContacts) {
    const keys = getDuplicateKeys(contact);
    let isDuplicate = false;
    let matchedKey = '';
    
    for (const key of keys) {
      if (processedKeys.has(key)) {
        isDuplicate = true;
        matchedKey = key;
        break;
      }
    }
    
    if (isDuplicate) {
      // 添加到重复映射
      if (!duplicates.has(matchedKey)) {
        duplicates.set(matchedKey, []);
      }
      duplicates.get(matchedKey)!.push(contact);
      
      // 记录此联系人的重复键
      if (!duplicateKeys.has(contact.id)) {
        duplicateKeys.set(contact.id, []);
      }
      duplicateKeys.get(contact.id)!.push(matchedKey);
    } else {
      // 添加为唯一联系人，并将所有键标记为已处理
      uniqueContacts.push(contact);
      keys.forEach(key => processedKeys.add(key));
    }
  }
  
  return { uniqueContacts, duplicates, duplicateKeys };
}

/**
 * 为 UI 生成去重摘要。
 */
export function generateDeduplicationSummary(
  uniqueCount: number,
  duplicateCount: number,
  duplicates: Map<string, Contact[]>
): {
  message: string;
  details: Array<{ key: string; count: number; sampleEmails: string[] }>;
} {
  const details: Array<{ key: string; count: number; sampleEmails: string[] }> = [];
  
  for (const [key, contacts] of duplicates.entries()) {
    details.push({
      key,
      count: contacts.length,
      sampleEmails: contacts.slice(0, 3).map(c => c.email),
    });
  }
  
  let message = `发现 ${duplicateCount} 个重复联系人，已保留 ${uniqueCount} 个唯一联系人。`;
  if (duplicateCount === 0) {
    message = '未发现重复联系人。';
  }
  
  return { message, details };
}