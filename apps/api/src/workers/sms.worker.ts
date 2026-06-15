import { Worker, Job } from "bullmq";
import { createWorkerConnection } from "../lib/redis.js";
import { QUEUES, SmsPayload } from "../lib/queue.js";
import { sendSms } from "../services/sms.service.js";
import { prisma } from "../lib/prisma.js";

export function startSmsWorker() {
  const worker = new Worker<SmsPayload>(
    QUEUES.SMS,
    async (job: Job<SmsPayload>) => {
      const { data } = job;

      try {
        const result = await sendSms({ to: data.to, body: data.body });

        if (data.messageId) {
          await prisma.message.update({
            where: { id: data.messageId },
            data: { status: "sent", gatewayMessageId: result.messageId, sentAt: new Date() },
          }).catch(() => {});
        }

        return { sent: true, messageId: result.messageId };
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
      concurrency: 5,
      limiter: { max: 30, duration: 1000 }, // 30/sec Vonage limit
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[sms-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
