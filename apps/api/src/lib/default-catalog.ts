import type { Prisma, PrismaClient } from "@lfp/db";

/**
 * Starter price-book items seeded at signup, keyed by the trade names captured on the
 * registration form. Gives non-technical tradies a usable catalog on day one instead of
 * a blank slate. Prices are sensible AU/NZ ballparks in cents (ex-GST sell price) and are
 * meant to be edited; the tenant's GST rate is applied at seed time.
 */
export interface StarterItem {
  name: string;
  code: string;
  type: "labour" | "material" | "equipment" | "subcontract" | "other";
  unit: string;
  sellCents: number;
  costCents?: number;
  category: string;
}

// Always added, regardless of trade — the universal basics.
const GENERIC: StarterItem[] = [
  { name: "Standard labour (per hour)", code: "LAB-STD", type: "labour", unit: "hr", sellCents: 9500, costCents: 4500, category: "Labour" },
  { name: "After-hours / emergency callout", code: "LAB-AH", type: "labour", unit: "callout", sellCents: 18000, category: "Labour" },
  { name: "Apprentice labour (per hour)", code: "LAB-APP", type: "labour", unit: "hr", sellCents: 6500, costCents: 3000, category: "Labour" },
  { name: "Travel / call-out fee", code: "FEE-TRV", type: "other", unit: "each", sellCents: 8000, category: "Fees" },
];

