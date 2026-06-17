import { prisma } from "./prisma.js";
import { enqueueAccountingSync } from "./queue.js";

/**
 * Enqueues an accounting sync for every accounting provider the tenant has connected
 * (Xero and/or MYOB). No-op when none are connected. Used by invoice/payment events so
 * the right provider(s) get the update without the caller needing to know which.
 */
export async function syncEntityToAccounting(
  tenantId: string,
  entityType: "invoice" | "payment" | "customer",
  entityId: string
): Promise<void> {
  const connections = await prisma.accountingConnection.findMany({
    where: { tenantId, status: "active", provider: { in: ["xero", "myob"] } },
    select: { provider: true },
  });
  for (const c of connections) {
    await enqueueAccountingSync({
      tenantId,
      provider: c.provider as "xero" | "myob",
      entityType,
      entityId,
      action: "create",
    });
  }
}
