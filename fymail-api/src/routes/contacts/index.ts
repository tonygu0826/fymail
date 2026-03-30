import { FastifyInstance } from "fastify";
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  bulkUpdateContacts,
  importContacts,
  getContactStats,
} from "./contacts.handler";

export async function contactRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get("/contacts", { ...auth }, listContacts);
  fastify.get("/contacts/stats", { ...auth }, getContactStats);
  fastify.get("/contacts/:id", { ...auth }, getContact);
  fastify.post("/contacts", { ...auth }, createContact);
  fastify.put("/contacts/:id", { ...auth }, updateContact);
  fastify.delete("/contacts/:id", { ...auth }, deleteContact);
  fastify.post("/contacts/bulk-update", { ...auth }, bulkUpdateContacts);
  fastify.post("/contacts/import", { ...auth }, importContacts);
}
