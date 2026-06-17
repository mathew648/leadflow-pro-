import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { enqueueAutomation, enqueueDelayed, QUEUES } from "../lib/queue.js";
import { auditFromRequest } from "../lib/audit.js";

const createJobSchema = z.object({
  customerId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
  customerNotes: z.string().optional(),
  tradeCategory: z.string().optional(),
  jobType: z.enum(["installation", "repair", "maintenance", "inspection", "emergency"]).optional(),
  priority: z.enum(["emergency", "high", "normal", "low"]).default("normal"),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  estimatedHours: z.number().positive().optional(),
  assignedUserIds: z.array(z.string().uuid()).default([]),
  leadTechnicianId: z.string().uuid().optional(),
});

export default async function jobsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/jobs
  fastify.get(
    "/jobs",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        status: z.string().optional(),
        priority: z.string().optional(),
        customerId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        search: z.string().optional(),
        limit: z.coerce.number().default(25),
        offset: z.coerce.number().default(0),
      }).parse(request.query);

      const where: any = {
        tenantId: request.tenantId,
        deletedAt: null,
        ...(query.status && { status: query.status }),
        ...(query.priority && { priority: query.priority }),
        ...(query.customerId && { customerId: query.customerId }),
        ...(query.dateFrom || query.dateTo
          ? { scheduledStart: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            }}
          : {}),
        ...(query.search && {
          OR: [
            { jobNumber: { contains: query.search, mode: "insensitive" } },
            { title: { contains: query.search, mode: "insensitive" } },
          ],
        }),
      };

      // Filter by assigned user (field app view)
      if (query.userId) {
        where.OR = [
          { leadTechnicianId: query.userId },
          { assignedUserIds: { has: query.userId } },
        ];
      }

      const [jobs, total] = await prisma.$transaction([
        prisma.job.findMany({
          where,
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, companyName: true, phone: true } },
            property: { select: { id: true, streetAddress: true, suburb: true, state: true, postcode: true } },
            leadTechnician: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: [{ priority: "asc" }, { scheduledStart: "asc" }],
          take: query.limit,
          skip: query.offset,
        }),
        prisma.job.count({ where }),
      ]);

      return { data: jobs, meta: { total, limit: query.limit, offset: query.offset } };
    }
  );

  // GET /api/v1/jobs/dispatch  — board view for a specific date
  fastify.get(
    "/jobs/dispatch",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).parse(request.query);

      const date = query.date ? new Date(query.date) : new Date();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const [technicians, scheduledJobs, unassignedJobs] = await prisma.$transaction([
        prisma.user.findMany({
          where: {
            tenantId: request.tenantId,
            deletedAt: null,
            status: "active",
            role: { in: ["technician", "admin", "owner", "manager"] },
          },
          select: {
            id: true, firstName: true, lastName: true, avatarUrl: true, phone: true,
            locationPings: {
              orderBy: { recordedAt: "desc" },
              take: 1,
              select: { latitude: true, longitude: true, recordedAt: true },
            },
          },
        }),
        prisma.job.findMany({
          where: {
            tenantId: request.tenantId,
            deletedAt: null,
            scheduledStart: { gte: startOfDay, lte: endOfDay },
            status: { notIn: ["cancelled"] },
          },
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true } },
            property: { select: { streetAddress: true, suburb: true, latitude: true, longitude: true } },
          },
          orderBy: { scheduledStart: "asc" },
        }),
        prisma.job.findMany({
          where: {
            tenantId: request.tenantId,
            deletedAt: null,
            status: "pending",
            scheduledStart: null,
          },
          include: {
            customer: { select: { firstName: true, lastName: true } },
            property: { select: { streetAddress: true, suburb: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 20,
        }),
      ]);

      // Group jobs by technician
      const technicianJobs = technicians.map((tech) => ({
        ...tech,
        name: `${tech.firstName} ${tech.lastName}`,
        currentLocation: tech.locationPings[0] ?? null,
        jobs: scheduledJobs.filter(
          (j) =>
            j.leadTechnicianId === tech.id ||
            j.assignedUserIds.includes(tech.id)
        ),
      }));

      return {
        data: {
          date: date.toISOString().split("T")[0],
          technicians: technicianJobs,
          unassigned: unassignedJobs,
        },
      };
    }
  );

  // POST /api/v1/jobs
  fastify.post(
    "/jobs",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const body = createJobSchema.parse(request.body);
      const { tenantId, userId } = request;

      const customer = await prisma.customer.findFirst({
        where: { id: body.customerId, tenantId, deletedAt: null },
      });
      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
      const jobNumber = `${settings?.jobPrefix ?? "JOB"}-${new Date().getFullYear()}-${String(
        (settings?.jobNextNumber ?? 1000) + Math.floor(Math.random() * 9000)
      ).padStart(4, "0")}`;

      const job = await prisma.$transaction(async (tx) => {
        const job = await tx.job.create({
          data: {
            tenantId,
            jobNumber,
            ...body,
            scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : undefined,
            scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : undefined,
            status: "pending",
            createdById: userId,
          },
        });

        await tx.tenantSettings.update({
          where: { tenantId },
          data: { jobNextNumber: { increment: 1 } },
        });

        // Add default checklists
        const checklist = await tx.jobChecklist.create({
          data: {
            tenantId,
            jobId: job.id,
            name: "Pre-Job Checklist",
            type: "pre_job",
            position: 0,
          },
        });

        await tx.jobChecklistItem.createMany({
          data: [
            { checklistId: checklist.id, tenantId, label: "Review job details and address", position: 0 },
            { checklistId: checklist.id, tenantId, label: "Check all required materials are loaded", position: 1 },
            { checklistId: checklist.id, tenantId, label: "Safety equipment checked", position: 2, isRequired: true },
          ],
        });

        const postChecklist = await tx.jobChecklist.create({
          data: {
            tenantId,
            jobId: job.id,
            name: "Post-Job Checklist",
            type: "post_job",
            position: 1,
          },
        });

        await tx.jobChecklistItem.createMany({
          data: [
            { checklistId: postChecklist.id, tenantId, label: "Work area cleaned up", position: 0 },
            { checklistId: postChecklist.id, tenantId, label: "Customer briefed on work completed", position: 1 },
            { checklistId: postChecklist.id, tenantId, label: "After photos taken", position: 2, isRequired: true },
          ],
        });

        return job;
      });

      await enqueueAutomation({
        tenantId,
        triggerType: "job_created",
        entityType: "job",
        entityId: job.id,
      });

      auditFromRequest(request, "create", "job", job.id).catch(() => {});

      return reply.status(201).send({ data: job });
    }
  );

  // GET /api/v1/jobs/:id
  fastify.get(
    "/jobs/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const job = await prisma.job.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          customer: true,
          property: true,
          leadTechnician: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
          checklists: {
            include: { items: { orderBy: { position: "asc" } } },
            orderBy: { position: "asc" },
          },
          tasks: { orderBy: { position: "asc" } },
          timeEntries: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { startedAt: "desc" },
          },
          materials: { orderBy: { createdAt: "asc" } },
          photos: { orderBy: { takenAt: "asc" } },
          quote: { select: { id: true, quoteNumber: true, totalCents: true } },
        },
      });

      if (!job) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Job not found" } });
      }

      return { data: job };
    }
  );

  // PATCH /api/v1/jobs/:id
  fastify.patch(
    "/jobs/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        internalNotes: z.string().optional(),
        customerNotes: z.string().optional(),
        priority: z.enum(["emergency", "high", "normal", "low"]).optional(),
        status: z.enum(["pending", "scheduled", "dispatched", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
        scheduledStart: z.string().datetime().optional(),
        scheduledEnd: z.string().datetime().optional(),
        estimatedHours: z.number().positive().optional(),
        assignedUserIds: z.array(z.string().uuid()).optional(),
        leadTechnicianId: z.string().uuid().optional(),
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
          ...body,
          scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : undefined,
          scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : undefined,
        },
      });

      auditFromRequest(request, "update", "job", id).catch(() => {});

      return { data: updated };
    }
  );

  // POST /api/v1/jobs/:id/start
  fastify.post(
    "/jobs/:id/start",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }).parse(request.body ?? {});

      const job = await prisma.job.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!job) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Job not found" } });
      }

      const [updatedJob, timeEntry] = await prisma.$transaction([
        prisma.job.update({
          where: { id },
          data: { status: "in_progress", actualStart: new Date() },
        }),
        prisma.timeEntry.create({
          data: {
            tenantId: request.tenantId,
            jobId: id,
            userId: request.userId,
            type: "standard",
            startedAt: new Date(),
            startLatitude: body.latitude ?? undefined,
            startLongitude: body.longitude ?? undefined,
            billable: true,
          },
        }),
      ]);

      await enqueueAutomation({
        tenantId: request.tenantId,
        triggerType: "job_started",
        entityType: "job",
        entityId: id,
      });

      return { data: { job: updatedJob, timeEntryId: timeEntry.id } };
    }
  );

  // POST /api/v1/jobs/:id/complete
  fastify.post(
    "/jobs/:id/complete",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        completionNotes: z.string().optional(),
        customerSignoffName: z.string().optional(),
        customerSignoffSignature: z.string().optional(), // base64
        customerSatisfaction: z.number().int().min(1).max(5).optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }).parse(request.body ?? {});

      const job = await prisma.job.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: { customer: true },
      });
      if (!job) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Job not found" } });
      }

      // Close any open time entries
      const openEntry = await prisma.timeEntry.findFirst({
        where: { jobId: id, userId: request.userId, endedAt: null },
      });

      const now = new Date();

      await prisma.$transaction(async (tx) => {
        if (openEntry) {
          const durationMinutes = Math.round(
            (now.getTime() - openEntry.startedAt.getTime()) / 60000
          );
          await tx.timeEntry.update({
            where: { id: openEntry.id },
            data: {
              endedAt: now,
              durationMinutes,
              endLatitude: body.latitude ?? undefined,
              endLongitude: body.longitude ?? undefined,
            },
          });
        }

        await tx.job.update({
          where: { id },
          data: {
            status: "completed",
            actualEnd: now,
            completedAt: now,
            completedById: request.userId,
            completionNotes: body.completionNotes,
            customerSignoffAt: body.customerSignoffName ? now : undefined,
            customerSignoffName: body.customerSignoffName,
            customerSatisfaction: body.customerSatisfaction,
          },
        });
      });

      // Trigger post-completion automations
      await enqueueAutomation({
        tenantId: request.tenantId,
        triggerType: "job_completed",
        entityType: "job",
        entityId: id,
        entityData: { customerId: job.customerId, customerPhone: job.customer.phone },
      });

      // Schedule a Google review request after completion (default 2 hours).
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: request.tenantId },
      });
      const hasReviewLink = Boolean(settings?.googleReviewUrl || settings?.googlePlaceId);
      const canContact = Boolean(job.customer.email || job.customer.phone);
      if (settings?.autoSendReviewRequest && hasReviewLink && canContact) {
        const delayMs = (settings.reviewRequestDelayHours ?? 2) * 60 * 60 * 1000;
        await enqueueDelayed(QUEUES.NOTIFICATIONS, "review-request", {
          tenantId: request.tenantId,
          customerId: job.customerId,
          jobId: id,
        }, delayMs);
      }

      return {
        data: {
          jobId: id,
          status: "completed",
          completedAt: now.toISOString(),
        },
      };
    }
  );

  // POST /api/v1/jobs/:id/materials
  fastify.post(
    "/jobs/:id/materials",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        catalogItemId: z.string().uuid().optional(),
        name: z.string().min(1).max(200),
        code: z.string().optional(),
        unit: z.string().optional(),
        quantity: z.number().positive(),
        unitPriceCents: z.number().int().min(0),
        unitCostCents: z.number().int().min(0).default(0),
        notes: z.string().optional(),
        billable: z.boolean().default(true),
      }).parse(request.body);

      const totalPriceCents = Math.round(body.quantity * body.unitPriceCents);
      const totalCostCents = Math.round(body.quantity * body.unitCostCents);

      const material = await prisma.jobMaterial.create({
        data: {
          tenantId: request.tenantId,
          jobId: id,
          ...body,
          totalPriceCents,
          totalCostCents,
          addedFrom: "field",
          addedById: request.userId,
        },
      });

      // Update job actual materials total
      const allMaterials = await prisma.jobMaterial.aggregate({
        where: { jobId: id, billable: true },
        _sum: { totalPriceCents: true },
      });

      await prisma.job.update({
        where: { id },
        data: { actualMaterialsCents: allMaterials._sum.totalPriceCents ?? 0 },
      });

      return reply.status(201).send({ data: material });
    }
  );

  // POST /api/v1/jobs/:id/time-entries
  fastify.post(
    "/jobs/:id/time-entries",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        type: z.enum(["standard", "overtime", "travel", "break"]).default("standard"),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime().optional(),
        notes: z.string().optional(),
        billable: z.boolean().default(true),
      }).parse(request.body);

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      const durationMinutes = body.endedAt
        ? Math.round((new Date(body.endedAt).getTime() - new Date(body.startedAt).getTime()) / 60000)
        : null;

      const totalCents = durationMinutes && user?.hourlyRateCents
        ? Math.round((durationMinutes / 60) * user.hourlyRateCents)
        : null;

      const entry = await prisma.timeEntry.create({
        data: {
          tenantId: request.tenantId,
          jobId: id,
          userId: request.userId,
          type: body.type,
          startedAt: new Date(body.startedAt),
          endedAt: body.endedAt ? new Date(body.endedAt) : undefined,
          durationMinutes: durationMinutes ?? undefined,
          billable: body.billable,
          hourlyRateCents: user?.hourlyRateCents ?? undefined,
          totalCents: totalCents ?? undefined,
          notes: body.notes,
        },
      });

      return reply.status(201).send({ data: entry });
    }
  );

  // PATCH /api/v1/jobs/:id/checklists/:checklistId/items/:itemId
  fastify.patch(
    "/jobs/:id/checklists/:checklistId/items/:itemId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { itemId } = request.params as { id: string; checklistId: string; itemId: string };
      const body = z.object({
        checked: z.boolean(),
        notes: z.string().optional(),
        photoUrl: z.string().url().optional(),
      }).parse(request.body);

      const item = await prisma.jobChecklistItem.update({
        where: { id: itemId },
        data: {
          checked: body.checked,
          checkedAt: body.checked ? new Date() : null,
          checkedById: body.checked ? request.userId : null,
          notes: body.notes,
          photoUrl: body.photoUrl,
        },
      });

      return { data: item };
    }
  );

  // POST /api/v1/jobs/:id/invoice
  fastify.post(
    "/jobs/:id/invoice",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const job = await prisma.job.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null, status: "completed" },
        include: {
          materials: { where: { billable: true } },
          timeEntries: { where: { billable: true, endedAt: { not: null } } },
          customer: true,
          quote: { include: { lineItems: { orderBy: { position: "asc" } } } },
        },
      });

      if (!job) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Completed job not found" },
        });
      }

      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: request.tenantId },
      });

      const invoiceNumber = `${settings?.invoicePrefix ?? "INV"}-${new Date().getFullYear()}-${String(
        (settings?.invoiceNextNumber ?? 1000) + Math.floor(Math.random() * 9000)
      ).padStart(4, "0")}`;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (settings?.invoicePaymentTerms ?? 14));

      // Build line items from quote or actual job data
      const lineItems = job.quote?.lineItems.map((li, idx) => ({
        position: idx,
        description: String(li.description),
        quantity: Number(li.quantity),
        unitPriceCents: li.unitPriceCents,
        gstRate: Number(li.gstRate),
        subtotalCents: li.subtotalCents,
        gstCents: li.gstCents,
        totalCents: li.totalCents,
        discountPercent: Number(li.discountPercent),
        discountCents: li.discountCents,
        catalogItemId: li.catalogItemId ?? undefined,
      })) ?? [];

      const totalCents = lineItems.reduce((sum, li) => sum + li.totalCents, 0);
      const subtotalCents = lineItems.reduce((sum, li) => sum + li.subtotalCents - li.discountCents, 0);
      const gstCents = lineItems.reduce((sum, li) => sum + li.gstCents, 0);

      const { invoice } = await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            tenantId: request.tenantId,
            invoiceNumber,
            jobId: id,
            quoteId: job.quoteId ?? undefined,
            customerId: job.customerId,
            propertyId: job.propertyId ?? undefined,
            invoiceType: "final",
            subtotalCents,
            gstCents,
            totalCents,
            amountDueCents: totalCents,
            currency: "AUD",
            issueDate: new Date(),
            dueDate,
            status: "draft",
            createdById: request.userId,
          },
        });

        if (lineItems.length > 0) {
          await tx.invoiceLineItem.createMany({
            data: lineItems.map((li) => ({
              tenantId: request.tenantId,
              invoiceId: invoice.id,
              ...li,
              unit: undefined,
            })),
          });
        }

        await tx.tenantSettings.update({
          where: { tenantId: request.tenantId },
          data: { invoiceNextNumber: { increment: 1 } },
        });

        await tx.job.update({ where: { id }, data: { invoiceId: invoice.id, status: "invoiced" } });

        return { invoice };
      });

      return reply.status(201).send({ data: invoice });
    }
  );
}
