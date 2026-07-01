import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Serves /robots.txt — allow crawling of the public marketing site, keep the API and the
// Sentry tunnel out, and point crawlers at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/monitoring"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
