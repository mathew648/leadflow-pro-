import type { Prisma, PrismaClient } from "@lfp/db";

/**
 * The starter automations every new tenant gets so notifications "just work" on day one.
 * All use only triggers the app actually fires (lead_created, quote_sent, quote_approved)
 * and template variables resolved by the automation worker's buildTemplateVars().
 *
 * Steps are email + SMS. SMS only delivers once the tenant configures a sender, but the
 * step is harmless until then (it just enqueues). delayMinutes spaces out follow-ups.
 */
export interface DefaultStep {
  type: "send_email" | "send_sms";
  config: Record<string, unknown>;
}

export interface DefaultAutomation {
  name: string;
  description: string;
  triggerType: "lead_created" | "quote_sent" | "quote_approved";
  steps: DefaultStep[];
}

export const DEFAULT_AUTOMATIONS: DefaultAutomation[] = [
  {
    name: "New enquiry — instant reply",
    description: "Emails and texts a new lead the moment they come in, so they hear back fast.",
    triggerType: "lead_created",
    steps: [
      {
        type: "send_email",
        config: {
          subject: "Thanks for your enquiry, {{lead.firstName}}",
          message:
            "Hi {{lead.firstName}},<br/><br/>Thanks for getting in touch with {{tenant.name}}. " +
            "We've received your enquiry and will be in contact very shortly.<br/><br/>" +
            "If it's urgent, call us on {{tenant.phone}}.<br/><br/>Cheers,<br/>{{tenant.name}}",
        },
      },
      {
        type: "send_sms",
        config: {
          message:
            "Hi {{lead.firstName}}, thanks for contacting {{tenant.name}}. " +
            "We'll be in touch shortly. For urgent jobs call {{tenant.phone}}.",
        },
      },
    ],
  },
  {
    name: "Quote follow-up (2 days)",
    description: "Sends a friendly nudge 2 days after a quote is sent if the customer hasn't responded.",
    triggerType: "quote_sent",
    steps: [
      {
        type: "send_email",
        config: {
          delayMinutes: 2880,
          subject: "Following up on your quote {{quote.quoteNumber}}",
          message:
            "Hi {{customer.firstName}},<br/><br/>Just checking in on the quote we sent " +
            "({{quote.quoteNumber}}, {{quote.total}}). Happy to answer any questions or adjust it.<br/><br/>" +
            "You can review and approve it here: {{quote.portalUrl}}<br/><br/>Cheers,<br/>{{tenant.name}}",
        },
      },
      {
        type: "send_sms",
        config: {
          delayMinutes: 2880,
          message:
            "Hi {{customer.firstName}}, following up on your quote {{quote.quoteNumber}} from " +
            "{{tenant.name}}. Review & approve here: {{quote.portalUrl}}",
        },
      },
    ],
  },
  {
    name: "Quote approved — thank you",
    description: "Thanks the customer and confirms next steps the moment they approve a quote.",
    triggerType: "quote_approved",
    steps: [
      {
        type: "send_email",
        config: {
          subject: "Thanks for approving your quote!",
          message:
            "Hi {{customer.firstName}},<br/><br/>Thanks for approving quote {{quote.quoteNumber}}. " +
            "We'll be in touch shortly to lock in a time that suits you.<br/><br/>Cheers,<br/>{{tenant.name}}",
        },
      },
    ],
  },
];

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Seeds the default automation pack for a tenant. Active by default and flagged isSystem
 * so the UI can present them as built-in. Safe to call inside a transaction.
 */
export async function seedDefaultAutomations(tx: Tx, tenantId: string): Promise<void> {
  for (const wf of DEFAULT_AUTOMATIONS) {
    await tx.automationWorkflow.create({
      data: {
        tenantId,
        name: wf.name,
        description: wf.description,
        triggerType: wf.triggerType,
        isActive: true,
        isSystem: true,
        steps: {
          create: wf.steps.map((step, index) => ({
            tenantId,
            position: index,
            type: step.type,
            config: step.config as Prisma.InputJsonValue,
          })),
        },
      },
    });
  }
}
