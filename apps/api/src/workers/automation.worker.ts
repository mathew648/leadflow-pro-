import { Worker, Job } from "bullmq";
import { createWorkerConnection } from "../lib/redis.js";
import { QUEUES, AutomationJobPayload, enqueueEmail, enqueueSms, enqueueDelayed } from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";
import { interpolateTemplate } from "../services/sms.service.js";

async function buildTemplateVars(tenantId: string, entityType: string, entityId: string): Promise<Record<string, string>> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { businessName: true, phone: true, email: true, primaryColor: true },
  });

  const vars: Record<string, string> = {
    "tenant.name": tenant?.businessName ?? "",
    "tenant.phone": tenant?.phone ?? "",
    "tenant.email": tenant?.email ?? "",
  };

  if (entityType === "lead") {
    const lead = await prisma.lead.findUnique({
      where: { id: entityId },
      select: { firstName: true, lastName: true, phone: true, email: true, source: true },
    });
    if (lead) {
      vars["lead.firstName"] = lead.firstName;
      vars["lead.lastName"] = lead.lastName ?? "";
      vars["lead.phone"] = lead.phone ?? "";
      vars["lead.email"] = lead.email ?? "";
    }
  }

  if (entityType === "customer") {
    const customer = await prisma.customer.findUnique({
      where: { id: entityId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    });
    if (customer) {
      vars["customer.firstName"] = customer.firstName ?? "";
      vars["customer.lastName"] = customer.lastName ?? "";
      vars["customer.phone"] = customer.phone ?? "";
      vars["customer.email"] = customer.email ?? "";
    }
  }

  if (entityType === "job") {
    const job = await prisma.job.findUnique({
      where: { id: entityId },
      select: { jobNumber: true, title: true, customer: { select: { firstName: true, lastName: true, phone: true, email: true } } },
    });
    if (job) {
      vars["job.number"] = job.jobNumber;
      vars["job.title"] = job.title;
      vars["customer.firstName"] = job.customer?.firstName ?? "";
      vars["customer.lastName"] = job.customer?.lastName ?? "";
      vars["customer.phone"] = job.customer?.phone ?? "";
      vars["customer.email"] = job.customer?.email ?? "";
    }
  }

  if (entityType === "quote") {
    const quote = await prisma.quote.findUnique({
      where: { id: entityId },
      select: { quoteNumber: true, totalCents: true, portalToken: true, customer: { select: { firstName: true, phone: true, email: true } } },
    });
    if (quote) {
      vars["quote.number"] = quote.quoteNumber;
      vars["quote.quoteNumber"] = quote.quoteNumber;
      vars["quote.total"] = `$${(quote.totalCents / 100).toFixed(2)}`;
      vars["quote.portalUrl"] = `${process.env.APP_URL ?? ""}/quotes/${quote.portalToken}`;
      vars["customer.firstName"] = quote.customer?.firstName ?? "";
      vars["customer.phone"] = quote.customer?.phone ?? "";
      vars["customer.email"] = quote.customer?.email ?? "";
    }
  }

  if (entityType === "invoice") {
    const invoice = await prisma.invoice.findUnique({
      where: { id: entityId },
      select: { invoiceNumber: true, totalCents: true, amountDueCents: true, portalToken: true, dueDate: true, customer: { select: { firstName: true, phone: true, email: true } } },
    });
    if (invoice) {
      vars["invoice.invoiceNumber"] = invoice.invoiceNumber;
      vars["invoice.total"] = `$${(invoice.totalCents / 100).toFixed(2)}`;
      vars["invoice.amountDue"] = `$${(invoice.amountDueCents / 100).toFixed(2)}`;
      vars["invoice.portalUrl"] = `${process.env.APP_URL ?? ""}/pay/${invoice.portalToken}`;
      vars["invoice.dueDate"] = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-AU") : "";
      vars["customer.firstName"] = invoice.customer?.firstName ?? "";
      vars["customer.phone"] = invoice.customer?.phone ?? "";
      vars["customer.email"] = invoice.customer?.email ?? "";
    }
  }

  return vars;
}

