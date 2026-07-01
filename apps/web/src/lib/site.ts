// Canonical public site config — used for metadata, canonical links, sitemap, JSON-LD
// and absolute OG image URLs. Override the URL per-environment with NEXT_PUBLIC_SITE_URL;
// it defaults to the live domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tradiejet.com").replace(/\/+$/, "");
export const SITE_NAME = "TradieJet";
export const SITE_DESCRIPTION =
  "AI-powered lead, customer & job management for Australian & New Zealand trades businesses. Capture your own leads, quote, schedule and get paid — all in one place.";
export const OG_IMAGE = "/tradiejet-icon-1024.png";

// Server-side API base for React Server Component data fetching. RSCs run on the server,
// so they can't use the browser's relative "/api" proxy — they hit the API host directly.
export const SERVER_API_BASE = `${process.env.API_URL ?? "http://localhost:4000"}/api/v1`;
