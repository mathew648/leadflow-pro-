"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

const TRADES = ["Plumbing", "Electrical", "Building / Carpentry", "HVAC", "Landscaping", "Painting", "Roofing", "Tiling", "Cleaning", "Other"];

export default function WaitlistPage() {
  const [form, setForm] = useState({ name: "", email: "", businessName: "", trade: "", country: "AU", phone: "" });
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) return;
    setState("loading");
    try {
      await api.post("/public/waitlist", {
        email: form.email.trim(),
        name: form.name.trim() || undefined,
        businessName: form.businessName.trim() || undefined,
        trade: form.trade || undefined,
        country: form.country as "AU" | "NZ",
        phone: form.phone.trim() || undefined,
        source: "waitlist-page",
      });
      setState("done");
    } catch (err: any) {
      setState("error");
      setMsg(err?.message ?? "Something went wrong. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
        <h1 className="mt-5 text-2xl font-bold">You&apos;re on the list! 🎉</h1>
        <p className="mt-3 text-gray-600">Thanks for joining — we&apos;ll email you the moment your spot opens up. Keep an eye on your inbox.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16 grid lg:grid-cols-2 gap-12 items-start">
      <div>
        <span className="inline-block rounded-full bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1">Early access</span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">Join the TradieJet waitlist</h1>
        <p className="mt-4 text-gray-600">Be first in line for the all-in-one lead &amp; job management platform built for AU &amp; NZ trades. Waitlist members get early access and a launch discount.</p>
        <ul className="mt-6 space-y-3 text-sm text-gray-700">
          {["Capture and chase your own leads", "Quotes, jobs, invoices & card payments in one place", "GST-ready for Australia & New Zealand", "Founding-member pricing locked in"].map((t) => (
            <li key={t} className="flex items-start gap-2.5"><CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" /><span>{t}</span></li>
          ))}
        </ul>
      </div>

      <form onSubmit={submit} className="rounded-2xl border bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Your name"><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" /></Field>
          <Field label="Country">
            <select className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)}>
              <option value="AU">🇦🇺 Australia</option>
              <option value="NZ">🇳🇿 New Zealand</option>
            </select>
          </Field>
        </div>
        <Field label="Email *"><input type="email" required className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Business name"><input className={inputCls} value={form.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="Smith Plumbing" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Trade">
            <select className={inputCls} value={form.trade} onChange={(e) => set("trade", e.target.value)}>
              <option value="">Select…</option>
              {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Optional" /></Field>
        </div>
        {state === "error" && <p className="text-sm text-red-500">{msg}</p>}
        <button type="submit" disabled={state === "loading"} className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {state === "loading" ? "Joining…" : "Join the waitlist"}
        </button>
        <p className="text-xs text-gray-400 text-center">No spam. We&apos;ll only email you about your spot.</p>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>{children}</label>;
}
