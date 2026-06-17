import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { enqueueEmail } from "../lib/queue.js";
import { isPlatformAdmin } from "../lib/platform-admin.js";

/**
 * Platform admin panel — cross-tenant, for the LeadFlow Pro operator (not tradies).
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
    return {
      data: {
        tenants: tenantCount,
        active: byStatus.active ?? 0,
        trialing: byStatus.trialing ?? 0,
        pastDue: byStatus.past_due ?? 0,
        cancelled: byStatus.cancelled ?? 0,
        mrrCents,
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
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { data: tenants };
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
        data: { body: body.message, businessName: "LeadFlow Pro" },
      });
      queued += 1;
    }
    return { data: { queued, audience: body.audience } };
  });
}
