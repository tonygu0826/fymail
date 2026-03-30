import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../config/database";
import { contacts, companies } from "../db/schema";
import type {
  CreateContactInput,
  UpdateContactInput,
  ListContactsQuery,
  BulkUpdateInput,
} from "../contacts/contacts.schema";

export class ContactService {
  // ── List ──────────────────────────────────────────────────────────────────
  async list(query: ListContactsQuery) {
    const {
      page,
      limit,
      search,
      status,
      country,
      tags,
      scoreMin,
      scoreMax,
      sortBy,
      sortOrder,
    } = query;

    const offset = (page - 1) * limit;
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(contacts.email, `%${search}%`),
          ilike(contacts.firstName, `%${search}%`),
          ilike(contacts.lastName, `%${search}%`),
          ilike(contacts.jobTitle, `%${search}%`)
        )
      );
    }

    if (status) conditions.push(eq(contacts.status, status));
    if (country) conditions.push(ilike(contacts.country, `%${country}%`));
    if (scoreMin) conditions.push(sql`${contacts.score} >= ${scoreMin}`);
    if (scoreMax) conditions.push(sql`${contacts.score} <= ${scoreMax}`);

    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim());
      conditions.push(
        sql`${contacts.tags} && ARRAY[${sql.join(
          tagList.map((t) => sql`${t}`),
          sql`, `
        )}]::text[]`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const columnMap: Record<string, any> = {
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
      lastName: contacts.lastName,
      email: contacts.email,
      score: contacts.score,
      lastActivityAt: contacts.lastActivityAt,
    };

    const orderCol = columnMap[sortBy] ?? contacts.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          phone: contacts.phone,
          jobTitle: contacts.jobTitle,
          country: contacts.country,
          website: contacts.website,
          serviceTypes: contacts.serviceTypes,
          tags: contacts.tags,
          status: contacts.status,
          score: contacts.score,
          source: contacts.source,
          emailValid: contacts.emailValid,
          lastActivityAt: contacts.lastActivityAt,
          createdAt: contacts.createdAt,
          companyId: contacts.companyId,
          companyName: companies.name,
        })
        .from(contacts)
        .leftJoin(companies, eq(contacts.companyId, companies.id))
        .where(where)
        .orderBy(orderFn(orderCol))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(where),
    ]);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    };
  }

  // ── Get one ───────────────────────────────────────────────────────────────
  async getById(id: string) {
    const [row] = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        jobTitle: contacts.jobTitle,
        country: contacts.country,
        website: contacts.website,
        serviceTypes: contacts.serviceTypes,
        tags: contacts.tags,
        status: contacts.status,
        score: contacts.score,
        source: contacts.source,
        notes: contacts.notes,
        emailValid: contacts.emailValid,
        lastActivityAt: contacts.lastActivityAt,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
        companyId: contacts.companyId,
        companyName: companies.name,
        companyWebsite: companies.website,
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(eq(contacts.id, id))
      .limit(1);

    return row ?? null;
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async create(input: CreateContactInput, createdBy: string) {
    const [row] = await db
      .insert(contacts)
      .values({ ...input, createdBy })
      .returning();
    return row;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(id: string, input: UpdateContactInput) {
    const [row] = await db
      .update(contacts)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return row ?? null;
  }

  // ── Delete (soft: set status to do_not_contact + mark) ───────────────────
  async delete(id: string) {
    const [row] = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    return row ?? null;
  }

  // ── Bulk update ───────────────────────────────────────────────────────────
  async bulkUpdate(input: BulkUpdateInput) {
    const { ids, updates } = input;
    const rows = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(inArray(contacts.id, ids))
      .returning({ id: contacts.id });
    return rows;
  }

  // ── CSV Import ────────────────────────────────────────────────────────────
  async importBulk(
    rows: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      jobTitle?: string;
      country?: string;
      website?: string;
      serviceTypes?: string[];
      tags?: string[];
      notes?: string;
    }>,
    createdBy: string
  ) {
    if (rows.length === 0) return { inserted: 0, skipped: 0, errors: [] };

    // Get existing emails to detect duplicates
    const emailsToCheck = rows.map((r) => r.email.toLowerCase().trim());
    const existing = await db
      .select({ email: contacts.email })
      .from(contacts)
      .where(inArray(contacts.email, emailsToCheck));

    const existingSet = new Set(existing.map((e) => e.email.toLowerCase()));

    const toInsert = rows.filter(
      (r) => !existingSet.has(r.email.toLowerCase().trim())
    );
    const skipped = rows.length - toInsert.length;

    const errors: string[] = [];
    let inserted = 0;

    if (toInsert.length > 0) {
      try {
        await db.insert(contacts).values(
          toInsert.map((r) => ({
            email: r.email.toLowerCase().trim(),
            firstName: r.firstName,
            lastName: r.lastName,
            phone: r.phone,
            jobTitle: r.jobTitle,
            country: r.country,
            website: r.website || undefined,
            serviceTypes: r.serviceTypes ?? [],
            tags: r.tags ?? [],
            notes: r.notes,
            source: "csv_import",
            createdBy,
          }))
        );
        inserted = toInsert.length;
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    return { inserted, skipped, errors };
  }

  // ── Stats (for dashboard) ─────────────────────────────────────────────────
  async getStats() {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        cold: sql<number>`count(*) filter (where status = 'cold')`,
        warm: sql<number>`count(*) filter (where status = 'warm')`,
        active: sql<number>`count(*) filter (where status = 'active')`,
        newThisWeek: sql<number>`count(*) filter (where created_at > now() - interval '7 days')`,
      })
      .from(contacts);
    return row;
  }
}

export const contactService = new ContactService();
