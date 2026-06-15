import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { seedTenant, cleanupTenant, type TestTenant } from "./helpers/seed.js";

const REGISTER_BASE = {
  firstName: "Jane",
  lastName: "Tradie",
  businessName: "Jane's Electrical",
  country: "AU",
  tradeTypes: ["electrical"],
  timezone: "Australia/Sydney",
};

describe("Auth routes", () => {
  let app: FastifyInstance;
  let ctx: TestTenant;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    ctx = await seedTenant(app);
  });

  afterAll(async () => {
    await cleanupTenant(ctx.tenantId);
    await app.close();
  });

  // ── Registration ────────────────────────────────────────────

  describe("POST /api/v1/auth/register", () => {
    it("creates a new tenant and returns an access token", async () => {
      const suffix = Date.now();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          ...REGISTER_BASE,
          email: `new-${suffix}@example.com`,
          password: "SuperSecret123!",
          businessName: `Test Biz ${suffix}`,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.user.email).toBe(`new-${suffix}@example.com`);
      expect(body.data.user.tenant.name).toBe(`Test Biz ${suffix}`);

      // cleanup the new tenant created in this test
      await cleanupTenant(body.data.user.tenant.id);
    });

    it("rejects short password (<12 chars)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          ...REGISTER_BASE,
          email: `short-pw@example.com`,
          password: "Short1!",
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          ...REGISTER_BASE,
          email: "not-an-email",
          password: "SuperSecret123!",
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects duplicate email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          ...REGISTER_BASE,
          email: ctx.email,
          password: "SuperSecret123!",
        },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  // ── Login ────────────────────────────────────────────────────

  describe("POST /api/v1/auth/login", () => {
    it("returns access token with valid credentials", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: ctx.email, password: ctx.password },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.user.email).toBe(ctx.email);
      expect(body.data.user.role).toBe("owner");
    });

    it("rejects wrong password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: ctx.email, password: "WrongPassword123!" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects unknown email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "nobody@nowhere.com", password: "TestPass123!abc" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects missing body fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: ctx.email },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── /me ─────────────────────────────────────────────────────

  describe("GET /api/v1/auth/me", () => {
    it("returns current user with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.email).toBe(ctx.email);
      expect(body.data.tenant).toBeDefined();
    });

    it("returns 401 without token", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with malformed token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { Authorization: "Bearer not.a.real.token" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── PATCH /me ────────────────────────────────────────────────

  describe("PATCH /api/v1/auth/me", () => {
    it("updates profile fields", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/auth/me",
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
        payload: { firstName: "Updated", phone: "+61400000001" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.firstName).toBe("Updated");

      // reset
      await prisma.user.update({ where: { id: ctx.userId }, data: { firstName: "Test" } });
    });

    it("requires authentication", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/auth/me",
        payload: { firstName: "Hacker" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Logout ───────────────────────────────────────────────────

  describe("POST /api/v1/auth/logout", () => {
    it("clears the session", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
