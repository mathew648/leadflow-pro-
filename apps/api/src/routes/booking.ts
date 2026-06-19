import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { normalisePhone } from "../lib/utils.js";
import { enqueueAutomation, enqueueAIScoring } from "../lib/queue.js";
import { notifyBusiness } from "../lib/notify.js";

const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Business-hours slots for a given date (no TZ math — wall-clock times the tenant set). */
function slotsForDate(businessHours: any, dateStr: string, slotMin: number): string[] {
  const day = DOW[new Date(dateStr + "T00:00:00").getDay()];
  const h = businessHours?.[day];
  if (!h || !h.enabled || !h.open || !h.close) return [];
  const start = toMin(h.open), end = toMin(h.close);
  const out: string[] = [];
  for (let t = start; t + slotMin <= end; t += slotMin) out.push(fmt(t));
  return out;
}

export default async function bookingRoutes(fastify: FastifyInstance) {
  // GET /api/v1/public/booking/:slug — booking page config + branding
  fastify.get("/public/booking/:slug", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(request.params);
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, businessName: true, logoUrl: true, primaryColor: true, suburb: true, phone: true } });
    if (!tenant) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Page not found" } });
    const s = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } });
    if (!s?.bookingEnabled) return reply.status(404).send({ error: { code: "DISABLED", message: "Online booking isn't enabled" } });
    return {
      data: {
        businessName: tenant.businessName,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor ?? "#2563EB",
        suburb: tenant.suburb,
        phone: tenant.phone,
        services: (s.bookingServices as any) ?? [],
        slotMinutes: s.bookingSlotMinutes,
        leadTimeHours: s.bookingLeadTimeHours,
        advanceDays: s.bookingAdvanceDays,
        instructions: s.bookingInstructions,
      },
    };
  });

  // GET /api/v1/public/booking/:slug/slots?date=YYYY-MM-DD — available time slots
  fastify.get("/public/booking/:slug/slots", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(request.params);
    const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(request.query);
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    const s = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } });
    if (!s?.bookingEnabled) return { data: { slots: [] } };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const minDate = new Date(today); minDate.setDate(minDate.getDate() + Math.ceil((s.bookingLeadTimeHours ?? 24) / 24));
    const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + (s.bookingAdvanceDays ?? 30));
    const d = new Date(date + "T00:00:00");
    if (d < minDate || d > maxDate) return { data: { slots: [] } };

    return { data: { slots: slotsForDate(s.businessHours, date, s.bookingSlotMinutes ?? 60) } };
  });

  // POST /api/v1/public/booking/:slug — submit a booking → creates a lead with the requested time
  fastify.post("/public/booking/:slug", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(request.params);
    const body = z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().max(100).optional(),
      email: z.string().email().optional(),
      phone: z.string().min(5).max(30),
      service: z.string().max(200).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.string().regex(/^\d{2}:\d{2}$/),
      address: z.string().max(300).optional(),
      notes: z.string().max(2000).optional(),
    }).parse(request.body);

    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, country: true } });
    if (!tenant) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    const s = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } });
    if (!s?.bookingEnabled) return reply.status(404).send({ error: { code: "DISABLED", message: "Booking isn't enabled" } });

    const tenantId = tenant.id;
    const preferred = new Date(`${body.date}T${body.slot}:00`);
    const phone = normalisePhone(body.phone, tenant.country ?? "AU");
    const defaultStage = await prisma.pipelineStage.findFirst({ where: { tenantId, isDefault: true } });
    const niceWhen = `${preferred.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} at ${body.slot}`;

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        source: "website",
        sourceDetail: "Online booking",
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email?.toLowerCase(),
        phone,
        serviceRequired: body.service,
        propertyAddress: body.address,
        preferredStartDate: preferred,
        notes: `Online booking request: ${niceWhen}${body.notes ? ` — ${body.notes}` : ""}`,
        stageId: defaultStage?.id,
        status: "active",
        rawPayload: { booking: { date: body.date, slot: body.slot, service: body.service } } as any,
      },
    });
    await prisma.leadActivity.create({ data: { tenantId, leadId: lead.id, type: "lead_created", description: `Online booking: ${niceWhen}` } }).catch(() => {});
    await enqueueAutomation({ tenantId, triggerType: "lead_created", entityType: "lead", entityId: lead.id, entityData: { source: "booking" } });
    await enqueueAIScoring({ tenantId, leadId: lead.id });
    notifyBusiness(tenantId, "new_lead", {
      summary: `New booking: <b>${lead.firstName}</b>${body.service ? ` — ${body.service}` : ""} (${niceWhen})`,
      link: `/leads/${lead.id}`,
      sms: `New booking: ${lead.firstName} ${phone ?? ""} — ${niceWhen}. Open TradieJet.`,
    }).catch(() => {});

    return reply.status(201).send({ data: { received: true, when: niceWhen } });
  });
}
