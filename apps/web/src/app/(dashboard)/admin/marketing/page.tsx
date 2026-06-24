"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { api, getToken } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldCheck, Download, Trash2, Plus, Mail, Users, FileText } from "lucide-react";

type Tab = "waitlist" | "subscribers" | "blog";

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
        {tab === "blog" && <BlogTab />}
      </div>
    </div>
  );
}

function WaitlistTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-waitlist"], queryFn: () => api.get<any>("/admin/waitlist") });
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const total = (data as any)?.meta?.total ?? items.length;
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
            <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Business</th><th className="px-3 py-2">Trade</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Joined</th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No signups yet.</td></tr>
              : items.map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{w.email}</td>
                  <td className="px-3 py-2">{w.name || "—"}</td>
                  <td className="px-3 py-2">{w.businessName || "—"}</td>
                  <td className="px-3 py-2">{w.trade || "—"}</td>
                  <td className="px-3 py-2">{w.country || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(w.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubscribersTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-subscribers"], queryFn: () => api.get<any>("/admin/subscribers") });
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const total = (data as any)?.meta?.total ?? items.length;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{total} subscribers</p>
        <Button size="sm" variant="outline" onClick={() => downloadCsv("/api/v1/admin/export/subscribers.csv", `tradiejet-subscribers-${new Date().toISOString().slice(0, 10)}.csv`)}>
          <Download className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Subscribed</th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
              : items.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No subscribers yet.</td></tr>
              : items.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{s.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.source || "—"}</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
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
        <Button size="sm" onClick={() => setEditing({ ...emptyPost })}><Plus className="w-4 h-4 mr-1.5" /> New post</Button>
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
              <button onClick={() => { if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id); }} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
