/** Shared CSV/XLSX parsing + flexible header mapping for file imports. */

/** Minimal RFC-4180-ish CSV parser: quoted fields, embedded commas/newlines, escaped quotes. */
export function parseCsv(text: string): string[][] {
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

/** Parse an uploaded file buffer (.csv or .xlsx) into rows of strings. */
export async function bufferToRows(buffer: Buffer, filename: string, mimetype: string): Promise<string[][]> {
  const name = (filename ?? "").toLowerCase();
  const mt = mimetype ?? "";
  const isXlsx = name.endsWith(".xlsx") || mt.includes("spreadsheetml") || mt.includes("ms-excel");
  if (isXlsx) {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const rows: string[][] = [];
    ws.eachRow((row) => rows.push((row.values as unknown[]).slice(1).map(cellToString)));
    return rows;
  }
  return parseCsv(buffer.toString("utf8"));
}

export const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map header row → { field: columnIndex } using alias lists (normalised). */
export function buildHeaderIndex(headerRow: string[], aliases: Record<string, string[]>): Record<string, number> {
  const idx: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const n = normHeader(h);
    for (const [field, list] of Object.entries(aliases)) {
      if (idx[field] === undefined && list.includes(n)) idx[field] = i;
    }
  });
  return idx;
}
