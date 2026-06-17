import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const updateSettingsSchema = z.object({
  invoicePrefix: z.string().max(20).optional(),
  invoicePaymentTerms: z.number().int().min(0).max(365).optional(),
  invoiceFooterText: z.string().optional(),
  invoiceBankDetails: z.record(z.string()).optional(),
  quotePrefix: z.string().max(20).optional(),
  quoteValidityDays: z.number().int().min(1).max(365).optional(),
  quoteTermsConditions: z.string().optional(),
  quoteDepositPercent: z.number().min(0).max(100).optional(),
  requireCustomerSignoff: z.boolean().optional(),
  notifyNewLeadEmail: z.boolean().optional(),
  notifyNewLeadSms: z.boolean().optional(),
  notifyQuoteViewed: z.boolean().optional(),
  notifyQuoteApproved: z.boolean().optional(),
  notifyPaymentReceived: z.boolean().optional(),
  autoSendReviewRequest: z.boolean().optional(),
  reviewRequestDelayHours: z.number().int().min(0).max(168).optional(),
  googlePlaceId: z.string().optional(),
  leadAssignmentStrategy: z.enum(["manual", "round_robin", "ai"]).optional(),
});

const updateTenantSchema = z.object({
  businessName: z.string().max(200).optional(),
  abn: z.string().optional(),
  phone: z.string().optional(),
  streetAddress: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  tradeTypes: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  gstRate: z.number().min(0).max(1).optional(),
  taxNumber: z.string().optional(),
});

export default async function tenantsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/tenant
  fastify.get(
    "/tenant",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        include: {
          subscription: true,
          settings: true,
          _count: {
            select: {
              leads: { where: { deletedAt: null, status: "active" } },
              customers: { where: { deletedAt: null } },
              jobs: { where: { deletedAt: null, status: { notIn: ["completed", "cancelled"] } } },
            },
          },
        },
      });

      return { data: tenant };
    }
  );

  // PATCH /api/v1/tenant
  fastify.patch(
    "/tenant",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const body = updateTenantSchema.parse(request.body);
      const tenant = await prisma.tenant.update({
        where: { id: request.tenantId },
        data: body,
      });
      return { data: tenant };
    }
  );

  // PATCH /api/v1/tenant/settings
  fastify.patch(
    "/tenant/settings",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const body = updateSettingsSchema.parse(request.body);
      const settings = await prisma.tenantSettings.upsert({
        where: { tenantId: request.tenantId },
        create: { tenantId: request.tenantId, ...body },
        update: body,
      });
      return { data: settings };
    }
  );

  // POST /api/v1/tenant/test-email — send a test email to the current user to verify email is configured.
  fastify.post(
    "/tenant/test-email",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const email = request.jwtUser?.email;
      if (!email) {
        return reply.status(400).send({ error: { code: "NO_EMAIL", message: "No email on your account" } });
      }
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        select: { businessName: true, primaryColor: true, logoUrl: true },
      });
      try {
        const { sendEmail } = await import("../services/email.service.js");
        const result = await sendEmail({
          tenantId: request.tenantId,
          to: email,
          subject: `Test email from ${tenant?.businessName ?? "LeadFlow Pro"}`,
          template: "custom",
          data: {
            body: "✅ Your email is working! This is a test from LeadFlow Pro. Quotes, invoices and automated replies will now reach your customers.",
            businessName: tenant?.businessName,
            primaryColor: tenant?.primaryColor,
            logoUrl: tenant?.logoUrl,
          },
        });
        if (result.id === "skipped-no-resend-key") {
          return { data: { sent: false, reason: "Email isn't configured yet — set RESEND_API_KEY in your hosting environment." } };
        }
        return { data: { sent: true, to: email } };
      } catch (err: any) {
        return { data: { sent: false, reason: err?.message ?? "Email send failed" } };
      }
    }
  );

  // GET /api/v1/tenant/users
  fastify.get(
    "/tenant/users",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const users = await prisma.user.findMany({
        where: { tenantId: request.tenantId, deletedAt: null },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, role: true, status: true, avatarUrl: true,
          tradeTypes: true, createdAt: true, lastLoginAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
      return { data: users };
    }
  );

  // POST /api/v1/tenant/users/invite
  fastify.post(
    "/tenant/users/invite",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const body = z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.enum(["admin", "manager", "technician", "sales", "viewer"]),
        phone: z.string().optional(),
      }).parse(request.body);

      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: request.tenantId },
      });
      const userCount = await prisma.user.count({
        where: { tenantId: request.tenantId, deletedAt: null },
      });

      if (subscription && userCount >= subscription.maxUsers) {
        return reply.status(402).send({
          error: {
            code: "USER_LIMIT_REACHED",
            message: `Your plan allows ${subscription.maxUsers} users. Upgrade to add more.`,
          },
        });
      }

      const existing = await prisma.user.findFirst({
        where: { email: body.email.toLowerCase(), tenantId: request.tenantId },
      });
      if (existing) {
        return reply.status(409).send({
          error: { code: "USER_EXISTS", message: "User already exists" },
        });
      }

      const user = await prisma.user.create({
        data: {
          tenantId: request.tenantId,
          email: body.email.toLowerCase(),
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          role: body.role as any,
          status: "invited",
          invitedAt: new Date(),
        },
      });

      // TODO: Send invitation email
      return reply.status(201).send({ data: user });
    }
  );

  // GET /api/v1/tenant/pipeline-stages
  fastify.get(
    "/tenant/pipeline-stages",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const stages = await prisma.pipelineStage.findMany({
        where: { tenantId: request.tenantId },
        orderBy: { position: "asc" },
      });
      return { data: stages };
    }
  );

  // POST /api/v1/tenant/pipeline-stages
  fastify.post(
    "/tenant/pipeline-stages",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const body = z.object({
        name: z.string().min(1).max(100),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        position: z.number().int().min(0),
        slaHours: z.number().int().optional(),
      }).parse(request.body);

      const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const stage = await prisma.pipelineStage.create({
        data: {
          tenantId: request.tenantId,
          ...body,
          slug,
        },
      });
      return { data: stage };
    }
  );
}
