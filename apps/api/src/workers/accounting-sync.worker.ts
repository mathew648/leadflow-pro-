import { Worker, Job } from "bullmq";
import { createWorkerConnection } from "../lib/redis.js";
import { QUEUES, AccountingSyncPayload } from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";
import { getXeroAuth, xeroFetch, type XeroAuth } from "../lib/xero.js";

const cents = (c: number) => Math.round(c) / 100;

// Default Xero sales (revenue) account code. Most Xero orgs ship with 200 = "Sales".
// A per-tenant override is a sensible future refinement.
const DEFAULT_SALES_ACCOUNT = "200";

/** Find the org's first bank account code, used when recording payments. */
async function findBankAccountCode(auth: XeroAuth): Promise<string | null> {
  const res = await xeroFetch<{ Accounts?: { Code: string; Type: string; Status: string }[] }>(
    auth,
    `/Accounts?where=${encodeURIComponent('Type=="BANK" AND Status=="ACTIVE"')}`
  );
  return res?.Accounts?.[0]?.Code ?? null;
}

/** Ensure the customer exists in Xero; persist + return the ContactID. */
async function ensureContact(auth: XeroAuth, customerId: string): Promise<string> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  if (customer.xeroContactId) return customer.xeroContactId;

  const name =
    customer.companyName ||
    `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
    `Customer ${customer.customerNumber ?? customer.id.slice(0, 8)}`;

  const payload = {
    Contacts: [
      {
        Name: name,
        FirstName: customer.firstName ?? undefined,
        LastName: customer.lastName ?? undefined,
        EmailAddress: customer.email ?? undefined,
        Addresses: customer.billingStreet
          ? [
              {
                AddressType: "STREET",
                AddressLine1: customer.billingStreet,
                City: customer.billingCity ?? customer.billingSuburb ?? undefined,
                Region: customer.billingState ?? undefined,
                PostalCode: customer.billingPostcode ?? undefined,
                Country: customer.billingCountry ?? undefined,
              },
            ]
          : undefined,
        Phones: customer.phone
          ? [{ PhoneType: "DEFAULT", PhoneNumber: customer.phone }]
          : undefined,
      },
    ],
  };

  const res = await xeroFetch<{ Contacts: { ContactID: string }[] }>(auth, "/Contacts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const contactId = res.Contacts[0].ContactID;
  await prisma.customer.update({ where: { id: customerId }, data: { xeroContactId: contactId } });
  return contactId;
}

/** Ensure the invoice exists in Xero (as an AUTHORISED ACCREC invoice); persist + return InvoiceID. */
async function ensureInvoice(auth: XeroAuth, invoiceId: string): Promise<string> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lineItems: { orderBy: { position: "asc" } } },
  });
  if (invoice.xeroInvoiceId) return invoice.xeroInvoiceId;

  const contactId = await ensureContact(auth, invoice.customerId);

  const payload = {
    Invoices: [
      {
        Type: "ACCREC",
        Contact: { ContactID: contactId },
        InvoiceNumber: invoice.invoiceNumber,
        Reference: invoice.invoiceNumber,
        Date: invoice.issueDate.toISOString().slice(0, 10),
        DueDate: invoice.dueDate.toISOString().slice(0, 10),
        Status: "AUTHORISED",
        LineAmountTypes: "Exclusive",
        CurrencyCode: invoice.currency,
        LineItems: invoice.lineItems.map((li) => ({
          Description: li.description,
          Quantity: Number(li.quantity),
          UnitAmount: cents(li.unitPriceCents),
          DiscountRate: Number(li.discountPercent) || undefined,
          AccountCode: DEFAULT_SALES_ACCOUNT,
        })),
      },
    ],
  };

  const res = await xeroFetch<{ Invoices: { InvoiceID: string }[] }>(auth, "/Invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const xeroInvoiceId = res.Invoices[0].InvoiceID;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { xeroInvoiceId, accountingSyncedAt: new Date() },
  });
  return xeroInvoiceId;
}

/** Push any completed payments for the invoice that haven't yet been recorded in Xero. */
async function pushPayments(auth: XeroAuth, invoiceId: string, xeroInvoiceId: string): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: { invoiceId, status: "completed", xeroPaymentId: null },
  });
  if (payments.length === 0) return 0;

  const bankCode = await findBankAccountCode(auth);
  if (!bankCode) {
    throw new Error("No active Xero bank account found to record payment against");
  }

  let pushed = 0;
  for (const payment of payments) {
    const res = await xeroFetch<{ Payments: { PaymentID: string }[] }>(auth, "/Payments", {
      method: "PUT",
      body: JSON.stringify({
        Payments: [
          {
            Invoice: { InvoiceID: xeroInvoiceId },
            Account: { Code: bankCode },
            Date: (payment.paidAt ?? payment.createdAt).toISOString().slice(0, 10),
            Amount: cents(payment.amountCents),
            Reference: payment.gatewayTransactionId ?? undefined,
          },
        ],
      }),
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { xeroPaymentId: res.Payments[0].PaymentID, accountingSyncedAt: new Date() },
    });
    pushed += 1;
  }
  return pushed;
}

export function startAccountingSyncWorker() {
  const worker = new Worker<AccountingSyncPayload>(
    QUEUES.ACCOUNTING_SYNC,
    async (job: Job<AccountingSyncPayload>) => {
      const { tenantId, provider, entityType, entityId } = job.data;

      // Only Xero is implemented today; other providers are accepted but skipped.
      if (provider !== "xero") {
        return { skipped: `provider ${provider} not implemented` };
      }

      let auth: XeroAuth;
      try {
        auth = await getXeroAuth(tenantId);
      } catch (err: any) {
        // Not connected → nothing to do. This is expected for tenants without Xero,
        // so treat it as a successful no-op rather than a failed job.
        if (err.message === "Xero not connected") return { skipped: "not connected" };
        throw err;
      }

      try {
        let result: Record<string, unknown> = {};

        if ((entityType === "invoice" || entityType === "payment") && entityId) {
          const xeroInvoiceId = await ensureInvoice(auth, entityId);
          result.invoiceId = xeroInvoiceId;
          if (entityType === "payment") {
            result.paymentsPushed = await pushPayments(auth, entityId, xeroInvoiceId);
          }
        } else if (entityType === "customer" && entityId) {
          result.contactId = await ensureContact(auth, entityId);
        }

        await prisma.accountingConnection.updateMany({
          where: { tenantId, provider: "xero" },
          data: { lastSyncAt: new Date(), lastSyncStatus: "success" },
        });
        return result;
      } catch (err: any) {
        await prisma.accountingConnection.updateMany({
          where: { tenantId, provider: "xero" },
          data: { lastSyncAt: new Date(), lastSyncStatus: "error" },
        });
        throw err;
      }
    },
    {
      connection: createWorkerConnection(),
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[accounting-sync-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
