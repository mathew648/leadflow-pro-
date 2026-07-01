import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { calculateLineItem, calculateTotals, generatePortalToken } from "../lib/utils.js";
import { nextQuoteNumber, nextJobNumber } from "../lib/numbering.js";
import { syncQuoteLineItemsToJobMaterials } from "../lib/job-sync.js";
import { enqueueEmail, enqueuePdf, enqueueAutomation } from "../lib/queue.js";
import { config } from "../config.js";
import { auditFromRequest } from "../lib/audit.js";
import { sendBrandedEmail } from "../lib/mailer.js";
import { notifyBusiness } from "../lib/notify.js";

const lineItemSchema = z.object({
  catalogItemId: z.string().uuid().optional(),
  lineType: z.enum(["labour", "material", "equipment", "subcontract", "other"]).default("material"),
  description: z.string().min(1).max(500),
  notes: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  gstRate: z.number().min(0).max(1).default(0.10),
  position: z.number().int().min(0),
  section: z.string().optional(),
  isOptional: z.boolean().default(false),
  isSelected: z.boolean().default(true),
  costPriceCents: z.number().int().min(0).default(0),
});

const createQuoteSchema = z.object({
  customerId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  depositPercent: z.number().min(0).max(100).default(0),
  paymentTermsDays: z.number().int().min(0).max(365).default(14),
  paymentTermsText: z.string().optional(),
  termsConditions: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
});

