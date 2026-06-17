"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Register the PWA service worker, and auto-update it so a stale version can
  // never serve old content / hang the app after a deploy.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      // Don't reload on the very first install (no prior controller) — only on a real update.
      if (!hadController) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.update().catch(() => {});
      // Re-check for a new version whenever the user returns to the tab.
      const onFocus = () => reg.update().catch(() => {});
      window.addEventListener("focus", onFocus);
    }).catch(() => {});
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000, retry: 1 },
          mutations: { retry: 0 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
