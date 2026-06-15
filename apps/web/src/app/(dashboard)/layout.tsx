"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuthStore } from "@/lib/store";
import { getMe, refreshAccessToken } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated, setAuth, clearAuth, setHydrated } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Try to silently refresh from the httpOnly refresh-token cookie
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

    if (!isHydrated) {
      hydrate();
    }

    return () => { cancelled = true; };
  }, [isHydrated]);

  // Show nothing until we know whether the session is valid
  if (!isHydrated || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
