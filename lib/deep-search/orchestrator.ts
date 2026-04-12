/**
 * Deep Search Orchestrator v3
 *
 * v3 改进：
 * - 进度全部持久化到 DB，不再依赖内存 Map
 * - 服务重启后自动恢复未完成的爬虫任务（断点续传）
 * - 优雅取消：爬虫循环中定期检查取消信号
 * - 20 并发搜索（非串行）
 * - 仅使用 SearXNG 搜索源
 * - 爬取上限可配置，默认无上限
 * - 行业目录直接爬取，目标 10000+ 公司
 */

import { prisma } from '../db';
import { searchRealTime } from '../realtime-search';
import { scrapeCompanyWebsite } from './crawler';
import { scrapeDirectoryPage } from './directory-crawler';
import { deduplicateCompanies, extractDomain, isExcludedCompany } from './dedup';
import { EUROPEAN_COUNTRIES } from './constants';

// ── Types ──────────────────────────────────────────────────────────────

export interface DeepSearchConfig {
  countries?: string[];
  customQueries?: string[];
  resultsPerQuery?: number;
  enableScraping?: boolean;
  scrapeConcurrency?: number;
  scrapeDelayMs?: number;
  /** 爬取公司数量上限，0 或不传 = 无上限 */
  maxScrapedCompanies?: number;
  /** 搜索并发数，默认 20 */
  searchConcurrency?: number;
}

export interface ProgressInfo {
  phase: 'searching' | 'directories' | 'deduplicating' | 'saving' | 'scraping' | 'completed' | 'failed';
  searchProgress?: { completed: number; total: number; currentQuery?: string };
  scrapeProgress?: { completed: number; total: number; currentCompany?: string };
  companiesFound: number;
  companiesAfterDedup: number;
  companiesScraped: number;
  errors: string[];
}

// ── Cancellation signal (lightweight in-memory set) ─────────────────

const cancelledTasks = new Set<string>();

async function isTaskCancelled(taskId: string): Promise<boolean> {
  if (cancelledTasks.has(taskId)) return true;
  // 也从 DB 检查（防止其他进程取消）
  const task = await prisma.deepSearchTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  });
  if (task?.status === 'CANCELLED') {
    cancelledTasks.add(taskId);
    return true;
  }
  return false;
}

// ── Progress: read from DB ──────────────────────────────────────────

export async function getTaskProgress(taskId: string): Promise<ProgressInfo | null> {
  const task = await prisma.deepSearchTask.findUnique({
    where: { id: taskId },
    select: { progress: true },
  });
  return (task?.progress as unknown as ProgressInfo) || null;
}

// ── Main orchestrator ────────────────────────────────────────────────

export async function startDeepSearch(
  ownerId: string,
  config: DeepSearchConfig = {}
): Promise<string> {
  const task = await prisma.deepSearchTask.create({
    data: {
      ownerId,
      config: config as any,
      status: 'PENDING',
      progress: undefined,
    },
  });

  runDeepSearch(task.id, config).catch(err => {
    console.error(`[deep-search] Task ${task.id} fatal error:`, err);
  });

  return task.id;
}

// ── Core execution ──────────────────────────────────────────────────

