import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

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

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, source: body.source ?? "website", ipAddress: ip, status: "subscribed" },
      update: { status: "subscribed" }, // re-subscribe if they'd left
    });

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

    return reply.status(201).send({ data: { joined: true, id: entry.id } });
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
