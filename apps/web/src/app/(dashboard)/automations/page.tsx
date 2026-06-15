"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Workflow, Plus, ToggleLeft, ToggleRight, Trash2, Play, Zap } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn, formatRelative } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const TRIGGER_LABELS: Record<string, string> = {
  lead_created:       "Lead created",
  lead_stage_changed: "Lead stage changed",
  lead_assigned:      "Lead assigned",
  quote_sent:         "Quote sent",
  quote_viewed:       "Quote viewed",
  quote_approved:     "Quote approved",
  quote_rejected:     "Quote rejected",
  job_created:        "Job created",
  job_started:        "Job started",
  job_completed:      "Job completed",
  invoice_sent:       "Invoice sent",
  invoice_paid:       "Invoice paid",
  invoice_overdue:    "Invoice overdue",
  customer_created:   "Customer created",
  review_requested:   "Review requested",
};

const TRIGGER_COLORS: Record<string, string> = {
  lead_created: "bg-blue-100 text-blue-700",
  lead_stage_changed: "bg-blue-100 text-blue-700",
  quote_sent: "bg-purple-100 text-purple-700",
  quote_approved: "bg-green-100 text-green-700",
  quote_rejected: "bg-red-100 text-red-700",
  job_created: "bg-orange-100 text-orange-700",
  job_completed: "bg-green-100 text-green-700",
  invoice_sent: "bg-yellow-100 text-yellow-700",
  invoice_paid: "bg-green-100 text-green-700",
  invoice_overdue: "bg-red-100 text-red-700",
  customer_created: "bg-teal-100 text-teal-700",
};

const STEP_TYPE_LABELS: Record<string, string> = {
  send_email:   "Send email",
  send_sms:     "Send SMS",
  send_whatsapp:"Send WhatsApp",
  wait:         "Wait",
  assign_user:  "Assign user",
  update_field: "Update field",
  create_task:  "Create task",
  webhook:      "Webhook",
};

const ACTION_TYPES = [
  { value: "send_sms",   label: "Send SMS" },
  { value: "send_email", label: "Send email" },
  { value: "wait",       label: "Wait / delay" },
  { value: "create_task", label: "Create task" },
  { value: "webhook",    label: "Call webhook" },
];

const BLANK_STEP = { type: "send_sms", config: { message: "" }, delayMinutes: 0 };

