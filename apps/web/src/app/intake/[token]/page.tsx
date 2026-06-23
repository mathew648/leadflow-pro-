"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, AlertCircle, Loader2, Camera, Zap } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

async function uploadPhoto(token: string, file: File): Promise<string> {
  const r = await fetch(`${API_BASE}/requirements/portal/${token}/photo-url`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? "Could not upload photo");
  await fetch(j.data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  return j.data.fileUrl as string;
}

export default function IntakePortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [details, setDetails] = useState("");
  const [timing, setTiming] = useState("");
  const [budget, setBudget] = useState("");
  const [access, setAccess] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/requirements/portal/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("This link is no longer valid.")))
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    setFormError("");
    if (!details.trim()) { setFormError("Please describe what you need done."); return; }
    setSubmitting(true);
    try {
      const photoUrls: string[] = [];
      for (const f of files) photoUrls.push(await uploadPhoto(token, f));
      const r = await fetch(`${API_BASE}/requirements/portal/${token}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details, preferredTiming: timing || undefined, budgetText: budget || undefined, accessNotes: access || undefined, photoUrls }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Could not submit");
      setDone(true);
    } catch (e: any) { setFormError(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 text-sm">Loading…</div>;
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="font-semibold text-lg mb-1">Link not found</h2>
        <p className="text-gray-500 text-sm">This link may have expired or already been used.</p>
      </div>
    </div>
  );

  const tenant = data?.tenant;
  const brand = tenant?.primaryColor ?? "#2563EB";
  const alreadyDone = done || data?.status === "submitted" || data?.status === "quoted";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {tenant?.logoUrl
            ? <img src={tenant.logoUrl} alt={tenant.businessName} className="h-8 object-contain" />
            : <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: brand }}><Zap className="w-4 h-4 text-white" /></div>}
          <span className="font-semibold text-sm">{tenant?.businessName}</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {alreadyDone ? (
          <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="font-semibold text-lg mb-1">Thanks{data?.customerName ? `, ${data.customerName}` : ""}!</h2>
            <p className="text-gray-600 text-sm">We've got your details and will be in touch with a quote shortly.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <div>
              <h1 className="font-bold text-lg">Tell us about your job</h1>
              <p className="text-sm text-gray-500">{tenant?.businessName} will use this to prepare your quote.</p>
            </div>

            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}

            <div>
              <label className="block text-sm font-medium mb-1">What do you need done? <span className="text-red-500">*</span></label>
              <textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. Leaking tap in the kitchen, and a blocked drain in the bathroom…"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Add photos <span className="text-gray-400 font-normal">(optional, helps us quote faster)</span></label>
              <label className="flex items-center gap-2 px-3 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-600">
                <Camera className="w-5 h-5 text-gray-400" />
                {files.length ? `${files.length} photo${files.length > 1 ? "s" : ""} selected` : "Take or choose photos"}
                <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 20))} />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">When suits you? <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={timing} onChange={(e) => setTiming(e.target.value)}
                placeholder="e.g. Weekday mornings, ASAP, next week…"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Budget <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. Under $500, flexible…"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Access notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea rows={2} value={access} onChange={(e) => setAccess(e.target.value)}
                placeholder="e.g. Gate code, parking, pets, best entrance…"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>

            <button type="button" onClick={submit} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-white font-semibold text-sm disabled:opacity-60"
              style={{ background: brand }}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Send to {tenant?.businessName ?? "us"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
