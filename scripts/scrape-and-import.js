#!/usr/bin/env node
/**
 * 独立爬取脚本 — 不依赖 Next.js 进程
 * 对深度搜索结果中的公司官网进行爬取，提取邮箱/电话，然后导入联系人
 */

const { PrismaClient } = require('@prisma/client');
const cheerio = require('cheerio');

const TASK_ID = process.argv[2] || 'cmngurvg90001wmam3fmp0pua';
const CONCURRENCY = 15;
const FETCH_TIMEOUT = 15000;
const prisma = new PrismaClient();

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
];

const CONTACT_PATTERNS = [
  /\/contact/i, /\/kontakt/i, /\/about/i, /\/impressum/i,
  /\/nous-contacter/i, /\/contacto/i, /\/contatti/i,
  /\/about-us/i, /\/get-in-touch/i, /\/info/i,
];

function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html,application/xhtml+xml' },
      signal: controller.signal, redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('xhtml')) return null;
    return await res.text();
  } catch { return null; }
}

function extractEmails(html) {
  const matches = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches.filter(e => {
    const l = e.toLowerCase();
    if (/\.(png|jpg|gif|svg|css|js)$/i.test(l)) return false;
    if (/^(noreply|no-reply|webmaster|postmaster|mailer-daemon)@/.test(l)) return false;
    if (l.includes('example.com') || l.includes('sentry.io') || l.includes('wixpress.com')) return false;
    return true;
  }))];
}

function extractPhones(html) {
  const matches = html.match(/\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g) || [];
  return [...new Set(matches.map(p => p.trim()).filter(p => p.length >= 10))].slice(0, 5);
}

async function scrapeCompany(url) {
  const result = { emails: [], phones: [], contactPageUrl: null };
  const homepage = await fetchPage(url);
  if (!homepage) return result;

  result.emails.push(...extractEmails(homepage));
  result.phones.push(...extractPhones(homepage));

  const $ = cheerio.load(homepage);
  // mailto links
  $('a[href^="mailto:"]').each((_, el) => {
    const email = ($(el).attr('href') || '').replace('mailto:', '').split('?')[0].trim();
    if (email && email.includes('@')) result.emails.push(email);
  });

  // Find contact pages
  const contactUrls = [];
  const seen = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const full = new URL(href, url).toString();
      if (new URL(full).hostname !== new URL(url).hostname) return;
      if (seen.has(full)) return;
      if (CONTACT_PATTERNS.some(p => p.test(full))) { seen.add(full); contactUrls.push(full); }
    } catch {}
  });

  // Scrape up to 3 contact pages
  for (const cu of contactUrls.slice(0, 3)) {
    await delay(200);
    const page = await fetchPage(cu);
    if (!page) continue;
    result.emails.push(...extractEmails(page));
    result.phones.push(...extractPhones(page));
    const $p = cheerio.load(page);
    $p('a[href^="mailto:"]').each((_, el) => {
      const email = ($p(el).attr('href') || '').replace('mailto:', '').split('?')[0].trim();
      if (email && email.includes('@')) result.emails.push(email);
    });
    if (!result.contactPageUrl) result.contactPageUrl = cu;
  }

  result.emails = [...new Set(result.emails)].slice(0, 10);
  // Sort: info@, sales@, contact@ first
  result.emails.sort((a, b) => {
    const prio = e => ['info','sales','contact','enquiry','office'].some(p => e.split('@')[0].toLowerCase().includes(p)) ? 0 : 1;
    return prio(a) - prio(b);
  });
  result.phones = [...new Set(result.phones)].slice(0, 5);
  return result;
}

