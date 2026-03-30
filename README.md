# FYMail — Freight Outreach Workbench

Internal B2B outreach platform for FYWarehouse. Market intelligence, contact management, email campaigns, automation rules, approval workflows, system monitoring.

## Structure

```
fymail/
├── fymail-api/          # Fastify + Drizzle + PostgreSQL
├── fymail-web/          # Next.js 14
├── docker-compose.yml
└── .github/workflows/   # CI + deploy
```

## Quick start (local)

```bash
# Backend
cd fymail-api && cp .env.example .env
pnpm install && pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev   # :3001

# Frontend
cd fymail-web && cp .env.local.example .env.local
pnpm install && pnpm dev   # :3000
```

## Quick start (Docker)

```bash
docker-compose up --build
docker-compose exec api node dist/db/migrate.js
```

## Modules

| Module | Route | Description |
|---|---|---|
| Dashboard | /dashboard | KPIs, contact breakdown, activity |
| Intelligence | /intelligence | Search companies, import to Contacts |
| Contacts | /contacts | Pool management, CSV import |
| Campaigns | /campaigns | Create + run email outreach |
| Templates | /templates | Template library with variables |
| Automation | /automation | Trigger → condition → action rules |
| Approvals | /approvals | Pre-send review queue |
| Status | /status | Health monitoring |
| Settings | /settings/email | SMTP configuration |

## Template variables

`{{first_name}}` `{{last_name}}` `{{company}}` `{{job_title}}` `{{country}}` `{{service_type}}` `{{website}}`

## Tech stack

Frontend: Next.js 14, TypeScript, Tailwind CSS, TanStack Query  
Backend: Fastify, Drizzle ORM, PostgreSQL (Supabase)  
Infra: Vercel (web), Railway (api), GitHub Actions CI

## Dev phases

- Phase 1-3: ✅ Contacts / Templates / Campaigns / Approvals / Automation / Status
- Phase 4: 🔲 Intelligence backend (Google/Bing API)
- Phase 5: 🔲 Analytics + reply rate charts
