import { PrismaClient, UserRole, SubscriptionTier, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SLUG = "demo-sparks-nz";
const GST = 0.15;

const days = (n: number) => new Date(Date.now() + n * 86400000);
const at = (date: Date, h: number, m = 0) => {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
};

/** Builds invoice/quote line-item rows + rolled-up totals (NZ GST inclusive). */
function buildLines(
  tenantId: string,
  rows: { description: string; quantity: number; unitPriceCents: number }[]
) {
  let subtotalCents = 0;
  let gstCents = 0;
  const items = rows.map((r, i) => {
    const lineSub = Math.round(r.quantity * r.unitPriceCents);
    const lineGst = Math.round(lineSub * GST);
    subtotalCents += lineSub;
    gstCents += lineGst;
    return {
      tenantId,
      description: r.description,
      quantity: r.quantity,
      unit: "each",
      unitPriceCents: r.unitPriceCents,
      gstRate: GST,
      discountPercent: 0,
      discountCents: 0,
      subtotalCents: lineSub,
      gstCents: lineGst,
      totalCents: lineSub + lineGst,
      position: i,
    };
  });
  return { items, subtotalCents, gstCents, totalCents: subtotalCents + gstCents };
}

/** Removes any prior demo tenant data so the seed is repeatable. */
async function wipeExisting() {
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!existing) return;
  const t = existing.id;
  await prisma.payment.deleteMany({ where: { tenantId: t } });
  await prisma.invoiceLineItem.deleteMany({ where: { invoice: { tenantId: t } } });
  await prisma.invoice.deleteMany({ where: { tenantId: t } });
  await prisma.quoteLineItem.deleteMany({ where: { quote: { tenantId: t } } });
  await prisma.quote.deleteMany({ where: { tenantId: t } });
  await prisma.jobChecklistItem.deleteMany({ where: { checklist: { job: { tenantId: t } } } });
  await prisma.jobChecklist.deleteMany({ where: { job: { tenantId: t } } });
  await prisma.jobMaterial.deleteMany({ where: { job: { tenantId: t } } });
  await prisma.jobPhoto.deleteMany({ where: { job: { tenantId: t } } });
  await prisma.timeEntry.deleteMany({ where: { tenantId: t } });
  await prisma.job.deleteMany({ where: { tenantId: t } });
  await prisma.leadActivity.deleteMany({ where: { lead: { tenantId: t } } });
  await prisma.lead.deleteMany({ where: { tenantId: t } });
  await prisma.property.deleteMany({ where: { tenantId: t } });
  await prisma.customer.deleteMany({ where: { tenantId: t } });
  await prisma.message.deleteMany({ where: { tenantId: t } });
  await prisma.auditLog.deleteMany({ where: { tenantId: t } });
  await prisma.catalogItem.deleteMany({ where: { tenantId: t } });
  await prisma.catalogCategory.deleteMany({ where: { tenantId: t } });
  await prisma.pipelineStage.deleteMany({ where: { tenantId: t } });
  const users = await prisma.user.findMany({ where: { tenantId: t }, select: { id: true } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await prisma.tenantSettings.deleteMany({ where: { tenantId: t } });
  await prisma.subscription.deleteMany({ where: { tenantId: t } });
  await prisma.user.deleteMany({ where: { tenantId: t } });
  await prisma.tenant.delete({ where: { id: t } });
}

async function main() {
  console.log("🌱 Seeding NZ demo data...");
  await wipeExisting();

  // ── Tenant (Auckland electrical business, NZD, 15% GST) ──
  const tenant = await prisma.tenant.create({
    data: {
      slug: SLUG,
      businessName: "Sparks Electrical NZ",
      nzbn: "9429041234567",
      email: "office@sparksnz.co.nz",
      phone: "+6499182345",
      streetAddress: "27 Karangahape Road",
      suburb: "Newton",
      city: "Auckland",
      state: "Auckland",
      postcode: "1010",
      country: "NZ",
      tradeTypes: ["electrical", "solar"],
      timezone: "Pacific/Auckland",
      currency: "NZD",
      gstRate: GST,
      primaryColor: "#0EA5E9",
      subscriptionStatus: "active",
      status: "active",
    },
  });

  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      invoicePrefix: "INV",
      invoiceNextNumber: 1042,
      quotePrefix: "QTE",
      quoteNextNumber: 1031,
      jobPrefix: "JOB",
      jobNextNumber: 1058,
      invoiceFooterText: "Thank you for choosing Sparks Electrical NZ. Payment due within 14 days.",
    },
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      tier: SubscriptionTier.growth,
      status: SubscriptionStatus.active,
      basePriceCents: 24900,
      maxUsers: 5,
      maxLeadsPerMonth: 5000,
      storageGb: 50,
      currentPeriodStart: days(-12),
      currentPeriodEnd: days(18),
    },
  });

  // ── Pipeline stages ──
  const stageDefs = [
    { name: "New", slug: "new", color: "#6B7280", position: 0, isDefault: true },
    { name: "Contacted", slug: "contacted", color: "#3B82F6", position: 1 },
    { name: "Site Visit", slug: "site-visit", color: "#8B5CF6", position: 2 },
    { name: "Quote Sent", slug: "quote-sent", color: "#F59E0B", position: 3 },
    { name: "Follow Up", slug: "follow-up", color: "#EF4444", position: 4 },
    { name: "Won", slug: "won", color: "#10B981", position: 5, isWon: true },
    { name: "Lost", slug: "lost", color: "#9CA3AF", position: 6, isLost: true },
  ];
  const stages: Record<string, string> = {};
  for (const s of stageDefs) {
    const created = await prisma.pipelineStage.create({
      data: { tenantId: tenant.id, ...s, isWon: (s as any).isWon ?? false, isLost: (s as any).isLost ?? false },
    });
    stages[s.slug] = created.id;
  }

  // ── Users ──
  const passwordHash = await bcrypt.hash("Demo1234!", 12);
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "owner@sparksnz.co.nz",
      firstName: "Hemi",
      lastName: "Walker",
      phone: "+6421555100",
      role: UserRole.owner,
      passwordHash,
      status: "active",
      activatedAt: new Date(),
    },
  });
  const tech = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "tech@sparksnz.co.nz",
      firstName: "Aroha",
      lastName: "Ngata",
      phone: "+6421555200",
      role: UserRole.technician,
      passwordHash,
      status: "active",
      activatedAt: new Date(),
      tradeTypes: ["electrical"],
    },
  });

  // ── Catalog ──
  const labour = await prisma.catalogCategory.create({ data: { tenantId: tenant.id, name: "Labour", position: 0 } });
  const materials = await prisma.catalogCategory.create({ data: { tenantId: tenant.id, name: "Materials", position: 1 } });
  await prisma.catalogItem.createMany({
    data: [
      { tenantId: tenant.id, categoryId: labour.id, code: "LAB-STD", name: "Standard Labour", type: "labour", unit: "hour", costPriceCents: 6000, sellPriceCents: 9500, gstRate: GST },
      { tenantId: tenant.id, categoryId: labour.id, code: "LAB-EMRG", name: "Emergency Call-Out", type: "service", unit: "each", costPriceCents: 18000, sellPriceCents: 28000, gstRate: GST },
      { tenantId: tenant.id, categoryId: materials.id, code: "MAT-GPO", name: "Double Power Point", type: "product", unit: "each", costPriceCents: 950, sellPriceCents: 2400, gstRate: GST },
      { tenantId: tenant.id, categoryId: materials.id, code: "MAT-CB", name: "Circuit Breaker 20A", type: "product", unit: "each", costPriceCents: 1400, sellPriceCents: 3800, gstRate: GST },
      { tenantId: tenant.id, categoryId: materials.id, code: "MAT-LED", name: "LED Downlight", type: "product", unit: "each", costPriceCents: 1200, sellPriceCents: 3200, gstRate: GST },
    ],
  });

  // ── Customers + properties ──
  const customerSeeds = [
    { num: "CUS-2026-0001", first: "Olivia", last: "Reweti", email: "olivia.reweti@gmail.com", phone: "+6421777001", suburb: "Ponsonby", postcode: "1011", tags: ["vip", "residential"], street: "12 Franklin Road" },
    { num: "CUS-2026-0002", first: "James", last: "Patel", email: "james.patel@xtra.co.nz", phone: "+6421777002", suburb: "Mount Eden", postcode: "1024", tags: ["residential"], street: "8 Valley Road" },
    { num: "CUS-2026-0003", first: "Mereana", last: "Tia", email: "m.tia@harbourcafe.co.nz", company: "Harbour Cafe Ltd", phone: "+6499182700", suburb: "Wynyard Quarter", postcode: "1010", tags: ["commercial"], street: "45 Jellicoe Street" },
    { num: "CUS-2026-0004", first: "Daniel", last: "Brown", email: "dan.brown@gmail.com", phone: "+6421777004", suburb: "Takapuna", postcode: "0622", tags: ["residential"], street: "3 Hurstmere Road" },
  ];
  const customers = [];
  for (const c of customerSeeds) {
    const cust = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        customerNumber: c.num,
        type: c.company ? "commercial" : "residential",
        firstName: c.first,
        lastName: c.last,
        companyName: c.company,
        email: c.email,
        phone: c.phone,
        billingStreet: c.street,
        billingSuburb: c.suburb,
        billingState: "Auckland",
        billingPostcode: c.postcode,
        billingCountry: "NZ",
        tags: c.tags,
        assignedToId: owner.id,
        createdById: owner.id,
      },
    });
    const prop = await prisma.property.create({
      data: {
        tenantId: tenant.id,
        customerId: cust.id,
        nickname: c.company ? "Premises" : "Home",
        streetAddress: c.street,
        suburb: c.suburb,
        state: "Auckland",
        postcode: c.postcode,
        country: "NZ",
        propertyType: c.company ? "commercial" : "residential",
      },
    });
    customers.push({ cust, prop });
  }

  // ── Leads (varied sources for the dashboard pie + AI scores) ──
  const leadSeeds = [
    { first: "Sophie", last: "Anderson", phone: "+6421888001", source: "meta_ads", detail: "Winter Heating Promo", service: "Heat pump wiring", suburb: "Grey Lynn", urgency: "normal", value: 320000, stage: "new", ai: 84, prob: 0.71 },
    { first: "Liam", last: "O'Connor", phone: "+6421888002", source: "google_ads", detail: "Electrician Auckland", service: "Switchboard upgrade", suburb: "Epsom", urgency: "urgent", value: 410000, stage: "quote-sent", ai: 92, prob: 0.86 },
    { first: "Ana", last: "Williams", phone: "+6421888003", source: "referral", detail: "Olivia Reweti", service: "EV charger install", suburb: "Remuera", urgency: "normal", value: 270000, stage: "contacted", ai: 79, prob: 0.64 },
    { first: "Tom", last: "Fisher", phone: "+6421888004", source: "website", detail: "Contact form", service: "Office fit-out rewire", suburb: "CBD", urgency: "normal", value: 1850000, stage: "site-visit", ai: 88, prob: 0.77 },
    { first: "Grace", last: "Murphy", phone: "+6421888005", source: "meta_ads", detail: "Winter Heating Promo", service: "LED lighting upgrade", suburb: "Henderson", urgency: "flexible", value: 150000, stage: "new", ai: 68, prob: 0.52 },
    { first: "Noah", last: "Singh", phone: "+6421888006", source: "phone", detail: "Inbound call", service: "Emergency fault find", suburb: "Manukau", urgency: "emergency", value: 95000, stage: "follow-up", ai: 73, prob: 0.6 },
  ];
  for (const l of leadSeeds) {
    const lead = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        leadNumber: `LEA-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        firstName: l.first,
        lastName: l.last,
        phone: l.phone,
        email: `${l.first.toLowerCase()}.${l.last.toLowerCase().replace(/[^a-z]/g, "")}@email.co.nz`,
        source: l.source as any,
        sourceDetail: l.detail,
        serviceRequired: l.service,
        serviceCategory: "electrical",
        suburb: l.suburb,
        urgency: l.urgency as any,
        estimatedValueCents: l.value,
        stageId: stages[l.stage],
        aiScore: l.ai,
        aiCloseProbability: l.prob,
        assignedToId: owner.id,
        status: "active",
        createdAt: days(-Math.floor(Math.random() * 20)),
      },
    });
    await prisma.leadActivity.create({
      data: { tenantId: tenant.id, leadId: lead.id, type: "lead_created", description: `Lead created from ${l.source.replace(/_/g, " ")}`, userId: owner.id },
    });
  }

  // ── Quotes (one sent, one approved) ──
  const q1 = buildLines(tenant.id, [
    { description: "Switchboard upgrade (supply & install)", quantity: 1, unitPriceCents: 180000 },
    { description: "Standard Labour", quantity: 6, unitPriceCents: 9500 },
    { description: "Circuit Breaker 20A", quantity: 8, unitPriceCents: 3800 },
  ]);
  await prisma.quote.create({
    data: {
      tenantId: tenant.id, quoteNumber: "QTE-2026-1028", customerId: customers[1].cust.id, propertyId: customers[1].prop.id,
      title: "Switchboard upgrade — 8 Valley Road", description: "Full switchboard replacement with RCD protection.",
      subtotalCents: q1.subtotalCents, gstCents: q1.gstCents, totalCents: q1.totalCents,
      depositPercent: 25, depositCents: Math.round(q1.totalCents * 0.25), paymentTermsDays: 14,
      validUntil: days(14), status: "sent", sentAt: days(-2), createdById: owner.id,
      lineItems: { create: q1.items },
    },
  });
  const q2 = buildLines(tenant.id, [
    { description: "EV charger supply & install (7kW)", quantity: 1, unitPriceCents: 145000 },
    { description: "Standard Labour", quantity: 4, unitPriceCents: 9500 },
  ]);
  await prisma.quote.create({
    data: {
      tenantId: tenant.id, quoteNumber: "QTE-2026-1029", customerId: customers[0].cust.id, propertyId: customers[0].prop.id,
      title: "EV charger install — 12 Franklin Road",
      subtotalCents: q2.subtotalCents, gstCents: q2.gstCents, totalCents: q2.totalCents,
      depositPercent: 0, paymentTermsDays: 14, validUntil: days(21),
      status: "approved", sentAt: days(-6), approvedAt: days(-4), approvedByName: "Olivia Reweti", createdById: owner.id,
      lineItems: { create: q2.items },
    },
  });

  // ── Jobs: 2 completed, 1 in progress, 2 scheduled today (assigned to technician) ──
  const checklistTemplate = () => ({
    create: {
      tenantId: tenant.id, name: "Pre-Job Checklist", type: "pre_job", position: 0,
      items: { create: [
        { tenantId: tenant.id, label: "Review job details and address", position: 0 },
        { tenantId: tenant.id, label: "Materials loaded", position: 1 },
        { tenantId: tenant.id, label: "Safety equipment checked", position: 2, isRequired: true },
      ] },
    },
  });

  // Completed jobs (drive dashboard "jobs completed" + tech leaderboard + satisfaction)
  for (let i = 0; i < 2; i++) {
    const c = customers[i];
    await prisma.job.create({
      data: {
        tenantId: tenant.id, jobNumber: `JOB-2026-10${50 + i}`, customerId: c.cust.id, propertyId: c.prop.id,
        title: i === 0 ? "Replace kitchen power points" : "Hot water cylinder wiring",
        tradeCategory: "electrical", priority: "normal", status: "completed",
        leadTechnicianId: tech.id, assignedUserIds: [tech.id],
        scheduledStart: at(days(-3 - i), 9), scheduledEnd: at(days(-3 - i), 12),
        actualStart: at(days(-3 - i), 9, 5), actualEnd: at(days(-3 - i), 11, 30),
        completedAt: at(days(-3 - i), 11, 30), completedById: tech.id,
        customerSatisfaction: 5, customerSignoffName: `${c.cust.firstName} ${c.cust.lastName}`,
        actualTotalCents: 48000 + i * 12000, createdById: owner.id,
        checklists: checklistTemplate(),
      } as any,
    });
  }

  // In-progress job (assigned to tech, started this morning)
  await prisma.job.create({
    data: {
      tenantId: tenant.id, jobNumber: "JOB-2026-1055", customerId: customers[2].cust.id, propertyId: customers[2].prop.id,
      title: "Cafe lighting refresh — Harbour Cafe", tradeCategory: "electrical", priority: "high",
      status: "in_progress", leadTechnicianId: tech.id, assignedUserIds: [tech.id],
      scheduledStart: at(new Date(), 8), scheduledEnd: at(new Date(), 14), actualStart: at(new Date(), 8, 20),
      createdById: owner.id, checklists: checklistTemplate(),
    } as any,
  });

  // Scheduled-today jobs (populate Field App "My Day" + dispatch)
  await prisma.job.create({
    data: {
      tenantId: tenant.id, jobNumber: "JOB-2026-1056", customerId: customers[3].cust.id, propertyId: customers[3].prop.id,
      title: "Install 6 LED downlights — Takapuna", tradeCategory: "electrical", priority: "normal",
      status: "scheduled", leadTechnicianId: tech.id, assignedUserIds: [tech.id],
      scheduledStart: at(new Date(), 13), scheduledEnd: at(new Date(), 15), createdById: owner.id,
      checklists: checklistTemplate(),
    } as any,
  });
  await prisma.job.create({
    data: {
      tenantId: tenant.id, jobNumber: "JOB-2026-1057", customerId: customers[0].cust.id, propertyId: customers[0].prop.id,
      title: "EV charger install — Ponsonby", tradeCategory: "electrical", priority: "high",
      status: "scheduled", leadTechnicianId: tech.id, assignedUserIds: [tech.id],
      scheduledStart: at(new Date(), 15, 30), scheduledEnd: at(new Date(), 17, 30), createdById: owner.id,
      checklists: checklistTemplate(),
    } as any,
  });

  // ── Invoices: 2 paid (revenue), 1 sent (future due), 2 overdue ──
  async function makeInvoice(opts: {
    number: string; custIdx: number; title: string[]; status: string; dueDate: Date; issueDate: Date;
    paidCents?: number; lastPaymentAt?: Date;
  }) {
    const lines = buildLines(tenant.id, [
      { description: opts.title[0], quantity: 1, unitPriceCents: 95000 },
      { description: "Standard Labour", quantity: 3, unitPriceCents: 9500 },
    ]);
    const paid = opts.paidCents ?? 0;
    const inv = await prisma.invoice.create({
      data: {
        tenantId: tenant.id, invoiceNumber: opts.number, customerId: customers[opts.custIdx].cust.id,
        invoiceType: "final", subtotalCents: lines.subtotalCents, gstCents: lines.gstCents, totalCents: lines.totalCents,
        amountPaidCents: paid, amountDueCents: lines.totalCents - paid, currency: "NZD",
        issueDate: opts.issueDate, dueDate: opts.dueDate, status: opts.status as any,
        sentAt: opts.issueDate, lastPaymentAt: opts.lastPaymentAt, createdById: owner.id,
        lineItems: { create: lines.items },
      },
    });
    if (paid > 0) {
      await prisma.payment.create({
        data: {
          tenantId: tenant.id, invoiceId: inv.id, customerId: customers[opts.custIdx].cust.id,
          amountCents: paid, currency: "NZD", paymentGateway: "manual", status: "completed",
          paidAt: opts.lastPaymentAt ?? opts.issueDate,
        },
      });
    }
    return inv;
  }

  const paid1 = buildLines(tenant.id, [{ description: "x", quantity: 1, unitPriceCents: 95000 }, { description: "y", quantity: 3, unitPriceCents: 9500 }]).totalCents;
  await makeInvoice({ number: "INV-2026-1038", custIdx: 0, title: ["Kitchen power point replacement"], status: "paid", issueDate: days(-12), dueDate: days(2), paidCents: paid1, lastPaymentAt: days(-8) });
  await makeInvoice({ number: "INV-2026-1039", custIdx: 1, title: ["Hot water cylinder wiring"], status: "paid", issueDate: days(-9), dueDate: days(5), paidCents: paid1, lastPaymentAt: days(-5) });
  await makeInvoice({ number: "INV-2026-1040", custIdx: 3, title: ["LED downlight install"], status: "sent", issueDate: days(-2), dueDate: days(12) });
  await makeInvoice({ number: "INV-2026-1041", custIdx: 2, title: ["Cafe switchboard service"], status: "sent", issueDate: days(-30), dueDate: days(-16) });
  await makeInvoice({ number: "INV-2026-1042", custIdx: 1, title: ["Emergency fault find"], status: "partial", issueDate: days(-25), dueDate: days(-11), paidCents: 20000, lastPaymentAt: days(-20) });

  console.log("✅ NZ demo seed complete!");
  console.log("   Business : Sparks Electrical NZ (Auckland, NZD, 15% GST)");
  console.log("   Owner    : owner@sparksnz.co.nz / Demo1234!");
  console.log("   Tech     : tech@sparksnz.co.nz  / Demo1234!  (for the Field App)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
