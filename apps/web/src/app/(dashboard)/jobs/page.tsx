"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Search, MapPin, Clock, User } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn, formatDateTime, statusColor, priorityColor } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const JOB_TYPES = [
  { value: "", label: "General" },
  { value: "installation", label: "Installation" },
  { value: "repair", label: "Repair" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inspection", label: "Inspection" },
  { value: "emergency", label: "Emergency" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "emergency", label: "Emergency" },
  { value: "low", label: "Low" },
];

const PRIORITY_DOT: Record<string, string> = {
  emergency: "bg-red-500",
  high: "bg-orange-400",
  normal: "bg-blue-400",
  low: "bg-gray-300",
};

const BLANK = {
  customerId: "", title: "", description: "",
  jobType: "", priority: "normal", scheduledStart: "",
};

export default function JobsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", search, status],
    queryFn: () => api.get<any>(
      `/jobs?search=${encodeURIComponent(search)}&${status ? `status=${status}&` : ""}limit=50`
    ),
    refetchInterval: 30000,
  });

  const { data: customersData } = useQuery({
    queryKey: ["customers-search"],
    queryFn: () => api.get<any>("/customers?limit=200"),
    enabled: addOpen,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<any>("/jobs", {
        customerId: form.customerId,
        title: form.title,
        description: form.description || undefined,
        jobType: form.jobType || undefined,
        priority: form.priority,
        scheduledStart: form.scheduledStart ? new Date(form.scheduledStart).toISOString() : undefined,
      }),
    onSuccess: (res: any) => {
      toast({ title: "Job created!" });
      setAddOpen(false);
      setForm({ ...BLANK });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      router.push(`/jobs/${res.id ?? res.data?.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const jobs: any[] = data?.data ?? [];
  const customers: any[] = customersData?.data ?? [];
  const canSubmit = form.customerId && form.title;

  return (
    <div>
      <Topbar title="Jobs" action={{ label: "Create Job", onClick: () => setAddOpen(true) }} />

      {/* Status tabs */}
      <div className="flex items-center gap-1 px-4 lg:px-6 pt-4 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              status === tab.value
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b bg-white mt-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <span className="text-sm text-muted-foreground">{data?.meta?.total ?? 0} jobs</span>
      </div>

      <div className="p-4 lg:p-6 space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />)
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No jobs found</p>
          </div>
        ) : (
          jobs.map((job: any) => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <div className="bg-white rounded-xl border p-4 hover:shadow-md hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", PRIORITY_DOT[job.priority] ?? "bg-gray-300")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">{job.jobNumber}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColor(job.status))}>
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="font-semibold mt-0.5">{job.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.customer?.firstName} {job.customer?.lastName}
                      </p>
                    </div>
                  </div>
                  {job.totalCents > 0 && (
                    <p className="font-semibold text-green-700 flex-shrink-0">
                      ${(job.totalCents / 100).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {job.property && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.property.streetAddress}, {job.property.suburb}
                    </span>
                  )}
                  {job.scheduledStart && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(job.scheduledStart)}
                    </span>
                  )}
                  {job.leadTechnician && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {job.leadTechnician.firstName} {job.leadTechnician.lastName}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Create Job Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <h3 className="font-semibold text-lg">Create Job</h3>
              <button
                onClick={() => { setAddOpen(false); setForm({ ...BLANK }); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Customer *</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select customer…</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ")}{c.companyName ? ` — ${c.companyName}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Job Title *</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Switchboard Upgrade — 123 Main St"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  placeholder="Details about the work to be done…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Job Type</label>
                  <select
                    value={form.jobType}
                    onChange={(e) => setForm((f) => ({ ...f, jobType: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {JOB_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Scheduled Start</label>
                <input
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledStart: e.target.value }))}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <Button variant="outline" onClick={() => { setAddOpen(false); setForm({ ...BLANK }); }}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create Job"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
