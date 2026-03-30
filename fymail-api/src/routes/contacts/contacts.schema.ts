import { z } from "zod";

export const contactStatusValues = [
  "cold",
  "warm",
  "active",
  "do_not_contact",
] as const;

export const createContactSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  jobTitle: z.string().max(100).optional(),
  companyId: z.string().uuid().optional(),
  country: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal("")),
  serviceTypes: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  status: z.enum(contactStatusValues).default("cold"),
  score: z.number().int().min(1).max(5).default(3),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const listContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(contactStatusValues).optional(),
  country: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  scoreMin: z.coerce.number().int().min(1).max(5).optional(),
  scoreMax: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "lastName", "email", "score", "lastActivityAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  updates: z.object({
    status: z.enum(contactStatusValues).optional(),
    tags: z.array(z.string()).optional(),
    score: z.number().int().min(1).max(5).optional(),
  }),
});

export const importContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
  serviceTypes: z.string().optional(), // pipe-separated in CSV
  tags: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
