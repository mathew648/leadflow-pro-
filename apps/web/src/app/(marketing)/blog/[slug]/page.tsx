import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { SubscribeForm } from "@/components/subscribe-form";
import { SERVER_API_BASE, SITE_URL, SITE_NAME, OG_IMAGE } from "@/lib/site";

// Re-fetch a post at most every 5 minutes (ISR) so edits go live without a redeploy.
export const revalidate = 300;

async function getPost(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`${SERVER_API_BASE}/public/blog/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found · TradieJet", robots: { index: false } };

  const description = post.excerpt ?? `${post.title} — from the ${SITE_NAME} blog.`;
  const url = `${SITE_URL}/blog/${slug}`;
  const images = post.coverImageUrl ? [post.coverImageUrl] : [OG_IMAGE];

  return {
    title: `${post.title} · ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
      images,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt ?? post.publishedAt ?? undefined,
      authors: post.authorName ? [post.authorName] : undefined,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
    author: post.authorName
      ? { "@type": "Person", name: post.authorName }
      : { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}${OG_IMAGE}` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}` },
    keywords: post.tags?.length ? post.tags.join(", ") : undefined,
  };

  const words = (post.content ?? "").trim().split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(words / 200));
  const dateStr = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "";
  const initial = (post.authorName ?? "T").trim().charAt(0).toUpperCase();

  return (
    <article className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header band */}
      <header className="border-b bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto max-w-3xl px-4 pt-10 pb-10 sm:pt-14">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"><ArrowLeft className="w-4 h-4" /> All posts</Link>
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.slice(0, 3).map((t: string) => (
                <span key={t} className="rounded-full bg-brand-600/10 text-brand-700 px-2.5 py-1 text-xs font-medium">{t}</span>
              ))}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-tight text-gray-900">{post.title}</h1>
          {post.excerpt && <p className="mt-4 text-lg text-gray-600 leading-relaxed">{post.excerpt}</p>}
          <div className="mt-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold">{initial}</div>
            <div className="text-sm">
              {post.authorName && <p className="font-medium text-gray-900 leading-tight">{post.authorName}</p>}
              <p className="text-gray-400">{dateStr}{dateStr ? " · " : ""}{readMins} min read</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-12">
        {post.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="mb-10 rounded-2xl w-full aspect-[16/9] object-cover shadow-sm" />
        )}
        <div className="text-[17px]">
          <Markdown content={post.content ?? ""} />
        </div>

        {post.tags?.length > 0 && (
          <div className="mt-10 pt-6 border-t flex flex-wrap gap-2">
            {post.tags.map((t: string) => (
              <span key={t} className="rounded-full border px-3 py-1 text-xs text-gray-600">{t}</span>
            ))}
          </div>
        )}

        <section className="mt-12 rounded-2xl bg-gray-900 text-white p-8">
          <h2 className="text-lg font-bold">Enjoyed this? Get the next one.</h2>
          <p className="mt-1.5 text-white/70 text-sm">Practical tips for running your trade business — straight to your inbox.</p>
          <div className="mt-4"><SubscribeForm source="blog-post" dark /></div>
        </section>
      </div>
    </article>
  );
}
