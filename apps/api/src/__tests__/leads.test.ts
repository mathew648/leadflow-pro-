import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { seedTenant, cleanupTenant, type TestTenant } from "./helpers/seed.js";

const BASE_LEAD = {
  firstName: "Alice",
  lastName: "Smith",
  email: "alice@example.com",
  phone: "0412345678",
  source: "website",
  urgency: "normal",
};

describe("Leads routes", () => {
  let app: FastifyInstance;
  let ctx: TestTenant;
  let leadId: string;

  const auth = () => ({ Authorization: `Bearer ${ctx.accessToken}` });

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    ctx = await seedTenant(app);
  });

  afterAll(async () => {
    await cleanupTenant(ctx.tenantId);
    await app.close();
  });

  // ── Create ───────────────────────────────────────────────────

  describe("POST /api/v1/leads", () => {
    it("creates a lead and returns it", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/leads",
        headers: auth(),
        payload: { ...BASE_LEAD, stageId: ctx.stageId },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      leadId = body.data.id;
      expect(body.data.firstName).toBe("Alice");
      expect(body.data.tenantId).toBe(ctx.tenantId);
      expect(body.data.source).toBe("website");
    });

    it("rejects a lead without required source field", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/leads",
        headers: auth(),
        payload: { firstName: "No", lastName: "Source" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("requires authentication", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/leads",
        payload: BASE_LEAD,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── List ─────────────────────────────────────────────────────

  describe("GET /api/v1/leads", () => {
    it("returns a paginated list of leads", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/leads",
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it("filters by stageId", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/leads?stageId=${ctx.stageId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const leads = res.json().data as any[];
      expect(leads.every((l) => l.stageId === ctx.stageId)).toBe(true);
    });

    it("searches by name", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/leads?search=Alice",
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const leads = res.json().data as any[];
      expect(leads.some((l) => l.firstName === "Alice")).toBe(true);
    });

    it("requires authentication", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/leads" });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Get one ──────────────────────────────────────────────────

  describe("GET /api/v1/leads/:id", () => {
    it("returns the lead by id", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/leads/${leadId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(leadId);
    });

    it("returns 404 for unknown id", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/leads/00000000-0000-0000-0000-000000000000",
        headers: auth(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Update ───────────────────────────────────────────────────

  describe("PATCH /api/v1/leads/:id", () => {
    it("updates lead fields", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/leads/${leadId}`,
        headers: auth(),
        payload: { firstName: "Alicia", urgency: "urgent" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.firstName).toBe("Alicia");
      expect(body.data.urgency).toBe("urgent");
    });

    it("cannot update a lead from another tenant", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/leads/00000000-0000-0000-0000-000000000000",
        headers: auth(),
        payload: { firstName: "Hacker" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Delete ───────────────────────────────────────────────────

  describe("DELETE /api/v1/leads/:id", () => {
    it("soft-deletes a lead", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/leads/${leadId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(204);

      // Should no longer appear in list
      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/leads/${leadId}`,
        headers: auth(),
      });
      expect(listRes.statusCode).toBe(404);
    });
  });
});
