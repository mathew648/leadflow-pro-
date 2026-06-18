"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, List, Columns, Phone, Mail, Star, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn, formatRelative, statusColor } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

type View = "kanban" | "list";

const SOURCE_LABEL: Record<string, string> = {
  meta_ads: "Meta", google_ads: "Google", website: "Website",
  referral: "Referral", phone: "Phone", sms: "SMS", manual: "Manual",
  email: "Email", tiktok: "TikTok", linkedin: "LinkedIn",
  whatsapp: "WhatsApp", messenger: "Messenger",
};

const URGENCY_COLOR: Record<string, string> = {
  emergency: "bg-red-500",
  high: "bg-orange-400",
  normal: "bg-blue-400",
  low: "bg-gray-300",
};

function ScoreBadge({ score }: { score?: number | null }) {
  if (!score) return null;
  const color = score >= 70 ? "bg-green-100 text-green-800" : score >= 40 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
  return <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full", color)}>{score}</span>;
}

function LeadCard({ lead, onClick }: { lead: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", URGENCY_COLOR[lead.urgency] ?? "bg-gray-300")} />
          <p className="font-medium text-sm truncate">
            {lead.firstName} {lead.lastName}
          </p>
        </div>
        <ScoreBadge score={lead.aiScore} />
      </div>
      <p className="text-xs text-muted-foreground mb-2">{SOURCE_LABEL[lead.source] ?? lead.source}</p>
      {lead.phone && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="w-3 h-3" />
          {lead.phone}
        </div>
      )}
      {lead.estimatedValueCents && (
        <div className="mt-2 text-xs font-medium text-green-700">
          ${(lead.estimatedValueCents / 100).toLocaleString()} est.
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{formatRelative(lead.createdAt)}</span>
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "phone", label: "Phone call" },
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "walk_in", label: "Walk-in" },
];

const URGENCY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
  { value: "flexible", label: "Flexible" },
];

const BLANK_LEAD = {
  firstName: "", lastName: "", email: "", phone: "",
  source: "manual", urgency: "normal", estimatedValue: "",
  notes: "", stageId: "",
};

export default function LeadsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("kanban");
  // The kanban board scrolls sideways — default to the list view on phones.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) setView("list");
  }, []);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK_LEAD });

  const { data: stagesData } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => api.get<any[]>("/tenant/pipeline-stages"),
  });

  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ["leads", "pipeline"],
    queryFn: () => api.get<any>("/leads/pipeline"),
    refetchInterval: 30000,
  });

  const { data: listData } = useQuery({
    queryKey: ["leads", "list", search],
    queryFn: () => api.get<any>(`/leads?search=${encodeURIComponent(search)}&limit=50`),
    enabled: view === "list",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<any>("/leads", {
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        source: form.source,
        urgency: form.urgency,
        estimatedValueCents: form.estimatedValue ? Math.round(Number(form.estimatedValue) * 100) : undefined,
        notes: form.notes || undefined,
        stageId: form.stageId || undefined,
      }),
    onSuccess: (res: any) => {
      toast({ title: "Lead created!" });
      setAddOpen(false);
      setForm({ ...BLANK_LEAD });
      qc.invalidateQueries({ queryKey: ["leads"] });
      router.push(`/leads/${res.id ?? res.data?.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stages = stagesData ?? [];
  const pipeline = pipelineData ?? {};

  // Group leads by stageId
  const { data: leadsRaw } = useQuery({
    queryKey: ["leads", "all"],
    queryFn: () => api.get<any>("/leads?limit=200"),
  });
  const allLeads: any[] = leadsRaw?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Leads Pipeline"
        action={{ label: "Add Lead", onClick: () => setAddOpen(true) }}
      />

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b bg-white">
        <Input
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex border rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setView("kanban")}
            className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
              view === "kanban" ? "bg-primary text-white" : "hover:bg-muted")}
          >
            <Columns className="w-4 h-4" /> Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
              view === "list" ? "bg-primary text-white" : "hover:bg-muted")}
          >
            <List className="w-4 h-4" /> List
          </button>
        </div>
      </div>

      {/* Kanban */}
      {view === "kanban" && (
        <div className="kanban-board p-4 lg:p-6 flex-1 overflow-x-auto">
          {stages.map((stage: any) => {
            const stageLeads = allLeads.filter((l: any) => l.stageId === stage.id);
            const stats = pipeline[stage.id];
            return (
              <div key={stage.id} className="kanban-column">
                {/* Column header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                    <span className="font-medium text-sm">{stage.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {stageLeads.length}
                    </span>
                  </div>
                  {stats?.totalValueCents > 0 && (
                    <span className="text-xs text-green-700 font-medium">
                      ${(stats.totalValueCents / 100).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-260px)]">
                  {stageLeads.map((lead: any) => (
                    <LeadCard key={lead.id} lead={lead} onClick={() => router.push(`/leads/${lead.id}`)} />
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {view === "list" && (
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(listData?.data ?? allLeads).map((lead: any) => (
                  <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="hover:bg-muted/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                        {lead.email && <p className="text-xs text-muted-foreground">{lead.email}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs bg-muted px-2 py-1 rounded-full">
                        {SOURCE_LABEL[lead.source] ?? lead.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{lead.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColor(lead.status))}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <ScoreBadge score={lead.aiScore} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                      {formatRelative(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(listData?.data ?? allLeads).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No leads found. Add your first lead!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl z-10">
              <h3 className="font-semibold text-lg">New Lead</h3>
              <button
                onClick={() => { setAddOpen(false); setForm({ ...BLANK_LEAD }); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">First Name *</label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Jane"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                  <input
                    type="text"
                    placeholder="Smith"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Phone</label>
                  <input
                    type="tel"
                    placeholder="+61 4xx xxx xxx"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    type="email"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Source *</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Urgency</label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {URGENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Estimated Value ($)</label>
                  <div className="relative mt-0.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="0"
                      value={form.estimatedValue}
                      onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))}
                      className="w-full pl-7 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Pipeline Stage</label>
                  <select
                    value={form.stageId}
                    onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Default stage</option>
                    {stages.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea
                  placeholder="What does the customer need? Any context…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <Button variant="outline" onClick={() => { setAddOpen(false); setForm({ ...BLANK_LEAD }); }}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.firstName || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create Lead"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
