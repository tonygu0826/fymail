# FyMail API Spec

## API Goals

The MVP API supports a locally testable standalone app with server-side rendering and a small set of JSON endpoints. The first pass favors predictable contracts over full CRUD depth.

Base path: `/api`

Response envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Optional human-readable message"
}
```

Error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error",
    "details": {}
  }
}
```

## MVP Behavior Notes

- Authentication is not implemented in MVP; endpoints are treated as trusted single-tenant internal operations.
- Mail sending is not implemented in MVP and must not be represented as complete.
- Endpoints may return empty lists if the database is not seeded.
- Validation is done with Zod where request bodies exist.

## Health

### `GET /api/health`

Purpose:

- confirm app is running
- expose current environment and database connectivity summary

Response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "app": "FyMail",
    "time": "2026-03-24T00:00:00.000Z",
    "environment": "development",
    "database": {
      "configured": true,
      "reachable": true
    }
  }
}
```

## Dashboard

### `GET /api/dashboard/summary`

Returns a compact metrics payload for the dashboard cards and recent activity list.

Response fields:

- `counts.templates`
- `counts.contacts`
- `counts.campaigns`
- `counts.readyContacts`
- `campaignBreakdown`
- `recentContacts`
- `recentCampaigns`

## Templates

### `GET /api/templates`

Returns template list ordered by `updatedAt DESC`.

Query params:

- `status` optional
- `language` optional

### `POST /api/templates`

Creates a new template.

Request body:

```json
{
  "name": "UK introduction",
  "slug": "uk-introduction",
  "language": "EN",
  "subject": "LCL from China to Canada for UK forwarders",
  "bodyHtml": "<p>Hello {{companyName}}</p>",
  "bodyText": "Hello {{companyName}}",
  "variables": ["companyName", "contactName", "countryCode"],
  "status": "DRAFT",
  "notes": "First outreach version"
}
```

### `GET /api/templates/:id`

Returns one template record.

### `PUT /api/templates/:id`

Updates mutable template fields.

### `DELETE /api/templates/:id`

Deletes a template only when not referenced by active campaigns. MVP may return `409` if linked.

## Contacts

### `GET /api/contacts`

Returns contacts ordered by `createdAt DESC`.

Query params:

- `countryCode` optional
- `status` optional
- `q` optional free text against company, contact, or email

### `POST /api/contacts`

Creates a single contact.

Request body:

```json
{
  "companyName": "Forwarder GmbH",
  "contactName": "Anna Meyer",
  "email": "anna@example.com",
  "countryCode": "DE",
  "jobTitle": "Sales Manager",
  "source": "manual",
  "status": "READY",
  "tags": ["germany", "lcl"]
}
```

### `GET /api/contacts/:id`

Returns one contact.

### `PUT /api/contacts/:id`

Updates a contact.

### `DELETE /api/contacts/:id`

Deletes a contact.

### `POST /api/contacts/import`

Deferred in MVP UI. Reserved contract for CSV import job creation.

Request body:

```json
{
  "rows": []
}
```

Response:

- `501 Not Implemented` during MVP, or `202` once background import exists

## Campaigns

### `GET /api/campaigns`

Returns campaigns with template summary and aggregate targeting counts.

### `POST /api/campaigns`

Creates a campaign.

Request body:

```json
{
  "name": "DE forwarders week 1",
  "description": "Initial Germany outbound batch",
  "templateId": "tmpl_123",
  "status": "DRAFT",
  "audienceFilter": {
    "countryCode": "DE",
    "contactStatus": ["READY"]
  },
  "scheduledAt": null
}
```

### `GET /api/campaigns/:id`

Returns campaign details with targeted contacts if available.

### `PUT /api/campaigns/:id`

Updates campaign metadata or schedule.

### `POST /api/campaigns/:id/send`

Reserved for post-MVP send kickoff.

Response:

- `501 Not Implemented` until queue and SMTP pipeline exist

## Settings

### `GET /api/settings`

Returns non-secret app settings and environment readiness flags.

Response fields:

- `appSettings`
- `mailConfig`
- `featureFlags`

### `PUT /api/settings`

Reserved for persisting safe settings. Secrets remain env-only.

## Status Codes

- `200` successful read/update
- `201` resource created
- `400` validation error
- `404` resource not found
- `409` conflict due to relational constraints or uniqueness
- `500` internal server error
- `501` endpoint intentionally not implemented yet

## Deferred Endpoints

Not part of the first testable stage:

- `/api/mail/send-test`
- `/api/mail/send-bulk`
- `/api/analytics/*`
- `/api/auth/*`
- webhook endpoints for open, click, bounce, or reply tracking
