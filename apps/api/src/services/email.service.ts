import { Resend } from "resend";
import { config } from "../config.js";
import type { EmailPayload } from "../lib/queue.js";

const resend = new Resend(config.RESEND_API_KEY);

const FROM = config.EMAIL_FROM;

function renderTemplate(template: string, data: Record<string, unknown>): { html: string; text: string } {
  const businessName = String(data.businessName ?? "LeadFlow Pro");
  const primaryColor = String(data.primaryColor ?? "#2563EB");
  const logoUrl = data.logoUrl ? String(data.logoUrl) : "";
  const businessPhone = data.businessPhone ? String(data.businessPhone) : "";
  const businessEmail = data.businessEmail ? String(data.businessEmail) : "";

  const header = `
  <div style="background:${primaryColor};padding:24px 32px;">
    ${logoUrl
      ? `<img src="${logoUrl}" alt="${businessName}" style="max-height:44px;max-width:220px;display:block;"/>`
      : `<h1 style="color:#fff;margin:0;font-size:22px;font-family:sans-serif;">${businessName}</h1>`}
  </div>`;

  const contactLine = [businessPhone, businessEmail].filter(Boolean).join(" &nbsp;•&nbsp; ");
  const footer = `
  <div style="background:#F3F4F6;padding:16px 32px;text-align:center;font-size:12px;color:#6B7280;font-family:sans-serif;">
    ${contactLine ? `<p style="margin:0 0 4px;">${contactLine}</p>` : ""}
    <p style="margin:0;">This email was sent by ${businessName}.</p>
  </div>`;

  let body = "";

  switch (template) {
    case "quote": {
      const { customerName, quoteNumber, validUntil, totalCents, portalUrl, customMessage } = data;
      const total = typeof totalCents === "number" ? `$${(totalCents / 100).toFixed(2)}` : "";
      body = `
      <p style="font-size:16px;">Hi ${customerName},</p>
      <p>Thank you for your enquiry. Please find your quote <strong>${quoteNumber}</strong> attached.</p>
      ${customMessage ? `<p>${customMessage}</p>` : ""}
      <p><strong>Total: ${total}</strong></p>
      ${validUntil ? `<p>This quote is valid until ${new Date(validUntil as string).toLocaleDateString()}.</p>` : ""}
      <p style="text-align:center;margin:32px 0;">
        <a href="${portalUrl}" style="background:${primaryColor};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
          View & Approve Quote
        </a>
      </p>`;
      break;
    }

    case "invoice": {
      const { customerName, invoiceNumber, totalCents, dueDate, portalUrl, customMessage } = data;
      const total = typeof totalCents === "number" ? `$${(totalCents / 100).toFixed(2)}` : "";
      body = `
      <p style="font-size:16px;">Hi ${customerName},</p>
      <p>Please find your invoice <strong>${invoiceNumber}</strong> for <strong>${total}</strong>.</p>
      ${customMessage ? `<p>${customMessage}</p>` : ""}
      ${dueDate ? `<p>Payment is due by <strong>${new Date(dueDate as string).toLocaleDateString()}</strong>.</p>` : ""}
      <p style="text-align:center;margin:32px 0;">
        <a href="${portalUrl}" style="background:${primaryColor};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
          View & Pay Invoice
        </a>
      </p>`;
      break;
    }

    case "invoice_overdue": {
      const { customerName, invoiceNumber, amountDueCents, portalUrl } = data;
      const amount = typeof amountDueCents === "number" ? `$${(amountDueCents / 100).toFixed(2)}` : "";
      body = `
      <p style="font-size:16px;">Hi ${customerName},</p>
      <p>This is a friendly reminder that invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> is now overdue.</p>
      <p>Please pay at your earliest convenience to avoid any service interruptions.</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${portalUrl}" style="background:#EF4444;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
          Pay Now
        </a>
      </p>`;
      break;
    }

    case "quote_followup_1": {
      const { customerName, quoteNumber, portalUrl } = data;
      body = `
      <p style="font-size:16px;">Hi ${customerName},</p>
      <p>We just wanted to follow up on quote <strong>${quoteNumber}</strong> we sent you recently.</p>
      <p>Do you have any questions or would you like to make any changes? We're happy to chat!</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${portalUrl}" style="background:${primaryColor};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
          View Quote
        </a>
      </p>`;
      break;
    }

    case "document_ready": {
      const { customerName, documentType, documentUrl } = data;
      const label = documentType === "invoice" ? "invoice" : "quote";
      body = `
      <p style="font-size:16px;">Hi ${customerName ?? "there"},</p>
      <p>Your ${label} is ready to view and download.</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${documentUrl}" style="background:${primaryColor};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
          View ${label.charAt(0).toUpperCase() + label.slice(1)}
        </a>
      </p>`;
      break;
    }

    case "welcome": {
      const { firstName, loginUrl } = data;
      body = `
      <p style="font-size:16px;">Welcome aboard, ${firstName ?? "there"}!</p>
      <p>Your ${businessName} account is ready. You can now manage leads, quotes, jobs and invoices all in one place.</p>
      <p>Your 14-day free trial has started — no credit card required.</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}" style="background:${primaryColor};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
          Open Dashboard
        </a>
      </p>`;
      break;
    }

    case "payment_receipt": {
      const { customerName, invoiceNumber, amountCents, paidAt } = data;
      const amount = typeof amountCents === "number" ? `$${(amountCents / 100).toFixed(2)}` : "";
      body = `
      <p style="font-size:16px;">Hi ${customerName ?? "there"},</p>
      <p>Thank you — we've received your payment of <strong>${amount}</strong> for invoice <strong>${invoiceNumber}</strong>.</p>
      ${paidAt ? `<p>Payment date: ${new Date(paidAt as string).toLocaleDateString("en-AU")}</p>` : ""}
      <p>This email is your receipt. We appreciate your business!</p>`;
      break;
    }

    case "job_scheduled": {
      const { customerName, jobNumber, jobTitle, scheduledStart } = data;
      body = `
      <p style="font-size:16px;">Hi ${customerName ?? "there"},</p>
      <p>Your job <strong>${jobTitle ?? jobNumber}</strong> has been scheduled.</p>
      ${scheduledStart ? `<p><strong>When:</strong> ${new Date(scheduledStart as string).toLocaleString("en-AU")}</p>` : ""}
      <p>We'll be in touch if anything changes. See you then!</p>`;
      break;
    }

    case "job_completed": {
      const { customerName, jobTitle, jobNumber } = data;
      body = `
      <p style="font-size:16px;">Hi ${customerName ?? "there"},</p>
      <p>Your job <strong>${jobTitle ?? jobNumber}</strong> is now complete.</p>
      <p>Thank you for choosing ${businessName}. If you were happy with the work, we'd love a review!</p>`;
      break;
    }

    case "custom": {
      body = `<div style="padding:8px 0;">${String(data.body ?? "")}</div>`;
      break;
    }

    default:
      body = `<div style="padding:8px 0;">${String(data.body ?? "")}</div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
      <tr><td>${header}</td></tr>
      <tr><td style="padding:32px;">${body}</td></tr>
      <tr><td>${footer}</td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;

  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { html, text };
}

export async function sendEmail(payload: EmailPayload): Promise<{ id: string }> {
  let html: string;
  let text: string;

  if (payload.html) {
    html = payload.html;
    text = payload.text ?? payload.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } else {
    const rendered = renderTemplate(payload.template ?? "custom", payload.data ?? {});
    html = rendered.html;
    text = rendered.text;
  }

  const result = await resend.emails.send({
    from: payload.from ?? FROM,
    to: payload.to,
    subject: payload.subject,
    html,
    text,
    replyTo: payload.replyTo,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return { id: result.data!.id };
}
