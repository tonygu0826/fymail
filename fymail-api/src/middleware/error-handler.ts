import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: error.flatten().fieldErrors,
      },
    });
  }

  // Fastify validation errors
  if ("statusCode" in error && error.statusCode === 400) {
    return reply.status(400).send({
      data: null,
      error: { code: "BAD_REQUEST", message: error.message },
    });
  }

  // Auth errors
  if ("statusCode" in error && error.statusCode === 401) {
    return reply.status(401).send({
      data: null,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  // Not found
  if ("statusCode" in error && error.statusCode === 404) {
    return reply.status(404).send({
      data: null,
      error: { code: "NOT_FOUND", message: error.message },
    });
  }

  // Unique constraint violations (PostgreSQL error code 23505)
  if ("code" in error && (error as any).code === "23505") {
    return reply.status(409).send({
      data: null,
      error: { code: "CONFLICT", message: "Record already exists" },
    });
  }

  // Generic server error
  request.log.error(error);
  return reply.status(500).send({
    data: null,
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message,
    },
  });
}
