import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SubscribeForm } from "@/components/subscribe-form";
import { SERVER_API_BASE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog — Tips & guides for AU/NZ trades · TradieJet",
  description:
    "Practical tips, guides and updates to help Australian & New Zealand trades win more work, quote faster and get paid on time.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: "website",
    title: "The TradieJet Blog",
    description: "Practical tips and guides to help AU & NZ trades win more work and get paid faster.",
    url: `${SITE_URL}/blog`,
  },
};

// Re-fetch published posts at most every 5 minutes (ISR) so new posts appear without a redeploy.
export const revalidate = 300;

async function getPosts(): Promise<any[]> {
  try {
    const res = await fetch(`${SERVER_API_BASE}/public/blog?limit=50`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : (json?.data ?? []);
  } catch {
    return [];
  }
}

function formatDate(d?: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function readingTime(content?: string) {
  if (!content) return null;
  const words = content.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function CoverOrGradient({ src, tag, className }: { src?: string; tag?: string; className: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center`}>
      <span className="text-white/90 font-semibold tracking-wide text-sm uppercase">{tag ?? "TradieJet"}</span>
    </div>
  );
}

export default async function BlogIndexPage() {
  const posts = await getPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20 text-center">
          <span className="inline-flex items-center rounded-full bg-brand-600/10 text-brand-700 px-3 py-1 text-xs font-semibold">The TradieJet Blog</span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">Win more work. Do less admin.</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Practical tips and guides to help Australian &amp; New Zealand trades quote faster, capture more leads and get paid on time.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-16 text-center text-gray-500">
            No posts yet — check back soon.
          </div>
        ) : (
          <>
            {/* Featured post */}
            {featured && (
              <Link
                href={`/blog/${featured.slug}`}
                className="group grid md:grid-cols-2 gap-6 lg:gap-10 items-center rounded-2xl border bg-white overflow-hidden hover:shadow-lg transition-shadow"
              >
                <CoverOrGradient src={featured.coverImageUrl} tag={featured.tags?.[0]} className="w-full h-56 md:h-full min-h-[220px]" />
                <div className="p-6 md:pr-10">
                  <div className="flex items-center gap-2 text-xs font-medium text-brand-600">
                    {featured.tags?.[0] && <span className="rounded-full bg-brand-50 px-2.5 py-1">{featured.tags[0]}</span>}
                    <span className="text-gray-400">Featured</span>
                  </div>
                  <h2 className="mt-3 text-2xl sm:text-3xl font-bold leading-tight text-gray-900 group-hover:text-brand-700 transition-colors">
                    {featured.title}
                  </h2>
                  {featured.excerpt && <p className="mt-3 text-gray-600 leading-relaxed line-clamp-3">{featured.excerpt}</p>}
                  <div className="mt-5 flex items-center gap-2 text-sm text-gray-400">
                    {featured.authorName && <span>{featured.authorName}</span>}
                    {featured.authorName && <span>·</span>}
                    <span>{formatDate(featured.publishedAt)}</span>
                    {readingTime(featured.content) && <><span>·</span><span>{readingTime(featured.content)}</span></>}
                  </div>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                    Read article <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            )}

            {/* Rest of the posts */}
            {rest.length > 0 && (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col rounded-2xl border bg-white overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all">
                    <CoverOrGradient src={p.coverImageUrl} tag={p.tags?.[0]} className="h-44 w-full" />
                    <div className="flex flex-col flex-1 p-5">
                      {p.tags?.[0] && <span className="text-xs font-medium text-brand-600 mb-1.5">{p.tags[0]}</span>}
                      <h3 className="font-semibold text-lg leading-snug text-gray-900 group-hover:text-brand-700 transition-colors">{p.title}</h3>
                      {p.excerpt && <p className="mt-2 text-sm text-gray-600 line-clamp-3 flex-1">{p.excerpt}</p>}
                      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                        <span>{formatDate(p.publishedAt)}</span>
                        {readingTime(p.content) && <><span>·</span><span>{readingTime(p.content)}</span></>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Newsletter */}
        <section className="mt-16 rounded-2xl bg-gray-900 text-white p-8 sm:p-10 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-8">
          <div>
            <h2 className="text-xl font-bold">Get new posts in your inbox</h2>
            <p className="mt-2 text-white/70 text-sm max-w-md">No spam — just practical tips for running your trade business. Unsubscribe anytime.</p>
          </div>
          <div className="mt-5 sm:mt-0 sm:min-w-[320px]"><SubscribeForm source="blog" dark /></div>
        </section>
      </div>
    </div>
  );
}
