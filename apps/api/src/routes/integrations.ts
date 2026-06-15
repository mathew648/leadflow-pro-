import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { encrypt } from "../lib/utils.js";
import { config } from "../config.js";
import Stripe from "stripe";

export default async function integrationsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/integrations  — list connected integrations
  fastify.get(
    "/integrations",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const connections = await prisma.accountingConnection.findMany({
        where: { tenantId: request.tenantId },
        select: {
          id: true, provider: true, status: true, lastSyncAt: true,
          lastSyncStatus: true, providerOrgName: true, createdAt: true,
        },
      });
      return { data: connections };
    }
  );

  // GET /api/v1/integrations/xero/connect  — start OAuth flow
  fastify.get(
    "/integrations/xero/connect",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const state = Buffer.from(JSON.stringify({
        tenantId: request.tenantId,
        userId: request.userId,
        ts: Date.now(),
      })).toString("base64url");

      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.XERO_CLIENT_ID ?? "",
        redirect_uri: config.XERO_REDIRECT_URI ?? "",
        scope: "openid profile email accounting.transactions accounting.contacts offline_access",
        state,
      });

      const authUrl = `https://login.xero.com/identity/connect/authorize?${params}`;
      return { data: { authUrl } };
    }
  );

  // GET /api/v1/integrations/xero/callback  — OAuth callback
  fastify.get(
    "/integrations/xero/callback",
    async (request, reply) => {
      const query = z.object({
        code: z.string(),
        state: z.string(),
      }).parse(request.query);

      let stateData: { tenantId: string; userId: string; ts: number };
      try {
        stateData = JSON.parse(Buffer.from(query.state, "base64url").toString());
      } catch {
        return reply.status(400).send({ error: { code: "INVALID_STATE", message: "Invalid state" } });
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: query.code,
          redirect_uri: config.XERO_REDIRECT_URI ?? "",
          client_id: config.XERO_CLIENT_ID ?? "",
          client_secret: config.XERO_CLIENT_SECRET ?? "",
        }),
      });

      if (!tokenRes.ok) {
        return reply.status(400).send({ error: { code: "TOKEN_ERROR", message: "Failed to get tokens" } });
      }

      const tokens = await tokenRes.json() as any;

      // Get Xero tenant (organisation) info
      const connectionsRes = await fetch("https://api.xero.com/connections", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const connections = await connectionsRes.json() as any[];
      const xeroTenant = connections[0];

      const encryptedAccess = encrypt(tokens.access_token);
      const encryptedRefresh = encrypt(tokens.refresh_token);

      await prisma.accountingConnection.upsert({
        where: { tenantId_provider: { tenantId: stateData.tenantId, provider: "xero" } },
        create: {
          tenantId: stateData.tenantId,
          provider: "xero",
          status: "active",
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          providerOrgId: xeroTenant?.tenantId,
          providerOrgName: xeroTenant?.tenantName,
          lastSyncStatus: "idle",
        },
        update: {
          status: "active",
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          providerOrgId: xeroTenant?.tenantId,
          providerOrgName: xeroTenant?.tenantName,
        },
      });

      // Redirect to settings page
      return reply.redirect(`${config.APP_URL}/settings/integrations?xero=connected`);
    }
  );

  // DELETE /api/v1/integrations/xero
  fastify.delete(
    "/integrations/xero",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      await prisma.accountingConnection.updateMany({
        where: { tenantId: request.tenantId, provider: "xero" },
        data: { status: "disconnected" },
      });
      return { data: { disconnected: true } };
    }
  );

  // POST /api/v1/integrations/xero/sync
  fastify.post(
    "/integrations/xero/sync",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const connection = await prisma.accountingConnection.findFirst({
        where: { tenantId: request.tenantId, provider: "xero", status: "active" },
      });
      if (!connection) {
        return reply.status(404).send({ error: { code: "NOT_CONNECTED", message: "Xero not connected" } });
      }

      const { enqueueAccountingSync } = await import("../lib/queue.js");
      await enqueueAccountingSync({ tenantId: request.tenantId, provider: "xero", fullSync: false });

      return { data: { queued: true } };
    }
  );

  // GET /api/v1/integrations/stripe/setup  — create Stripe Connect account or get onboarding link
  fastify.get(
    "/integrations/stripe/setup",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const stripe = new Stripe(config.STRIPE_SECRET_KEY ?? "");
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        select: { businessName: true, email: true, stripeAccountId: true, country: true },
      });

      let accountId = tenant?.stripeAccountId;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "standard",
          country: tenant?.country ?? "AU",
          email: tenant?.email ?? undefined,
          business_profile: { name: tenant?.businessName ?? undefined },
          metadata: { tenantId: request.tenantId },
        });
        accountId = account.id;

        await prisma.tenant.update({
          where: { id: request.tenantId },
          data: { stripeAccountId: accountId },
        });
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${config.APP_URL}/settings/integrations?stripe=refresh`,
        return_url: `${config.APP_URL}/settings/integrations?stripe=connected`,
        type: "account_onboarding",
      });

      return { data: { url: accountLink.url } };
    }
  );

  // POST /api/v1/integrations/stripe/payment-link  — create payment link for an invoice
  fastify.post(
    "/integrations/stripe/payment-link",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({ invoiceId: z.string().uuid() }).parse(request.body);

      const invoice = await prisma.invoice.findFirst({
        where: { id: body.invoiceId, tenantId: request.tenantId, deletedAt: null },
        include: { customer: true, tenant: true },
      });
      if (!invoice) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found" } });
      }

      const stripe = new Stripe(config.STRIPE_SECRET_KEY ?? "");

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: { name: `Invoice ${invoice.invoiceNumber} — ${invoice.tenant.businessName}` },
            unit_amount: invoice.amountDueCents,
          },
          quantity: 1,
        }],
        customer_email: invoice.customer.email ?? undefined,
        metadata: {
          tenantId: request.tenantId,
          invoiceId: invoice.id,
        },
        success_url: `${config.APP_URL}/pay/${invoice.portalToken}?paid=1`,
        cancel_url: `${config.APP_URL}/pay/${invoice.portalToken}`,
      });

      return { data: { url: session.url, sessionId: session.id } };
    }
  );
}
