"use client";
// Lightweight API client for the support-agent portal. Uses a separate token in
// localStorage (agents log in independently of tradie users).

const KEY = "tj_agent_token";

export function getAgentToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}
export function setAgentToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(KEY, t);
  else localStorage.removeItem(KEY);
}

export async function agentFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAgentToken();
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`/api/v1${path}`, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    setAgentToken(null);
    if (typeof window !== "undefined" && !path.includes("/login")) window.location.href = "/agent/login";
    throw new Error("Session expired");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error?.message ?? "Request failed");
  return ((json as any)?.data ?? json) as T;
}
