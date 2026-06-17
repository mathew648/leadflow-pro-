"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Branding {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  suburb: string | null;
  formKey: string;
}

export default function QuoteRequestPage() {
  const params = useParams();
  const slug = String(params?.slug ?? "");

  const [state, setState] = useState<"loading" | "ready" | "notfound" | "done">("loading");
  const [biz, setBiz] = useState<Branding | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ firstName: "", phone: "", email: "", serviceRequired: "", message: "", companyWebsite: "" });

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/public/lead-page/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setBiz(j.data ?? j); setState("ready"); })
      .catch(() => setState("notfound"));
  }, [slug]);

  const color = biz?.primaryColor ?? "#2563EB";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!biz || form.companyWebsite) return; // honeypot
    if (!form.firstName.trim() || (!form.phone.trim() && !form.email.trim())) return;
    setSubmitting(true);
    try {
      await fetch(`/api/v1/webhooks/forms/${biz.formKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          phone: form.phone,
          email: form.email,
          serviceRequired: form.serviceRequired,
          message: form.message,
        }),
      });
      setState("done");
    } catch {
      setSubmitting(false);
      alert("Sorry, something went wrong. Please try again.");
    }
  }

  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading…</div>;
  }
  if (state === "notfound") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 text-center">
        <p className="text-gray-500">This quote page isn&apos;t available.</p>
      </div>
    );
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-[15px] focus:outline-none focus:ring-2";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          {biz?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={biz.logoUrl} alt={biz.businessName} className="h-12 mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold" style={{ background: color }}>
              {biz?.businessName?.[0] ?? "?"}
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{biz?.businessName}</h1>
          {biz?.suburb && <p className="text-sm text-gray-500">{biz.suburb}</p>}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          {state === "done" ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white text-2xl mb-4" style={{ background: color }}>✓</div>
              <h2 className="text-lg font-semibold">Thanks{form.firstName ? `, ${form.firstName}` : ""}!</h2>
              <p className="mt-1.5 text-sm text-gray-600">We&apos;ve got your request and will be in touch shortly.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3.5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Request a quote</h2>
                <p className="text-sm text-gray-500">Fill in your details and we&apos;ll get back to you fast.</p>
              </div>
              <input className={inputCls} style={{ ["--tw-ring-color" as any]: color }} placeholder="Your name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <input className={inputCls} style={{ ["--tw-ring-color" as any]: color }} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className={inputCls} style={{ ["--tw-ring-color" as any]: color }} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className={inputCls} style={{ ["--tw-ring-color" as any]: color }} placeholder="What do you need? (e.g. switchboard upgrade)" value={form.serviceRequired} onChange={(e) => setForm({ ...form, serviceRequired: e.target.value })} />
              <textarea className={inputCls} style={{ ["--tw-ring-color" as any]: color }} rows={3} placeholder="Any details (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              {/* honeypot */}
              <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" aria-label="Leave this field blank" placeholder="Leave blank" value={form.companyWebsite} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} />
              <button type="submit" disabled={submitting} className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-60" style={{ background: color }}>
                {submitting ? "Sending…" : "Send request"}
              </button>
              <p className="text-center text-[11px] text-gray-400 pt-1">You&apos;ll get a reply by phone, text or email.</p>
            </form>
          )}
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-4">Powered by TradieJet</p>
      </div>
    </div>
  );
}
