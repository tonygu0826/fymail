import {
  pgTable,
  uuid,
  text,
  boolean,
  smallint,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";

// ── Approvals ────────────────────────────────────────────────────────────────
export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "revision_requested",
]);

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  status: approvalStatusEnum("status").notNull().default("pending"),
  requestedBy: uuid("requested_by").notNull(),
  reviewerId: uuid("reviewer_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;

// ── Automation Rules ─────────────────────────────────────────────────────────
export const automationTriggerEnum = pgEnum("automation_trigger", [
  "contact_created",
  "contact_imported",
  "campaign_replied",
  "status_changed",
  "score_changed",
]);

export const automationRules = pgTable("automation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  priority: smallint("priority").default(0),
  triggerType: automationTriggerEnum("trigger_type").notNull(),
  // [{field: 'country', operator: 'equals', value: 'DE'}]
  conditions: jsonb("conditions").default([]),
  // [{type: 'add_tag', params: {tag: 'germany'}}]
  actions: jsonb("actions").default([]),
  runCount: integer("run_count").default(0),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;

// ── Search History ───────────────────────────────────────────────────────────
export const searchHistory = pgTable("search_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  queryParams: jsonb("query_params").notNull(),
  resultCount: integer("result_count").default(0),
  importedCount: integer("imported_count").default(0),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const searchResults = pgTable("search_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  searchId: uuid("search_id")
    .notNull()
    .references(() => searchHistory.id, { onDelete: "cascade" }),
  companyName: text("company_name"),
  website: text("website"),
  country: text("country"),
  serviceTypes: text("service_types").array(),
  description: text("description"),
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  sourceUrl: text("source_url"),
  dataSource: text("data_source"), // 'google' | 'bing' | 'manual'
  isImported: boolean("is_imported").default(false),
  importedContactId: uuid("imported_contact_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SearchResult = typeof searchResults.$inferSelect;
