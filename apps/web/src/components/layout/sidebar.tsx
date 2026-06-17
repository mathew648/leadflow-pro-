"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap, LayoutDashboard, Users2, UserCheck, Briefcase, FileText,
  Receipt, Calendar, Settings, MessageSquare, BarChart3, LogOut,
  ChevronLeft, Sparkles, Package, Workflow, HardHat, ShieldCheck,
} from "lucide-react";
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
  { href: "/messages", icon: MessageSquare, label: "Messages" },
  { href: "/catalog", icon: Package, label: "Price Book" },
  { href: "/automations", icon: Workflow, label: "Automations" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/ai", icon: Sparkles, label: "AI Assistant" },
];

// Non-tradie ("Lead Manager") accounts get a simplified menu — no jobs/quotes/
// scheduling/price-book/field/AI; just leads, contacts, messaging, invoicing.
const NON_TRADIE_HIDDEN = new Set(["/jobs", "/field", "/quotes", "/schedule", "/catalog", "/ai"]);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  async function handleLogout() {
    await logout();
    clearAuth();
    router.push("/login");
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 z-30 h-full bg-gray-900 text-white transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-60" : "w-16",
        "lg:relative lg:z-auto"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          {sidebarOpen ? (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm leading-tight">LeadFlow<br/>Pro</span>
            </Link>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center mx-auto">
              <Zap className="w-4 h-4 text-white" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex w-6 h-6 items-center justify-center rounded hover:bg-white/10 flex-shrink-0 transition-colors"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {(user?.tenant?.accountType === "non_tradie"
            ? NAV_ITEMS.filter((i) => !NON_TRADIE_HIDDEN.has(i.href))
            : NAV_ITEMS
          ).map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                )}
                title={!sidebarOpen ? label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 space-y-1">
          {user?.isPlatformAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-amber-300 hover:bg-white/10",
                pathname.startsWith("/admin") && "bg-white/10"
              )}
              title={!sidebarOpen ? "Platform Admin" : undefined}
            >
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>Platform Admin</span>}
            </Link>
          )}
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:bg-white/10 hover:text-white",
              pathname.startsWith("/settings") && "bg-white/10 text-white"
            )}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Settings</span>}
          </Link>

          {/* User profile */}
          <div className={cn("flex items-center gap-3 px-3 py-2", !sidebarOpen && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user ? initials(user.firstName, user.lastName) : "?"}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.tenant?.name}</p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
