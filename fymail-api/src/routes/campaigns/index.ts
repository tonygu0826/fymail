import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  campaignService,
  createCampaignSchema,
  updateCampaignSchema,
} from "../../services/campaign.service";

async function listCampaigns(request: FastifyRequest, reply: FastifyReply) {
  const { status, page, limit } = request.query as any;
  const rows = await campaignService.list({ status, page: Number(page) || 1, limit: Number(limit) || 25 });
  return reply.send({ data: rows, error: null });
}

async function getCampaign(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const c = await campaignService.getById(request.params.id);
  if (!c) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Campaign not found" } });
  return reply.send({ data: c, error: null });
}

async function createCampaign(request: FastifyRequest, reply: FastifyReply) {
  const input = createCampaignSchema.parse(request.body);
  const c = await campaignService.create(input, request.userId);
  return reply.status(201).send({ data: c, error: null });
}

async function updateCampaign(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const input = updateCampaignSchema.parse(request.body);
  const c = await campaignService.update(request.params.id, input);
  if (!c) return reply.status(404).send({ data: null, error: { code: "NOT_FOUND", message: "Campaign not found" } });
  return reply.send({ data: c, error: null });
}

async function submitCampaign(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const c = await campaignService.submit(request.params.id, request.userId);
  return reply.send({ data: c, error: null });
}

async function startCampaign(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const c = await campaignService.start(request.params.id);
  return reply.send({ data: c, error: null });
}

async function pauseCampaign(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const c = await campaignService.pause(request.params.id);
  return reply.send({ data: c, error: null });
}

async function resumeCampaign(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const c = await campaignService.resume(request.params.id);
  return reply.send({ data: c, error: null });
}

async function getCampaignLogs(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { page, limit, status } = request.query as any;
  const logs = await campaignService.getLogs(request.params.id, {
    page: Number(page) || 1,
    limit: Number(limit) || 50,
    status,
  });
  return reply.send({ data: logs, error: null });
}

export async function campaignRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get("/campaigns", { ...auth }, listCampaigns);
  fastify.get("/campaigns/:id", { ...auth }, getCampaign);
  fastify.post("/campaigns", { ...auth }, createCampaign);
  fastify.put("/campaigns/:id", { ...auth }, updateCampaign);
  fastify.post("/campaigns/:id/submit", { ...auth }, submitCampaign);
  fastify.post("/campaigns/:id/start", { ...auth }, startCampaign);
  fastify.post("/campaigns/:id/pause", { ...auth }, pauseCampaign);
  fastify.post("/campaigns/:id/resume", { ...auth }, resumeCampaign);
  fastify.get("/campaigns/:id/logs", { ...auth }, getCampaignLogs);
}
