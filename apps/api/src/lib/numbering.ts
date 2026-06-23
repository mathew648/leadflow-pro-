import type { Prisma, PrismaClient } from "@lfp/db";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Atomically allocate the next sequential document number for a tenant.
 *
 * Uses a single `increment` update that returns the new counter value, so concurrent
 * callers can never receive the same number — giving the gap-free, sequential numbering
 * AU/NZ tax invoices require. Replaces the old `counter + random()` scheme, which was
 * neither sequential nor collision-safe.
 */
async function allocate(
  tx: Tx,
  tenantId: string,
  numberField: "quoteNextNumber" | "invoiceNextNumber" | "jobNextNumber",
  prefixField: "quotePrefix" | "invoicePrefix" | "jobPrefix",
  defaultPrefix: string,
): Promise<string> {
  const s: any = await tx.tenantSettings.update({
    where: { tenantId },
    data: { [numberField]: { increment: 1 } },
    select: { [numberField]: true, [prefixField]: true },
  });
  const seq = Number(s[numberField]);
  const prefix = (s[prefixField] as string | undefined) ?? defaultPrefix;
  return `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export const nextQuoteNumber = (tx: Tx, tenantId: string) =>
  allocate(tx, tenantId, "quoteNextNumber", "quotePrefix", "QTE");

export const nextInvoiceNumber = (tx: Tx, tenantId: string) =>
  allocate(tx, tenantId, "invoiceNextNumber", "invoicePrefix", "INV");

export const nextJobNumber = (tx: Tx, tenantId: string) =>
  allocate(tx, tenantId, "jobNextNumber", "jobPrefix", "JOB");
