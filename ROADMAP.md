# FyMail Roadmap

## Current Target

Reach a clean, locally testable MVP for outbound prospecting operations at `mail.fywarehouse.com`.

Definition of done for this stage:

- app boots locally
- Prisma schema exists for core entities
- dashboard, templates, contacts, campaigns, settings, and status pages render
- health API works
- environment setup is documented without secrets
- repository contains run and verification instructions

## Phase 0: Planning And Scaffold

Status: In progress

Deliverables:

- `DATABASE-SCHEMA.md`
- `API-SPEC.md`
- `ROADMAP.md`
- Next.js 14 + TypeScript + Tailwind + Prisma project initialization
- baseline app layout and navigation

Risks managed in this phase:

- overbuilding mail features before the foundation exists
- locking into a schema that cannot support queueing and analytics later

## Phase 1: Testable MVP

Status: In progress

Scope:

- dashboard overview page
- template management shell
- contacts management shell
- campaigns management shell
- settings page
- health/status page
- sample server-side summaries from database when available
- safe fallback behavior when environment is partially configured

MVP simplifications:

- single-user mode only
- no auth flow
- no SMTP send workflow yet
- no Redis/Bull worker yet
- no CSV import processor yet
- no analytics charts beyond simple counts

Acceptance checks:

1. `npm install` completes
2. `npm run lint` passes
3. `npm run db:generate` passes
4. `npm run dev` starts successfully
5. main routes render without runtime errors

## Phase 2: Data Entry And CRUD

Planned next:

- create/edit forms for templates, contacts, and campaigns
- API validation with Zod on all write routes
- seed command for demo data
- CSV import workflow
- optimistic UI and success/error states

## Phase 3: Outbound Delivery Engine

Planned next:

- SMTP configuration validation
- test email send flow
- queue-backed campaign execution
- delivery logs and retry policy
- rate limiting and safe send windows by country/timezone

## Phase 4: Tracking And Operations

Planned next:

- richer campaign reporting
- reply workflow tracking
- suppression and unsubscribe management
- operational audit trails
- deployment automation for VPS + PM2 + Nginx

## Phase 5: Advanced Prospecting

Planned next:

- contact enrichment/import tooling
- multilingual template workflows
- A/B testing
- analytics and conversion views

## Execution Principles

- prefer working software over placeholder architecture
- keep secrets in environment variables only
- commit in small, reviewable increments
- do not label future integrations as complete before they exist
- preserve a path to Redis queueing and mail delivery without forcing it into MVP
