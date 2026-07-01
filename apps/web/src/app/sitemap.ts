import type { MetadataRoute } from "next";
import { SITE_URL, SERVER_API_BASE } from "@/lib/site";

// Public marketing routes worth indexing (login/dashboard/app pages are gated, so excluded).
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/features", priority: 0.8, changeFrequency: "monthly" },
  { path: "/compare", priority: 0.8, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/waitlist", priority: 0.5, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

// Rebuild the sitemap hourly so newly published blog posts appear without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  let postEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${SERVER_API_BASE}/public/blog?limit=200`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const json = await res.json();
      const posts: any[] = Array.isArray(json) ? json : (json?.data ?? []);
      postEntries = posts
        .filter((p) => p?.slug)
        .map((p) => ({
          url: `${SITE_URL}/blog/${p.slug}`,
          lastModified: p.updatedAt ? new Date(p.updatedAt) : p.publishedAt ? new Date(p.publishedAt) : now,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        }));
    }
  } catch {
    // API unreachable during ISR regeneration — fall back to just the static routes.
  }

  return [...staticEntries, ...postEntries];
}
