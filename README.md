# FyMail

FyMail is a standalone outbound prospecting web app for FYWarehouse at `mail.fywarehouse.com`. This repository contains the first locally testable MVP built with Next.js 14, TypeScript, Tailwind CSS, PostgreSQL, and Prisma.

## MVP Status

Implemented in this stage:

- dashboard page
- template management shell
- contacts management shell
- campaigns management shell
- settings page
- working status page
- health API endpoint
- Prisma schema for core prospecting entities
- environment placeholders and local run instructions

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

- If `DATABASE_URL` is present and Prisma can connect, the app reads real data.
- If the database is not configured or not ready, the UI falls back to safe demo data so the routes remain testable.
- This is deliberate for MVP bootability; the fallback should be removed once CRUD and seeding are in place.
