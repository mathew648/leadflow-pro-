import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";

export default async function pushRoutes(fastify: FastifyInstance) {
  // GET /api/v1/push/public-key — VAPID public key for the browser to subscribe with.
  fastify.get("/push/public-key", { preHandler: [fastify.authenticate] }, async () => {
    return { data: { publicKey: config.VAPID_PUBLIC_KEY ?? null } };
  });

  // POST /api/v1/push/subscribe — store this device's push subscription for the current user.
  fastify.post("/push/subscribe", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { subscription } = z.object({
      subscription: z.object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      }),
    }).parse(request.body);

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: request.userId,
        tenantId: request.tenantId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: { userId: request.userId, tenantId: request.tenantId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });
    return reply.status(201).send({ data: { subscribed: true } });
  });

  // POST /api/v1/push/unsubscribe — remove a subscription by endpoint.
  fastify.post("/push/unsubscribe", { preHandler: [fastify.authenticate] }, async (request) => {
    const { endpoint } = z.object({ endpoint: z.string() }).parse(request.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: request.userId } });
    return { data: { unsubscribed: true } };
  });
}
