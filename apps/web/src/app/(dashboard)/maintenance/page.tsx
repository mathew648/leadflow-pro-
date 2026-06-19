"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat, Play, Pause, Trash2, Plus, X, CalendarClock } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly (3 months)" },
  { value: "biannually", label: "Every 6 months" },
  { value: "annually", label: "Annually" },
];
const freqLabel = (f: string) => FREQUENCIES.find((x) => x.value === f)?.label ?? f;
const money = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const custName = (c: any) => c?.companyName || `${c?.firstName ?? ""} ${c?.lastName ?? ""}`.trim() || "—";

const BLANK = { customerId: "", title: "", frequency: "quarterly", nextRunAt: "", priceCents: "", autoInvoice: false };

export default function MaintenancePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...BLANK });

  const { data, isLoading } = useQuery({ queryKey: ["service-agreements"], queryFn: () => api.get<any>("/service-agreements") });
  const { data: customers } = useQuery({ queryKey: ["customers-min"], queryFn: () => api.get<any>("/customers?limit=200") });
  const agreements = (data?.data ?? data) ?? [];
  const custList = (customers?.data ?? customers) ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["service-agreements"] });

  const create = useMutation({
    mutationFn: () => api.post<any>("/service-agreements", {
      customerId: form.customerId,
      title: form.title,
      frequency: form.frequency,
      nextRunAt: form.nextRunAt ? new Date(form.nextRunAt).toISOString() : undefined,
      priceCents: form.priceCents ? Math.round(parseFloat(form.priceCents) * 100) : 0,
      autoInvoice: form.autoInvoice,
    }),
    onSuccess: () => { toast({ title: "Maintenance plan created" }); setOpen(false); setForm({ ...BLANK }); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const runNow = useMutation({
    mutationFn: (id: string) => api.post<any>(`/service-agreements/${id}/run-now`, {}),
    onSuccess: () => { toast({ title: "Job created from plan" }); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch<any>(`/service-agreements/${id}`, { status }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete<any>(`/service-agreements/${id}`),
    onSuccess: () => { toast({ title: "Plan deleted" }); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <Topbar title="Maintenance Plans" action={{ label: "New plan", onClick: () => setOpen(true) }} />

      <div className="p-4 lg:p-6">
        <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
          Recurring service agreements that auto-create a job on schedule (and optionally raise a draft invoice) — perfect for
          annual servicing, quarterly checks, or property maintenance. Set it once and it runs itself.
        </p>

        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />)}</div>
        ) : agreements.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-10 text-center text-muted-foreground">
            <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-foreground">No maintenance plans yet</p>
            <p className="text-sm mt-1">Create one to auto-schedule recurring jobs for your customers.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> New plan</Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agreements.map((a: any) => (
              <div key={a.id} className="rounded-xl border bg-white p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{a.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{custName(a.customer)}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    a.status === "active" ? "bg-green-100 text-green-700" : a.status === "paused" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                  }`}>{a.status}</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" /> {freqLabel(a.frequency)}</p>
                  <p className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Next: {new Date(a.nextRunAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>
                  {a.priceCents > 0 && <p>{money(a.priceCents)}{a.autoInvoice ? " · auto-invoice" : ""}</p>}
                  <p className="text-xs">{a.jobsCreated} job{a.jobsCreated !== 1 ? "s" : ""} created</p>
                </div>
                <div className="mt-3 pt-3 border-t flex items-center gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => runNow.mutate(a.id)} disabled={runNow.isPending || a.status !== "active"}>
                    <Play className="w-3.5 h-3.5 mr-1" /> Run now
                  </Button>
                  {a.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: a.id, status: "paused" })}><Pause className="w-3.5 h-3.5 mr-1" /> Pause</Button>
                  ) : a.status === "paused" ? (
                    <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: a.id, status: "active" })}><Play className="w-3.5 h-3.5 mr-1" /> Resume</Button>
                  ) : null}
                  <button onClick={() => { if (confirm("Delete this maintenance plan?")) remove.mutate(a.id); }} className="ml-auto p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New plan modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">New maintenance plan</h2>
              <button onClick={() => setOpen(false)} aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">Select customer…</option>
                  {custList.map((c: any) => <option key={c.id} value={c.id}>{custName(c)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input placeholder="e.g. Quarterly aircon service" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                    {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>First job date</Label>
                  <Input type="date" value={form.nextRunAt} onChange={(e) => setForm({ ...form, nextRunAt: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Price (optional)</Label>
                <Input type="number" placeholder="180" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.autoInvoice} onChange={(e) => setForm({ ...form, autoInvoice: e.target.checked })} />
                Auto-raise a draft invoice each time
              </label>
              <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending || !form.customerId || !form.title}>
                {create.isPending ? "Creating…" : "Create plan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
