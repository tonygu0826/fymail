# FyMail Database Schema

## MVP Intent

The MVP uses PostgreSQL through Prisma and keeps the initial model intentionally small:

- Single-tenant operational mode for FYWarehouse
- Core prospecting workflow only
- No production mail queue or external enrichment persisted yet
- Entities designed so queueing, analytics, and auth can be added without breaking the model

## Conventions

- Primary keys use `String` IDs with `cuid()`
- Timestamps use `createdAt` and `updatedAt`
- Operational enums are used where state transitions matter
- JSON fields are used sparingly for flexible metadata and variable maps
- Soft delete is deferred for MVP; records are hard deleted unless history matters

## Core Entities

### `users`

Single user for MVP, but modeled now to avoid repainting the schema later.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | string PK | `cuid()` |
| `email` | string unique | login/email identity |
| `name` | string | display name |
| `role` | enum `UserRole` | starts with `ADMIN` |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

### `email_templates`

Stores reusable outbound email templates.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | string PK | `cuid()` |
| `name` | string | internal template name |
| `slug` | string unique | route-safe identifier |
| `language` | enum `TemplateLanguage` | `EN`, `FR`, `DE`, `NL`, `OTHER` |
| `subject` | string | subject template |
| `bodyHtml` | text | rendered HTML source |
| `bodyText` | text nullable | plaintext alternative |
| `variables` | json | allowed merge variable descriptors |
| `status` | enum `TemplateStatus` | `DRAFT`, `ACTIVE`, `ARCHIVED` |
| `notes` | text nullable | internal notes |
| `ownerId` | string FK | references `users.id` |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

Indexes:

- unique: `slug`
- index: `ownerId`
- index: `status`

### `contacts`

Prospect/contact records for European freight forwarders.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | string PK | `cuid()` |
| `companyName` | string | freight forwarder company |
| `contactName` | string nullable | person name |
| `email` | string unique | dedupe key for MVP |
| `countryCode` | string | ISO-like short code |
| `marketRegion` | string nullable | optional grouping |
| `jobTitle` | string nullable | |
| `source` | string nullable | manual, import, scraped |
| `status` | enum `ContactStatus` | `NEW`, `READY`, `CONTACTED`, `REPLIED`, `BOUNCED`, `UNSUBSCRIBED` |
| `tags` | json | string array stored as JSON |
| `notes` | text nullable | sales notes |
| `lastContactedAt` | datetime nullable | |
| `ownerId` | string FK | references `users.id` |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

Indexes:

- unique: `email`
- index: `countryCode`
- index: `status`
- index: `ownerId`

### `campaigns`

Represents a prospecting send plan bound to one template.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | string PK | `cuid()` |
| `name` | string | internal campaign name |
| `description` | text nullable | |
| `status` | enum `CampaignStatus` | `DRAFT`, `SCHEDULED`, `RUNNING`, `PAUSED`, `COMPLETED`, `ARCHIVED` |
| `audienceFilter` | json nullable | saved targeting criteria |
| `scheduledAt` | datetime nullable | |
| `startedAt` | datetime nullable | |
| `completedAt` | datetime nullable | |
| `templateId` | string FK | references `email_templates.id` |
| `ownerId` | string FK | references `users.id` |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

Indexes:

- index: `status`
- index: `templateId`
- index: `ownerId`

### `campaign_contacts`

Join table for campaign targeting and per-contact delivery state.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | string PK | `cuid()` |
| `campaignId` | string FK | references `campaigns.id` |
| `contactId` | string FK | references `contacts.id` |
| `status` | enum `CampaignContactStatus` | `PENDING`, `QUEUED`, `SENT`, `FAILED`, `SKIPPED`, `REPLIED` |
| `personalization` | json nullable | per-contact merged data |
| `sentAt` | datetime nullable | |
| `openedAt` | datetime nullable | reserved for later tracking |
| `repliedAt` | datetime nullable | |
| `failureReason` | text nullable | |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

Constraints and indexes:

- unique: (`campaignId`, `contactId`)
- index: `status`
- index: `campaignId`
- index: `contactId`

### `email_logs`

Immutable operational log for each send attempt.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | string PK | `cuid()` |
| `campaignId` | string FK nullable | references `campaigns.id` |
| `contactId` | string FK nullable | references `contacts.id` |
| `templateId` | string FK nullable | references `email_templates.id` |
| `messageId` | string nullable | provider message id |
| `direction` | enum `EmailDirection` | `OUTBOUND` only for MVP but future-safe |
| `status` | enum `EmailLogStatus` | `PENDING`, `SENT`, `FAILED`, `BOUNCED` |
| `subject` | string | resolved subject |
| `recipientEmail` | string | recipient snapshot |
| `provider` | string nullable | e.g. Gmail SMTP |
| `errorMessage` | text nullable | |
| `metadata` | json nullable | diagnostics |
| `sentAt` | datetime nullable | |
| `createdAt` | datetime | |

Indexes:

- index: `campaignId`
- index: `contactId`
- index: `templateId`
- index: `status`

### `app_settings`

Stores non-secret product configuration. Secrets stay in environment variables.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | string PK | `cuid()` |
| `key` | string unique | setting identifier |
| `value` | json | setting payload |
| `description` | string nullable | |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

## Prisma Relationship Summary

- `User` has many `EmailTemplate`
- `User` has many `Contact`
- `User` has many `Campaign`
- `EmailTemplate` has many `Campaign`
- `Campaign` has many `CampaignContact`
- `Contact` has many `CampaignContact`
- `Campaign`, `Contact`, and `EmailTemplate` each relate to `EmailLog`

## Deferred for Post-MVP

These are intentionally not modeled yet:

- inbox sync and reply parsing
- unsubscribe event storage and suppression lists beyond contact status
- A/B test variants and experiment metrics
- Redis-backed job tables
- audit logs and multi-user permissions
- file import job history

## Migration Order

1. Create enums and base tables
2. Create relation tables and indexes
3. Seed one admin user and optional sample data
4. Add future migrations for analytics and queue operations
