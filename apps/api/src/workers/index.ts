import { startEmailWorker } from "./email.worker.js";
import { startSmsWorker } from "./sms.worker.js";
import { startPdfWorker } from "./pdf.worker.js";
import { startAIScoringWorker } from "./ai-scoring.worker.js";
import { startAutomationWorker } from "./automation.worker.js";
import { startNotificationsWorker } from "./notifications.worker.js";
import { startAccountingSyncWorker } from "./accounting-sync.worker.js";

export function startAllWorkers() {
  const workers = [
    startEmailWorker(),
    startSmsWorker(),
    startPdfWorker(),
    startAIScoringWorker(),
    startAutomationWorker(),
    startNotificationsWorker(),
    startAccountingSyncWorker(),
  ];

  console.log(`[workers] Started ${workers.length} BullMQ workers`);

  async function shutdown() {
    console.log("[workers] Shutting down workers...");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return workers;
}
