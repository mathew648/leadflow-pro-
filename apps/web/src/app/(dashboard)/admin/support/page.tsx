"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldCheck, Plus, Trash2, ExternalLink } from "lucide-react";

export default function SupportAgentsAdminPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["admin-agents"], queryFn: () => api.get<any>("/admin/support/agents"), enabled: !!user?.isPlatformAdmin });
  const agents: any[] = Array.isArray(data) ? data : (data?.data ?? []);

  const create = useMutation({
    mutationFn: () => api.post("/admin/support/agents", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-agents"] }); setForm({ name: "", email: "", password: "" }); setShowNew(false); toast({ title: "Agent created" }); },
    onError: (e: any) => toast({ title: "Couldn't create", description: e.message, variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: (a: any) => api.patch(`/admin/support/agents/${a.id}`, { isActive: !a.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-agents"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/support/agents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-agents"] }); toast({ title: "Agent removed" }); },
  });

  if (!user?.isPlatformAdmin) {
    return <div><Topbar title="Support Team" /><div className="p-8 text-center text-muted-foreground"><ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Platform administrators only.</p></div></div>;
  }

  return (
    <div>
      <Topbar title="Support Team" />
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Customer-service logins for the agent portal at <a href="/agent" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">/agent <ExternalLink className="w-3 h-3" /></a></p>
          <Button type="button" size="sm" onClick={() => setShowNew((s) => !s)}><Plus className="w-4 h-4 mr-1.5" /> New agent</Button>
        </div>

        {showNew && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <input className={inp} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={inp} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className={inp} placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button type="button" size="sm" disabled={create.isPending || !form.name || !form.email || form.password.length < 8} onClick={() => create.mutate()}>
                {create.isPending ? "Creating…" : "Create login"}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border divide-y">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
            : agents.length === 0 ? <div className="p-8 text-center text-muted-foreground">No support agents yet — add your first one.</div>
            : agents.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                </div>
                <button type="button" onClick={() => toggle.mutate(a)} className={cn("text-xs font-medium px-2 py-0.5 rounded", a.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                  {a.isActive ? "Active" : "Disabled"}
                </button>
                <button type="button" aria-label="Remove agent" title="Remove" onClick={() => { if (confirm(`Remove ${a.name}?`)) del.mutate(a.id); }} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
