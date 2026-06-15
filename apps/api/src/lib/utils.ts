import crypto from "crypto";
import { config } from "../config.js";

// Generate unique sequential numbers with prefix
export async function generateNumber(
  prefix: string,
  nextNumber: number
): Promise<string> {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(nextNumber).padStart(4, "0")}`;
}

// Normalise phone numbers to E.164 format
export function normalisePhone(
  phone: string,
  country: string = "AU"
): string | null {
  const cleaned = phone.replace(/[\s\-().+]/g, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (/^\d{8,15}$/.test(digits)) return cleaned;
    return null;
  }

  if (country === "AU") {
    if (/^04\d{8}$/.test(cleaned)) return `+61${cleaned.slice(1)}`;
    if (/^614\d{8}$/.test(cleaned)) return `+${cleaned}`;
    if (/^0[2-9]\d{8}$/.test(cleaned)) return `+61${cleaned.slice(1)}`;
    if (/^61[2-9]\d{8}$/.test(cleaned)) return `+${cleaned}`;
  }
  if (country === "NZ") {
    if (/^02\d{7,9}$/.test(cleaned)) return `+64${cleaned.slice(1)}`;
    if (/^0[3-9]\d{7}$/.test(cleaned)) return `+64${cleaned.slice(1)}`;
    if (/^64[2-9]\d{7,9}$/.test(cleaned)) return `+${cleaned}`;
  }

  return null;
}

// Calculate line item totals with GST
export function calculateLineItem(
  quantity: number,
  unitPriceCents: number,
  gstRate: number,
  discountPercent: number = 0
) {
  const subtotalCents = Math.round(quantity * unitPriceCents);
  const discountCents = Math.round(subtotalCents * (discountPercent / 100));
  const discountedSubtotal = subtotalCents - discountCents;
  const gstCents = Math.round(discountedSubtotal * gstRate);
  const totalCents = discountedSubtotal + gstCents;

  return {
    subtotalCents,
    discountCents,
    discountedSubtotal,
    gstCents,
    totalCents,
  };
}

// Calculate quote/invoice totals from line items
export function calculateTotals(
  lineItems: Array<{
    quantity: number;
    unitPriceCents: number;
    discountPercent?: number;
    gstRate: number;
    isOptional?: boolean;
    isSelected?: boolean;
  }>
) {
  const activeItems = lineItems.filter(
    (li) => !li.isOptional || li.isSelected !== false
  );

  let subtotalCents = 0;
  let discountCents = 0;
  let gstCents = 0;
  let totalCents = 0;

  for (const item of activeItems) {
    const calc = calculateLineItem(
      item.quantity,
      item.unitPriceCents,
      item.gstRate,
      item.discountPercent ?? 0
    );
    subtotalCents += calc.subtotalCents;
    discountCents += calc.discountCents;
    gstCents += calc.gstCents;
    totalCents += calc.totalCents;
  }

  return { subtotalCents, discountCents, gstCents, totalCents };
}

// Encrypt sensitive data (OAuth tokens, etc.)
export function encrypt(text: string): string {
  const key = config.ENCRYPTION_KEY;
  if (!key) return text; // Dev fallback
  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(key, "hex");
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encrypted: string): string {
  const key = config.ENCRYPTION_KEY;
  if (!key) return encrypted; // Dev fallback
  const [ivHex, tagHex, dataHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const keyBuffer = Buffer.from(key, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

// Generate portal tokens
export function generatePortalToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Paginate cursor encoder/decoder
export function encodeCursor(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// Format cents as currency string
export function formatCurrency(cents: number, currency: string = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

// Sleep helper
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
