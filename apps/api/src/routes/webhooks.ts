import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "../lib/prisma.js";
import { enqueueAutomation, enqueueAIScoring } from "../lib/queue.js";
import { normalisePhone } from "../lib/utils.js";
import { config } from "../config.js";
import Stripe from "stripe";

function verifyMeta(req: any, secret: string): boolean {
  try {
    const sig = req.headers["x-hub-signature-256"] as string;
    if (!sig) return false;
    const expected = "sha256=" + createHmac("sha256", secret)
      .update(JSON.stringify(req.body)).digest("hex");
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function verifyStripe(payload: string, sig: string, secret: string): Stripe.Event | null {
  try {
    const stripe = new Stripe(config.STRIPE_SECRET_KEY ?? "");
    return stripe.webhooks.constructEvent(payload, sig, secret);
  } catch {
    return null;
  }
}

export default async function webhooksRoutes(fastify: FastifyInstance) {
  // POST /api/v1/webhooks/meta — Meta Ads / Facebook Lead Ads
  fastify.post("/webhooks/meta", async (request, reply) => {
    // Verification challenge
    const query = request.query as any;
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.META_VERIFY_TOKEN) {
      return reply.status(200).send(query["hub.challenge"]);
    }

    const body = request.body as any;

    // Find tenant by page ID
    const pageId = body?.entry?.[0]?.id;
    if (!pageId) return reply.status(200).send("OK");

    const leadSourceConfig = await prisma.leadSourceConfig.findFirst({
      where: { source: "meta_ads", config: { path: ["pageId"], equals: pageId } },
    });

    if (!leadSourceConfig) return reply.status(200).send("OK");

    // Verify signature with tenant-specific secret
    const tenantSecret = (leadSourceConfig.config as any)?.appSecret;
    if (tenantSecret && !verifyMeta(request, tenantSecret)) {
      return reply.status(401).send("Invalid signature");
    }

    const tenantId = leadSourceConfig.tenantId;

    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change.field !== "leadgen") continue;

        const { leadgen_id: leadgenId, form_id: formId, ad_id: adId } = change.value;

        // Fetch lead data from Meta Graph API
        try {
          const metaToken = (leadSourceConfig.config as any)?.accessToken;
          const metaRes = await fetch(
            `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${metaToken}`
          );
          const leadData = await metaRes.json() as any;

          const fields: Record<string, string> = {};
          for (const f of leadData?.field_data ?? []) {
            fields[f.name] = f.values?.[0] ?? "";
          }

          const defaultStage = await prisma.pipelineStage.findFirst({
            where: { tenantId, isDefault: true },
          });

          await prisma.lead.create({
            data: {
              tenantId,
              source: "meta_ads",
              firstName: fields.first_name ?? fields.full_name?.split(" ")[0] ?? "Unknown",
              lastName: fields.last_name ?? fields.full_name?.split(" ").slice(1).join(" ") ?? "",
              email: fields.email,
              phone: fields.phone_number,
              notes: `Meta Lead Form: ${formId}, Ad: ${adId}`,
              stageId: defaultStage?.id,
              status: "active",
              sourceDetail: "meta",
              sourceFormId: formId,
              sourceAdId: adId,
              rawPayload: { leadgenId, formId, adId },
            },
          }).then(async (lead) => {
            await enqueueAutomation({
              tenantId,
              triggerType: "lead_created",
              entityType: "lead",
              entityId: lead.id,
            });
          });
        } catch (err) {
          fastify.log.error({ err, leadgenId }, "Failed to fetch Meta lead data");
        }
      }
    }

    return reply.status(200).send("OK");
  });

  // POST /api/v1/webhooks/stripe — Stripe payments
  fastify.post(
    "/webhooks/stripe",
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const sig = request.headers["stripe-signature"] as string;
      const rawBody = (request as any).rawBody as string;

      if (!sig || !rawBody) {
        return reply.status(400).send("Missing signature or body");
      }

      const event = verifyStripe(rawBody, sig, config.STRIPE_WEBHOOK_SECRET ?? "");
      if (!event) {
        return reply.status(400).send("Invalid signature");
      }

      switch (event.type) {
        case "payment_intent.succeeded": {
          const pi = event.data.object as Stripe.PaymentIntent;
          const invoiceId = pi.metadata?.invoiceId;
          const tenantId = pi.metadata?.tenantId;

          if (invoiceId && tenantId) {
            const invoice = await prisma.invoice.findFirst({
              where: { id: invoiceId, tenantId },
            });
            if (invoice) {
              const amountCents = pi.amount;
              const newAmountDue = Math.max(0, invoice.amountDueCents - amountCents);

              await prisma.$transaction([
                prisma.payment.create({
                  data: {
                    tenantId,
                    invoiceId,
                    customerId: invoice.customerId,
                    amountCents,
                    currency: pi.currency.toUpperCase(),
                    paymentGateway: "stripe",
                    gatewayTransactionId: pi.id,
                    status: "completed",
                    paidAt: new Date(),
                  },
                }),
                prisma.invoice.update({
                  where: { id: invoiceId },
                  data: {
                    amountDueCents: newAmountDue,
                    amountPaidCents: { increment: amountCents },
                    status: newAmountDue <= 0 ? "paid" : "partial",
                    ...(newAmountDue <= 0 ? { paidAt: new Date() } : {}),
                  },
                }),
              ]);

              if (newAmountDue <= 0) {
                await enqueueAutomation({
                  tenantId,
                  triggerType: "invoice_paid",
                  entityType: "invoice",
                  entityId: invoiceId,
                });
              }
            }
          }
          break;
        }

        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const tenantId = sub.metadata?.tenantId;
          if (tenantId) {
            const status = sub.status === "active" ? "active"
              : sub.status === "trialing" ? "trialing"
              : sub.status === "past_due" ? "past_due"
              : "cancelled";

            await prisma.subscription.updateMany({
              where: { stripeSubscriptionId: sub.id, tenantId },
              data: {
                status: status as any,
                currentPeriodStart: new Date((sub as any).current_period_start * 1000),
                currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
              },
            });
          }
          break;
        }
      }

      return reply.status(200).send({ received: true });
    }
  );

  // POST /api/v1/webhooks/sms/inbound — Vonage inbound SMS
  fastify.post("/webhooks/sms/inbound", async (request, reply) => {
    const body = request.body as any;
    const from = body.msisdn ?? body.from;
    const text = body.text ?? "";
    const toNumber = body.to ?? "";

    if (!from || !text) return reply.status(200).send("OK");

    // Find tenant by the Vonage number configured
    const sourceConfig = await prisma.leadSourceConfig.findFirst({
      where: { source: "sms", config: { path: ["vonageNumber"], equals: toNumber } },
    });

    if (!sourceConfig) return reply.status(200).send("OK");

    const { tenantId } = sourceConfig;

    // Find or create customer by phone
    let customer = await prisma.customer.findFirst({
      where: { tenantId, phone: { endsWith: from.replace(/^\+/, "") } },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId,
          phone: from,
          firstName: "Unknown",
          lastName: "",
          customerNumber: `CUS-${Date.now().toString(36).toUpperCase()}`,
        },
      });
    }

    await prisma.message.create({
      data: {
        tenantId,
        customerId: customer.id,
        channel: "sms",
        direction: "inbound",
        body: text,
        fromNumber: from,
        toNumber: toNumber,
        status: "delivered",
        gatewayMessageId: body["message-id"],
      },
    });

    return reply.status(200).send("OK");
  });

  // POST /api/v1/webhooks/forms/:formKey — public website / landing-page form intake.
  // No auth: the tenant is resolved from the per-tenant form key. Rate-limited + honeypot
  // protected. Mirrors the dedup + automation behaviour of the authenticated POST /leads.
  fastify.post(
    "/webhooks/forms/:formKey",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { formKey } = request.params as { formKey: string };

      const body = z.object({
        // Honeypot — hidden field that real users leave empty and bots fill in.
        companyWebsite: z.string().optional(),
        firstName: z.string().trim().min(1).max(100).optional(),
        lastName: z.string().trim().max(100).optional(),
        name: z.string().trim().max(200).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(30).optional(),
        serviceRequired: z.string().max(500).optional(),
        suburb: z.string().max(100).optional(),
        postcode: z.string().max(10).optional(),
        message: z.string().max(2000).optional(),
        utmSource: z.string().max(100).optional(),
        utmMedium: z.string().max(100).optional(),
        utmCampaign: z.string().max(100).optional(),
      }).parse(request.body ?? {});

      // Honeypot tripped → silently accept and drop (don't tip off bots).
      if (body.companyWebsite && body.companyWebsite.trim() !== "") {
        return reply.status(201).send({ data: { received: true } });
      }

      const firstName = body.firstName ?? body.name?.split(" ")[0] ?? null;
      const lastName = body.lastName ?? (body.name ? body.name.split(" ").slice(1).join(" ") : null);
      if (!firstName) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Name is required" } });
      }
      if (!body.email && !body.phone) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Email or phone is required" } });
      }

      // Resolve the tenant from the form key.
      const sourceConfig = await prisma.leadSourceConfig.findFirst({
        where: { source: "website", isActive: true, config: { path: ["formKey"], equals: formKey } },
      });
      if (!sourceConfig) {
        return reply.status(404).send({ error: { code: "FORM_NOT_FOUND", message: "Unknown or inactive form" } });
      }
      const { tenantId } = sourceConfig;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { country: true },
      });
      const normalisedPhone = body.phone ? normalisePhone(body.phone, tenant?.country ?? "AU") : null;

      // Duplicate guard (same rule as authenticated intake). Public callers get a generic
      // ack so we never reveal whether a contact already exists.
      if (normalisedPhone || body.email) {
        const duplicate = await prisma.lead.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ["active", "converted"] },
            OR: [
              ...(normalisedPhone ? [{ phone: normalisedPhone }] : []),
              ...(body.email ? [{ email: body.email.toLowerCase() }] : []),
            ],
          },
        });
        if (duplicate) {
          return reply.status(201).send({ data: { received: true } });
        }
      }

      const defaultStage = await prisma.pipelineStage.findFirst({
        where: { tenantId, isDefault: true },
      });

      const lead = await prisma.lead.create({
        data: {
          tenantId,
          leadNumber: `LEA-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
          firstName,
          lastName,
          email: body.email?.toLowerCase(),
          phone: normalisedPhone ?? body.phone,
          source: "website",
          sourceDetail: "web_form",
          utmSource: body.utmSource,
          utmMedium: body.utmMedium,
          utmCampaign: body.utmCampaign,
          serviceRequired: body.serviceRequired,
          suburb: body.suburb,
          postcode: body.postcode,
          notes: body.message,
          stageId: defaultStage?.id,
          status: "active",
          rawPayload: { ...body, ip: request.ip },
        },
      });

      await prisma.leadActivity.create({
        data: { tenantId, leadId: lead.id, type: "lead_created", description: "Lead created from website form" },
      });

      await prisma.leadSourceConfig.update({
        where: { id: sourceConfig.id },
        data: { lastEventAt: new Date() },
      });

      // Same automation + AI scoring as every other lead source.
      await enqueueAutomation({
        tenantId,
        triggerType: "lead_created",
        entityType: "lead",
        entityId: lead.id,
        entityData: { source: "website", urgency: lead.urgency },
      });
      await enqueueAIScoring({ tenantId, leadId: lead.id });

      return reply.status(201).send({ data: { received: true } });
    }
  );
}
