import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { templates } from "./templates";
import { senderAccounts } from "./sender-accounts";

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "pending_approval",
  "approved",
  "running",
  "paused",
  "completed",
  "rejected",
]);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  templateId: uuid("template_id")
    .notNull()
    .references(() => templates.id),
  senderAccountId: uuid("sender_account_id")
    .notNull()
    .references(() => senderAccounts.id),
  contactIds: uuid("contact_ids").array().default([]),
  dailyLimit: integer("daily_limit").default(50),
  sendIntervalMin: integer("send_interval_min").default(90), // seconds
  sendIntervalMax: integer("send_interval_max").default(180),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // aggregated stats snapshot
  statTotal: integer("stat_total").default(0),
  statSent: integer("stat_sent").default(0),
  statOpened: integer("stat_opened").default(0),
  statReplied: integer("stat_replied").default(0),
  statBounced: integer("stat_bounced").default(0),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
