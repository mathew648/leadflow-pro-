import { prisma } from "./prisma.js";
import { enqueueEmail, enqueueSms } from "./queue.js";
import { config } from "../config.js";

/**
 * Internal "business alert" notifications — i.e. telling the tradie about activity
 * (new lead, quote viewed/approved, payment in). These are gated by the per-tenant
 * toggles in TenantSettings (which previously existed in the UI but did nothing).
 *
 * Distinct from the customer-facing automations: those message the customer, these
 * message the business owner.
 */
export type BusinessEvent = "new_lead" | "quote_viewed" | "quote_approved" | "payment_received";

interface NotifyContext {
  /** One-line summary shown in the alert body. */
  summary: string;
  /** In-app path to deep-link to (e.g. "/leads/<id>"). */
  link?: string;
  /** Optional SMS text — only sent for new_lead, when notifyNewLeadSms is on. */
  sms?: string;
}

const EMAIL_TOGGLE: Record<BusinessEvent, string> = {
  new_lead: "notifyNewLeadEmail",
  quote_viewed: "notifyQuoteViewed",
  quote_approved: "notifyQuoteApproved",
  payment_received: "notifyPaymentReceived",
};

const SUBJECT: Record<BusinessEvent, string> = {
  new_lead: "New lead",
  quote_viewed: "A customer viewed your quote",
  quote_approved: "Quote approved 🎉",
  payment_received: "Payment received 💰",
};

/**
 * Sends a business alert if the relevant tenant toggle is enabled. Never throws —
 * callers fire-and-forget so a notification failure can't break the main request.
 */
export async function notifyBusiness(tenantId: string, event: BusinessEvent, ctx: NotifyContext): Promise<void> {
  try {
    const [settings, tenant] = await Promise.all([
      prisma.tenantSettings.findUnique({ where: { tenantId } }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { email: true, phone: true, businessName: true, primaryColor: true, logoUrl: true },
      }),
    ]);
    if (!tenant) return;

    const settingsRec = settings as Record<string, unknown> | null;
    const emailOn = (settingsRec?.[EMAIL_TOGGLE[event]] ?? true) as boolean;
    const url = `${config.APP_URL}${ctx.link ?? ""}`;

    if (emailOn && tenant.email) {
      await enqueueEmail({
        tenantId,
        to: tenant.email,
        subject: `${SUBJECT[event]} — ${tenant.businessName}`,
        template: "custom",
        data: {
          body: `${ctx.summary}<br/><br/><a href="${url}">Open in LeadFlow Pro →</a>`,
          businessName: tenant.businessName,
          primaryColor: tenant.primaryColor,
          logoUrl: tenant.logoUrl,
        },
      });
    }

    if (event === "new_lead" && ctx.sms && settingsRec?.notifyNewLeadSms && tenant.phone) {
      await enqueueSms({ tenantId, to: tenant.phone, body: ctx.sms });
    }
  } catch {
    /* business alerts are best-effort; never block the originating request */
  }
}
