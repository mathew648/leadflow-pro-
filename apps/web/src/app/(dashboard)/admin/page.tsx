"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldCheck, Users2, DollarSign, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function timeAgo(iso?: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-600",
  paused: "bg-gray-100 text-gray-600",
};

function money(cents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format((cents ?? 0) / 100);
}

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [promo, setPromo] = useState({ subject: "", message: "", audience: "all" });

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.get<any>("/admin/stats"), enabled: !!user?.isPlatformAdmin });
  const { data: tenants, isLoading, error } = useQuery({
    queryKey: ["admin-tenants", search, statusFilter],
    queryFn: () => api.get<any[]>(`/admin/tenants?search=${encodeURIComponent(search)}${statusFilter ? `&status=${statusFilter}` : ""}`),
    enabled: !!user?.isPlatformAdmin,
  });

  const sendPromo = useMutation({
    mutationFn: () => api.post<any>("/admin/promo-email", promo),
    onSuccess: (r: any) => { toast({ title: `Promo queued to ${r?.queued ?? 0} tradies` }); setPromo({ subject: "", message: "", audience: "all" }); },
    onError: (e: any) => toast({ title: "Couldn't send", description: e.message, variant: "destructive" }),
  });

  if (!user?.isPlatformAdmin) {
    return (
      <div>
        <Topbar title="Platform Admin" />
        <div className="p-8 text-center text-muted-foreground">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>This area is for LeadFlow Pro platform administrators only.</p>
        </div>
      </div>
    );
  }

  const list: any[] = Array.isArray(tenants) ? tenants : (tenants as any)?.data ?? [];
  const s = stats ?? {};

  return (
    <div>
      <Topbar title="Platform Admin" />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Tradies", value: s.tenants ?? 0, icon: Users2 },
            { label: "Paying", value: s.active ?? 0, icon: DollarSign },
            { label: "On trial", value: s.trialing ?? 0, icon: Users2 },
            { label: "Past due", value: s.pastDue ?? 0, icon: Users2 },
            { label: "MRR", value: money(s.mrrCents ?? 0), icon: DollarSign },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold mt-1">{m.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Signups over time */}
        <Card>
          <CardHeader><CardTitle className="text-base">New tradies (last 6 months)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={s.signups ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v} signups`, ""]} />
                <Bar dataKey="signups" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Promo email */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="w-4 h-4" /> Send promotional email</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-[1fr_auto] gap-3">
              <Input placeholder="Subject" value={promo.subject} onChange={(e) => setPromo((p) => ({ ...p, subject: e.target.value }))} />
              <select
                aria-label="Promo email audience"
                title="Audience"
                value={promo.audience}
                onChange={(e) => setPromo((p) => ({ ...p, audience: e.target.value }))}
                className="px-3 py-2 text-sm border rounded-md"
              >
                <option value="all">All tradies</option>
                <option value="trialing">On trial</option>
                <option value="active">Paying customers</option>
              </select>
            </div>
            <textarea
              placeholder="Message (HTML allowed)…"
              value={promo.message}
              onChange={(e) => setPromo((p) => ({ ...p, message: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 text-sm border rounded-md resize-none"
            />
            <Button
              onClick={() => sendPromo.mutate()}
              disabled={sendPromo.isPending || !promo.subject || !promo.message}
            >
              {sendPromo.isPending ? "Sending…" : "Send promo email"}
            </Button>
          </CardContent>
        </Card>

        {/* Tenants */}
        <Card>
          <CardHeader><CardTitle className="text-base">All tradies</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4 flex-wrap">
              <Input placeholder="Search business or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8" />
              <select aria-label="Filter by subscription status" title="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 h-8 text-sm border rounded-md">
                <option value="">All statuses</option>
                <option value="trialing">Trialing</option>
                <option value="active">Active (paying)</option>
                <option value="past_due">Past due</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {error ? (
              <p className="text-sm text-destructive">Failed to load tenants.</p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Business</th>
                      <th className="px-3 py-2 font-medium">Plan</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Users</th>
                      <th className="px-3 py-2 font-medium text-right">Leads</th>
                      <th className="px-3 py-2 font-medium text-right">Last active</th>
                      <th className="px-3 py-2 font-medium text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {list.map((t) => {
                      const status = t.subscription?.status ?? t.subscriptionStatus ?? "trialing";
                      return (
                        <tr key={t.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <p className="font-medium">{t.businessName}</p>
                            <p className="text-xs text-muted-foreground">{t.email} · {t.country}</p>
                          </td>
                          <td className="px-3 py-2 capitalize">{t.subscription?.tier ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[status] ?? "bg-gray-100")}>
                              {status === "active" ? "paying" : status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{t._count?.users ?? 0}</td>
                          <td className="px-3 py-2 text-right">{t._count?.leads ?? 0}</td>
                          <td className={cn("px-3 py-2 text-right", t.lastActiveAt ? "text-muted-foreground" : "text-amber-600")}>{timeAgo(t.lastActiveAt)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("en-AU")}</td>
                        </tr>
                      );
                    })}
                    {list.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No tradies found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
