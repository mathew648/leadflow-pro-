import { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { normalisePhone, generateNumber, encodeCursor, decodeCursor, calculateLineItem, calculateTotals, generatePortalToken } from "../lib/utils.js";
import { enqueueAutomation, enqueueAIScoring } from "../lib/queue.js";
import { auditFromRequest } from "../lib/audit.js";
import { config } from "../config.js";
import { notifyBusiness } from "../lib/notify.js";

const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyName: z.string().max(200).optional(),
  source: z.enum([
    "meta_ads", "google_ads", "tiktok_ads", "linkedin_ads", "website",
    "landing_page", "whatsapp", "messenger", "email", "sms",
    "manual", "phone", "referral", "walk_in",
  ]),
  sourceDetail: z.string().optional(),
  sourceCampaignId: z.string().optional(),
  sourceAdId: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  serviceRequired: z.string().optional(),
  serviceCategory: z.string().optional(),
  propertyAddress: z.string().optional(),
  suburb: z.string().optional(),
  postcode: z.string().optional(),
  propertyType: z.enum(["residential", "commercial", "industrial", "strata"]).optional(),
  urgency: z.enum(["emergency", "urgent", "normal", "flexible"]).default("normal"),
  estimatedValueCents: z.number().int().min(0).optional(),
  preferredStartDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  stageId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  rawPayload: z.record(z.unknown()).default({}),
});

const updateLeadSchema = createLeadSchema.partial().omit({ source: true, rawPayload: true });

