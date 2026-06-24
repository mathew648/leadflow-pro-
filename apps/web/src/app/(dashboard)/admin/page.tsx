"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, getToken } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldCheck, Send, Download, X, Mail, MessageCircle, Ban, CheckCircle2 } from "lucide-react";
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
  suspended: "bg-red-100 text-red-700",
};

function money(cents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
}

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [promo, setPromo] = useState({ subject: "", message: "", audience: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  async function downloadCsv() {
    try {
      const token = getToken();
      const res = await fetch("/api/v1/admin/export/tenants.csv", { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `tradiejet-tenants-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ title: "Couldn't export", description: e.message, variant: "destructive" }); }
  }

  if (!user?.isPlatformAdmin) {
    return (
      <div>
        <Topbar title="Platform Admin" />
        <div className="p-8 text-center text-muted-foreground">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>This area is for TradieJet platform administrators only.</p>
        </div>
      </div>
    );
  }

  const list: any[] = Array.isArray(tenants) ? tenants : (tenants as any)?.data ?? [];
  const s = stats ?? {};

  const statCards = [
    { label: "Tradies", value: s.tenants ?? 0 },
    { label: "Paying", value: s.active ?? 0 },
    { label: "On trial", value: s.trialing ?? 0 },
    { label: "MRR", value: money(s.mrrCents ?? 0) },
    { label: "ARR", value: money(s.arrCents ?? 0) },
    { label: "New (7d)", value: s.newThisWeek ?? 0 },
    { label: "Leads (30d)", value: s.leadsThisMonth ?? 0 },
    { label: "Past due", value: s.pastDue ?? 0 },
  ];

  return (
    <div>
      <Topbar title="Platform Admin" />
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex justify-end gap-4 -mb-2">
          <a href="/admin/support" className="text-sm font-medium text-primary hover:underline">Support team</a>
          <a href="/admin/marketing" className="text-sm font-medium text-primary hover:underline">Marketing → waitlist · subscribers · blog</a>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((m) => (
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
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="w-4 h-4" /> Broadcast email</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-[1fr_auto] gap-3">
              <Input placeholder="Subject" value={promo.subject} onChange={(e) => setPromo((p) => ({ ...p, subject: e.target.value }))} />
              <select aria-label="Promo email audience" value={promo.audience} onChange={(e) => setPromo((p) => ({ ...p, audience: e.target.value }))} className="px-3 py-2 text-sm border rounded-md">
                <option value="all">All tradies</option>
                <option value="trialing">On trial</option>
                <option value="active">Paying customers</option>
              </select>
            </div>
            <textarea placeholder="Message (HTML allowed)…" value={promo.message} onChange={(e) => setPromo((p) => ({ ...p, message: e.target.value }))} rows={4} className="w-full px-3 py-2 text-sm border rounded-md resize-none" />
            <Button onClick={() => sendPromo.mutate()} disabled={sendPromo.isPending || !promo.subject || !promo.message}>
              {sendPromo.isPending ? "Sending…" : "Send broadcast"}
            </Button>
          </CardContent>
        </Card>

        {/* Tenants */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">All tradies</CardTitle>
            <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="w-4 h-4 mr-1.5" /> Download data</Button>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4 flex-wrap">
              <Input placeholder="Search business or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8" />
              <select aria-label="Filter by subscription status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 h-8 text-sm border rounded-md">
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
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {list.map((t) => {
                      const status = t.subscription?.status ?? t.subscriptionStatus ?? "trialing";
                      return (
                        <tr key={t.id} className="hover:bg-brand-50/60 cursor-pointer" onClick={() => setSelectedId(t.id)}>
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
                        </tr>
                      );
                    })}
                    {list.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No tradies found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">Click a tradie to view their leads, message them, or manage their account.</p>
          </CardContent>
        </Card>
      </div>

      {selectedId && <TenantDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function TenantDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [msg, setMsg] = useState({ channel: "email" as "email" | "whatsapp", subject: "", message: "" });

  const { data: detailRes } = useQuery({ queryKey: ["admin-tenant", id], queryFn: () => api.get<any>(`/admin/tenants/${id}`) });
  const { data: leadsRes } = useQuery({ queryKey: ["admin-tenant-leads", id, period], queryFn: () => api.get<any>(`/admin/tenants/${id}/leads?period=${period}`) });
  const t = detailRes?.data ?? detailRes ?? {};
  const m = t.metrics ?? {};
  const leads: any[] = (leadsRes?.data ?? leadsRes)?.leads ?? [];

  const sendMessage = useMutation({
    mutationFn: () => api.post<any>("/admin/message", { tenantId: id, channel: msg.channel, subject: msg.subject || undefined, message: msg.message }),
    onSuccess: (r: any) => { const d = r?.data ?? r; toast({ title: `Sent via ${d?.channel}` }); setMsg((x) => ({ ...x, subject: "", message: "" })); },
    onError: (e: any) => toast({ title: "Couldn't send", description: e.message, variant: "destructive" }),
  });
  const suspend = useMutation({
    mutationFn: (s: boolean) => api.post<any>(`/admin/tenants/${id}/suspend`, { suspend: s }),
    onSuccess: () => { toast({ title: "Account updated" }); qc.invalidateQueries({ queryKey: ["admin-tenant", id] }); qc.invalidateQueries({ queryKey: ["admin-tenants"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isSuspended = t.status === "suspended";
  const Metric = ({ label, value }: { label: string; value: any }) => (
    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold mt-0.5">{value}</p></div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{t.businessName ?? "Loading…"}</h2>
            <p className="text-xs text-muted-foreground">{t.email} · {t.suburb ? `${t.suburb}, ` : ""}{t.country}</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Plan + actions */}
          <div className="flex items-center justify-between">
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[t.subscription?.status ?? t.subscriptionStatus] ?? "bg-gray-100")}>
              {t.subscription?.tier ?? "—"} · {t.subscriptionStatus}
            </span>
            <Button variant={isSuspended ? "default" : "outline"} size="sm" onClick={() => suspend.mutate(!isSuspended)} disabled={suspend.isPending}>
              {isSuspended ? <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Reactivate</> : <><Ban className="w-4 h-4 mr-1.5" /> Suspend</>}
            </Button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Leads (7d)" value={m.leadsWeek ?? 0} />
            <Metric label="Leads (30d)" value={m.leadsMonth ?? 0} />
            <Metric label="Leads (total)" value={m.leadsTotal ?? 0} />
            <Metric label="Won" value={m.wonAll ?? 0} />
            <Metric label="Revenue" value={money(m.revenuePaidCents ?? 0, t.currency)} />
            <Metric label="Users" value={t.users?.length ?? 0} />
          </div>

          {/* Lead sources */}
          {Array.isArray(m.leadSources) && m.leadSources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Lead sources</p>
              <div className="flex flex-wrap gap-1.5">
                {m.leadSources.map((ls: any) => (
                  <span key={ls.source} className="text-xs bg-muted rounded-full px-2.5 py-1 capitalize">{ls.source}: <strong>{ls.count}</strong></span>
                ))}
              </div>
            </div>
          )}

          {/* Message the tradie */}
          <div className="rounded-xl border p-4 space-y-2.5">
            <p className="text-sm font-medium">Message this tradie</p>
            <div className="flex gap-2">
              <button onClick={() => setMsg((x) => ({ ...x, channel: "email" }))} className={cn("flex-1 py-1.5 rounded-md border text-sm flex items-center justify-center gap-1.5", msg.channel === "email" ? "border-primary bg-primary/10 text-primary" : "")}><Mail className="w-4 h-4" /> Email</button>
              <button onClick={() => setMsg((x) => ({ ...x, channel: "whatsapp" }))} className={cn("flex-1 py-1.5 rounded-md border text-sm flex items-center justify-center gap-1.5", msg.channel === "whatsapp" ? "border-primary bg-primary/10 text-primary" : "")}><MessageCircle className="w-4 h-4" /> WhatsApp</button>
            </div>
            {msg.channel === "email" && <Input placeholder="Subject" value={msg.subject} onChange={(e) => setMsg((x) => ({ ...x, subject: e.target.value }))} />}
            <textarea placeholder={`Write a ${msg.channel} message…`} value={msg.message} onChange={(e) => setMsg((x) => ({ ...x, message: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm border rounded-md resize-none" />
            <Button size="sm" onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending || !msg.message}>
              {sendMessage.isPending ? "Sending…" : `Send ${msg.channel}`}
            </Button>
          </div>

          {/* Leads list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Leads</p>
              <div className="flex gap-1 text-xs">
                {(["week", "month", "all"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className={cn("px-2 py-1 rounded-md border capitalize", period === p ? "border-primary bg-primary/10 text-primary" : "")}>{p === "week" ? "7d" : p === "month" ? "30d" : "All"}</button>
                ))}
              </div>
            </div>
            <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No leads in this period.</p>
              ) : leads.map((l) => (
                <div key={l.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.firstName} {l.lastName ?? ""}</p>
                    <p className="text-xs text-muted-foreground truncate">{l.serviceRequired || l.email || l.phone || "—"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs bg-muted rounded-full px-2 py-0.5 capitalize">{l.source}</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(l.createdAt).toLocaleDateString("en-AU")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
