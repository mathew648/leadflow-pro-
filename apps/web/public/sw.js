// LeadFlow Pro service worker — deliberately conservative to avoid stale-content bugs.
// - Only cache-first for content-hashed static assets (/_next/static, /icons) — safe forever.
// - Navigations are network-first with an offline fallback (always fresh HTML).
// - API and non-GET requests are never touched.
const STATIC_CACHE = "lfp-static-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;                 // never touch POST/PUT/etc (incl. API writes)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // same-origin only
  if (url.pathname.startsWith("/api/")) return;         // never cache the API

  // Cache-first for immutable, content-hashed assets.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((hit) =>
          hit || fetch(request).then((res) => { cache.put(request, res.clone()); return res; })
        )
      )
    );
    return;
  }

  // Navigations: always try the network; fall back to the offline page when truly offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
