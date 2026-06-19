"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users2, UserCheck, Briefcase, FileText,
  Receipt, Calendar, Settings, MessageSquare, BarChart3, LogOut,
  X, Sparkles, Package, Workflow, HardHat, ShieldCheck, Repeat, Gift,
} from "lucide-react";
import { JetMark } from "@/components/logo";
import { cn, initials } from "@/lib/utils";
import { useAuthStore, useUIStore } from "@/lib/store";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/leads", icon: Users2, label: "Leads" },
  { href: "/customers", icon: UserCheck, label: "Customers" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/field", icon: HardHat, label: "Field App" },
  { href: "/quotes", icon: FileText, label: "Quotes" },
  { href: "/invoices", icon: Receipt, label: "Invoices" },
  { href: "/schedule", icon: Calendar, label: "Schedule" },
  { href: "/maintenance", icon: Repeat, label: "Maintenance" },
  { href: "/messages", icon: MessageSquare, label: "Messages" },
  { href: "/catalog", icon: Package, label: "Price Book" },
  { href: "/automations", icon: Workflow, label: "Automations" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/ai", icon: Sparkles, label: "AI Assistant" },
  { href: "/refer", icon: Gift, label: "Refer & Earn" },
];

// Non-tradie ("Lead Manager") accounts get a simplified menu.
const NON_TRADIE_HIDDEN = new Set(["/jobs", "/field", "/quotes", "/schedule", "/catalog", "/ai", "/maintenance"]);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  const closeOnMobile = () => { if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false); };

  async function handleLogout() {
    await logout();
    clearAuth();
    router.push("/login");
  }

  const navItems = user?.tenant?.accountType === "non_tradie"
    ? NAV_ITEMS.filter((i) => !NON_TRADIE_HIDDEN.has(i.href))
    : NAV_ITEMS;

  const navLink = (href: string, Icon: any, label: string, extra?: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        onClick={closeOnMobile}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          active ? "bg-brand-600 text-white" : cn("text-gray-400 hover:bg-white/10 hover:text-white", extra),
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white flex flex-col transition-transform duration-300",
          "lg:static lg:z-auto lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={closeOnMobile}>
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
              <JetMark className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base">TradieJet</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {navItems.map((i) => navLink(i.href, i.icon, i.label))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 space-y-1">
          {user?.isPlatformAdmin && navLink("/admin", ShieldCheck, "Platform Admin", "text-amber-300")}
          {navLink("/settings", Settings, "Settings")}

          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user ? initials(user.firstName, user.lastName) : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.tenant?.name}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Sign out" aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
