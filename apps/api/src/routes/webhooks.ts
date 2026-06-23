import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "../lib/prisma.js";
import { enqueueAutomation, enqueueAIScoring } from "../lib/queue.js";
import { syncEntityToAccounting } from "../lib/accounting.js";
import { normalisePhone, decrypt } from "../lib/utils.js";
import { notifyBusiness } from "../lib/notify.js";
import { PLANS, planPriceCents, type PlanId } from "../lib/plans.js";
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

// Try each configured secret — the platform endpoint and the Connect (connected-accounts)
// endpoint have different signing secrets, and connected-account charge events arrive on the latter.
function verifyStripe(payload: string, sig: string, secrets: (string | undefined)[]): Stripe.Event | null {
  const stripe = new Stripe(config.STRIPE_SECRET_KEY ?? "");
  for (const secret of secrets) {
    if (!secret) continue;
    try { return stripe.webhooks.constructEvent(payload, sig, secret); } catch { /* try the next secret */ }
  }
  return null;
}

// Verify a Resend (Svix-signed) webhook. Signed content is `${id}.${timestamp}.${rawBody}`,
// HMAC-SHA256 with the base64 secret (after the `whsec_` prefix), compared to the v1 signatures.
function verifyResendSignature(req: any, secret: string): boolean {
  try {
    const id = req.headers["svix-id"];
    const ts = req.headers["svix-timestamp"];
    const sigHeader = req.headers["svix-signature"];
    const raw = req.rawBody;
    if (!id || !ts || !sigHeader || !raw) return false;
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const expected = createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
    const sigs = String(sigHeader).split(" ").map((s) => s.split(",")[1]).filter(Boolean);
    return sigs.some((s) => {
      try { return timingSafeEqual(Buffer.from(s), Buffer.from(expected)); } catch { return false; }
    });
  } catch {
    return false;
  }
}

