import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { enqueueSms, enqueueEmail } from "../lib/queue.js";

export default async function messagesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/messages  — inbox (all threads grouped by contact)
  fastify.get(
    "/messages",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        channel: z.enum(["sms", "email", "whatsapp"]).optional(),
        customerId: z.string().uuid().optional(),
        unreadOnly: z.coerce.boolean().optional(),
        limit: z.coerce.number().default(30),
        offset: z.coerce.number().default(0),
      }).parse(request.query);

      const where: any = {
        tenantId: request.tenantId,
        ...(query.channel && { channel: query.channel }),
        ...(query.customerId && { customerId: query.customerId }),
        ...(query.unreadOnly && { readAt: null, direction: "inbound" }),
      };

      // Latest message per customer thread
      const threads = await prisma.$queryRaw<Array<{
        customer_id: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        email: string | null;
        last_message: string;
        last_message_at: Date;
        unread_count: number;
        channel: string;
      }>>`
        SELECT
          c.id as customer_id,
          c.first_name,
          c.last_name,
          c.phone,
          c.email,
          m.body as last_message,
          m.created_at as last_message_at,
          COUNT(m2.id) FILTER (WHERE m2.direction = 'inbound' AND m2.read_at IS NULL)::int as unread_count,
          m.channel
        FROM customers c
        JOIN LATERAL (
          SELECT * FROM messages
          WHERE tenant_id = ${request.tenantId}
            AND customer_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON true
        LEFT JOIN messages m2 ON m2.customer_id = c.id AND m2.tenant_id = ${request.tenantId}
        WHERE c.tenant_id = ${request.tenantId}
          AND c.deleted_at IS NULL
        GROUP BY c.id, m.body, m.created_at, m.channel
        ORDER BY m.created_at DESC
        LIMIT ${query.limit} OFFSET ${query.offset}
      `;

      return { data: threads };
    }
  );

  // GET /api/v1/messages/conversation/:customerId
  fastify.get(
    "/messages/conversation/:customerId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { customerId } = request.params as { customerId: string };
      const query = z.object({
        channel: z.enum(["sms", "email", "whatsapp"]).optional(),
        limit: z.coerce.number().default(50),
        before: z.string().datetime().optional(),
      }).parse(request.query);

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId: request.tenantId, deletedAt: null },
      });
      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      const messages = await prisma.message.findMany({
        where: {
          tenantId: request.tenantId,
          customerId,
          ...(query.channel && { channel: query.channel }),
          ...(query.before && { createdAt: { lt: new Date(query.before) } }),
        },
        orderBy: { createdAt: "desc" },
        take: query.limit,
      });

      // Mark inbound messages as read
      await prisma.message.updateMany({
        where: {
          tenantId: request.tenantId,
          customerId,
          direction: "inbound",
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return { data: messages.reverse() };
    }
  );

  // POST /api/v1/messages/send
  fastify.post(
    "/messages/send",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({
        customerId: z.string().uuid(),
        channel: z.enum(["sms", "email", "whatsapp"]),
        message: z.string().min(1).max(1600),
        subject: z.string().optional(), // email subject
        leadId: z.string().uuid().optional(),
        jobId: z.string().uuid().optional(),
      }).parse(request.body);

      const customer = await prisma.customer.findFirst({
        where: { id: body.customerId, tenantId: request.tenantId, deletedAt: null },
      });
      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      // Validate channel contact exists
      if (body.channel === "sms" && !customer.phone) {
        return reply.status(422).send({ error: { code: "NO_PHONE", message: "Customer has no phone number" } });
      }
      if (body.channel === "email" && !customer.email) {
        return reply.status(422).send({ error: { code: "NO_EMAIL", message: "Customer has no email address" } });
      }

      const msg = await prisma.message.create({
        data: {
          tenantId: request.tenantId,
          customerId: body.customerId,
          leadId: body.leadId,
          jobId: body.jobId,
          channel: body.channel as any,
          direction: "outbound",
          body: body.message,
          subject: body.subject,
          toEmail: body.channel === "email" ? customer.email : undefined,
          toNumber: body.channel !== "email" ? customer.phone : undefined,
          status: "queued",
        },
      });

      // Queue the actual send
      if (body.channel === "sms") {
        await enqueueSms({
          tenantId: request.tenantId,
          messageId: msg.id,
          to: customer.phone!,
          body: body.message,
        });
      } else if (body.channel === "email") {
        await enqueueEmail({
          tenantId: request.tenantId,
          messageId: msg.id,
          template: "custom",
          to: customer.email!,
          subject: body.subject ?? `Message from us`,
          data: { body: body.message },
        });
      }

      return reply.status(201).send({ data: msg });
    }
  );

  // GET /api/v1/messages/unread-count
  fastify.get(
    "/messages/unread-count",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const count = await prisma.message.count({
        where: {
          tenantId: request.tenantId,
          direction: "inbound",
          readAt: null,
        },
      });
      return { data: { count } };
    }
  );
}
