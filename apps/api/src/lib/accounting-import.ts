import { prisma } from "./prisma.js";
import { getXeroAuth, xeroFetch } from "./xero.js";
import { getMyobAuth, myobFetch } from "./myob.js";

const cents = (n: unknown) => Math.round((Number(n) || 0) * 100);

/**
 * Pull existing customers + price-book items FROM the connected accounting system INTO
 * TradieJet, so a tradie arrives with their data already loaded (and can switch off a
 * competitor easily). Idempotent: skips records already imported (by external id / code).
 * Throws "<provider> not connected" when there's no active connection.
 */
export async function importFromXero(tenantId: string): Promise<{ customers: number; items: number }> {
  const auth = await getXeroAuth(tenantId);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { gstRate: true } });
  const gst = Number(tenant?.gstRate ?? 0.1);
  let customers = 0;
  let items = 0;

  const contactsRes = await xeroFetch<{ Contacts?: any[] }>(auth, `/Contacts?where=${encodeURIComponent("IsCustomer==true")}`);
  for (const c of contactsRes?.Contacts ?? []) {
    if (!c.ContactID) continue;
    const exists = await prisma.customer.findFirst({ where: { tenantId, xeroContactId: c.ContactID } });
    if (exists) continue;
    const isCompany = Boolean(c.Name) && !c.FirstName && !c.LastName;
    await prisma.customer.create({
      data: {
        tenantId,
        firstName: c.FirstName ?? (isCompany ? null : c.Name?.split(" ")[0] ?? null),
        lastName: c.LastName ?? null,
        companyName: isCompany ? c.Name : (c.Name && (c.FirstName || c.LastName) ? c.Name : null),
        email: c.EmailAddress ?? null,
        phone: c.Phones?.find((p: any) => p.PhoneNumber)?.PhoneNumber ?? null,
        xeroContactId: c.ContactID,
      },
    });
    customers += 1;
  }

  const itemsRes = await xeroFetch<{ Items?: any[] }>(auth, "/Items");
  for (const it of itemsRes?.Items ?? []) {
    if (!it.Code) continue;
    const exists = await prisma.catalogItem.findFirst({ where: { tenantId, code: it.Code } });
    if (exists) continue;
    await prisma.catalogItem.create({
      data: {
        tenantId,
        name: it.Name ?? it.Code,
        code: it.Code,
        description: it.Description ?? null,
        type: "material",
        unit: "each",
        sellPriceCents: cents(it.SalesDetails?.UnitPrice),
        costPriceCents: cents(it.PurchaseDetails?.UnitPrice),
        gstRate: gst,
        gstApplicable: true,
        active: true,
      },
    });
    items += 1;
  }
  return { customers, items };
}

export async function importFromMyob(tenantId: string): Promise<{ customers: number; items: number }> {
  const auth = await getMyobAuth(tenantId);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { gstRate: true } });
  const gst = Number(tenant?.gstRate ?? 0.1);
  let customers = 0;
  let items = 0;

  const custRes = await myobFetch<{ Items?: any[] }>(auth, "/Contact/Customer?$top=200");
  for (const c of custRes?.Items ?? []) {
    if (!c.UID) continue;
    const exists = await prisma.customer.findFirst({ where: { tenantId, myobCardId: c.UID } });
    if (exists) continue;
    const addr = (c.Addresses ?? [])[0] ?? {};
    await prisma.customer.create({
      data: {
        tenantId,
        firstName: c.FirstName ?? null,
        lastName: c.LastName ?? null,
        companyName: c.CompanyName ?? (c.IsIndividual ? null : c.CompanyName ?? null),
        email: addr.Email ?? null,
        phone: addr.Phone1 ?? null,
        myobCardId: c.UID,
      },
    });
    customers += 1;
  }

  const itemRes = await myobFetch<{ Items?: any[] }>(auth, "/Inventory/Item?$top=200");
  for (const it of itemRes?.Items ?? []) {
    if (!it.Number) continue;
    const exists = await prisma.catalogItem.findFirst({ where: { tenantId, code: it.Number } });
    if (exists) continue;
    await prisma.catalogItem.create({
      data: {
        tenantId,
        name: it.Name ?? it.Number,
        code: it.Number,
        type: "material",
        unit: "each",
        sellPriceCents: cents(it.SellingDetails?.BaseSellingPrice),
        gstRate: gst,
        gstApplicable: true,
        active: true,
      },
    });
    items += 1;
  }
  return { customers, items };
}