const listLeadsSchema = z.object({
  stageId: z.string().uuid().optional(),
  status: z.enum(["active", "converted", "lost", "duplicate", "spam"]).optional(),
  source: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  urgency: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sort: z.enum(["created_at", "updated_at", "ai_score", "estimated_value"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export default async function leadsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/leads
  fastify.get(
    "/leads",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = listLeadsSchema.parse(request.query);
      const { tenantId } = request;

      const where: any = {
        tenantId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : { status: "active" }),
        ...(query.stageId && { stageId: query.stageId }),
        ...(query.source && { source: query.source as any }),
        ...(query.assignedToId && { assignedToId: query.assignedToId }),
        ...(query.urgency && { urgency: query.urgency as any }),
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
                ...(query.dateTo && { lte: new Date(query.dateTo) }),
              },
            }
          : {}),
        ...(query.search && {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search } },
            { serviceRequired: { contains: query.search, mode: "insensitive" } },
            { companyName: { contains: query.search, mode: "insensitive" } },
          ],
        }),
      };

      const cursorData = query.cursor ? decodeCursor(query.cursor) : null;
      if (cursorData?.id) {
        where.id = { lt: cursorData.id };
      }

      const sortField: Record<string, any> = {
        created_at: { createdAt: query.order },
        updated_at: { updatedAt: query.order },
        ai_score: { aiScore: query.order },
        estimated_value: { estimatedValueCents: query.order },
      };

      const [leads, total] = await prisma.$transaction([
        prisma.lead.findMany({
          where,
          include: {
            stage: { select: { id: true, name: true, color: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: sortField[query.sort] ?? { createdAt: "desc" },
          take: query.limit + 1,
        }),
        prisma.lead.count({ where }),
      ]);

      const hasMore = leads.length > query.limit;
      const items = hasMore ? leads.slice(0, -1) : leads;
      const nextCursor = hasMore ? encodeCursor({ id: items[items.length - 1].id }) : null;

      return {
        data: items.map((l) => ({
          ...l,
          assignedTo: l.assignedTo
            ? {
                ...l.assignedTo,
                name: `${l.assignedTo.firstName} ${l.assignedTo.lastName}`,
              }
            : null,
        })),
        meta: { total, limit: query.limit, cursor: nextCursor, hasMore },
      };
    }
  );

  // GET /api/v1/leads/pipeline  — pipeline summary (stage counts + values)
  fastify.get(
    "/leads/pipeline",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const stages = await prisma.pipelineStage.findMany({
        where: { tenantId: request.tenantId },
        orderBy: { position: "asc" },
      });

      const summary = await prisma.lead.groupBy({
        by: ["stageId"],
        where: { tenantId: request.tenantId, deletedAt: null, status: "active" },
        _count: { id: true },
        _sum: { estimatedValueCents: true },
      });

      const summaryMap = Object.fromEntries(
        summary.map((s) => [s.stageId ?? "null", s])
      );

      return {
        data: stages.map((stage) => ({
          ...stage,
          leadCount: summaryMap[stage.id]?._count.id ?? 0,
          totalValueCents: summaryMap[stage.id]?._sum.estimatedValueCents ?? 0,
        })),
      };
    }
  );

  // POST /api/v1/leads
  fastify.post(
    "/leads",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager", "sales"])] },
    async (request, reply) => {
      const body = createLeadSchema.parse(request.body);
      const { tenantId, userId } = request;

      // Normalise phone
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { country: true, settings: true },
      });
      const normalisedPhone = body.phone
        ? normalisePhone(body.phone, tenant.country)
        : null;

      // Duplicate check
      if (normalisedPhone || body.email) {
        const duplicate = await prisma.lead.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ["active", "converted"] },
            OR: [
              ...(normalisedPhone ? [{ phone: normalisedPhone }] : []),
              ...(body.email ? [{ email: body.email.toLowerCase() }] : []),
            ],
          },
        });
        if (duplicate) {
          return reply.status(409).send({
            error: {
              code: "DUPLICATE_LEAD",
              message: "A lead with this phone or email already exists",
              data: { existingLeadId: duplicate.id },
            },
          });
        }
      }

      // Get or create default stage
      let stageId = body.stageId;
      if (!stageId) {
        const defaultStage = await prisma.pipelineStage.findFirst({
          where: { tenantId, isDefault: true },
        });
        stageId = defaultStage?.id;
      }

      // Generate lead number
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      });
      const leadNumber = `LEA-${new Date().getFullYear()}-${String(
        (settings?.invoiceNextNumber ?? 1000) + Math.floor(Math.random() * 9000)
      ).padStart(4, "0")}`;

      const lead = await prisma.lead.create({
        data: {
          tenantId,
          leadNumber,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email?.toLowerCase(),
          phone: normalisedPhone ?? body.phone,
          companyName: body.companyName,
          source: body.source as any,
          sourceDetail: body.sourceDetail,
          sourceCampaignId: body.sourceCampaignId,
          sourceAdId: body.sourceAdId,
          utmSource: body.utmSource,
          utmMedium: body.utmMedium,
          utmCampaign: body.utmCampaign,
          serviceRequired: body.serviceRequired,
          serviceCategory: body.serviceCategory,
          propertyAddress: body.propertyAddress,
          suburb: body.suburb,
          postcode: body.postcode,
          propertyType: body.propertyType as any,
          urgency: body.urgency as any,
          estimatedValueCents: body.estimatedValueCents,
          notes: body.notes,
          stageId,
          assignedToId: body.assignedToId ?? userId,
          tags: body.tags,
          customFields: body.customFields as any,
          rawPayload: body.rawPayload as any,
          status: "active",
          createdById: userId,
        },
        include: {
          stage: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Log activity
      await prisma.leadActivity.create({
        data: {
          tenantId,
          leadId: lead.id,
          type: "lead_created",
          description: `Lead created from ${body.source.replace(/_/g, " ")}`,
          userId,
        },
      });

      // Trigger automation evaluation
      await enqueueAutomation({
        tenantId,
        triggerType: "lead_created",
        entityType: "lead",
        entityId: lead.id,
        entityData: { source: lead.source, urgency: lead.urgency },
      });

      // Queue AI scoring
      await enqueueAIScoring({ tenantId, leadId: lead.id });

      auditFromRequest(request, "create", "lead", lead.id).catch(() => {});

      notifyBusiness(tenantId, "new_lead", {
        summary: `New lead: <b>${lead.firstName} ${lead.lastName ?? ""}</b>${lead.serviceRequired ? ` — ${lead.serviceRequired}` : ""} (via ${lead.source})`,
        link: `/leads/${lead.id}`,
        sms: `New lead: ${lead.firstName} ${lead.phone ?? lead.email ?? ""} via ${lead.source}. Open TradieJet.`,
      }).catch(() => {});

      return reply.status(201).send({ data: lead });
    }
  );

  // GET /api/v1/leads/web-form — return (lazily creating) this tenant's public
  // website-form key, the intake endpoint, and a copy-paste embed snippet.
  fastify.get(
    "/leads/web-form",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const { tenantId } = request;

      let sourceConfig = await prisma.leadSourceConfig.findUnique({
        where: { tenantId_source: { tenantId, source: "website" } },
      });

      if (!sourceConfig || !(sourceConfig.config as any)?.formKey) {
        const formKey = nanoid(24);
        sourceConfig = await prisma.leadSourceConfig.upsert({
          where: { tenantId_source: { tenantId, source: "website" } },
          create: { tenantId, source: "website", isActive: true, config: { formKey } },
          update: { isActive: true, config: { formKey } },
        });
      }

      const formKey = (sourceConfig.config as any).formKey as string;
      const endpoint = `${config.API_URL}/api/v1/webhooks/forms/${formKey}`;
      const embedSnippet = [
        `<form id="lfp-lead-form">`,
        `  <input name="firstName" placeholder="Your name" required />`,
        `  <input name="phone" placeholder="Phone" />`,
        `  <input name="email" type="email" placeholder="Email" />`,
        `  <input name="serviceRequired" placeholder="What do you need?" />`,
        `  <input name="companyWebsite" style="display:none" tabindex="-1" autocomplete="off" />`,
        `  <button type="submit">Request a quote</button>`,
        `</form>`,
        `<script>`,
        `document.getElementById('lfp-lead-form').addEventListener('submit', async (e) => {`,
        `  e.preventDefault();`,
        `  const data = Object.fromEntries(new FormData(e.target).entries());`,
        `  await fetch('${endpoint}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });`,
        `  e.target.innerHTML = '<p>Thanks! We will be in touch shortly.</p>';`,
        `});`,
        `</script>`,
      ].join("\n");

      return { data: { formKey, endpoint, embedSnippet, lastEventAt: sourceConfig.lastEventAt } };
    }
  );

  // GET /api/v1/leads/google-ads-webhook — return (lazily creating) this tenant's
  // Google Lead Form webhook URL + key to paste into Google Ads.
  fastify.get(
    "/leads/google-ads-webhook",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const { tenantId } = request;
      let sourceConfig = await prisma.leadSourceConfig.findUnique({
        where: { tenantId_source: { tenantId, source: "google_ads" } },
      });
      if (!sourceConfig || !(sourceConfig.config as any)?.googleKey) {
        const googleKey = nanoid(32);
        sourceConfig = await prisma.leadSourceConfig.upsert({
          where: { tenantId_source: { tenantId, source: "google_ads" } },
          create: { tenantId, source: "google_ads", isActive: true, config: { googleKey } },
          update: { isActive: true, config: { googleKey } },
        });
      }
      const googleKey = (sourceConfig.config as any).googleKey as string;
      return {
        data: {
          webhookUrl: `${config.API_URL}/api/v1/webhooks/google`,
          googleKey,
          lastEventAt: sourceConfig.lastEventAt,
          instructions: "In Google Ads, open your Lead Form asset → Delivery → Webhook integration. Paste the Webhook URL and Key, then send test data.",
        },
      };
    }
  );

  // GET /api/v1/leads/:id
  fastify.get(
    "/leads/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const lead = await prisma.lead.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          stage: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          quotes: {
            where: { deletedAt: null },
            select: { id: true, quoteNumber: true, status: true, totalCents: true, createdAt: true },
          },
        },
      });

      if (!lead) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Lead not found" } });
      }

      return { data: lead };
    }
  );

  // PATCH /api/v1/leads/:id
  fastify.patch(
    "/leads/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager", "sales"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateLeadSchema.parse(request.body);
      const { tenantId, userId } = request;

      const existing = await prisma.lead.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Lead not found" } });
      }

      // Track stage change
      const stageChanged = body.stageId && body.stageId !== existing.stageId;

      const normalised: any = { ...body };
      if (body.phone) normalised.phone = normalisePhone(body.phone) ?? body.phone;
      if (body.email) normalised.email = body.email.toLowerCase();
      if (stageChanged) normalised.stageChangedAt = new Date();

      const updated = await prisma.lead.update({
        where: { id },
        data: normalised,
        include: { stage: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } },
      });

      // Activity log
      const activities = [];
      if (stageChanged && body.stageId) {
        const newStage = await prisma.pipelineStage.findUnique({ where: { id: body.stageId } });
        const oldStage = existing.stageId
          ? await prisma.pipelineStage.findUnique({ where: { id: existing.stageId } })
          : null;
        activities.push({
          tenantId,
          leadId: id,
          type: "stage_changed",
          description: `Moved from ${oldStage?.name ?? "None"} to ${newStage?.name}`,
          metadata: { fromStage: oldStage?.name, toStage: newStage?.name },
          userId,
        });

        await enqueueAutomation({
          tenantId,
          triggerType: "lead_stage_changed",
          entityType: "lead",
          entityId: id,
          entityData: { stageId: body.stageId, previousStageId: existing.stageId },
        });
      }

      if (activities.length > 0) {
        await prisma.leadActivity.createMany({ data: activities });
      }

      auditFromRequest(request, "update", "lead", id).catch(() => {});

      return { data: updated };
    }
  );

  // DELETE /api/v1/leads/:id
  fastify.delete(
    "/leads/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.lead.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Lead not found" } });
      }
      await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
      auditFromRequest(request, "delete", "lead", id).catch(() => {});
      return reply.status(204).send();
    }
  );

  // POST /api/v1/leads/:id/convert
  fastify.post(
    "/leads/:id/convert",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        createJob: z.boolean().default(false),
        jobTitle: z.string().optional(),
        scheduledStart: z.string().datetime().optional(),
        // Optionally auto-generate a draft quote from selected catalog items / prices.
        quoteTitle: z.string().optional(),
        quoteItems: z.array(z.object({
          catalogItemId: z.string().uuid().optional(),
          description: z.string().min(1),
          quantity: z.number().positive().default(1),
          unitPriceCents: z.number().int().min(0),
          gstRate: z.number().min(0).max(1).optional(),
        })).optional(),
      }).parse(request.body);

      const lead = await prisma.lead.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null, status: "active" },
      });
      if (!lead) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Lead not found" } });
      }

      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: request.tenantId },
      });

      const { customer, job, quote } = await prisma.$transaction(async (tx) => {
        // Create or find customer
        let customer = lead.email
          ? await tx.customer.findFirst({
              where: { email: lead.email, tenantId: request.tenantId, deletedAt: null },
            })
          : null;

        if (!customer) {
          const customerNumber = `CUS-${new Date().getFullYear()}-${String(
            (settings?.invoiceNextNumber ?? 1000) + Math.floor(Math.random() * 9000)
          ).padStart(4, "0")}`;

          customer = await tx.customer.create({
            data: {
              tenantId: request.tenantId,
              customerNumber,
              type: lead.propertyType === "commercial" ? "commercial" : "residential",
              firstName: lead.firstName,
              lastName: lead.lastName ?? undefined,
              companyName: lead.companyName ?? undefined,
              email: lead.email ?? undefined,
              phone: lead.phone ?? undefined,
              billingStreet: lead.propertyAddress ?? undefined,
              billingSuburb: lead.suburb ?? undefined,
              billingPostcode: lead.postcode ?? undefined,
              billingCountry: "AU",
              sourceLeadId: lead.id,
              assignedToId: lead.assignedToId ?? undefined,
              createdById: request.userId,
            },
          });
        }

        // Create property if address exists
        if (lead.propertyAddress && customer) {
          await tx.property.create({
            data: {
              tenantId: request.tenantId,
              customerId: customer.id,
              streetAddress: lead.propertyAddress,
              suburb: lead.suburb ?? undefined,
              postcode: lead.postcode ?? undefined,
              country: "AU",
              propertyType: lead.propertyType as any,
            },
          });
        }

        // Won stage
        const wonStage = await tx.pipelineStage.findFirst({
          where: { tenantId: request.tenantId, isWon: true },
        });

        // Update lead
        await tx.lead.update({
          where: { id },
          data: {
            status: "converted",
            convertedToCustomerId: customer.id,
            convertedAt: new Date(),
            stageId: wonStage?.id ?? undefined,
          },
        });

        // Optionally create job
        let job = null;
        if (body.createJob) {
          const jobNumber = `JOB-${new Date().getFullYear()}-${String(
            (settings?.jobNextNumber ?? 1000) + Math.floor(Math.random() * 9000)
          ).padStart(4, "0")}`;

          job = await tx.job.create({
            data: {
              tenantId: request.tenantId,
              jobNumber,
              customerId: customer.id,
              title: body.jobTitle ?? lead.serviceRequired ?? "New Job",
              tradeCategory: lead.serviceCategory ?? undefined,
              priority: lead.urgency === "emergency" ? "emergency"
                : lead.urgency === "urgent" ? "high" : "normal",
              status: "pending",
              scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : undefined,
              assignedUserIds: lead.assignedToId ? [lead.assignedToId] : [],
              leadTechnicianId: lead.assignedToId ?? undefined,
              createdById: request.userId,
            },
          });
        }

        // Optionally auto-generate a draft quote from the selected items.
        let quote = null;
        if (body.quoteItems && body.quoteItems.length > 0) {
          const tenant = await tx.tenant.findUnique({ where: { id: request.tenantId }, select: { gstRate: true } });
          const defaultGst = Number(tenant?.gstRate ?? 0.1);

          const items = body.quoteItems.map((li, idx) => {
            const gstRate = li.gstRate ?? defaultGst;
            const calc = calculateLineItem(li.quantity, li.unitPriceCents, gstRate, 0);
            return { ...li, gstRate, position: idx, ...calc };
          });
          const totals = calculateTotals(
            items.map((li) => ({ quantity: li.quantity, unitPriceCents: li.unitPriceCents, discountPercent: 0, gstRate: li.gstRate }))
          );

          const quoteNumber = `${settings?.quotePrefix ?? "QTE"}-${new Date().getFullYear()}-${String(
            (settings?.quoteNextNumber ?? 1000) + Math.floor(Math.random() * 9000)
          ).padStart(4, "0")}`;
          const portalToken = generatePortalToken();

          await tx.tenantSettings.update({
            where: { tenantId: request.tenantId },
            data: { quoteNextNumber: { increment: 1 } },
          });

          quote = await tx.quote.create({
            data: {
              tenantId: request.tenantId,
              quoteNumber,
              leadId: lead.id,
              customerId: customer.id,
              title: body.quoteTitle ?? lead.serviceRequired ?? "Quote",
              subtotalCents: totals.subtotalCents,
              discountCents: totals.discountCents,
              gstCents: totals.gstCents,
              totalCents: totals.totalCents,
              status: "draft",
              portalToken,
              portalUrl: `${config.APP_URL}/portal/quote/${portalToken}`,
              createdById: request.userId,
              lineItems: {
                create: items.map((li) => ({
                  tenantId: request.tenantId,
                  position: li.position,
                  catalogItemId: li.catalogItemId,
                  description: li.description,
                  quantity: li.quantity,
                  unitPriceCents: li.unitPriceCents,
                  discountPercent: 0,
                  discountCents: li.discountCents,
                  subtotalCents: li.subtotalCents,
                  gstRate: li.gstRate,
                  gstCents: li.gstCents,
                  totalCents: li.totalCents,
                })),
              },
            },
          });
        }

        return { customer, job, quote };
      });

      await prisma.leadActivity.create({
        data: {
          tenantId: request.tenantId,
          leadId: id,
          type: "lead_converted",
          description: `Lead converted to customer`,
          metadata: { customerId: customer.id, jobId: job?.id, quoteId: quote?.id },
          userId: request.userId,
        },
      });

      return reply.status(200).send({
        data: { customerId: customer.id, jobId: job?.id, quoteId: quote?.id, leadId: id },
      });
    }
  );

  // POST /api/v1/leads/:id/notes
  fastify.post(
    "/leads/:id/notes",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({ note: z.string().min(1) }).parse(request.body);

      const lead = await prisma.lead.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!lead) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Lead not found" } });
      }

      const activity = await prisma.leadActivity.create({
        data: {
          tenantId: request.tenantId,
          leadId: id,
          type: "note_added",
          description: body.note,
          userId: request.userId,
        },
      });

      return reply.status(201).send({ data: activity });
    }
  );

  // GET /api/v1/leads/:id/activities
  fastify.get(
    "/leads/:id/activities",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const activities = await prisma.leadActivity.findMany({
        where: { leadId: id, tenantId: request.tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { data: activities };
    }
  );
}
