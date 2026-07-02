"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { api, getToken } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldCheck, Download, Trash2, Plus, Mail, Users, FileText, Send, Inbox } from "lucide-react";

type Tab = "waitlist" | "subscribers" | "blog" | "send" | "contact";

async function downloadCsv(path: string, filename: string) {
  try {
    const token = getToken();
    const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) { toast({ title: "Couldn't export", description: e.message, variant: "destructive" }); }
}

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function MarketingAdminPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("waitlist");

  if (!user?.isPlatformAdmin) {
    return (
      <div>
        <Topbar title="Marketing" />
        <div className="p-8 text-center text-muted-foreground">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>This area is for TradieJet platform administrators only.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "waitlist", label: "Waitlist", icon: Users },
    { id: "subscribers", label: "Subscribers", icon: Mail },
    { id: "contact", label: "Contact", icon: Inbox },
    { id: "send", label: "Send email", icon: Send },
    { id: "blog", label: "Blog", icon: FileText },
  ];

  return (
    <div>
      <Topbar title="Marketing" />
      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex gap-1 border-b">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px",
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        {tab === "waitlist" && <WaitlistTab />}
        {tab === "subscribers" && <SubscribersTab />}
        {tab === "contact" && <ContactTab />}
        {tab === "send" && <SendEmailTab />}
        {tab === "blog" && <BlogTab />}
      </div>
    </div>
  );
}

function WaitlistTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-waitlist"], queryFn: () => api.get<any>("/admin/waitlist") });
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const total = (data as any)?.meta?.total ?? items.length;
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/waitlist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-waitlist"] }),
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{total} on the waitlist</p>
        <Button size="sm" variant="outline" onClick={() => downloadCsv("/api/v1/admin/export/waitlist.csv", `tradiejet-waitlist-${new Date().toISOString().slice(0, 10)}.csv`)}>
          <Download className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Business</th><th className="px-3 py-2">Trade</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
              : items.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No signups yet.</td></tr>
              : items.map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{w.email}</td>
                  <td className="px-3 py-2">{w.name || "—"}</td>
                  <td className="px-3 py-2">{w.businessName || "—"}</td>
                  <td className="px-3 py-2">{w.trade || "—"}</td>
                  <td className="px-3 py-2">{w.country || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(w.createdAt)}</td>
                  <td className="px-3 py-2 text-right"><button type="button" aria-label="Remove entry" title="Remove" onClick={() => del.mutate(w.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubscribersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-subscribers"], queryFn: () => api.get<any>("/admin/subscribers") });
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const total = (data as any)?.meta?.total ?? items.length;
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/subscribers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-subscribers"] }),
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{total} subscribers</p>
        <Button type="button" size="sm" variant="outline" onClick={() => downloadCsv("/api/v1/admin/export/subscribers.csv", `tradiejet-subscribers-${new Date().toISOString().slice(0, 10)}.csv`)}>
          <Download className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Subscribed</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
              : items.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No subscribers yet.</td></tr>
              : items.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{s.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.source || "—"}</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.createdAt)}</td>
                  <td className="px-3 py-2 text-right"><button type="button" aria-label="Remove subscriber" title="Remove" onClick={() => del.mutate(s.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContactTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-contact"], queryFn: () => api.get<any>("/admin/contact-messages") });
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const total = (data as any)?.meta?.total ?? items.length;
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/contact-messages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-contact"] }),
  });
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">{total} message{total === 1 ? "" : "s"} from the contact form</p>
      {isLoading ? <div className="rounded-lg border p-8 text-center text-muted-foreground">Loading…</div>
        : items.length === 0 ? <div className="rounded-lg border p-8 text-center text-muted-foreground">No messages yet.</div>
        : <div className="space-y-3">
            {items.map((m) => (
              <div key={m.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{m.name} <a href={`mailto:${m.email}`} className="text-sm font-normal text-primary hover:underline">&lt;{m.email}&gt;</a></p>
                    {m.subject && <p className="text-sm font-medium text-muted-foreground">{m.subject}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{fmtDate(m.createdAt)}</span>
                    <button type="button" aria-label="Delete" title="Delete" onClick={() => del.mutate(m.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-gray-700">{m.message}</p>
                <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + (m.subject || "your message"))}`} className="mt-2 inline-block text-sm text-primary hover:underline">Reply →</a>
              </div>
            ))}
          </div>}
    </div>
  );
}

const emptyPost = { id: "", title: "", slug: "", excerpt: "", content: "", coverImageUrl: "", authorName: "", tags: "", status: "draft" as "draft" | "published" };

function BlogTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-blog"], queryFn: () => api.get<any>("/admin/blog") });
  const posts: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const [editing, setEditing] = useState<typeof emptyPost | null>(null);

  const save = useMutation({
    mutationFn: (p: typeof emptyPost) => {
      const body = { title: p.title, slug: p.slug || undefined, excerpt: p.excerpt || undefined, content: p.content,
        coverImageUrl: p.coverImageUrl || undefined, authorName: p.authorName || undefined,
        tags: p.tags ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : [], status: p.status };
      return p.id ? api.patch(`/admin/blog/${p.id}`, body) : api.post("/admin/blog", body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-blog"] }); setEditing(null); toast({ title: "Post saved" }); },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/blog/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-blog"] }); toast({ title: "Post deleted" }); },
  });
  const seedStarter = useMutation({
    mutationFn: () => api.post<any>("/admin/blog/seed-starter"),
    onSuccess: (r: any) => {
      const d = r?.data ?? r;
      qc.invalidateQueries({ queryKey: ["admin-blog"] });
      toast({ title: "Starter posts published", description: `${d?.created ?? 0} added, ${d?.updated ?? 0} updated.` });
    },
    onError: (e: any) => toast({ title: "Couldn't add starter posts", description: e.message, variant: "destructive" }),
  });

  if (editing) {
    const p = editing;
    const setP = (k: string, v: string) => setEditing({ ...p, [k]: v });
    return (
      <div className="rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{p.id ? "Edit post" : "New post"}</h2>
          <button onClick={() => setEditing(null)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
        <input className={inp} placeholder="Title" value={p.title} onChange={(e) => setP("title", e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inp} placeholder="Slug (auto from title if blank)" value={p.slug} onChange={(e) => setP("slug", e.target.value)} />
          <input className={inp} placeholder="Author name" value={p.authorName} onChange={(e) => setP("authorName", e.target.value)} />
        </div>
        <input className={inp} placeholder="Cover image URL (optional)" value={p.coverImageUrl} onChange={(e) => setP("coverImageUrl", e.target.value)} />
        <input className={inp} placeholder="Tags (comma separated)" value={p.tags} onChange={(e) => setP("tags", e.target.value)} />
        <textarea className={inp + " min-h-[80px]"} placeholder="Short excerpt shown on the blog list" value={p.excerpt} onChange={(e) => setP("excerpt", e.target.value)} />
        <textarea className={inp + " min-h-[300px] font-mono text-xs"} placeholder="Body — markdown supported (## heading, - bullet, **bold**, [link](url))" value={p.content} onChange={(e) => setP("content", e.target.value)} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p.status === "published"} onChange={(e) => setP("status", e.target.checked ? "published" : "draft")} />
            Published (visible on the public blog)
          </label>
          <Button onClick={() => save.mutate(p)} disabled={save.isPending || !p.title || !p.content}>
            {save.isPending ? "Saving…" : "Save post"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{posts.length} posts</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => seedStarter.mutate()} disabled={seedStarter.isPending} title="Publish 3 ready-made SEO starter posts">
            {seedStarter.isPending ? "Adding…" : "Add starter posts"}
          </Button>
          <Button size="sm" onClick={() => setEditing({ ...emptyPost })}><Plus className="w-4 h-4 mr-1.5" /> New post</Button>
        </div>
      </div>
      <div className="rounded-lg border divide-y">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : posts.length === 0 ? <div className="p-8 text-center text-muted-foreground">No posts yet — write your first one.</div>
          : posts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">/{p.slug} · {fmtDate(p.publishedAt || p.createdAt)}</p>
              </div>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded", p.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>{p.status}</span>
              <button onClick={() => setEditing({ id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt || "", content: p.content, coverImageUrl: p.coverImageUrl || "", authorName: p.authorName || "", tags: (p.tags || []).join(", "), status: p.status })}
                className="text-sm text-primary hover:underline">Edit</button>
              <button type="button" aria-label="Delete post" title="Delete" onClick={() => { if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id); }} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
      </div>
    </div>
  );
}

function SendEmailTab() {
  const [audience, setAudience] = useState<"subscribers" | "waitlist" | "both">("subscribers");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: subRes } = useQuery({ queryKey: ["admin-subscribers"], queryFn: () => api.get<any>("/admin/subscribers") });
  const { data: waitRes } = useQuery({ queryKey: ["admin-waitlist"], queryFn: () => api.get<any>("/admin/waitlist") });
  const subCount = (subRes as any)?.meta?.total ?? 0;
  const waitCount = (waitRes as any)?.meta?.total ?? 0;
  const recipients = audience === "subscribers" ? subCount : audience === "waitlist" ? waitCount : subCount + waitCount;

  const send = useMutation({
    mutationFn: () => api.post<any>("/admin/marketing/email", { subject, message, audience }),
    onSuccess: (r: any) => { const q = (r?.data ?? r)?.queued ?? 0; toast({ title: `Email queued to ${q} ${q === 1 ? "person" : "people"}` }); setSubject(""); setMessage(""); },
    onError: (e: any) => toast({ title: "Couldn't send", description: e.message, variant: "destructive" }),
  });

  const options: { id: typeof audience; label: string; count: number }[] = [
    { id: "subscribers", label: "Newsletter subscribers", count: subCount },
    { id: "waitlist", label: "Waitlist", count: waitCount },
    { id: "both", label: "Everyone (deduplicated)", count: subCount + waitCount },
  ];

  return (
    <div className="rounded-lg border p-5 space-y-4 max-w-2xl">
      <div>
        <p className="text-sm font-medium mb-2">Send to</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {options.map((o) => (
            <button type="button" key={o.id} onClick={() => setAudience(o.id)}
              className={cn("rounded-lg border px-3 py-2.5 text-left", audience === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.count} {o.count === 1 ? "recipient" : "recipients"}</span>
            </button>
          ))}
        </div>
      </div>
      <input className={inp} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className={inp + " min-h-[220px]"} placeholder="Your message. Basic HTML is supported (e.g. <p>, <a href>, <strong>). It's wrapped in the TradieJet email template automatically." value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Will send to <strong>{recipients}</strong> {recipients === 1 ? "person" : "people"}.</p>
        <Button type="button" disabled={send.isPending || !subject || !message || recipients === 0}
          onClick={() => { if (confirm(`Send this email to ${recipients} ${recipients === 1 ? "person" : "people"}?`)) send.mutate(); }}>
          <Send className="w-4 h-4 mr-1.5" /> {send.isPending ? "Sending…" : "Send email"}
        </Button>
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
