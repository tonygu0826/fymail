# FyMail

FyMail is a standalone outbound prospecting web app for FYWarehouse at `mail.fywarehouse.com`. This repository contains the first locally testable MVP built with Next.js 14, TypeScript, Tailwind CSS, PostgreSQL, and Prisma.

## MVP Status

Implemented in this stage:

- dashboard page
- template create/list/edit flows backed by Prisma
- contacts create/list flows backed by Prisma
- campaign draft create/list flows with template and contact selection
- settings page
- working status page
- health API endpoint
- Prisma schema for core prospecting entities
- JSON API routes for templates, contacts, campaigns, settings, dashboard, and health
- local seed helper and exact test commands

Intentionally not implemented yet:

- SMTP delivery workflow
- queue workers and Redis
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
3. Leave SMTP values as placeholders unless you are actively wiring mail delivery in a later milestone.

Example:

```bash
cp .env.example .env.local
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
2. Open `http://localhost:3000/templates`, create a template, then open its edit screen and save changes.
3. Open `http://localhost:3000/contacts` and create a contact.
4. Open `http://localhost:3000/campaigns`, select a template and one or more contacts, and save a draft campaign.
5. Open `http://localhost:3000/settings` and confirm environment readiness, safe runtime config, and live record counts.

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
