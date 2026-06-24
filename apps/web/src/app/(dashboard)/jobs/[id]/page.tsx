"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Clock, MapPin, User, Wrench, CheckSquare, Package,
  Camera, Play, CheckCircle, Receipt, ChevronRight, Plus, Trash2,
  AlertTriangle, Phone, Calendar, FileText,
} from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, statusColor, priorityColor, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const JOB_STATUS_FLOW: Record<string, string> = {
  pending: "scheduled",
  scheduled: "dispatched",
  dispatched: "in_progress",
  in_progress: "completed",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  dispatched: "Dispatched",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ISO → value for <input type="datetime-local"> (local time, "YYYY-MM-DDTHH:mm")
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "time" | "materials" | "photos">("overview");
  const [completionNotes, setCompletionNotes] = useState("");
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ catalogItemId: "", name: "", quantity: 1, unitCostCents: 0, unitPriceCents: 0 });
  const [newTask, setNewTask] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.get<any>(`/jobs/${id}`),
  });

  const patchMutation = useMutation({
    mutationFn: (body: any) => api.patch(`/jobs/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      toast({ title: "Job updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/start`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      toast({ title: "Job started — time tracking active" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/complete`, { completionNotes, createInvoice: true }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      setShowCompleteDialog(false);
      toast({ title: "Job completed!", description: res?.invoice ? "Invoice created automatically." : undefined });
      if (res?.invoice?.id) router.push(`/invoices/${res.invoice.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const checklistMutation = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      api.patch(`/jobs/${id}/checklists/any/items/${itemId}`, { checked }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", id] }),
  });

  // Price-book items for the materials picker (materials, labour, subcontract, etc.)
  const { data: catalogData } = useQuery({ queryKey: ["catalog-min"], queryFn: () => api.get<any>("/catalog/items?limit=200") });
  const catalogItems: any[] = Array.isArray(catalogData) ? catalogData : (catalogData?.data ?? []);

  const addMaterialMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/materials`, {
      catalogItemId: newMaterial.catalogItemId || undefined,
      name: newMaterial.name,
      quantity: Number(newMaterial.quantity) || 1,
      unitCostCents: newMaterial.unitCostCents,
      unitPriceCents: newMaterial.unitPriceCents || newMaterial.unitCostCents, // default sell = cost if not set
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      setNewMaterial({ catalogItemId: "", name: "", quantity: 1, unitCostCents: 0, unitPriceCents: 0 });
      toast({ title: "Item added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMaterialMutation = useMutation({
    mutationFn: ({ materialId, unitCostCents }: { materialId: string; unitCostCents: number }) =>
      api.patch(`/jobs/${id}/materials/${materialId}`, { unitCostCents }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job", id] }); toast({ title: "Cost saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteMaterialMutation = useMutation({
    mutationFn: (materialId: string) => api.delete(`/jobs/${id}/materials/${materialId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", id] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addTaskMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/tasks`, { title: newTask }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job", id] }); setNewTask(""); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const taskMutation = useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: any }) => api.patch(`/jobs/${id}/tasks/${taskId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", id] }),
  });
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.delete(`/jobs/${id}/tasks/${taskId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", id] }),
  });
  const createQuoteMutation = useMutation({
    mutationFn: () => api.post<any>(`/jobs/${id}/quote`, {}),
    onSuccess: (res: any) => {
      const qid = res?.id ?? res?.data?.id;
      toast({ title: res?.existing ? "Quote already exists for this job" : "Quote created from job" });
      if (qid) router.push(`/quotes/${qid}?jobId=${id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const invoiceMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/invoice`, {}),
    onSuccess: (res: any) => {
      toast({ title: "Invoice created!" });
      if (res?.id || res?.data?.id) router.push(`/invoices/${res.id ?? res.data.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div>
        <Topbar title="Job" />
        <div className="p-6 text-muted-foreground animate-pulse">Loading…</div>
      </div>
    );
  }

  const job = data as any;
  if (!job) return <div className="p-6">Job not found.</div>;

  const checklists: any[] = job.checklists ?? [];
  const tasks: any[] = job.tasks ?? [];
  const timeEntries: any[] = job.timeEntries ?? [];
  const materials: any[] = job.materials ?? [];
  const photos: any[] = job.photos ?? [];

  const totalLabourMins = timeEntries
    .filter((te: any) => te.endedAt)
    .reduce((sum: number, te: any) => {
      return sum + (new Date(te.endedAt).getTime() - new Date(te.startedAt).getTime()) / 60000;
    }, 0);

  const completedItems = checklists.flatMap((cl: any) => cl.items ?? []).filter((item: any) => item.checked).length;
  const totalItems = checklists.flatMap((cl: any) => cl.items ?? []).length;

  const nextStatus = JOB_STATUS_FLOW[job.status];
  const isCompleted = job.status === "completed";
  const canComplete = job.status === "in_progress";
  const quoteStatus = job.quote?.status as string | undefined;
  const quoteApproved = quoteStatus === "approved";
  // If the job has a quote that isn't approved yet, work is locked (can't start / add tasks / add items).
  const workLocked = !!job.quoteId && !quoteApproved;
  const canStart = !workLocked && (job.status === "dispatched" || job.status === "scheduled" ||
    (quoteApproved && !["in_progress", "completed", "cancelled"].includes(job.status)));

  return (
    <div>
      <Topbar title={`Job ${job.jobNumber}`} />

      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All Jobs
        </Link>

        {/* Header card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-xl font-bold">{job.title}</h2>
                  <Badge className={cn("text-xs", statusColor(job.status))}>{STATUS_LABELS[job.status] ?? job.status}</Badge>
                  {job.priority !== "normal" && (
                    <span className={cn("text-xs font-medium flex items-center gap-0.5", priorityColor(job.priority))}>
                      <AlertTriangle className="w-3 h-3" /> {job.priority}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{job.jobNumber}</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                {!job.quoteId ? (
                  <Button size="sm" variant="outline" onClick={() => createQuoteMutation.mutate()} disabled={createQuoteMutation.isPending}>
                    <FileText className="w-4 h-4 mr-1.5" /> Create Quote
                  </Button>
                ) : (
                  <Link href={`/quotes/${job.quoteId}?jobId=${id}`}>
                    <Button size="sm" variant="outline">
                      <FileText className="w-4 h-4 mr-1.5" />
                      {quoteStatus === "approved" ? "Quote approved" :
                        quoteStatus === "rejected" ? "Quote declined" :
                        (quoteStatus === "sent" || quoteStatus === "viewed") ? "Quote — awaiting approval" :
                        "View Quote"}
                    </Button>
                  </Link>
                )}
                {canStart && (
                  <Button size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                    <Play className="w-4 h-4 mr-1.5" /> Start Job
                  </Button>
                )}
                {canComplete && (
                  <Button size="sm" onClick={() => setShowCompleteDialog(true)}>
                    <CheckCircle className="w-4 h-4 mr-1.5" /> Complete Job
                  </Button>
                )}
                {isCompleted && !job.invoiceId && (
                  <Button size="sm" variant="outline" onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending}>
                    <Receipt className="w-4 h-4 mr-1.5" /> Create Invoice
                  </Button>
                )}
                {job.invoiceId && (
                  <Link href={`/invoices/${job.invoiceId}`}>
                    <Button size="sm" variant="outline">
                      <Receipt className="w-4 h-4 mr-1.5" /> View Invoice
                    </Button>
                  </Link>
                )}
                {nextStatus && !isCompleted && !canComplete && !canStart && (
                  <Button size="sm" variant="outline" onClick={() => patchMutation.mutate({ status: nextStatus })}>
                    Advance to {STATUS_LABELS[nextStatus]}
                  </Button>
                )}
              </div>
            </div>

            {/* Complete dialog */}
            {showCompleteDialog && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-2">Complete Job</p>
                <textarea
                  placeholder="Completion notes (optional)…"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-green-400 resize-none mb-2"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
                    <CheckCircle className="w-4 h-4 mr-1.5" /> Confirm Complete
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCompleteDialog(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Schedule date & time */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">Scheduled:</span>
              <input
                type="datetime-local"
                aria-label="Job scheduled date and time"
                title="Job scheduled date and time"
                defaultValue={toLocalInput(job.scheduledStart)}
                onChange={(e) => { if (e.target.value) patchMutation.mutate({ scheduledStart: new Date(e.target.value).toISOString() }); }}
                className="px-2.5 py-1 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {!job.scheduledStart && <span className="text-xs text-amber-600">Pick a date &amp; time to schedule this job</span>}
              {patchMutation.isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
            </div>

            {/* Info grid */}
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              {job.customer && (
                <Link href={`/customers/${job.customer.id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  <User className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{[job.customer.firstName, job.customer.lastName].filter(Boolean).join(" ") || job.customer.companyName}</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
              {job.scheduledStart && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>{formatDateTime(job.scheduledStart)}</span>
                </div>
              )}
              {job.property && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{job.property.streetAddress}, {job.property.suburb}</span>
                </div>
              )}
              {job.leadTechnician && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wrench className="w-4 h-4 flex-shrink-0" />
                  <span>{job.leadTechnician.firstName} {job.leadTechnician.lastName}</span>
                  {job.leadTechnician.phone && (
                    <a href={`tel:${job.leadTechnician.phone}`} className="hover:text-foreground">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {job.quote && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">From quote:</span>
                <Link href={`/quotes/${job.quote.id}`} className="text-primary hover:underline flex items-center gap-0.5">
                  {job.quote.quoteNumber} ({formatCurrency(job.quote.totalCents)})
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Labour Time", value: totalLabourMins > 0 ? `${Math.floor(totalLabourMins / 60)}h ${Math.round(totalLabourMins % 60)}m` : "—", icon: Clock },
            { label: "Checklist", value: totalItems > 0 ? `${completedItems}/${totalItems}` : "—", icon: CheckSquare },
            { label: "Materials", value: formatCurrency(job.actualMaterialsCents ?? 0), icon: Package },
            { label: "Job Total", value: formatCurrency(job.actualTotalCents ?? 0), icon: Receipt },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Work is locked until the customer approves the quote */}
        {workLocked && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">Waiting on quote approval</p>
              <p className="text-amber-700">Once the customer approves the quote, you can start the job and tick off tasks. The quote's items appear in Materials automatically — you can add items and costs there any time.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b flex gap-0">
          {(["overview", "tasks", "time", "materials", "photos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors",
                activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t}{t === "tasks" && tasks.length > 0 ? ` (${tasks.length})` : ""}
              {t === "time" && timeEntries.length > 0 ? ` (${timeEntries.length})` : ""}
              {t === "materials" && materials.length > 0 ? ` (${materials.length})` : ""}
              {t === "photos" && photos.length > 0 ? ` (${photos.length})` : ""}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <ProfitCard job={job} jobId={id} onAddCosts={() => setActiveTab("materials")} />
            {job.description && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Description</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{job.description}</p></CardContent>
              </Card>
            )}
            {job.internalNotes && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Internal Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{job.internalNotes}</p></CardContent>
              </Card>
            )}
            {job.completionNotes && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-700">Completion Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm">{job.completionNotes}</p></CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tasks/Checklist tab */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            {/* Tasks — add / toggle / delete */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckSquare className="w-4 h-4" /> Tasks</CardTitle></CardHeader>
              <CardContent className="pb-3">
                {tasks.length === 0 && <p className="text-sm text-muted-foreground mb-2">No tasks yet — add one below.</p>}
                {tasks.map((t: any) => (
                  <div key={t.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <input
                      type="checkbox"
                      checked={t.status === "done"}
                      onChange={(e) => taskMutation.mutate({ taskId: t.id, body: { status: e.target.checked ? "done" : "pending" } })}
                      className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
                      aria-label={`Mark ${t.title} done`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                    </div>
                    <button onClick={() => deleteTaskMutation.mutate(t.id)} className="p-1 text-muted-foreground hover:text-red-600" aria-label="Delete task"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="Add a task…"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newTask.trim()) addTaskMutation.mutate(); }}
                    className="flex-1 px-2.5 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" onClick={() => addTaskMutation.mutate()} disabled={!newTask.trim() || addTaskMutation.isPending || workLocked}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                </div>
              </CardContent>
            </Card>
            {checklists.length === 0 && tasks.length === 0 && (
              <></>
            )}
            {checklists.map((cl: any) => (
              <Card key={cl.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" /> {cl.name}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {cl.items?.filter((i: any) => i.checked).length}/{cl.items?.length ?? 0}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  {(cl.items ?? []).map((item: any) => (
                    <div key={item.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => checklistMutation.mutate({ itemId: item.id, checked: e.target.checked })}
                        className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", item.checked && "line-through text-muted-foreground")}>{item.label}</p>
                        {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                      </div>
                      {item.isRequired && !item.checked && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">Required</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Time entries tab */}
        {activeTab === "time" && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-medium">Time Entries ({timeEntries.length})</p>
                <p className="text-sm text-muted-foreground">
                  Total: {Math.floor(totalLabourMins / 60)}h {Math.round(totalLabourMins % 60)}m
                </p>
              </div>
              {timeEntries.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No time entries yet. Start the job to begin tracking.</p>
              ) : (
                timeEntries.map((te: any) => {
                  const mins = te.endedAt
                    ? (new Date(te.endedAt).getTime() - new Date(te.startedAt).getTime()) / 60000
                    : null;
                  return (
                    <div key={te.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{te.user?.firstName} {te.user?.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(te.startedAt)} → {te.endedAt ? formatDateTime(te.endedAt) : "In progress"}
                        </p>
                      </div>
                      {mins !== null && (
                        <span className="text-sm font-medium flex-shrink-0">
                          {Math.floor(mins / 60)}h {Math.round(mins % 60)}m
                        </span>
                      )}
                      {!te.endedAt && (
                        <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {/* Materials tab */}
        {activeTab === "materials" && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-medium">Materials Used</p>
                <p className="text-sm font-semibold">{formatCurrency(job.actualMaterialsCents ?? 0)}</p>
              </div>
              {materials.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                  <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.quantity} {m.unit ?? "ea"} · sell {formatCurrency(m.unitPriceCents)}</p>
                  </div>
                  {/* Inline editable cost — type a unit cost, profit updates on blur */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-muted-foreground">cost</span>
                    <div className="relative">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <input
                        type="number" min="0" step="0.01" placeholder="0.00"
                        aria-label={`Unit cost for ${m.name}`}
                        defaultValue={m.unitCostCents ? (m.unitCostCents / 100).toFixed(2) : ""}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        onBlur={(e) => {
                          const c = Math.round((Number(e.target.value) || 0) * 100);
                          if (c !== m.unitCostCents) updateMaterialMutation.mutate({ materialId: m.id, unitCostCents: c });
                        }}
                        className={cn("w-20 pl-5 pr-1.5 py-1 text-sm border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary",
                          !m.unitCostCents && "border-amber-300 bg-amber-50")}
                      />
                    </div>
                    <button type="button" onClick={() => deleteMaterialMutation.mutate(m.id)} aria-label="Remove item"
                      className="p-1 text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add item — pick from the price book (materials, labour, subcontractor…) or type a custom one */}
              <div className="p-4 border-t bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">Add item (material · labour · subcontractor)</p>
                <select
                  aria-label="Pick from price book"
                  value={newMaterial.catalogItemId}
                  onChange={(e) => {
                    const it = catalogItems.find((c: any) => c.id === e.target.value);
                    if (it) setNewMaterial((p) => ({ ...p, catalogItemId: it.id, name: it.name, unitCostCents: it.unitCostCents ?? 0, unitPriceCents: it.unitPriceCents ?? 0 }));
                    else setNewMaterial((p) => ({ ...p, catalogItemId: "" }));
                  }}
                  className="w-full mb-2 px-2 py-1.5 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Pick from price book, or type a custom item below —</option>
                  {catalogItems.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.type ? `[${c.type}] ` : ""}{c.name} — {formatCurrency(c.unitPriceCents ?? 0)}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <input
                    type="text" placeholder="Item name"
                    value={newMaterial.name}
                    onChange={(e) => setNewMaterial((p) => ({ ...p, name: e.target.value }))}
                    className="col-span-2 lg:col-span-1 px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number" placeholder="Qty" min="1"
                    value={newMaterial.quantity}
                    onChange={(e) => setNewMaterial((p) => ({ ...p, quantity: Number(e.target.value) }))}
                    className="px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">cost</span>
                    <input
                      type="number" placeholder="0.00" min="0" step="0.01" aria-label="Unit cost"
                      value={newMaterial.unitCostCents ? newMaterial.unitCostCents / 100 : ""}
                      onChange={(e) => setNewMaterial((p) => ({ ...p, unitCostCents: Math.round((Number(e.target.value) || 0) * 100) }))}
                      className="w-full pl-9 pr-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">price</span>
                    <input
                      type="number" placeholder="0.00" min="0" step="0.01" aria-label="Unit price (charge to customer)"
                      value={newMaterial.unitPriceCents ? newMaterial.unitPriceCents / 100 : ""}
                      onChange={(e) => setNewMaterial((p) => ({ ...p, unitPriceCents: Math.round((Number(e.target.value) || 0) * 100) }))}
                      className="w-full pl-9 pr-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <Button
                  size="sm" className="mt-2"
                  onClick={() => addMaterialMutation.mutate()}
                  disabled={!newMaterial.name || addMaterialMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add item
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos tab */}
        {activeTab === "photos" && (
          <Card>
            <CardContent className="p-4">
              {photos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No photos yet.</p>
                  <p className="text-xs mt-1">Photos are uploaded from the mobile field app.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {photos.map((p: any) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted border hover:opacity-90 transition-opacity">
                        <img src={p.url} alt={p.caption ?? "Job photo"} className="w-full h-full object-cover" />
                      </div>
                      {p.caption && <p className="text-xs text-muted-foreground mt-1 truncate">{p.caption}</p>}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── Auto-computed job profit (materials + labour pulled from the job) ─── */
function ProfitCard({ job, jobId, onAddCosts }: { job: any; jobId: string; onAddCosts: () => void }) {
  const qc = useQueryClient();
  const c = job.costing ?? { revenueCents: 0, materialsCostCents: 0, labourCostCents: 0, profitCents: 0, marginPct: 0 };
  const [editing, setEditing] = useState(false);
  const [materials, setMaterials] = useState(String((c.materialsCostCents || 0) / 100));
  const [labour, setLabour] = useState(String((c.labourCostCents || 0) / 100));

  const revenue = c.revenueCents || 0;
  const matC = editing ? Math.round((parseFloat(materials) || 0) * 100) : c.materialsCostCents;
  const labC = editing ? Math.round((parseFloat(labour) || 0) * 100) : c.labourCostCents;
  const profit = revenue - matC - labC;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

  const allItems = (job.materials ?? []);
  const missingCount = allItems.filter((m: any) => !m.unitCostCents).length;
  // Costs are incomplete if any item has no cost, or materials is just an estimate (no real item costs).
  const costsIncomplete = missingCount > 0 || !c.materialsAuto;

  const save = useMutation({
    mutationFn: () => api.patch<any>(`/jobs/${jobId}`, {
      actualMaterialsCents: Math.round((parseFloat(materials) || 0) * 100),
      actualLabourCents: Math.round((parseFloat(labour) || 0) * 100),
    }),
    onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: ["job", jobId] }); },
  });

  const profitColor = profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "text-gray-700";
  const box = "w-full rounded-md border px-3 py-2 text-sm";

  return (
    <Card className="border-brand-200">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">💰 Job profit</CardTitle>
        {!editing && (
          <button onClick={onAddCosts} className="text-xs text-primary hover:underline">Edit costs →</button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-muted-foreground">Revenue <span className="text-[9px]">(ex GST)</span></p>
            <p className="font-bold text-gray-900">{formatCurrency(revenue / 100)}</p>
            <p className="text-[10px] text-muted-foreground">{c.revenueSource === "invoice" ? "invoiced" : "quoted"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-muted-foreground">Materials</p>
            {editing ? <input type="number" className={box + " text-center mt-1"} value={materials} onChange={(e) => setMaterials(e.target.value)} /> : <p className="font-bold text-gray-900">{formatCurrency(matC / 100)}</p>}
            {!editing && <p className="text-[10px] text-muted-foreground">{c.materialsAuto ? "from materials" : "estimate"}</p>}
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-muted-foreground">Labour</p>
            {editing ? <input type="number" className={box + " text-center mt-1"} value={labour} onChange={(e) => setLabour(e.target.value)} /> : <p className="font-bold text-gray-900">{formatCurrency(labC / 100)}</p>}
            {!editing && <p className="text-[10px] text-muted-foreground">{c.labourAuto ? "from time entries" : "estimate"}</p>}
          </div>
          <div className={cn("rounded-lg p-3", profit >= 0 ? "bg-green-50" : "bg-red-50")}>
            <p className="text-xs text-muted-foreground">Profit</p>
            <p className={cn("font-bold", profitColor)}>{formatCurrency(profit / 100)}</p>
            <p className={cn("text-[10px] font-medium", profitColor)}>{margin}% margin</p>
          </div>
        </div>
        {!editing && costsIncomplete && (
          <button
            type="button"
            onClick={onAddCosts}
            className="mt-3 w-full rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {missingCount > 0
              ? `Add cost to ${missingCount} item${missingCount > 1 ? "s" : ""} to calculate your real profit`
              : "Add item costs to calculate your real profit"}
          </button>
        )}
        {editing ? (
          <div className="mt-3 flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground text-center">Pulled automatically from this job&apos;s materials, time entries and {c.revenueSource === "invoice" ? "invoice" : "quote"}. Tap &quot;Edit costs&quot; to adjust.</p>
        )}
      </CardContent>
    </Card>
  );
}
