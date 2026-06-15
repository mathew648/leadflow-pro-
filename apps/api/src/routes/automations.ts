import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const stepSchema = z.object({
  type: z.enum(["send_email", "send_sms", "send_whatsapp", "wait", "assign_user", "update_field", "create_task", "webhook"]),
  position: z.number().int().min(0),
  config: z.record(z.unknown()),
  delayMinutes: z.number().int().min(0).default(0),
  condition: z.record(z.unknown()).optional(),
});

export default async function automationsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/automations
  fastify.get(
    "/automations",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const workflows = await prisma.automationWorkflow.findMany({
        where: { tenantId: request.tenantId, deletedAt: null },
        include: {
          steps: { orderBy: { position: "asc" } },
          _count: { select: { executions: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return { data: workflows };
    }
  );

  // POST /api/v1/automations
  fastify.post(
    "/automations",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const body = z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        triggerType: z.enum([
          "lead_created", "lead_stage_changed", "lead_assigned",
          "quote_sent", "quote_viewed", "quote_approved", "quote_rejected",
          "job_created", "job_started", "job_completed",
          "invoice_sent", "invoice_paid", "invoice_overdue",
          "customer_created", "review_requested",
        ]),
        triggerConditions: z.record(z.unknown()).optional(),
        steps: z.array(stepSchema).min(1),
        isActive: z.boolean().default(true),
      }).parse(request.body);

      const workflow = await prisma.$transaction(async (tx) => {
        const workflow = await tx.automationWorkflow.create({
          data: {
            tenantId: request.tenantId,
            name: body.name,
            description: body.description,
            triggerType: body.triggerType as any,
            triggerConfig: (body.triggerConditions ?? {}) as any,
            isActive: body.isActive,
            createdById: request.userId,
          },
        });

        await tx.workflowStep.createMany({
          data: body.steps.map((step) => ({
            tenantId: request.tenantId,
            workflowId: workflow.id,
            type: step.type,
            position: step.position,
            config: {
              ...((step.config as any) ?? {}),
              delayMinutes: step.delayMinutes,
              condition: step.condition ?? {},
            } as any,
          })),
        });

        return workflow;
      });

      return reply.status(201).send({ data: workflow });
    }
  );

  // GET /api/v1/automations/:id
  fastify.get(
    "/automations/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const workflow = await prisma.automationWorkflow.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          steps: { orderBy: { position: "asc" } },
          executions: {
            orderBy: { startedAt: "desc" },
            take: 20,
            select: { id: true, status: true, triggerEntityType: true, triggerEntityId: true, startedAt: true, completedAt: true, errorMessage: true },
          },
        },
      });
      if (!workflow) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Automation not found" } });
      }
      return { data: workflow };
    }
  );

  // PATCH /api/v1/automations/:id
  fastify.patch(
    "/automations/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        triggerConditions: z.record(z.unknown()).optional(),
        steps: z.array(stepSchema).optional(),
      }).parse(request.body);

      const workflow = await prisma.automationWorkflow.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!workflow) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Automation not found" } });
      }

      await prisma.$transaction(async (tx) => {
        await tx.automationWorkflow.update({
          where: { id },
          data: {
            name: body.name,
            description: body.description,
            isActive: body.isActive,
            triggerConfig: body.triggerConditions as any,
          },
        });

        if (body.steps) {
          await tx.workflowStep.deleteMany({ where: { workflowId: id } });
          await tx.workflowStep.createMany({
            data: body.steps.map((step) => ({
              tenantId: request.tenantId,
              workflowId: id,
              type: step.type,
              position: step.position,
              config: {
                ...((step.config as any) ?? {}),
                delayMinutes: step.delayMinutes,
                condition: step.condition ?? {},
              } as any,
            })),
          });
        }
      });

      return { data: { updated: true } };
    }
  );

  // DELETE /api/v1/automations/:id
  fastify.delete(
    "/automations/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const workflow = await prisma.automationWorkflow.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!workflow) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Automation not found" } });
      }
      await prisma.automationWorkflow.update({ where: { id }, data: { deletedAt: new Date() } });
      return reply.status(204).send();
    }
  );

  // GET /api/v1/automations/templates
  fastify.get(
    "/automations/templates",
    { preHandler: [fastify.authenticate] },
    async () => {
      const templates = [
        {
          id: "new-lead-sms",
          name: "New Lead SMS Response",
          description: "Send instant SMS to new leads to confirm we received their enquiry",
          triggerType: "lead_created",
          steps: [
            {
              type: "send_sms",
              position: 0,
              delayMinutes: 0,
              config: {
                message: "Hi {{lead.firstName}}, thanks for reaching out to {{tenant.name}}! We've received your enquiry and will be in touch shortly. — {{tenant.phone}}",
              },
            },
          ],
        },
        {
          id: "quote-follow-up",
          name: "Quote Follow-up Sequence",
          description: "Follow up 2 days and 5 days after sending a quote",
          triggerType: "quote_sent",
          steps: [
            {
              type: "wait",
              position: 0,
              delayMinutes: 2880, // 2 days
              config: {},
            },
            {
              type: "send_email",
              position: 1,
              delayMinutes: 0,
              config: {
                subject: "Just following up — {{quote.quoteNumber}}",
                template: "quote_followup_1",
              },
            },
            {
              type: "wait",
              position: 2,
              delayMinutes: 4320, // 3 more days
              config: {},
            },
            {
              type: "send_sms",
              position: 3,
              delayMinutes: 0,
              config: {
                message: "Hi {{lead.firstName}}, just wanted to check if you had any questions about our quote. Happy to discuss! — {{tenant.name}}",
              },
            },
          ],
        },
        {
          id: "job-complete-review",
          name: "Post-Job Review Request",
          description: "Request a Google review 2 hours after job is completed",
          triggerType: "job_completed",
          steps: [
            {
              type: "wait",
              position: 0,
              delayMinutes: 120,
              config: {},
            },
            {
              type: "send_sms",
              position: 1,
              delayMinutes: 0,
              config: {
                message: "Hi {{customer.firstName}}, hope the job went well! We'd love it if you could leave us a Google review — it only takes 2 mins: {{tenant.googleReviewUrl}}. Thanks! 🙏",
              },
            },
          ],
        },
        {
          id: "invoice-overdue",
          name: "Overdue Invoice Reminder",
          description: "Remind customers about unpaid invoices",
          triggerType: "invoice_overdue",
          steps: [
            {
              type: "send_email",
              position: 0,
              delayMinutes: 0,
              config: {
                subject: "Payment reminder — Invoice {{invoice.invoiceNumber}}",
                template: "invoice_overdue",
              },
            },
            {
              type: "wait",
              position: 1,
              delayMinutes: 2880, // 2 days
              config: {},
            },
            {
              type: "send_sms",
              position: 2,
              delayMinutes: 0,
              config: {
                message: "Hi {{customer.firstName}}, this is a reminder that Invoice {{invoice.invoiceNumber}} for ${{invoice.amountDue}} is overdue. Please pay at: {{invoice.portalUrl}}",
              },
            },
          ],
        },
      ];

      return { data: templates };
    }
  );
}
