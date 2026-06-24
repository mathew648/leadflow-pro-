"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SupportWidget } from "@/components/support-widget";
import { useAuthStore } from "@/lib/store";
import { getMe, refreshAccessToken } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated, setAuth, clearAuth, setHydrated } = useAuthStore();

  // Technicians (field staff) are confined to the Field App + Messages.
  useEffect(() => {
    if (user?.role === "technician") {
      const allowed = pathname.startsWith("/field") || pathname.startsWith("/messages");
      if (!allowed) router.replace("/field");
    }
  }, [user, pathname, router]);

  useEffect(() => {
    // Already authenticated (e.g. just logged in) — never re-check or we risk
    // bouncing a valid session back to /login.
    if (user) {
      if (!isHydrated) setHydrated(true);
      return;
    }

    let cancelled = false;

    async function hydrate() {
      // No user in memory (fresh page load) — try a silent refresh from the cookie.
      const token = await refreshAccessToken();
      if (cancelled) return;

      if (!token) {
        clearAuth();
        setHydrated(true);
        router.replace("/login");
        return;
      }

      try {
        const u = await getMe();
        if (!cancelled) {
          setAuth(u);
          setHydrated(true);
        }
      } catch {
        if (!cancelled) {
          clearAuth();
          setHydrated(true);
          router.replace("/login");
        }
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, [user]);

  // A logged-in user always renders; otherwise wait (hydrating) or redirect (no session).
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        {children}
      </main>
      <SupportWidget />
    </div>
  );
}
