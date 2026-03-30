import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";
import { contacts } from "./contacts";

export const outreachStatusEnum = pgEnum("outreach_status", [
  "queued",
  "sent",
  "opened",
  "replied",
  "bounced",
  "failed",
]);

export const outreachLogs = pgTable(
  "outreach_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    status: outreachStatusEnum("status").notNull().default("queued"),
    subjectRendered: text("subject_rendered"),
    bodyRendered: text("body_rendered"),
    trackingId: uuid("tracking_id").defaultRandom(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    bounceReason: text("bounce_reason"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("idx_outreach_campaign").on(table.campaignId),
    statusIdx: index("idx_outreach_status").on(table.status),
    trackingIdx: index("idx_outreach_tracking").on(table.trackingId),
  })
);

export type OutreachLog = typeof outreachLogs.$inferSelect;
export type NewOutreachLog = typeof outreachLogs.$inferInsert;
