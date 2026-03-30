import {
  pgTable,
  uuid,
  text,
  timestamp,
  smallint,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const contactStatusEnum = pgEnum("contact_status", [
  "cold",
  "warm",
  "active",
  "do_not_contact",
]);

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  jobTitle: text("job_title"),
  country: text("country"),
  website: text("website"),
  serviceTypes: text("service_types").array().default([]),
  tags: text("tags").array().default([]),
  status: contactStatusEnum("status").notNull().default("cold"),
  score: smallint("score").default(3),
  source: text("source"), // 'intelligence' | 'manual' | 'csv_import'
  notes: text("notes"),
  emailValid: boolean("email_valid"), // null=unchecked, true=valid, false=invalid
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  createdBy: uuid("created_by"), // references auth.users
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
