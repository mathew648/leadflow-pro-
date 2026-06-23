"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, Send, Copy, Briefcase, ChevronRight,
  GripVertical, CheckCircle, XCircle, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, statusColor, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface LineItem {
  id?: string;
  catalogItemId?: string;
  description: string;
  notes: string;
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
  const selected = items.filter((li) => li.isSelected || !li.isOptional);
  return selected.reduce(
    (acc, li) => {
      const c = calcLine(li);
      return { subtotal: acc.subtotal + c.subtotal, gst: acc.gst + c.gst, total: acc.total + c.total };
    },
    { subtotal: 0, gst: 0, total: 0 }
  );
}

const BLANK_LINE: LineItem = {
  description: "", notes: "", unit: "ea", quantity: 1, unitPriceCents: 0,
  discountPercent: 0, gstRate: 0.1, isOptional: false, isSelected: true,
  position: 0, section: "", costPriceCents: 0,
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [meta, setMeta] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => api.get<any>(`/quotes/${id}`),
  });

  const { data: catalogData } = useQuery({
    queryKey: ["catalog-items-quote-edit"],
    queryFn: () => api.get<any>("/catalog/items?limit=200"),
  });
  const catalogItems: any[] = (Array.isArray(catalogData) ? catalogData : (catalogData?.data ?? []));

  useEffect(() => {
    if (data) {
      const q = data as any;
      setLineItems((q.lineItems ?? []).map((li: any) => ({
        id: li.id,
        description: li.description ?? "",
        notes: li.notes ?? "",
        unit: li.unit ?? "ea",
        quantity: Number(li.quantity),
        unitPriceCents: li.unitPriceCents,
        discountPercent: Number(li.discountPercent),
        gstRate: Number(li.gstRate),
        isOptional: li.isOptional,
        isSelected: li.isSelected,
        position: li.position,
        section: li.section ?? "",
        costPriceCents: li.costPriceCents ?? 0,
        catalogItemId: li.catalogItemId ?? undefined,
      })));
      setMeta({
        title: q.title,
        description: q.description ?? "",
        internalNotes: q.internalNotes ?? "",
        depositPercent: Number(q.depositPercent),
        paymentTermsDays: q.paymentTermsDays,
        validUntil: q.validUntil ? q.validUntil.split("T")[0] : "",
        termsConditions: q.termsConditions ?? "",
      });
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/quotes/${id}`, {
      ...meta,
      validUntil: meta.validUntil ? new Date(meta.validUntil).toISOString() : null,
      lineItems: lineItems.map((li, i) => ({ ...li, position: i })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
      setDirty(false);
      toast({ title: "Quote saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/quotes/${id}/send`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
      toast({ title: "Quote sent to customer!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => api.post(`/quotes/${id}/duplicate`, {}),
    onSuccess: (res: any) => {
      toast({ title: "Quote duplicated" });
      router.push(`/quotes/${res.id ?? res.data?.id ?? id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/quotes/${id}/convert-to-job`, {}),
    onSuccess: (res: any) => {
      toast({ title: "Job created from quote!" });
      router.push(`/jobs/${res.id ?? res.data?.id}`);
    },
    onError: (e: any) => toast({ title: "Cannot convert", description: e.message, variant: "destructive" }),
  });

  const updateLine = (i: number, field: keyof LineItem, value: any) => {
    setLineItems((prev) => prev.map((li, idx) => idx === i ? { ...li, [field]: value } : li));
    setDirty(true);
  };

  // Description doubles as a price-book picker: typing/selecting a catalog item name
  // auto-fills the unit, price, cost and GST from the price book.
  const setDescription = (i: number, value: string) => {
    const match = catalogItems.find((c) => (c.name ?? "").toLowerCase() === value.trim().toLowerCase());
    setLineItems((prev) => prev.map((li, idx) => {
      if (idx !== i) return li;
      if (match) {
        return {
          ...li,
          description: match.name,
          unit: match.unit ?? li.unit,
          unitPriceCents: match.unitPriceCents ?? match.sellPriceCents ?? li.unitPriceCents,
          costPriceCents: match.unitCostCents ?? match.costPriceCents ?? li.costPriceCents,
          gstRate: match.gstRate ?? li.gstRate,
          catalogItemId: match.id,
        };
      }
      return { ...li, description: value, catalogItemId: undefined };
    }));
    setDirty(true);
  };

  const addLine = () => {
    setLineItems((prev) => [...prev, { ...BLANK_LINE, position: prev.length }]);
    setDirty(true);
  };

  const removeLine = (i: number) => {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div>
        <Topbar title="Quote" />
        <div className="p-6 text-muted-foreground animate-pulse">Loading…</div>
      </div>
    );
  }

  const quote = data as any;
  if (!quote) return <div className="p-6">Quote not found.</div>;

  const totals = calcTotals(lineItems);
  const depositCents = Math.round(totals.total * (meta.depositPercent / 100));
  const isLocked = ["approved", "paid"].includes(quote.status);
  const canSend = ["draft"].includes(quote.status);
  const canConvert = quote.status === "approved";

  return (
    <div>
      <Topbar title={`Quote ${quote.quoteNumber}`} />

      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
        <Link href="/quotes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All Quotes
        </Link>

        {/* Header */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{quote.quoteNumber}</h2>
                  <Badge className={cn("text-xs", statusColor(quote.status))}>{quote.status}</Badge>
                </div>
                <p className="text-sm font-medium mt-1">{quote.title}</p>
                {quote.customer && (
                  <Link href={`/customers/${quote.customer.id}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5">
                    {[quote.customer.firstName, quote.customer.lastName, quote.customer.companyName].filter(Boolean).join(" ")}
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {dirty && !isLocked && (
                  <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    Save Changes
                  </Button>
                )}
                {canSend && (
                  <Button size="sm" variant="outline" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                    <Send className="w-4 h-4 mr-1.5" /> Send to Customer
                  </Button>
                )}
                {canConvert && (
                  <Button size="sm" onClick={() => convertMutation.mutate()}>
                    <Briefcase className="w-4 h-4 mr-1.5" /> Create Job
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => duplicateMutation.mutate()} disabled={duplicateMutation.isPending}>
                  <Copy className="w-4 h-4 mr-1.5" /> Duplicate
                </Button>
                {quote.portalUrl && (
                  <a href={quote.portalUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="w-4 h-4 mr-1.5" /> Portal
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-3 flex gap-6 text-sm text-muted-foreground flex-wrap">
              {quote.validUntil && (
                <span>Valid until <strong className="text-foreground">{formatDate(quote.validUntil)}</strong></span>
              )}
              <span>Payment <strong className="text-foreground">{quote.paymentTermsDays} days</strong></span>
              {quote.approvedAt && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Approved {formatDate(quote.approvedAt)}
                  {quote.approvedByName && ` by ${quote.approvedByName}`}
                </span>
              )}
              {quote.rejectedAt && (
                <span className="text-red-600 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Rejected {formatDate(quote.rejectedAt)}
                </span>
              )}
            </div>

            {/* Edit meta */}
            {!isLocked && (
              <button
                onClick={() => setEditMeta(!editMeta)}
                className="mt-3 text-xs text-primary hover:underline"
              >
                {editMeta ? "Hide details ↑" : "Edit quote details ↓"}
              </button>
            )}
            {editMeta && !isLocked && (
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3">
                {[
                  { key: "title", label: "Title", span: 2 },
                  { key: "description", label: "Description", span: 2, multiline: true },
                ].map(({ key, label, span, multiline }) => (
                  <div key={key} className={span === 2 ? "col-span-2" : ""}>
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    {multiline ? (
                      <textarea
                        value={meta[key] ?? ""}
                        onChange={(e) => { setMeta((p: any) => ({ ...p, [key]: e.target.value })); setDirty(true); }}
                        rows={2}
                        className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={meta[key] ?? ""}
                        onChange={(e) => { setMeta((p: any) => ({ ...p, [key]: e.target.value })); setDirty(true); }}
                        className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Valid Until</label>
                  <input
                    type="date"
                    value={meta.validUntil ?? ""}
                    onChange={(e) => { setMeta((p: any) => ({ ...p, validUntil: e.target.value })); setDirty(true); }}
                    className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Deposit %</label>
                  <input
                    type="number"
                    min="0" max="100"
                    value={meta.depositPercent ?? 0}
                    onChange={(e) => { setMeta((p: any) => ({ ...p, depositPercent: Number(e.target.value) })); setDirty(true); }}
                    className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Payment Terms (days)</label>
                  <input
                    type="number"
                    value={meta.paymentTermsDays ?? 14}
                    onChange={(e) => { setMeta((p: any) => ({ ...p, paymentTermsDays: Number(e.target.value) })); setDirty(true); }}
                    className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Line Items</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {/* Header row */}
            <div className="hidden lg:grid grid-cols-12 gap-2 px-2 pb-2 text-xs font-medium text-muted-foreground border-b">
              <div className="col-span-4">Description</div>
              <div className="col-span-1">Unit</div>
              <div className="col-span-1">Qty</div>
              <div className="col-span-2">Unit Price</div>
              <div className="col-span-1">GST%</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            <datalist id="pricebook-list">
              {catalogItems.map((it) => (
                <option key={it.id} value={it.name}>
                  {(it.unitPriceCents ?? it.sellPriceCents) ? formatCurrency(it.unitPriceCents ?? it.sellPriceCents) : ""}
                </option>
              ))}
            </datalist>

            <div className="space-y-2 mt-2">
              {lineItems.map((li, i) => {
                const c = calcLine(li);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start py-1">
                    <div className="col-span-12 lg:col-span-4">
                      <input
                        type="text"
                        list="pricebook-list"
                        placeholder="Description or pick from price book…"
                        value={li.description}
                        onChange={(e) => setDescription(i, e.target.value)}
                        disabled={isLocked}
                        className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="col-span-4 lg:col-span-1">
                      <input
                        type="text"
                        placeholder="ea"
                        value={li.unit}
                        onChange={(e) => updateLine(i, "unit", e.target.value)}
                        disabled={isLocked}
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
                        disabled={isLocked}
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
                          placeholder="0.00"
                          value={li.unitPriceCents ? li.unitPriceCents / 100 : ""}
                          onChange={(e) => updateLine(i, "unitPriceCents", Math.round((Number(e.target.value) || 0) * 100))}
                          disabled={isLocked}
                          className="w-full pl-6 pr-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="col-span-4 lg:col-span-1">
                      <select
                        value={li.gstRate}
                        onChange={(e) => updateLine(i, "gstRate", Number(e.target.value))}
                        disabled={isLocked}
                        className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="0">0%</option>
                        <option value="0.1">10%</option>
                        <option value="0.15">15%</option>
                      </select>
                    </div>
                    <div className="col-span-4 lg:col-span-2 text-right flex items-center justify-end">
                      <span className="text-sm font-medium">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="col-span-4 lg:col-span-1 flex justify-end">
                      {!isLocked && (
                        <button onClick={() => removeLine(i)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!isLocked && (
              <Button variant="outline" size="sm" className="mt-3" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Line Item
              </Button>
            )}

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
              <div className="flex justify-between font-bold text-base border-t pt-1 mt-1">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
              {meta.depositPercent > 0 && (
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Deposit ({meta.depositPercent}%)</span>
                  <span>{formatCurrency(depositCents)}</span>
                </div>
              )}
            </div>

            {dirty && !isLocked && (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  Save Quote
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terms */}
        {(quote.termsConditions || editMeta) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              {!isLocked && editMeta ? (
                <textarea
                  value={meta.termsConditions ?? ""}
                  onChange={(e) => { setMeta((p: any) => ({ ...p, termsConditions: e.target.value })); setDirty(true); }}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.termsConditions}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
