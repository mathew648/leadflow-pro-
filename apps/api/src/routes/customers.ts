import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { normalisePhone } from "../lib/utils.js";
import { auditFromRequest } from "../lib/audit.js";
import { bufferToRows, buildHeaderIndex } from "../lib/spreadsheet.js";

// Flexible header aliases for customer imports (works with exports from other systems).
const CUSTOMER_ALIASES: Record<string, string[]> = {
  firstName: ["firstname", "first", "givenname", "fname"],
  lastName: ["lastname", "last", "surname", "familyname", "lname"],
  name: ["name", "fullname", "customer", "customername", "client", "contact", "contactname"],
  company: ["company", "companyname", "business", "businessname", "organisation", "organization"],
  email: ["email", "emailaddress", "e-mail", "emailadress"],
  phone: ["phone", "mobile", "phonenumber", "mobilenumber", "contactnumber", "tel", "telephone"],
  address: ["address", "street", "streetaddress", "address1", "addressline1"],
  suburb: ["suburb", "city", "town"],
  postcode: ["postcode", "postalcode", "zip", "zipcode", "postal"],
  notes: ["notes", "note", "comments", "comment"],
};

const createCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  companyName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20),
  altPhone: z.string().optional(),
  abn: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  referralSource: z.string().optional(),
  isVip: z.boolean().default(false),
  leadId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
});

