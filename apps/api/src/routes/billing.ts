import { FastifyInstance } from "fastify";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { PLANS, planPriceCents, type PlanId } from "../lib/plans.js";

export default async function billingRoutes(fastify: FastifyInstance) {
  // GET /api/v1/billing/plans — public-ish plan catalogue for the upgrade UI.
  fastify.get("/billing/plans", { preHandler: [fastify.authenticate] }, async (request) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: { country: true },
    });
    const country = tenant?.country ?? "AU";
    return {
      data: Object.values(PLANS).map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: planPriceCents(p, country),
        currency: country === "NZ" ? "NZD" : "AUD",
        maxUsers: p.maxUsers,
        accountType: p.accountType,
        blurb: p.blurb,
        features: p.features,
      })),
    };
  });

  // POST /api/v1/billing/checkout — start a Stripe Checkout session to subscribe to a plan.
  fastify.post(
    "/billing/checkout",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const { plan } = z.object({ plan: z.enum(["sole_trader", "company", "website", "non_tradie"]) }).parse(request.body);

      if (!config.STRIPE_SECRET_KEY) {
        return reply.status(503).send({ error: { code: "BILLING_UNAVAILABLE", message: "Billing is not configured" } });
      }

      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: request.tenantId },
        select: { businessName: true, email: true, country: true, currency: true },
      });
      const subscription = await prisma.subscription.findUnique({ where: { tenantId: request.tenantId } });

      const stripe = new Stripe(config.STRIPE_SECRET_KEY);

      // Ensure a Stripe customer exists for this tenant (so they can manage billing later).
      let customerId = subscription?.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: tenant.businessName,
          email: tenant.email,
          metadata: { tenantId: request.tenantId },
        });
        customerId = customer.id;
        await prisma.subscription.update({
          where: { tenantId: request.tenantId },
          data: { stripeCustomerId: customerId },
        });
      }

      const planDef = PLANS[plan as PlanId];
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: (tenant.currency ?? "AUD").toLowerCase(),
              product_data: { name: `LeadFlow Pro — ${planDef.name}` },
              recurring: { interval: "month" },
              unit_amount: planPriceCents(planDef, tenant.country),
            },
            quantity: 1,
          },
        ],
        subscription_data: { metadata: { tenantId: request.tenantId, plan } },
        metadata: { tenantId: request.tenantId, plan },
        success_url: `${config.APP_URL}/settings?billing=success`,
        cancel_url: `${config.APP_URL}/settings?billing=cancelled`,
      });

      return { data: { url: session.url } };
    }
  );

  // POST /api/v1/billing/portal — open the Stripe billing portal to manage/cancel.
  fastify.post(
    "/billing/portal",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      if (!config.STRIPE_SECRET_KEY) {
        return reply.status(503).send({ error: { code: "BILLING_UNAVAILABLE", message: "Billing is not configured" } });
      }
      const subscription = await prisma.subscription.findUnique({ where: { tenantId: request.tenantId } });
      if (!subscription?.stripeCustomerId) {
        return reply.status(404).send({ error: { code: "NO_CUSTOMER", message: "No billing account yet — subscribe first" } });
      }
      const stripe = new Stripe(config.STRIPE_SECRET_KEY);
      const portal = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${config.APP_URL}/settings`,
      });
      return { data: { url: portal.url } };
    }
  );
}
