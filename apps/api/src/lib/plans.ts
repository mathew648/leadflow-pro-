/** Subscription plan catalogue — single source of truth for billing + limits. */
export type PlanId = "sole_trader" | "company" | "website" | "non_tradie";

export interface Plan {
  id: PlanId;
  name: string;
  /** Same price in AUD and NZD (per the 2026 pricing). */
  priceCents: number;
  maxUsers: number;
  maxLeadsPerMonth: number;
  storageGb: number;
  /** Non-tradie plan gets the simplified lead-only experience. */
  accountType: "tradie" | "non_tradie";
  blurb: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  sole_trader: {
    id: "sole_trader", name: "Sole Trader", priceCents: 2000, maxUsers: 1, maxLeadsPerMonth: 1000, storageGb: 5,
    accountType: "tradie",
    blurb: "For one-person trade businesses.",
    features: ["Lead capture (website, Google, Meta)", "Quotes, jobs & invoices", "Online payments", "Automated follow-ups", "1 user"],
  },
  company: {
    id: "company", name: "Company", priceCents: 5000, maxUsers: 15, maxLeadsPerMonth: 10000, storageGb: 50,
    accountType: "tradie",
    blurb: "For trade companies with a team (3+ staff).",
    features: ["Everything in Sole Trader", "Up to 15 team members", "Scheduling & field app", "Accounting sync (Xero/MYOB)", "Advanced analytics"],
  },
  website: {
    id: "website", name: "Website + System", priceCents: 14900, maxUsers: 15, maxLeadsPerMonth: 10000, storageGb: 100,
    accountType: "tradie",
    blurb: "We build your website and wire it straight into the system.",
    features: ["Everything in Company", "Done-for-you website", "Website builder in your panel", "Hosting included", "Leads flow straight from your site"],
  },
  non_tradie: {
    id: "non_tradie", name: "Lead Manager", priceCents: 1000, maxUsers: 3, maxLeadsPerMonth: 5000, storageGb: 10,
    accountType: "non_tradie",
    blurb: "Not a tradie? Capture, chase and convert leads — invoicing optional.",
    features: ["Lead capture (website, Google, Meta)", "Chase & mark won", "Contact & follow-up automations", "Invoicing (optional)", "Up to 3 users"],
  },
};

/** Monthly price in cents (same for AUD/NZD currently). */
export function planPriceCents(plan: Plan, _country: string): number {
  return plan.priceCents;
}
