import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Why TradieJet — Own your leads, flat pricing",
  description: "Stop renting shared leads and paying per user. TradieJet captures your own leads and charges one flat price for your whole team.",
};

export default function ComparePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold">Win more jobs. Keep more money.</h1>
          <p className="mt-5 text-lg text-brand-100 max-w-2xl mx-auto">
            Other tools either <strong>sell you shared leads</strong> or <strong>charge per user</strong>.
            TradieJet captures <em>your own</em> leads and runs your whole team on one flat price.
          </p>
          <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
            Start free — no credit card <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Wedge 1 — own your leads */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-3xl font-bold text-center">Stop renting shared leads</h2>
        <p className="mt-3 text-gray-600 text-center max-w-2xl mx-auto">
          Lead marketplaces charge a monthly fee <strong>plus $30–$80 per lead</strong> — and send that same lead to
          2–3 tradies who fight over it. You pay to compete.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border p-6 bg-gray-50">
            <h3 className="font-semibold text-lg text-gray-700">Lead marketplaces</h3>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              {["Pay per lead ($30–$80 each)", "Same lead sent to 2–3 competitors", "You don't own the relationship", "Monthly fee on top ($200–$600)"].map((t) => (
                <li key={t} className="flex gap-2"><X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-brand-600 p-6">
            <h3 className="font-semibold text-lg">TradieJet</h3>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {["Capture your OWN leads from your site, Google & Meta", "Exclusive — never shared", "Import your Builderscrack/hipages leads into one inbox too", "Instant auto-reply so you win the job", "No per-lead fees, ever"].map((t) => (
                <li key={t} className="flex gap-2"><Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Wedge 2 — flat pricing */}
      <section className="bg-gray-50 border-y">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-3xl font-bold text-center">Flat price — not per user</h2>
          <p className="mt-3 text-gray-600 text-center max-w-2xl mx-auto">
            Per-seat job software adds up fast. TradieJet&rsquo;s Company plan covers your whole team (up to 15) for one price.
          </p>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full max-w-2xl mx-auto text-sm bg-white rounded-xl border">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium">Team size</th>
                  <th className="px-4 py-3 font-medium">Per-user software (~$52/user)</th>
                  <th className="px-4 py-3 font-medium text-brand-700">TradieJet Company</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[["1 user", "$52/mo", "$50/mo"], ["5 users", "$260/mo", "$50/mo"], ["10 users", "$520/mo", "$50/mo"], ["15 users", "$780/mo", "$50/mo"]].map((r) => (
                  <tr key={r[0]}>
                    <td className="px-4 py-3 font-medium">{r[0]}</td>
                    <td className="px-4 py-3 text-gray-600">{r[1]}</td>
                    <td className="px-4 py-3 font-semibold text-brand-700">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs text-gray-500">Based on competitors&rsquo; publicly listed per-user pricing (June 2026). Sole traders start at $20/mo.</p>
        </div>
      </section>

      {/* Wedge 3 — all in one */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-3xl font-bold text-center">One platform, not three subscriptions</h2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-sm border rounded-xl">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">What you need</th>
                <th className="px-4 py-3 font-medium text-center">Lead marketplace</th>
                <th className="px-4 py-3 font-medium text-center">Job-only software</th>
                <th className="px-4 py-3 font-medium text-center text-brand-700">TradieJet</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["Capture your own leads", true, false, true],
                ["Auto-reply & follow-ups", false, "some", true],
                ["Quotes, jobs & invoices", false, true, true],
                ["Online payments", false, true, true],
                ["Xero / MYOB sync", false, true, true],
                ["Your own website", false, false, true],
                ["Flat team pricing", false, false, true],
              ].map((row) => (
                <tr key={row[0] as string}>
                  <td className="px-4 py-3 font-medium">{row[0]}</td>
                  {row.slice(1).map((cell, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {cell === true ? <Check className="w-4 h-4 text-green-600 mx-auto" />
                        : cell === false ? <X className="w-4 h-4 text-gray-300 mx-auto" />
                        : <span className="text-xs text-gray-400">limited</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold">Own your leads. Pay less. Win more.</h2>
          <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
            Start your free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <p className="mx-auto max-w-5xl px-4 py-8 text-xs text-gray-400 text-center">
        Comparisons are based on competitors&rsquo; publicly available pricing and features as of June 2026 and are for
        general guidance only. Product and brand names are trademarks of their respective owners; TradieJet is not
        affiliated with or endorsed by them.
      </p>
    </>
  );
}
