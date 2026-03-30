import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { templateService, createTemplateSchema, updateTemplateSchema } from "../../services/template.service";

async function listTemplates(request: FastifyRequest, reply: FastifyReply) {
  const { category, targetMarket } = request.query as any;
  const rows = await templateService.list({ category, targetMarket });
  return reply.send({ data: rows, error: null });
}

async function getTemplate(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const t = await templateService.getById(request.params.id);
  if (!t) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Template not found" } });
  return reply.send({ data: t, error: null });
}

async function createTemplate(request: FastifyRequest, reply: FastifyReply) {
  const input = createTemplateSchema.parse(request.body);
  const t = await templateService.create(input, request.userId);
  return reply.status(201).send({ data: t, error: null });
}

async function updateTemplate(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const input = updateTemplateSchema.parse(request.body);
  const t = await templateService.update(request.params.id, input);
  if (!t) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Template not found" } });
  return reply.send({ data: t, error: null });
}

async function deleteTemplate(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const result = await templateService.delete(request.params.id);
  if (!result) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Template not found" } });
  return reply.status(204).send();
}

async function previewTemplate(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { contactData } = request.body as { contactData?: Record<string, string> };
  const result = await templateService.preview(request.params.id, contactData ?? {});
  if (!result) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Template not found" } });
  return reply.send({ data: result, error: null });
}

export async function templateRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get("/templates", { ...auth }, listTemplates);
  fastify.get("/templates/:id", { ...auth }, getTemplate);
  fastify.post("/templates", { ...auth }, createTemplate);
  fastify.put("/templates/:id", { ...auth }, updateTemplate);
  fastify.delete("/templates/:id", { ...auth }, deleteTemplate);
  fastify.post("/templates/:id/preview", { ...auth }, previewTemplate);
}
