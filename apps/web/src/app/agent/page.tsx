"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentFetch, getAgentToken, setAgentToken } from "@/lib/agent-api";
import { Headphones, Send, CheckCircle, LogOut, Mail, MessageCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
] as const;

export default function AgentPortalPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"open" | "pending" | "resolved" | "all">("open");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  useEffect(() => {
    if (!getAgentToken()) router.replace("/agent/login");
    else setReady(true);
  }, [router]);

  const { data: me } = useQuery({ queryKey: ["agent-me"], queryFn: () => agentFetch<any>("/support/agent/me"), enabled: ready });
  const { data: allTickets } = useQuery({ queryKey: ["agent-tickets"], queryFn: () => agentFetch<any[]>("/support/agent/tickets?status=all"), enabled: ready, refetchInterval: 8000 });
  const tickets = allTickets ?? [];
  const counts = {
    open: tickets.filter((t) => t.status === "open").length,
    pending: tickets.filter((t) => t.status === "pending").length,
    unread: tickets.filter((t) => t.unread).length,
  };
  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const { data: thread } = useQuery({ queryKey: ["agent-thread", activeId], queryFn: () => agentFetch<any>(`/support/agent/tickets/${activeId}`), enabled: ready && !!activeId, refetchInterval: 4000 });

  const send = useMutation({
    mutationFn: (text: string) => agentFetch(`/support/agent/tickets/${activeId}/messages`, { method: "POST", body: JSON.stringify({ message: text }) }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["agent-thread", activeId] }); qc.invalidateQueries({ queryKey: ["agent-tickets"] }); },
  });
  const patch = useMutation({
    mutationFn: (body: any) => agentFetch(`/support/agent/tickets/${activeId}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-thread", activeId] }); qc.invalidateQueries({ queryKey: ["agent-tickets"] }); },
  });

  function logout() { setAgentToken(null); router.replace("/agent/login"); }
  function openTicket(id: string) { setActiveId(id); setTimeout(() => qc.invalidateQueries({ queryKey: ["agent-tickets"] }), 500); }

  if (!ready) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Headphones className="w-4 h-4" /></div>
          <span className="font-semibold">TradieJet Support</span>
          {me?.hours && <span className={cn("text-xs px-2 py-0.5 rounded-full", me.hours.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{me.hours.open ? "🟢 Online" : "🔴 Offline"}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">{me?.name}</span>
          <button type="button" onClick={logout} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Queue */}
        <aside className="w-80 border-r bg-white flex flex-col shrink-0">
          <div className="flex border-b text-sm">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                className={cn("flex-1 py-2.5 font-medium border-b-2 -mb-px", filter === f.id ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
                {f.label}{f.id === "open" && counts.open > 0 ? ` (${counts.open})` : f.id === "pending" && counts.pending > 0 ? ` (${counts.pending})` : ""}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No tickets here.</p>
              : filtered.map((t) => (
                <button key={t.id} type="button" onClick={() => openTicket(t.id)}
                  className={cn("w-full text-left px-4 py-3 border-b hover:bg-muted/40", activeId === t.id && "bg-primary/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate flex items-center gap-1.5">
                      {t.unread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      {t.businessName ?? t.customerName ?? "Tradie"}
                    </span>
                    {t.channel === "email" ? <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <MessageCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  </div>
                  <p className="text-sm truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.lastMessage}</p>
                </button>
              ))}
          </div>
        </aside>

        {/* Conversation */}
        <main className="flex-1 flex flex-col min-w-0">
          {!thread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a ticket to view the conversation.</div>
          ) : (
            <>
              <div className="bg-white border-b px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{thread.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {thread.businessName ?? thread.customerName} · {thread.customerEmail}{thread.category ? ` · ${thread.category}` : ""} · <span className="capitalize">{thread.status}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {thread.status === "resolved"
                    ? <button type="button" onClick={() => patch.mutate({ status: "open" })} className="text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-muted/50"><RotateCcw className="w-4 h-4" /> Reopen</button>
                    : <button type="button" onClick={() => patch.mutate({ status: "resolved" })} className="text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"><CheckCircle className="w-4 h-4" /> Resolve</button>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {(thread.messages ?? []).map((m: any) => (
                  <div key={m.id} className={cn("flex", m.senderType === "agent" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[70%] rounded-2xl px-3.5 py-2 text-sm", m.senderType === "agent" ? "bg-primary text-white" : m.senderType === "system" ? "bg-amber-50 text-amber-800 text-xs" : "bg-white border")}>
                      <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.senderType === "agent" ? (m.senderName ?? "You") : m.senderType === "system" ? "System" : (m.senderName ?? "Tradie")}</p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="text-[10px] opacity-50 mt-1">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t bg-white p-3 flex items-center gap-2">
                <input className="flex-1 rounded-full border px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Type your reply…"
                  value={reply} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) send.mutate(reply.trim()); }} />
                <button type="button" disabled={!reply.trim() || send.isPending} onClick={() => send.mutate(reply.trim())} className="p-2.5 rounded-full bg-primary text-white disabled:opacity-50" aria-label="Send"><Send className="w-4 h-4" /></button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
