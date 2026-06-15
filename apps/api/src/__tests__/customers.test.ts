import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { seedTenant, cleanupTenant, type TestTenant } from "./helpers/seed.js";

describe("Customers routes", () => {
  let app: FastifyInstance;
  let ctx: TestTenant;
  let customerId: string;

  const auth = () => ({ Authorization: `Bearer ${ctx.accessToken}` });

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    ctx = await seedTenant(app);

    const customer = await prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
        firstName: "Bob",
        lastName: "Builder",
        email: `bob-${ctx.tenantId.slice(0, 8)}@example.com`,
        phone: `+6140${ctx.tenantId.slice(0, 7).replace(/-/g, "0")}`,
        customerNumber: `CUS-${ctx.tenantId.slice(0, 8)}`,
        createdById: ctx.userId,
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await cleanupTenant(ctx.tenantId);
    await app.close();
  });

  describe("POST /api/v1/customers", () => {
    it("creates a customer via the API", async () => {
      const suffix = Date.now();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/customers",
        headers: auth(),
        payload: {
          firstName: "Alice",
          lastName: "Smith",
          phone: `+614${suffix.toString().slice(-8)}`,
          email: `alice-${suffix}@example.com`,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.firstName).toBe("Alice");
      expect(body.data.tenantId).toBe(ctx.tenantId);
    });

    it("rejects missing required fields (firstName + phone)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/customers",
        headers: auth(),
        payload: { email: "noname@example.com" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("requires authentication", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/customers",
        payload: { firstName: "Ghost", lastName: "User", phone: "0400000099" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/customers", () => {
    it("returns customer list", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/customers",
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
      expect(res.json().data.length).toBeGreaterThan(0);
    });

    it("searches by name", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/customers?search=Bob",
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const customers = res.json().data as any[];
      expect(customers.some((c: any) => c.firstName === "Bob")).toBe(true);
    });
  });

  describe("GET /api/v1/customers/:id", () => {
    it("returns a single customer", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/customers/${customerId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(customerId);
    });

    it("returns 404 for unknown customer", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/customers/00000000-0000-0000-0000-000000000000",
        headers: auth(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/v1/customers/:id", () => {
    it("updates customer details", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/customers/${customerId}`,
        headers: auth(),
        payload: { companyName: "Updated Builds Pty Ltd" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.companyName).toBe("Updated Builds Pty Ltd");
    });
  });
});
