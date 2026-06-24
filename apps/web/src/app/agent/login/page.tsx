"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones } from "lucide-react";
import { agentFetch, setAgentToken } from "@/lib/agent-api";

export default function AgentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await agentFetch<{ accessToken: string }>("/support/agent/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setAgentToken(res.accessToken);
      router.replace("/agent");
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3"><Headphones className="w-6 h-6" /></div>
          <h1 className="text-xl font-bold">Support Agent Login</h1>
          <p className="text-sm text-muted-foreground mt-1">TradieJet customer service team</p>
        </div>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
