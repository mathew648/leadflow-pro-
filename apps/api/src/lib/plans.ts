/** Subscription plan catalogue — single source of truth for billing + limits. */
export type PlanId = "sole_trader" | "company" | "website" | "non_tradie";
export type BillingCycle = "monthly" | "annual";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price (same in AUD and NZD). */
  priceCents: number;
  /** Annual price = 10 months (2 months free). */
  annualCents: number;
  maxUsers: number;
  maxLeadsPerMonth: number;
  storageGb: number;
  /** Non-tradie plan gets the simplified lead-only experience. */
  accountType: "tradie" | "non_tradie";
  tagline: string;
  blurb: string;
  /** Optional "Everything in X, plus:" lead-in for the pricing page. */
  inherits?: string;
  features: string[];
}

const annual = (monthly: number) => monthly * 10; // 2 months free

export const PLANS: Record<PlanId, Plan> = {
  sole_trader: {
    id: "sole_trader", name: "Solo", priceCents: 2000, annualCents: annual(2000),
    maxUsers: 1, maxLeadsPerMonth: 1000, storageGb: 5, accountType: "tradie",
    tagline: "For one-person trade businesses.",
    blurb: "Everything a sole trader needs to win and run jobs.",
    features: [
      "Your own quote page + QR — no website needed",
      "Capture leads from website, Google & Meta",
      "Unlimited quotes, jobs & invoices",
      "Online card payments",
      "Automated follow-ups & review requests",
      "Xero & MYOB sync",
      "Mobile app — install on your phone",
    ],
  },
  company: {
    id: "company", name: "Team", priceCents: 5000, annualCents: annual(5000),
    maxUsers: 15, maxLeadsPerMonth: 10000, storageGb: 50, accountType: "tradie",
    tagline: "For trade companies with a crew (3+).",
    blurb: "One flat price for your whole team — not per user.",
    inherits: "Solo",
    features: [
      "Up to 15 team members — one flat price",
      "Job scheduling & dispatch",
      "Roles & permissions",
      "AI lead scoring & assistant",
      "Advanced analytics & reporting",
    ],
  },
  website: {
    id: "website", name: "Pro + Website", priceCents: 14900, annualCents: annual(14900),
    maxUsers: 15, maxLeadsPerMonth: 10000, storageGb: 100, accountType: "tradie",
    tagline: "We build your website and wire it in.",
    blurb: "The full system plus a professional website, done for you.",
    inherits: "Team",
    features: [
      "Done-for-you website, built by us",
      "Edit it yourself anytime (website builder)",
      "Hosting included",
      "Leads flow straight from your site",
      "Priority support",
    ],
  },
  non_tradie: {
    id: "non_tradie", name: "Lead Manager", priceCents: 1000, annualCents: annual(1000),
    maxUsers: 3, maxLeadsPerMonth: 5000, storageGb: 10, accountType: "non_tradie",
    tagline: "Not a tradie? Just manage your leads.",
    blurb: "Capture, chase and convert leads — invoicing optional.",
    features: [
      "Capture leads from anywhere",
      "Chase, qualify & mark won",
      "Contact & follow-up automations",
      "Invoicing (optional)",
      "Up to 3 users",
    ],
  },
};

/** Monthly price in cents (same for AUD/NZD currently). */
export function planPriceCents(plan: Plan, _country: string): number {
  return plan.priceCents;
}

/** Price for a billing cycle (cents). */
export function planCycleCents(plan: Plan, cycle: BillingCycle): number {
  return cycle === "annual" ? plan.annualCents : plan.priceCents;
}