export default async function quotesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/quotes
  fastify.get(
    "/quotes",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        status: z.string().optional(),
        customerId: z.string().uuid().optional(),
        search: z.string().optional(),
        limit: z.coerce.number().default(25),
        offset: z.coerce.number().default(0),
      }).parse(request.query);

      const where: any = {
        tenantId: request.tenantId,
        deletedAt: null,
        ...(query.status && { status: query.status }),
        ...(query.customerId && { customerId: query.customerId }),
        ...(query.search && {
          OR: [
            { quoteNumber: { contains: query.search, mode: "insensitive" } },
            { title: { contains: query.search, mode: "insensitive" } },
            { customer: { firstName: { contains: query.search, mode: "insensitive" } } },
            { customer: { lastName: { contains: query.search, mode: "insensitive" } } },
          ],
        }),
      };

      const [quotes, total] = await prisma.$transaction([
        prisma.quote.findMany({
          where,
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
            property: { select: { id: true, streetAddress: true, suburb: true } },
          },
          orderBy: { createdAt: "desc" },
          take: query.limit,
          skip: query.offset,
        }),
        prisma.quote.count({ where }),
      ]);

      return { data: quotes, meta: { total, limit: query.limit, offset: query.offset } };
    }
  );

  // POST /api/v1/quotes
  fastify.post(
    "/quotes",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager", "sales"])] },
    async (request, reply) => {
      // Drop blank/half-typed rows before validating so a stray empty line never blocks the save.
      const rawBody: any = request.body ?? {};
      if (Array.isArray(rawBody.lineItems)) {
        rawBody.lineItems = rawBody.lineItems.filter(
          (li: any) => li && typeof li.description === "string" && li.description.trim().length > 0
        );
      }
      const body = createQuoteSchema.parse(rawBody);
      const { tenantId, userId } = request;

      // Verify customer belongs to tenant
      const customer = await prisma.customer.findFirst({
        where: { id: body.customerId, tenantId, deletedAt: null },
      });
      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
      // Calculate totals
      const lineItemCalcs = body.lineItems.map((li) => {
        const calc = calculateLineItem(li.quantity, li.unitPriceCents, li.gstRate, li.discountPercent);
        return { ...li, ...calc };
      });

      const totals = calculateTotals(
        body.lineItems.map((li) => ({
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
          discountPercent: li.discountPercent,
          gstRate: li.gstRate,
          isOptional: li.isOptional,
          isSelected: li.isSelected,
        }))
      );

      const depositCents = Math.round(totals.totalCents * (body.depositPercent / 100));
      const portalToken = generatePortalToken();
      const portalUrl = `${config.APP_URL}/portal/quote/${portalToken}`;

      const quote = await prisma.$transaction(async (tx) => {
        const quoteNumber = await nextQuoteNumber(tx, tenantId);

        const quote = await tx.quote.create({
          data: {
            tenantId,
            quoteNumber,
            leadId: body.leadId,
            customerId: body.customerId,
            propertyId: body.propertyId,
            title: body.title,
            description: body.description,
            internalNotes: body.internalNotes,
            subtotalCents: totals.subtotalCents,
            discountCents: totals.discountCents,
            gstCents: totals.gstCents,
            totalCents: totals.totalCents,
            depositPercent: body.depositPercent,
            depositCents,
            paymentTermsDays: body.paymentTermsDays,
            paymentTermsText: body.paymentTermsText,
            validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
            termsConditions: body.termsConditions,
            status: "draft",
            portalToken,
            portalUrl,
            createdById: userId,
          },
        });

        await tx.quoteLineItem.createMany({
          data: lineItemCalcs.map((li) => ({
            tenantId,
            quoteId: quote.id,
            position: li.position,
            section: li.section,
            isOptional: li.isOptional,
            isSelected: li.isSelected,
            catalogItemId: li.catalogItemId,
            lineType: li.lineType ?? "material",
            description: li.description,
            notes: li.notes,
            unit: li.unit,
            quantity: li.quantity,
            unitPriceCents: li.unitPriceCents,
            discountPercent: li.discountPercent,
            discountCents: li.discountCents,
            subtotalCents: li.subtotalCents,
            gstRate: li.gstRate,
            gstCents: li.gstCents,
            totalCents: li.totalCents,
            costPriceCents: li.costPriceCents,
          })),
        });

        return quote;
      });

      auditFromRequest(request, "create", "quote", quote.id).catch(() => {});

      return reply.status(201).send({
        data: {
          ...quote,
          portalUrl,
          lineItems: lineItemCalcs,
        },
      });
    }
  );

  // GET /api/v1/quotes/:id
  fastify.get(
    "/quotes/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const quote = await prisma.quote.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          customer: true,
          property: true,
          lineItems: { orderBy: { position: "asc" } },
          lead: { select: { id: true, firstName: true, lastName: true, source: true } },
        },
      });
      if (!quote) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Quote not found" } });
      }
      return { data: quote };
    }
  );

  // PATCH /api/v1/quotes/:id
  fastify.patch(
    "/quotes/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      // Tolerate blank/half-typed rows: drop line items with no description before validating,
      // so a stray empty row from the editor never 400s the save.
      const rawBody: any = request.body ?? {};
      if (Array.isArray(rawBody.lineItems)) {
        rawBody.lineItems = rawBody.lineItems.filter(
          (li: any) => li && typeof li.description === "string" && li.description.trim().length > 0
        );
      }
      const body = z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        internalNotes: z.string().optional(),
        validUntil: z.string().datetime().optional().nullable(),
        depositPercent: z.number().min(0).max(100).optional(),
        paymentTermsDays: z.number().int().min(0).optional(),
        paymentTermsText: z.string().optional(),
        termsConditions: z.string().optional(),
        lineItems: z.array(lineItemSchema).optional(),
      }).parse(rawBody);

      const existing = await prisma.quote.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Quote not found" } });
      }
      if (existing.status === "approved") {
        return reply.status(400).send({ error: { code: "LOCKED", message: "Approved quotes cannot be edited" } });
      }

      const updateData: any = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes;
      if (body.validUntil !== undefined) updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null;
      if (body.depositPercent !== undefined) updateData.depositPercent = body.depositPercent;
      if (body.paymentTermsDays !== undefined) updateData.paymentTermsDays = body.paymentTermsDays;
      if (body.paymentTermsText !== undefined) updateData.paymentTermsText = body.paymentTermsText;
      if (body.termsConditions !== undefined) updateData.termsConditions = body.termsConditions;

      if (body.lineItems) {
        const lineItemCalcs = body.lineItems.map((li) => {
          const calc = calculateLineItem(li.quantity, li.unitPriceCents, li.gstRate, li.discountPercent);
          return { ...li, ...calc };
        });
        const totals = calculateTotals(
          body.lineItems.map((li) => ({
            quantity: li.quantity, unitPriceCents: li.unitPriceCents,
            discountPercent: li.discountPercent, gstRate: li.gstRate,
            isOptional: li.isOptional, isSelected: li.isSelected,
          }))
        );
        updateData.subtotalCents = totals.subtotalCents;
        updateData.discountCents = totals.discountCents;
        updateData.gstCents = totals.gstCents;
        updateData.totalCents = totals.totalCents;
        updateData.depositCents = Math.round(totals.totalCents * ((body.depositPercent ?? Number(existing.depositPercent)) / 100));

        await prisma.$transaction([
          prisma.quoteLineItem.deleteMany({ where: { quoteId: id } }),
          prisma.quoteLineItem.createMany({
            data: lineItemCalcs.map((li) => ({
              tenantId: request.tenantId, quoteId: id,
              position: li.position, section: li.section, isOptional: li.isOptional, isSelected: li.isSelected,
              catalogItemId: li.catalogItemId, lineType: li.lineType ?? "material", description: li.description, notes: li.notes, unit: li.unit,
              quantity: li.quantity, unitPriceCents: li.unitPriceCents, discountPercent: li.discountPercent,
              discountCents: li.discountCents, subtotalCents: li.subtotalCents, gstRate: li.gstRate,
              gstCents: li.gstCents, totalCents: li.totalCents, costPriceCents: li.costPriceCents,
            })),
          }),
        ]);
      }

      const updated = await prisma.quote.update({
        where: { id },
        data: updateData,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          lineItems: { orderBy: { position: "asc" } },
        },
      });

      return { data: updated };
    }
  );

  // POST /api/v1/quotes/:id/send
  fastify.post(
    "/quotes/:id/send",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const quote = await prisma.quote.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          customer: true,
          tenant: { include: { settings: true } },
          lineItems: { orderBy: { position: "asc" } },
        },
      });
      if (!quote) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Quote not found" } });
      }
      if (quote.status !== "draft") {
        return reply.status(422).send({
          error: { code: "INVALID_STATUS", message: "Only draft quotes can be sent" },
        });
      }

      await prisma.quote.update({
        where: { id },
        data: { status: "sent", sentAt: new Date() },
      });

      // Mirror the quote's items onto the linked job's materials now, so the tradie can enter
      // costs and see profit immediately — without waiting for the customer to approve.
      const linkedJob = await prisma.job.findFirst({ where: { quoteId: quote.id, deletedAt: null }, select: { id: true } });
      if (linkedJob) await syncQuoteLineItemsToJobMaterials(prisma, quote, linkedJob.id);

      // Send branded email with portal link (logged to Message history)
      if (quote.customer.email) {
        await sendBrandedEmail({
          tenantId: request.tenantId,
          tenant: quote.tenant,
          to: quote.customer.email,
          customerId: quote.customerId,
          subject: `Quote ${quote.quoteNumber} from ${quote.tenant.businessName}`,
          template: "quote",
          data: {
            customerName: `${quote.customer.firstName} ${quote.customer.lastName ?? ""}`.trim(),
            quoteNumber: quote.quoteNumber,
            validUntil: quote.validUntil?.toISOString(),
            totalCents: quote.totalCents,
            portalUrl: quote.portalUrl,
          },
        });
      }

      // Queue PDF generation
      await enqueuePdf({ tenantId: request.tenantId, type: "quote", entityId: id });

      // Trigger automation
      await enqueueAutomation({
        tenantId: request.tenantId,
        triggerType: "quote_sent",
        entityType: "quote",
        entityId: id,
      });

      auditFromRequest(request, "send", "quote", id).catch(() => {});

      return {
        data: {
          sentAt: new Date().toISOString(),
          sentTo: quote.customer.email,
          portalUrl: quote.portalUrl,
        },
      };
    }
  );

  // GET /api/v1/quotes/portal/:token  — public, no auth
  fastify.get(
    "/quotes/portal/:token",
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const quote = await prisma.quote.findFirst({
        where: { portalToken: token, deletedAt: null },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          property: { select: { streetAddress: true, suburb: true, state: true } },
          tenant: {
            select: {
              businessName: true, phone: true, email: true,
              logoUrl: true, primaryColor: true, abn: true,
            },
          },
          lineItems: { orderBy: { position: "asc" } },
        },
      });

      if (!quote) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Quote not found" } });
      }

      // Track view
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          viewCount: { increment: 1 },
          lastViewedAt: new Date(),
          firstViewedAt: quote.firstViewedAt ?? new Date(),
          ...(quote.status === "sent" && { status: "viewed" }),
        },
      });

      if (!quote.firstViewedAt) {
        await enqueueAutomation({
          tenantId: quote.tenantId,
          triggerType: "quote_viewed",
          entityType: "quote",
          entityId: quote.id,
        });
        notifyBusiness(quote.tenantId, "quote_viewed", {
          summary: `Your customer just viewed quote <b>${quote.quoteNumber}</b>.`,
          link: `/quotes/${quote.id}`,
        }).catch(() => {});
      }

      return { data: quote };
    }
  );

  // POST /api/v1/quotes/portal/:token/approve  — public
  fastify.post(
    "/quotes/portal/:token/approve",
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const body = z.object({
        approvedByName: z.string().min(1).max(200),
        signature: z.string(), // base64 image
        selectedOptionals: z.array(z.string().uuid()).default([]),
      }).parse(request.body);

      const quote = await prisma.quote.findFirst({
        where: { portalToken: token, deletedAt: null, status: { in: ["sent", "viewed"] } },
        include: {
          tenant: { include: { settings: true } },
          customer: true,
          lineItems: { orderBy: { position: "asc" } },
        },
      });

      if (!quote) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Quote not found or already actioned" } });
      }

      // Store signature to R2 (simplified — in prod would upload to R2)
      const signatureUrl = `${config.R2_PUBLIC_URL ?? ""}/signatures/${quote.id}.png`;

      // Update optional extras selections
      if (body.selectedOptionals.length > 0) {
        await prisma.quoteLineItem.updateMany({
          where: { quoteId: quote.id, isOptional: true },
          data: { isSelected: false },
        });
        await prisma.quoteLineItem.updateMany({
          where: { quoteId: quote.id, id: { in: body.selectedOptionals } },
          data: { isSelected: true },
        });
      }

      // Create job automatically on approval
      const settings = quote.tenant.settings;

      const { updatedQuote, job } = await prisma.$transaction(async (tx) => {
        const updatedQuote = await tx.quote.update({
          where: { id: quote.id },
          data: {
            status: "approved",
            approvedAt: new Date(),
            approvedByName: body.approvedByName,
            approvedByIp: request.ip,
            signatureUrl,
          },
        });

        // Reuse the job this quote came from (job → quote flow). Job.quoteId is unique,
        // so creating a second job for the same quote would throw a 500 on approval.
        let job = await tx.job.findFirst({ where: { quoteId: quote.id, deletedAt: null } });
        if (!job) {
          const jobNumber = await nextJobNumber(tx, quote.tenantId);
          job = await tx.job.create({
            data: {
              tenantId: quote.tenantId,
              jobNumber,
              quoteId: quote.id,
              customerId: quote.customerId,
              title: quote.title,
              description: quote.description ?? undefined,
              quotedAmountCents: quote.totalCents,
              status: "pending",
              priority: "normal",
              createdById: quote.createdById ?? undefined,
            },
          });
        }

        // Mirror the approved quote's line items onto the job as materials (for the overview/costing).
        await syncQuoteLineItemsToJobMaterials(tx, quote, job.id);

        await tx.quote.update({ where: { id: quote.id }, data: { convertedToJobId: job.id } });

        return { updatedQuote, job };
      });

      // Fire-and-forget — a queue hiccup must NOT 500 the approval after it has committed
      // (that left the portal showing an error until a manual refresh).
      enqueueAutomation({
        tenantId: quote.tenantId,
        triggerType: "quote_approved",
        entityType: "quote",
        entityId: quote.id,
        entityData: { jobId: job.id },
      }).catch(() => {});

      notifyBusiness(quote.tenantId, "quote_approved", {
        summary: `Quote <b>${quote.quoteNumber}</b> was approved by your customer. A job has been created.`,
        link: `/jobs/${job.id}`,
      }).catch(() => {});

      // NOTE: the customer's approval-confirmation email is sent by the seeded
      // "Quote approved — thank you" automation (fired via enqueueAutomation above, trigger
      // "quote_approved"). It used to ALSO be sent directly here, so customers received TWO
      // approval emails for every quote. The direct send was removed to leave a single source
      // of truth — the automation, which tenants can edit or disable.

      return { data: { approved: true, jobId: job.id, quoteId: quote.id } };
    }
  );

  // POST /api/v1/quotes/portal/:token/reject  — public
  fastify.post(
    "/quotes/portal/:token/reject",
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const body = z.object({ reason: z.string().optional() }).parse(request.body);

      const quote = await prisma.quote.findFirst({
        where: { portalToken: token, deletedAt: null, status: { in: ["sent", "viewed"] } },
      });
      if (!quote) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Quote not found" } });
      }

      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "rejected", rejectedAt: new Date(), rejectionReason: body.reason },
      });

      enqueueAutomation({
        tenantId: quote.tenantId,
        triggerType: "quote_rejected",
        entityType: "quote",
        entityId: quote.id,
      }).catch(() => {});

      return { data: { rejected: true } };
    }
  );

  // POST /api/v1/quotes/:id/duplicate
  fastify.post(
    "/quotes/:id/duplicate",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const original = await prisma.quote.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: { lineItems: true },
      });
      if (!original) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Quote not found" } });
      }

      const portalToken = generatePortalToken();
      const newQuote = await prisma.$transaction(async (tx) => {
        const quoteNumber = await nextQuoteNumber(tx, request.tenantId);
        const q = await tx.quote.create({
          data: {
            tenantId: request.tenantId,
            quoteNumber,
            customerId: original.customerId,
            propertyId: original.propertyId ?? undefined,
            title: `${original.title} (Copy)`,
            description: original.description ?? undefined,
            subtotalCents: original.subtotalCents,
            gstCents: original.gstCents,
            totalCents: original.totalCents,
            depositPercent: original.depositPercent,
            depositCents: original.depositCents,
            paymentTermsDays: original.paymentTermsDays,
            termsConditions: original.termsConditions ?? undefined,
            status: "draft",
            portalToken,
            portalUrl: `${config.APP_URL}/portal/quote/${portalToken}`,
            createdById: request.userId,
          },
        });

        await tx.quoteLineItem.createMany({
          data: original.lineItems.map((li) => ({
            ...li,
            id: undefined,
            quoteId: q.id,
            createdAt: undefined,
            updatedAt: undefined,
          })),
        });

        return q;
      });

      return reply.status(201).send({ data: newQuote });
    }
  );
}
