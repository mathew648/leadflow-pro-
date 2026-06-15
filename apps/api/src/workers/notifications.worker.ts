import { Worker, Job } from "bullmq";
import { createWorkerConnection } from "../lib/redis.js";
import { QUEUES } from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";
import { sendBrandedEmail } from "../lib/mailer.js";
import { config } from "../config.js";

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
