"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  MapPin, Phone, Clock, ChevronRight, CheckCircle2, Loader2, CalendarDays, Menu,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore, useUIStore } from "@/lib/store";
import { cn, statusColor, priorityColor } from "@/lib/utils";

interface FieldJob {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  priority: string;
  scheduledStart: string | null;
  customer?: { firstName: string; lastName: string | null; companyName: string | null; phone: string | null };
  property?: { streetAddress: string; suburb: string | null; state: string | null; postcode: string | null } | null;
}

function fullAddress(p?: FieldJob["property"]): string {
  if (!p) return "";
  return [p.streetAddress, p.suburb, p.state, p.postcode].filter(Boolean).join(", ");
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function timeLabel(iso: string | null): string {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}

function JobCard({ job }: { job: FieldJob }) {
  const address = fullAddress(job.property);
  const customerName = job.customer
    ? job.customer.companyName || `${job.customer.firstName} ${job.customer.lastName ?? ""}`.trim()
    : "—";

  return (
    <Link
      href={`/field/jobs/${job.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full", statusColor(job.status))}>
              {job.status.replace(/_/g, " ")}
            </span>
            {job.priority === "emergency" || job.priority === "high" ? (
              <span className={cn("text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full", priorityColor(job.priority))}>
                {job.priority}
              </span>
            ) : null}
          </div>
          <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
          <p className="text-sm text-gray-500 truncate">{customerName}</p>
          {address ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{address}</span>
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-1 text-sm font-medium text-gray-700">
            <Clock className="h-3.5 w-3.5 shrink-0" /> {timeLabel(job.scheduledStart)}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 shrink-0 mt-1" />
      </div>
    </Link>
  );
}

export default function FieldHomePage() {
  const user = useAuthStore((s) => s.user);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  // Technicians see only the jobs assigned to them; owners/admins/managers (incl. solo
  // traders, who rarely "assign" jobs to themselves) see all active jobs.
  const isTech = user?.role === "technician";
  const { data, isLoading } = useQuery({
    queryKey: ["field", "my-jobs", user?.id, user?.role],
    queryFn: () => api.get<FieldJob[]>(isTech ? `/jobs?userId=${user!.id}&limit=100` : `/jobs?limit=100`),
    enabled: !!user?.id,
  });

  const jobs = Array.isArray(data) ? data : ((data as any)?.data ?? []);
  const active = jobs.filter((j) => !["completed", "cancelled"].includes(j.status));
  const today = active.filter((j) => isToday(j.scheduledStart));
  const upcoming = active.filter((j) => !isToday(j.scheduledStart));
  const completedToday = jobs.filter((j) => j.status === "completed" && isToday(j.scheduledStart));
  const inProgress = jobs.filter((j) => j.status === "in_progress").length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden -ml-1 p-2 rounded-lg hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hi {user?.firstName ?? "there"} 👋
        </h1>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{today.length}</p>
          <p className="text-xs font-medium text-blue-600">Today</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{inProgress}</p>
          <p className="text-xs font-medium text-amber-600">In progress</p>
        </div>
        <div className="rounded-xl bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{completedToday.length}</p>
          <p className="text-xs font-medium text-green-600">Done today</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <section className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              <CalendarDays className="h-4 w-4" /> Today
            </h2>
            {today.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                No jobs scheduled for today.
              </p>
            ) : (
              <div className="space-y-3">
                {today.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            )}
          </section>

          {upcoming.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            </section>
          )}

          {completedToday.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                <CheckCircle2 className="h-4 w-4" /> Completed today
              </h2>
              <div className="space-y-3 opacity-70">
                {completedToday.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
