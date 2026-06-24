import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { enqueueEmail } from "../lib/queue.js";
import { isPlatformAdmin } from "../lib/platform-admin.js";

/**
 * Platform admin panel — cross-tenant, for the TradieJet operator (not tradies).
 * Guarded by the PLATFORM_ADMIN_EMAILS allowlist; these routes intentionally bypass
 * the per-tenant scoping that the rest of the API enforces.
 */
async function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!isPlatformAdmin(request.jwtUser?.email)) {
    return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Platform admin access only" } });
  }
}

export default async function adminRoutes(fastify: FastifyInstance) {
  const guard = { preHandler: [fastify.authenticate, requirePlatformAdmin] };

  // GET /api/v1/admin/stats — platform-wide totals + MRR.
  fastify.get("/admin/stats", guard, async () => {
    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const monthAgo = new Date(Date.now() - 30 * 864e5);
    const [tenantCount, subsByStatus, activeSubs, newWeek, newMonth, leadsWeek, leadsMonth, totalLeads] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.subscription.findMany({ where: { status: "active" }, select: { basePriceCents: true } }),
      prisma.tenant.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
      prisma.tenant.count({ where: { deletedAt: null, createdAt: { gte: monthAgo } } }),
      prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.lead.count({}),
    ]);
    const byStatus: Record<string, number> = {};
    for (const s of subsByStatus) byStatus[s.status] = s._count.id;
    const mrrCents = activeSubs.reduce((sum, s) => sum + s.basePriceCents, 0);

    // Signups over the last 6 months (for the growth chart).
    const allSignups = await prisma.tenant.findMany({
      where: { deletedAt: null },
      select: { createdAt: true },
    });
    const now = new Date();
    const months: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
        label: m.toLocaleDateString("en-AU", { month: "short" }),
        count: 0,
      });
    }
    for (const t of allSignups) {
      const c = t.createdAt;
      const key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`;
      const bucket = months.find((mm) => mm.key === key);
      if (bucket) bucket.count += 1;
    }

    return {
      data: {
        tenants: tenantCount,
        active: byStatus.active ?? 0,
        trialing: byStatus.trialing ?? 0,
        pastDue: byStatus.past_due ?? 0,
        cancelled: byStatus.cancelled ?? 0,
        mrrCents,
        arrCents: mrrCents * 12,
        newThisWeek: newWeek,
        newThisMonth: newMonth,
        leadsThisWeek: leadsWeek,
        leadsThisMonth: leadsMonth,
        totalLeads,
        signups: months.map((m) => ({ month: m.label, signups: m.count })),
      },
    };
  });

  // GET /api/v1/admin/tenants — every tradie account with subscription + usage.
  fastify.get("/admin/tenants", guard, async (request) => {
    const q = z.object({
      search: z.string().optional(),
      status: z.enum(["trialing", "active", "past_due", "cancelled", "paused"]).optional(),
    }).parse(request.query);

    const tenants = await prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(q.status && { subscriptionStatus: q.status }),
        ...(q.search && {
          OR: [
            { businessName: { contains: q.search, mode: "insensitive" } },
            { email: { contains: q.search, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id: true, businessName: true, email: true, phone: true, country: true,
        createdAt: true, subscriptionStatus: true, trialEndsAt: true,
        subscription: { select: { tier: true, status: true, basePriceCents: true, currentPeriodEnd: true, stripeCustomerId: true } },
        _count: { select: { users: true, leads: true, invoices: true } },
        // Most recent login across the tenant's team = "last active".
        users: { select: { lastLoginAt: true }, orderBy: { lastLoginAt: { sort: "desc", nulls: "last" } }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Flatten the latest login into a lastActiveAt field.
    const data = tenants.map(({ users, ...t }) => ({
      ...t,
      lastActiveAt: users[0]?.lastLoginAt ?? null,
    }));
    return { data };
  });

  // POST /api/v1/admin/promo-email — send a promo/announcement to tradie owners.
  fastify.post("/admin/promo-email", guard, async (request) => {
    const body = z.object({
      subject: z.string().min(1).max(200),
      message: z.string().min(1), // simple HTML
      audience: z.enum(["all", "trialing", "active"]).default("all"),
    }).parse(request.body);

    const where = body.audience === "all"
      ? { deletedAt: null }
      : { deletedAt: null, subscriptionStatus: body.audience as any };

    const tenants = await prisma.tenant.findMany({ where, select: { id: true, email: true } });
    let queued = 0;
    for (const t of tenants) {
      if (!t.email) continue;
      await enqueueEmail({
        tenantId: t.id,
        to: t.email,
        subject: body.subject,
        template: "custom",
        data: { body: body.message, businessName: "TradieJet" },
      });
      queued += 1;
    }
    return { data: { queued, audience: body.audience } };
  });

  // GET /api/v1/admin/tenants/:id — full drill-down on one tradie account.
  fastify.get("/admin/tenants/:id", guard, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const monthAgo = new Date(Date.now() - 30 * 864e5);

    const tenant = await prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, businessName: true, email: true, phone: true, country: true, currency: true,
        suburb: true, state: true, tradeTypes: true, accountType: true, status: true,
        createdAt: true, subscriptionStatus: true, trialEndsAt: true, logoUrl: true,
        subscription: { select: { tier: true, status: true, basePriceCents: true, maxUsers: true, currentPeriodEnd: true, stripeCustomerId: true } },
        users: { where: { deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, lastLoginAt: true }, orderBy: { createdAt: "asc" } },
        _count: { select: { leads: true, customers: true, jobs: true, quotes: true, invoices: true } },
      },
    });
    if (!tenant) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tenant not found" } });

    const [leadsWeek, leadsMonth, wonAll, revenueAgg, sourceGroups] = await Promise.all([
      prisma.lead.count({ where: { tenantId: id, createdAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { tenantId: id, createdAt: { gte: monthAgo } } }),
      prisma.lead.count({ where: { tenantId: id, status: "converted" } }),
      prisma.invoice.aggregate({ where: { tenantId: id, status: "paid" }, _sum: { totalCents: true } }),
      prisma.lead.groupBy({ by: ["source"], where: { tenantId: id }, _count: { id: true } }),
    ]);

    const lastActiveAt = tenant.users.reduce<Date | null>((latest, u) => {
      if (u.lastLoginAt && (!latest || u.lastLoginAt > latest)) return u.lastLoginAt;
      return latest;
    }, null);

    return {
      data: {
        ...tenant,
        lastActiveAt,
        metrics: {
          leadsWeek, leadsMonth, leadsTotal: tenant._count.leads, wonAll,
          revenuePaidCents: revenueAgg._sum.totalCents ?? 0,
          leadSources: sourceGroups.map((g) => ({ source: g.source, count: g._count.id })),
        },
      },
    };
  });

  // GET /api/v1/admin/tenants/:id/leads?period=week|month|all — that tradie's leads.
  fastify.get("/admin/tenants/:id/leads", guard, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { period } = z.object({ period: z.enum(["week", "month", "all"]).default("month") }).parse(request.query);
    const since = period === "week" ? new Date(Date.now() - 7 * 864e5) : period === "month" ? new Date(Date.now() - 30 * 864e5) : undefined;

    const leads = await prisma.lead.findMany({
      where: { tenantId: id, ...(since && { createdAt: { gte: since } }) },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, source: true, status: true, serviceRequired: true, estimatedValueCents: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return { data: { period, count: leads.length, leads } };
  });

  // POST /api/v1/admin/message — message a single tradie via email or WhatsApp.
  fastify.post("/admin/message", guard, async (request, reply) => {
    const body = z.object({
      tenantId: z.string(),
      channel: z.enum(["email", "whatsapp"]),
      subject: z.string().max(200).optional(),
      message: z.string().min(1),
    }).parse(request.body);

    const tenant = await prisma.tenant.findFirst({ where: { id: body.tenantId, deletedAt: null }, select: { id: true, email: true, phone: true } });
    if (!tenant) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tenant not found" } });

    if (body.channel === "email") {
      if (!tenant.email) return reply.status(400).send({ error: { code: "NO_EMAIL", message: "No email on file" } });
      await enqueueEmail({ tenantId: tenant.id, to: tenant.email, subject: body.subject ?? "A message from TradieJet", template: "custom", data: { body: body.message, businessName: "TradieJet" } });
      return { data: { sent: true, channel: "email", to: tenant.email } };
    }

    const { sendWhatsApp } = await import("../lib/whatsapp.js");
    const res = await sendWhatsApp(tenant.phone ?? "", body.message);
    if (!res.sent) return reply.status(res.reason?.includes("not configured") ? 503 : 502).send({ error: { code: "WHATSAPP_FAILED", message: res.reason } });
    return { data: { sent: true, channel: "whatsapp", to: tenant.phone } };
  });

  // POST /api/v1/admin/tenants/:id/suspend — suspend or reactivate an account.
  fastify.post("/admin/tenants/:id/suspend", guard, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { suspend } = z.object({ suspend: z.boolean() }).parse(request.body);
    await prisma.tenant.update({ where: { id }, data: { status: suspend ? "suspended" : "active" } });
    return { data: { id, status: suspend ? "suspended" : "active" } };
  });

  // GET /api/v1/admin/export/tenants.csv — download all tradie accounts.
  fastify.get("/admin/export/tenants.csv", guard, async (_request, reply) => {
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: null },
      select: {
        businessName: true, email: true, phone: true, country: true, accountType: true, status: true,
        subscriptionStatus: true, createdAt: true,
        subscription: { select: { tier: true, basePriceCents: true } },
        _count: { select: { users: true, leads: true, invoices: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Business", "Email", "Phone", "Country", "Type", "Status", "Plan", "Price", "Users", "Leads", "Invoices", "Signed up"];
    const rows = tenants.map((t) => [
      t.businessName, t.email, t.phone, t.country, t.accountType, t.subscriptionStatus,
      t.subscription?.tier ?? "", ((t.subscription?.basePriceCents ?? 0) / 100).toFixed(2),
      t._count.users, t._count.leads, t._count.invoices, t.createdAt.toISOString().slice(0, 10),
    ].map(esc).join(","));
    const csv = [header.map(esc).join(","), ...rows].join("\n");
    reply.header("Content-Type", "text/csv").header("Content-Disposition", `attachment; filename="tradiejet-tenants-${new Date().toISOString().slice(0, 10)}.csv"`);
    return csv;
  });

  // ─── Marketing: newsletter subscribers + waitlist ───

  // GET /api/v1/admin/subscribers
  fastify.get("/admin/subscribers", guard, async (request) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(500).default(200), offset: z.coerce.number().int().min(0).default(0) }).parse(request.query);
    const [items, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" }, take: q.limit, skip: q.offset }),
      prisma.newsletterSubscriber.count(),
    ]);
    return { data: items, meta: { total, limit: q.limit, offset: q.offset } };
  });

  // GET /api/v1/admin/waitlist
  fastify.get("/admin/waitlist", guard, async (request) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(500).default(200), offset: z.coerce.number().int().min(0).default(0) }).parse(request.query);
    const [items, total] = await Promise.all([
      prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" }, take: q.limit, skip: q.offset }),
      prisma.waitlistEntry.count(),
    ]);
    return { data: items, meta: { total, limit: q.limit, offset: q.offset } };
  });

  // DELETE /api/v1/admin/subscribers/:id — remove a subscriber (spam/test)
  fastify.delete("/admin/subscribers/:id", guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.newsletterSubscriber.delete({ where: { id } }).catch(() => null);
    return reply.status(204).send();
  });

  // DELETE /api/v1/admin/waitlist/:id — remove a waitlist entry
  fastify.delete("/admin/waitlist/:id", guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.waitlistEntry.delete({ where: { id } }).catch(() => null);
    return reply.status(204).send();
  });

  const csvEsc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  // GET /api/v1/admin/export/subscribers.csv
  fastify.get("/admin/export/subscribers.csv", guard, async (_request, reply) => {
    const subs = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
    const header = ["Email", "Source", "Status", "Subscribed"];
    const rows = subs.map((s) => [s.email, s.source, s.status, s.createdAt.toISOString().slice(0, 10)].map(csvEsc).join(","));
    reply.header("Content-Type", "text/csv").header("Content-Disposition", `attachment; filename="tradiejet-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    return [header.map(csvEsc).join(","), ...rows].join("\n");
  });

  // GET /api/v1/admin/export/waitlist.csv
  fastify.get("/admin/export/waitlist.csv", guard, async (_request, reply) => {
    const list = await prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } });
    const header = ["Email", "Name", "Business", "Trade", "Country", "Phone", "Status", "Joined"];
    const rows = list.map((w) => [w.email, w.name, w.businessName, w.trade, w.country, w.phone, w.status, w.createdAt.toISOString().slice(0, 10)].map(csvEsc).join(","));
    reply.header("Content-Type", "text/csv").header("Content-Disposition", `attachment; filename="tradiejet-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`);
    return [header.map(csvEsc).join(","), ...rows].join("\n");
  });

  // POST /api/v1/admin/marketing/email — send a promotional email to subscribers and/or waitlist
  fastify.post("/admin/marketing/email", guard, async (request) => {
    const body = z.object({
      subject: z.string().min(1).max(200),
      message: z.string().min(1), // simple HTML
      audience: z.enum(["subscribers", "waitlist", "both"]).default("subscribers"),
    }).parse(request.body);

    const emails = new Set<string>();
    if (body.audience === "subscribers" || body.audience === "both") {
      const subs = await prisma.newsletterSubscriber.findMany({ where: { status: "subscribed" }, select: { email: true } });
      subs.forEach((s) => emails.add(s.email));
    }
    if (body.audience === "waitlist" || body.audience === "both") {
      const list = await prisma.waitlistEntry.findMany({ select: { email: true } });
      list.forEach((w) => emails.add(w.email));
    }

    let queued = 0;
    for (const to of emails) {
      await enqueueEmail({ to, subject: body.subject, template: "custom", data: { body: body.message, businessName: "TradieJet" } });
      queued += 1;
    }
    return { data: { queued, audience: body.audience } };
  });

  // ─── Blog management ───

  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);

  // GET /api/v1/admin/blog — all posts incl. drafts
  fastify.get("/admin/blog", guard, async () => {
    const posts = await prisma.blogPost.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
    return { data: posts };
  });

  // POST /api/v1/admin/blog
  fastify.post("/admin/blog", guard, async (request, reply) => {
    const body = z.object({
      title: z.string().min(1).max(255),
      slug: z.string().max(200).optional(),
      excerpt: z.string().max(500).optional(),
      content: z.string().min(1),
      coverImageUrl: z.string().url().optional().or(z.literal("")),
      authorName: z.string().max(150).optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(["draft", "published"]).default("draft"),
    }).parse(request.body);

    let slug = body.slug?.trim() ? slugify(body.slug) : slugify(body.title);
    if (await prisma.blogPost.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const post = await prisma.blogPost.create({
      data: {
        title: body.title,
        slug,
        excerpt: body.excerpt,
        content: body.content,
        coverImageUrl: body.coverImageUrl || null,
        authorName: body.authorName,
        tags: body.tags ?? [],
        status: body.status,
        publishedAt: body.status === "published" ? new Date() : null,
      },
    });
    return reply.status(201).send({ data: post });
  });

  // PATCH /api/v1/admin/blog/:id
  fastify.patch("/admin/blog/:id", guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      title: z.string().min(1).max(255).optional(),
      slug: z.string().max(200).optional(),
      excerpt: z.string().max(500).optional(),
      content: z.string().min(1).optional(),
      coverImageUrl: z.string().url().optional().or(z.literal("")),
      authorName: z.string().max(150).optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(["draft", "published"]).optional(),
    }).parse(request.body);

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Post not found" } });

    // Set publishedAt the first time it goes live; clear it if reverted to draft.
    const publishedAt = body.status === "published" && !existing.publishedAt ? new Date()
      : body.status === "draft" ? null
      : existing.publishedAt;

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        title: body.title,
        slug: body.slug ? slugify(body.slug) : undefined,
        excerpt: body.excerpt,
        content: body.content,
        coverImageUrl: body.coverImageUrl === "" ? null : body.coverImageUrl,
        authorName: body.authorName,
        tags: body.tags,
        status: body.status,
        publishedAt,
      },
    });
    return { data: post };
  });

  // DELETE /api/v1/admin/blog/:id
  fastify.delete("/admin/blog/:id", guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.blogPost.delete({ where: { id } }).catch(() => null);
    return reply.status(204).send();
  });
}
