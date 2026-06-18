import { config } from "../config.js";

/** Map a sender/subject to a known AU/NZ lead portal (for source tagging). */
const PORTALS: { match: RegExp; name: string }[] = [
  { match: /builderscrack/i, name: "Builderscrack" },
  { match: /hipages/i, name: "hipages" },
  { match: /nocowboys/i, name: "NoCowboys" },
  { match: /oneflare/i, name: "Oneflare" },
  { match: /serviceseeking/i, name: "ServiceSeeking" },
  { match: /airtasker/i, name: "Airtasker" },
  { match: /bark\.com/i, name: "Bark" },
];

export function detectPortal(from: string, subject = ""): string {
  const hay = `${from} ${subject}`;
  for (const p of PORTALS) if (p.match.test(hay)) return p.name;
  return "Email";
}

export interface ParsedLead {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  serviceRequired: string | null;
  message: string | null;
}

/** Heuristic fallback when no AI key is configured. */
function regexParse(text: string): ParsedLead {
  const emailMatch = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [])
    .find((e) => !/noreply|no-reply|notifications?@|support@|donotreply/i.test(e));
  const phoneMatch = (text.match(/(\+?\d[\d\s().-]{6,}\d)/g) ?? [])[0];
  return {
    firstName: null,
    lastName: null,
    email: emailMatch ? emailMatch.toLowerCase() : null,
    phone: phoneMatch ? phoneMatch.replace(/\s+/g, " ").trim() : null,
    serviceRequired: null,
    message: text.replace(/\s+/g, " ").trim().slice(0, 800),
  };
}

/**
 * Extract a structured lead from a forwarded portal notification email.
 * Uses Anthropic (fast model) when ANTHROPIC_API_KEY is set; falls back to regex.
 */
export async function parseLeadEmail(input: { from: string; subject: string; text: string }): Promise<ParsedLead> {
  const { from, subject, text } = input;
  if (!config.ANTHROPIC_API_KEY) return regexParse(text);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content:
            "You extract the CUSTOMER lead from a notification email a tradie received from a lead platform " +
            "(Builderscrack, hipages, NoCowboys, Oneflare, etc.). Return ONLY compact JSON with keys: " +
            "firstName, lastName, email, phone, serviceRequired, message. Use null when unknown. " +
            "Ignore the platform's own noreply address and the tradie's details — only the customer/job.\n\n" +
            `Subject: ${subject}\nFrom: ${from}\n\n${text.slice(0, 6000)}`,
        }],
      }),
    });
    if (!res.ok) return regexParse(text);
    const j = (await res.json()) as any;
    const raw: string = j?.content?.[0]?.text ?? "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return regexParse(text);
    const p = JSON.parse(raw.slice(start, end + 1));
    return {
      firstName: p.firstName ?? null,
      lastName: p.lastName ?? null,
      email: p.email ? String(p.email).toLowerCase() : null,
      phone: p.phone ? String(p.phone) : null,
      serviceRequired: p.serviceRequired ?? null,
      message: p.message ?? null,
    };
  } catch {
    return regexParse(text);
  }
}
