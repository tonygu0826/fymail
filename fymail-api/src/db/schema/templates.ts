import {
  pgTable,
  uuid,
  text,
  timestamp,
  smallint,
  boolean,
} from "drizzle-orm/pg-core";

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  variables: text("variables").array().default([]),
  // e.g. ['first_name', 'company', 'service_type']
  category: text("category"), // 'lcl' | 'warehouse' | 'general'
  targetMarket: text("target_market"), // 'de' | 'nl' | 'gb' | 'fr' | 'all'
  businessType: text("business_type"), // 'canada_import' | 'outbound' | 'follow_up'
  sequenceOrder: smallint("sequence_order").default(1),
  // 1=first email, 2=follow-up1, 3=follow-up2
  language: text("language").default("en"),
  isActive: boolean("is_active").default(true),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