async function runDeepSearch(taskId: string, config: DeepSearchConfig): Promise<void> {
  const {
    countries,
    customQueries = [],
    resultsPerQuery = 20,
    enableScraping = true,
    scrapeConcurrency = 10,
    scrapeDelayMs = 500,
    maxScrapedCompanies = 0, // 0 = no limit
    searchConcurrency = 20,
  } = config;

  const progress: ProgressInfo = {
    phase: 'searching',
    companiesFound: 0,
    companiesAfterDedup: 0,
    companiesScraped: 0,
    errors: [],
  };

  const TASK_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
  const taskStartTime = Date.now();

  try {
    await prisma.deepSearchTask.update({
      where: { id: taskId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    // ── 1. 构建搜索查询 ──
    const queries = buildSearchQueries(countries, customQueries);
    progress.searchProgress = { completed: 0, total: queries.length };
    await updateProgress(taskId, progress);

    console.log(`[deep-search] Starting search with ${queries.length} queries, concurrency=${searchConcurrency}`);

    // ── 2. 并发搜索（批次 = searchConcurrency） ──
    type RawResult = {
      companyName: string; website?: string; domain?: string;
      country?: string; services?: string[]; description?: string;
      email?: string; phone?: string; source: string; confidence: number;
    };
    const allResults: RawResult[] = [];

    for (let i = 0; i < queries.length; i += searchConcurrency) {
      if (await isTaskCancelled(taskId)) {
        console.log(`[deep-search] Task ${taskId} cancelled during search`);
        return;
      }
      if (Date.now() - taskStartTime > TASK_TIMEOUT_MS) {
        console.warn(`[deep-search] Task timeout, stopping search at ${i}/${queries.length}`);
        progress.errors.push(`Task timeout at query ${i}/${queries.length}`);
        break;
      }

      const batch = queries.slice(i, i + searchConcurrency);
      progress.searchProgress = {
        completed: i,
        total: queries.length,
        currentQuery: `批次 ${Math.floor(i / searchConcurrency) + 1}/${Math.ceil(queries.length / searchConcurrency)}`,
      };
      await updateProgress(taskId, progress);

      const batchResults = await Promise.allSettled(
        batch.map(query => searchRealTime({ query, limit: resultsPerQuery }))
      );

      for (const res of batchResults) {
        if (res.status === 'fulfilled') {
          for (const r of res.value) {
            allResults.push({
              companyName: r.name,
              website: r.website,
              domain: r.website ? extractDomain(r.website) || undefined : undefined,
              country: r.country,
              services: r.services,
              description: r.description,
              email: r.contact?.email,
              phone: r.contact?.phone,
              source: r.source,
              confidence: r.confidence,
            });
          }
        }
      }

      progress.companiesFound = allResults.length;

      // 批次间短暂延迟避免压垮 SearXNG
      if (i + searchConcurrency < queries.length) {
        await delay(200);
      }
    }

    progress.searchProgress = { completed: queries.length, total: queries.length };
    progress.companiesFound = allResults.length;
    console.log(`[deep-search] Search phase done: ${allResults.length} raw results`);

    // ── 3. 行业目录爬取（补充大量公司） ──
    progress.phase = 'directories';
    await updateProgress(taskId, progress);

    if (await isTaskCancelled(taskId)) return;

    try {
      const directoryResults = await scrapeIndustryDirectories(countries);
      allResults.push(...directoryResults);
      progress.companiesFound = allResults.length;
      console.log(`[deep-search] Directory scrape added ${directoryResults.length} companies, total: ${allResults.length}`);
    } catch (err) {
      progress.errors.push(`Directory scraping failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await updateProgress(taskId, progress);

    // ── 4. 去重 ──
    progress.phase = 'deduplicating';
    await updateProgress(taskId, progress);

    const unique = deduplicateCompanies(allResults);
    progress.companiesAfterDedup = unique.length;
    console.log(`[deep-search] After dedup: ${unique.length} unique companies`);
    await updateProgress(taskId, progress);

    // ── 5. 批量写入 DB ──
    progress.phase = 'saving';
    await updateProgress(taskId, progress);

    // 并发写入，每批 50 条
    for (let i = 0; i < unique.length; i += 50) {
      const batch = unique.slice(i, i + 50);
      await Promise.allSettled(
        batch.map(company =>
          prisma.deepSearchCompany.upsert({
            where: {
              taskId_domain: {
                taskId,
                domain: company.domain || company.companyName.toLowerCase().replace(/\s+/g, '-'),
              },
            },
            create: {
              taskId,
              companyName: company.companyName,
              domain: company.domain,
              website: company.website,
              country: company.country,
              services: company.services || [],
              email: company.email,
              phone: company.phone,
              description: company.description,
              source: company.source,
              confidence: company.confidence,
              scrapeStatus: enableScraping ? 'pending' : 'skipped',
            },
            update: {
              confidence: { set: company.confidence },
            },
          }).catch(err => {
            if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
              console.warn(`[deep-search] DB write error: ${err}`);
            }
          })
        )
      );
    }

    // ── 6. 爬取官网提取联系方式 ──
    if (enableScraping) {
      await runScrapePhase(taskId, progress, {
        scrapeConcurrency,
        scrapeDelayMs,
        maxScrapedCompanies,
        taskStartTime,
        taskTimeoutMs: TASK_TIMEOUT_MS,
      });
    }

    // ── 7. 完成 ──
    await finalizeTask(taskId, progress);
  } catch (err) {
    progress.phase = 'failed';
    progress.errors.push(err instanceof Error ? err.message : String(err));

    await prisma.deepSearchTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
        progress: progress as any,
      },
    }).catch(() => {});
  }
}

// ── Scrape phase (extracted for reuse by resume) ────────────────────

async function runScrapePhase(
  taskId: string,
  progress: ProgressInfo,
  opts: {
    scrapeConcurrency: number;
    scrapeDelayMs: number;
    maxScrapedCompanies: number;
    taskStartTime: number;
    taskTimeoutMs: number;
  }
): Promise<void> {
  progress.phase = 'scraping';

  const toScrape = await prisma.deepSearchCompany.findMany({
    where: { taskId, scrapeStatus: 'pending', website: { not: null } },
    select: { id: true, companyName: true, website: true },
  });

  const scrapeLimit = opts.maxScrapedCompanies > 0
    ? Math.min(toScrape.length, opts.maxScrapedCompanies)
    : toScrape.length;
  const scrapeList = toScrape.slice(0, scrapeLimit);

  // 计算已完成的数量（恢复时可能已有部分完成）
  const alreadyScraped = await prisma.deepSearchCompany.count({
    where: { taskId, scrapeStatus: { in: ['done', 'error'] } },
  });

  progress.scrapeProgress = { completed: alreadyScraped, total: alreadyScraped + scrapeList.length };
  progress.companiesScraped = alreadyScraped;
  await updateProgress(taskId, progress);

  console.log(`[deep-search] Starting scrape: ${scrapeList.length} pending, ${alreadyScraped} already done, concurrency=${opts.scrapeConcurrency}`);

  for (let i = 0; i < scrapeList.length; i += opts.scrapeConcurrency) {
    if (await isTaskCancelled(taskId)) {
      console.log(`[deep-search] Task ${taskId} cancelled during scraping`);
      return;
    }
    if (Date.now() - opts.taskStartTime > opts.taskTimeoutMs) {
      console.warn(`[deep-search] Task timeout during scraping`);
      progress.errors.push('Scraping stopped: task timeout');
      break;
    }

    const batch = scrapeList.slice(i, i + opts.scrapeConcurrency);
    await Promise.allSettled(
      batch.map(async (company) => {
        try {
          const result = await scrapeCompanyWebsite(company.website!);
          await prisma.deepSearchCompany.update({
            where: { id: company.id },
            data: {
              email: result.emails[0] || undefined,
              phone: result.phones[0] || undefined,
              contactPageUrl: result.contactPageUrl,
              scrapeStatus: 'done',
            },
          });
        } catch {
          await prisma.deepSearchCompany.update({
            where: { id: company.id },
            data: { scrapeStatus: 'error' },
          }).catch(() => {});
        }
      })
    );

    const completed = alreadyScraped + Math.min(i + opts.scrapeConcurrency, scrapeList.length);
    progress.scrapeProgress!.completed = completed;
    progress.companiesScraped = completed;
    await updateProgress(taskId, progress);

    if (i + opts.scrapeConcurrency < scrapeList.length) {
      await delay(opts.scrapeDelayMs);
    }
  }
}

async function finalizeTask(taskId: string, progress: ProgressInfo): Promise<void> {
  if (await isTaskCancelled(taskId)) return;

  const totalCompanies = await prisma.deepSearchCompany.count({ where: { taskId } });
  progress.phase = 'completed';
  await updateProgress(taskId, progress);

  await prisma.deepSearchTask.update({
    where: { id: taskId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      totalCompanies,
      progress: progress as any,
    },
  });

  console.log(`[deep-search] Task ${taskId} completed: ${totalCompanies} companies`);
}

// ── Resume interrupted tasks on server startup ──────────────────────

export async function resumeInterruptedTasks(): Promise<void> {
  const interrupted = await prisma.deepSearchTask.findMany({
    where: { status: 'RUNNING' },
    select: { id: true, config: true, progress: true, startedAt: true },
  });

  if (interrupted.length === 0) return;

  console.log(`[deep-search] Found ${interrupted.length} interrupted task(s), attempting resume...`);

  for (const task of interrupted) {
    const config = (task.config || {}) as DeepSearchConfig;
    const savedProgress = (task.progress || {}) as unknown as ProgressInfo;

    // 检查 DB 中是否已有公司数据（说明搜索+保存阶段已完成）
    const companyCount = await prisma.deepSearchCompany.count({
      where: { taskId: task.id },
    });

    if (companyCount > 0 && config.enableScraping !== false) {
      // 有数据，可以从爬虫阶段恢复
      const pendingCount = await prisma.deepSearchCompany.count({
        where: { taskId: task.id, scrapeStatus: 'pending' },
      });

      if (pendingCount === 0) {
        // 所有爬虫已完成，直接标记完成
        console.log(`[deep-search] Task ${task.id}: all scraping done, marking completed`);
        const progress: ProgressInfo = {
          ...savedProgress,
          phase: 'completed',
        };
        await prisma.deepSearchTask.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            totalCompanies: companyCount,
            progress: progress as any,
          },
        });
        continue;
      }

      console.log(`[deep-search] Task ${task.id}: resuming scrape, ${pendingCount} pending of ${companyCount} total`);

      // 异步恢复爬虫
      const progress: ProgressInfo = {
        phase: 'scraping',
        companiesFound: savedProgress.companiesFound || companyCount,
        companiesAfterDedup: savedProgress.companiesAfterDedup || companyCount,
        companiesScraped: companyCount - pendingCount,
        errors: [...(savedProgress.errors || []), 'Resumed after server restart'],
      };

      runScrapePhase(task.id, progress, {
        scrapeConcurrency: config.scrapeConcurrency || 10,
        scrapeDelayMs: config.scrapeDelayMs || 500,
        maxScrapedCompanies: config.maxScrapedCompanies || 0,
        taskStartTime: Date.now(),
        taskTimeoutMs: 60 * 60 * 1000,
      }).then(() => finalizeTask(task.id, progress))
        .catch(async (err) => {
          console.error(`[deep-search] Resume task ${task.id} failed:`, err);
          progress.phase = 'failed';
          progress.errors.push(err instanceof Error ? err.message : String(err));
          await prisma.deepSearchTask.update({
            where: { id: task.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              errorMessage: `Resume failed: ${err instanceof Error ? err.message : String(err)}`,
              progress: progress as any,
            },
          }).catch(() => {});
        });
    } else {
      // 搜索阶段中断，无法恢复，标记失败让用户重新启动
      console.log(`[deep-search] Task ${task.id}: interrupted during search phase (${companyCount} companies in DB), marking failed`);
      await prisma.deepSearchTask.update({
        where: { id: task.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: 'Task interrupted by server restart during search phase. Please start a new search.',
          progress: {
            ...savedProgress,
            phase: 'failed',
            errors: [...(savedProgress.errors || []), 'Interrupted by server restart'],
          } as any,
        },
      });
    }
  }
}

// ── 行业目录爬取 ─────────────────────────────────────────────────────

async function scrapeIndustryDirectories(
  countryCodes?: string[]
): Promise<Array<{
  companyName: string; website?: string; domain?: string;
  country?: string; services?: string[]; description?: string;
  email?: string; phone?: string; source: string; confidence: number;
}>> {
  const directories = getDirectoryUrls(countryCodes);
  console.log(`[deep-search] Scraping ${directories.length} industry directories`);

  const allResults: Array<{
    companyName: string; website?: string; domain?: string;
    country?: string; services?: string[]; description?: string;
    email?: string; phone?: string; source: string; confidence: number;
  }> = [];

  // 并发爬取目录，每批 10 个
  for (let i = 0; i < directories.length; i += 10) {
    const batch = directories.slice(i, i + 10);
    const batchResults = await Promise.allSettled(
      batch.map(async (dir) => {
        try {
          const companies = await scrapeDirectoryPage(dir.url, dir.country);
          return companies;
        } catch (err) {
          console.warn(`[deep-search] Directory ${dir.url} failed: ${err}`);
          return [];
        }
      })
    );

    for (const res of batchResults) {
      if (res.status === 'fulfilled') {
        allResults.push(...res.value);
      }
    }

    if (i + 10 < directories.length) {
      await delay(300);
    }
  }

  return allResults;
}

function getDirectoryUrls(countryCodes?: string[]): Array<{ url: string; country?: string }> {
  // 全球/欧洲货代行业目录
  const globalDirs: Array<{ url: string; country?: string }> = [
    // FIATA members & directories
    { url: 'https://fiata.org/about-fiata/members/' },
    // FreightForwarderQuote directory
    { url: 'https://www.freightos.com/freight-resources/freight-forwarder-directory/' },
    // European logistics directories
    { url: 'https://www.searates.com/companies/freight-forwarders' },
    { url: 'https://www.logisticsinside.eu/logistics-directory/' },
    // Country-specific directories
    { url: 'https://www.dslv.org/dslv/web.nsf/id/pa_mitglieder_en.html', country: 'DE' },
    { url: 'https://www.fenex.nl/en/about-fenex/members/', country: 'NL' },
    { url: 'https://www.bifa.org/members/search', country: 'GB' },
    { url: 'https://www.tlifranceassociations.fr/en/members/', country: 'FR' },
    { url: 'https://www.spediporto.it/en/associates/', country: 'IT' },
    { url: 'https://www.feteia.org/en/members/', country: 'ES' },
    { url: 'https://www.pisil.com/members', country: 'PL' },
    { url: 'https://www.speditorer.dk/english/members', country: 'DK' },
    { url: 'https://www.huolintaliitto.fi/en/member-companies.html', country: 'FI' },
    { url: 'https://www.transportbedrijven.be/en/our-members', country: 'BE' },
    // Cargo/shipping directories
    { url: 'https://www.worldcargonews.com/directory' },
    { url: 'https://www.joc.com/logistics-providers' },
    // Trade data directories
    { url: 'https://www.europages.co.uk/companies/freight%20forwarding.html' },
    { url: 'https://www.europages.co.uk/companies/logistics.html' },
    { url: 'https://www.europages.co.uk/companies/transport.html' },
    // Kompass directory
    { url: 'https://www.kompass.com/z/freight-forwarding/6580/' },
    // Yellow pages type
    { url: 'https://www.dnb.com/business-directory/industry-analysis.freight-forwarding.html' },
  ];

  // 如果指定了国家，添加国家特定的 Europages 搜索
  const targetCountries = countryCodes?.length
    ? EUROPEAN_COUNTRIES.filter(c => countryCodes.includes(c.code))
    : EUROPEAN_COUNTRIES.slice(0, 20); // 默认前 20 个主要国家

  for (const country of targetCountries) {
    globalDirs.push({
      url: `https://www.europages.co.uk/companies/${encodeURIComponent(country.name.toLowerCase())}%20freight%20forwarding.html`,
      country: country.code,
    });
    globalDirs.push({
      url: `https://www.europages.co.uk/companies/${encodeURIComponent(country.name.toLowerCase())}%20logistics.html`,
      country: country.code,
    });
  }

  return globalDirs;
}

// ── 查询构建（目标 10000+ 公司，需要大量多维度查询） ─────────────────

function buildSearchQueries(countryCodes?: string[], customQueries?: string[]): string[] {
  const queries: string[] = [];

  const targetCountries = countryCodes?.length
    ? EUROPEAN_COUNTRIES.filter(c => countryCodes.includes(c.code))
    : EUROPEAN_COUNTRIES;

  // ── 服务类型 ──
  const serviceQueries = [
    'freight forwarder LCL FCL shipping',
    'cargo forwarding logistics company',
    'sea freight ocean forwarding agent',
    'customs broker clearance agent',
    'warehousing distribution logistics',
    'air freight cargo forwarding company',
    'rail freight transport logistics',
    'NVOCC shipping line agent',
    'supply chain management 3PL provider',
    'international shipping company',
    'container shipping consolidation',
    'project cargo heavy lift transport',
    'dangerous goods hazmat shipping',
    'cold chain temperature controlled logistics',
    'ecommerce fulfillment cross-border shipping',
  ];

  // ── 行业协会/目录 ──
  const directoryQueries = [
    'freight forwarders association members list',
    'logistics association directory',
    'FIATA member freight forwarder',
    'customs brokers association',
    'logistics company directory list',
    'shipping agent register',
    'transport company business listing',
  ];

  // ── 主要欧洲城市（港口和物流枢纽） ──
  const europeanCities: Array<{ city: string; country: string }> = [
    // 德国
    { city: 'Hamburg', country: 'DE' }, { city: 'Bremen', country: 'DE' },
    { city: 'Frankfurt', country: 'DE' }, { city: 'Munich', country: 'DE' },
    { city: 'Düsseldorf', country: 'DE' }, { city: 'Berlin', country: 'DE' },
    { city: 'Stuttgart', country: 'DE' }, { city: 'Cologne', country: 'DE' },
    // 荷兰/比利时
    { city: 'Rotterdam', country: 'NL' }, { city: 'Amsterdam', country: 'NL' },
    { city: 'Antwerp', country: 'BE' }, { city: 'Brussels', country: 'BE' },
    // 法国
    { city: 'Paris', country: 'FR' }, { city: 'Marseille', country: 'FR' },
    { city: 'Lyon', country: 'FR' }, { city: 'Le Havre', country: 'FR' },
    // 英国
    { city: 'London', country: 'GB' }, { city: 'Manchester', country: 'GB' },
    { city: 'Liverpool', country: 'GB' }, { city: 'Southampton', country: 'GB' },
    { city: 'Felixstowe', country: 'GB' },
    // 意大利
    { city: 'Milan', country: 'IT' }, { city: 'Genoa', country: 'IT' },
    { city: 'Rome', country: 'IT' }, { city: 'Naples', country: 'IT' },
    // 西班牙
    { city: 'Barcelona', country: 'ES' }, { city: 'Madrid', country: 'ES' },
    { city: 'Valencia', country: 'ES' }, { city: 'Bilbao', country: 'ES' },
    // 北欧
    { city: 'Copenhagen', country: 'DK' }, { city: 'Stockholm', country: 'SE' },
    { city: 'Gothenburg', country: 'SE' }, { city: 'Oslo', country: 'NO' },
    { city: 'Helsinki', country: 'FI' },
    // 东欧
    { city: 'Warsaw', country: 'PL' }, { city: 'Gdansk', country: 'PL' },
    { city: 'Prague', country: 'CZ' }, { city: 'Budapest', country: 'HU' },
    { city: 'Bucharest', country: 'RO' }, { city: 'Vienna', country: 'AT' },
    { city: 'Zurich', country: 'CH' }, { city: 'Basel', country: 'CH' },
    // 波罗的海
    { city: 'Tallinn', country: 'EE' }, { city: 'Riga', country: 'LV' },
    { city: 'Vilnius', country: 'LT' }, { city: 'Klaipeda', country: 'LT' },
    // 南欧
    { city: 'Lisbon', country: 'PT' }, { city: 'Athens', country: 'GR' },
    { city: 'Piraeus', country: 'GR' }, { city: 'Istanbul', country: 'TR' },
    { city: 'Izmir', country: 'TR' }, { city: 'Mersin', country: 'TR' },
    // 其他
    { city: 'Dublin', country: 'IE' }, { city: 'Zagreb', country: 'HR' },
    { city: 'Ljubljana', country: 'SI' }, { city: 'Constanta', country: 'RO' },
    // 亚洲主要城市
    { city: 'Shanghai', country: 'CN' }, { city: 'Shenzhen', country: 'CN' },
    { city: 'Guangzhou', country: 'CN' }, { city: 'Ningbo', country: 'CN' },
    { city: 'Qingdao', country: 'CN' }, { city: 'Tianjin', country: 'CN' },
    { city: 'Hong Kong', country: 'CN' }, { city: 'Xiamen', country: 'CN' },
    { city: 'Mumbai', country: 'IN' }, { city: 'Delhi', country: 'IN' },
    { city: 'Chennai', country: 'IN' }, { city: 'Nhava Sheva', country: 'IN' },
    { city: 'Singapore', country: 'SG' },
    { city: 'Tokyo', country: 'JP' }, { city: 'Yokohama', country: 'JP' },
    { city: 'Busan', country: 'KR' },
    { city: 'Bangkok', country: 'TH' }, { city: 'Ho Chi Minh', country: 'VN' },
    { city: 'Jakarta', country: 'ID' }, { city: 'Manila', country: 'PH' },
    { city: 'Kuala Lumpur', country: 'MY' },
    // 中东
    { city: 'Dubai', country: 'AE' }, { city: 'Jeddah', country: 'SA' },
    // 美洲
    { city: 'Montreal', country: 'CA' }, { city: 'Toronto', country: 'CA' },
    { city: 'Vancouver', country: 'CA' },
    { city: 'New York', country: 'US' }, { city: 'Los Angeles', country: 'US' },
    { city: 'Chicago', country: 'US' }, { city: 'Miami', country: 'US' },
    { city: 'Houston', country: 'US' },
    { city: 'Santos', country: 'BR' }, { city: 'São Paulo', country: 'BR' },
    // 非洲
    { city: 'Cape Town', country: 'ZA' }, { city: 'Durban', country: 'ZA' },
    { city: 'Lagos', country: 'NG' }, { city: 'Mombasa', country: 'KE' },
  ];

  // ── 1. 国家 × 服务类型 ──
  for (const country of targetCountries) {
    for (const q of serviceQueries) {
      queries.push(`${country.name} ${q}`);
    }
    for (const q of directoryQueries) {
      queries.push(`${country.name} ${q}`);
    }
    // 本地语言
    if (country.local !== country.name) {
      queries.push(`${country.local} freight forwarder logistics`);
      queries.push(`${country.local} spedition logistik transport`);
    }
    queries.push(`${country.name} export to Canada freight forwarder`);
    queries.push(`${country.name} shipping company contact email`);
  }

  // ── 2. 城市级别搜索 ──
  for (const { city } of europeanCities) {
    queries.push(`${city} freight forwarder logistics company`);
    queries.push(`${city} shipping agent customs broker`);
    queries.push(`${city} cargo forwarding company contact`);
  }

  // ── 3. 贸易航线搜索 ──
  const tradeLanes = [
    'Europe to Canada freight forwarder',
    'Europe to USA shipping company',
    'China to Europe freight forwarder',
    'China to Canada logistics company',
    'India to Europe freight forwarding',
    'Asia to Europe container shipping',
    'Europe to Africa logistics company',
    'Middle East to Europe freight',
    'South America to Europe shipping',
    'transatlantic freight forwarder LCL',
    'Europe Mediterranean shipping company',
    'Baltic Sea freight shipping company',
    'North Sea logistics shipping agent',
    'Black Sea freight forwarding company',
  ];
  queries.push(...tradeLanes);

  // ── 4. 全球/区域查询 ──
  const globalQueries = [
    'European freight forwarders directory complete list',
    'top 100 freight forwarding companies Europe',
    'top 50 logistics companies world',
    'CLECAT European logistics association members',
    'European Shippers Council member companies',
    'FIATA national association members list',
    'freight forwarder company database worldwide',
    'international logistics company directory',
    'freight forwarding company list Asia Pacific',
    'China top freight forwarder export company list',
    'India logistics company freight forwarder directory',
    'Turkey freight forwarder logistics company list',
    'Middle East freight forwarding companies directory',
    'South America logistics freight forwarder',
    'Africa freight forwarding company directory',
    'Southeast Asia freight forwarder company',
    'IATA cargo agent airline freight forwarder',
    'WCA world cargo alliance members',
    'Global Logistics Network members directory',
    'Worldwide Independent Network members',
    'freight forwarder network alliance members list',
    'NVOCC company list worldwide',
    'customs broker directory international',
    '3PL third party logistics company list',
    'cross-border ecommerce logistics company',
    'perishable goods cold chain logistics company',
    'automotive logistics transport company Europe',
    'pharmaceutical logistics company GxP GDP',
    'European LCL consolidation companies',
    'Europe to North America freight forwarders',
    'transatlantic shipping companies LCL FCL',
  ];
  queries.push(...globalQueries);

  // ── 5. 加拿大特定 ──
  const canadaQueries = [
    'Canada import data European exporters shipping',
    'Port of Montreal European imports shipping companies',
    'Port of Halifax imports freight companies',
    'Canada customs broker European imports',
    'Montreal freight forwarding European imports',
    'Toronto freight forwarder import export',
    'Vancouver freight forwarding Asian imports',
    'Canadian freight forwarder directory list',
  ];
  queries.push(...canadaQueries);

  if (customQueries?.length) {
    queries.push(...customQueries);
  }

  const unique = [...new Set(queries)];
  console.log(`[deep-search] Built ${unique.length} search queries`);
  return unique;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function updateProgress(taskId: string, progress: ProgressInfo): Promise<void> {
  try {
    await prisma.deepSearchTask.update({
      where: { id: taskId },
      data: { progress: progress as any },
    });
  } catch {}
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export async function cancelDeepSearch(taskId: string): Promise<void> {
  cancelledTasks.add(taskId);
  await prisma.deepSearchTask.update({
    where: { id: taskId },
    data: { status: 'CANCELLED', completedAt: new Date() },
  });
}
