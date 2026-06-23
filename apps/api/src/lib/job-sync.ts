import type { Prisma, PrismaClient } from "@lfp/db";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Copy a quote's line items onto the job as materials, so the job overview/costing reflects
 * what was quoted — regardless of how the job reached this point (portal approval OR invoicing).
 * Deduped by catalogItemId/name so it won't duplicate items the job already has. Unit cost is
 * carried from the line (0 for items not in the price book — the UI flags those to fill in).
 */
export async function syncQuoteLineItemsToJobMaterials(
  tx: Tx,
  quote: { tenantId: string; lineItems: any[] },
  jobId: string,
): Promise<void> {
  const existing = await tx.jobMaterial.findMany({ where: { jobId } });
  const haveKey = new Set(existing.map((m: any) => (m.catalogItemId ?? m.name.toLowerCase())));
  const newMats = (quote.lineItems ?? [])
    .filter((li: any) => !haveKey.has(li.catalogItemId ?? String(li.description).toLowerCase()))
    .map((li: any) => {
      const qty = Number(li.quantity);
      const unitCost = li.costPriceCents ?? 0;
      const unitPrice = li.unitPriceCents;
      return {
        tenantId: quote.tenantId,
        jobId,
        catalogItemId: li.catalogItemId ?? undefined,
        lineType: li.lineType ?? "material",
        name: li.description,
        quantity: qty,
        unitCostCents: unitCost,
        unitPriceCents: unitPrice,
        totalCostCents: Math.round(unitCost * qty),
        totalPriceCents: Math.round(unitPrice * qty),
        addedFrom: "quote",
      };
    });
  if (newMats.length > 0) await tx.jobMaterial.createMany({ data: newMats });
}