const createPropertySchema = z.object({
  type: z.enum(["residential", "commercial", "industrial", "strata"]).default("residential"),
  streetAddress: z.string().min(1).max(300),
  suburb: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  postcode: z.string().max(20).optional(),
  country: z.string().max(10).default("AU"),
  notes: z.string().optional(),
  accessInstructions: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export default async function customersRoutes(fastify: FastifyInstance) {
  // GET /api/v1/customers
  fastify.get(
    "/customers",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        search: z.string().optional(),
        isVip: z.coerce.boolean().optional(),
        tags: z.string().optional(),
        assignedToId: z.string().uuid().optional(),
        limit: z.coerce.number().default(25),
        offset: z.coerce.number().default(0),
      }).parse(request.query);

      const where: any = {
        tenantId: request.tenantId,
        deletedAt: null,
        ...(query.isVip !== undefined && { isVip: query.isVip }),
        ...(query.assignedToId && { assignedToId: query.assignedToId }),
        ...(query.search && {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { companyName: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search } },
          ],
        }),
      };

      if (query.tags) {
        const tagList = query.tags.split(",");
        where.tags = { hasSome: tagList };
      }

      const [customers, total] = await prisma.$transaction([
        prisma.customer.findMany({
          where,
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            _count: {
              select: {
                jobs: { where: { deletedAt: null } },
                invoices: { where: { deletedAt: null } },
                properties: { where: { deletedAt: null } },
              },
            },
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: query.limit,
          skip: query.offset,
        }),
        prisma.customer.count({ where }),
      ]);

      return { data: customers, meta: { total, limit: query.limit, offset: query.offset } };
    }
  );

  // POST /api/v1/customers
  fastify.post(
    "/customers",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager", "sales"])] },
    async (request, reply) => {
      const body = createCustomerSchema.parse(request.body);
      const { tenantId } = request;

      const phone = normalisePhone(body.phone, "AU");

      // Duplicate check
      const duplicate = await prisma.customer.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { phone },
            ...(body.email ? [{ email: body.email.toLowerCase() }] : []),
          ],
        },
      });
      if (duplicate) {
        return reply.status(409).send({
          error: {
            code: "DUPLICATE_CUSTOMER",
            message: "A customer with this phone or email already exists",
            existingId: duplicate.id,
          },
        });
      }

      const customer = await prisma.customer.create({
        data: {
          tenantId,
          firstName: body.firstName,
          lastName: body.lastName ?? "",
          companyName: body.companyName,
          email: body.email?.toLowerCase(),
          phone,
          mobile: body.altPhone ? normalisePhone(body.altPhone, "AU") : undefined,
          internalNotes: body.notes,
          tags: body.tags,
          assignedToId: body.assignedToId,
          sourceLeadId: body.leadId,
          customerNumber: `CUS-${Date.now().toString(36).toUpperCase()}`,
          createdById: request.userId,
        },
      });

      // If converted from a lead, mark the lead as won
      if (body.leadId) {
        await prisma.lead.update({
          where: { id: body.leadId, tenantId },
          data: { status: "converted", convertedAt: new Date(), convertedToCustomerId: customer.id },
        });
      }

      auditFromRequest(request, "create", "customer", customer.id).catch(() => {});

      return reply.status(201).send({ data: customer });
    }
  );

  // POST /api/v1/customers/import-file — bulk-import customers from a .csv/.xlsx
  // (e.g. a list exported from another system). Flexible column matching + dedupe.
  fastify.post(
    "/customers/import-file",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });

      let rows: string[][];
      try {
        rows = await bufferToRows(await file.toBuffer(), file.filename ?? "", file.mimetype ?? "");
      } catch (err: any) {
        return reply.status(422).send({ error: { code: "PARSE_ERROR", message: `Could not read file: ${err.message}` } });
      }
      if (rows.length < 2) {
        return reply.status(422).send({ error: { code: "NO_ROWS", message: "File has a header but no data rows" } });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: request.tenantId }, select: { country: true } });
      const idx = buildHeaderIndex(rows[0], CUSTOMER_ALIASES);
      if (idx.name === undefined && idx.firstName === undefined && idx.company === undefined && idx.email === undefined) {
        return reply.status(422).send({ error: { code: "NO_COLUMNS", message: "Couldn't find a name, company or email column" } });
      }

      const errors: string[] = [];
      let imported = 0;
      let skipped = 0;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.every((c) => (c ?? "").trim() === "")) continue;
        const get = (f: string) => (idx[f] !== undefined ? (row[idx[f]] ?? "").trim() : "");

        const fullName = get("name");
        const firstName = get("firstName") || (fullName ? fullName.split(" ")[0] : "") || null;
        const lastName = get("lastName") || (fullName ? fullName.split(" ").slice(1).join(" ") : "") || null;
        const company = get("company") || null;
        const email = (get("email") || "").toLowerCase() || null;
        const rawPhone = get("phone") || null;
        const phone = rawPhone ? normalisePhone(rawPhone, tenant?.country ?? "AU") : null;

        if (!firstName && !company && !email) { errors.push(`Row ${r + 1}: no name, company or email`); continue; }

        // Dedupe within tenant by email or phone.
        if (email || phone) {
          const dup = await prisma.customer.findFirst({
            where: {
              tenantId: request.tenantId, deletedAt: null,
              OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
            },
          });
          if (dup) { skipped += 1; continue; }
        }

        await prisma.customer.create({
          data: {
            tenantId: request.tenantId,
            firstName, lastName, companyName: company,
            email, phone,
            billingStreet: get("address") || null,
            billingSuburb: get("suburb") || null,
            billingPostcode: get("postcode") || null,
            internalNotes: get("notes") || null,
            createdById: request.userId,
          },
        });
        imported += 1;
      }

      return reply.status(201).send({ data: { imported, skipped, parsed: imported + skipped, errors: errors.slice(0, 50) } });
    }
  );

  // GET /api/v1/customers/:id
  fastify.get(
    "/customers/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const customer = await prisma.customer.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          properties: { where: { deletedAt: null }, orderBy: [{ createdAt: "asc" }] },
          quotes: {
            where: { deletedAt: null },
            select: { id: true, quoteNumber: true, status: true, totalCents: true, createdAt: true, validUntil: true },
            orderBy: { createdAt: "desc" },
          },
          jobs: {
            where: { deletedAt: null },
            select: { id: true, jobNumber: true, title: true, status: true, scheduledStart: true },
            orderBy: { createdAt: "desc" },
          },
          invoices: {
            where: { deletedAt: null },
            select: { id: true, invoiceNumber: true, status: true, totalCents: true, amountDueCents: true, dueDate: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      // Calculate lifetime value
      const lifetimeValue = await prisma.payment.aggregate({
        where: { tenantId: request.tenantId, customerId: id, status: "completed" },
        _sum: { amountCents: true },
      });

      return {
        data: {
          ...customer,
          lifetimeValueCents: lifetimeValue._sum.amountCents ?? 0,
        },
      };
    }
  );

  // PATCH /api/v1/customers/:id
  fastify.patch(
    "/customers/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager", "sales"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        companyName: z.string().max(200).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        altPhone: z.string().optional(),
        abn: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        isVip: z.boolean().optional(),
        assignedToId: z.string().uuid().optional(),
      }).parse(request.body);

      const customer = await prisma.customer.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          companyName: body.companyName,
          email: body.email ? body.email.toLowerCase() : undefined,
          phone: body.phone ? normalisePhone(body.phone, "AU") : undefined,
          mobile: body.altPhone ? normalisePhone(body.altPhone, "AU") : undefined,
          internalNotes: body.notes,
          tags: body.tags,
          assignedToId: body.assignedToId,
        },
      });

      auditFromRequest(request, "update", "customer", id).catch(() => {});

      return { data: updated };
    }
  );

  // DELETE /api/v1/customers/:id
  fastify.delete(
    "/customers/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const customer = await prisma.customer.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: {
          jobs: { where: { status: { in: ["pending", "scheduled", "in_progress"] } }, take: 1 },
        },
      });
      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      if (customer.jobs.length > 0) {
        return reply.status(409).send({
          error: { code: "ACTIVE_JOBS", message: "Cannot delete customer with active jobs" },
        });
      }

      await prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      auditFromRequest(request, "delete", "customer", id).catch(() => {});

      return reply.status(204).send();
    }
  );

  // GET /api/v1/customers/:id/properties
  fastify.get(
    "/customers/:id/properties",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const properties = await prisma.property.findMany({
        where: { customerId: id, tenantId: request.tenantId, deletedAt: null },
        orderBy: [{ createdAt: "asc" }],
      });

      return { data: properties };
    }
  );

  // POST /api/v1/customers/:id/properties
  fastify.post(
    "/customers/:id/properties",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = createPropertySchema.parse(request.body);

      const customer = await prisma.customer.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!customer) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Customer not found" } });
      }

      const property = await prisma.property.create({
        data: {
          tenantId: request.tenantId,
          customerId: id,
          propertyType: body.type,
          streetAddress: body.streetAddress,
          suburb: body.suburb,
          city: body.city,
          state: body.state,
          postcode: body.postcode,
          country: body.country,
          latitude: body.latitude,
          longitude: body.longitude,
          accessNotes: body.accessInstructions,
          notes: body.notes,
        },
      });

      return reply.status(201).send({ data: property });
    }
  );

  // GET /api/v1/customers/:id/activity
  fastify.get(
    "/customers/:id/activity",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = z.object({
        limit: z.coerce.number().default(50),
      }).parse(request.query);

      // Aggregate recent activity across all linked entities
      const [recentJobs, recentInvoices, recentQuotes, recentMessages] = await prisma.$transaction([
        prisma.job.findMany({
          where: { customerId: id, tenantId: request.tenantId, deletedAt: null },
          select: { id: true, jobNumber: true, title: true, status: true, scheduledStart: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.invoice.findMany({
          where: { customerId: id, tenantId: request.tenantId, deletedAt: null },
          select: { id: true, invoiceNumber: true, status: true, totalCents: true, dueDate: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.quote.findMany({
          where: { customerId: id, tenantId: request.tenantId, deletedAt: null },
          select: { id: true, quoteNumber: true, status: true, totalCents: true, validUntil: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.message.findMany({
          where: { customerId: id, tenantId: request.tenantId },
          select: { id: true, channel: true, direction: true, body: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

      const timeline = [
        ...recentJobs.map((j) => ({ type: "job", ...j })),
        ...recentInvoices.map((i) => ({ type: "invoice", ...i })),
        ...recentQuotes.map((q) => ({ type: "quote", ...q })),
        ...recentMessages.map((m) => ({ type: "message", ...m })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, query.limit);

      return { data: timeline };
    }
  );
}
