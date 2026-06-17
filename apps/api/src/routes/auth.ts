import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { generateNumber } from "../lib/utils.js";
import { nanoid } from "nanoid";
import { writeAuditLog, auditFromRequest } from "../lib/audit.js";
import { sendBrandedEmail } from "../lib/mailer.js";
import { seedDefaultAutomations } from "../lib/default-automations.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, "Password must be at least 12 characters"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  businessName: z.string().min(1).max(200),
  abn: z.string().optional(),
  country: z.enum(["AU", "NZ"]).default("AU"),
  tradeTypes: z.array(z.string()).default([]),
  timezone: z.string().default("Australia/Sydney"),
});

const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/login
  fastify.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);

      // Find user by email (cross-tenant email lookup)
      const user = await prisma.user.findFirst({
        where: {
          email: body.email.toLowerCase(),
          deletedAt: null,
          status: "active",
        },
        include: { tenant: { include: { subscription: true } } },
      });

      if (!user || !user.passwordHash) {
        return reply.status(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        });
      }

      const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
      if (!passwordValid) {
        return reply.status(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        });
      }

      if (user.tenant.status !== "active") {
        return reply.status(403).send({
          error: { code: "TENANT_SUSPENDED", message: "Your account has been suspended" },
        });
      }

      // Generate tokens
      const accessToken = fastify.jwt.sign({
        sub: user.id,
        tid: user.tenantId,
        email: user.email,
        role: user.role,
        name: `${user.firstName} ${user.lastName}`,
      });

      const refreshToken = fastify.jwt.sign(
        { sub: user.id, type: "refresh", jti: nanoid() } as any,
        { expiresIn: config.JWT_REFRESH_EXPIRY }
      );

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + config.JWT_REFRESH_EXPIRY * 1000),
        },
      });

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: request.ip,
        },
      });

      writeAuditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: "login",
        entityType: "user",
        entityId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }).catch(() => {});

      reply.setCookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: config.JWT_REFRESH_EXPIRY,
        path: "/api/v1/auth",
      });

      return reply.status(200).send({
        data: {
          accessToken,
          expiresIn: config.JWT_ACCESS_EXPIRY,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            avatarUrl: user.avatarUrl,
            tenant: {
              id: user.tenant.id,
              name: user.tenant.businessName,
              slug: user.tenant.slug,
              subscriptionTier: user.tenant.subscription?.tier ?? "starter",
              country: user.tenant.country,
              currency: user.tenant.currency,
              logoUrl: user.tenant.logoUrl,
              primaryColor: user.tenant.primaryColor,
            },
          },
        },
      });
    }
  );

  // POST /api/v1/auth/register
  fastify.post(
    "/auth/register",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);

      // Check if email already registered
      const existing = await prisma.user.findFirst({
        where: { email: body.email.toLowerCase() },
      });

      if (existing) {
        return reply.status(409).send({
          error: { code: "EMAIL_EXISTS", message: "An account with this email already exists" },
        });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);
      const slug = body.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);

      // Check slug uniqueness, append random suffix if taken
      const slugExists = await prisma.tenant.findUnique({ where: { slug } });
      const finalSlug = slugExists
        ? `${slug}-${Math.random().toString(36).slice(2, 6)}`
        : slug;

      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      // Create tenant + user in transaction
      const { tenant, user } = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug: finalSlug,
            businessName: body.businessName,
            abn: body.abn,
            email: body.email.toLowerCase(),
            country: body.country,
            currency: body.country === "NZ" ? "NZD" : "AUD",
            timezone: body.timezone,
            tradeTypes: body.tradeTypes,
            gstRate: body.country === "NZ" ? 0.15 : 0.10,
            subscriptionStatus: "trialing",
            trialEndsAt,
            onboardingStep: "trade-types",
          },
        });

        await tx.tenantSettings.create({
          data: { tenantId: tenant.id },
        });

        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            tier: "starter",
            status: "trialing",
            basePriceCents: 9900,
            maxUsers: 1,
            maxLeadsPerMonth: 500,
            storageGb: 5,
            trialEnd: trialEndsAt,
          },
        });

        // Default pipeline stages
        const defaultStages = [
          { name: "New", slug: "new", color: "#6B7280", position: 0, isDefault: true },
          { name: "Contacted", slug: "contacted", color: "#3B82F6", position: 1 },
          { name: "Site Visit", slug: "site-visit", color: "#8B5CF6", position: 2 },
          { name: "Quote Sent", slug: "quote-sent", color: "#F59E0B", position: 3 },
          { name: "Follow Up", slug: "follow-up", color: "#EF4444", position: 4 },
          { name: "Won", slug: "won", color: "#10B981", position: 5, isWon: true },
          { name: "Lost", slug: "lost", color: "#6B7280", position: 6, isLost: true },
        ];

        await tx.pipelineStage.createMany({
          data: defaultStages.map((s) => ({
            tenantId: tenant.id,
            ...s,
            isWon: (s as any).isWon ?? false,
            isLost: (s as any).isLost ?? false,
          })),
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: body.email.toLowerCase(),
            firstName: body.firstName,
            lastName: body.lastName,
            phone: body.phone,
            role: "owner",
            passwordHash,
            status: "active",
            activatedAt: new Date(),
          },
        });

        // Seed the starter automation pack so notifications work from day one.
        await seedDefaultAutomations(tx, tenant.id);

        return { tenant, user };
      });

      // Sign tokens
      const accessToken = fastify.jwt.sign({
        sub: user.id,
        tid: tenant.id,
        email: user.email,
        role: user.role,
        name: `${user.firstName} ${user.lastName}`,
      });

      const refreshToken = fastify.jwt.sign(
        { sub: user.id, type: "refresh", jti: nanoid() } as any,
        { expiresIn: config.JWT_REFRESH_EXPIRY }
      );

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + config.JWT_REFRESH_EXPIRY * 1000),
        },
      });

      reply.setCookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: config.JWT_REFRESH_EXPIRY,
        path: "/api/v1/auth",
      });

      writeAuditLog({
        tenantId: tenant.id,
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: "create",
        entityType: "user",
        entityId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }).catch(() => {});

      // Welcome email
      sendBrandedEmail({
        tenantId: tenant.id,
        tenant,
        to: user.email,
        subject: `Welcome to ${tenant.businessName}`,
        template: "welcome",
        data: {
          firstName: user.firstName,
          loginUrl: `${config.APP_URL}/login`,
        },
      }).catch(() => {});

      return reply.status(201).send({
        data: {
          accessToken,
          expiresIn: config.JWT_ACCESS_EXPIRY,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenant: {
              id: tenant.id,
              name: tenant.businessName,
              slug: tenant.slug,
              subscriptionTier: "starter",
              country: tenant.country,
              currency: tenant.currency,
              onboardingStep: tenant.onboardingStep,
            },
          },
        },
      });
    }
  );

  // POST /api/v1/auth/refresh
  fastify.post("/auth/refresh", async (request, reply) => {
    const refreshToken =
      request.cookies?.refreshToken ??
      (request.body as any)?.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({
        error: { code: "NO_REFRESH_TOKEN", message: "Refresh token required" },
      });
    }

    let payload: { sub: string; type: string };
    try {
      payload = fastify.jwt.verify(refreshToken) as any;
    } catch {
      return reply.status(401).send({
        error: { code: "INVALID_REFRESH_TOKEN", message: "Invalid refresh token" },
      });
    }

    const storedToken = await prisma.refreshToken.findFirst({
      where: { token: refreshToken, userId: payload.sub },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return reply.status(401).send({
        error: { code: "EXPIRED_REFRESH_TOKEN", message: "Refresh token expired" },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || user.deletedAt) {
      return reply.status(401).send({
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const newAccessToken = fastify.jwt.sign({
      sub: user.id,
      tid: user.tenantId,
      email: user.email,
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
    });

    const newRefreshToken = fastify.jwt.sign(
      { sub: user.id, type: "refresh" } as any,
      { expiresIn: config.JWT_REFRESH_EXPIRY }
    );

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + config.JWT_REFRESH_EXPIRY * 1000),
      },
    });

    reply.setCookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: config.JWT_REFRESH_EXPIRY,
      path: "/api/v1/auth",
    });

    return { data: { accessToken: newAccessToken, expiresIn: config.JWT_ACCESS_EXPIRY } };
  });

  // POST /api/v1/auth/logout
  fastify.post(
    "/auth/logout",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const refreshToken = request.cookies?.refreshToken;
      if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      }
      auditFromRequest(request, "logout", "user", request.userId).catch(() => {});
      reply.clearCookie("refreshToken", { path: "/api/v1/auth" });
      return { data: { success: true } };
    }
  );

  // PATCH /api/v1/auth/me
  fastify.patch(
    "/auth/me",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const body = z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().max(100).optional(),
        phone: z.string().optional(),
      }).parse(request.body);

      const user = await prisma.user.update({
        where: { id: request.userId },
        data: body,
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, avatarUrl: true },
      });
      return { data: user };
    }
  );

  // GET /api/v1/auth/me
  fastify.get(
    "/auth/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        include: { tenant: { include: { subscription: true, settings: true } } },
      });

      if (!user || user.deletedAt) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "User not found" },
        });
      }

      return {
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
          avatarUrl: user.avatarUrl,
          tradeTypes: user.tradeTypes,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.businessName,
            slug: user.tenant.slug,
            subscriptionTier: user.tenant.subscription?.tier,
            subscriptionStatus: user.tenant.subscription?.status,
            country: user.tenant.country,
            currency: user.tenant.currency,
            timezone: user.tenant.timezone,
            logoUrl: user.tenant.logoUrl,
            primaryColor: user.tenant.primaryColor,
            onboardingStep: user.tenant.onboardingStep,
            settings: user.tenant.settings,
          },
        },
      };
    }
  );
}
