import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check, AlertCircle } from "lucide-react";
import { getTrade, TRADES, TRADE_SLUGS } from "@/lib/landing-data";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// Pre-render every trade page at build time (fast, fully static, great for SEO).
export function generateStaticParams() {
  return TRADE_SLUGS.map((trade) => ({ trade }));
}

export async function generateMetadata({ params }: { params: Promise<{ trade: string }> }): Promise<Metadata> {
  const { trade: slug } = await params;
  const trade = getTrade(slug);
  if (!trade) return { title: "Not found · TradieJet", robots: { index: false } };
  const url = `${SITE_URL}/for/${slug}`;
  return {
    title: trade.metaTitle,
    description: trade.metaDescription,
    alternates: { canonical: url },
    openGraph: { type: "website", title: trade.metaTitle, description: trade.metaDescription, url },
    twitter: { card: "summary_large_image", title: trade.metaTitle, description: trade.metaDescription },
  };
}

export default async function TradeLandingPage({ params }: { params: Promise<{ trade: string }> }) {
  const { trade: slug } = await params;
  const trade = getTrade(slug);
  if (!trade) notFound();

  const url = `${SITE_URL}/for/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "For your trade", item: `${SITE_URL}/for` },
          { "@type": "ListItem", position: 3, name: trade.name, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: trade.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const others = TRADES.filter((t) => t.slug !== slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <p className="text-sm font-semibold text-brand-200 uppercase tracking-wide">For {trade.name}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">{trade.headline}</h1>
          <p className="mt-5 text-lg text-brand-100 max-w-2xl mx-auto">{trade.subhead}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50 shadow-lg shadow-brand-900/20">
              Start your 14-day free trial
            </Link>
            <Link href="/pricing" className="rounded-lg bg-white/10 px-6 py-3 font-semibold text-white ring-1 ring-white/25 hover:bg-white/20">
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-brand-200">No credit card required · Set up in minutes</p>
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-3xl font-bold text-center">Sound familiar?</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {trade.painPoints.map((p) => (
            <div key={p} className="rounded-2xl border bg-gray-50 p-5">
              <AlertCircle className="w-5 h-5 text-brand-600" />
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-gray-600 max-w-2xl mx-auto">
          TradieJet puts the whole job — lead to paid — in one place, so you spend less time on admin and more time on the tools.
        </p>
      </section>

      {/* Trade-tailored features */}
      <section className="bg-gray-50 border-y">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-3xl font-bold text-center">Built for the way {trade.name.toLowerCase()} work</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {trade.features.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-white p-6">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-3xl font-bold text-center">Questions from {trade.name.toLowerCase()}</h2>
        <div className="mt-8 divide-y border-y">
          {trade.faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex items-center justify-between cursor-pointer list-none font-medium">
                {f.q}
                <span className="ml-4 text-brand-600 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold">Ready to win more work with less admin?</h2>
          <p className="mt-3 text-brand-100">Start free today. No credit card, no lock-in.</p>
          <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
            Start your free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Internal links to other trades */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm font-semibold text-gray-900">TradieJet for other trades</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((t) => (
            <Link key={t.slug} href={`/for/${t.slug}`} className="rounded-full border px-3.5 py-1.5 text-sm text-gray-600 hover:border-brand-300 hover:text-brand-700">
              {t.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
