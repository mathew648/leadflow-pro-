import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const ITEM_TYPES = ["labour", "material", "equipment", "subcontract", "other"] as const;
type ItemType = (typeof ITEM_TYPES)[number];

interface ImportItem {
  name: string;
  code?: string;
  description?: string;
  type: ItemType;
  unit?: string;
  unitPriceCents: number;
  unitCostCents: number;
  gstRate?: number;
  categoryName?: string;
}

/**
 * Shared catalog import: resolves (creating as needed) categories by name, then
 * bulk-inserts items. Used by both the JSON bulk-import and the file-upload import.
 * Returns the number of rows actually inserted (duplicates by unique constraint skipped).
 */
async function importCatalogItems(tenantId: string, items: ImportItem[]): Promise<number> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { gstRate: true },
  });

  const categoryMap = new Map<string, string>();
  const uniqueCategories = [...new Set(items.map((i) => i.categoryName).filter(Boolean))] as string[];
  for (const catName of uniqueCategories) {
    let cat = await prisma.catalogCategory.findFirst({
      where: { tenantId, name: { equals: catName, mode: "insensitive" } },
    });
    if (!cat) {
      cat = await prisma.catalogCategory.create({
        data: { tenantId, name: catName, position: 999 },
      });
    }
    categoryMap.set(catName, cat.id);
  }

  const result = await prisma.catalogItem.createMany({
    data: items.map((item) => ({
      tenantId,
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

  return result.count;
}

// ── Spreadsheet parsing helpers (CSV inline; XLSX via exceljs) ──────────────

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas/newlines, escaped quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Coerce an exceljs cell value (string | number | rich-text | formula | hyperlink) to a string. */
function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, any>;
    if ("text" in o) return String(o.text);
    if ("result" in o) return String(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((t: any) => t.text).join("");
    if ("hyperlink" in o) return String(o.text ?? o.hyperlink);
    return String(v);
  }
  return String(v);
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "itemname", "item", "product", "service", "title"],
  code: ["code", "sku", "itemcode", "ref", "reference", "partno", "partnumber"],
  description: ["description", "desc", "details"],
  type: ["type", "itemtype", "kind"],
  unit: ["unit", "uom", "units", "measure"],
  price: ["price", "sellprice", "unitprice", "saleprice", "rate", "sell"],
  cost: ["cost", "costprice", "buyprice", "unitcost"],
  gst: ["gst", "gstrate", "tax", "taxrate", "vat"],
  category: ["category", "categoryname", "group", "section"],
};

const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

function buildHeaderIndex(headerRow: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const n = normHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (idx[field] === undefined && aliases.includes(n)) idx[field] = i;
    }
  });
  return idx;
}

function parseMoneyToCents(raw: string): number | null {
  const s = raw.replace(/[^0-9.\-]/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function parseGstRate(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  let n = Number(raw.replace(/[%\s]/g, ""));
  if (!Number.isFinite(n)) return undefined;
  if (n > 1) n = n / 100; // accept 10 / 15 as 0.10 / 0.15
  return n;
}

function normType(raw: string): ItemType {
  const n = raw.toLowerCase().trim();
  if (n.startsWith("labo")) return "labour"; // labour / labor
  if (n.startsWith("mat")) return "material";
  if (n.startsWith("equip")) return "equipment";
  if (n.startsWith("sub")) return "subcontract";
  return (ITEM_TYPES as readonly string[]).includes(n) ? (n as ItemType) : "labour";
}

/** Map parsed rows (first row = header) into import items, collecting per-row errors. */
function rowsToItems(rows: string[][]): { items: ImportItem[]; errors: string[] } {
  const errors: string[] = [];
  if (rows.length < 2) return { items: [], errors: ["File has a header but no data rows"] };

  const idx = buildHeaderIndex(rows[0]);
  if (idx.name === undefined && idx.description === undefined) {
    return { items: [], errors: ["Could not find a 'name' column"] };
  }
  if (idx.price === undefined) {
    return { items: [], errors: ["Could not find a 'price' column"] };
  }

  const items: ImportItem[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => (c ?? "").trim() === "")) continue; // blank line
    const get = (f: string) => (idx[f] !== undefined ? (row[idx[f]] ?? "").trim() : "");

    const name = get("name") || get("description");
    if (!name) { errors.push(`Row ${r + 1}: missing name`); continue; }
    const priceCents = parseMoneyToCents(get("price"));
    if (priceCents === null) { errors.push(`Row ${r + 1}: invalid/missing price`); continue; }

    items.push({
      name: name.slice(0, 200),
      code: get("code") || undefined,
      // Only keep a separate description when there's a real name column.
      description: (idx.name !== undefined ? get("description") : "") || undefined,
      type: normType(get("type")),
      unit: get("unit") || undefined,
      unitPriceCents: priceCents,
      unitCostCents: parseMoneyToCents(get("cost")) ?? 0,
      gstRate: parseGstRate(get("gst")),
      categoryName: get("category") || undefined,
    });
  }
  return { items, errors };
}

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

      const imported = await importCatalogItems(request.tenantId, body.items);
      return reply.status(201).send({ data: { imported } });
    }
  );

  // POST /api/v1/catalog/items/import-file
  // Multipart upload of a .csv or .xlsx price list. Columns are matched by header
  // name (flexible aliases), prices are parsed to cents, and rows are imported via
  // the shared importer. Returns counts plus per-row errors for anything skipped.
  fastify.post(
    "/catalog/items/import-file",
    { preHandler: [fastify.authenticate, fastify.requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
      }

      const buffer = await file.toBuffer();
      const filename = (file.filename ?? "").toLowerCase();
      const mimetype = file.mimetype ?? "";
      const isXlsx = filename.endsWith(".xlsx") || mimetype.includes("spreadsheetml") || mimetype.includes("ms-excel");
      const isCsv = filename.endsWith(".csv") || mimetype.includes("csv") || mimetype === "text/plain";

      let rows: string[][];
      try {
        if (isXlsx) {
          const { default: ExcelJS } = await import("exceljs");
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buffer as any);
          const ws = wb.worksheets[0];
          if (!ws) {
            return reply.status(422).send({ error: { code: "EMPTY_FILE", message: "Spreadsheet has no sheets" } });
          }
          rows = [];
          ws.eachRow((row) => {
            rows.push((row.values as unknown[]).slice(1).map(cellToString));
          });
        } else if (isCsv) {
          rows = parseCsv(buffer.toString("utf8"));
        } else {
          return reply.status(422).send({ error: { code: "INVALID_TYPE", message: "Upload a .csv or .xlsx file" } });
        }
      } catch (err: any) {
        return reply.status(422).send({ error: { code: "PARSE_ERROR", message: `Could not read file: ${err.message}` } });
      }

      const { items, errors } = rowsToItems(rows);
      if (items.length === 0) {
        return reply.status(422).send({
          error: { code: "NO_ROWS", message: "No valid rows found", details: errors.slice(0, 50) },
        });
      }
      if (items.length > 2000) {
        return reply.status(422).send({ error: { code: "TOO_MANY", message: "Limit is 2000 rows per import" } });
      }

      const imported = await importCatalogItems(request.tenantId, items);
      return reply.status(201).send({
        data: { imported, parsed: items.length, skipped: errors.length, errors: errors.slice(0, 50) },
      });
    }
  );
}
