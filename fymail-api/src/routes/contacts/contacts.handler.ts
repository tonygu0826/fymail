import { FastifyReply, FastifyRequest } from "fastify";
import { parse } from "csv-parse/sync";
import {
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
  bulkUpdateSchema,
  importContactSchema,
} from "./contacts.schema";
import { contactService } from "../../services/contact.service";

// ── List ──────────────────────────────────────────────────────────────────
export async function listContacts(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = listContactsQuerySchema.parse(request.query);
  const result = await contactService.list(query);
  return reply.send(result);
}

// ── Get one ───────────────────────────────────────────────────────────────
export async function getContact(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const contact = await contactService.getById(request.params.id);
  if (!contact) {
    return reply.status(404).send({
      data: null,
      error: { code: "NOT_FOUND", message: "Contact not found" },
    });
  }
  return reply.send({ data: contact, error: null });
}

// ── Create ────────────────────────────────────────────────────────────────
export async function createContact(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = createContactSchema.parse(request.body);
  const contact = await contactService.create(input, request.userId);
  return reply.status(201).send({ data: contact, error: null });
}

// ── Update ────────────────────────────────────────────────────────────────
export async function updateContact(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const input = updateContactSchema.parse(request.body);
  const contact = await contactService.update(request.params.id, input);
  if (!contact) {
    return reply.status(404).send({
      data: null,
      error: { code: "NOT_FOUND", message: "Contact not found" },
    });
  }
  return reply.send({ data: contact, error: null });
}

// ── Delete ────────────────────────────────────────────────────────────────
export async function deleteContact(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const result = await contactService.delete(request.params.id);
  if (!result) {
    return reply.status(404).send({
      data: null,
      error: { code: "NOT_FOUND", message: "Contact not found" },
    });
  }
  return reply.status(204).send();
}

// ── Bulk update ───────────────────────────────────────────────────────────
export async function bulkUpdateContacts(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = bulkUpdateSchema.parse(request.body);
  const rows = await contactService.bulkUpdate(input);
  return reply.send({
    data: { updated: rows.length, ids: rows.map((r) => r.id) },
    error: null,
  });
}

// ── CSV Import ────────────────────────────────────────────────────────────
export async function importContacts(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({
      data: null,
      error: { code: "BAD_REQUEST", message: "No file uploaded" },
    });
  }

  if (!data.filename.endsWith(".csv")) {
    return reply.status(400).send({
      data: null,
      error: { code: "BAD_REQUEST", message: "Only CSV files are supported" },
    });
  }

  const buffer = await data.toBuffer();
  const csvText = buffer.toString("utf-8");

  let records: any[];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    return reply.status(400).send({
      data: null,
      error: { code: "BAD_REQUEST", message: "Invalid CSV format" },
    });
  }

  // Validate and map rows
  const validRows: any[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const parsed = importContactSchema.safeParse(records[i]);
    if (parsed.success) {
      const d = parsed.data;
      validRows.push({
        ...d,
        serviceTypes: d.serviceTypes
          ? d.serviceTypes.split("|").map((s: string) => s.trim())
          : [],
        tags: d.tags
          ? d.tags.split("|").map((t: string) => t.trim())
          : [],
      });
    } else {
      parseErrors.push(`Row ${i + 2}: ${parsed.error.issues[0].message}`);
    }
  }

  const result = await contactService.importBulk(validRows, request.userId);

  return reply.send({
    data: {
      total: records.length,
      inserted: result.inserted,
      skipped: result.skipped,
      parseErrors,
      importErrors: result.errors,
    },
    error: null,
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────
export async function getContactStats(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const stats = await contactService.getStats();
  return reply.send({ data: stats, error: null });
}
