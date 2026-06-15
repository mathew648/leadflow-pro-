"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface LineItem {
  description: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  discountPercent: number;
  gstRate: number;
  isOptional: boolean;
  isSelected: boolean;
  position: number;
  section: string;
  costPriceCents: number;
}

function calcLine(li: LineItem) {
  const sub = li.quantity * li.unitPriceCents * (1 - li.discountPercent / 100);
  const gst = sub * li.gstRate;
  return { subtotal: sub, gst, total: sub + gst };
}

function calcTotals(items: LineItem[]) {
  return items.reduce(
    (acc, li) => {
      const c = calcLine(li);
      return { subtotal: acc.subtotal + c.subtotal, gst: acc.gst + c.gst, total: acc.total + c.total };
    },
    { subtotal: 0, gst: 0, total: 0 }
  );
}

const BLANK_LINE: LineItem = {
  description: "", unit: "ea", quantity: 1, unitPriceCents: 0,
  discountPercent: 0, gstRate: 0.1, isOptional: false, isSelected: true,
  position: 0, section: "", costPriceCents: 0,
};

export default function NewQuotePage() {
  const router = useRouter();
  const params = useSearchParams();
  const prefillCustomerId = params.get("customerId") ?? "";
  const prefillLeadId = params.get("leadId") ?? "";

  const [customerId, setCustomerId] = useState(prefillCustomerId);
  const [leadId] = useState(prefillLeadId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [depositPercent, setDepositPercent] = useState(0);
  const [paymentTermsDays, setPaymentTermsDays] = useState(14);
  const [validUntil, setValidUntil] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...BLANK_LINE }]);

  const { data: customersData } = useQuery({
    queryKey: ["customers-search"],
    queryFn: () => api.get<any>("/customers?limit=200"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<any>("/quotes", {
        customerId,
        leadId: leadId || undefined,
        title,
        description: description || undefined,
        depositPercent,
        paymentTermsDays,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        lineItems: lineItems.map((li, i) => ({ ...li, position: i })),
      }),
    onSuccess: (res: any) => {
      toast({ title: "Quote created!" });
      router.push(`/quotes/${res.id ?? res.data?.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateLine = (i: number, field: keyof LineItem, value: any) => {
    setLineItems((prev) => prev.map((li, idx) => idx === i ? { ...li, [field]: value } : li));
  };

  const addLine = () => setLineItems((prev) => [...prev, { ...BLANK_LINE, position: prev.length }]);
  const removeLine = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i));

  const customers: any[] = customersData?.data ?? [];
  const totals = calcTotals(lineItems);
  const depositCents = Math.round(totals.total * (depositPercent / 100));

  const canSubmit = customerId && title && lineItems.length > 0 && lineItems.every((li) => li.description && li.unitPriceCents >= 0);

  return (
    <div>
      <Topbar title="New Quote" />

      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">
        <Link href="/quotes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All Quotes
        </Link>

        {/* Quote details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quote Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select customer…</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ")}{c.companyName ? ` — ${c.companyName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Quote Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Switchboard Upgrade — 123 Main St"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  placeholder="Overview of the work to be done…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Deposit %</label>
                <input
                  type="number"
                  min="0" max="100"
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(Number(e.target.value))}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payment Terms (days)</label>
                <input
                  type="number"
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="hidden lg:grid grid-cols-12 gap-2 px-1 pb-2 text-xs font-medium text-muted-foreground border-b">
              <div className="col-span-4">Description *</div>
              <div className="col-span-1">Unit</div>
              <div className="col-span-1">Qty</div>
              <div className="col-span-2">Unit Price</div>
              <div className="col-span-1">GST</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2 mt-2">
              {lineItems.map((li, i) => {
                const c = calcLine(li);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 lg:col-span-4">
                      <input
                        type="text"
                        placeholder="Description"
                        value={li.description}
                        onChange={(e) => updateLine(i, "description", e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="col-span-4 lg:col-span-1">
                      <input
                        type="text"
                        placeholder="ea"
                        value={li.unit}
                        onChange={(e) => updateLine(i, "unit", e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="col-span-4 lg:col-span-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={li.quantity}
                        onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="col-span-4 lg:col-span-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={(li.unitPriceCents / 100).toFixed(2)}
                          onChange={(e) => updateLine(i, "unitPriceCents", Math.round(Number(e.target.value) * 100))}
                          className="w-full pl-6 pr-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="col-span-4 lg:col-span-1">
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
                    <div className="col-span-4 lg:col-span-2 text-right">
                      <span className="text-sm font-medium">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="col-span-4 lg:col-span-1 flex justify-end">
                      {lineItems.length > 1 && (
                        <button onClick={() => removeLine(i)} className="p-1.5 text-muted-foreground hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button variant="outline" size="sm" className="mt-3" onClick={addLine}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Line Item
            </Button>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t space-y-1 text-sm max-w-xs ml-auto">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST</span>
                <span>{formatCurrency(totals.gst)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
              {depositPercent > 0 && (
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Deposit ({depositPercent}%)</span>
                  <span>{formatCurrency(depositCents)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/quotes">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
          >
            Create Quote
          </Button>
        </div>
      </div>
    </div>
  );
}
