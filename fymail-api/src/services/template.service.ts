import { eq, ilike, and, desc } from "drizzle-orm";
import { db } from "../config/database";
import { templates } from "../db/schema";
import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  variables: z.array(z.string()).default([]),
  category: z.string().optional(),
  targetMarket: z.string().optional(),
  businessType: z.string().optional(),
  sequenceOrder: z.number().int().min(1).max(10).default(1),
  language: z.string().default("en"),
  isActive: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export class TemplateService {
  async list(filters: { category?: string; targetMarket?: string }) {
    const conditions = [];
    if (filters.category) conditions.push(eq(templates.category, filters.category));
    if (filters.targetMarket) conditions.push(eq(templates.targetMarket, filters.targetMarket));

    return db
      .select()
      .from(templates)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(templates.updatedAt));
  }

  async getById(id: string) {
    const [row] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
    return row ?? null;
  }

  async create(input: z.infer<typeof createTemplateSchema>, createdBy: string) {
    const [row] = await db.insert(templates).values({ ...input, createdBy }).returning();
    return row;
  }

  async update(id: string, input: z.infer<typeof updateTemplateSchema>) {
    const [row] = await db
      .update(templates)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string) {
    const [row] = await db.delete(templates).where(eq(templates.id, id)).returning({ id: templates.id });
    return row ?? null;
  }

  async preview(id: string, contactData: Record<string, string>) {
    const template = await this.getById(id);
    if (!template) return null;

    const render = (str: string) =>
      str.replace(/\{\{(\w+)\}\}/g, (_, key) => contactData[key] ?? `{{${key}}}`);

    return {
      subject: render(template.subject),
      body: render(template.bodyHtml),
    };
  }
}

export const templateService = new TemplateService();