const ITEMS_BY_TRADE: Record<string, StarterItem[]> = {
  Electrical: [
    { name: "Switchboard upgrade", code: "ELE-SB", type: "labour", unit: "job", sellCents: 145000, category: "Electrical" },
    { name: "Power point install", code: "ELE-PP", type: "labour", unit: "each", sellCents: 12000, category: "Electrical" },
    { name: "LED downlight (supply & install)", code: "ELE-DL", type: "material", unit: "each", sellCents: 8500, costCents: 3500, category: "Lighting" },
    { name: "RCD safety switch", code: "ELE-RCD", type: "material", unit: "each", sellCents: 9500, costCents: 4500, category: "Safety" },
    { name: "Smoke alarm (photoelectric)", code: "ELE-SA", type: "material", unit: "each", sellCents: 7500, costCents: 3000, category: "Safety" },
    { name: "Ceiling fan install", code: "ELE-CF", type: "labour", unit: "each", sellCents: 18000, category: "Electrical" },
  ],
  Plumbing: [
    { name: "Hot water cylinder (supply & install)", code: "PLM-HWC", type: "material", unit: "each", sellCents: 220000, costCents: 130000, category: "Hot Water" },
    { name: "Tap / mixer replacement", code: "PLM-TAP", type: "labour", unit: "each", sellCents: 18000, category: "Tapware" },
    { name: "Toilet suite install", code: "PLM-WC", type: "material", unit: "each", sellCents: 45000, costCents: 22000, category: "Bathroom" },
    { name: "Blocked drain clearing", code: "PLM-DRN", type: "labour", unit: "job", sellCents: 28000, category: "Drainage" },
    { name: "Burst pipe repair", code: "PLM-PIPE", type: "labour", unit: "job", sellCents: 24000, category: "Repairs" },
  ],
  "HVAC/Air Conditioning": [
    { name: "Split system supply & install (2.5kW)", code: "HVC-SS25", type: "material", unit: "each", sellCents: 185000, costCents: 110000, category: "Air Conditioning" },
    { name: "Ducted system service", code: "HVC-DSVC", type: "labour", unit: "job", sellCents: 32000, category: "Servicing" },
    { name: "AC unit clean & regas", code: "HVC-REGAS", type: "labour", unit: "job", sellCents: 24000, category: "Servicing" },
    { name: "Heat pump install", code: "HVC-HP", type: "labour", unit: "job", sellCents: 95000, category: "Air Conditioning" },
  ],
  Solar: [
    { name: "Solar panel 440W", code: "SOL-PNL", type: "material", unit: "each", sellCents: 28000, costCents: 16000, category: "Solar" },
    { name: "Inverter 5kW (supply & install)", code: "SOL-INV", type: "material", unit: "each", sellCents: 165000, costCents: 95000, category: "Solar" },
    { name: "Battery storage install", code: "SOL-BAT", type: "labour", unit: "job", sellCents: 120000, category: "Solar" },
    { name: "System design & install (per kW)", code: "SOL-INST", type: "labour", unit: "kW", sellCents: 45000, category: "Solar" },
  ],
  Carpentry: [
    { name: "Decking (per m²)", code: "CAR-DECK", type: "labour", unit: "m2", sellCents: 28000, category: "Decking" },
    { name: "Internal door hang", code: "CAR-DOOR", type: "labour", unit: "each", sellCents: 16000, category: "Doors" },
    { name: "Framing (per m²)", code: "CAR-FRM", type: "labour", unit: "m2", sellCents: 9000, category: "Framing" },
    { name: "Custom shelving", code: "CAR-SHLF", type: "labour", unit: "lm", sellCents: 12000, category: "Joinery" },
  ],
  Painting: [
    { name: "Interior wall painting (per m²)", code: "PNT-INT", type: "labour", unit: "m2", sellCents: 3500, category: "Painting" },
    { name: "Exterior painting (per m²)", code: "PNT-EXT", type: "labour", unit: "m2", sellCents: 4500, category: "Painting" },
    { name: "Premium paint (per litre)", code: "PNT-MAT", type: "material", unit: "L", sellCents: 4500, costCents: 2500, category: "Materials" },
    { name: "Surface prep & priming (per m²)", code: "PNT-PREP", type: "labour", unit: "m2", sellCents: 2000, category: "Painting" },
  ],
  Tiling: [
    { name: "Floor tiling (per m²)", code: "TIL-FLR", type: "labour", unit: "m2", sellCents: 7000, category: "Tiling" },
    { name: "Wall tiling (per m²)", code: "TIL-WALL", type: "labour", unit: "m2", sellCents: 8000, category: "Tiling" },
    { name: "Waterproofing (per m²)", code: "TIL-WP", type: "labour", unit: "m2", sellCents: 6000, category: "Tiling" },
  ],
  Roofing: [
    { name: "Roof restoration (per m²)", code: "ROF-RST", type: "labour", unit: "m2", sellCents: 5500, category: "Roofing" },
    { name: "Gutter replacement (per lm)", code: "ROF-GUT", type: "material", unit: "lm", sellCents: 6500, costCents: 3000, category: "Guttering" },
    { name: "Leak repair", code: "ROF-LEAK", type: "labour", unit: "job", sellCents: 38000, category: "Repairs" },
    { name: "Ridge capping re-point", code: "ROF-RIDGE", type: "labour", unit: "lm", sellCents: 4500, category: "Roofing" },
  ],
  Landscaping: [
    { name: "Turf supply & lay (per m²)", code: "LND-TURF", type: "material", unit: "m2", sellCents: 2500, costCents: 1200, category: "Landscaping" },
    { name: "Retaining wall (per m²)", code: "LND-WALL", type: "labour", unit: "m2", sellCents: 35000, category: "Landscaping" },
    { name: "Garden maintenance (per hour)", code: "LND-MNT", type: "labour", unit: "hr", sellCents: 7500, category: "Maintenance" },
    { name: "Paving (per m²)", code: "LND-PAV", type: "labour", unit: "m2", sellCents: 12000, category: "Landscaping" },
  ],
  Concreting: [
    { name: "Concrete slab (per m²)", code: "CON-SLAB", type: "labour", unit: "m2", sellCents: 11000, category: "Concreting" },
    { name: "Exposed aggregate (per m²)", code: "CON-AGG", type: "labour", unit: "m2", sellCents: 15000, category: "Concreting" },
    { name: "Driveway (per m²)", code: "CON-DRV", type: "labour", unit: "m2", sellCents: 13000, category: "Concreting" },
  ],
  Fencing: [
    { name: "Colorbond fence (per lm)", code: "FNC-CB", type: "material", unit: "lm", sellCents: 12000, costCents: 6000, category: "Fencing" },
    { name: "Timber paling fence (per lm)", code: "FNC-TMB", type: "material", unit: "lm", sellCents: 10000, costCents: 5000, category: "Fencing" },
    { name: "Gate supply & install", code: "FNC-GATE", type: "material", unit: "each", sellCents: 45000, costCents: 22000, category: "Fencing" },
  ],
  "Pest Control": [
    { name: "General pest treatment", code: "PST-GEN", type: "labour", unit: "job", sellCents: 18000, category: "Pest Control" },
    { name: "Termite inspection", code: "PST-TRM", type: "labour", unit: "job", sellCents: 28000, category: "Pest Control" },
    { name: "Rodent control program", code: "PST-ROD", type: "labour", unit: "job", sellCents: 22000, category: "Pest Control" },
  ],
  Cleaning: [
    { name: "End-of-lease clean", code: "CLN-EOL", type: "labour", unit: "job", sellCents: 35000, category: "Cleaning" },
    { name: "Regular house clean (per hour)", code: "CLN-REG", type: "labour", unit: "hr", sellCents: 5500, category: "Cleaning" },
    { name: "Carpet steam clean (per room)", code: "CLN-CRP", type: "labour", unit: "room", sellCents: 4500, category: "Cleaning" },
  ],
  "Security Systems": [
    { name: "CCTV camera (supply & install)", code: "SEC-CAM", type: "material", unit: "each", sellCents: 35000, costCents: 18000, category: "Security" },
    { name: "Alarm system install", code: "SEC-ALM", type: "labour", unit: "job", sellCents: 85000, category: "Security" },
    { name: "Access control / intercom", code: "SEC-ACC", type: "material", unit: "each", sellCents: 65000, costCents: 35000, category: "Security" },
  ],
};

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Seeds the starter price-book for a tenant based on its trades, plus a generic basics set.
 * Items duplicated across trades (by code) are de-duped. Safe inside a transaction.
 */
export async function seedStarterCatalog(
  tx: Tx,
  tenantId: string,
  tradeTypes: string[],
  gstRate: number
): Promise<number> {
  // Collect items for the tenant's trades, plus the generic basics, de-duped by code.
  const byCode = new Map<string, StarterItem>();
  for (const item of GENERIC) byCode.set(item.code, item);
  for (const trade of tradeTypes) {
    for (const item of ITEMS_BY_TRADE[trade] ?? []) byCode.set(item.code, item);
  }
  const items = [...byCode.values()];
  if (items.length === 0) return 0;

  // Resolve/create categories.
  const categoryMap = new Map<string, string>();
  for (const catName of [...new Set(items.map((i) => i.category))]) {
    const cat = await tx.catalogCategory.create({
      data: { tenantId, name: catName, position: 999 },
    });
    categoryMap.set(catName, cat.id);
  }

  const result = await tx.catalogItem.createMany({
    data: items.map((item) => ({
      tenantId,
      name: item.name,
      code: item.code,
      type: item.type,
      unit: item.unit,
      sellPriceCents: item.sellCents,
      costPriceCents: item.costCents ?? 0,
      gstRate,
      categoryId: categoryMap.get(item.category),
      gstApplicable: true,
      active: true,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
