"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

interface Plan {
  name: string;
  monthly: number;
  annual: number;
  unit: string;
  who: string;
  highlight?: boolean;
  inherits?: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: "Solo", monthly: 20, annual: 200, unit: "1 user", who: "Sole traders",
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
  {
    name: "Team", monthly: 50, annual: 500, unit: "up to 15 users", who: "Trade crews (3+)", highlight: true, inherits: "Solo",
    features: [
      "Up to 15 team members — one flat price",
      "Job scheduling & dispatch",
      "Roles & permissions",
      "AI lead scoring & assistant",
      "Advanced analytics & reporting",
    ],
  },
  {
    name: "Pro + Website", monthly: 149, annual: 1490, unit: "up to 15 users", who: "Want a website too", inherits: "Team",
    features: [
      "Done-for-you website, built by us",
      "Edit it yourself anytime (builder)",
      "Hosting included",
      "Leads flow straight from your site",
      "Priority support",
    ],
  },
  {
    name: "Lead Manager", monthly: 10, annual: 100, unit: "up to 3 users", who: "Not a tradie",
    features: [
      "Capture leads from anywhere",
      "Chase, qualify & mark won",
      "Contact & follow-up automations",
      "Invoicing (optional)",
      "Simple, clean workspace",
    ],
  },
];

export function PricingTable() {
  const [annual, setAnnual] = useState(false);

  return (
    <>
      {/* Billing toggle */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <span className={annual ? "text-gray-500" : "font-semibold"}>Monthly</span>
        <button
          type="button"
          onClick={() => setAnnual((a) => !a)}
          className="relative w-14 h-7 rounded-full bg-brand-600 transition-colors"
          aria-label="Toggle annual billing"
        >
          <span className={`absolute top-1 ${annual ? "left-8" : "left-1"} w-5 h-5 rounded-full bg-white transition-all`} />
        </button>
        <span className={annual ? "font-semibold" : "text-gray-500"}>
          Annual <span className="text-green-600 font-semibold">· 2 months free</span>
        </span>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-start">
        {PLANS.map((p) => {
          const price = annual ? p.annual : p.monthly;
          const suffix = annual ? "/yr" : "/mo";
          return (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${p.highlight ? "border-brand-600 shadow-xl ring-1 ring-brand-600 lg:-mt-3 lg:mb-3" : ""}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 text-white px-3 py-1 text-xs font-semibold shadow">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className="text-xs text-gray-500">{p.who} · {p.unit}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">${price}</span>
                <span className="text-gray-500 text-sm">{suffix}</span>
              </div>
              <p className="text-xs text-gray-400">AUD / NZD{annual ? ` · save $${p.monthly * 2}` : ""}</p>
              <Link
                href="/register"
                className={`mt-5 block text-center rounded-lg px-4 py-2.5 font-semibold ${
                  p.highlight ? "bg-brand-600 text-white hover:bg-brand-700" : "border hover:bg-gray-50"
                }`}
              >
                Start free trial
              </Link>
              {p.inherits && <p className="mt-5 text-xs font-medium text-gray-500">Everything in {p.inherits}, plus:</p>}
              <ul className={`${p.inherits ? "mt-2" : "mt-5"} space-y-2.5`}>
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
