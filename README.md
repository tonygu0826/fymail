# FyMail

FyMail is a standalone outbound prospecting web app for FYWarehouse at `mail.fywarehouse.com`. This repository contains the first locally testable MVP built with Next.js 14, TypeScript, Tailwind CSS, PostgreSQL, and Prisma.

## MVP Status

Implemented in this stage:

- dashboard page
- template create/list/edit flows backed by Prisma
- contacts create/list flows backed by Prisma
- campaign draft create/list flows with template and contact selection
- real SMTP-backed manual single-send flow from a selected template to a selected contact
- `EmailLog` persistence for send attempts and outcomes
- settings page
- working status page
- health API endpoint
- Prisma schema for core prospecting entities
- JSON API routes for templates, contacts, campaigns, settings, dashboard, and health
- local seed helper and exact test commands

Intentionally not implemented yet:

- queue workers and Redis
- bulk sending, queue workers, retries, and rate limiting
- CSV import processor
- auth and multi-user permissions
- analytics and reply tracking

## Requirements

- Node.js 20+ or 22+
- npm 10+
- PostgreSQL with a database named `fymail`
- PostgreSQL user `fymail_user`

## Environment Setup

1. Copy `.env.example` to `.env.local`.
2. Update `DATABASE_URL` for your PostgreSQL instance.
3. Set SMTP values only through `.env.local` when you want to test real delivery.

Example:

```bash
cp .env.example .env.local
```

SMTP variables used by D1:

- `SMTP_HOST` required
- `SMTP_PORT` required
- `SMTP_SECURE` optional, defaults to `true` when port is `465`, otherwise `false`
- `SMTP_USER` required
- `SMTP_PASSWORD` required
- `SMTP_FROM_EMAIL` optional, defaults to `SMTP_USER`
- `SMTP_FROM_NAME` optional

Gmail SMTP example for the validated FYWarehouse mailbox:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ops@fywarehouse.com
SMTP_PASSWORD=REPLACE_WITH_REAL_SECRET
SMTP_FROM_EMAIL=ops@fywarehouse.com
SMTP_FROM_NAME=FYWarehouse Ops
```

## Install

```bash
npm install
```

## Prisma Setup

Generate the client:

```bash
npm run db:generate
```

Push the schema to your local database:

```bash
npm run db:push
```

Seed local MVP data:

```bash
npm run db:seed
```

Optional: open Prisma Studio.

```bash
npm run db:studio
```

## Run Locally

```bash
npm run dev
```

Open:

- `http://localhost:3000/dashboard`
- `http://localhost:3000/templates`
- `http://localhost:3000/contacts`
- `http://localhost:3000/campaigns`
- `http://localhost:3000/settings`
- `http://localhost:3000/status`
- `http://localhost:3000/api/health`

## Exact Local Test Flow

Run these commands from the repo root:

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Then verify these MVP flows in the browser:

1. Open `http://localhost:3000/status` and confirm the database is reachable.
2. Open `http://localhost:3000/settings` and confirm SMTP readiness is safe to view and secrets are not shown.
3. Open `http://localhost:3000/templates`, create a template, then open its edit screen and save changes.
4. Open `http://localhost:3000/contacts` and create a contact with an inbox you control.
5. Open `http://localhost:3000/campaigns`, select a template and one or more contacts, and save a draft campaign.
6. In the `Manual single send` panel on `/campaigns`, select one template and one contact, tick the guardrail checkbox, and send one real email.
7. Return to `/settings` and confirm `Email Logs` increased.

You can also hit the JSON APIs directly:

```bash
curl http://localhost:3000/api/templates
curl http://localhost:3000/api/contacts
curl http://localhost:3000/api/campaigns
curl http://localhost:3000/api/settings
curl http://localhost:3000/api/health
```

Example create requests:

```bash
curl -X POST http://localhost:3000/api/templates \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Benelux Intro",
    "slug":"benelux-intro",
    "language":"EN",
    "subject":"Canada-bound LCL support for Benelux forwarders",
    "bodyHtml":"<p>Hello {{contactName}},</p><p>We support Canada-bound LCL moves.</p>",
    "bodyText":"Hello {{contactName}}, we support Canada-bound LCL moves.",
    "variables":["contactName","companyName","countryCode"],
    "status":"DRAFT"
  }'
```

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H 'Content-Type: application/json' \
  -d '{
    "companyName":"Channel Freight Ltd",
    "contactName":"Emma Clarke",
    "email":"emma@channelfreight.example",
    "countryCode":"UK",
    "status":"READY",
    "tags":["uk","priority"]
  }'
```

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Benelux Week 1",
    "templateId":"REPLACE_WITH_TEMPLATE_ID",
    "contactIds":["REPLACE_WITH_CONTACT_ID"],
    "status":"DRAFT"
  }'
```

## Verification

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

## Notes On Data Behavior

- If `DATABASE_URL` is present and Prisma can connect, the app reads and writes real data.
- The UI uses server actions for the browser flows and the API routes remain available for direct testing.
- If the database is not configured or not ready, read views fall back to safe demo data so health and route checks still render.
- Real delivery is intentionally limited to one manual recipient per action. FyMail D1 is not production-ready for bulk sending.
