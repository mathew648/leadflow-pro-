import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { enqueueEmail } from "../lib/queue.js";
import { config } from "../config.js";

// ─── Support hours: 11am–7pm NZ time, Mon–Fri ───
const SUPPORT_TZ = "Pacific/Auckland";
const OPEN_HOUR = 11;
const CLOSE_HOUR = 19;
const HOURS_LABEL = "11am–7pm NZT, Mon–Fri";

function hoursStatus(): { open: boolean; hours: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: SUPPORT_TZ, hourCycle: "h23", hour: "2-digit", weekday: "short" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const open = weekday !== "Sat" && weekday !== "Sun" && hour >= OPEN_HOUR && hour < CLOSE_HOUR;
  return { open, hours: HOURS_LABEL };
}

export default async function supportRoutes(fastify: FastifyInstance) {
  // ════════════════════ TRADIE SIDE (authenticated tenant user) ════════════════════

  // GET /api/v1/support/hours — availability for the Contact Support widget
  fastify.get("/support/hours", { preHandler: [fastify.authenticate] }, async () => ({ data: hoursStatus() }));

  // GET /api/v1/support/unread — count of tickets with an unread agent reply (for the button badge)
  fastify.get("/support/unread", { preHandler: [fastify.authenticate] }, async (request) => {
    const tickets = await prisma.supportTicket.findMany({
      where: { tenantId: request.tenantId },
      select: { customerLastReadAt: true, messages: { where: { senderType: { in: ["agent", "system"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    });
    const unread = tickets.filter((t) => t.messages[0] && (!t.customerLastReadAt || t.messages[0].createdAt > t.customerLastReadAt)).length;
    return { data: { unread } };
  });

  // GET /api/v1/support/tickets — the tradie's own tickets
  fastify.get("/support/tickets", { preHandler: [fastify.authenticate] }, async (request) => {
    const tickets = await prisma.supportTicket.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true, subject: true, status: true, channel: true, lastMessageAt: true, createdAt: true },
    });
    return { data: tickets };
  });

  // POST /api/v1/support/tickets — open a ticket (email or chat)
  fastify.post("/support/tickets", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = z.object({
      subject: z.string().min(1).max(255),
      message: z.string().min(1),
      category: z.string().max(50).optional(),
      channel: z.enum(["email", "chat"]).default("chat"),
    }).parse(request.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: request.tenantId }, select: { businessName: true } });

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: request.tenantId,
        createdById: request.userId,
        businessName: tenant?.businessName,
        customerName: request.jwtUser.name,
        customerEmail: request.jwtUser.email,
        subject: body.subject,
        category: body.category,
        channel: body.channel,
        status: "open",
        lastMessageAt: new Date(),
        customerLastReadAt: new Date(),
        messages: { create: { senderType: "tradie", senderName: request.jwtUser.name, body: body.message } },
      },
    });

    // For the email channel (or out-of-hours), let the team know by email too.
    // reply-to the tradie so answering from the support inbox reaches them directly.
    enqueueEmail({
      to: config.SUPPORT_EMAIL,
      replyTo: request.jwtUser.email,
      subject: `New support ${body.channel === "email" ? "request" : "chat"}: ${body.subject}`,
      template: "custom",
      data: { businessName: "TradieJet", body: `<p><strong>${tenant?.businessName ?? "A tradie"}</strong> (${request.jwtUser.email}) opened a ${body.channel} ticket:</p><p><em>${body.subject}</em></p><p>${body.message}</p>` },
    }).catch(() => {});

    return reply.status(201).send({ data: { id: ticket.id, status: ticket.status, channel: ticket.channel, open: hoursStatus().open } });
  });

  // GET /api/v1/support/tickets/:id — ticket + messages (marks agent replies read)
  fastify.get("/support/tickets/:id", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    await prisma.supportTicket.update({ where: { id }, data: { customerLastReadAt: new Date() } });
    return { data: ticket };
  });

  // POST /api/v1/support/tickets/:id/messages — tradie replies
  fastify.post("/support/tickets/:id/messages", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ message: z.string().min(1) }).parse(request.body);
    const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!ticket) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Ticket not found" } });

    const msg = await prisma.supportMessage.create({ data: { ticketId: id, senderType: "tradie", senderName: request.jwtUser.name, body: body.message } });
    await prisma.supportTicket.update({
      where: { id },
      data: { lastMessageAt: new Date(), customerLastReadAt: new Date(), status: ticket.status === "resolved" || ticket.status === "closed" ? "open" : ticket.status },
    });
    return reply.status(201).send({ data: msg });
  });

  // ════════════════════ AGENT SIDE (separate login) ════════════════════

  // POST /api/v1/support/agent/login
  fastify.post("/support/agent/login", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(request.body);
    const agent = await prisma.supportAgent.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    if (!agent || !agent.isActive || !(await bcrypt.compare(body.password, agent.passwordHash))) {
      return reply.status(401).send({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }
    const accessToken = fastify.jwt.sign({ sub: agent.id, tid: "", email: agent.email, role: "agent", name: agent.name, type: "agent" }, { expiresIn: "12h" });
    return { data: { accessToken, agent: { id: agent.id, name: agent.name, email: agent.email } } };
  });

  // GET /api/v1/support/agent/me
  fastify.get("/support/agent/me", { preHandler: [fastify.authenticateAgent] }, async (request, reply) => {
    const agent = await prisma.supportAgent.findUnique({ where: { id: request.agentId }, select: { id: true, name: true, email: true } });
    if (!agent) return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Agent not found" } });
    return { data: { ...agent, hours: hoursStatus() } };
  });

  // GET /api/v1/support/agent/tickets?status=open|pending|resolved|all
  fastify.get("/support/agent/tickets", { preHandler: [fastify.authenticateAgent] }, async (request) => {
    const q = z.object({ status: z.enum(["open", "pending", "resolved", "closed", "all"]).default("all") }).parse(request.query);
    const where = q.status === "all" ? {} : { status: q.status };
    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
      take: 200,
      include: {
        assignedAgent: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderType: true, createdAt: true } },
      },
    });
    const rows = tickets.map((t) => ({
      id: t.id, subject: t.subject, businessName: t.businessName, customerName: t.customerName, customerEmail: t.customerEmail,
      status: t.status, channel: t.channel, category: t.category, lastMessageAt: t.lastMessageAt, createdAt: t.createdAt,
      assignedAgent: t.assignedAgent?.name ?? null,
      lastMessage: t.messages[0]?.body ?? null,
      unread: !!t.messages[0] && t.messages[0].senderType === "tradie" && (!t.agentLastReadAt || t.messages[0].createdAt > t.agentLastReadAt),
    }));
    const counts = {
      open: rows.filter((r) => r.status === "open").length,
      pending: rows.filter((r) => r.status === "pending").length,
      unread: rows.filter((r) => r.unread).length,
    };
    return { data: rows, meta: { counts } };
  });

  // GET /api/v1/support/agent/tickets/:id — full thread (marks tradie messages read)
  fastify.get("/support/agent/tickets/:id", { preHandler: [fastify.authenticateAgent] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } }, assignedAgent: { select: { name: true } } },
    });
    if (!ticket) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    await prisma.supportTicket.update({ where: { id }, data: { agentLastReadAt: new Date() } });
    return { data: ticket };
  });

  // POST /api/v1/support/agent/tickets/:id/messages — agent replies (auto-assigns to them)
  fastify.post("/support/agent/tickets/:id/messages", { preHandler: [fastify.authenticateAgent] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ message: z.string().min(1) }).parse(request.body);
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    const agent = await prisma.supportAgent.findUnique({ where: { id: request.agentId }, select: { name: true } });

    const msg = await prisma.supportMessage.create({ data: { ticketId: id, senderType: "agent", senderName: agent?.name, agentId: request.agentId, body: body.message } });
    await prisma.supportTicket.update({
      where: { id },
      data: { lastMessageAt: new Date(), agentLastReadAt: new Date(), assignedAgentId: ticket.assignedAgentId ?? request.agentId, status: ticket.status === "open" ? "pending" : ticket.status },
    });

    // Email the tradie the reply if this is an email ticket or they're likely offline (out of hours).
    if ((ticket.channel === "email" || !hoursStatus().open) && ticket.customerEmail) {
      enqueueEmail({
        tenantId: ticket.tenantId,
        to: ticket.customerEmail,
        replyTo: config.SUPPORT_EMAIL,
        subject: `Re: ${ticket.subject} — TradieJet Support`,
        template: "custom",
        data: { businessName: "TradieJet", body: `<p>${agent?.name ?? "Our support team"} replied to your support request:</p><blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#444;">${body.message}</blockquote><p>Log in to TradieJet and open <strong>Support</strong> to continue the conversation.</p>` },
      }).catch(() => {});
    }
    return reply.status(201).send({ data: msg });
  });

  // PATCH /api/v1/support/agent/tickets/:id — status / assignment
  fastify.patch("/support/agent/tickets/:id", { preHandler: [fastify.authenticateAgent] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
      assignToMe: z.boolean().optional(),
    }).parse(request.body);
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        status: body.status,
        resolvedAt: body.status === "resolved" ? new Date() : body.status === "open" ? null : ticket.resolvedAt,
        assignedAgentId: body.assignToMe ? request.agentId : ticket.assignedAgentId,
      },
    });
    return { data: updated };
  });
}
