# FyMail - 技术架构文档

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    用户访问层                                         │
│  mail.fywarehouse.com ──→ Cloudflare CDN/DNS ──→ Nginx反向代理        │
└─────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   应用层                                             │
│  Next.js 14 应用 (Node.js + TypeScript)                             │
│  ├── 前端页面 (App Router)                                          │
│  ├── API Routes (服务器端逻辑)                                      │
│  ├── Prisma ORM (数据库操作)                                        │
│  └── 业务逻辑层                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   数据层                                             │
│  PostgreSQL 数据库                                                  │
│  ├── 业务数据表                                                     │
│  ├── 缓存索引                                                       │
│  └── 备份机制                                                       │
│                                                                     │
│  Redis 缓存/队列                                                    │
│  ├── 邮件发送队列 (Bull)                                            │
│  ├── 会话缓存                                                       │
│  └── 限流计数器                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   外部服务层                                         │
│  Gmail SMTP (ops@fywarehouse.com)                                   │
│  ├── 邮件发送服务                                                   │
│  ├── 发送配额管理                                                   │
│  └── 发送日志记录                                                   │
│                                                                     │
│  数据采集服务                                                       │
│  ├── 欧洲货代搜索                                                   │
│  ├── 联系人提取                                                     │
│  └── 数据验证清洗                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## 技术栈详细说明

### 前端技术栈
- **Next.js 14**: React框架，支持App Router、服务器组件、API Routes
- **TypeScript**: 类型安全的JavaScript超集
- **Tailwind CSS**: 实用优先的CSS框架
- **Shadcn/ui**: 基于Radix UI的高质量组件库
- **React Hook Form**: 高性能表单管理
- **Zod**: TypeScript优先的schema验证
- **TanStack Table**: 强大的表格组件
- **Recharts**: React图表库
- **TipTap**: 无头富文本编辑器（用于邮件模板编辑）

### 后端技术栈
- **Next.js API Routes**: 服务器端API端点
- **Prisma**: 现代ORM，支持TypeScript和迁移
- **Nodemailer**: Node.js邮件发送库
- **Bull**: Redis队列库，用于后台任务
- **Redis**: 内存数据结构存储，用于队列和缓存
- **JWT**: JSON Web Token用于认证（未来扩展）

### 数据库设计
- **PostgreSQL 16**: 关系型数据库，支持JSONB、全文搜索
- **数据库名称**: `fymail`
- **数据库用户**: `fymail_user`
- **连接池**: Prisma连接池管理

### 基础设施
- **服务器**: 现有VPS (43.166.132.131)
- **操作系统**: Ubuntu 22.04 LTS
- **Web服务器**: Nginx 1.18
- **进程管理**: PM2
- **域名**: mail.fywarehouse.com (Cloudflare管理)
- **SSL证书**: Let's Encrypt

## 目录结构

```
fymail/
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 首页/仪表板
│   ├── dashboard/               # 仪表板页面
│   ├── templates/               # 模板管理
│   │   ├── page.tsx            # 模板列表
│   │   ├── [id]/               # 模板详情/编辑
│   │   └── new/                # 新建模板
│   ├── contacts/                # 联系人管理
│   ├── campaigns/               # 发送活动
│   ├── analytics/               # 统计分析
│   └── api/                     # API路由
│       ├── mail/                # 邮件相关API
│       ├── templates/           # 模板API
│       ├── contacts/            # 联系人API
│       └── campaigns/           # 活动API
├── components/                  # 可复用组件
│   ├── ui/                      # 基础UI组件（shadcn/ui）
│   ├── email-editor/            # 邮件编辑器组件
│   ├── contact-table/           # 联系人表格组件
│   ├── campaign-wizard/         # 活动创建向导
│   └── analytics-charts/        # 统计图表组件
├── lib/                         # 工具库和工具函数
│   ├── db/                      # 数据库连接和工具
│   │   └── index.ts             # Prisma客户端实例
│   ├── mail/                    # 邮件发送核心
│   │   ├── sender.ts            # 邮件发送器
│   │   ├── queue.ts             # 发送队列
│   │   └── templates.ts         # 模板渲染
│   ├── scraping/                # 数据采集工具
│   │   ├── europe-forwarders.ts # 欧洲货代搜索
│   │   └── contact-extractor.ts # 联系人提取
│   └── utils/                   # 通用工具函数
│       ├── validation.ts        # 数据验证
│       ├── csv-parser.ts        # CSV解析
│       └── logger.ts            # 日志工具
├── prisma/                      # 数据库schema和迁移
│   ├── schema.prisma            # Prisma schema
│   └── migrations/              # 数据库迁移文件
├── public/                      # 静态资源
│   ├── images/                  # 图片资源
│   └── fonts/                   # 字体文件
├── styles/                      # 全局样式
│   └── globals.css              # 全局CSS
├── types/                       # TypeScript类型定义
│   ├── index.ts                 # 全局类型导出
│   ├── mail.ts                  # 邮件相关类型
│   └── database.ts              # 数据库类型
├── .env.local                   # 本地环境变量（不提交到Git）
├── .env.production              # 生产环境变量
├── package.json                 # 依赖和脚本
├── tsconfig.json                # TypeScript配置
├── next.config.js               # Next.js配置
├── tailwind.config.js           # Tailwind配置
└── DESIGN.md                    # 设计文档（当前文件）
```

