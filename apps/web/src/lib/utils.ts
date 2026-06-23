import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
}

export function formatDate(date: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", opts ?? { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function formatRelative(date: string | Date): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = now - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  return `${(firstName ?? "")[0] ?? ""}${(lastName ?? "")[0] ?? ""}`.toUpperCase();
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    scheduled: "bg-blue-100 text-blue-800",
    dispatched: "bg-indigo-100 text-indigo-800",
    in_progress: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-600",
    on_hold: "bg-orange-100 text-orange-800",
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    expired: "bg-red-100 text-red-800",
    paid: "bg-green-100 text-green-800",
    partial: "bg-yellow-100 text-yellow-800",
    overdue: "bg-red-100 text-red-800",
    won: "bg-green-100 text-green-800",
    lost: "bg-red-100 text-red-800",
    converted: "bg-teal-100 text-teal-800",
    new: "bg-gray-100 text-gray-700",
    trialing: "bg-brand-100 text-brand-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    emergency: "text-red-600",
    high: "text-orange-600",
    normal: "text-gray-600",
    low: "text-blue-600",
  };
  return map[priority] ?? "text-gray-600";
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "…" : str;
}
