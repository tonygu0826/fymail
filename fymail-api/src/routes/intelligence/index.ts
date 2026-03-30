import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { intelligenceService, searchSchema } from "../../services/intelligence.service";
import { z } from "zod";

async function handleSearch(request: FastifyRequest, reply: FastifyReply) {
  const input = searchSchema.parse(request.body);
  const result = await intelligenceService.search(input, request.userId);
  return reply.send({ data: result, error: null });
}

async function handleGetSearch(
  request: FastifyRequest<{ Params: { searchId: string } }>,
  reply: FastifyReply
) {
  const result = await intelligenceService.getSearch(request.params.searchId);
  return reply.send({ data: result, error: null });
}

async function handleImport(request: FastifyRequest, reply: FastifyReply) {
  const { resultIds } = z
    .object({ resultIds: z.array(z.string().uuid()).min(1) })
    .parse(request.body);
  const result = await intelligenceService.importResults(resultIds, request.userId);
  return reply.send({ data: result, error: null });
}

async function handleHistory(request: FastifyRequest, reply: FastifyReply) {
  const rows = await intelligenceService.getHistory(request.userId);
  return reply.send({ data: rows, error: null });
}

export async function intelligenceRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.post("/intelligence/search", { ...auth }, handleSearch);
  fastify.get("/intelligence/search/:searchId", { ...auth }, handleGetSearch);
  fastify.post("/intelligence/import", { ...auth }, handleImport);
  fastify.get("/intelligence/history", { ...auth }, handleHistory);
}
