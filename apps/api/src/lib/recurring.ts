import { prisma } from "./prisma.js";
import { calculateLineItem, calculateTotals, generatePortalToken } from "./utils.js";

/** Advance a date by N periods of the given recurrence frequency. */
export function advanceDate(date: Date, frequency: string, intervalCount = 1): Date {
  const d = new Date(date);
  const n = Math.max(1, intervalCount);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7 * n); break;
    case "fortnightly": d.setDate(d.getDate() + 14 * n); break;
    case "monthly": d.setMonth(d.getMonth() + n); break;
    case "quarterly": d.setMonth(d.getMonth() + 3 * n); break;
    case "biannually": d.setMonth(d.getMonth() + 6 * n); break;
    case "annually": d.setFullYear(d.getFullYear() + n); break;
    default: d.setMonth(d.getMonth() + n);
  }
  return d;
}

/**
 * Generate the next job (and optional draft invoice) for a service agreement,
 * then advance its schedule. Used by the daily worker and the "run now" action.
 */
export async function generateJobForAgreement(agreementId: string): Promise<{ jobId: string } | null> {
  const sa = await prisma.serviceAgreement.findUnique({ where: { id: agreementId } });
  if (!sa || sa.status !== "active") return null;

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: sa.tenantId } });
  const jobNumber = `${settings?.jobPrefix ?? "JOB"}-${new Date().getFullYear()}-${String(
    (settings?.jobNextNumber ?? 1000) + Math.floor(Math.random() * 9000)
  ).padStart(4, "0")}`;

  const job = await prisma.job.create({
    data: {
      tenantId: sa.tenantId,
      jobNumber,
      customerId: sa.customerId,
      propertyId: sa.propertyId ?? undefined,
      title: sa.title,
      description: sa.description ?? undefined,
      status: "pending",
      priority: "normal",
      scheduledStart: sa.nextRunAt,
      assignedUserIds: sa.assignedUserId ? [sa.assignedUserId] : [],
      leadTechnicianId: sa.assignedUserId ?? undefined,
      quotedAmountCents: sa.priceCents,
      customerNotes: "Auto-created from a recurring maintenance agreement.",
    },
  });

  // Optionally raise a draft invoice for the service.
  if (sa.autoInvoice && sa.priceCents > 0) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: sa.tenantId }, select: { country: true } });
      const gstRate = tenant?.country === "NZ" ? 0.15 : 0.10;
      const calc = calculateLineItem(1, sa.priceCents, gstRate, 0);
      const totals = calculateTotals([{ quantity: 1, unitPriceCents: sa.priceCents, gstRate, discountPercent: 0 }]);
      const invoiceNumber = `${settings?.invoicePrefix ?? "INV"}-${new Date().getFullYear()}-${String(
        settings?.invoiceNextNumber ?? 1001
      ).padStart(5, "0")}`;
      await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            tenantId: sa.tenantId,
            invoiceNumber,
            customerId: sa.customerId,
            propertyId: sa.propertyId ?? undefined,
            jobId: job.id,
            invoiceType: "final",
            subtotalCents: totals.subtotalCents,
            discountCents: totals.discountCents,
            gstCents: totals.gstCents,
            totalCents: totals.totalCents,
            amountDueCents: totals.totalCents,
            currency: tenant?.country === "NZ" ? "NZD" : "AUD",
            issueDate: new Date(),
            dueDate: new Date(Date.now() + (settings?.invoicePaymentTerms ?? 14) * 86400000),
            status: "draft",
            portalToken: generatePortalToken(),
          },
        });
        await tx.invoiceLineItem.create({
          data: {
            tenantId: sa.tenantId, invoiceId: inv.id, description: sa.title,
            quantity: 1, unitPriceCents: sa.priceCents, gstRate, discountPercent: 0,
            subtotalCents: calc.subtotalCents, discountCents: calc.discountCents,
            gstCents: calc.gstCents, totalCents: calc.totalCents, position: 0,
          },
        });
        if (settings) {
          await tx.tenantSettings.update({ where: { tenantId: sa.tenantId }, data: { invoiceNextNumber: { increment: 1 } } });
        }
      });
    } catch (e) {
      console.error(`[recurring] auto-invoice failed for agreement ${sa.id}:`, e);
    }
  }

  await prisma.serviceAgreement.update({
    where: { id: sa.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: advanceDate(sa.nextRunAt, sa.frequency, sa.intervalCount),
      jobsCreated: { increment: 1 },
    },
  });

  return { jobId: job.id };
}

/** Find all active agreements that are due and generate their jobs. Returns count generated. */
export async function generateDueAgreements(): Promise<number> {
  const due = await prisma.serviceAgreement.findMany({
    where: { status: "active", nextRunAt: { lte: new Date() } },
    select: { id: true },
    take: 1000,
  });
  let created = 0;
  for (const { id } of due) {
    try {
      const r = await generateJobForAgreement(id);
      if (r) created++;
    } catch (e) {
      console.error(`[recurring] agreement ${id} failed:`, e);
    }
  }
  return created;
}
