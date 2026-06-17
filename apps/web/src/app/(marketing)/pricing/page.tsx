import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Pricing — TradieJet" };

const PLANS = [
  {
    name: "Sole Trader",
    price: 20,
    users: "1 user",
    highlight: false,
    features: ["Lead capture (website, Google, Meta)", "Quotes, jobs & invoices", "Online card payments", "Automated follow-ups", "1 user"],
  },
  {
    name: "Company",
    price: 50,
    users: "Up to 15 users",
    highlight: true,
    features: ["Everything in Sole Trader", "Team of 3+ (up to 15)", "Scheduling & field app", "Accounting sync (Xero/MYOB)", "Advanced analytics"],
  },
  {
    name: "Website + System",
    price: 149,
    users: "Up to 15 users",
    highlight: false,
    features: ["Everything in Company", "Done-for-you website", "Website builder in your panel", "Hosting included", "Leads flow from your site"],
  },
  {
    name: "Lead Manager",
    price: 10,
    users: "Not a tradie · up to 3 users",
    highlight: false,
    features: ["Capture leads from anywhere", "Chase & mark won", "Contact & follow-up automations", "Invoicing (optional)", "Simple, clean workspace"],
  },
];

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold">Simple pricing for every business</h1>
        <p className="mt-3 text-gray-600">14-day free trial on every plan. No credit card to start. Same price in AUD &amp; NZD, per month.</p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-start">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-6 ${p.highlight ? "border-brand-600 shadow-lg ring-1 ring-brand-600" : ""}`}
          >
            {p.highlight && (
              <span className="inline-block rounded-full bg-brand-100 text-brand-700 px-3 py-1 text-xs font-semibold mb-3">
                Most popular
              </span>
            )}
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="mt-1 text-xs text-gray-500">{p.users}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">${p.price}</span>
              <span className="text-gray-500 text-sm">/mo</span>
            </div>
            <p className="text-xs text-gray-500">AUD / NZD</p>
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

      <p className="mt-10 text-center text-sm text-gray-500">
        Need more? <Link href="/register" className="text-brand-700 font-medium hover:underline">Talk to us</Link> about custom &amp; enterprise plans.
      </p>
    </section>
  );
}
