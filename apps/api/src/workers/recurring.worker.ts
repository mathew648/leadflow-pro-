import { Worker } from "bullmq";
import { createWorkerConnection } from "../lib/redis.js";
import { getQueue, QUEUES } from "../lib/queue.js";
import { generateDueAgreements } from "../lib/recurring.js";

/**
 * Daily scan that turns due recurring/maintenance service agreements into jobs
 * (and optional draft invoices). A repeatable BullMQ job fires once a day.
 */
export function startRecurringWorker() {
  const connection = createWorkerConnection();

  const worker = new Worker(
    QUEUES.RECURRING,
    async () => {
      const created = await generateDueAgreements();
      console.log(`[recurring] generated ${created} maintenance job(s)`);
      return { created };
    },
    { connection }
  );

  // Register the daily repeatable scan (idempotent — BullMQ dedupes by repeat key).
  getQueue(QUEUES.RECURRING)
    .add("scan", {}, { repeat: { pattern: "0 2 * * *" }, jobId: "recurring-daily-scan" })
    .catch((e) => console.error("[recurring] failed to schedule daily scan:", e));

  return worker;
}
