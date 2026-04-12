# FENGYE LOGISTICS — 项目记忆

> Claude 启动时自动加载本文件。请在每次会话开始读完，再继续工作。

## 业务背景

- **公司**：FENGYE LOGISTICS（枫叶物流），加拿大持牌 CBSA sufferance/bonded warehouse
- **官网**：https://www.fywarehouse.com
- **市场**：主推欧洲市场（荷兰、德国、法国货代客户），利用 CETA 加欧自贸协定
- **核心服务**：加拿大清关、保税仓、CARM 注册代理、最后一公里配送
- **联系人**：Tony（运营），Kris（kris.y@fywarehouse.com，所有客户邮件 CC 她）

## 服务器环境

- **主机**：VM-0-16-ubuntu（腾讯云）
- **路径**：所有项目都在 `/home/ubuntu/` 下，Claude sandbox **可以直接读写**（Read/Write/Edit/Bash 全部本地可用，不需要让用户粘贴命令）
- **进程管理**：PM2 + systemd 自启
- **数据库**：PostgreSQL（fymail 用 Prisma ORM）

### 关键目录

```
/home/ubuntu/fymail/                                     # 邮件系统（Next.js + Prisma 单体应用，不是 git repo 里的 Fastify 版本）
/home/ubuntu/.openclaw/workspace/fywarehouse-nextjs/     # 官网（Next.js 14 App Router）—— 注意是 .openclaw/workspace 下
/home/ubuntu/fymail/scripts/                             # 所有 cron 脚本
```

### 密钥位置

所有密钥都在 `/home/ubuntu/fymail/.env.local` 和 `/home/ubuntu/.openclaw/workspace/fywarehouse-nextjs/.env.local`：

- `DATABASE_URL` — PostgreSQL
- `API_SECRET_KEY` — fymail 内部 API 鉴权
- `RESEND_API_KEY` — 邮件发送（Resend Pro，已替代 Gmail SMTP 和 AWS SES）
- `GOOGLE_ADS_*` — Google Ads API（Customer ID 1342197321，已开通）
- `ANTHROPIC_API_KEY` — Claude AI 调用
- `NEWS_API_KEY` / `JINA_API_KEY` — SEO 内容管线

> **不要把密钥写到 CLAUDE.md 或 git 里。**

## Cron 任务清单

```cron
*/2 * * * *  /home/ubuntu/fymail/scripts/process-queue.sh                                    # 邮件队列，每 2 分钟
0 13 * * *   /home/ubuntu/fymail/scripts/auto-followup.mjs                                   # 每天 9AM Montreal 自动跟进（Day 3/7/14）
0 6 * * 3    /home/ubuntu/fymail/scripts/run-weekly.sh                                       # 周三 2AM Europages 爬虫
0 12 * * *   /home/ubuntu/.openclaw/workspace/fywarehouse-nextjs/scripts/daily-news-cron.sh  # 每天 8AM Montreal 生成 SEO 内容
0 14 * * 0   /home/ubuntu/.openclaw/workspace/fywarehouse-nextjs/scripts/weekly-refresh-cron.sh # 周日内容刷新
0 13 * * 1   curl .../api/seo/keywords/discover                                              # 每周一关键词发现
```

每个脚本都用 `API_SECRET_KEY` 走本地 `http://localhost:3000` 调用。

## 各子系统状态

### 1. 邮件系统（fymail）

- **当前 provider**：Resend Pro（Gmail SMTP 和 AWS SES 都已弃用）
  - Gmail 因 "Too many login attempts" 触发限流，3169 封失败
  - AWS SES Production Access 因新账号 + cold email 用例两次被拒
- **每日上限**：5000 封（之前是 450）
- **批次大小**：5
- **自动跟进**：Day 3 / Day 7 / Day 14，由 `auto-followup.mjs` 处理
- **数据清洁**：曾有 2 条 `null contactId/templateId` 脏数据，已标记 FAILED
- **当前进度**：~2866 封 PENDING 待发（截至上次会话）

### 2. SEO 内容管线（fywarehouse-nextjs）

- **关键词数据源**：Google Ads API（`generateKeywordHistoricalMetrics`）
  - Geo target: 2124 (Canada)，Language: 1000 (English)
  - 已落库 57 个真实关键词
