import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { sendBrandedEmail } from "../lib/mailer.js";
import { notifyBusiness } from "../lib/notify.js";
import { presignUpload } from "../lib/r2.js";
import { generatePortalToken } from "../lib/utils.js";
import { nextQuoteNumber } from "../lib/numbering.js";

export default async function requirementRoutes(fastify: FastifyInstance) {
  // POST /api/v1/requirements — tradie sends a "tell us about your job" form to a customer
  fastify.post("/requirements", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = z.object({ customerId: z.string().uuid(), message: z.string().max(1000).optional() }).parse(request.body);
    const customer = await prisma.customer.findFirst({ where: { id: body.customerId, tenantId: request.tenantId, deletedAt: null } });
    if (!customer) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });

    const token = generatePortalToken();
    const reqst = await prisma.requirementRequest.create({
      data: { tenantId: request.tenantId, customerId: customer.id, token, status: "sent", createdById: request.userId },
    });
    const url = `${config.APP_URL}/intake/${token}`;

    const tenant = await prisma.tenant.findUnique({ where: { id: request.tenantId } });
    if (customer.email && tenant) {
      await sendBrandedEmail({
        tenantId: request.tenantId, tenant, to: customer.email, customerId: customer.id,
        subject: `${tenant.businessName ?? "We"} — tell us about your job`,
        template: "custom",
        data: {
          businessName: tenant.businessName,
          body: `Hi ${customer.firstName ?? "there"},<br/><br/>${body.message ? body.message + "<br/><br/>" : ""}To quote your job accurately, please tell us what you need — and add a few photos if you can:<br/><br/><a href="${url}" style="color:#2563EB;font-weight:600;">Tell us about your job →</a><br/><br/>It only takes a minute.`,
        },
      }).catch(() => {});
    }
    return reply.status(201).send({ data: { id: reqst.id, token, url } });
  });

  // GET /api/v1/requirements?customerId= — tradie views requests + submissions
  fastify.get("/requirements", { preHandler: [fastify.authenticate] }, async (request) => {
    const q = z.object({ customerId: z.string().uuid().optional() }).parse(request.query ?? {});
    const items = await prisma.requirementRequest.findMany({
      where: { tenantId: request.tenantId, ...(q.customerId ? { customerId: q.customerId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return { data: items };
  });

  // GET /api/v1/requirements/portal/:token — public: the form the customer fills
  fastify.get("/requirements/portal/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const r = await prisma.requirementRequest.findFirst({ where: { token } });
    if (!r) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "This link is no longer valid." } });
    const [customer, tenant] = await Promise.all([
      prisma.customer.findUnique({ where: { id: r.customerId }, select: { firstName: true } }),
      prisma.tenant.findUnique({ where: { id: r.tenantId }, select: { businessName: true, logoUrl: true, primaryColor: true, phone: true, email: true } }),
    ]);
    return {
      data: {
        status: r.status, customerName: customer?.firstName ?? "", tenant,
        details: r.details, preferredTiming: r.preferredTiming, budgetText: r.budgetText, accessNotes: r.accessNotes, photoUrls: r.photoUrls,
      },
    };
  });

  // POST /api/v1/requirements/portal/:token/photo-url — public: presigned R2 URL for a photo
  fastify.post("/requirements/portal/:token/photo-url", async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = z.object({ filename: z.string().min(1).max(200), contentType: z.string() }).parse(request.body);
    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(body.contentType)) {
      return reply.status(422).send({ error: { code: "INVALID_TYPE", message: "Please upload a JPG, PNG or WEBP image." } });
    }
    const r = await prisma.requirementRequest.findFirst({ where: { token }, select: { tenantId: true } });
    if (!r) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    const p = await presignUpload({ keyPrefix: `${r.tenantId}/requirements`, filename: body.filename, contentType: body.contentType });
    return { data: { uploadUrl: p.uploadUrl, fileUrl: p.publicUrl } };
  });

  // POST /api/v1/requirements/portal/:token/submit — public: customer submits the form
  fastify.post("/requirements/portal/:token/submit", async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = z.object({
      details: z.string().max(5000).optional(),
      preferredTiming: z.string().max(500).optional(),
      budgetText: z.string().max(200).optional(),
      accessNotes: z.string().max(1000).optional(),
      photoUrls: z.array(z.string().url()).max(20).optional(),
    }).parse(request.body ?? {});
    const r = await prisma.requirementRequest.findFirst({ where: { token } });
    if (!r) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    if (r.status === "quoted") return reply.status(409).send({ error: { code: "DONE", message: "This request has already been actioned." } });

    await prisma.requirementRequest.update({
      where: { id: r.id },
      data: {
        status: "submitted",
        details: body.details, preferredTiming: body.preferredTiming, budgetText: body.budgetText,
        accessNotes: body.accessNotes, photoUrls: body.photoUrls ?? [], submittedAt: new Date(),
      },
    });
    notifyBusiness(r.tenantId, "new_lead", {
      summary: `A customer submitted their job requirements. Review and send a quote.`,
      link: `/customers/${r.customerId}`,
    }).catch(() => {});
    return { data: { submitted: true } };
  });

  // POST /api/v1/requirements/:id/quote — tradie creates a draft quote prefilled from the request
  fastify.post("/requirements/:id/quote", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const r = await prisma.requirementRequest.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!r) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    if (r.quoteId) return reply.status(200).send({ data: { id: r.quoteId, existing: true } });

    const descParts = [
      r.details,
      r.preferredTiming ? `Preferred timing: ${r.preferredTiming}` : "",
      r.budgetText ? `Budget: ${r.budgetText}` : "",
      r.accessNotes ? `Access: ${r.accessNotes}` : "",
      r.photoUrls.length ? `Photos:\n${r.photoUrls.join("\n")}` : "",
    ].filter(Boolean);

    const quote = await prisma.$transaction(async (tx) => {
      const quoteNumber = await nextQuoteNumber(tx, request.tenantId);
      const portalToken = generatePortalToken();
      const q = await tx.quote.create({
        data: {
          tenantId: request.tenantId, quoteNumber, customerId: r.customerId,
          title: "Quote", description: descParts.join("\n\n"),
          subtotalCents: 0, discountCents: 0, gstCents: 0, totalCents: 0, status: "draft",
          portalToken, portalUrl: `${config.APP_URL}/portal/quote/${portalToken}`, createdById: request.userId,
          lineItems: {
            create: [{
              tenantId: request.tenantId, position: 0, lineType: "material",
              description: (r.details ?? "Work").slice(0, 200), quantity: 1, unitPriceCents: 0, gstRate: 0.1,
              discountPercent: 0, subtotalCents: 0, discountCents: 0, gstCents: 0, totalCents: 0,
            }],
          },
        },
      });
      await tx.requirementRequest.update({ where: { id: r.id }, data: { status: "quoted", quoteId: q.id } });
      return q;
    });
    return reply.status(201).send({ data: { id: quote.id } });
  });
}
