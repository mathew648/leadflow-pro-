"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Send, DollarSign, Download, ExternalLink,
  CheckCircle, Clock, AlertCircle, XCircle, FileText, Paperclip, CreditCard,
} from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  draft:       { label: "Draft",       color: "bg-gray-100 text-gray-700",   Icon: FileText },
  sent:        { label: "Sent",        color: "bg-blue-100 text-blue-700",   Icon: Send },
  viewed:      { label: "Viewed",      color: "bg-purple-100 text-purple-700", Icon: ExternalLink },
  partial:     { label: "Partial",     color: "bg-yellow-100 text-yellow-700", Icon: Clock },
  paid:        { label: "Paid",        color: "bg-green-100 text-green-700", Icon: CheckCircle },
  overdue:     { label: "Overdue",     color: "bg-red-100 text-red-700",     Icon: AlertCircle },
  cancelled:   { label: "Cancelled",  color: "bg-gray-100 text-gray-500",   Icon: XCircle },
  written_off: { label: "Written Off", color: "bg-gray-100 text-gray-500",  Icon: XCircle },
};

const GATEWAY_LABEL: Record<string, string> = {
  stripe: "Stripe", windcave: "Windcave", bank_transfer: "Bank Transfer",
  cash: "Cash", cheque: "Cheque", other: "Other",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentGateway, setPaymentGateway] = useState("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendMessage, setSendMessage] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<any>(`/invoices/${id}`),
  });

  const invoice = (data as any)?.data ?? data;

  // Prompt the tradie to connect Stripe so customers can pay this invoice by card.
  const { data: stripeResp } = useQuery({ queryKey: ["stripe-status"], queryFn: () => api.get<any>("/integrations/stripe/status") });
  const stripe = (stripeResp as any)?.data ?? stripeResp;
  const stripeReady = !!stripe?.connected && !!stripe?.chargesEnabled;
  const connectStripe = useMutation({
    mutationFn: () => api.get<any>("/integrations/stripe/setup"),
    onSuccess: (r: any) => {
      const url = (r?.data ?? r)?.url;
      if (url) window.location.href = url;
      else toast({ title: "Couldn't start Stripe setup", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: e.message ?? "Couldn't start Stripe setup", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      api.post<any>(`/invoices/${id}/send`, {
        email: sendEmail || undefined,
        message: sendMessage || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Invoice sent!" });
      setSendOpen(false);
      qc.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      api.post<any>(`/invoices/${id}/payments`, {
        amountCents: Math.round(Number(paymentAmount) * 100),
        gateway: paymentGateway,
        reference: paymentRef || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Payment recorded!" });
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentRef("");
      qc.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (pid: string) => api.post<any>(`/invoices/${id}/payments/${pid}/approve`, {}),
    onSuccess: () => { toast({ title: "Payment approved — synced to accounting" }); qc.invalidateQueries({ queryKey: ["invoice", id] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const rejectMutation = useMutation({
    mutationFn: (pid: string) => api.post<any>(`/invoices/${id}/payments/${pid}/reject`, {}),
    onSuccess: () => { toast({ title: "Payment claim rejected" }); qc.invalidateQueries({ queryKey: ["invoice", id] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div>
        <Topbar title="Invoice" />
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div>
        <Topbar title="Invoice" />
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-muted-foreground">Invoice not found</p>
          <Button variant="outline" onClick={() => router.push("/invoices")}>Back to Invoices</Button>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.Icon;
  const customer = invoice.customer;
  const customerName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customer?.companyName || "Unknown";
  const paidCents = (invoice.payments ?? []).reduce((s: number, p: any) => s + p.amountCents, 0);
  const isEditable = ["draft"].includes(invoice.status);
  const canSend = ["draft", "sent"].includes(invoice.status);
  const canPay = ["sent", "viewed", "partial", "overdue"].includes(invoice.status);

  const portalUrl = invoice.portalToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${invoice.portalToken}`
    : null;

  return (
    <div>
      <Topbar title={`Invoice ${invoice.invoiceNumber}`} />

      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
        {stripeResp && !stripeReady && invoice.status !== "paid" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">
                {stripe?.connected ? "Finish your Stripe setup to take card payments" : "Connect Stripe to let customers pay by card"}
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                Card payments go straight to your own Stripe account. Until then, customers can still pay by bank transfer.
              </p>
            </div>
            <Button size="sm" variant="outline" disabled={connectStripe.isPending} onClick={() => connectStripe.mutate()} className="flex-shrink-0">
              {connectStripe.isPending ? "…" : stripe?.connected ? "Finish setup" : "Connect Stripe"}
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> All Invoices
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            {portalUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1.5" /> Customer Portal
                </a>
              </Button>
            )}
            {canSend && (
              <Button variant="outline" size="sm" onClick={() => setSendOpen(true)}>
                <Send className="w-4 h-4 mr-1.5" /> Send Invoice
              </Button>
            )}
            {canPay && (
              <Button size="sm" onClick={() => setPaymentOpen(true)}>
                <DollarSign className="w-4 h-4 mr-1.5" /> Record Payment
              </Button>
            )}
          </div>
        </div>

        {/* Pending payment awaiting tradie approval */}
        {(invoice.payments ?? []).some((p: any) => p.status === "pending") && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-sm text-amber-900">Payment awaiting your confirmation</h3>
            </div>
            {(invoice.payments ?? []).filter((p: any) => p.status === "pending").map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border p-3">
                <div className="text-sm">
                  <p className="font-semibold">
                    {formatCurrency(p.amountCents)}
                    <span className="font-normal text-muted-foreground"> · {(p.paymentMethod ?? "bank transfer").replace(/_/g, " ")}</span>
                  </p>
                  {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                  {p.receiptUrl && (
                    <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 inline-flex items-center gap-1 mt-0.5">
                      <Paperclip className="w-3 h-3" /> View receipt
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending}>
                    <CheckCircle className="w-4 h-4 mr-1.5" /> Approve &amp; sync
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(p.id)} disabled={rejectMutation.isPending}>
                    <XCircle className="w-4 h-4 mr-1.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header card */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold">{invoice.invoiceNumber}</h2>
                    <Link href={`/customers/${customer?.id}`} className="text-sm text-primary hover:underline">
                      {customerName}
                    </Link>
                    {customer?.companyName && customer.firstName && (
                      <p className="text-xs text-muted-foreground">{customer.companyName}</p>
                    )}
                  </div>
                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium", statusCfg.color)}>
                    <StatusIcon className="w-4 h-4" />
                    {statusCfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Issue Date</p>
                    <p className="font-medium">{formatDate(invoice.issueDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Due Date</p>
                    <p className={cn("font-medium", invoice.status === "overdue" && "text-red-600")}>
                      {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                    </p>
                  </div>
                  {invoice.job && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Job</p>
                      <Link href={`/jobs/${invoice.job.id}`} className="text-sm text-primary hover:underline font-medium">
                        #{invoice.job.jobNumber}
                      </Link>
                    </div>
                  )}
                  {invoice.quote && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Quote</p>
                      <Link href={`/quotes/${invoice.quote.id}`} className="text-sm text-primary hover:underline font-medium">
                        #{invoice.quote.quoteNumber}
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Line items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Qty</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Unit Price</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">GST</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(invoice.lineItems ?? []).map((li: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{li.description}</p>
                          {li.unit && <p className="text-xs text-muted-foreground">{li.unit}</p>}
                          {li.discountPercent > 0 && (
                            <p className="text-xs text-green-700">-{li.discountPercent}% discount</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{li.quantity}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                          {formatCurrency(li.unitPriceCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                          {formatCurrency(li.gstCents ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(li.totalCents ?? li.subtotalCents ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/20">
                    <tr>
                      <td colSpan={3} className="hidden sm:table-cell" />
                      <td className="px-4 py-2 text-right text-sm text-muted-foreground hidden md:table-cell">Subtotal</td>
                      <td className="px-4 py-2 text-right text-sm">{formatCurrency(invoice.subtotalCents)}</td>
                    </tr>
                    {invoice.discountCents > 0 && (
                      <tr>
                        <td colSpan={3} className="hidden sm:table-cell" />
                        <td className="px-4 py-1 text-right text-sm text-muted-foreground hidden md:table-cell">Discount</td>
                        <td className="px-4 py-1 text-right text-sm text-green-700">-{formatCurrency(invoice.discountCents)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="hidden sm:table-cell" />
                      <td className="px-4 py-2 text-right text-sm text-muted-foreground hidden md:table-cell">GST</td>
                      <td className="px-4 py-2 text-right text-sm">{formatCurrency(invoice.gstCents)}</td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={3} className="hidden sm:table-cell" />
                      <td className="px-4 py-2.5 text-right hidden md:table-cell">Total</td>
                      <td className="px-4 py-2.5 text-right text-base">{formatCurrency(invoice.totalCents)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Payments */}
            {(invoice.payments ?? []).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Payment History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Method</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Reference</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoice.payments.map((p: any) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3">{formatDate(p.paidAt ?? p.createdAt)}</td>
                          <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                            {GATEWAY_LABEL[p.gateway] ?? p.gateway}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{p.reference ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-700">{formatCurrency(p.amountCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {invoice.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Balance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice Total</span>
                  <span className="font-medium">{formatCurrency(invoice.totalCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-green-700">{formatCurrency(paidCents)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-3">
                  <span>Amount Due</span>
                  <span className={cn(invoice.amountDueCents > 0 ? "text-red-600" : "text-green-700")}>
                    {formatCurrency(invoice.amountDueCents)}
                  </span>
                </div>
                {canPay && invoice.amountDueCents > 0 && (
                  <Button size="sm" className="w-full mt-2" onClick={() => setPaymentOpen(true)}>
                    <DollarSign className="w-4 h-4 mr-1.5" /> Record Payment
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Link href={`/customers/${customer?.id}`} className="font-medium text-primary hover:underline">
                  {customerName}
                </Link>
                {customer?.email && <p className="text-muted-foreground">{customer.email}</p>}
                {customer?.phone && <p className="text-muted-foreground">{customer.phone}</p>}
              </CardContent>
            </Card>

            {invoice.invoiceType && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize">{invoice.invoiceType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency</span>
                    <span>{invoice.currency ?? "AUD"}</span>
                  </div>
                  {invoice.sentAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sent</span>
                      <span>{formatDate(invoice.sentAt)}</span>
                    </div>
                  )}
                  {invoice.firstViewedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Viewed</span>
                      <span>{formatDate(invoice.firstViewedAt)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Send Invoice Dialog */}
      {sendOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-lg">Send Invoice</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Recipient Email {customer?.email ? `(default: ${customer.email})` : ""}
                </label>
                <input
                  type="email"
                  placeholder={customer?.email ?? "customer@example.com"}
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Custom Message (optional)</label>
                <textarea
                  placeholder="Any additional message for the customer…"
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  rows={3}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
              <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                {sendMutation.isPending ? "Sending…" : "Send Invoice"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Dialog */}
      {paymentOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-lg">Record Payment</h3>
            <p className="text-sm text-muted-foreground">
              Amount due: <strong>{formatCurrency(invoice.amountDueCents)}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Amount *</label>
                <div className="relative mt-0.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={(invoice.amountDueCents / 100).toFixed(2)}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
                <select
                  value={paymentGateway}
                  onChange={(e) => setPaymentGateway(e.target.value)}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(GATEWAY_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reference / Receipt No. (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. BSP-2024-001"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
              <Button
                onClick={() => paymentMutation.mutate()}
                disabled={!paymentAmount || Number(paymentAmount) <= 0 || paymentMutation.isPending}
              >
                {paymentMutation.isPending ? "Recording…" : "Record Payment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
