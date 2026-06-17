import { Worker, Job } from "bullmq";
import { createWorkerConnection } from "../lib/redis.js";
import { QUEUES, enqueueSms } from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";
import { sendBrandedEmail } from "../lib/mailer.js";
import { config } from "../config.js";

function reviewLink(settings: { googleReviewUrl?: string | null; googlePlaceId?: string | null } | null): string | null {
  if (settings?.googleReviewUrl) return settings.googleReviewUrl;
  if (settings?.googlePlaceId) return `https://search.google.com/local/writereview?placeid=${settings.googlePlaceId}`;
  return null;
}

interface InvoiceReminderPayload {
  tenantId: string;
  invoiceId: string;
  customerId: string;
  email?: string;
}

/**
 * Processes delayed notification jobs. Currently handles invoice payment
 * reminders scheduled when an invoice is sent (see routes/invoices.ts). Each
 * reminder re-checks the invoice is still unpaid before emailing the customer.
 */
export function startNotificationsWorker() {
  const worker = new Worker(
    QUEUES.NOTIFICATIONS,
    async (job: Job) => {
      if (job.name === "invoice-due-soon" || job.name === "invoice-overdue") {
        const data = job.data as InvoiceReminderPayload;

        const invoice = await prisma.invoice.findFirst({
          where: { id: data.invoiceId, tenantId: data.tenantId, deletedAt: null },
          include: { customer: true, tenant: true },
        });

        // Skip if the invoice is gone, paid, or written off.
        if (!invoice) return { skipped: "not_found" };
        if (invoice.amountDueCents <= 0) return { skipped: "paid" };
        if (["paid", "cancelled", "written_off"].includes(invoice.status)) {
          return { skipped: invoice.status };
        }

        const to = data.email ?? invoice.customer.email;
        if (!to) return { skipped: "no_email" };

        const isOverdue = invoice.dueDate ? new Date(invoice.dueDate) < new Date() : false;

        await sendBrandedEmail({
          tenantId: invoice.tenantId,
          tenant: invoice.tenant,
          to,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          subject: isOverdue
            ? `Overdue: Invoice ${invoice.invoiceNumber}`
            : `Payment reminder — Invoice ${invoice.invoiceNumber}`,
          template: "invoice_overdue",
          data: {
            customerName: `${invoice.customer.firstName} ${invoice.customer.lastName ?? ""}`.trim(),
            invoiceNumber: invoice.invoiceNumber,
            amountDueCents: invoice.amountDueCents,
            portalUrl: `${config.APP_URL}/pay/${invoice.portalToken}`,
          },
        });

        // Record which reminder fired so we don't double-send.
        const stamp = !invoice.reminder1SentAt
          ? { reminder1SentAt: new Date() }
          : !invoice.reminder2SentAt
            ? { reminder2SentAt: new Date() }
            : { reminder3SentAt: new Date() };
        await prisma.invoice.update({ where: { id: invoice.id }, data: stamp }).catch(() => {});

        return { sent: true, to };
      }

      if (job.name === "review-request") {
        const data = job.data as { tenantId: string; customerId: string; jobId: string };
        const [tenant, settings, customer] = await Promise.all([
          prisma.tenant.findUnique({ where: { id: data.tenantId } }),
          prisma.tenantSettings.findUnique({ where: { tenantId: data.tenantId } }),
          prisma.customer.findUnique({ where: { id: data.customerId } }),
        ]);
        if (!tenant || !customer) return { skipped: "not_found" };
        if (!settings?.autoSendReviewRequest) return { skipped: "disabled" };
        const url = reviewLink(settings);
        if (!url) return { skipped: "no_review_link" };

        const firstName = customer.firstName ?? "there";
        let channels = 0;

        if (customer.email) {
          await sendBrandedEmail({
            tenantId: tenant.id,
            tenant,
            to: customer.email,
            customerId: customer.id,
            subject: `How did we do? — ${tenant.businessName}`,
            template: "review_request",
            data: { customerName: firstName, reviewUrl: url, businessName: tenant.businessName },
          }).catch(() => {});
          channels += 1;
        }
        if (customer.phone) {
          await enqueueSms({
            tenantId: tenant.id,
            to: customer.phone,
            body: `Hi ${firstName}, thanks for choosing ${tenant.businessName}! If you were happy with the work, we'd really appreciate a quick review: ${url}`,
          });
          channels += 1;
        }
        return { sent: channels > 0, channels };
      }

      return { skipped: "unknown_job" };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[notifications-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
