"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Config {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  suburb: string | null;
  phone: string | null;
  services: { name: string; durationMin?: number; priceCents?: number }[];
  slotMinutes: number;
  leadTimeHours: number;
  advanceDays: number;
  instructions: string | null;
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function BookingPage() {
  const params = useParams();
  const slug = String(params?.slug ?? "");

  const [state, setState] = useState<"loading" | "ready" | "notfound" | "done">("loading");
  const [cfg, setCfg] = useState<Config | null>(null);
  const [service, setService] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState("");
  const [form, setForm] = useState({ firstName: "", phone: "", email: "", address: "", notes: "", companyWebsite: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmedWhen, setConfirmedWhen] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/public/booking/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setCfg(j.data ?? j); setState("ready"); })
      .catch(() => setState("notfound"));
  }, [slug]);

  // Load slots when date changes
  useEffect(() => {
    if (!slug || !date) { setSlots(null); return; }
    setSlot("");
    fetch(`/api/v1/public/booking/${encodeURIComponent(slug)}/slots?date=${date}`)
      .then((r) => r.json())
      .then((j) => setSlots((j.data ?? j)?.slots ?? []))
      .catch(() => setSlots([]));
  }, [date, slug]);

  const color = cfg?.primaryColor ?? "#2563EB";
  const today = new Date();
  const minDate = new Date(today); minDate.setDate(minDate.getDate() + Math.ceil((cfg?.leadTimeHours ?? 24) / 24));
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + (cfg?.advanceDays ?? 30));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg || form.companyWebsite) return; // honeypot
    if (!form.firstName.trim() || !form.phone.trim() || !date || !slot) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/public/booking/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName, phone: form.phone, email: form.email || undefined,
          service: service || undefined, date, slot, address: form.address || undefined, notes: form.notes || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error();
      setConfirmedWhen(j.data?.when ?? "");
      setState("done");
    } catch {
      setSubmitting(false);
      alert("Sorry, something went wrong. Please try again.");
    }
  }

  if (state === "loading") return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading…</div>;
  if (state === "notfound") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 text-center">
      <p className="text-gray-500">Online booking isn&apos;t available for this business.</p>
    </div>
  );

  const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-[15px] focus:outline-none focus:ring-2";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          {cfg?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.logoUrl} alt={cfg.businessName} className="h-12 mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold" style={{ background: color }}>
              {cfg?.businessName?.[0] ?? "?"}
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{cfg?.businessName}</h1>
          {cfg?.suburb && <p className="text-sm text-gray-500">{cfg.suburb}</p>}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          {state === "done" ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white text-2xl mb-4" style={{ background: color }}>✓</div>
              <h2 className="text-lg font-semibold">Booking requested!</h2>
              <p className="mt-1.5 text-sm text-gray-600">
                Thanks{form.firstName ? `, ${form.firstName}` : ""} — we&apos;ve received your request{confirmedWhen ? ` for ${confirmedWhen}` : ""}. We&apos;ll confirm with you shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3.5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Book an appointment</h2>
                <p className="text-sm text-gray-500">Pick a time and we&apos;ll confirm it with you.</p>
              </div>
              {cfg?.instructions && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{cfg.instructions}</p>}

              {cfg && cfg.services.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Service</label>
                  <select className={inputCls + " mt-1"} style={{ ["--tw-ring-color" as any]: color }} value={service} onChange={(e) => setService(e.target.value)}>
                    <option value="">Select a service…</option>
                    {cfg.services.map((s) => <option key={s.name} value={s.name}>{s.name}{s.priceCents ? ` — $${(s.priceCents / 100).toFixed(0)}` : ""}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Preferred date</label>
                <input className={inputCls + " mt-1"} style={{ ["--tw-ring-color" as any]: color }} type="date" min={isoDate(minDate)} max={isoDate(maxDate)} value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>

              {date && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Available times</label>
                  {slots === null ? (
                    <p className="text-sm text-gray-400 mt-1">Loading…</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-gray-500 mt-1">No times available that day — try another date.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {slots.map((t) => (
                        <button key={t} type="button" onClick={() => setSlot(t)}
                          className="py-2 rounded-lg border text-sm font-medium transition-colors"
                          style={slot === t ? { background: color, color: "#fff", borderColor: color } : {}}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {slot && (
                <>
                  <input className={inputCls} style={{ ["--tw-ring-color" as any]: color }} placeholder="Your name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                  <input className={inputCls} style={{ ["--tw-ring-color" as any]: color }} placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                  <input className={inputCls} style={{ ["--tw-ring-color" as any]: color }} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input className={inputCls} style={{ ["--tw-ring-color" as any]: color }} placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  <textarea className={inputCls} style={{ ["--tw-ring-color" as any]: color }} rows={2} placeholder="Anything we should know? (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" placeholder="Leave blank" value={form.companyWebsite} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} />
                  <button type="submit" disabled={submitting} className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-60" style={{ background: color }}>
                    {submitting ? "Booking…" : "Request this time"}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-4">Powered by TradieJet</p>
      </div>
    </div>
  );
}