// Resend's inbound webhook only carries metadata — fetch the parsed body via the API.
async function fetchResendReceivedEmail(emailId?: string): Promise<any | null> {
  if (!emailId || !config.RESEND_API_KEY) return null;
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${config.RESEND_API_KEY}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function webhooksRoutes(fastify: FastifyInstance) {
  // GET /api/v1/webhooks/meta — Meta sends the webhook verification challenge as a GET.
  fastify.get("/webhooks/meta", async (request, reply) => {
    const q = request.query as any;
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === config.META_VERIFY_TOKEN) {
      return reply.status(200).send(q["hub.challenge"]);
    }
    return reply.status(403).send("Forbidden");
  });

  // POST /api/v1/webhooks/meta — Meta Ads / Facebook Lead Ads
  fastify.post("/webhooks/meta", async (request, reply) => {
    const body = request.body as any;

    // Find tenant by page ID
    const pageId = body?.entry?.[0]?.id;
    if (!pageId) return reply.status(200).send("OK");

    const leadSourceConfig = await prisma.leadSourceConfig.findFirst({
      where: { source: "meta_ads", config: { path: ["pageId"], equals: pageId } },
    });

    if (!leadSourceConfig) return reply.status(200).send("OK");

    // Verify signature with our app secret (single Meta app for the platform)
    if (config.META_APP_SECRET && !verifyMeta(request, config.META_APP_SECRET)) {
      return reply.status(401).send("Invalid signature");
    }

    const tenantId = leadSourceConfig.tenantId;

    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        // Lead events arrive as field "leadgen" (classic) — accept "leads_retrieval" too
        // in case Meta's newer use-case webhooks label it that way.
        if (change.field !== "leadgen" && change.field !== "leads_retrieval") continue;

        const { leadgen_id: leadgenId, form_id: formId, ad_id: adId } = change.value ?? {};
        if (!leadgenId) continue;

        // Fetch lead data from Meta Graph API (page token stored encrypted)
        try {
          const storedToken = (leadSourceConfig.config as any)?.accessToken;
          const metaToken = storedToken ? decrypt(storedToken) : "";
          const metaRes = await fetch(
            `https://graph.facebook.com/${config.META_GRAPH_VERSION}/${leadgenId}?access_token=${metaToken}`
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
            notifyBusiness(tenantId, "new_lead", {
              summary: `New lead: <b>${lead.firstName} ${lead.lastName ?? ""}</b> (via Meta Ads)`,
              link: `/leads/${lead.id}`,
              sms: `New lead: ${lead.firstName} ${lead.phone ?? lead.email ?? ""} via Meta Ads. Open TradieJet.`,
            }).catch(() => {});
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

      const event = verifyStripe(rawBody, sig, [config.STRIPE_WEBHOOK_SECRET, config.STRIPE_CONNECT_WEBHOOK_SECRET]);
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

              // Push the payment to any connected accounting system (Xero/MYOB; no-op if none).
              await syncEntityToAccounting(tenantId, "payment", invoiceId);

              notifyBusiness(tenantId, "payment_received", {
                summary: `Payment of <b>$${(amountCents / 100).toFixed(2)}</b> received for invoice ${invoice.invoiceNumber}.`,
                link: `/invoices/${invoiceId}`,
              }).catch(() => {});

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

        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const tenantId = session.metadata?.tenantId;
          const plan = session.metadata?.plan as PlanId | undefined;
          if (tenantId && plan && session.subscription) {
            const planDef = PLANS[plan];
            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { country: true } });
            await prisma.subscription.update({
              where: { tenantId },
              data: {
                tier: plan,
                status: "active",
                stripeSubscriptionId: String(session.subscription),
                stripeCustomerId: session.customer ? String(session.customer) : undefined,
                basePriceCents: planPriceCents(planDef, tenant?.country ?? "AU"),
                maxUsers: planDef.maxUsers,
                maxLeadsPerMonth: planDef.maxLeadsPerMonth,
                storageGb: planDef.storageGb,
              },
            });
            await prisma.tenant.update({ where: { id: tenantId }, data: { subscriptionStatus: "active" } });
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

      notifyBusiness(tenantId, "new_lead", {
        summary: `New lead: <b>${lead.firstName} ${lead.lastName ?? ""}</b>${lead.serviceRequired ? ` — ${lead.serviceRequired}` : ""} (via website form)`,
        link: `/leads/${lead.id}`,
        sms: `New lead: ${lead.firstName} ${lead.phone ?? lead.email ?? ""} via website form. Open TradieJet.`,
      }).catch(() => {});

      return reply.status(201).send({ data: { received: true } });
    }
  );

  // POST /api/v1/webhooks/google — Google Lead Form Ads.
  // Google posts the lead with a shared `google_key`; we resolve the tenant by that key
  // (stored in their LeadSourceConfig) and create the lead like any other source.
  fastify.post("/webhooks/google", async (request, reply) => {
    const body = request.body as any;
    const googleKey = body?.google_key;
    if (!googleKey) return reply.status(400).send({ error: { code: "MISSING_KEY", message: "Missing google_key" } });

    const sourceConfig = await prisma.leadSourceConfig.findFirst({
      where: { source: "google_ads", isActive: true, config: { path: ["googleKey"], equals: googleKey } },
    });
    if (!sourceConfig) return reply.status(401).send({ error: { code: "INVALID_KEY", message: "Unknown google_key" } });

    const tenantId = sourceConfig.tenantId;
    const cols: any[] = body?.user_column_data ?? [];
    const field = (id: string) => cols.find((c) => c.column_id === id)?.string_value ?? "";

    const fullName = field("FULL_NAME");
    const firstName = field("FIRST_NAME") || fullName.split(" ")[0] || "Unknown";
    const lastName = field("LAST_NAME") || (fullName ? fullName.split(" ").slice(1).join(" ") : "");
    const email = field("EMAIL") || undefined;
    const phone = field("PHONE_NUMBER") || undefined;

    // Skip duplicates (active/converted) like the other intakes.
    if (email || phone) {
      const dup = await prisma.lead.findFirst({
        where: {
          tenantId, deletedAt: null, status: { in: ["active", "converted"] },
          OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email: email.toLowerCase() }] : [])],
        },
      });
      if (dup) return reply.status(200).send({ received: true });
    }

    const defaultStage = await prisma.pipelineStage.findFirst({ where: { tenantId, isDefault: true } });

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        source: "google_ads",
        sourceDetail: "google_lead_form",
        sourceCampaignId: body?.campaign_id ? String(body.campaign_id) : undefined,
        sourceFormId: body?.form_id ? String(body.form_id) : undefined,
        firstName,
        lastName,
        email: email?.toLowerCase(),
        phone,
        stageId: defaultStage?.id,
        status: "active",
        rawPayload: body,
      },
    });

    await prisma.leadSourceConfig.update({ where: { id: sourceConfig.id }, data: { lastEventAt: new Date() } });

    await enqueueAutomation({ tenantId, triggerType: "lead_created", entityType: "lead", entityId: lead.id, entityData: { source: "google_ads" } });
    await enqueueAIScoring({ tenantId, leadId: lead.id });
    notifyBusiness(tenantId, "new_lead", {
      summary: `New lead: <b>${lead.firstName} ${lead.lastName ?? ""}</b> (via Google Ads)`,
      link: `/leads/${lead.id}`,
      sms: `New lead: ${lead.firstName} ${lead.phone ?? lead.email ?? ""} via Google Ads. Open TradieJet.`,
    }).catch(() => {});

    return reply.status(200).send({ received: true });
  });

  // POST /api/v1/webhooks/email — inbound "Email-to-Lead". A tradie forwards their
  // Builderscrack / hipages / NoCowboys / etc. notification emails to a unique address
  // (leads-<key>@in.tradiejet.com). The mail service posts the email here; we resolve the
  // tenant by <key>, AI-parse the customer details, and create a lead tagged with the portal.
  fastify.post("/webhooks/email", { config: { rawBody: true } }, async (request, reply) => {
    // Accept JSON (Resend / Cloudflare / Postmark) OR multipart/form-data (SendGrid / Mailgun).
    let b: any = {};
    if (typeof (request as any).isMultipart === "function" && (request as any).isMultipart()) {
      try {
        for await (const part of (request as any).parts()) {
          if (part.type === "field") b[part.fieldname] = part.value;
        }
      } catch { /* fall through with whatever we collected */ }
    } else {
      b = (request.body as any) ?? {};
    }

    // Resend inbound: Svix-signed `email.*` events. Verify, ignore non-received types,
    // fetch the parsed body (webhook is metadata-only), and normalise into `b`.
    if (b && typeof b.type === "string" && b.type.startsWith("email.")) {
      if (config.RESEND_WEBHOOK_SECRET && !verifyResendSignature(request, config.RESEND_WEBHOOK_SECRET)) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Bad signature" } });
      }
      if (b.type !== "email.received") {
        return reply.status(200).send({ received: false, ignored: b.type });
      }
      const fetched = await fetchResendReceivedEmail(b.data?.email_id);
      b = {
        to: Array.isArray(b.data?.to) ? b.data.to.join(",") : (b.data?.to ?? ""),
        from: b.data?.from ?? "",
        subject: b.data?.subject ?? fetched?.subject ?? "",
        text: fetched?.text ?? fetched?.html ?? "",
      };
    } else if (config.INBOUND_EMAIL_SECRET) {
      // Optional shared secret (SendGrid/Mailgun/etc.) — header, body field, or ?secret= query param.
      const provided = request.headers["x-inbound-secret"] ?? b.secret ?? (request.query as any)?.secret;
      if (provided !== config.INBOUND_EMAIL_SECRET) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Bad secret" } });
      }
    }

    // Accept the common field names across providers (SendGrid / Mailgun / Postmark / Cloudflare).
    const to = String(b.to ?? b.To ?? b.recipient ?? "").toLowerCase();
    const from = String(b.from ?? b.From ?? b.sender ?? "");
    const subject = String(b.subject ?? b.Subject ?? "");
    const text = String(b.text ?? b.TextBody ?? b["body-plain"] ?? b["stripped-text"] ?? b.html ?? b.HtmlBody ?? "");

    const m = to.match(/leads-([a-z0-9]+)@/i);
    if (!m) return reply.status(200).send({ received: false, reason: "no_key" });
    const emailKey = m[1];

    const sourceConfig = await prisma.leadSourceConfig.findFirst({
      where: { source: "email", config: { path: ["emailKey"], equals: emailKey } },
    });
    if (!sourceConfig) return reply.status(200).send({ received: false, reason: "unknown_key" });
    const tenantId = sourceConfig.tenantId;

    // Forwarding-verification email (Gmail/Outlook send a code before they'll forward).
    // Capture the code + confirm link and surface them in Settings instead of making a lead.
    const isVerification =
      /forwarding-noreply@google\.com|microsoft|outlook|postmaster/i.test(from) ||
      /forwarding confirmation|confirm.*forward|verify .*forward|forwarding verification|confirmation code/i.test(`${subject} ${text}`);
    if (isVerification) {
      const code =
        (subject.match(/#?\s*(\d{6,12})/) ?? [])[1] ??
        (text.match(/confirmation code[:\s#]*([0-9]{5,12})/i) ?? [])[1] ??
        (text.match(/\b(\d{9})\b/) ?? [])[1] ?? null;
      const links = text.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
      const link = links.find((u) => /google\.com|confirm|verif|forward/i.test(u)) ?? links[0] ?? null;
      await prisma.leadSourceConfig.update({
        where: { id: sourceConfig.id },
        data: { config: { ...(sourceConfig.config as any), verification: { code, link, from, subject, receivedAt: new Date().toISOString() } } },
      }).catch(() => {});
      return reply.status(200).send({ received: true, verification: true });
    }

    const { parseLeadEmail, detectPortal } = await import("../lib/lead-email-parser.js");
    const portal = detectPortal(from, subject);
    const parsed = await parseLeadEmail({ from, subject, text });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { country: true } });
    const phone = parsed.phone ? normalisePhone(parsed.phone, tenant?.country ?? "AU") : null;
    const email = parsed.email && !/noreply|no-reply/i.test(parsed.email) ? parsed.email.toLowerCase() : null;

    // Dedupe against active/converted leads.
    if (email || phone) {
      const dup = await prisma.lead.findFirst({
        where: {
          tenantId, deletedAt: null, status: { in: ["active", "converted"] },
          OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
        },
      });
      if (dup) return reply.status(200).send({ received: true, deduped: true });
    }

    const defaultStage = await prisma.pipelineStage.findFirst({ where: { tenantId, isDefault: true } });
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        source: "email",
        sourceDetail: portal,
        firstName: parsed.firstName || "New",
        lastName: parsed.lastName || (portal !== "Email" ? portal : "lead"),
        email,
        phone,
        serviceRequired: parsed.serviceRequired ?? undefined,
        stageId: defaultStage?.id,
        status: "active",
        rawPayload: { from, subject, parsed } as any,
      },
    });

    await prisma.leadActivity.create({
      data: { tenantId, leadId: lead.id, type: "lead_created", description: `Lead imported from ${portal}` },
    }).catch(() => {});
    await prisma.leadSourceConfig.update({ where: { id: sourceConfig.id }, data: { lastEventAt: new Date() } }).catch(() => {});

    await enqueueAutomation({ tenantId, triggerType: "lead_created", entityType: "lead", entityId: lead.id, entityData: { source: "email", portal } });
    await enqueueAIScoring({ tenantId, leadId: lead.id });
    notifyBusiness(tenantId, "new_lead", {
      summary: `New lead: <b>${lead.firstName} ${lead.lastName ?? ""}</b>${lead.serviceRequired ? ` — ${lead.serviceRequired}` : ""} (via ${portal})`,
      link: `/leads/${lead.id}`,
      sms: `New lead via ${portal}: ${lead.firstName} ${lead.phone ?? lead.email ?? ""}. Open TradieJet.`,
    }).catch(() => {});

    return reply.status(201).send({ data: { received: true, portal } });
  });
}
