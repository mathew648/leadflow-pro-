import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/analytics/dashboard
  fastify.get(
    "/analytics/dashboard",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        period: z.enum(["today", "week", "month", "quarter", "year"]).default("month"),
      }).parse(request.query);

      const { tenantId } = request;
      const now = new Date();

      const startDate = new Date();
      switch (query.period) {
        case "today": startDate.setHours(0, 0, 0, 0); break;
        case "week": startDate.setDate(now.getDate() - 7); break;
        case "month": startDate.setMonth(now.getMonth() - 1); break;
        case "quarter": startDate.setMonth(now.getMonth() - 3); break;
        case "year": startDate.setFullYear(now.getFullYear() - 1); break;
      }

      const prevStart = new Date(startDate);
      const periodMs = now.getTime() - startDate.getTime();
      prevStart.setTime(prevStart.getTime() - periodMs);

      const [
        leadsThisPeriod,
        leadsPrevPeriod,
        jobsCompleted,
        jobsPrevCompleted,
        revenueThisPeriod,
        revenuePrevPeriod,
        activeJobs,
        overdueInvoices,
        leadsBySource,
        recentJobs,
        topTechnicians,
      ] = await prisma.$transaction([
        prisma.lead.count({
          where: { tenantId, deletedAt: null, createdAt: { gte: startDate } },
        }),
        prisma.lead.count({
          where: { tenantId, deletedAt: null, createdAt: { gte: prevStart, lt: startDate } },
        }),
        prisma.job.count({
          where: { tenantId, deletedAt: null, status: { notIn: ["cancelled"] }, completedAt: { gte: startDate } },
        }),
        prisma.job.count({
          where: { tenantId, deletedAt: null, status: { notIn: ["cancelled"] }, completedAt: { gte: prevStart, lt: startDate } },
        }),
        prisma.payment.aggregate({
          where: { tenantId, status: "completed", paidAt: { gte: startDate } },
          _sum: { amountCents: true },
        }),
        prisma.payment.aggregate({
          where: { tenantId, status: "completed", paidAt: { gte: prevStart, lt: startDate } },
          _sum: { amountCents: true },
        }),
        prisma.job.count({
          where: { tenantId, deletedAt: null, status: { in: ["pending", "scheduled", "dispatched", "in_progress"] } },
        }),
        prisma.invoice.aggregate({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ["sent", "partial"] },
            dueDate: { lt: now },
          },
          _sum: { amountDueCents: true },
          _count: true,
        }),
        prisma.lead.groupBy({
          by: ["source"],
          where: { tenantId, deletedAt: null, createdAt: { gte: startDate } },
          _count: true,
          orderBy: { _count: { source: "desc" } },
        }),
        prisma.job.findMany({
          where: { tenantId, deletedAt: null, status: { notIn: ["cancelled"] } },
          include: {
            customer: { select: { firstName: true, lastName: true } },
            leadTechnician: { select: { firstName: true, lastName: true } },
          },
          orderBy: { scheduledStart: "asc" },
          take: 10,
        }),
        prisma.job.groupBy({
          by: ["leadTechnicianId"],
          where: { tenantId, deletedAt: null, status: { notIn: ["cancelled"] }, completedAt: { gte: startDate } },
          _count: true,
          orderBy: { _count: { leadTechnicianId: "desc" } },
          take: 5,
        }),
      ]);

      const revenueCents = revenueThisPeriod._sum.amountCents ?? 0;
      const prevRevenueCents = revenuePrevPeriod._sum.amountCents ?? 0;

      const pct = (curr: number, prev: number) =>
        prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

      return {
        data: {
          period: query.period,
          metrics: {
            leadsThisPeriod,
            leadChange: pct(leadsThisPeriod, leadsPrevPeriod),
            jobsCompleted,
            jobsChange: pct(jobsCompleted, jobsPrevCompleted),
            revenueCents,
            revenueChange: pct(revenueCents, prevRevenueCents),
            activeJobs,
            overdueInvoicesCount: overdueInvoices._count,
            overdueAmountCents: overdueInvoices._sum.amountDueCents ?? 0,
          },
          leadsBySource: leadsBySource.map((s) => ({
            source: s.source,
            count: s._count,
          })),
          recentJobs,
          topTechnicians,
        },
      };
    }
  );

  // GET /api/v1/analytics/revenue
  fastify.get(
    "/analytics/revenue",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        groupBy: z.enum(["day", "week", "month"]).default("month"),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      }).parse(request.query);

      const from = query.from ? new Date(query.from) : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 11);
        d.setDate(1);
        return d;
      })();
      const to = query.to ? new Date(query.to) : new Date();

      // Raw SQL for time-series grouping
      const payments = await prisma.$queryRaw<Array<{ period: string; amount: number; count: number }>>`
        SELECT
          DATE_TRUNC(${query.groupBy}, "paid_at") as period,
          COALESCE(SUM("amount_cents"), 0)::int as amount,
          COUNT(*)::int as count
        FROM payments
        WHERE "tenant_id" = ${request.tenantId}::uuid
          AND status = 'completed'
          AND "paid_at" >= ${from}
          AND "paid_at" <= ${to}
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      return { data: payments };
    }
  );

  // GET /api/v1/analytics/leads
  fastify.get(
    "/analytics/leads",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      }).parse(request.query);

      const from = query.from ? new Date(query.from) : (() => {
        const d = new Date(); d.setMonth(d.getMonth() - 3); return d;
      })();
      const to = query.to ? new Date(query.to) : new Date();

      const { tenantId } = request;

      const [byStatus, bySource, conversionRate, avgTimeToConvert] = await prisma.$transaction([
        prisma.lead.groupBy({
          by: ["status"],
          where: { tenantId, deletedAt: null, createdAt: { gte: from, lte: to } },
          _count: true,
          orderBy: { status: "asc" },
        }),
        prisma.lead.groupBy({
          by: ["source"],
          where: { tenantId, deletedAt: null, createdAt: { gte: from, lte: to } },
          _count: true,
          orderBy: { _count: { source: "desc" } },
        }),
        prisma.$queryRaw<[{ rate: number }]>`
          SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'converted') / NULLIF(COUNT(*), 0), 1
          )::float as rate
          FROM leads
          WHERE tenant_id = ${tenantId}::uuid
            AND deleted_at IS NULL
            AND created_at >= ${from}
            AND created_at <= ${to}
        `,
        prisma.$queryRaw<[{ avg_days: number }]>`
          SELECT ROUND(AVG(
            EXTRACT(EPOCH FROM (converted_at - created_at)) / 86400
          ), 1)::float as avg_days
          FROM leads
          WHERE tenant_id = ${tenantId}::uuid
            AND status = 'converted'
            AND converted_at IS NOT NULL
            AND created_at >= ${from}
            AND created_at <= ${to}
        `,
      ]);

      return {
        data: {
          byStatus,
          bySource,
          conversionRate: conversionRate[0]?.rate ?? 0,
          avgDaysToConvert: avgTimeToConvert[0]?.avg_days ?? 0,
        },
      };
    }
  );

  // GET /api/v1/analytics/technician-performance
  fastify.get(
    "/analytics/technician-performance",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request) => {
      const query = z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      }).parse(request.query);

      const from = query.from ? new Date(query.from) : (() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1); return d;
      })();
      const to = query.to ? new Date(query.to) : new Date();

      const techStats = await prisma.$queryRaw<Array<{
        user_id: string;
        first_name: string;
        last_name: string;
        jobs_completed: number;
        avg_satisfaction: number;
        total_hours: number;
        on_time_rate: number;
      }>>`
        SELECT
          u.id as user_id,
          u.first_name,
          u.last_name,
          COUNT(DISTINCT j.id) FILTER (WHERE j.completed_at IS NOT NULL AND j.status <> 'cancelled')::int as jobs_completed,
          ROUND(AVG(j.customer_satisfaction) FILTER (WHERE j.customer_satisfaction IS NOT NULL), 1)::float as avg_satisfaction,
          ROUND(COALESCE(SUM(te.duration_minutes) FILTER (WHERE te.duration_minutes IS NOT NULL), 0) / 60.0, 1)::float as total_hours,
          ROUND(100.0 * COUNT(j.id) FILTER (
            WHERE j.completed_at IS NOT NULL
            AND j.actual_end <= j.scheduled_end + interval '30 minutes'
          ) / NULLIF(COUNT(j.id) FILTER (WHERE j.completed_at IS NOT NULL AND j.scheduled_end IS NOT NULL), 0), 1)::float as on_time_rate
        FROM users u
        LEFT JOIN jobs j ON j.lead_technician_id = u.id
          AND j.tenant_id = ${request.tenantId}::uuid
          AND j.completed_at >= ${from}
          AND j.completed_at <= ${to}
          AND j.deleted_at IS NULL
        LEFT JOIN time_entries te ON te.user_id = u.id
          AND te.job_id = j.id
        WHERE u.tenant_id = ${request.tenantId}::uuid
          AND u.deleted_at IS NULL
          AND u.status = 'active'
          AND u.role IN ('technician', 'admin', 'manager', 'owner')
        GROUP BY u.id
        ORDER BY jobs_completed DESC
      `;

      return { data: techStats };
    }
  );
}
