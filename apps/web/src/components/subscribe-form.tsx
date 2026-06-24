"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export function SubscribeForm({ source = "website", dark = false }: { source?: string; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    try {
      await api.post("/public/subscribe", { email: email.trim(), source });
      setState("done");
      setMsg("You're subscribed — thanks!");
      setEmail("");
    } catch (err: any) {
      setState("error");
      setMsg(err?.message ?? "Something went wrong. Please try again.");
    }
  }

  if (state === "done") {
    return <p className={dark ? "text-sm text-white/90" : "text-sm text-green-700 font-medium"}>✓ {msg}</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className={`flex-1 rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-brand-500 ${dark ? "bg-white/10 border-white/20 text-white placeholder:text-white/50" : "bg-white border-gray-300 text-gray-900"}`}
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 whitespace-nowrap"
      >
        {state === "loading" ? "…" : "Subscribe"}
      </button>
      {state === "error" && <span className="text-xs text-red-500 self-center">{msg}</span>}
    </form>
  );
}
