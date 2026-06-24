"use client";
import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setState("loading");
    try {
      await api.post("/public/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      setState("done");
    } catch (err: any) {
      setState("error");
      setMsg(err?.message ?? "Something went wrong. Please email us directly.");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
        <h2 className="mt-4 text-lg font-bold">Message sent!</h2>
        <p className="mt-2 text-sm text-gray-600">Thanks for reaching out — we&apos;ll get back to you within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-6 sm:p-8 space-y-4">
      <h2 className="font-semibold text-lg">Send us a message</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Your name *"><input className={inp} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" required /></Field>
        <Field label="Email *"><input type="email" className={inp} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" required /></Field>
      </div>
      <Field label="Subject"><input className={inp} value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="What's this about?" /></Field>
      <Field label="Message *"><textarea className={inp + " min-h-[140px]"} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="How can we help?" required /></Field>
      {state === "error" && <p className="text-sm text-red-500">{msg}</p>}
      <button type="submit" disabled={state === "loading"} className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {state === "loading" ? "Sending…" : "Send message"}
      </button>
      <p className="text-xs text-gray-400 text-center">Prefer email? Reach us at <a href="mailto:support@tradiejet.com" className="text-brand-600 hover:underline">support@tradiejet.com</a></p>
    </form>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>{children}</label>;
}
