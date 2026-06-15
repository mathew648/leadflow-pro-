"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Phone, Navigation, Play, CheckCircle2, Camera, Plus,
  Loader2, Clock, MapPin, Square, X, Star,
} from "lucide-react";
import { api } from "@/lib/api";
import { uploadJobPhoto, getCurrentPosition } from "@/lib/upload";
import { cn, statusColor, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function elapsed(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FieldJobPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const [signoffName, setSignoffName] = useState("");
  const [satisfaction, setSatisfaction] = useState(0);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [material, setMaterial] = useState({ name: "", quantity: 1, unitPriceCents: 0 });
  const [, forceTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: job, isLoading } = useQuery({
    queryKey: ["field", "job", id],
    queryFn: () => api.get<any>(`/jobs/${id}`),
  });

  // Live timer refresh while in progress
  useEffect(() => {
    if (job?.status !== "in_progress") return;
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [job?.status]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["field", "job", id] });

  const startMutation = useMutation({
    mutationFn: async () => {
      const pos = await getCurrentPosition();
      return api.post(`/jobs/${id}/start`, { latitude: pos?.latitude, longitude: pos?.longitude });
    },
    onSuccess: () => { toast({ title: "Job started" }); refresh(); },
    onError: (e: any) => toast({ title: "Couldn't start job", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const pos = await getCurrentPosition();
      return api.post(`/jobs/${id}/complete`, {
        completionNotes: completionNotes || undefined,
        customerSignoffName: signoffName || undefined,
        customerSatisfaction: satisfaction || undefined,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      });
    },
    onSuccess: () => {
      toast({ title: "Job completed 🎉" });
      setShowComplete(false);
      refresh();
    },
    onError: (e: any) => toast({ title: "Couldn't complete job", description: e.message, variant: "destructive" }),
  });

  const toggleChecklist = useMutation({
    mutationFn: ({ checklistId, itemId, checked }: { checklistId: string; itemId: string; checked: boolean }) =>
      api.patch(`/jobs/${id}/checklists/${checklistId}/items/${itemId}`, { checked }),
    onSuccess: refresh,
  });

  const addMaterialMutation = useMutation({
    mutationFn: () =>
      api.post(`/jobs/${id}/materials`, {
        name: material.name,
        quantity: Number(material.quantity),
        unitPriceCents: Math.round(Number(material.unitPriceCents)),
      }),
    onSuccess: () => {
      toast({ title: "Material added" });
      setShowAddMaterial(false);
      setMaterial({ name: "", quantity: 1, unitPriceCents: 0 });
      refresh();
    },
    onError: (e: any) => toast({ title: "Couldn't add material", description: e.message, variant: "destructive" }),
  });

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadJobPhoto(file, id);
      toast({ title: "Photo uploaded" });
      refresh();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!job) {
    return <div className="p-6 text-center text-gray-500">Job not found.</div>;
  }

  const customer = job.customer;
  const customerName = customer
    ? customer.companyName || `${customer.firstName} ${customer.lastName ?? ""}`.trim()
    : "—";
  const address = job.property
    ? [job.property.streetAddress, job.property.suburb, job.property.state, job.property.postcode].filter(Boolean).join(", ")
    : "";
  const canStart = ["pending", "scheduled", "dispatched"].includes(job.status);
  const isRunning = job.status === "in_progress";
  const isDone = job.status === "completed";

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 pb-32">
      <Link href="/field" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500">
        <ArrowLeft className="h-4 w-4" /> My Day
      </Link>

      <div className="mb-4">
        <span className={cn("text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full", statusColor(job.status))}>
          {job.status.replace(/_/g, " ")}
        </span>
        <h1 className="mt-2 text-xl font-bold text-gray-900">{job.title}</h1>
        <p className="text-sm text-gray-500">#{job.jobNumber}</p>
        {isRunning && job.actualStart && (
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-amber-600">
            <Clock className="h-4 w-4" /> On site {elapsed(job.actualStart)}
          </p>
        )}
      </div>

      {/* Customer contact card */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="font-semibold text-gray-900">{customerName}</p>
        {address && (
          <p className="mt-1 flex items-start gap-1 text-sm text-gray-500">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5" /> {address}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={customer?.phone ? `tel:${customer.phone}` : undefined}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold",
              customer?.phone ? "border-gray-200 text-gray-700 active:bg-gray-50" : "border-gray-100 text-gray-300 pointer-events-none"
            )}
          >
            <Phone className="h-4 w-4" /> Call
          </a>
          <a
            href={address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold",
              address ? "border-gray-200 text-gray-700 active:bg-gray-50" : "border-gray-100 text-gray-300 pointer-events-none"
            )}
          >
            <Navigation className="h-4 w-4" /> Navigate
          </a>
        </div>
      </div>

      {job.description && (
        <div className="mb-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{job.description}</div>
      )}

      {/* Checklists */}
      {job.checklists?.map((cl: any) => (
        <div key={cl.id} className="mb-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{cl.name}</h2>
          <div className="space-y-2">
            {cl.items.map((item: any) => (
              <button
                key={item.id}
                disabled={isDone}
                onClick={() => toggleChecklist.mutate({ checklistId: cl.id, itemId: item.id, checked: !item.checked })}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left active:bg-gray-50 disabled:opacity-60"
              >
                <span className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
                  item.checked ? "border-green-600 bg-green-600 text-white" : "border-gray-300"
                )}>
                  {item.checked && <CheckCircle2 className="h-4 w-4" />}
                </span>
                <span className={cn("text-sm", item.checked ? "text-gray-400 line-through" : "text-gray-800")}>
                  {item.label}
                  {item.isRequired && !item.checked && <span className="ml-1 text-red-500">*</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Photos */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Photos</h2>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1 text-sm font-semibold text-blue-600 active:text-blue-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Add
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" aria-label="Take job photo" />
        </div>
        {job.photos?.length ? (
          <div className="grid grid-cols-3 gap-2">
            {job.photos.map((p: any) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt={p.caption ?? "Job photo"} className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
            No photos yet. Tap “Add” to capture one.
          </p>
        )}
      </div>

      {/* Materials */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Materials used</h2>
          {!isDone && (
            <button onClick={() => setShowAddMaterial(true)} className="flex items-center gap-1 text-sm font-semibold text-blue-600 active:text-blue-700">
              <Plus className="h-4 w-4" /> Add
            </button>
          )}
        </div>
        {job.materials?.length ? (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {job.materials.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 text-sm">
                <span className="text-gray-800">{m.name} <span className="text-gray-400">× {Number(m.quantity)}</span></span>
                <span className="font-medium text-gray-700">{formatCurrency(m.totalPriceCents ?? 0)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
            No materials logged.
          </p>
        )}
      </div>

      {/* Primary action — fixed bottom bar */}
      {!isDone && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white p-4">
          <div className="mx-auto max-w-2xl">
            {canStart ? (
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white active:bg-blue-700 disabled:opacity-60"
              >
                {startMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} Start Job
              </button>
            ) : isRunning ? (
              <button
                onClick={() => setShowComplete(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-base font-semibold text-white active:bg-green-700"
              >
                <Square className="h-5 w-5" /> Complete Job
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Add material sheet */}
      {showAddMaterial && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={() => setShowAddMaterial(false)}>
          <div className="w-full max-w-2xl rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add material</h3>
              <button type="button" aria-label="Close" onClick={() => setShowAddMaterial(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Item name"
                value={material.name}
                onChange={(e) => setMaterial({ ...material, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Quantity</label>
                  <input
                    type="number" inputMode="decimal" min={0} step="0.1" aria-label="Quantity"
                    value={material.quantity}
                    onChange={(e) => setMaterial({ ...material, quantity: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Unit price ($)</label>
                  <input
                    type="number" inputMode="decimal" min={0} step="0.01" aria-label="Unit price in dollars"
                    value={material.unitPriceCents ? material.unitPriceCents / 100 : ""}
                    onChange={(e) => setMaterial({ ...material, unitPriceCents: Math.round(Number(e.target.value) * 100) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
                  />
                </div>
              </div>
              <button
                onClick={() => addMaterialMutation.mutate()}
                disabled={!material.name || addMaterialMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50"
              >
                {addMaterialMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Add material
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion sheet */}
      {showComplete && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={() => setShowComplete(false)}>
          <div className="w-full max-w-2xl rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Complete job</h3>
              <button type="button" aria-label="Close" onClick={() => setShowComplete(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Completion notes</label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="What was done…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Customer sign-off name</label>
                <input
                  value={signoffName}
                  onChange={(e) => setSignoffName(e.target.value)}
                  placeholder="Who signed off"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Customer satisfaction</label>
                <div className="mt-1 flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`} onClick={() => setSatisfaction(n)}>
                      <Star className={cn("h-8 w-8", n <= satisfaction ? "fill-amber-400 text-amber-400" : "text-gray-300")} />
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-base font-semibold text-white active:bg-green-700 disabled:opacity-60"
              >
                {completeMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Mark complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
