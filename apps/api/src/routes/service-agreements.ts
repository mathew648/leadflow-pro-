import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { generateJobForAgreement } from "../lib/recurring.js";

const FREQ = z.enum(["weekly", "fortnightly", "monthly", "quarterly", "biannually", "annually"]);
const writeRoles = ["owner", "admin", "manager"] as const;

export default async function serviceAgreementRoutes(fastify: FastifyInstance) {
  // GET /api/v1/service-agreements — list this tenant's recurring/maintenance agreements
  fastify.get("/service-agreements", { preHandler: [fastify.authenticate] }, async (request) => {
    const items = await prisma.serviceAgreement.findMany({
      where: { tenantId: request.tenantId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        property: { select: { id: true, streetAddress: true, suburb: true } },
      },
      orderBy: [{ status: "asc" }, { nextRunAt: "asc" }],
    });
    return { data: items };
  });

  // POST /api/v1/service-agreements
  fastify.post("/service-agreements", { preHandler: [fastify.authenticate, fastify.requireRole([...writeRoles])] }, async (request, reply) => {
    const body = z.object({
      customerId: z.string().uuid(),
      propertyId: z.string().uuid().optional(),
      title: z.string().min(1).max(300),
      description: z.string().optional(),
      frequency: FREQ,
      intervalCount: z.number().int().min(1).max(52).default(1),
      nextRunAt: z.string().optional(),
      priceCents: z.number().int().min(0).default(0),
      autoInvoice: z.boolean().default(false),
      assignedUserId: z.string().uuid().optional(),
    }).parse(request.body);

    const customer = await prisma.customer.findFirst({ where: { id: body.customerId, tenantId: request.tenantId, deletedAt: null } });
    if (!customer) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });

    const sa = await prisma.serviceAgreement.create({
      data: {
        tenantId: request.tenantId,
        customerId: body.customerId,
        propertyId: body.propertyId,
        title: body.title,
        description: body.description,
        frequency: body.frequency,
        intervalCount: body.intervalCount,
        nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : new Date(),
        priceCents: body.priceCents,
        autoInvoice: body.autoInvoice,
        assignedUserId: body.assignedUserId,
        createdById: request.userId,
      },
    });
    return reply.status(201).send({ data: sa });
  });

  // PATCH /api/v1/service-agreements/:id — update / pause / resume / end
  fastify.patch("/service-agreements/:id", { preHandler: [fastify.authenticate, fastify.requireRole([...writeRoles])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      title: z.string().min(1).max(300).optional(),
      description: z.string().optional(),
      frequency: FREQ.optional(),
      intervalCount: z.number().int().min(1).max(52).optional(),
      nextRunAt: z.string().optional(),
      priceCents: z.number().int().min(0).optional(),
      autoInvoice: z.boolean().optional(),
      assignedUserId: z.string().uuid().nullable().optional(),
      status: z.enum(["active", "paused", "ended"]).optional(),
    }).parse(request.body);

    const existing = await prisma.serviceAgreement.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!existing) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });

    const sa = await prisma.serviceAgreement.update({
      where: { id },
      data: { ...body, nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : undefined },
    });
    return { data: sa };
  });

  // DELETE /api/v1/service-agreements/:id
  fastify.delete("/service-agreements/:id", { preHandler: [fastify.authenticate, fastify.requireRole([...writeRoles])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.serviceAgreement.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!existing) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    await prisma.serviceAgreement.delete({ where: { id } });
    return { data: { deleted: true } };
  });

  // POST /api/v1/service-agreements/:id/run-now — generate the next job immediately
  fastify.post("/service-agreements/:id/run-now", { preHandler: [fastify.authenticate, fastify.requireRole([...writeRoles])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.serviceAgreement.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!existing) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    const r = await generateJobForAgreement(id);
    if (!r) return reply.status(400).send({ error: { code: "INACTIVE", message: "Agreement is not active" } });
    return { data: r };
  });
}
