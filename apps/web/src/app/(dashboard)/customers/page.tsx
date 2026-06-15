"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, UserCheck, Building2, Phone, Mail, Star, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn, formatCurrency, formatRelative, initials } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

const BLANK = { firstName: "", lastName: "", phone: "", email: "", companyName: "" };

export default function CustomersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [isVip, setIsVip] = useState<boolean | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, isVip],
    queryFn: () => api.get<any>(
      `/customers?search=${encodeURIComponent(search)}${isVip !== null ? `&isVip=${isVip}` : ""}&limit=50`
    ),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<any>("/customers", {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email || undefined,
        companyName: form.companyName || undefined,
      }),
    onSuccess: (res: any) => {
      toast({ title: "Customer created!" });
      setAddOpen(false);
      setForm({ ...BLANK });
      qc.invalidateQueries({ queryKey: ["customers"] });
      router.push(`/customers/${res.id ?? res.data?.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const customers: any[] = data?.data ?? [];
  const canSubmit = form.firstName && form.lastName && form.phone.length >= 7;

  return (
    <div>
      <Topbar title="Customers" action={{ label: "Add Customer", onClick: () => setAddOpen(true) }} />

      {/* Filters */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b bg-white">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <button
          onClick={() => setIsVip((v) => (v === true ? null : true))}
          className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5",
            isVip ? "border-yellow-400 bg-yellow-50 text-yellow-800" : "hover:bg-muted")}
        >
          <Star className="w-3.5 h-3.5" /> VIP only
        </button>
      </div>

      <div className="p-4 lg:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No customers yet</p>
            <p className="text-sm mt-1">Customers are created from leads or added manually</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((c: any) => (
              <Link key={c.id} href={`/customers/${c.id}`}>
                <div className="bg-white rounded-xl border p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {initials(c.firstName, c.lastName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate">
                          {c.firstName} {c.lastName}
                        </p>
                        {c.isVip && <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" fill="currentColor" />}
                      </div>
                      {c.companyName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {c.companyName}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>

                  <div className="mt-3 space-y-1">
                    {c.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> {c.email}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex gap-3">
                      <span>{c._count?.jobs ?? 0} jobs</span>
                      <span>{c._count?.invoices ?? 0} invoices</span>
                    </div>
                    {c.tags?.length > 0 && (
                      <span className="bg-muted px-1.5 py-0.5 rounded-full">{c.tags[0]}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {data?.meta && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Showing {customers.length} of {data.meta.total} customers
          </p>
        )}
      </div>

      {/* Add Customer Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <h3 className="font-semibold text-lg">Add Customer</h3>
              <button
                onClick={() => { setAddOpen(false); setForm({ ...BLANK }); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">First Name *</label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Jane"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Last Name *</label>
                  <input
                    type="text"
                    placeholder="Smith"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone *</label>
                <input
                  type="tel"
                  placeholder="+61 4xx xxx xxx"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Company Name</label>
                <input
                  type="text"
                  placeholder="Acme Pty Ltd"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <Button variant="outline" onClick={() => { setAddOpen(false); setForm({ ...BLANK }); }}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Add Customer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
