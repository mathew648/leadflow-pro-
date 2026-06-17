import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Pricing — LeadFlow Pro" };

const PLANS = [
  {
    name: "Starter",
    aud: 99,
    nzd: 109,
    users: "1 user",
    highlight: false,
    features: ["Lead capture (web form + manual)", "Quotes & invoices", "Online card payments", "Starter price book", "Email support"],
  },
  {
    name: "Growth",
    aud: 249,
    nzd: 279,
    users: "Up to 5 users",
    highlight: true,
    features: ["Everything in Starter", "Google & Meta lead capture", "Automated email + SMS follow-ups", "Job scheduling & tracking", "Xero sync"],
  },
  {
    name: "Pro",
    aud: 449,
    nzd: 499,
    users: "Up to 15 users",
    highlight: false,
    features: ["Everything in Growth", "AI lead scoring & assistant", "Advanced analytics", "Custom automations", "Priority support"],
  },
];

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold">Simple pricing that grows with you</h1>
        <p className="mt-3 text-gray-600">14-day free trial on every plan. No credit card to start. Prices in AUD / NZD per month, ex GST.</p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3 items-start">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-7 ${p.highlight ? "border-brand-600 shadow-lg ring-1 ring-brand-600" : ""}`}
          >
            {p.highlight && (
              <span className="inline-block rounded-full bg-brand-100 text-brand-700 px-3 py-1 text-xs font-semibold mb-3">
                Most popular
              </span>
            )}
            <h2 className="text-xl font-bold">{p.name}</h2>
            <p className="mt-1 text-sm text-gray-500">{p.users}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">${p.aud}</span>
              <span className="text-gray-500">AUD/mo</span>
            </div>
            <p className="text-sm text-gray-500">or ${p.nzd} NZD/mo</p>
            <Link
              href="/register"
              className={`mt-6 block text-center rounded-lg px-4 py-2.5 font-semibold ${
                p.highlight ? "bg-brand-600 text-white hover:bg-brand-700" : "border hover:bg-gray-50"
              }`}
            >
              Start free trial
            </Link>
            <ul className="mt-6 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Enterprise */}
      <div className="mt-8 rounded-2xl border bg-gray-50 p-7 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Enterprise</h2>
          <p className="mt-1 text-sm text-gray-600">Unlimited users, custom integrations (MYOB, QuickBooks), onboarding &amp; SLA.</p>
        </div>
        <Link href="/register" className="rounded-lg border bg-white px-5 py-2.5 font-semibold hover:bg-gray-50 whitespace-nowrap">
          Talk to us
        </Link>
      </div>
    </section>
  );
}
