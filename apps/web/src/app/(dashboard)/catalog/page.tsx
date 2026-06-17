"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Package, Edit2, ToggleLeft, ToggleRight, Upload } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, getToken } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const TYPE_COLORS: Record<string, string> = {
  labour:      "bg-blue-100 text-blue-700",
  material:    "bg-green-100 text-green-700",
  equipment:   "bg-purple-100 text-purple-700",
  subcontract: "bg-orange-100 text-orange-700",
  other:       "bg-gray-100 text-gray-600",
};

const ITEM_TYPES = ["labour", "material", "equipment", "subcontract", "other"];

const BLANK = {
  name: "", code: "", description: "", type: "labour",
  unit: "hr", unitPriceCents: 0, unitCostCents: 0,
  gstRate: 0.1, categoryId: "", taxable: true,
};

export default function CatalogPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ ...BLANK });

  const { data: categoriesData } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: () => api.get<any>("/catalog/categories"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["catalog-items", search, typeFilter],
    queryFn: () => api.get<any>(
      `/catalog/items?search=${encodeURIComponent(search)}&${typeFilter ? `type=${typeFilter}&` : ""}limit=100`
    ),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<any>("/catalog/items", {
      ...form,
      unitPriceCents: Math.round(Number(form.unitPriceCents) * 100),
      unitCostCents:  Math.round(Number(form.unitCostCents)  * 100),
      gstRate: Number(form.gstRate),
      categoryId: form.categoryId || undefined,
    }),
    onSuccess: () => {
      toast({ title: "Item created!" });
      qc.invalidateQueries({ queryKey: ["catalog-items"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch<any>(`/catalog/items/${editItem.id}`, {
      ...form,
      unitPriceCents: Math.round(Number(form.unitPriceCents) * 100),
      unitCostCents:  Math.round(Number(form.unitCostCents)  * 100),
      gstRate: Number(form.gstRate),
      categoryId: form.categoryId || undefined,
    }),
    onSuccess: () => {
      toast({ title: "Item updated!" });
      qc.invalidateQueries({ queryKey: ["catalog-items"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (item: any) => api.patch(`/catalog/items/${item.id}`, { isActive: !item.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog-items"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const token = getToken();
      const res = await fetch("/api/v1/catalog/items/import-file", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Import failed");
      return json.data as { imported: number; parsed: number; skipped: number };
    },
    onSuccess: (data) => {
      toast({
        title: `Imported ${data.imported} item${data.imported === 1 ? "" : "s"}`,
        description: data.skipped > 0 ? `${data.skipped} row(s) skipped — check headers/prices` : undefined,
      });
      qc.invalidateQueries({ queryKey: ["catalog-items"] });
      qc.invalidateQueries({ queryKey: ["catalog-categories"] });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
    e.target.value = ""; // allow re-selecting the same file
  }

  function openCreate() {
    setEditItem(null);
    setForm({ ...BLANK });
    setModalOpen(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setForm({
      name: item.name,
      code: item.code ?? "",
      description: item.description ?? "",
      type: item.type,
      unit: item.unit ?? "hr",
      unitPriceCents: (item.unitPriceCents / 100).toFixed(2) as any,
      unitCostCents:  (item.unitCostCents  / 100).toFixed(2) as any,
      gstRate: item.gstRate,
      categoryId: item.categoryId ?? "",
      taxable: item.taxable ?? true,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditItem(null);
    setForm({ ...BLANK });
  }

  const items: any[] = data?.data ?? [];
  const categories: any[] = categoriesData?.data ?? [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <Topbar title="Price Book" action={{ label: "Add Item", onClick: openCreate }} />

      {/* Filters */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b bg-white flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setTypeFilter("")}
            className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors",
              typeFilter === "" ? "bg-primary text-white border-primary" : "hover:bg-muted")}
          >
            All
          </button>
          {ITEM_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t === typeFilter ? "" : t)}
              className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize",
                typeFilter === t ? "bg-primary text-white border-primary" : "hover:bg-muted")}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          hidden
          onChange={onFilePicked}
        />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-8"
          onClick={() => fileInputRef.current?.click()}
          disabled={importMutation.isPending}
          title="Import a price list from CSV or Excel (.xlsx)"
        >
          <Upload className="w-4 h-4 mr-1.5" />
          {importMutation.isPending ? "Importing…" : "Import CSV/Excel"}
        </Button>
        <span className="text-sm text-muted-foreground">{data?.meta?.total ?? 0} items</span>
      </div>

      <div className="p-4 lg:p-6">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No items yet</p>
            <p className="text-sm mt-1">Build your price book to speed up quoting</p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Add first item
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sell Price</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Margin</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item: any) => {
                  const margin = item.unitPriceCents > 0
                    ? Math.round(((item.unitPriceCents - item.unitCostCents) / item.unitPriceCents) * 100)
                    : 0;
                  return (
                    <tr key={item.id} className={cn("hover:bg-muted/30 transition-colors", !item.isActive && "opacity-50")}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.name}</p>
                        {item.code && <p className="text-xs text-muted-foreground font-mono">{item.code}</p>}
                        {item.category && <p className="text-xs text-muted-foreground">{item.category.name}</p>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", TYPE_COLORS[item.type] ?? "bg-gray-100 text-gray-600")}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{item.unit ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.unitPriceCents)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{formatCurrency(item.unitCostCents)}</td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className={cn("text-xs font-medium", margin >= 40 ? "text-green-600" : margin >= 20 ? "text-yellow-600" : "text-red-600")}>
                          {margin}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit item"
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title={item.isActive ? "Deactivate" : "Activate"}
                            onClick={() => toggleMutation.mutate(item)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {item.isActive
                              ? <ToggleRight className="w-4 h-4 text-green-600" />
                              : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <h3 className="font-semibold text-lg">{editItem ? "Edit Item" : "Add Item"}</h3>
              <button type="button" onClick={closeModal} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Item Name *</label>
                  <Input
                    autoFocus
                    placeholder="e.g. Labour – Standard Rate"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Item Code</label>
                  <Input
                    placeholder="LAB-001"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    className="mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {ITEM_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  placeholder="Optional description shown on quotes"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Unit</label>
                  <Input
                    placeholder="hr"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    className="mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sell Price *</label>
                  <div className="relative mt-0.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.unitPriceCents}
                      onChange={(e) => setForm((f) => ({ ...f, unitPriceCents: e.target.value as any }))}
                      className="w-full pl-7 pr-2 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cost Price</label>
                  <div className="relative mt-0.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.unitCostCents}
                      onChange={(e) => setForm((f) => ({ ...f, unitCostCents: e.target.value as any }))}
                      className="w-full pl-7 pr-2 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">GST Rate</label>
                  <select
                    value={form.gstRate}
                    onChange={(e) => setForm((f) => ({ ...f, gstRate: Number(e.target.value) }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="0">0% (GST free)</option>
                    <option value="0.1">10% (AU GST)</option>
                    <option value="0.15">15% (NZ GST)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">No category</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <Button variant="outline" onClick={closeModal}>Cancel</Button>
              <Button
                onClick={() => editItem ? updateMutation.mutate() : createMutation.mutate()}
                disabled={!form.name || isPending}
              >
                {isPending ? "Saving…" : editItem ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
