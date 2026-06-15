import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { initSentry } from "./lib/sentry.js";

initSentry();

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`🚀 API running on http://${config.HOST}:${config.PORT}`);
    if (config.NODE_ENV !== "test") {
      const { startAllWorkers } = await import("./workers/index.js");
      startAllWorkers();
    }
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
