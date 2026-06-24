"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubscribeForm } from "@/components/subscribe-form";

export default function BlogIndexPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-blog"],
    queryFn: () => api.get<any>("/public/blog?limit=50"),
  });
  const posts: any[] = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">The TradieJet Blog</h1>
        <p className="mt-3 text-gray-600 max-w-2xl">Tips, guides and updates to help Australian &amp; New Zealand trades win more work and get paid faster.</p>
      </header>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-56 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-gray-500">
          No posts yet — check back soon.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group rounded-xl border bg-white overflow-hidden hover:shadow-md transition-shadow">
              {p.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImageUrl} alt="" className="h-44 w-full object-cover" />
              ) : (
                <div className="h-44 w-full bg-gradient-to-br from-brand-500 to-brand-700" />
              )}
              <div className="p-5">
                {p.tags?.length > 0 && <p className="text-xs font-medium text-brand-600 mb-1.5">{p.tags[0]}</p>}
                <h2 className="font-semibold text-lg leading-snug group-hover:text-brand-700">{p.title}</h2>
                {p.excerpt && <p className="mt-2 text-sm text-gray-600 line-clamp-3">{p.excerpt}</p>}
                <p className="mt-3 text-xs text-gray-400">
                  {p.authorName ? `${p.authorName} · ` : ""}
                  {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-16 rounded-2xl bg-gray-900 text-white p-8 sm:p-10">
        <h2 className="text-xl font-bold">Get new posts in your inbox</h2>
        <p className="mt-2 text-white/70 text-sm max-w-md">No spam — just practical tips for running your trade business. Unsubscribe anytime.</p>
        <div className="mt-5"><SubscribeForm source="blog" dark /></div>
      </section>
    </div>
  );
}
