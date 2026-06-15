import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export default async function auditLogsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/audit-logs
  fastify.get(
    "/audit-logs",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const query = z.object({
        actorId: z.string().uuid().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().uuid().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(request.query);

      const where: any = {
        tenantId: request.tenantId,
        ...(query.actorId && { actorId: query.actorId }),
        ...(query.action && { action: query.action }),
        ...(query.entityType && { entityType: query.entityType }),
        ...(query.entityId && { entityId: query.entityId }),
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
                ...(query.dateTo && { lte: new Date(query.dateTo) }),
              },
            }
          : {}),
      };

      const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: query.limit,
          skip: query.offset,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return { data: logs, meta: { total, limit: query.limit, offset: query.offset } };
    }
  );

  // GET /api/v1/audit-logs/:entityType/:entityId  — history for a specific entity
  fastify.get(
    "/audit-logs/:entityType/:entityId",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request) => {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const query = z.object({
        limit: z.coerce.number().int().min(1).max(100).default(25),
      }).parse(request.query);

      const logs = await prisma.auditLog.findMany({
        where: { tenantId: request.tenantId, entityType, entityId },
        orderBy: { createdAt: "desc" },
        take: query.limit,
      });

      return { data: logs };
    }
  );
}
