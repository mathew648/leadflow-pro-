import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export default async function catalogRoutes(fastify: FastifyInstance) {
  // GET /api/v1/catalog/categories
  fastify.get(
    "/catalog/categories",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const categories = await prisma.catalogCategory.findMany({
        where: { tenantId: request.tenantId },
        include: { _count: { select: { catalogItems: { where: { deletedAt: null } } } } },
        orderBy: { position: "asc" },
      });
      return { data: categories };
    }
  );

  // POST /api/v1/catalog/categories
  fastify.post(
    "/catalog/categories",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const body = z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        position: z.number().int().min(0).default(0),
      }).parse(request.body);

      const category = await prisma.catalogCategory.create({
        data: { tenantId: request.tenantId, ...body },
      });
      return reply.status(201).send({ data: category });
    }
  );

  // GET /api/v1/catalog/items
  fastify.get(
    "/catalog/items",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = z.object({
        categoryId: z.string().uuid().optional(),
        type: z.enum(["labour", "material", "equipment", "subcontract", "other"]).optional(),
        search: z.string().optional(),
        active: z.coerce.boolean().optional(),
        limit: z.coerce.number().default(50),
        offset: z.coerce.number().default(0),
      }).parse(request.query);

      const where: any = {
        tenantId: request.tenantId,
        deletedAt: null,
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.type && { type: query.type }),
        ...(query.active !== undefined && { isActive: query.active }),
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { code: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ],
        }),
      };

      const [items, total] = await prisma.$transaction([
        prisma.catalogItem.findMany({
          where,
          include: {
            category: { select: { id: true, name: true } },
          },
          orderBy: [{ category: { position: "asc" } }, { name: "asc" }],
          take: query.limit,
          skip: query.offset,
        }),
        prisma.catalogItem.count({ where }),
      ]);

      return { data: items, meta: { total, limit: query.limit, offset: query.offset } };
    }
  );

  // POST /api/v1/catalog/items
  fastify.post(
    "/catalog/items",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const body = z.object({
        categoryId: z.string().uuid().optional(),
        name: z.string().min(1).max(200),
        code: z.string().max(50).optional(),
        description: z.string().optional(),
        type: z.enum(["labour", "material", "equipment", "subcontract", "other"]).default("labour"),
        unit: z.string().max(20).optional(),
        unitPriceCents: z.number().int().min(0),
        unitCostCents: z.number().int().min(0).default(0),
        gstRate: z.number().min(0).max(1).optional(),
        defaultQuantity: z.number().positive().default(1),
        taxable: z.boolean().default(true),
        imageUrl: z.string().url().optional(),
      }).parse(request.body);

      // Use tenant default GST rate if not specified
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        select: { gstRate: true },
      });

      const item = await prisma.catalogItem.create({
        data: {
          tenantId: request.tenantId,
          categoryId: body.categoryId,
          name: body.name,
          code: body.code,
          description: body.description,
          type: body.type,
          unit: body.unit ?? "each",
          sellPriceCents: body.unitPriceCents,
          costPriceCents: body.unitCostCents,
          gstRate: body.gstRate ?? Number(tenant?.gstRate ?? 0.1),
          gstApplicable: body.taxable,
          active: true,
        },
      });

      return reply.status(201).send({ data: item });
    }
  );

  // GET /api/v1/catalog/items/:id
  fastify.get(
    "/catalog/items/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = await prisma.catalogItem.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        include: { category: true },
      });
      if (!item) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Catalog item not found" } });
      }
      return { data: item };
    }
  );

  // PATCH /api/v1/catalog/items/:id
  fastify.patch(
    "/catalog/items/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin", "manager"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        categoryId: z.string().uuid().optional(),
        name: z.string().min(1).max(200).optional(),
        code: z.string().max(50).optional(),
        description: z.string().optional(),
        type: z.enum(["labour", "material", "equipment", "subcontract", "other"]).optional(),
        unit: z.string().max(20).optional(),
        unitPriceCents: z.number().int().min(0).optional(),
        unitCostCents: z.number().int().min(0).optional(),
        gstRate: z.number().min(0).max(1).optional(),
        defaultQuantity: z.number().positive().optional(),
        taxable: z.boolean().optional(),
        isActive: z.boolean().optional(),
        imageUrl: z.string().url().optional(),
      }).parse(request.body);

      const item = await prisma.catalogItem.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!item) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Catalog item not found" } });
      }

      const updated = await prisma.catalogItem.update({
        where: { id },
        data: {
          categoryId: body.categoryId,
          name: body.name,
          code: body.code,
          description: body.description,
          type: body.type,
          unit: body.unit,
          sellPriceCents: body.unitPriceCents,
          costPriceCents: body.unitCostCents,
          gstRate: body.gstRate,
          gstApplicable: body.taxable,
          active: body.isActive,
        },
      });
      return { data: updated };
    }
  );

  // DELETE /api/v1/catalog/items/:id
  fastify.delete(
    "/catalog/items/:id",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = await prisma.catalogItem.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });
      if (!item) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Catalog item not found" } });
      }
      await prisma.catalogItem.update({ where: { id }, data: { deletedAt: new Date() } });
      return reply.status(204).send();
    }
  );

  // POST /api/v1/catalog/items/bulk-import
  fastify.post(
    "/catalog/items/bulk-import",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const body = z.object({
        items: z.array(z.object({
          name: z.string().min(1).max(200),
          code: z.string().max(50).optional(),
          description: z.string().optional(),
          type: z.enum(["labour", "material", "equipment", "subcontract", "other"]).default("labour"),
          unit: z.string().max(20).optional(),
          unitPriceCents: z.number().int().min(0),
          unitCostCents: z.number().int().min(0).default(0),
          gstRate: z.number().min(0).max(1).optional(),
          categoryName: z.string().optional(),
        })).max(500),
      }).parse(request.body);

      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        select: { gstRate: true },
      });

      // Resolve or create categories
      const categoryMap = new Map<string, string>();
      const uniqueCategories = [...new Set(body.items.map((i) => i.categoryName).filter(Boolean))];

      for (const catName of uniqueCategories) {
        if (!catName) continue;
        let cat = await prisma.catalogCategory.findFirst({
          where: { tenantId: request.tenantId, name: { equals: catName, mode: "insensitive" } },
        });
        if (!cat) {
          cat = await prisma.catalogCategory.create({
            data: { tenantId: request.tenantId, name: catName, position: 999 },
          });
        }
        categoryMap.set(catName, cat.id);
      }

      const result = await prisma.catalogItem.createMany({
        data: body.items.map((item) => ({
          tenantId: request.tenantId,
          name: item.name,
          code: item.code,
          description: item.description,
          type: item.type,
          unit: item.unit ?? "each",
          sellPriceCents: item.unitPriceCents,
          costPriceCents: item.unitCostCents,
          gstRate: item.gstRate ?? Number(tenant?.gstRate ?? 0.1),
          categoryId: item.categoryName ? categoryMap.get(item.categoryName) : undefined,
          gstApplicable: true,
          active: true,
        })),
        skipDuplicates: true,
      });

      return reply.status(201).send({ data: { imported: result.count } });
    }
  );
}