## 数据库架构

### 核心表关系

```
users
  ├── email_templates (1:n)
  ├── contacts (1:n)
  └── campaigns (1:n)

email_templates
  └── campaigns (1:n)

contacts
  └── campaign_contacts (1:n)

campaigns
  ├── campaign_contacts (1:n)
  └── email_logs (1:n)
```

### 详细表结构
（见 DATABASE-SCHEMA.md）

## API设计原则

### RESTful API设计
- 使用HTTP动词：GET、POST、PUT、DELETE
- 资源导向的URL设计
- 一致的错误响应格式
- 版本化管理（未来需要时）

### 响应格式
```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入数据无效",
    "details": { ... }
  }
}
```

### 认证与授权
- 初期：单用户模式，无需复杂认证
- 未来：JWT + 角色权限控制
- API密钥用于外部集成

## 邮件发送流程

### 单封邮件发送流程
1. 用户触发发送 → API验证请求
2. 渲染邮件模板（变量替换）
3. 构建邮件消息（主题、正文、附件）
4. 通过Nodemailer发送到Gmail SMTP
5. 记录发送日志
6. 返回发送结果

### 批量邮件发送流程
1. 用户创建发送活动 → 选择模板和联系人
2. 将发送任务加入Bull队列
3. Worker进程从队列获取任务
4. 按批次发送（控制发送间隔）
5. 实时更新发送状态
6. 完成后生成统计报告

### 防垃圾邮件策略
1. **发送间隔控制**：每封邮件间隔10-30秒
2. **发送量限制**：每小时不超过100封
3. **发送时间优化**：目标时区的工作时间
4. **内容优化**：避免垃圾邮件关键词
5. **监控反馈**：监控退回率和投诉率

## 性能考虑

### 前端性能优化
- 代码分割和懒加载
- 图片优化（Next.js Image组件）
- 静态资源CDN缓存
- 客户端状态管理优化

### 后端性能优化
- 数据库查询优化（索引、连接池）
- API响应缓存（Redis）
- 邮件发送队列（异步处理）
- 批量操作优化

### 数据库性能
- 合理设计索引
- 查询优化（避免N+1查询）
- 定期清理旧数据
- 数据库连接池配置

## 安全架构

### 数据安全
- 数据库连接加密（SSL/TLS）
- 敏感信息加密存储（SMTP密码）
- 输入验证和清理
- SQL注入防护（Prisma自动处理）

### 应用安全
- XSS防护（React自动转义）
- CSRF防护（Next.js内置）
- 请求限流（防止滥用）
- 安全头设置（CSP、HSTS等）

### 基础设施安全
- 服务器防火墙配置
- 最小权限原则
- 定期安全更新
- 日志监控和告警

## 部署架构

### 开发环境
- 本地开发：Node.js + SQLite
- 代码热重载
- 开发工具支持

### 生产环境
```
用户 → Cloudflare → Nginx → PM2 (Next.js) → PostgreSQL → Redis
```

### 部署流程
1. 代码提交到Git仓库
2. 自动测试（未来）
3. 构建Next.js应用
4. 数据库迁移
5. PM2重启应用
6. 健康检查

### 监控告警
- 应用日志（PM2日志）
- 数据库监控（连接数、查询性能）
- 服务器监控（CPU、内存、磁盘）
- 邮件发送监控（成功率、延迟）

## 扩展性设计

### 水平扩展
- 无状态应用层（可多实例部署）
- 数据库读写分离（未来需要时）
- Redis集群（高可用）

### 功能扩展点
1. **多语言支持**：i18n国际化
2. **多用户系统**：团队协作功能
3. **API开放平台**：第三方集成
4. **多渠道营销**：短信、社交媒体集成
5. **AI增强**：智能邮件撰写、发送优化

### 数据量扩展
- 分区表设计（按时间分区）
- 归档策略（旧数据归档）
- 冷热数据分离

## 容灾与备份

### 数据备份
- 数据库每日自动备份
- 备份文件加密存储
- 定期恢复测试

### 高可用
- 应用层：PM2集群模式
- 数据库：主从复制（未来）
- 缓存：Redis哨兵模式

### 故障恢复
- 监控告警系统
- 自动化恢复脚本
- 灾难恢复预案

---
**文档版本**: 1.0  
**创建时间**: 2026-03-24  
**最后更新**: 2026-03-24