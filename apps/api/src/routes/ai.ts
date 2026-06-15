import { FastifyInstance } from "fastify";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";

function getClient() {
  return new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
}

export default async function aiRoutes(fastify: FastifyInstance) {
  // POST /api/v1/ai/chat  — AI Trade Assistant (streaming)
  fastify.post(
    "/ai/chat",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({
        message: z.string().min(1).max(2000),
        history: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).default([]),
        context: z.object({
          jobId: z.string().uuid().optional(),
          customerId: z.string().uuid().optional(),
          leadId: z.string().uuid().optional(),
        }).optional(),
      }).parse(request.body);

      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        select: { businessName: true, tradeTypes: true, country: true, currency: true },
      });

      // Gather context if entity IDs are provided
      let contextBlock = "";
      if (body.context?.jobId) {
        const job = await prisma.job.findFirst({
          where: { id: body.context.jobId, tenantId: request.tenantId },
          select: { title: true, description: true, status: true, priority: true, scheduledStart: true },
        });
        if (job) contextBlock += `\nCurrent Job: ${JSON.stringify(job)}`;
      }

      const ai = getClient();
      const stream = ai.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: `You are an AI assistant for ${tenant?.businessName ?? "a trades business"} in ${tenant?.country ?? "Australia"}.
You specialise in trades: ${(tenant?.tradeTypes ?? []).join(", ") || "electrical, plumbing, HVAC"}.
Help with: job pricing, customer communication, compliance, scheduling, and business growth.
Currency: ${tenant?.currency ?? "AUD"}. Be concise, practical, and industry-specific.
${contextBlock}`,
        messages: [
          ...body.history.map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: body.message },
        ],
      });

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          reply.raw.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }
      reply.raw.write("data: [DONE]\n\n");
      reply.raw.end();
    }
  );

  // POST /api/v1/ai/score-lead  — score a single lead on demand
  fastify.post(
    "/ai/score-lead",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { leadId } = z.object({ leadId: z.string().uuid() }).parse(request.body);

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, tenantId: request.tenantId, deletedAt: null },
        include: { activities: { orderBy: { createdAt: "desc" }, take: 10 } },
      });
      if (!lead) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Lead not found" } });
      }

      const ai = getClient();
      const response = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{
          role: "user",
          content: `Score this trades lead 0-100 and provide a short reason (max 20 words).
Lead: name=${lead.firstName} ${lead.lastName}, source=${lead.source}, urgency=${lead.urgency},
jobType=${lead.serviceCategory ?? lead.serviceRequired ?? "unknown"}, estimatedValue=${lead.estimatedValueCents ? `$${lead.estimatedValueCents / 100}` : "unknown"},
notes=${lead.notes ?? "none"}, activities=${lead.activities.length}.
Respond with JSON only: {"score": number, "reason": "string"}`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "{}";
      let parsed: { score: number; reason: string };
      try {
        parsed = JSON.parse(text.trim());
      } catch {
        parsed = { score: 50, reason: "Could not determine score" };
      }

      parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

      await prisma.lead.update({
        where: { id: leadId },
        data: { aiScore: parsed.score, aiNextAction: parsed.reason, aiScoredAt: new Date() },
      });

      return { data: parsed };
    }
  );

  // POST /api/v1/ai/generate-quote-description
  fastify.post(
    "/ai/generate-quote-description",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({
        jobType: z.string(),
        tradeType: z.string(),
        customerNotes: z.string().optional(),
        lineItemNames: z.array(z.string()).default([]),
      }).parse(request.body);

      const ai = getClient();
      const response = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Write a professional quote description for a ${body.tradeType} job.
Job type: ${body.jobType}
Customer notes: ${body.customerNotes ?? "none"}
Items included: ${body.lineItemNames.join(", ") || "standard work"}
Write 2-3 sentences, professional tone, no pricing details. Plain text only.`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return { data: { description: text.trim() } };
    }
  );

  // POST /api/v1/ai/suggest-reply
  fastify.post(
    "/ai/suggest-reply",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({
        customerMessage: z.string().min(1).max(1000),
        channel: z.enum(["sms", "email"]),
        context: z.string().optional(),
      }).parse(request.body);

      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        select: { businessName: true, tradeTypes: true },
      });

      const ai = getClient();
      const response = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are a ${(tenant?.tradeTypes ?? []).join("/")} business (${tenant?.businessName}).
Generate a brief, professional ${body.channel === "sms" ? "SMS reply (max 160 chars)" : "email reply (2-3 sentences)"} to this customer message:
"${body.customerMessage}"
${body.context ? `Context: ${body.context}` : ""}
Reply text only, no labels or explanations.`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return { data: { suggestion: text.trim() } };
    }
  );

  // GET /api/v1/ai/insights  — AI business insights
  fastify.get(
    "/ai/insights",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

      const [leadStats, jobStats, revenueStats] = await prisma.$transaction([
        prisma.lead.groupBy({
          by: ["source"],
          where: { tenantId: request.tenantId, deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
          _count: true,
          orderBy: { _count: { source: "desc" } },
        }),
        prisma.job.aggregate({
          where: { tenantId: request.tenantId, deletedAt: null, completedAt: { gte: thirtyDaysAgo } },
          _count: true,
          _avg: { customerSatisfaction: true },
        }),
        prisma.payment.aggregate({
          where: { tenantId: request.tenantId, status: "completed", paidAt: { gte: thirtyDaysAgo } },
          _sum: { amountCents: true },
        }),
      ]);

      const ai = getClient();
      const response = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Analyse this 30-day trades business data and give 3 specific, actionable insights (bullet points):
Leads by source: ${JSON.stringify(leadStats)}
Jobs completed: ${jobStats._count}, Avg satisfaction: ${jobStats._avg.customerSatisfaction?.toFixed(1) ?? "N/A"}/5
Revenue: $${((revenueStats._sum?.amountCents ?? 0) / 100).toFixed(0)}
Respond with 3 bullet points, each max 30 words. Plain text bullets starting with "•".`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const insights = text.trim().split("\n").filter((l) => l.startsWith("•")).map((l) => l.slice(1).trim());

      return { data: { insights } };
    }
  );
}
