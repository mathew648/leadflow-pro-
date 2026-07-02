"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Phone, Mail, MapPin, Star, Calendar, DollarSign,
  User, MessageSquare, Plus, CheckCircle, XCircle, ChevronRight,
  Sparkles, FileText, Briefcase,
} from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatRelative, statusColor, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const ACTIVITY_ICONS: Record<string, string> = {
  created: "🆕", stage_changed: "🔀", note_added: "📝", called: "📞",
  emailed: "📧", sms_sent: "💬", quoted: "📋", converted: "✅", scored: "🤖",
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api.get<any>(`/leads/${id}`),
  });

  const { data: stagesData } = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => api.get<any>("/leads/pipeline"),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<any[]>("/auth/users"),
  });

  const patchMutation = useMutation({
    mutationFn: (body: any) => api.patch(`/leads/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      setEditMode(false);
      toast({ title: "Lead updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: () => api.post(`/leads/${id}/notes`, { note: noteText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      setNoteText("");
      toast({ title: "Note added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/leads/${id}/convert`, {}),
    onSuccess: (res: any) => {
      toast({ title: "Lead converted to customer!" });
      router.push(`/customers/${res.customerId ?? res.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stageMutation = useMutation({
    mutationFn: (stageId: string) => api.patch(`/leads/${id}`, { stageId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", id] }),
  });

  if (isLoading) {
    return (
      <div>
        <Topbar title="Lead" />
        <div className="p-6 text-muted-foreground animate-pulse">Loading…</div>
      </div>
    );
  }

  const lead = data as any;
  if (!lead) return <div className="p-6">Lead not found.</div>;

  const stages: any[] = stagesData?.stages ?? stagesData ?? [];
  const users: any[] = usersData ?? [];
  const activities: any[] = lead.activities ?? [];

  const displayName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || lead.phone;

  return (
    <div>
      <Topbar
        title="Lead Detail"
        action={
          lead.status !== "converted"
            ? { label: "Convert to Customer", onClick: () => convertMutation.mutate(), icon: <CheckCircle className="w-4 h-4" /> }
            : undefined
        }
      />

      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
        {/* Back nav */}
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All Leads
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold">{displayName}</h2>
                      <Badge className={statusColor(lead.status)}>{lead.status}</Badge>
                      {lead.aiScore && (
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                          lead.aiScore >= 70 ? "bg-green-100 text-green-700" :
                          lead.aiScore >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                        )}>
                          <Sparkles className="w-3 h-3" /> {lead.aiScore}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lead.leadNumber} · {lead.source?.replace(/_/g, " ")}
                      {lead.sourceDetail && ` via ${lead.sourceDetail}`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setEditMode(!editMode); setEditData({ ...lead }); }}>
                    {editMode ? "Cancel" : "Edit"}
                  </Button>
                </div>

                {editMode ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { key: "firstName", label: "First Name" },
                      { key: "lastName", label: "Last Name" },
                      { key: "email", label: "Email", type: "email" },
                      { key: "phone", label: "Phone" },
                      { key: "companyName", label: "Company" },
                      { key: "serviceRequired", label: "Service Required" },
                    ].map(({ key, label, type }) => (
                      <div key={key}>
                        <label className="text-xs font-medium text-muted-foreground">{label}</label>
                        <input
                          type={type ?? "text"}
                          value={editData[key] ?? ""}
                          onChange={(e) => setEditData((p: any) => ({ ...p, [key]: e.target.value }))}
                          className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Estimated Value</label>
                      <input
                        type="number"
                        value={editData.estimatedValueCents ? editData.estimatedValueCents / 100 : ""}
                        onChange={(e) => setEditData((p: any) => ({ ...p, estimatedValueCents: Math.round(Number(e.target.value) * 100) }))}
                        className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Urgency</label>
                      <select
                        value={editData.urgency ?? "normal"}
                        onChange={(e) => setEditData((p: any) => ({ ...p, urgency: e.target.value }))}
                        className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {["emergency", "high", "normal", "low"].map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Notes</label>
                      <textarea
                        value={editData.notes ?? ""}
                        onChange={(e) => setEditData((p: any) => ({ ...p, notes: e.target.value }))}
                        rows={3}
                        className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                      <Button size="sm" onClick={() => patchMutation.mutate(editData)} disabled={patchMutation.isPending}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {lead.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <a href={`mailto:${lead.email}`} className="hover:text-foreground truncate">{lead.email}</a>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <a href={`tel:${lead.phone}`} className="hover:text-foreground">{lead.phone}</a>
                      </div>
                    )}
                    {lead.suburb && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 flex-shrink-0" /> {lead.suburb}
                      </div>
                    )}
                    {lead.serviceRequired && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="w-4 h-4 flex-shrink-0" /> {lead.serviceRequired}
                      </div>
                    )}
                    {lead.estimatedValueCents > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="w-4 h-4 flex-shrink-0" /> Est. {formatCurrency(lead.estimatedValueCents)}
                      </div>
                    )}
                    {lead.preferredStartDate && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4 flex-shrink-0" /> {formatDate(lead.preferredStartDate)}
                      </div>
                    )}
                    {lead.notes && (
                      <div className="col-span-2 mt-1 p-3 bg-muted/50 rounded-lg text-muted-foreground">
                        {lead.notes}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stage pipeline */}
            {stages.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pipeline Stage</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex gap-1 flex-wrap">
                    {stages.map((stage: any) => (
                      <button
                        key={stage.id}
                        onClick={() => stageMutation.mutate(stage.id)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                          lead.stageId === stage.id
                            ? "border-transparent text-white shadow"
                            : "border-border hover:border-gray-300 text-muted-foreground hover:text-foreground"
                        )}
                        style={lead.stageId === stage.id ? { backgroundColor: stage.color, borderColor: stage.color } : {}}
                      >
                        {stage.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quotes */}
            {lead.quotes?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Quotes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  {lead.quotes.map((q: any) => (
                    <Link key={q.id} href={`/quotes/${q.id}`}
                      className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 px-1 rounded">
                      <div>
                        <p className="text-sm font-medium">{q.quoteNumber}</p>
                        <Badge className={cn("text-xs mt-0.5", statusColor(q.status))}>{q.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{formatCurrency(q.totalCents)}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Add note */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Add Note
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Log a call, add a note, record an interaction…"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    onClick={() => noteMutation.mutate()}
                    disabled={!noteText.trim() || noteMutation.isPending}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Note
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Activity timeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No activity yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activities.map((a: any) => (
                      <div key={a.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm flex-shrink-0">
                          {ACTIVITY_ICONS[a.type] ?? "•"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{a.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(a.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Quick stats */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{formatDate(lead.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-medium">{formatRelative(lead.updatedAt)}</p>
                </div>
                {lead.urgency && (
                  <div>
                    <p className="text-xs text-muted-foreground">Urgency</p>
                    <Badge className={cn("text-xs", lead.urgency === "emergency" ? "bg-red-100 text-red-700" : lead.urgency === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600")}>
                      {lead.urgency}
                    </Badge>
                  </div>
                )}
                {lead.aiCloseProbability && (
                  <div>
                    <p className="text-xs text-muted-foreground">Win Probability</p>
                    <p className="text-sm font-medium">{Math.round(Number(lead.aiCloseProbability) * 100)}%</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned to */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned To</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {lead.assignedTo ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center">
                      {lead.assignedTo.firstName?.[0]}{lead.assignedTo.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lead.assignedTo.firstName} {lead.assignedTo.lastName}</p>
                      {lead.assignedTo.phone && <p className="text-xs text-muted-foreground">{lead.assignedTo.phone}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                )}
                {users.length > 0 && (
                  <select
                    className="mt-2 w-full px-2 py-1.5 text-xs border rounded-md"
                    value={lead.assignedToId ?? ""}
                    onChange={(e) => patchMutation.mutate({ assignedToId: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="p-4 space-y-2">
                {lead.phone && (
                  <a href={`tel:${lead.phone}`}>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                      <Phone className="w-4 h-4" /> Call {lead.firstName}
                    </Button>
                  </a>
                )}
                {lead.status !== "converted" && lead.status !== "lost" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-red-600 hover:text-red-700"
                    onClick={() => patchMutation.mutate({ status: "lost" })}
                  >
                    <XCircle className="w-4 h-4" /> Mark as Lost
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
