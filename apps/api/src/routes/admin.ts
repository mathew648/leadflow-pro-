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
    const [tenantCount, subsByStatus, activeSubs] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.subscription.findMany({ where: { status: "active" }, select: { basePriceCents: true } }),
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
}
