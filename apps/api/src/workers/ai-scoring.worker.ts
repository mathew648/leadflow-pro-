import { Worker, Job } from "bullmq";
import Anthropic from "@anthropic-ai/sdk";
import { createWorkerConnection } from "../lib/redis.js";
import { QUEUES, AIScoringPayload } from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";

export function startAIScoringWorker() {
  const worker = new Worker<AIScoringPayload>(
    QUEUES.AI_SCORING,
    async (job: Job<AIScoringPayload>) => {
      const { leadId } = job.data;

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          firstName: true, lastName: true, source: true, urgency: true,
          serviceCategory: true, serviceRequired: true, estimatedValueCents: true, notes: true,
          activities: { select: { type: true }, take: 10 },
        },
      });

      if (!lead) return { skipped: true };

      const ai = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

      const response = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Score this trades business lead 0-100. Higher = better quality/more likely to convert.
Factors: source quality, urgency, job value, completeness of info.
Lead: source=${lead.source}, urgency=${lead.urgency}, jobType=${lead.serviceCategory ?? lead.serviceRequired ?? "unknown"},
estimatedValue=${lead.estimatedValueCents ? "$" + lead.estimatedValueCents / 100 : "unknown"},
hasNotes=${!!lead.notes}, activities=${lead.activities.length}.
Respond with JSON only: {"score": number, "reason": "brief reason max 15 words"}`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "{}";
      let parsed: { score: number; reason: string };
      try {
        parsed = JSON.parse(text.trim());
      } catch {
        parsed = { score: 50, reason: "Automated score" };
      }
      parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

      await prisma.lead.update({
        where: { id: leadId },
        data: { aiScore: parsed.score, aiNextAction: parsed.reason, aiScoredAt: new Date() },
      });

      return parsed;
    },
    {
      connection: createWorkerConnection(),
      concurrency: 5,
      limiter: { max: 50, duration: 60000 },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[ai-scoring-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
