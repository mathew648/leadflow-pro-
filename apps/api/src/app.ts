import Fastify, { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { config } from "./config.js";
import { captureException, setUserContext } from "./lib/sentry.js";
import authPlugin from "./plugins/auth.js";
import { getRedis } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";

import authRoutes from "./routes/auth.js";
import leadsRoutes from "./routes/leads.js";
import customersRoutes from "./routes/customers.js";
import jobsRoutes from "./routes/jobs.js";
import quotesRoutes from "./routes/quotes.js";
import invoicesRoutes from "./routes/invoices.js";
import catalogRoutes from "./routes/catalog.js";
import scheduleRoutes from "./routes/schedule.js";
import analyticsRoutes from "./routes/analytics.js";
import automationsRoutes from "./routes/automations.js";
import webhooksRoutes from "./routes/webhooks.js";
import aiRoutes from "./routes/ai.js";
import integrationsRoutes from "./routes/integrations.js";
import uploadRoutes from "./routes/upload.js";
import tenantsRoutes from "./routes/tenants.js";
import messagesRoutes from "./routes/messages.js";
import auditLogsRoutes from "./routes/audit-logs.js";
import adminRoutes from "./routes/admin.js";

export interface BuildAppOptions {
  disableRateLimit?: boolean;
  logger?: boolean | object;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const isTest = config.NODE_ENV === "test";

  const fastify = Fastify({
    logger: opts.logger ?? (isTest ? false : {
      level: config.NODE_ENV === "production" ? "info" : "debug",
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    }),
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: "all",
        coerceTypes: true,
        useDefaults: true,
      },
    },
  });

  // Register error handler IMMEDIATELY after instance creation, before any plugins,
  // so all child scopes inherit it
  fastify.setErrorHandler((error, request, reply) => {
    if (error.statusCode === 429) {
      return reply.status(429).send({ error: { code: "RATE_LIMITED", message: "Too many requests" } });
    }
    if (
      error instanceof ZodError ||
      error.name === "ZodError" ||
      ((error as any).issues != null && Array.isArray((error as any).issues))
    ) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: (error as any).issues ?? (error as any).errors ?? [] },
      });
    }
    if (error.validation) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.validation },
      });
    }
    const statusCode = error.statusCode ?? 500;
    if (statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: "REQUEST_ERROR", message: error.message },
      });
    }
    fastify.log.error({ err: error, url: request.url }, "Unhandled server error");
    captureException(error, {
      url: request.url,
      method: request.method,
      userId: (request as any).userId,
      tenantId: (request as any).tenantId,
    });
    return reply.status(500).send({
      error: {
        code: "SERVER_ERROR",
        message: config.NODE_ENV === "production" ? "An internal error occurred" : error.message,
      },
    });
  });

  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      const allowed = [config.APP_URL, "http://localhost:3000", "http://localhost:3001"];
      if (!origin || allowed.some((o) => origin.startsWith(o))) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Key"],
  });

  await fastify.register(fastifyCookie, {
    secret: config.JWT_SECRET ?? "cookie-secret-change-me",
  });

  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  });

  if (!opts.disableRateLimit && !isTest) {
    await fastify.register(fastifyRateLimit, {
      global: false,
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW_MS,
      redis: getRedis() as any,
      keyGenerator: (req) => `${req.headers["x-tenant-id"] ?? req.ip}`,
      errorResponseBuilder: () => ({
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      }),
    });
  }

  await fastify.register(authPlugin);

  // Set Sentry user context once JWT is available on the request
  fastify.addHook("onRequest", async (request) => {
    const userId = (request as any).userId;
    const tenantId = (request as any).tenantId;
    if (userId && tenantId) {
      setUserContext(userId, tenantId);
    }
  });

  fastify.get("/health", { logLevel: "silent" }, async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
      db: dbOk ? "connected" : "error",
    };
  });

  const v1Prefix = { prefix: "/api/v1" };
  await fastify.register(authRoutes, v1Prefix);
  await fastify.register(tenantsRoutes, v1Prefix);
  await fastify.register(leadsRoutes, v1Prefix);
  await fastify.register(customersRoutes, v1Prefix);
  await fastify.register(jobsRoutes, v1Prefix);
  await fastify.register(quotesRoutes, v1Prefix);
  await fastify.register(invoicesRoutes, v1Prefix);
  await fastify.register(catalogRoutes, v1Prefix);
  await fastify.register(scheduleRoutes, v1Prefix);
  await fastify.register(analyticsRoutes, v1Prefix);
  await fastify.register(automationsRoutes, v1Prefix);
  await fastify.register(webhooksRoutes, v1Prefix);
  await fastify.register(aiRoutes, v1Prefix);
  await fastify.register(integrationsRoutes, v1Prefix);
  await fastify.register(uploadRoutes, v1Prefix);
  await fastify.register(messagesRoutes, v1Prefix);
  await fastify.register(auditLogsRoutes, v1Prefix);
  await fastify.register(adminRoutes, v1Prefix);

  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: "NOT_FOUND", message: `Route ${request.url} not found` } });
  });

  return fastify;
}
