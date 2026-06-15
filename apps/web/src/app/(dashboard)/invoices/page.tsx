"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Search, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

const BLANK_LINE = {
  description: "", unit: "ea", quantity: 1,
  unitPriceCents: "" as any, gstRate: 0.1,
};

function calcLine(li: typeof BLANK_LINE) {
  const sub = li.quantity * (Number(li.unitPriceCents) * 100);
  return sub + sub * li.gstRate;
}

export default function InvoicesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    invoiceType: "final",
    dueDate: "",
    notes: "",
    lineItems: [{ ...BLANK_LINE }],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", search, status, overdue],
    queryFn: () => api.get<any>(
      `/invoices?search=${encodeURIComponent(search)}&${status ? `status=${status}&` : ""}${overdue ? "overdue=true&" : ""}limit=50`
    ),
  });

  const { data: customersData } = useQuery({
    queryKey: ["customers-search"],
    queryFn: () => api.get<any>("/customers?limit=200"),
    enabled: addOpen,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<any>("/invoices", {
        customerId: form.customerId,
        invoiceType: form.invoiceType,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        notes: form.notes || undefined,
        lineItems: form.lineItems.map((li, i) => ({
          description: li.description,
          unit: li.unit || undefined,
          quantity: li.quantity,
          unitPriceCents: Math.round(Number(li.unitPriceCents) * 100),
          gstRate: li.gstRate,
          discountPercent: 0,
          position: i,
        })),
      }),
    onSuccess: (res: any) => {
      toast({ title: "Invoice created!" });
      setAddOpen(false);
      setForm({ customerId: "", invoiceType: "final", dueDate: "", notes: "", lineItems: [{ ...BLANK_LINE }] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/invoices/${res.data?.id ?? res.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function updateLine(i: number, field: string, value: any) {
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.map((li, idx) => idx === i ? { ...li, [field]: value } : li),
    }));
  }

  const invoices: any[] = data?.data ?? [];
  const summary = data?.summary;
  const customers: any[] = customersData?.data ?? [];

  const totalCents = form.lineItems.reduce((s, li) => s + calcLine(li), 0);
  const canSubmit = form.customerId && form.lineItems.every((li) => li.description && Number(li.unitPriceCents) >= 0);

  return (
    <div>
      <Topbar title="Invoices" action={{ label: "New Invoice", onClick: () => setAddOpen(true) }} />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 px-4 lg:px-6 pt-4">
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold mt-1 text-orange-600">{formatCurrency(summary.totalOutstandingCents)}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Total Invoiced</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalInvoicedCents)}</p>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex items-center gap-1 px-4 lg:px-6 pt-4 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setStatus(tab.value); setOverdue(false); }}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              status === tab.value && !overdue
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted")}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setOverdue((v) => !v); setStatus(""); }}
          className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors",
            overdue ? "bg-red-500 text-white" : "text-muted-foreground hover:bg-muted")}
        >
          <AlertCircle className="w-3.5 h-3.5" /> Overdue
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b bg-white mt-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      <div className="p-4 lg:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Due</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv: any) => {
                  const isOverdue = inv.status !== "paid" && inv.dueDate && new Date(inv.dueDate) < new Date();
                  return (
                    <Link key={inv.id} href={`/invoices/${inv.id}`} legacyBehavior>
                      <tr className={cn("hover:bg-muted/30 cursor-pointer transition-colors", isOverdue && "bg-red-50/50")}>
                        <td className="px-4 py-3 font-mono font-medium">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{inv.customer?.firstName} {inv.customer?.lastName}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", isOverdue ? "bg-red-100 text-red-800" : statusColor(inv.status))}>
                            {isOverdue ? "Overdue" : inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.totalCents)}</td>
                        <td className={cn("px-4 py-3 text-right hidden lg:table-cell font-medium", inv.amountDueCents > 0 ? "text-orange-600" : "text-green-600")}>
                          {inv.amountDueCents > 0 ? formatCurrency(inv.amountDueCents) : "Paid"}
                        </td>
                        <td className={cn("px-4 py-3 text-xs hidden lg:table-cell", isOverdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                          {formatDate(inv.dueDate)}
                        </td>
                      </tr>
                    </Link>
                  );
                })}
              </tbody>
            </table>
            {invoices.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No invoices found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Invoice Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <h3 className="font-semibold text-lg">New Invoice</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Customer + type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground">Customer *</label>
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {[c.firstName, c.lastName].filter(Boolean).join(" ")}{c.companyName ? ` — ${c.companyName}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Invoice Type</label>
                  <select
                    value={form.invoiceType}
                    onChange={(e) => setForm((f) => ({ ...f, invoiceType: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="final">Final</option>
                    <option value="deposit">Deposit</option>
                    <option value="progress">Progress</option>
                    <option value="credit">Credit Note</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <input
                    type="text"
                    placeholder="Internal notes…"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Line items */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Line Items *</p>
                <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-1 text-xs font-medium text-muted-foreground">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-1">Unit</div>
                  <div className="col-span-1">Qty</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2">GST</div>
                  <div className="col-span-1" />
                </div>
                <div className="space-y-2">
                  {form.lineItems.map((li, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-5">
                        <input
                          type="text"
                          placeholder="Description"
                          value={li.description}
                          onChange={(e) => updateLine(i, "description", e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-1">
                        <input
                          type="text"
                          placeholder="ea"
                          value={li.unit}
                          onChange={(e) => updateLine(i, "unit", e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-1">
                        <input
                          type="number" min="0.01" step="0.01"
                          value={li.quantity}
                          onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={li.unitPriceCents}
                            onChange={(e) => updateLine(i, "unitPriceCents", e.target.value)}
                            className="w-full pl-5 pr-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <select
                          value={li.gstRate}
                          onChange={(e) => updateLine(i, "gstRate", Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="0">0%</option>
                          <option value="0.1">10%</option>
                          <option value="0.15">15%</option>
                        </select>
                      </div>
                      <div className="col-span-4 sm:col-span-1 flex justify-end">
                        {form.lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }))}
                            className="p-1.5 text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setForm((f) => ({ ...f, lineItems: [...f.lineItems, { ...BLANK_LINE }] }))}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add line
                </Button>

                {totalCents > 0 && (
                  <div className="mt-3 pt-3 border-t text-sm text-right text-muted-foreground">
                    Total (inc. GST): <span className="font-bold text-foreground ml-2">{formatCurrency(totalCents)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create Invoice"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
