"use client";
import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Phone, Mail, Zap } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

async function fetchPortal(token: string) {
  const res = await fetch(`${API_BASE}/quotes/portal/${token}`);
  if (!res.ok) throw new Error("Quote not found");
  return res.json();
}

async function approvePortal(token: string, body: object) {
  const res = await fetch(`${API_BASE}/quotes/portal/${token}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Could not approve quote");
  }
  return res.json();
}

async function rejectPortal(token: string, body: object) {
  const res = await fetch(`${API_BASE}/quotes/portal/${token}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Could not reject quote");
  return res.json();
}

function SignaturePad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    drawing.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function stop() {
    drawing.current = false;
    const canvas = canvasRef.current!;
    onSave(canvas.toDataURL());
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSave("");
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={120}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair bg-white touch-none"
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
      />
      <button type="button" onClick={clear} className="mt-1 text-xs text-muted-foreground hover:text-foreground underline">
        Clear signature
      </button>
    </div>
  );
}

export default function QuotePortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"view" | "approve" | "reject" | "done-approved" | "done-rejected">("view");
  const [name, setName] = useState("");
  const [sig, setSig] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchPortal(token)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove() {
    if (!name.trim()) { setSubmitError("Please enter your full name"); return; }
    if (!sig) { setSubmitError("Please draw your signature"); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await approvePortal(token, { approvedByName: name, signature: sig, selectedOptionals: [] });
      setStep("done-approved");
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    setSubmitError("");
    try {
      await rejectPortal(token, { reason: rejectReason || undefined });
      setStep("done-rejected");
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const quote = data;
  const tenant = quote?.tenant;
  const brandColor = tenant?.primaryColor ?? "#3B82F6";
  const lineItems = quote?.lineItems ?? [];
  const optional = lineItems.filter((li: any) => li.isOptional);
  const required = lineItems.filter((li: any) => !li.isOptional);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading quote…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="font-semibold text-lg mb-1">Quote not found</h2>
          <p className="text-gray-500 text-sm">This link may have expired or already been actioned.</p>
        </div>
      </div>
    );
  }

  if (step === "done-approved") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="font-bold text-xl mb-2">Quote Approved!</h2>
          <p className="text-gray-600 text-sm">
            Thank you, {name}. We'll be in touch shortly to schedule the work.
          </p>
          {tenant?.phone && (
            <a href={`tel:${tenant.phone}`} className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Phone className="w-4 h-4" /> Call us: {tenant.phone}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (step === "done-rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center">
          <XCircle className="w-14 h-14 text-gray-400 mx-auto mb-4" />
          <h2 className="font-bold text-xl mb-2">Quote Declined</h2>
          <p className="text-gray-600 text-sm">We've received your response. Feel free to contact us if you'd like to discuss further.</p>
          {tenant?.phone && (
            <a href={`tel:${tenant.phone}`} className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Phone className="w-4 h-4" /> {tenant.phone}
            </a>
          )}
        </div>
      </div>
    );
  }

  const isActionable = ["sent", "viewed"].includes(quote.status);
  const isAlreadyActioned = ["approved", "rejected", "expired"].includes(quote.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.businessName} className="h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: brandColor }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-semibold text-sm">{tenant?.businessName}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Hero card */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-gray-500 mb-1">Quote {quote.quoteNumber}</p>
              <h1 className="text-xl font-bold text-gray-900">{quote.title}</h1>
              {quote.description && <p className="text-gray-600 text-sm mt-1">{quote.description}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(quote.totalCents)}</p>
              {quote.depositPercent > 0 && (
                <p className="text-sm text-gray-500">
                  Deposit: {formatCurrency(Math.round(quote.totalCents * quote.depositPercent / 100))} ({quote.depositPercent}%)
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t text-sm">
            <div>
              <p className="text-xs text-gray-500">Prepared for</p>
              <p className="font-medium">{quote.customer?.firstName} {quote.customer?.lastName}</p>
            </div>
            {quote.validUntil && (
              <div>
                <p className="text-xs text-gray-500">Valid until</p>
                <p className="font-medium">{formatDate(quote.validUntil)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="font-medium capitalize">{quote.status}</p>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-sm">Quote Details ({required.length} item{required.length !== 1 ? "s" : ""})</span>
            {showDetails ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showDetails && (
            <div className="border-t">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium text-gray-500 text-xs">Description</th>
                    <th className="text-right px-5 py-2.5 font-medium text-gray-500 text-xs hidden sm:table-cell">Qty</th>
                    <th className="text-right px-5 py-2.5 font-medium text-gray-500 text-xs">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {required.map((li: any, i: number) => (
                    <tr key={i}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{li.description}</p>
                        {li.unit && <p className="text-xs text-gray-400">{li.unit}</p>}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500 hidden sm:table-cell">{li.quantity}</td>
                      <td className="px-5 py-3 text-right font-medium">{formatCurrency(li.totalCents ?? li.subtotalCents ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-5 py-2 text-right text-sm text-gray-500 hidden sm:table-cell">Subtotal</td>
                    <td className="px-5 py-2 text-right text-sm">{formatCurrency(quote.subtotalCents)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-5 py-2 text-right text-sm text-gray-500 hidden sm:table-cell">GST</td>
                    <td className="px-5 py-2 text-right text-sm">{formatCurrency(quote.gstCents)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={2} className="px-5 py-3 text-right hidden sm:table-cell">Total</td>
                    <td className="px-5 py-3 text-right text-base">{formatCurrency(quote.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Terms */}
        {quote.termsConditions && (
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Terms & Conditions</p>
            <p className="text-sm text-gray-600 whitespace-pre-line">{quote.termsConditions}</p>
          </div>
        )}

        {/* Actions */}
        {isAlreadyActioned ? (
          <div className="bg-white rounded-2xl border shadow-sm p-5 text-center">
            <p className="text-sm text-gray-600">
              This quote has already been <strong className="capitalize">{quote.status}</strong>.
            </p>
          </div>
        ) : isActionable && step === "view" ? (
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
            <p className="text-sm text-gray-700 font-medium text-center">Ready to proceed?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("reject")}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => setStep("approve")}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ background: brandColor }}
              >
                Approve Quote
              </button>
            </div>
          </div>
        ) : step === "approve" ? (
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <h3 className="font-semibold">Approve Quote</h3>
            <div>
              <label className="text-xs font-medium text-gray-500">Full Name *</label>
              <input
                type="text"
                autoFocus
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-0.5 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": brandColor } as any}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Signature * — draw below</label>
              <div className="mt-0.5">
                <SignaturePad onSave={setSig} />
              </div>
            </div>
            {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep("view")}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-colors"
                style={{ background: brandColor }}
              >
                {submitting ? "Approving…" : "Confirm Approval"}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              By approving you agree to proceed with the quoted work on the terms stated above.
            </p>
          </div>
        ) : step === "reject" ? (
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <h3 className="font-semibold">Decline Quote</h3>
            <div>
              <label className="text-xs font-medium text-gray-500">Reason (optional)</label>
              <textarea
                placeholder="Let us know why — we'd love to help find a solution"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full mt-0.5 px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none"
              />
            </div>
            {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("view")}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {submitting ? "Declining…" : "Decline Quote"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-8">
          {tenant?.phone && <p>{tenant.businessName} · {tenant.phone}</p>}
          {tenant?.abn && <p>ABN: {tenant.abn}</p>}
        </div>
      </div>
    </div>
  );
}
