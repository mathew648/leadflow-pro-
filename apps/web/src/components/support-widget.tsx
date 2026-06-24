"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MessageCircle, X, Mail, Send, ArrowLeft, Headphones } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Getting started", "Billing & plans", "Technical issue", "How do I…?", "Something else"];

export function SupportWidget() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"home" | "new" | "thread">("home");
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [reply, setReply] = useState("");

  const unwrap = (d: any) => d?.data ?? d;

  const { data: unreadData } = useQuery({ queryKey: ["support-unread"], queryFn: () => api.get<any>("/support/unread"), refetchInterval: 30000 });
  const unread = unwrap(unreadData)?.unread ?? 0;

  const { data: hoursData } = useQuery({ queryKey: ["support-hours"], queryFn: () => api.get<any>("/support/hours"), enabled: open });
  const hours = unwrap(hoursData) ?? {};

  const { data: ticketsData } = useQuery({ queryKey: ["support-tickets"], queryFn: () => api.get<any>("/support/tickets"), enabled: open && view === "home" });
  const tickets: any[] = Array.isArray(unwrap(ticketsData)) ? unwrap(ticketsData) : [];

  const { data: threadData } = useQuery({
    queryKey: ["support-ticket", activeTicket],
    queryFn: () => api.get<any>(`/support/tickets/${activeTicket}`),
    enabled: !!activeTicket && view === "thread",
    refetchInterval: 4000,
  });
  const thread = unwrap(threadData);

  const create = useMutation({
    mutationFn: (channel: "chat" | "email") => api.post<any>("/support/tickets", { subject, message, category: category || undefined, channel }),
    onSuccess: (r: any, channel) => {
      const t = unwrap(r);
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-unread"] });
      setSubject(""); setMessage(""); setCategory("");
      if (channel === "chat") { setActiveTicket(t.id); setView("thread"); }
      else { toast({ title: "Message sent", description: "Our team will reply to your email shortly." }); setView("home"); }
    },
    onError: (e: any) => toast({ title: "Couldn't send", description: e.message, variant: "destructive" }),
  });

  const sendReply = useMutation({
    mutationFn: (text: string) => api.post(`/support/tickets/${activeTicket}/messages`, { message: text }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["support-ticket", activeTicket] }); },
    onError: (e: any) => toast({ title: "Couldn't send", description: e.message, variant: "destructive" }),
  });

  function openThread(id: string) { setActiveTicket(id); setView("thread"); qc.invalidateQueries({ queryKey: ["support-unread"] }); }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Contact support"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary text-white shadow-lg px-4 py-3 hover:bg-primary/90 transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
        {!open && <span className="text-sm font-semibold hidden sm:inline">Support</span>}
        {!open && unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{unread}</span>}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[min(92vw,380px)] h-[min(78vh,560px)] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{view === "thread" ? (thread?.subject ?? "Conversation") : "Help & Support"}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-white/80 mt-0.5">
              {hours.open ? "🟢 We're online — chat with us now" : `🔴 Offline · ${hours.hours ?? "11am–7pm NZT"}`}
            </p>
          </div>

          {/* HOME */}
          {view === "home" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <button type="button" onClick={() => setView("new")} className="w-full rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-left hover:bg-primary/10">
                <p className="font-semibold text-primary flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Contact support</p>
                <p className="text-xs text-muted-foreground mt-1">Tell us what&apos;s going on — chat live or send an email.</p>
              </button>
              {tickets.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Your conversations</p>
                  <div className="space-y-1.5">
                    {tickets.map((t) => (
                      <button type="button" key={t.id} onClick={() => openThread(t.id)} className="w-full text-left rounded-lg border p-2.5 hover:bg-muted/50">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{t.subject}</span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded shrink-0", t.status === "resolved" || t.status === "closed" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700")}>{t.status}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground capitalize">{t.channel} · {new Date(t.lastMessageAt).toLocaleDateString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NEW */}
          {view === "new" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <button type="button" onClick={() => setView("home")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back</button>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
                <option value="">What&apos;s it about?</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className={inp} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <textarea className={inp + " min-h-[120px]"} placeholder="Describe your issue…" value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={!subject || !message || create.isPending} onClick={() => create.mutate("email")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50">
                  <Mail className="w-4 h-4" /> Email us
                </button>
                <button type="button" disabled={!subject || !message || create.isPending} onClick={() => create.mutate("chat")}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                  <MessageCircle className="w-4 h-4" /> {create.isPending ? "…" : "Chat now"}
                </button>
              </div>
              {!hours.open && <p className="text-xs text-amber-600">Our team is offline right now — start a chat or email and we&apos;ll reply by email as soon as we&apos;re back ({hours.hours}).</p>}
            </div>
          )}

          {/* THREAD */}
          {view === "thread" && (
            <>
              <div className="px-3 pt-2">
                <button type="button" onClick={() => { setView("home"); setActiveTicket(null); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> All conversations</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {(thread?.messages ?? []).map((m: any) => (
                  <div key={m.id} className={cn("flex", m.senderType === "tradie" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.senderType === "tradie" ? "bg-primary text-white" : m.senderType === "system" ? "bg-amber-50 text-amber-800 text-xs" : "bg-gray-100 text-gray-800")}>
                      {m.senderType === "agent" && <p className="text-[10px] font-semibold text-gray-500 mb-0.5">{m.senderName ?? "Support"}</p>}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                ))}
                {thread?.status === "resolved" && <p className="text-center text-xs text-muted-foreground py-2">This conversation was marked resolved. Send a message to reopen it.</p>}
              </div>
              <div className="border-t p-2 flex items-center gap-2">
                <input className="flex-1 rounded-full border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Type a message…"
                  value={reply} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) sendReply.mutate(reply.trim()); }} />
                <button type="button" disabled={!reply.trim() || sendReply.isPending} onClick={() => sendReply.mutate(reply.trim())} className="p-2 rounded-full bg-primary text-white disabled:opacity-50" aria-label="Send"><Send className="w-4 h-4" /></button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