async function executeStep(
  step: any,
  execution: any,
  tenantId: string,
  entityType: string,
  entityId: string,
  entityData: Record<string, unknown>
) {
  const templateVars = await buildTemplateVars(tenantId, entityType, entityId);
  const mergedVars = { ...templateVars, ...Object.fromEntries(
    Object.entries(entityData).map(([k, v]) => [k, String(v ?? "")])
  )};

  switch (step.type) {
    case "send_sms": {
      const phone = mergedVars["customer.phone"] || mergedVars["lead.phone"];
      if (phone) {
        const message = interpolateTemplate(String(step.config.message ?? ""), mergedVars);
        await enqueueSms({ tenantId, to: phone, body: message });
      }
      break;
    }

    case "send_email": {
      const email = mergedVars["customer.email"] || mergedVars["lead.email"];
      if (email) {
        const body = interpolateTemplate(String(step.config.message ?? step.config.body ?? ""), mergedVars);
        await enqueueEmail({
          tenantId,
          template: String(step.config.template ?? "custom"),
          to: email,
          subject: interpolateTemplate(String(step.config.subject ?? "Message from us"), mergedVars),
          data: { ...mergedVars, businessName: mergedVars["tenant.name"], body },
        });
      }
      break;
    }

    case "update_field": {
      const { model, field, value } = step.config as { model: string; field: string; value: string };
      if (model === "lead" && entityType === "lead") {
        await prisma.lead.update({ where: { id: entityId }, data: { [field]: value } });
      }
      break;
    }

    case "assign_user": {
      const { userId } = step.config as { userId: string };
      if (entityType === "lead") {
        await prisma.lead.update({ where: { id: entityId }, data: { assignedToId: userId } });
      } else if (entityType === "job") {
        await prisma.job.update({ where: { id: entityId }, data: { leadTechnicianId: userId } });
      }
      break;
    }

    case "webhook": {
      const { url, method = "POST" } = step.config as { url: string; method?: string };
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, entityType, entityId, data: mergedVars }),
      }).catch((err) => console.error("[automation-worker] Webhook failed:", err.message));
      break;
    }
  }
}

export function startAutomationWorker() {
  const worker = new Worker<AutomationJobPayload>(
    QUEUES.AUTOMATIONS,
    async (job: Job<AutomationJobPayload>) => {
      const { tenantId, triggerType, entityType, entityId, entityData = {} } = job.data;

      // Find matching active workflows for this trigger
      const workflows = await prisma.automationWorkflow.findMany({
        where: {
          tenantId,
          isActive: true,
          deletedAt: null,
          triggerType: triggerType as any,
        },
        include: { steps: { orderBy: { position: "asc" } } },
      });

      for (const workflow of workflows) {
        const execution = await prisma.workflowExecution.create({
          data: {
            tenantId,
            workflowId: workflow.id,
            triggerEntityType: entityType,
            triggerEntityId: entityId,
            status: "running",
            startedAt: new Date(),
          },
        });

        try {
          let cumulativeDelayMs = 0;

          for (const step of workflow.steps) {
            const delayMinutes = Number((step.config as any)?.delayMinutes ?? 0);
            if (delayMinutes > 0) {
              cumulativeDelayMs += delayMinutes * 60000;
              await enqueueDelayed(QUEUES.AUTOMATIONS, `step-${step.id}`, {
                tenantId,
                triggerType: "step_execute",
                entityType,
                entityId,
                entityData: { ...entityData, __stepId: step.id, __executionId: execution.id },
              }, cumulativeDelayMs);
            } else {
              await executeStep(step, execution, tenantId, entityType, entityId, entityData);
            }
          }

          await prisma.workflowExecution.update({
            where: { id: execution.id },
            data: { status: "completed", completedAt: new Date() },
          });
        } catch (err: any) {
          await prisma.workflowExecution.update({
            where: { id: execution.id },
            data: { status: "failed", errorMessage: err.message },
          });
        }
      }

      return { workflows: workflows.length };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 10,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[automation-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
