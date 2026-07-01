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

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8"><ArrowLeft className="w-4 h-4" /> All posts</Link>
      {post.tags?.length > 0 && <p className="text-sm font-medium text-brand-600 mb-2">{post.tags[0]}</p>}
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{post.title}</h1>
      <p className="mt-3 text-sm text-gray-400">
        {post.authorName ? `${post.authorName} · ` : ""}
        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : ""}
      </p>
      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt="" className="mt-8 rounded-2xl w-full aspect-[16/9] object-cover shadow-sm" />
      )}
      <div className="mt-8 text-[17px]">
        <Markdown content={post.content ?? ""} />
      </div>

      <section className="mt-14 rounded-2xl bg-gray-900 text-white p-8">
        <h2 className="text-lg font-bold">Enjoyed this? Get the next one.</h2>
        <div className="mt-4"><SubscribeForm source="blog-post" dark /></div>
      </section>
    </article>
  );
}