export default function AutomationsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    triggerType: "lead_created",
    steps: [{ ...BLANK_STEP }],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: () => api.get<any>("/automations"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<any>("/automations", {
      ...form,
      steps: form.steps.map((s, i) => ({
        ...s,
        position: i,
        delayMinutes: Number(s.delayMinutes),
      })),
    }),
    onSuccess: () => {
      toast({ title: "Automation created!" });
      qc.invalidateQueries({ queryKey: ["automations"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (wf: any) => api.patch(`/automations/${wf.id}`, { isActive: !wf.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function closeModal() {
    setModalOpen(false);
    setForm({ name: "", description: "", triggerType: "lead_created", steps: [{ ...BLANK_STEP }] });
  }

  function addStep() {
    setForm((f) => ({ ...f, steps: [...f.steps, { ...BLANK_STEP }] }));
  }

  function removeStep(i: number) {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));
  }

  function updateStep(i: number, field: string, value: any) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s),
    }));
  }

  function updateStepConfig(i: number, field: string, value: string) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, idx) => idx === i ? { ...s, config: { ...s.config, [field]: value } } : s),
    }));
  }

  const workflows: any[] = data?.data ?? [];

  return (
    <div>
      <Topbar title="Automations" action={{ label: "New Automation", onClick: () => setModalOpen(true) }} />

      <div className="p-4 lg:p-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Workflow className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No automations yet</p>
            <p className="text-sm mt-1">Automate follow-ups, reminders, and tasks so nothing falls through the cracks</p>
            <Button size="sm" className="mt-4" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create first automation
            </Button>
          </div>
        ) : (
          workflows.map((wf: any) => (
            <Card key={wf.id} className={cn(!wf.isActive && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                      wf.isActive ? "bg-brand-100" : "bg-gray-100")}>
                      <Zap className={cn("w-4 h-4", wf.isActive ? "text-brand-600" : "text-gray-400")} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{wf.name}</p>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                          TRIGGER_COLORS[wf.triggerType] ?? "bg-gray-100 text-gray-600")}>
                          {TRIGGER_LABELS[wf.triggerType] ?? wf.triggerType}
                        </span>
                        {!wf.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Paused</span>
                        )}
                      </div>
                      {wf.description && <p className="text-sm text-muted-foreground mt-0.5">{wf.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          {wf._count?.executions ?? 0} executions
                        </span>
                        <span>{wf.steps?.length ?? 0} step{wf.steps?.length !== 1 ? "s" : ""}</span>
                        {wf.steps?.slice(0, 3).map((s: any, i: number) => (
                          <span key={i} className="bg-muted px-1.5 py-0.5 rounded text-xs">
                            {STEP_TYPE_LABELS[s.type] ?? s.type}
                            {s.delayMinutes > 0 && ` +${s.delayMinutes}m`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      title={wf.isActive ? "Pause" : "Activate"}
                      onClick={() => toggleMutation.mutate(wf)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {wf.isActive
                        ? <ToggleRight className="w-5 h-5 text-green-600" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      type="button"
                      title="Delete automation"
                      onClick={() => {
                        if (confirm(`Delete "${wf.name}"?`)) deleteMutation.mutate(wf.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Automation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <h3 className="font-semibold text-lg">New Automation</h3>
              <button type="button" onClick={closeModal} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Name & trigger */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Automation Name *</label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. Follow up new leads within 1 hour"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Trigger — When this happens…</label>
                  <select
                    value={form.triggerType}
                    onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                  <input
                    type="text"
                    placeholder="What does this automation do?"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Steps */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Then do these actions…</p>
                <div className="space-y-3">
                  {form.steps.map((step, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2 relative">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <select
                          value={step.type}
                          onChange={(e) => updateStep(i, "type", e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <span>+</span>
                          <input
                            type="number" min="0"
                            value={step.delayMinutes}
                            onChange={(e) => updateStep(i, "delayMinutes", e.target.value)}
                            className="w-14 px-1.5 py-1 text-xs border rounded text-center"
                          />
                          <span>min</span>
                        </div>
                        {form.steps.length > 1 && (
                          <button type="button" onClick={() => removeStep(i)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {step.type === "send_sms" && (
                        <textarea
                          placeholder="SMS message text… Use {firstName}, {businessName} as variables"
                          value={(step.config as any).message ?? ""}
                          onChange={(e) => updateStepConfig(i, "message", e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                      )}
                      {step.type === "send_email" && (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            placeholder="Subject line"
                            value={(step.config as any).subject ?? ""}
                            onChange={(e) => updateStepConfig(i, "subject", e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <textarea
                            placeholder="Email body…"
                            value={(step.config as any).body ?? ""}
                            onChange={(e) => updateStepConfig(i, "body", e.target.value)}
                            rows={3}
                            className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                          />
                        </div>
                      )}
                      {step.type === "create_task" && (
                        <input
                          type="text"
                          placeholder="Task title"
                          value={(step.config as any).title ?? ""}
                          onChange={(e) => updateStepConfig(i, "title", e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      )}
                      {step.type === "webhook" && (
                        <input
                          type="url"
                          placeholder="https://hooks.zapier.com/…"
                          value={(step.config as any).url ?? ""}
                          onChange={(e) => updateStepConfig(i, "url", e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addStep}
                  className="mt-2 w-full py-2 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add step
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <Button variant="outline" onClick={closeModal}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.name || form.steps.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create Automation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
