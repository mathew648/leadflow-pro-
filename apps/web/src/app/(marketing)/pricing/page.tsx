import Link from "next/link";
import { Check, X } from "lucide-react";
import { PricingTable } from "@/components/pricing-table";

export const metadata = { title: "Pricing — TradieJet" };

const COMPARE: (string | boolean)[][] = [
  ["Flat price for your whole team", true, false, false],
  ["Unlimited jobs on every plan", true, "limited", true],
  ["Capture your own leads (not shared)", true, false, false],
  ["Quote page + QR, no website needed", true, false, false],
  ["AI follow-ups & lead scoring", true, false, "some"],
  ["Built for AU/NZ (GST, Xero, MYOB)", true, true, "some"],
];

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold">One flat price. Your whole team.</h1>
        <p className="mt-3 text-gray-600">
          No per-user fees, no per-lead fees. 14-day free trial on every plan — no credit card to start.
          Same price in AUD &amp; NZD.
        </p>
      </div>

      <PricingTable />

      {/* Competitor comparison */}
      <div className="mt-24 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center">How TradieJet compares</h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          A 5-person crew on per-user software ≈ <strong>$260/mo</strong>. On TradieJet Team: <strong>$50/mo</strong>.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm border rounded-xl">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium text-center text-brand-700">TradieJet</th>
                <th className="px-4 py-3 font-medium text-center">Per-user job software</th>
                <th className="px-4 py-3 font-medium text-center">Lead marketplaces</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {COMPARE.map((row) => (
                <tr key={row[0] as string}>
                  <td className="px-4 py-3 font-medium">{row[0]}</td>
                  {row.slice(1).map((cell, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {cell === true ? <Check className="w-4 h-4 text-green-600 mx-auto" />
                        : cell === false ? <X className="w-4 h-4 text-gray-300 mx-auto" />
                        : <span className="text-xs text-gray-400">{String(cell)}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-gray-400">
          Based on competitors&rsquo; publicly listed pricing (2026). Product names are trademarks of their owners; TradieJet is not affiliated.
        </p>
      </div>

      <p className="mt-12 text-center text-sm text-gray-500">
        Need more than 15 users or something custom? <Link href="/register" className="text-brand-700 font-medium hover:underline">Talk to us</Link>.
      </p>
    </section>
  );
}
