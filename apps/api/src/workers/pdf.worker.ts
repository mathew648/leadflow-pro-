import { Worker, Job } from "bullmq";
import { createWorkerConnection } from "../lib/redis.js";
import { QUEUES, PdfPayload } from "../lib/queue.js";
import { generateQuotePdf, generateInvoicePdf } from "../services/pdf.service.js";
import { enqueueEmail } from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";

export function startPdfWorker() {
  const worker = new Worker<PdfPayload>(
    QUEUES.PDF_GENERATION,
    async (job: Job<PdfPayload>) => {
      const { data } = job;

      let url: string;

      if (data.type === "quote") {
        url = await generateQuotePdf(data.entityId, data.tenantId);
      } else {
        url = await generateInvoicePdf(data.entityId, data.tenantId);
      }

      // Send PDF link via email if requested
      if (data.sendToEmail) {
        const entity = data.type === "quote"
          ? await prisma.quote.findUnique({ where: { id: data.entityId }, select: { quoteNumber: true, customer: { select: { firstName: true } } } })
          : await prisma.invoice.findUnique({ where: { id: data.entityId }, select: { invoiceNumber: true, customer: { select: { firstName: true } } } });

        if (entity) {
          await enqueueEmail({
            tenantId: data.tenantId,
            template: "document_ready",
            to: data.sendToEmail,
            subject: `Your ${data.type} is ready`,
            data: {
              documentUrl: url,
              documentType: data.type,
            },
          });
        }
      }

      return { url };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 2, // puppeteer is memory-heavy
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[pdf-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
