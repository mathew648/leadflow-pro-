import { prisma } from "./prisma.js";
import { enqueueEmail } from "./queue.js";

/** Minimal tenant shape needed to brand an outbound email. */
export interface TenantBranding {
  businessName: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** Maps a tenant record to the branding fields consumed by email templates. */
export function brandingData(tenant: TenantBranding): Record<string, unknown> {
  return {
    businessName: tenant.businessName,
    primaryColor: tenant.primaryColor ?? undefined,
    logoUrl: tenant.logoUrl ?? undefined,
    businessPhone: tenant.phone ?? undefined,
    businessEmail: tenant.email ?? undefined,
  };
}

interface SendBrandedEmailOptions {
  tenantId: string;
  tenant: TenantBranding;
  to: string;
  subject: string;
  template: string;
  data?: Record<string, unknown>;
  customerId?: string;
  leadId?: string;
  invoiceId?: string;
  jobId?: string;
}

/**
 * Enqueues a branded email (tenant logo, colours, contact details, reply-to set
 * to the business email) and records it in the Message table so the send appears
 * in the customer's communication history. Returns the Message id.
 */
export async function sendBrandedEmail(opts: SendBrandedEmailOptions): Promise<string | null> {
  const message = await prisma.message
    .create({
      data: {
        tenantId: opts.tenantId,
        channel: "email",
        direction: "outbound",
        subject: opts.subject,
        body: opts.subject,
        toEmail: opts.to,
        fromEmail: opts.tenant.email ?? undefined,
        customerId: opts.customerId,
        leadId: opts.leadId,
        invoiceId: opts.invoiceId,
        jobId: opts.jobId,
        status: "queued",
      },
    })
    .catch(() => null);

  await enqueueEmail({
    tenantId: opts.tenantId,
    to: opts.to,
    subject: opts.subject,
    template: opts.template,
    replyTo: opts.tenant.email ?? undefined,
    messageId: message?.id,
    data: { ...brandingData(opts.tenant), ...(opts.data ?? {}) },
  });

  return message?.id ?? null;
}
