import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { TRADES } from "@/lib/landing-data";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Job Management Software by Trade · TradieJet",
  description:
    "TradieJet is all-in-one job management software for AU & NZ trades — electricians, plumbers, builders, HVAC, landscapers and painters. Capture leads, quote, schedule, invoice and get paid.",
  alternates: { canonical: `${SITE_URL}/for` },
  openGraph: {
    type: "website",
    title: "Job Management Software by Trade · TradieJet",
    description: "Pick your trade and see how TradieJet helps you win more work with less admin.",
    url: `${SITE_URL}/for`,
  },
};

export default function TradesHubPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Software built for your trade</h1>
          <p className="mt-5 text-lg text-brand-100 max-w-2xl mx-auto">
            One platform to capture leads, send quotes, schedule jobs, invoice and get paid — tailored to how your trade actually works.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((t) => (
            <Link
              key={t.slug}
              href={`/for/${t.slug}`}
              className="group rounded-2xl border p-6 hover:shadow-lg hover:border-brand-200 transition-all"
            >
              <h2 className="font-semibold text-lg group-hover:text-brand-700">{t.name}</h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{t.subhead}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
                See how it works <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-center text-gray-600">
          Don&apos;t see your trade? TradieJet works for any trades business.{" "}
          <Link href="/register" className="font-semibold text-brand-700 hover:underline">Start your free trial</Link>.
        </p>
      </section>
    </>
  );
}
