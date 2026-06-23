import puppeteer from "puppeteer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";

function getR2(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: config.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

async function uploadPdf(key: string, buffer: Buffer): Promise<string> {
  const r2 = getR2();
  await r2.send(new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: "application/pdf",
    CacheControl: "private, max-age=86400",
  }));
  return `${config.R2_PUBLIC_URL}/${key}`;
}

async function renderHtml(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function formatMoney(cents: number, currency = "AUD"): string {
  const locale = currency === "NZD" ? "en-NZ" : "en-AU";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

// Full supplier details for a compliant AU/NZ tax invoice: business name, address,
// contact, and the correct tax identifiers (NZ → GST Number + NZBN; AU → ABN + GST No.).
function businessDetailsHtml(tenant: any): string {
  const addr = [
    tenant.streetAddress,
    [tenant.suburb, tenant.city].filter(Boolean).join(", "),
    [tenant.state, tenant.postcode].filter(Boolean).join(" "),
  ].filter((l) => l && String(l).trim());
  const isNZ = String(tenant.country ?? "AU").toUpperCase() === "NZ";
  const ids: string[] = [];
  if (isNZ) {
    if (tenant.taxNumber) ids.push(`GST Number: ${tenant.taxNumber}`);
    if (tenant.nzbn) ids.push(`NZBN: ${tenant.nzbn}`);
  } else {
    if (tenant.abn) ids.push(`ABN: ${tenant.abn}`);
    if (tenant.taxNumber) ids.push(`GST No: ${tenant.taxNumber}`);
  }
  return `
    <h1>${tenant.businessName}</h1>
    ${addr.map((l) => `<p>${l}</p>`).join("")}
    ${tenant.phone ? `<p>${tenant.phone}</p>` : ""}
    ${tenant.email ? `<p>${tenant.email}</p>` : ""}
    ${tenant.websiteUrl ? `<p>${tenant.websiteUrl}</p>` : ""}
    ${ids.map((t) => `<p style="font-weight:600;">${t}</p>`).join("")}
  `;
}

function buildQuoteHtml(quote: any, tenant: any): string {
  const lineItems = quote.lineItems
    .map((li: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${li.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">${Number(li.quantity)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;">${formatMoney(li.unitPriceCents)}</td>
        ${li.discountCents > 0 ? `<td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;color:#EF4444;">-${formatMoney(li.discountCents)}</td>` : `<td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">—</td>`}
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:600;">${formatMoney(li.totalCents)}</td>
      </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 0; font-size: 13px; }
  .header { background: ${tenant.primaryColor ?? "#2563EB"}; color: white; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { margin: 0; font-size: 26px; }
  .header p { margin: 4px 0 0; opacity: 0.85; font-size: 13px; }
  .badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
  .body { padding: 32px 40px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin: 0 0 8px; }
  .section p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #F9FAFB; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; border-bottom: 2px solid #E5E7EB; }
  .totals { margin-left: auto; width: 280px; margin-top: 16px; }
  .totals tr td { padding: 6px 12px; }
  .totals tr.total td { font-weight: 700; font-size: 15px; border-top: 2px solid #E5E7EB; padding-top: 10px; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #9CA3AF; }
</style>
</head>
<body>
<div class="header">
  <div>
    ${businessDetailsHtml(tenant)}
  </div>
  <div style="text-align:right;">
    <div class="badge">QUOTE</div>
    <p style="font-size:22px;font-weight:700;margin-top:8px;">${quote.quoteNumber}</p>
    <p>Issued: ${new Date(quote.createdAt).toLocaleDateString("en-AU")}</p>
    ${quote.validUntil ? `<p>Valid until: ${new Date(quote.validUntil).toLocaleDateString("en-AU")}</p>` : ""}
  </div>
</div>
<div class="body">
  <div class="grid">
    <div class="section">
      <h3>Quote For</h3>
      <p><strong>${quote.customer.firstName} ${quote.customer.lastName}</strong></p>
      ${quote.customer.companyName ? `<p>${quote.customer.companyName}</p>` : ""}
      ${quote.customer.phone ? `<p>${quote.customer.phone}</p>` : ""}
      ${quote.customer.email ? `<p>${quote.customer.email}</p>` : ""}
    </div>
    ${quote.property ? `
    <div class="section">
      <h3>Service Location</h3>
      <p>${quote.property.streetAddress}</p>
      <p>${quote.property.suburb ?? ""} ${quote.property.state ?? ""} ${quote.property.postcode ?? ""}</p>
    </div>` : ""}
  </div>
  ${quote.description ? `<p style="background:#F9FAFB;padding:12px 16px;border-radius:8px;margin-bottom:24px;">${quote.description}</p>` : ""}
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Discount</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${lineItems}</tbody>
  </table>
  <table class="totals">
    <tr><td style="color:#6B7280;">Subtotal</td><td style="text-align:right;">${formatMoney(quote.subtotalCents)}</td></tr>
    ${quote.discountCents > 0 ? `<tr><td style="color:#EF4444;">Discount</td><td style="text-align:right;color:#EF4444;">-${formatMoney(quote.discountCents)}</td></tr>` : ""}
    <tr><td style="color:#6B7280;">GST</td><td style="text-align:right;">${formatMoney(quote.gstCents)}</td></tr>
    <tr class="total"><td>Total (incl. GST)</td><td style="text-align:right;">${formatMoney(quote.totalCents)}</td></tr>
  </table>
  ${quote.termsConditions ? `<div class="footer"><h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;">Terms & Conditions</h3><p>${quote.termsConditions}</p></div>` : ""}
</div>
</body>
</html>`;
}

function buildInvoiceHtml(invoice: any, tenant: any): string {
  const lineItems = invoice.lineItems
    .map((li: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${li.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">${Number(li.quantity)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;">${formatMoney(li.unitPriceCents)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;">${formatMoney(li.gstCents)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:600;">${formatMoney(li.totalCents)}</td>
      </tr>`)
    .join("");

  const isOverdue = invoice.status !== "paid" && invoice.dueDate && new Date(invoice.dueDate) < new Date();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 0; font-size: 13px; }
  .header { background: ${tenant.primaryColor ?? "#2563EB"}; color: white; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { margin: 0; font-size: 26px; }
  .badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
  .overdue { background: #EF4444 !important; }
  .body { padding: 32px 40px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #F9FAFB; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; border-bottom: 2px solid #E5E7EB; }
  .totals { margin-left: auto; width: 280px; margin-top: 16px; }
  .totals tr td { padding: 6px 12px; }
  .totals tr.total td { font-weight: 700; font-size: 15px; border-top: 2px solid #E5E7EB; padding-top: 10px; }
  .paid-stamp { color: #10B981; font-size: 48px; font-weight: 900; border: 6px solid #10B981; display: inline-block; padding: 4px 24px; transform: rotate(-12deg); opacity: 0.4; margin: 16px 0; }
</style>
</head>
<body>
<div class="header">
  <div>
    ${businessDetailsHtml(tenant)}
  </div>
  <div style="text-align:right;">
    <div class="badge ${isOverdue ? "overdue" : ""}">TAX INVOICE</div>
    <p style="font-size:22px;font-weight:700;margin-top:8px;">${invoice.invoiceNumber}</p>
    <p>Issued: ${new Date(invoice.issueDate).toLocaleDateString("en-AU")}</p>
    ${invoice.dueDate ? `<p style="${isOverdue ? "color:#FCA5A5;" : ""}">Due: ${new Date(invoice.dueDate).toLocaleDateString("en-AU")}${isOverdue ? " (OVERDUE)" : ""}</p>` : ""}
  </div>
</div>
<div class="body">
  ${invoice.status === "paid" ? '<div style="text-align:right;"><span class="paid-stamp">PAID</span></div>' : ""}
  <div class="grid">
    <div class="section">
      <h3>Bill To</h3>
      <p><strong>${invoice.customer.firstName} ${invoice.customer.lastName}</strong></p>
      ${invoice.customer.companyName ? `<p>${invoice.customer.companyName}</p>` : ""}
      ${invoice.customer.phone ? `<p>${invoice.customer.phone}</p>` : ""}
      ${invoice.customer.email ? `<p>${invoice.customer.email}</p>` : ""}
    </div>
    ${invoice.property ? `
    <div class="section">
      <h3>Service Location</h3>
      <p>${invoice.property.streetAddress}</p>
      <p>${invoice.property.suburb ?? ""} ${invoice.property.state ?? ""} ${invoice.property.postcode ?? ""}</p>
    </div>` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">GST</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${lineItems}</tbody>
  </table>
  <table class="totals">
    <tr><td style="color:#6B7280;">Subtotal (excl. GST)</td><td style="text-align:right;">${formatMoney(invoice.subtotalCents)}</td></tr>
    <tr><td style="color:#6B7280;">GST</td><td style="text-align:right;">${formatMoney(invoice.gstCents)}</td></tr>
    <tr class="total"><td>Total (incl. GST)</td><td style="text-align:right;">${formatMoney(invoice.totalCents)}</td></tr>
    ${invoice.amountPaidCents > 0 ? `<tr><td style="color:#10B981;">Amount Paid</td><td style="text-align:right;color:#10B981;">-${formatMoney(invoice.amountPaidCents)}</td></tr>` : ""}
    ${invoice.amountDueCents > 0 ? `<tr style="background:#FEF2F2;"><td style="font-weight:700;">Amount Due</td><td style="text-align:right;font-weight:700;color:#EF4444;">${formatMoney(invoice.amountDueCents)}</td></tr>` : ""}
  </table>
  ${tenant.settings?.invoiceBankDetails ? `
  <div style="margin-top:32px;padding:16px;background:#F9FAFB;border-radius:8px;">
    <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin:0 0 8px;">Payment Details</h3>
    ${Object.entries(tenant.settings.invoiceBankDetails).map(([k, v]) => `<p style="margin:4px 0;"><strong>${k}:</strong> ${v}</p>`).join("")}
  </div>` : ""}
  ${invoice.customerNotes ? `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;"><p>${invoice.customerNotes}</p></div>` : ""}
</div>
</body>
</html>`;
}

export async function generateQuotePdf(quoteId: string, tenantId: string): Promise<string> {
  const [quote, tenant] = await Promise.all([
    prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: { customer: true, property: true, lineItems: { orderBy: { position: "asc" } } },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, include: { settings: true } }),
  ]);

  if (!quote || !tenant) throw new Error("Quote or tenant not found");

  const html = buildQuoteHtml(quote, tenant);
  const buffer = await renderHtml(html);
  const key = `${tenantId}/pdfs/quotes/${quote.quoteNumber}.pdf`;
  const url = await uploadPdf(key, buffer);

  await prisma.quote.update({ where: { id: quoteId }, data: { pdfUrl: url } });

  return url;
}

export async function generateInvoicePdf(invoiceId: string, tenantId: string): Promise<string> {
  const [invoice, tenant] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { customer: true, lineItems: { orderBy: { position: "asc" } } },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, include: { settings: true } }),
  ]);

  if (!invoice || !tenant) throw new Error("Invoice or tenant not found");

  const html = buildInvoiceHtml(invoice, tenant);
  const buffer = await renderHtml(html);
  const key = `${tenantId}/pdfs/invoices/${invoice.invoiceNumber}.pdf`;
  const url = await uploadPdf(key, buffer);

  await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: url } });

  return url;
}
