import { Worker, Job } from "bullmq";
import { createWorkerConnection } from "../lib/redis.js";
import { QUEUES, EmailPayload } from "../lib/queue.js";
import { sendEmail } from "../services/email.service.js";
import { prisma } from "../lib/prisma.js";

export function startEmailWorker() {
  const worker = new Worker<EmailPayload>(
    QUEUES.EMAIL,
    async (job: Job<EmailPayload>) => {
      const { data } = job;

      try {
        const result = await sendEmail(data);

        // Update message status if tracked
        if (data.messageId) {
          await prisma.message.update({
            where: { id: data.messageId },
            data: { status: "sent", gatewayMessageId: result.id, sentAt: new Date() },
          }).catch(() => {});
        }

        return { sent: true, messageId: result.id };
      } catch (err: any) {
        if (data.messageId) {
          await prisma.message.update({
            where: { id: data.messageId },
            data: { status: "failed" },
          }).catch(() => {});
        }
        throw err;
      }
    },
    {
      connection: createWorkerConnection(),
      concurrency: 10,
      limiter: { max: 100, duration: 60000 }, // 100/min
    }
  );

  worker.on("completed", (job) => {
    console.log(`[email-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[email-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
