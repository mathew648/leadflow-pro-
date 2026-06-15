import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { seedTenant, cleanupTenant, type TestTenant } from "./helpers/seed.js";
import { prisma } from "../lib/prisma.js";

describe("Invoices routes", () => {
  let app: FastifyInstance;
  let ctx: TestTenant;
  let customerId: string;
  let invoiceId: string;

  const auth = () => ({ Authorization: `Bearer ${ctx.accessToken}` });

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    ctx = await seedTenant(app);

    // Create a customer to attach invoices to
    const customer = await prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
        firstName: "Invoice",
        lastName: "Customer",
        email: "invoicecust@example.com",
        customerNumber: "C-TEST-001",
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await cleanupTenant(ctx.tenantId);
    await app.close();
  });

  describe("POST /api/v1/invoices", () => {
    it("creates a draft invoice with line items", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/invoices",
        headers: auth(),
        payload: {
          customerId,
          invoiceType: "final",
          lineItems: [
            {
              description: "Labour - 3hrs",
              quantity: 3,
              unitPriceCents: 15000,
              gstRate: 0.1,
              position: 0,
            },
          ],
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      invoiceId = body.data.id;
      expect(body.data.status).toBe("draft");
      expect(body.data.subtotalCents).toBe(45000);
      expect(body.data.gstCents).toBe(4500);
      expect(body.data.totalCents).toBe(49500);
      expect(body.data.invoiceNumber).toMatch(/^INV/);
    });

    it("rejects invoice without customerId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/invoices",
        headers: auth(),
        payload: {
          invoiceType: "final",
          lineItems: [{ description: "Test", quantity: 1, unitPriceCents: 10000, gstRate: 0.1 }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("requires authentication", async () => {
      const res = await app.inject({ method: "POST", url: "/api/v1/invoices", payload: {} });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/invoices", () => {
    it("returns invoice list", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/invoices",
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
    });

    it("filters by status=draft", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/invoices?status=draft",
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const invoices = res.json().data as any[];
      expect(invoices.every((i) => i.status === "draft")).toBe(true);
    });
  });

  describe("GET /api/v1/invoices/:id", () => {
    it("returns single invoice with line items", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/invoices/${invoiceId}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.id).toBe(invoiceId);
      expect(Array.isArray(body.data.lineItems)).toBe(true);
      expect(body.data.lineItems.length).toBe(1);
    });

    it("returns 404 for unknown invoice", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/invoices/00000000-0000-0000-0000-000000000000",
        headers: auth(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/invoices/:id/send", () => {
    it("sends the invoice and logs an outbound email to message history", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/invoices/${invoiceId}/send`,
        headers: auth(),
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.sent).toBe(true);

      // marks the invoice as sent
      const inv = await app.inject({
        method: "GET",
        url: `/api/v1/invoices/${invoiceId}`,
        headers: auth(),
      });
      expect(inv.json().data.status).toBe("sent");

      // logs a branded outbound email to the Message table
      const message = await prisma.message.findFirst({
        where: { tenantId: ctx.tenantId, invoiceId, channel: "email", direction: "outbound" },
      });
      expect(message).not.toBeNull();
      expect(message?.toEmail).toBe("invoicecust@example.com");
    });
  });

  describe("POST /api/v1/invoices/:id/payments", () => {
    it("records a manual payment", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/invoices/${invoiceId}/payments`,
        headers: auth(),
        payload: {
          amountCents: 49500,
          gateway: "manual",
          reference: "BANK-TXN-001",
          paidAt: new Date().toISOString(),
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.amountCents).toBe(49500);

      // invoice should now be paid
      const inv = await app.inject({
        method: "GET",
        url: `/api/v1/invoices/${invoiceId}`,
        headers: auth(),
      });
      expect(inv.json().data.status).toBe("paid");
    });
  });
});
