import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import { getCompetitor, COMPETITORS, COMPETITOR_SLUGS } from "@/lib/landing-data";
import { SITE_URL } from "@/lib/site";

// Pre-render every competitor page at build time.
export function generateStaticParams() {
  return COMPETITOR_SLUGS.map((competitor) => ({ competitor }));
}

export async function generateMetadata({ params }: { params: Promise<{ competitor: string }> }): Promise<Metadata> {
  const { competitor: slug } = await params;
  const c = getCompetitor(slug);
  if (!c) return { title: "Not found · TradieJet", robots: { index: false } };
  const url = `${SITE_URL}/compare/${slug}`;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: url },
    openGraph: { type: "website", title: c.metaTitle, description: c.metaDescription, url },
    twitter: { card: "summary_large_image", title: c.metaTitle, description: c.metaDescription },
  };
}

function Cell({ value }: { value: boolean | "limited" }) {
  if (value === true) return <Check className="w-4 h-4 text-green-600 mx-auto" />;
  if (value === "limited") return <span className="text-xs text-gray-400">limited</span>;
  return <X className="w-4 h-4 text-gray-300 mx-auto" />;
}

export default async function CompetitorComparePage({ params }: { params: Promise<{ competitor: string }> }) {
  const { competitor: slug } = await params;
  const c = getCompetitor(slug);
  if (!c) notFound();

  const url = `${SITE_URL}/compare/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE_URL}/compare` },
          { "@type": "ListItem", position: 3, name: `${c.name} alternative`, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const others = COMPETITORS.filter((x) => x.slug !== slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <p className="text-sm font-semibold text-brand-200 uppercase tracking-wide">TradieJet vs {c.name}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">{c.headline}</h1>
          <p className="mt-5 text-lg text-brand-100 max-w-2xl mx-auto">{c.subhead}</p>
          <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
            Start free — no credit card <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Fair framing of the competitor */}
      <section className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-gray-600 leading-relaxed">{c.theirStrength}</p>
        <p className="mt-3 text-gray-900 font-medium">
          Here&apos;s where TradieJet does things differently.
        </p>
      </section>

      {/* Why switch */}
      <section className="bg-gray-50 border-y">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-3xl font-bold text-center">Why trades choose TradieJet</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {c.whySwitch.map((w) => (
              <div key={w.title} className="rounded-2xl border bg-white p-6">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{w.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-3xl font-bold text-center">TradieJet vs {c.name} at a glance</h2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-sm border rounded-xl">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium text-center">{c.name}</th>
                <th className="px-4 py-3 font-medium text-center text-brand-700">TradieJet</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {c.comparison.map((row) => (
                <tr key={row.feature}>
                  <td className="px-4 py-3 font-medium">{row.feature}</td>
                  <td className="px-4 py-3 text-center"><Cell value={row.them} /></td>
                  <td className="px-4 py-3 text-center"><Cell value={row.us} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-3xl font-bold text-center">Switching from {c.name}</h2>
        <div className="mt-8 divide-y border-y">
          {c.faqs.map((f) => (
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
          <h2 className="text-3xl font-bold">See the difference for yourself</h2>
          <p className="mt-3 text-brand-100">Start free today. No credit card, no lock-in.</p>
          <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
            Start your free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Internal links to other comparisons */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm font-semibold text-gray-900">Compare TradieJet to other tools</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((x) => (
            <Link key={x.slug} href={`/compare/${x.slug}`} className="rounded-full border px-3.5 py-1.5 text-sm text-gray-600 hover:border-brand-300 hover:text-brand-700">
              TradieJet vs {x.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Legal disclaimer — matches the /compare hub page */}
      <p className="mx-auto max-w-5xl px-4 py-8 text-xs text-gray-400 text-center">
        Comparisons are based on {c.name}&apos;s publicly available pricing and features as of {new Date().getFullYear()} and are for
        general guidance only. {c.name} and other product names are trademarks of their respective owners; TradieJet is not
        affiliated with or endorsed by them.
      </p>
    </>
  );
}
