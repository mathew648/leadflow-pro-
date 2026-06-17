/** Subscription plan catalogue — single source of truth for billing + limits. */
export type PlanId = "starter" | "growth" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceAudCents: number;
  priceNzdCents: number;
  maxUsers: number;
  maxLeadsPerMonth: number;
  storageGb: number;
}

export const PLANS: Record<PlanId, Plan> = {
  starter: { id: "starter", name: "Starter", priceAudCents: 9900, priceNzdCents: 10900, maxUsers: 1, maxLeadsPerMonth: 500, storageGb: 5 },
  growth: { id: "growth", name: "Growth", priceAudCents: 24900, priceNzdCents: 27900, maxUsers: 5, maxLeadsPerMonth: 5000, storageGb: 25 },
  pro: { id: "pro", name: "Pro", priceAudCents: 44900, priceNzdCents: 49900, maxUsers: 15, maxLeadsPerMonth: 25000, storageGb: 100 },
};

/** Monthly price in the tenant's currency (cents). */
export function planPriceCents(plan: Plan, country: string): number {
  return country === "NZ" ? plan.priceNzdCents : plan.priceAudCents;
}
