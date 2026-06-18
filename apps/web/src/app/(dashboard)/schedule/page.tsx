"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Clock, User, Calendar } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { api } from "@/lib/api";
import { cn, formatDate, statusColor } from "@/lib/utils";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 7;
const END_HOUR = 19;

function TimeGrid({ jobs, onJobClick }: { jobs: any[]; onJobClick: (id: string) => void }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  function getJobPosition(job: any) {
    if (!job.scheduledStart) return null;
    const start = new Date(job.scheduledStart);
    const end = job.scheduledEnd ? new Date(job.scheduledEnd) : new Date(start.getTime() + 60 * 60000);
    const startMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const durationMins = (end.getTime() - start.getTime()) / 60000;
    return {
      top: (startMins / 60) * HOUR_HEIGHT,
      height: Math.max((durationMins / 60) * HOUR_HEIGHT, 30),
      startTime: start.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }),
    };
  }

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="flex">
        {/* Time axis — inline height is required for pixel-perfect time grid positioning */}
        <div className="w-16 flex-shrink-0">
          {hours.map((h) => (
            // eslint-disable-next-line react/forbid-dom-props
            <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
              <span className="absolute -top-2.5 right-2 text-xs text-muted-foreground">
                {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 relative border-l">
          {hours.map((h) => (
            // eslint-disable-next-line react/forbid-dom-props
            <div key={h} className="border-t border-dashed border-gray-100" style={{ height: HOUR_HEIGHT }} />
          ))}

          {/* Events */}
          {jobs.map((job) => {
            const pos = getJobPosition(job);
            if (!pos) return null;
            return (
              <button
                key={job.id}
                type="button"
                title={job.title}
                onClick={() => onJobClick(job.id)}
                // eslint-disable-next-line react/forbid-dom-props
                style={{ top: pos.top, height: pos.height }}
                className="absolute left-2 right-2 rounded-lg p-2 text-xs overflow-hidden cursor-pointer hover:opacity-90 transition-opacity text-left bg-blue-500 text-white"
              >
                <p className="font-semibold truncate">{job.title}</p>
                <p className="opacity-80 truncate">{job.customer?.firstName} {job.customer?.lastName}</p>
                {job.property && <p className="opacity-70 truncate flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{job.property.suburb}</p>}
                <p className="opacity-80">{pos.startTime}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const dateStr = formatDateKey(selectedDate);
  const nextDay = formatDateKey(addDays(selectedDate, 1));

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ["schedule", dateStr],
    queryFn: () => api.get<any[]>(`/schedule?from=${dateStr}&to=${dateStr}`),
    refetchInterval: 60000,
  });

  const { data: dispatchData } = useQuery({
    queryKey: ["dispatch", dateStr],
    queryFn: () => api.get<any>(`/jobs/dispatch?date=${dateStr}`),
    refetchInterval: 30000,
  });

  const jobs = scheduleData ?? [];
  const unscheduled = dispatchData?.unassigned ?? [];
  const technicians = dispatchData?.technicians ?? [];

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Schedule & Dispatch" />

      {/* Date picker */}
      <div className="flex items-center gap-4 px-4 lg:px-6 py-3 border-b bg-white">
        <button
          type="button"
          title="Previous day"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold">
            {selectedDate.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className="text-xs text-muted-foreground">{jobs.length} job{jobs.length !== 1 ? "s" : ""} scheduled</p>
        </div>
        <button
          type="button"
          title="Next day"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setSelectedDate(new Date())}
          className="ml-auto text-xs text-primary hover:underline"
        >
          Today
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main timeline */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <div className="bg-white rounded-xl border flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Loading schedule…
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Calendar className="w-12 h-12 opacity-20" />
                <div className="text-center">
                  <p className="font-medium">No jobs scheduled</p>
                  <p className="text-sm">Drag unscheduled jobs from the right panel</p>
                </div>
              </div>
            ) : (
              <TimeGrid jobs={jobs} onJobClick={(id) => router.push(`/jobs/${id}`)} />
            )}
          </div>
        </div>

        {/* Right panel — technicians & unscheduled (hidden on mobile to give the calendar full width) */}
        <div className="w-72 border-l bg-gray-50 flex-col overflow-hidden hidden lg:flex">
          {/* Technicians */}
          <div className="p-4 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Technicians</p>
            <div className="space-y-2">
              {technicians.slice(0, 8).map((tech: any) => (
                <div key={tech.id} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {tech.firstName[0]}{tech.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tech.firstName} {tech.lastName}</p>
                    <p className="text-xs text-muted-foreground">{tech.jobs?.length ?? 0} jobs today</p>
                  </div>
                  <div className={cn("w-2 h-2 rounded-full ml-auto flex-shrink-0",
                    tech.currentLocation ? "bg-green-500" : "bg-gray-300")} />
                </div>
              ))}
            </div>
          </div>

          {/* Unscheduled */}
          <div className="flex-1 p-4 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Unscheduled ({unscheduled.length})
            </p>
            <div className="space-y-2">
              {unscheduled.map((job: any) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="w-full text-left bg-white rounded-lg border p-3 text-sm cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all"
                >
                  <p className="font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {job.customer?.firstName} {job.customer?.lastName}
                  </p>
                  {job.property && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {job.property.suburb}
                    </p>
                  )}
                </button>
              ))}
              {unscheduled.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">All caught up!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
