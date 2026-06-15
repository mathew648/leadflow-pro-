import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export default async function scheduleRoutes(fastify: FastifyInstance) {
  // GET /api/v1/schedule  — calendar view (date range)
  fastify.get(
    "/schedule",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        userId: z.string().uuid().optional(),
      }).parse(request.query);

      const from = new Date(query.from + "T00:00:00.000Z");
      const to = new Date(query.to + "T23:59:59.999Z");

      const where: any = {
        tenantId: request.tenantId,
        deletedAt: null,
        status: { notIn: ["cancelled"] },
        scheduledStart: { gte: from, lte: to },
      };

      if (query.userId) {
        where.OR = [
          { leadTechnicianId: query.userId },
          { assignedUserIds: { has: query.userId } },
        ];
      }

      const jobs = await prisma.job.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          property: { select: { id: true, streetAddress: true, suburb: true, state: true, latitude: true, longitude: true } },
          leadTechnician: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { scheduledStart: "asc" },
      });

      return { data: jobs };
    }
  );

  // PATCH /api/v1/schedule/jobs/:id/reschedule
  fastify.patch(
    "/schedule/jobs/:id/reschedule",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        scheduledStart: z.string().datetime(),
        scheduledEnd: z.string().datetime().optional(),
        leadTechnicianId: z.string().uuid().optional(),
        assignedUserIds: z.array(z.string().uuid()).optional(),
        reason: z.string().optional(),
      }).parse(request.body);

      const job = await prisma.job.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!job) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Job not found" } });
      }

      const updated = await prisma.job.update({
        where: { id },
        data: {
          scheduledStart: new Date(body.scheduledStart),
          scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : undefined,
          leadTechnicianId: body.leadTechnicianId,
          assignedUserIds: body.assignedUserIds,
          status: "scheduled",
        },
      });

      return { data: updated };
    }
  );

  // POST /api/v1/schedule/location-ping  — field app GPS ping
  fastify.post(
    "/schedule/location-ping",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().positive().optional(),
        jobId: z.string().uuid().optional(),
        batteryLevel: z.number().min(0).max(100).optional(),
      }).parse(request.body);

      const ping = await prisma.locationPing.create({
        data: {
          tenantId: request.tenantId,
          userId: request.userId,
          jobId: body.jobId,
          latitude: body.latitude,
          longitude: body.longitude,
          accuracy: body.accuracy,
          recordedAt: new Date(),
        },
      });

      return reply.status(201).send({ data: { id: ping.id } });
    }
  );

  // GET /api/v1/schedule/technician-locations  — live map view
  fastify.get(
    "/schedule/technician-locations",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request) => {
      // Latest ping per technician in the last 2 hours
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const locations = await prisma.$queryRaw<Array<{
        user_id: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
        latitude: number;
        longitude: number;
        recorded_at: Date;
        job_id: string | null;
      }>>`
        SELECT DISTINCT ON (lp.user_id)
          lp.user_id,
          u.first_name,
          u.last_name,
          u.avatar_url,
          lp.latitude,
          lp.longitude,
          lp.recorded_at,
          lp.job_id
        FROM location_pings lp
        JOIN users u ON u.id = lp.user_id
        WHERE lp.tenant_id = ${request.tenantId}
          AND lp.recorded_at > ${cutoff}
          AND u.deleted_at IS NULL
          AND u.status = 'active'
        ORDER BY lp.user_id, lp.recorded_at DESC
      `;

      return { data: locations };
    }
  );

  // GET /api/v1/schedule/unscheduled  — unscheduled jobs queue
  fastify.get(
    "/schedule/unscheduled",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const jobs = await prisma.job.findMany({
        where: {
          tenantId: request.tenantId,
          deletedAt: null,
          status: "pending",
          scheduledStart: null,
        },
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
          property: { select: { streetAddress: true, suburb: true, state: true } },
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        take: 50,
      });
      return { data: jobs };
    }
  );
}
