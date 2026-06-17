import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { generatePortalToken, calculateLineItem, calculateTotals } from "../lib/utils.js";
import { enqueueAutomation, enqueueEmail, enqueuePdf, QUEUES, enqueueDelayed, enqueueAccountingSync } from "../lib/queue.js";
import { auditFromRequest } from "../lib/audit.js";
import { sendBrandedEmail } from "../lib/mailer.js";
import { notifyBusiness } from "../lib/notify.js";
import { config } from "../config.js";

export default async function invoicesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/invoices
  fastify.get(
    "/invoices",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        status: z.string().optional(),
        customerId: z.string().uuid().optional(),
        overdue: z.coerce.boolean().optional(),
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
        ...(query.customerId && { customerId: query.customerId }),
        ...(query.overdue && {
          status: { in: ["sent", "partial"] },
          dueDate: { lt: new Date() },
        }),
        ...(query.dateFrom || query.dateTo
          ? { issueDate: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            }}
          : {}),
        ...(query.search && {
          OR: [
            { invoiceNumber: { contains: query.search, mode: "insensitive" } },
            { customer: { firstName: { contains: query.search, mode: "insensitive" } } },
            { customer: { lastName: { contains: query.search, mode: "insensitive" } } },
          ],
        }),
      };

      const [invoices, total, summary] = await prisma.$transaction([
        prisma.invoice.findMany({
          where,
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
            job: { select: { id: true, jobNumber: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
          take: query.limit,
          skip: query.offset,
        }),
        prisma.invoice.count({ where }),
        prisma.invoice.aggregate({
          where: { tenantId: request.tenantId, deletedAt: null },
          _sum: { totalCents: true, amountDueCents: true },
        }),
      ]);

      return {
        data: invoices,
        meta: { total, limit: query.limit, offset: query.offset },
        summary: {
          totalOutstandingCents: summary._sum.amountDueCents ?? 0,
          totalInvoicedCents: summary._sum.totalCents ?? 0,
        },
      };
    }
  );

  // POST /api/v1/invoices
  fastify.post(
    "/invoices",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const body = z.object({
        customerId: z.string().uuid(),
        propertyId: z.string().uuid().optional(),
        jobId: z.string().uuid().optional(),
        quoteId: z.string().uuid().optional(),
        invoiceType: z.enum(["deposit", "progress", "final", "credit_note"]).default("final"),
        issueDate: z.string().datetime().optional(),
        dueDate: z.string().datetime().optional(),
        notes: z.string().optional(),
        termsConditions: z.string().optional(),
        lineItems: z.array(z.object({
          description: z.string().min(1),
          catalogItemId: z.string().uuid().optional(),
          quantity: z.number().positive(),
          unit: z.string().optional(),
          unitPriceCents: z.number().int().min(0),
          discountPercent: z.number().min(0).max(100).default(0),
          gstRate: z.number().min(0).max(1),
          position: z.number().int().min(0),
        })).min(1),
      }).parse(request.body);

      const customer = await prisma.customer.findFirst({
        where: { id: body.customerId, tenantId: request.tenantId, deletedAt: null },
      });
      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: request.tenantId },
      });

      const lineItemsCalc = body.lineItems.map((li) => calculateLineItem(
        li.quantity,
        li.unitPriceCents,
        li.gstRate,
        li.discountPercent
      ));

      const totals = calculateTotals(body.lineItems);

      const invoiceNumber = `${settings?.invoicePrefix ?? "INV"}-${new Date().getFullYear()}-${String(
        settings?.invoiceNextNumber ?? 1001
      ).padStart(5, "0")}`;

      const dueDate = body.dueDate
        ? new Date(body.dueDate)
        : new Date(Date.now() + (settings?.invoicePaymentTerms ?? 14) * 86400000);

      const portalToken = generatePortalToken();

      const invoice = await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            tenantId: request.tenantId,
            invoiceNumber,
            customerId: body.customerId,
            propertyId: body.propertyId,
            jobId: body.jobId,
            quoteId: body.quoteId,
            invoiceType: body.invoiceType,
            subtotalCents: totals.subtotalCents,
            discountCents: totals.discountCents,
            gstCents: totals.gstCents,
            totalCents: totals.totalCents,
            amountDueCents: totals.totalCents,
            currency: "AUD",
            issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
            dueDate,
            customerNotes: body.notes,
            internalNotes: body.termsConditions ?? settings?.invoiceFooterText,
            status: "draft",
            portalToken,
            createdById: request.userId,
          },
        });

        await tx.invoiceLineItem.createMany({
          data: body.lineItems.map((li, idx) => ({
            tenantId: request.tenantId,
            invoiceId: invoice.id,
            catalogItemId: li.catalogItemId,
            description: li.description,
            quantity: li.quantity,
            unit: li.unit,
            unitPriceCents: li.unitPriceCents,
            gstRate: li.gstRate,
            discountPercent: li.discountPercent,
            subtotalCents: lineItemsCalc[idx].subtotalCents,
            discountCents: lineItemsCalc[idx].discountCents,
            gstCents: lineItemsCalc[idx].gstCents,
            totalCents: lineItemsCalc[idx].totalCents,
            position: li.position,
          })),
        });

        await tx.tenantSettings.update({
          where: { tenantId: request.tenantId },
          data: { invoiceNextNumber: { increment: 1 } },
        });

        return invoice;
      });

      auditFromRequest(request, "create", "invoice", invoice.id).catch(() => {});

      return reply.status(201).send({ data: invoice });
    }
  );

  // GET /api/v1/invoices/:id
  fastify.get(
    "/invoices/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          customer: true,
          job: { select: { id: true, jobNumber: true, title: true } },
          lineItems: { orderBy: { position: "asc" } },
          payments: { orderBy: { createdAt: "desc" } },
        },
      });

      if (!invoice) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found" } });
      }

      return { data: invoice };
    }
  );

  // POST /api/v1/invoices/:id/send
  fastify.post(
    "/invoices/:id/send",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        email: z.string().email().optional(),
        message: z.string().optional(),
        sendSms: z.boolean().default(false),
      }).parse(request.body ?? {});

      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          customer: true,
          tenant: { include: { settings: true } },
          lineItems: { orderBy: { position: "asc" } },
        },
      });

      if (!invoice) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found" } });
      }

      const recipientEmail = body.email ?? invoice.customer.email;
      if (!recipientEmail) {
        return reply.status(422).send({
          error: { code: "NO_EMAIL", message: "Customer has no email address. Provide one explicitly." },
        });
      }

      await prisma.invoice.update({
        where: { id },
        data: { status: "sent", sentAt: new Date() },
      });

      await sendBrandedEmail({
        tenantId: request.tenantId,
        tenant: invoice.tenant,
        to: recipientEmail,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        subject: `Invoice ${invoice.invoiceNumber} — ${invoice.tenant.businessName}`,
        template: "invoice",
        data: {
          invoiceNumber: invoice.invoiceNumber,
          customerName: `${invoice.customer.firstName} ${invoice.customer.lastName ?? ""}`.trim(),
          totalCents: invoice.totalCents,
          dueDate: invoice.dueDate?.toISOString(),
          portalUrl: `${config.APP_URL}/pay/${invoice.portalToken}`,
          customMessage: body.message,
        },
      });

      // Generate the PDF for download (the email above already carries the portal link)
      await enqueuePdf({
        tenantId: request.tenantId,
        type: "invoice",
        entityId: id,
      });

      await enqueueAutomation({
        tenantId: request.tenantId,
        triggerType: "invoice_sent",
        entityType: "invoice",
        entityId: id,
      });

      // Mirror the invoice into the connected accounting system (no-op if not connected).
      await enqueueAccountingSync({
        tenantId: request.tenantId,
        provider: "xero",
        entityType: "invoice",
        entityId: id,
        action: "create",
      });

      // Schedule overdue reminders
      if (invoice.dueDate) {
        const daysUntilDue = Math.round(
          (invoice.dueDate.getTime() - Date.now()) / 86400000
        );
        if (daysUntilDue > 1) {
          const reminderMs = (daysUntilDue - 1) * 86400000;
          await enqueueDelayed(QUEUES.NOTIFICATIONS, "invoice-due-soon", {
            tenantId: request.tenantId,
            invoiceId: id,
            customerId: invoice.customerId,
            email: recipientEmail,
          }, reminderMs);
        }
      }

      auditFromRequest(request, "send", "invoice", id).catch(() => {});

      return { data: { sent: true, sentTo: recipientEmail } };
    }
  );

  // POST /api/v1/invoices/:id/payments
  fastify.post(
    "/invoices/:id/payments",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        amountCents: z.number().int().positive(),
        gateway: z.enum(["stripe", "windcave", "paypal", "manual"]).default("manual"),
        reference: z.string().optional(),
        notes: z.string().optional(),
        paidAt: z.string().datetime().optional(),
      }).parse(request.body);

      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: { customer: true, tenant: true },
      });
      if (!invoice) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found" } });
      }
      if (invoice.amountDueCents <= 0) {
        return reply.status(409).send({
          error: { code: "ALREADY_PAID", message: "Invoice is already fully paid" },
        });
      }

      const actualAmount = Math.min(body.amountCents, invoice.amountDueCents);
      const newAmountDue = invoice.amountDueCents - actualAmount;
      const newStatus = newAmountDue <= 0 ? "paid" : "partial";

      const [payment] = await prisma.$transaction([
        prisma.payment.create({
          data: {
            tenantId: request.tenantId,
            invoiceId: id,
            customerId: invoice.customerId,
            amountCents: actualAmount,
            currency: invoice.currency,
            paymentGateway: body.gateway as any,
            gatewayTransactionId: body.reference,
            notes: body.notes,
            status: "completed",
            paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
          },
        }),
        prisma.invoice.update({
          where: { id },
          data: {
            amountDueCents: newAmountDue,
            amountPaidCents: { increment: actualAmount },
            status: newStatus,
            ...(newStatus === "paid" ? { lastPaymentAt: new Date() } : {}),
          },
        }),
      ]);

      if (newStatus === "paid") {
        await enqueueAutomation({
          tenantId: request.tenantId,
          triggerType: "invoice_paid",
          entityType: "invoice",
          entityId: id,
        });
      }

      // Push the payment to the connected accounting system (no-op if not connected).
      await enqueueAccountingSync({
        tenantId: request.tenantId,
        provider: "xero",
        entityType: "payment",
        entityId: id,
        action: "create",
      });

      notifyBusiness(request.tenantId, "payment_received", {
        summary: `Payment of <b>$${(actualAmount / 100).toFixed(2)}</b> recorded for invoice ${invoice.invoiceNumber}${newStatus === "paid" ? " (now fully paid)" : ""}.`,
        link: `/invoices/${id}`,
      }).catch(() => {});

      // Email the customer a payment receipt (logged to Message history)
      if (invoice.customer.email) {
        await sendBrandedEmail({
          tenantId: request.tenantId,
          tenant: invoice.tenant,
          to: invoice.customer.email,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          subject: `Payment received — Invoice ${invoice.invoiceNumber}`,
          template: "payment_receipt",
          data: {
            customerName: `${invoice.customer.firstName} ${invoice.customer.lastName ?? ""}`.trim(),
            invoiceNumber: invoice.invoiceNumber,
            amountCents: actualAmount,
            paidAt: (body.paidAt ? new Date(body.paidAt) : new Date()).toISOString(),
          },
        }).catch(() => {});
      }

      auditFromRequest(request, "create", "payment", payment.id).catch(() => {});

      return reply.status(201).send({ data: payment });
    }
  );

  // GET /api/v1/invoices/portal/:token  — public
  fastify.get(
    "/invoices/portal/:token",
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const invoice = await prisma.invoice.findFirst({
        where: { portalToken: token, deletedAt: null },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
          lineItems: { orderBy: { position: "asc" } },
          payments: { where: { status: "completed" }, select: { amountCents: true, paidAt: true, paymentGateway: true } },
          tenant: { select: { businessName: true, logoUrl: true, phone: true, email: true, abn: true, primaryColor: true } },
        },
      });

      if (!invoice) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found" } });
      }

      // Track first view
      if (!invoice.firstViewedAt) {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { firstViewedAt: new Date() } });
      }

      // Strip internal data
      const { portalToken: _, ...safeInvoice } = invoice;
      return { data: safeInvoice };
    }
  );

  // GET /api/v1/invoices/:id/pdf
  fastify.get(
    "/invoices/:id/pdf",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        select: { pdfUrl: true, invoiceNumber: true },
      });

      if (!invoice) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found" } });
      }

      if (!invoice.pdfUrl) {
        // Queue PDF generation if not yet available
        await enqueuePdf({ tenantId: request.tenantId, type: "invoice", entityId: id });
        return reply.status(202).send({ data: { status: "generating" } });
      }

      return { data: { url: invoice.pdfUrl } };
    }
  );

  // DELETE /api/v1/invoices/:id
  fastify.delete(
    "/invoices/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!invoice) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found" } });
      }
      if (invoice.status === "paid") {
        return reply.status(409).send({
          error: { code: "INVOICE_PAID", message: "Cannot delete a paid invoice. Issue a credit note instead." },
        });
      }
      await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
      auditFromRequest(request, "delete", "invoice", id).catch(() => {});
      return reply.status(204).send();
    }
  );
}
