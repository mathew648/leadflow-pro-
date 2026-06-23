"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, Clock, AlertCircle, CreditCard, Zap, Phone, Mail, Banknote, Loader2, Paperclip } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

async function fetchPortal(token: string) {
  const res = await fetch(`${API_BASE}/invoices/portal/${token}`);
  if (!res.ok) throw new Error("Invoice not found");
  return res.json();
}

async function uploadReceipt(token: string, file: File): Promise<string> {
  const r = await fetch(`${API_BASE}/invoices/portal/${token}/receipt-url`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? "Could not upload receipt");
  await fetch(j.data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  return j.data.fileUrl as string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  draft:   { label: "Draft",   color: "text-gray-600",  bg: "bg-gray-100",   icon: Clock },
  sent:    { label: "Sent",    color: "text-blue-600",  bg: "bg-blue-100",   icon: Clock },
  viewed:  { label: "Viewed",  color: "text-blue-600",  bg: "bg-blue-100",   icon: Clock },
  partial: { label: "Partial", color: "text-yellow-700",bg: "bg-yellow-100", icon: AlertCircle },
  paid:    { label: "Paid",    color: "text-green-700", bg: "bg-green-100",  icon: CheckCircle },
  overdue: { label: "Overdue", color: "text-red-600",   bg: "bg-red-100",    icon: AlertCircle },
};

export default function InvoicePayPortal() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("paid") === "1";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showItems, setShowItems] = useState(false);

  // Payment UI state
  const [cardLoading, setCardLoading] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankRef, setBankRef] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    fetchPortal(token)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const payByCard = async () => {
    setPayError(""); setCardLoading(true);
    try {
      const r = await fetch(`${API_BASE}/invoices/portal/${token}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Could not start card payment");
      window.location.href = j.data.url;
    } catch (e: any) { setPayError(e.message); setCardLoading(false); }
  };

  const submitBank = async () => {
    setPayError(""); setSubmitting(true);
    try {
      let receiptUrl: string | undefined;
      if (receiptFile) receiptUrl = await uploadReceipt(token, receiptFile);
      const r = await fetch(`${API_BASE}/invoices/portal/${token}/mark-paid`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: bankRef || undefined, receiptUrl }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Could not submit payment");
      setSubmitted(true);
    } catch (e: any) { setPayError(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading invoice…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="font-semibold text-lg mb-1">Invoice not found</h2>
          <p className="text-gray-500 text-sm">This link may have expired or is no longer valid.</p>
        </div>
      </div>
    );
  }

  const invoice = data;
  const tenant = invoice?.tenant;
  const brandColor = tenant?.primaryColor ?? "#3B82F6";
  const statusCfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.sent;
  const StatusIcon = statusCfg.icon;
  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";
  const allPayments = invoice.payments ?? [];
  const paidCents = allPayments.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + p.amountCents, 0);
  const pendingPayment = allPayments.find((p: any) => p.status === "pending");
  const awaitingApproval = submitted || !!pendingPayment;
  const lineItems = invoice.lineItems ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status banner */}
        {isPaid && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900 text-sm">Invoice Paid — Thank you!</p>
              <p className="text-green-700 text-xs">Payment of {formatCurrency(paidCents)} received.</p>
            </div>
          </div>
        )}
        {isOverdue && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900 text-sm">Payment Overdue</p>
              <p className="text-red-700 text-xs">Please arrange payment as soon as possible.</p>
            </div>
          </div>
        )}

        {/* Invoice hero */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-1">Invoice {invoice.invoiceNumber}</p>
              <p className="text-sm text-gray-600">
                For: {invoice.customer?.firstName} {invoice.customer?.lastName}
              </p>
              {invoice.customer?.companyName && (
                <p className="text-xs text-gray-400">{invoice.customer.companyName}</p>
              )}
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusCfg.bg} ${statusCfg.color}`}>
              <StatusIcon className="w-4 h-4" />
              {statusCfg.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t text-sm">
            <div>
              <p className="text-xs text-gray-500">Issue Date</p>
              <p className="font-medium">{formatDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Due Date</p>
              <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>
                {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
              </p>
            </div>
          </div>

          {/* Amount summary */}
          <div className="mt-5 pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotalCents)}</span>
            </div>
            {invoice.discountCents > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600">
              <span>GST</span>
              <span>{formatCurrency(invoice.gstCents)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
              <span>Total</span>
              <span>{formatCurrency(invoice.totalCents)}</span>
            </div>
            {paidCents > 0 && paidCents < invoice.totalCents && (
              <>
                <div className="flex justify-between text-sm text-green-700">
                  <span>Paid</span>
                  <span>-{formatCurrency(paidCents)}</span>
                </div>
                <div className="flex justify-between font-bold text-red-600 text-base border-t pt-2">
                  <span>Amount Due</span>
                  <span>{formatCurrency(invoice.amountDueCents)}</span>
                </div>
              </>
            )}
            {isPaid && (
              <div className="flex justify-between font-medium text-green-700 text-sm border-t pt-2">
                <span>Amount Due</span>
                <span>$0.00 ✓</span>
              </div>
            )}
          </div>
        </div>

        {/* Line items (collapsible) */}
        {lineItems.length > 0 && (
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowItems((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 text-sm font-medium"
            >
              <span>View {lineItems.length} line item{lineItems.length !== 1 ? "s" : ""}</span>
              <span className="text-gray-400">{showItems ? "▲" : "▼"}</span>
            </button>
            {showItems && (
              <table className="w-full text-sm border-t">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2 text-xs font-medium text-gray-500">Description</th>
                    <th className="text-right px-5 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Qty</th>
                    <th className="text-right px-5 py-2 text-xs font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lineItems.map((li: any, i: number) => (
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
              </table>
            )}
          </div>
        )}

        {/* "just returned from Stripe" notice */}
        {justPaid && !isPaid && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-900">Your card payment is being confirmed. This page will update shortly.</p>
          </div>
        )}

        {/* Payment received, awaiting approval */}
        {!isPaid && awaitingApproval && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 text-sm">Payment submitted — awaiting confirmation</p>
              <p className="text-amber-700 text-xs">We've let {tenant?.businessName} know. They'll confirm your bank transfer shortly.</p>
            </div>
          </div>
        )}

        {/* Payment section */}
        {!isPaid && !awaitingApproval && (
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-sm">Pay {formatCurrency(invoice.amountDueCents)}</h3>

            {payError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{payError}</p>}

            {/* Pay by card — only when the business has connected their own Stripe */}
            {invoice.cardEnabled && (
              <>
                <button
                  type="button"
                  onClick={payByCard}
                  disabled={cardLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-white font-semibold text-sm disabled:opacity-60"
                  style={{ background: brandColor }}
                >
                  {cardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Pay securely by card
                </button>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <div className="flex-1 h-px bg-gray-200" /> or <div className="flex-1 h-px bg-gray-200" />
                </div>
              </>
            )}

            {/* Pay by bank transfer */}
            {!bankOpen ? (
              <button
                type="button"
                onClick={() => setBankOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 border font-semibold text-sm hover:bg-gray-50"
              >
                <Banknote className="w-4 h-4" /> I've paid by bank transfer
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border p-4 bg-gray-50">
                {(invoice.termsConditions || tenant?.invoiceFooterText) && (
                  <div className="text-xs text-gray-600 whitespace-pre-line bg-white rounded-lg p-3 border">
                    {invoice.termsConditions ?? tenant?.invoiceFooterText}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Use invoice <strong>{invoice.invoiceNumber}</strong> as your reference, then let us know below.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bank reference (optional)</label>
                  <input
                    type="text"
                    value={bankRef}
                    onChange={(e) => setBankRef(e.target.value)}
                    placeholder={invoice.invoiceNumber}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Attach receipt (optional)</label>
                  <label className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white cursor-pointer hover:bg-gray-50">
                    <Paperclip className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 truncate">{receiptFile ? receiptFile.name : "Choose a file (JPG, PNG, PDF)"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={submitBank}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-white font-semibold text-sm disabled:opacity-60"
                  style={{ background: brandColor }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Submit payment for confirmation
                </button>
              </div>
            )}
          </div>
        )}

        {/* Payment history */}
        {allPayments.filter((p: any) => p.status === "completed").length > 0 && (
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <h3 className="font-semibold text-sm mb-3">Payment History</h3>
            <div className="divide-y">
              {allPayments.filter((p: any) => p.status === "completed").map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{formatDate(p.paidAt)}</p>
                    <p className="text-xs text-gray-400 capitalize">{(p.paymentMethod ?? p.paymentGateway ?? "").replace(/_/g, " ")}</p>
                  </div>
                  <span className="font-semibold text-green-700">{formatCurrency(p.amountCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact footer */}
        <div className="text-center text-xs text-gray-400 pb-8 space-y-1">
          <p className="font-medium text-gray-500">{tenant?.businessName}</p>
          {tenant?.abn && <p>ABN: {tenant.abn}</p>}
          <div className="flex items-center justify-center gap-4">
            {tenant?.phone && (
              <a href={`tel:${tenant.phone}`} className="flex items-center gap-1 hover:text-gray-600">
                <Phone className="w-3 h-3" /> {tenant.phone}
              </a>
            )}
            {tenant?.email && (
              <a href={`mailto:${tenant.email}`} className="flex items-center gap-1 hover:text-gray-600">
                <Mail className="w-3 h-3" /> {tenant.email}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