async function main() {
  console.log(`[scrape] 开始爬取任务 ${TASK_ID}`);

  const companies = await prisma.deepSearchCompany.findMany({
    where: { taskId: TASK_ID, scrapeStatus: 'pending', website: { not: null } },
    select: { id: true, companyName: true, website: true },
  });
  console.log(`[scrape] 待爬取: ${companies.length} 家公司, 并发: ${CONCURRENCY}`);

  let done = 0, emailFound = 0;
  for (let i = 0; i < companies.length; i += CONCURRENCY) {
    const batch = companies.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(async c => {
      try {
        const r = await scrapeCompany(c.website);
        await prisma.deepSearchCompany.update({
          where: { id: c.id },
          data: {
            email: r.emails[0] || undefined,
            phone: r.phones[0] || undefined,
            contactPageUrl: r.contactPageUrl,
            scrapeStatus: 'done',
          },
        });
        if (r.emails[0]) emailFound++;
      } catch {
        await prisma.deepSearchCompany.update({ where: { id: c.id }, data: { scrapeStatus: 'error' } }).catch(() => {});
      }
    }));
    done += batch.length;
    if (done % 60 === 0 || done === companies.length) {
      console.log(`[scrape] 进度: ${done}/${companies.length} | 有邮箱: ${emailFound}`);
    }
    if (i + CONCURRENCY < companies.length) await delay(200);
  }

  console.log(`\n[scrape] 爬取完成! 总计: ${companies.length}, 有邮箱: ${emailFound}`);

  // ── 导入联系人 ──
  console.log(`\n[import] 开始导入联系人...`);

  const withEmail = await prisma.deepSearchCompany.findMany({
    where: { taskId: TASK_ID, email: { not: null } },
    orderBy: { confidence: 'desc' },
  });
  console.log(`[import] 有邮箱公司: ${withEmail.length}`);

  // 确保默认用户存在
  let owner = await prisma.user.findFirst();
  if (!owner) {
    console.error('[import] 没有找到用户!');
    await prisma.$disconnect();
    return;
  }

  const REGIONS = {
    DE: 'DACH', AT: 'DACH', CH: 'DACH',
    NL: 'Benelux', BE: 'Benelux', LU: 'Benelux',
    FR: 'Western Europe', GB: 'Western Europe', IE: 'Western Europe',
    IT: 'Southern Europe', ES: 'Southern Europe', PT: 'Southern Europe', GR: 'Southern Europe',
    DK: 'Nordics', SE: 'Nordics', NO: 'Nordics', FI: 'Nordics',
    PL: 'Eastern Europe', CZ: 'Eastern Europe', HU: 'Eastern Europe',
    RO: 'Eastern Europe', BG: 'Eastern Europe', SK: 'Eastern Europe',
    HR: 'Eastern Europe', SI: 'Eastern Europe',
    LT: 'Baltics', LV: 'Baltics', EE: 'Baltics',
    CN: 'Asia Pacific', IN: 'Asia Pacific', JP: 'Asia Pacific', SG: 'Asia Pacific',
    KR: 'Asia Pacific', TH: 'Asia Pacific', VN: 'Asia Pacific', MY: 'Asia Pacific',
    US: 'Americas', CA: 'Americas', BR: 'Americas', MX: 'Americas',
    TR: 'Middle East', AE: 'Middle East', SA: 'Middle East',
  };

  let imported = 0, skipped = 0;
  for (const c of withEmail) {
    const tags = ['deep-search', 'deep-search-batch',
      ...(c.services || []).map(s => s.toLowerCase()),
      ...(c.country ? [c.country.toLowerCase()] : [])
    ];

    const notes = [
      c.description, c.website && `官网: ${c.website}`,
      c.phone && `电话: ${c.phone}`, c.contactPageUrl && `联系页: ${c.contactPageUrl}`,
      c.services?.length && `服务: ${c.services.join(', ')}`,
      `来源: ${c.source} | 置信度: ${(c.confidence * 100).toFixed(0)}%`,
    ].filter(Boolean).join('\n');

    try {
      await prisma.contact.upsert({
        where: { email: c.email },
        create: {
          companyName: c.companyName,
          email: c.email,
          countryCode: c.country || 'XX',
          marketRegion: REGIONS[c.country] || undefined,
          source: `deep-search:${c.source}`,
          status: 'NEW',
          priority: Math.max(7, Math.round(c.confidence * 10)),
          score: c.confidence,
          tags: [...new Set(tags)],
          notes,
          ownerId: owner.id,
        },
        update: { tags: [...new Set(tags)], notes },
      });
      imported++;
    } catch (err) {
      if (err.code === 'P2002') skipped++;
    }
  }

  console.log(`\n========================================`);
  console.log(`导入完成!`);
  console.log(`  新增联系人: ${imported}`);
  console.log(`  已存在跳过: ${skipped}`);
  console.log(`  总处理: ${withEmail.length}`);
  console.log(`========================================`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
