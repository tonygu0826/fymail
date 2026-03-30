import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
    userRole: string;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = await request.jwtVerify<{
          sub: string;
          email: string;
          role: string;
        }>();
        request.userId = payload.sub;
        request.userEmail = payload.email;
        request.userRole = payload.role ?? "member";
      } catch {
        return reply.status(401).send({
          data: null,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
        });
      }
    }
  );

  fastify.decorate(
    "requireAdmin",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.userRole !== "admin") {
        return reply.status(403).send({
          data: null,
          error: { code: "FORBIDDEN", message: "Admin privileges required" },
        });
      }
    }
  );
}

export default fp(authPlugin);
