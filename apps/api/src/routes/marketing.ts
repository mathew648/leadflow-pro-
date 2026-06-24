import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { enqueueEmail } from "../lib/queue.js";
import { config } from "../config.js";

const SUBSCRIBE_WELCOME = `
<p style="font-size:16px;">Thanks for subscribing! 🎉</p>
<p>You're now on the list for practical tips to help you win more jobs and get paid faster — built specifically for Australian &amp; New Zealand trades.</p>
<p>No spam, ever — just the good stuff. You can unsubscribe at any time.</p>
<p style="margin-top:24px;">— The TradieJet Team</p>`;

function waitlistWelcome(name?: string | null) {
  return `
<p style="font-size:16px;">You're on the waitlist! 🎉</p>
<p>Thanks for joining${name ? `, ${name}` : ""}. We're putting the finishing touches on TradieJet — the all-in-one lead, quote, job and invoice platform for AU &amp; NZ tradies.</p>
<p>You'll be among the first to get access, and you've locked in <strong>founding-member pricing</strong>.</p>
<p>We'll be in touch soon — keep an eye on your inbox.</p>
<p style="margin-top:24px;">— The TradieJet Team</p>`;
}

// Public marketing-site endpoints: newsletter subscribe, waitlist, blog (read-only).
// No auth; rate-limited. Admin views/management live in admin.ts.
export default async function marketingRoutes(fastify: FastifyInstance) {
  const publicLimit = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

  // POST /api/v1/public/subscribe — newsletter signup
  fastify.post("/public/subscribe", publicLimit, async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      source: z.string().max(100).optional(),
    }).parse(request.body);

    const email = body.email.trim().toLowerCase();
    const ip = (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? request.ip;

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, source: body.source ?? "website", ipAddress: ip, status: "subscribed" },
      update: { status: "subscribed" }, // re-subscribe if they'd left
    });

    // Welcome email on first signup only (fire-and-forget — never block the signup).
    if (!existing) {
      enqueueEmail({ to: email, subject: "Welcome to TradieJet 👋", template: "custom", data: { businessName: "TradieJet", body: SUBSCRIBE_WELCOME } }).catch(() => {});
    }

    return reply.status(201).send({ data: { subscribed: true } });
  });

  // POST /api/v1/public/waitlist — join the waitlist
  fastify.post("/public/waitlist", publicLimit, async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      name: z.string().max(150).optional(),
      businessName: z.string().max(200).optional(),
      trade: z.string().max(100).optional(),
      country: z.enum(["AU", "NZ"]).optional(),
      phone: z.string().max(30).optional(),
      source: z.string().max(100).optional(),
    }).parse(request.body);

    const email = body.email.trim().toLowerCase();
    const ip = (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? request.ip;

    const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
    const entry = await prisma.waitlistEntry.upsert({
      where: { email },
      create: {
        email,
        name: body.name,
        businessName: body.businessName,
        trade: body.trade,
        country: body.country,
        phone: body.phone,
        source: body.source ?? "website",
        ipAddress: ip,
      },
      update: {
        name: body.name,
        businessName: body.businessName,
        trade: body.trade,
        country: body.country,
        phone: body.phone,
      },
    });

    // Welcome email on first signup only (fire-and-forget).
    if (!existing) {
      enqueueEmail({ to: email, subject: "You're on the TradieJet waitlist 🎉", template: "custom", data: { businessName: "TradieJet", body: waitlistWelcome(body.name) } }).catch(() => {});
    }

    return reply.status(201).send({ data: { joined: true, id: entry.id } });
  });

  // POST /api/v1/public/contact — contact-us form submission
  fastify.post("/public/contact", publicLimit, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(150),
      email: z.string().email(),
      subject: z.string().max(255).optional(),
      message: z.string().min(1).max(5000),
    }).parse(request.body);

    const ip = (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? request.ip;
    await prisma.contactMessage.create({
      data: { name: body.name, email: body.email.trim().toLowerCase(), subject: body.subject, message: body.message, ipAddress: ip },
    });

    // Notify the team (best-effort; replies go straight back to the sender).
    enqueueEmail({
      to: config.SUPPORT_EMAIL,
      replyTo: body.email,
      subject: `Contact form: ${body.subject || "New message"} — from ${body.name}`,
      template: "custom",
      data: { businessName: "TradieJet", body: `<p><strong>${body.name}</strong> (${body.email}) wrote:</p><p>${body.message.replace(/\n/g, "<br>")}</p>` },
    }).catch(() => {});

    return reply.status(201).send({ data: { sent: true } });
  });

  // GET /api/v1/public/blog — list published posts (newest first)
  fastify.get("/public/blog", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where: { status: "published", publishedAt: { not: null } },
        select: { slug: true, title: true, excerpt: true, coverImageUrl: true, authorName: true, tags: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.blogPost.count({ where: { status: "published", publishedAt: { not: null } } }),
    ]);

    return { data: posts, meta: { total, limit: query.limit, offset: query.offset } };
  });

  // GET /api/v1/public/blog/:slug — a single published post
  fastify.get("/public/blog/:slug", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const post = await prisma.blogPost.findFirst({
      where: { slug, status: "published", publishedAt: { not: null } },
      select: { slug: true, title: true, excerpt: true, content: true, coverImageUrl: true, authorName: true, tags: true, publishedAt: true },
    });
    if (!post) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Post not found" } });
    }
    return { data: post };
  });
}