- **关键文件**：
  - `src/lib/keyword-api.ts` — Google Ads 调用封装
  - `src/lib/keyword-research.ts` — `discoverKeywords()` / `matchKeywordForNews()`
  - `src/lib/content-pipeline.ts` — Phase 1 RSS 改写 + Phase 2 原创
  - `src/app/api/seo/keywords/refresh/route.ts` — 手动刷新端点
- **404 修复**：`/trackingTracking → /tracking`、`/Home → /`、`/zh` 和 `/zh/:path* → /` 都已在 `next.config.mjs` 里做了 308 redirect
- **GA 安装**：三个 GA4 ID 在 `src/app/layout.tsx` 里**无条件加载**
  - `G-HY3YP9YVPW`、`G-HD9MSP5L8G`、`G-VWSC3KX9BD`
  - 一次 `gtag.js` 加载 + 三行 `gtag('config', ...)`
  - SPA 路由切换由 `AnalyticsProvider` + `trackPageView` 接管，需 cookie 同意后才上报
- **CSP 已修**：`next.config.mjs` 的 `script-src` / `connect-src` / `img-src` 都已加入：
  - `https://www.googletagmanager.com`
  - `https://www.google-analytics.com`
  - `https://*.google-analytics.com`
  - `https://*.analytics.google.com`（仅 script-src/connect-src）
- **/zh 已清理**：`src/app/zh/` 整个目录已删除；根 `layout.tsx` 的 `alternates.languages` 也移除了 `zh` 条目，避免 hreflang 指向 301 链

### 3. 客户获取渠道

- **Crisp 聊天机器人**：已装（script tag 注入），Hugo AI 知识库 7 篇文章
- **LinkedIn**：
  - 账号曾被锁，已 ID 验证解锁
  - 策略：先发内容养号，每天 5–8 个连接请求（荷兰/德国/法国货代）
  - **进行中**：Sales Navigator onboarding 卡在"save example leads"，需要搜 "freight forwarder" 或 "DSV" 保存相关 leads，或 Next 跳过
- **内容外链**（每周节奏）：Medium、Blogger、Substack
  - Vocal 文章已提交，等审核
- **Europages 爬虫**：周三自动跑，结果灌入 fymail 联系人池

## 沟通偏好（重要）

- **不要 AI 味**：用户明确要求"文章内容要重新写一写，去掉 ai 味"——少用 emoji、少 bullet、多对话语气、像人写的
- **直接执行**：用户说过"你来给我直接搞定，不要总是我来操作"——能自己跑的就直接跑，Read/Write/Edit/Bash 都能直接动 `/home/ubuntu/` 下的文件，不要让用户去 nano/复制命令
- **客户邮件**：所有回复要 CC `kris.y@fywarehouse.com`，语气要专业但不冷淡，体现"我们是真人在做"
- **回复中文**：跟用户对话用中文

## 已解决的坑（避免再踩）

| 问题 | 教训 |
|---|---|
| Gmail SMTP 限流 | 不要用个人 Gmail 发批量邮件 |
| AWS SES 拒批 | 新账号 + cold email = 必拒，直接用 Resend |
| AWS IAM permission boundary | PRINCE/FENGYE 用户都有边界，必须用 Root |
| fymail 架构错认 | git repo 是 pg-boss + Fastify，**实际服务器跑的是 Next.js + Prisma 单体**，改 git 的 service 文件没用 |
| LinkedIn 账号锁 | 新号操作太快会触发验证，慢慢来 |
| GA 被 CSP 拦 | 改 CSP 时记得加 googletagmanager.com |

## 待办（按优先级）

1. **立即**：完成 LinkedIn Sales Navigator onboarding（卡在 example leads 页面）
2. **本周**：发 LinkedIn 互动帖 + Blogger + Substack 文章
3. **本周**：监控 Resend 队列把 2866 封 PENDING 发完
4. **本周**：用 Tag Assistant 验证三个 GA ID 都在上报
5. **持续**：每天 5–8 个 LinkedIn 连接请求
6. **持续**：处理客户回复邮件（CC Kris）

> 已完成：CSP 加 GA 域名 ✓ ／ 删除 `/src/app/zh/` ✓ ／ `/zh` 重定向 ✓

## 上一段完整对话

如需查看历史细节（具体代码、错误日志、客户邮件原文），转录文件在：
`/root/.claude/projects/-home-user-fymail/4119397d-56b2-4718-b13f-814566acba01.jsonl`

---

**新会话开场指引**：读完本文件后，先问用户"今天要做什么？"，不要主动 recap 全部内容。
