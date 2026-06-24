"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { SubscribeForm } from "@/components/subscribe-form";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-blog", slug],
    queryFn: () => api.get<any>(`/public/blog/${slug}`),
  });
  const post = (data as any)?.data ?? data;

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><div className="h-8 w-2/3 bg-gray-100 rounded animate-pulse mb-4" /><div className="h-64 bg-gray-100 rounded animate-pulse" /></div>;
  }
  if (error || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-gray-600">This post couldn&apos;t be found.</p>
        <Link href="/blog" className="mt-4 inline-flex items-center gap-1.5 text-brand-600 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to blog</Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8"><ArrowLeft className="w-4 h-4" /> All posts</Link>
      {post.tags?.length > 0 && <p className="text-sm font-medium text-brand-600 mb-2">{post.tags[0]}</p>}
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{post.title}</h1>
      <p className="mt-3 text-sm text-gray-400">
        {post.authorName ? `${post.authorName} · ` : ""}
        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : ""}
      </p>
      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt="" className="mt-8 rounded-xl w-full object-cover max-h-96" />
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
