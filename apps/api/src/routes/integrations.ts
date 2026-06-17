import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/utils.js";
import { MYOB_AUTH_URL, MYOB_API_BASE } from "../lib/myob.js";
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

  // ── MYOB (mirrors Xero) ──

  // GET /api/v1/integrations/myob/connect
  fastify.get(
    "/integrations/myob/connect",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      const state = Buffer.from(JSON.stringify({ tenantId: request.tenantId, userId: request.userId, ts: Date.now() })).toString("base64url");
      const params = new URLSearchParams({
        client_id: config.MYOB_CLIENT_ID ?? "",
        redirect_uri: config.MYOB_REDIRECT_URI ?? "",
        response_type: "code",
        scope: "CompanyFile",
        state,
      });
      return { data: { authUrl: `${MYOB_AUTH_URL}?${params}` } };
    }
  );

  // GET /api/v1/integrations/myob/callback
  fastify.get("/integrations/myob/callback", async (request, reply) => {
    const query = z.object({ code: z.string(), state: z.string() }).parse(request.query);
    let stateData: { tenantId: string };
    try {
      stateData = JSON.parse(Buffer.from(query.state, "base64url").toString());
    } catch {
      return reply.status(400).send({ error: { code: "INVALID_STATE", message: "Invalid state" } });
    }

    const tokenRes = await fetch("https://secure.myob.com/oauth2/v1/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: query.code,
        redirect_uri: config.MYOB_REDIRECT_URI ?? "",
        client_id: config.MYOB_CLIENT_ID ?? "",
        client_secret: config.MYOB_CLIENT_SECRET ?? "",
      }),
    });
    if (!tokenRes.ok) {
      return reply.status(400).send({ error: { code: "TOKEN_ERROR", message: "Failed to get MYOB tokens" } });
    }
    const tokens = (await tokenRes.json()) as any;

    // List the user's company files; use the first one.
    const cfRes = await fetch(MYOB_API_BASE, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "x-myobapi-key": config.MYOB_CLIENT_ID ?? "",
        "x-myobapi-version": "v2",
        Accept: "application/json",
      },
    });
    const companyFiles = (await cfRes.json().catch(() => [])) as any[];
    const cf = Array.isArray(companyFiles) ? companyFiles[0] : companyFiles?.[0];

    await prisma.accountingConnection.upsert({
      where: { tenantId_provider: { tenantId: stateData.tenantId, provider: "myob" } },
      create: {
        tenantId: stateData.tenantId,
        provider: "myob",
        status: "active",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        providerOrgId: cf?.Uri,
        providerOrgName: cf?.Name,
        lastSyncStatus: "idle",
      },
      update: {
        status: "active",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        providerOrgId: cf?.Uri,
        providerOrgName: cf?.Name,
      },
    });

    return reply.redirect(`${config.APP_URL}/settings?myob=connected`);
  });

  // DELETE /api/v1/integrations/myob
  fastify.delete(
    "/integrations/myob",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      await prisma.accountingConnection.updateMany({
        where: { tenantId: request.tenantId, provider: "myob" },
        data: { status: "disconnected" },
      });
      return { data: { disconnected: true } };
    }
  );

  // POST /api/v1/integrations/myob/sync
  fastify.post(
    "/integrations/myob/sync",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const connection = await prisma.accountingConnection.findFirst({
        where: { tenantId: request.tenantId, provider: "myob", status: "active" },
      });
      if (!connection) {
        return reply.status(404).send({ error: { code: "NOT_CONNECTED", message: "MYOB not connected" } });
      }
      const { enqueueAccountingSync } = await import("../lib/queue.js");
      await enqueueAccountingSync({ tenantId: request.tenantId, provider: "myob", fullSync: false });
      return { data: { queued: true } };
    }
  );

  // POST /api/v1/integrations/:provider/import — pull existing customers + items into LeadFlow
  fastify.post(
    "/integrations/:provider/import",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const { provider } = z.object({ provider: z.enum(["xero", "myob"]) }).parse(request.params);
      try {
        const { importFromXero, importFromMyob } = await import("../lib/accounting-import.js");
        const result = provider === "xero"
          ? await importFromXero(request.tenantId)
          : await importFromMyob(request.tenantId);
        return { data: result };
      } catch (err: any) {
        if (typeof err?.message === "string" && err.message.includes("not connected")) {
          return reply.status(404).send({ error: { code: "NOT_CONNECTED", message: `${provider} not connected` } });
        }
        return reply.status(502).send({ error: { code: "IMPORT_FAILED", message: err?.message ?? "Import failed" } });
      }
    }
  );

  // ── Meta (Facebook / Instagram) Lead Ads — self-serve connect ──
  const FB = "https://graph.facebook.com/v18.0";

  // GET /api/v1/integrations/meta/connect — start Facebook Login
  fastify.get(
    "/integrations/meta/connect",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      if (!config.META_APP_ID || !config.META_REDIRECT_URI) {
        return reply.status(503).send({ error: { code: "META_NOT_CONFIGURED", message: "Meta app not configured" } });
      }
      const state = Buffer.from(JSON.stringify({ tenantId: request.tenantId, ts: Date.now() })).toString("base64url");
      const params = new URLSearchParams({
        client_id: config.META_APP_ID,
        redirect_uri: config.META_REDIRECT_URI,
        state,
        response_type: "code",
        scope: "pages_show_list,pages_manage_metadata,pages_read_engagement,leads_retrieval,business_management",
      });
      return { data: { authUrl: `https://www.facebook.com/v18.0/dialog/oauth?${params}` } };
    }
  );

  // GET /api/v1/integrations/meta/callback — Facebook redirects here
  fastify.get("/integrations/meta/callback", async (request, reply) => {
    const query = z.object({ code: z.string().optional(), state: z.string(), error: z.string().optional() }).parse(request.query);
    let stateData: { tenantId: string };
    try { stateData = JSON.parse(Buffer.from(query.state, "base64url").toString()); }
    catch { return reply.status(400).send({ error: { code: "INVALID_STATE", message: "Invalid state" } }); }
    if (!query.code) return reply.redirect(`${config.APP_URL}/settings?tab=leadsources&meta=denied`);

    // Exchange code for a user access token
    const tokenRes = await fetch(`${FB}/oauth/access_token?` + new URLSearchParams({
      client_id: config.META_APP_ID ?? "",
      client_secret: config.META_APP_SECRET ?? "",
      redirect_uri: config.META_REDIRECT_URI ?? "",
      code: query.code,
    }));
    const tokens = (await tokenRes.json()) as any;
    if (!tokens.access_token) return reply.redirect(`${config.APP_URL}/settings?tab=leadsources&meta=error`);

    // Store the user token (encrypted) so the tenant can then pick which Page to connect.
    await prisma.leadSourceConfig.upsert({
      where: { tenantId_source: { tenantId: stateData.tenantId, source: "meta_ads" } },
      create: { tenantId: stateData.tenantId, source: "meta_ads", isActive: false, config: { userToken: encrypt(tokens.access_token), stage: "pick" } },
      update: { isActive: false, config: { userToken: encrypt(tokens.access_token), stage: "pick" } },
    });
    return reply.redirect(`${config.APP_URL}/settings?tab=leadsources&meta=pick`);
  });

  // GET /api/v1/integrations/meta/status — connection state (+ pages to pick if mid-connect)
  fastify.get(
    "/integrations/meta/status",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const cfg = await prisma.leadSourceConfig.findUnique({
        where: { tenantId_source: { tenantId: request.tenantId, source: "meta_ads" } },
      });
      const c = (cfg?.config as any) ?? {};
      if (cfg?.isActive && c.pageId) {
        return { data: { connected: true, pageName: c.pageName } };
      }
      if (c.userToken) {
        // List the user's Pages so they can choose which to connect.
        const res = await fetch(`${FB}/me/accounts?` + new URLSearchParams({ access_token: decrypt(c.userToken), fields: "id,name" }));
        const json = (await res.json()) as any;
        const pages = (json?.data ?? []).map((p: any) => ({ id: p.id, name: p.name }));
        return { data: { connected: false, pages } };
      }
      return { data: { connected: false, pages: [] } };
    }
  );

  // POST /api/v1/integrations/meta/subscribe — connect a chosen Page and subscribe it to leadgen
  fastify.post(
    "/integrations/meta/subscribe",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const { pageId } = z.object({ pageId: z.string() }).parse(request.body);
      const cfg = await prisma.leadSourceConfig.findUnique({
        where: { tenantId_source: { tenantId: request.tenantId, source: "meta_ads" } },
      });
      const c = (cfg?.config as any) ?? {};
      if (!c.userToken) return reply.status(400).send({ error: { code: "NOT_CONNECTED", message: "Connect Facebook first" } });

      // Get the page access token + name
      const pagesRes = await fetch(`${FB}/me/accounts?` + new URLSearchParams({ access_token: decrypt(c.userToken), fields: "id,name,access_token" }));
      const pagesJson = (await pagesRes.json()) as any;
      const page = (pagesJson?.data ?? []).find((p: any) => p.id === pageId);
      if (!page) return reply.status(404).send({ error: { code: "PAGE_NOT_FOUND", message: "Page not found on your account" } });

      // Subscribe the Page to leadgen webhooks for our app
      const subRes = await fetch(`${FB}/${pageId}/subscribed_apps?` + new URLSearchParams({
        subscribed_fields: "leadgen",
        access_token: page.access_token,
      }), { method: "POST" });
      const subJson = (await subRes.json()) as any;
      if (!subJson.success) {
        return reply.status(502).send({ error: { code: "SUBSCRIBE_FAILED", message: subJson?.error?.message ?? "Could not subscribe Page" } });
      }

      await prisma.leadSourceConfig.update({
        where: { tenantId_source: { tenantId: request.tenantId, source: "meta_ads" } },
        data: { isActive: true, config: { pageId, pageName: page.name, accessToken: encrypt(page.access_token) } },
      });
      return { data: { connected: true, pageName: page.name } };
    }
  );

  // DELETE /api/v1/integrations/meta — disconnect
  fastify.delete(
    "/integrations/meta",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request) => {
      await prisma.leadSourceConfig.updateMany({
        where: { tenantId: request.tenantId, source: "meta_ads" },
        data: { isActive: false, config: {} },
      });
      return { data: { disconnected: true } };
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
