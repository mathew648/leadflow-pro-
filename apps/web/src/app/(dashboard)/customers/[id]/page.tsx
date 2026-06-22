"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Phone, Mail, MapPin, Star, Building2, Home,
  Briefcase, Receipt, MessageSquare, ChevronRight, Plus, Edit2,
} from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatRelative, statusColor, initials, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const TABS = ["overview", "jobs", "quotes", "invoices", "activity"] as const;
type Tab = typeof TABS[number];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.get<any>(`/customers/${id}`),
  });

  const { data: activity } = useQuery({
    queryKey: ["customer-activity", id],
    queryFn: () => api.get<any>(`/customers/${id}/activity`),
    enabled: tab === "activity",
  });

  const { data: jobsData } = useQuery({
    queryKey: ["customer-jobs", id],
    queryFn: () => api.get<any>(`/jobs?customerId=${id}&limit=50`),
    enabled: tab === "jobs",
  });

  const { data: quotesData } = useQuery({
    queryKey: ["customer-quotes", id],
    queryFn: () => api.get<any>(`/quotes?customerId=${id}&limit=50`),
    enabled: tab === "quotes",
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["customer-invoices", id],
    queryFn: () => api.get<any>(`/invoices?customerId=${id}&limit=50`),
    enabled: tab === "invoices",
  });

  const patchMutation = useMutation({
    mutationFn: (body: any) => api.patch(`/customers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", id] });
      setEditMode(false);
      toast({ title: "Customer updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div>
        <Topbar title="Customer" />
        <div className="p-6 text-muted-foreground animate-pulse">Loading…</div>
      </div>
    );
  }

  const customer = data as any;
  if (!customer) return <div className="p-6">Customer not found.</div>;

  const displayName = customer.companyName
    ? `${customer.companyName}${customer.firstName ? ` (${customer.firstName} ${customer.lastName})` : ""}`
    : [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;

  const jobs: any[] = (Array.isArray(jobsData) ? jobsData : (jobsData?.data ?? []));
  const quotes: any[] = (Array.isArray(quotesData) ? quotesData : (quotesData?.data ?? []));
  const invoices: any[] = (Array.isArray(invoicesData) ? invoicesData : (invoicesData?.data ?? []));

  const totalRevenue = ((Array.isArray(invoicesData) ? invoicesData : (invoicesData?.data ?? [])))
    .filter((i: any) => i.status === "paid")
    .reduce((sum: number, i: any) => sum + i.totalCents, 0);
  const openBalance = ((Array.isArray(invoicesData) ? invoicesData : (invoicesData?.data ?? [])))
    .filter((i: any) => ["sent", "partial", "overdue"].includes(i.status))
    .reduce((sum: number, i: any) => sum + i.amountDueCents, 0);

  return (
    <div>
      <Topbar
        title="Customer 360"
        action={{ label: "New Job", onClick: () => router.push(`/jobs?newFor=${id}`), icon: <Plus className="w-4 h-4" /> }}
      />

      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All Customers
        </Link>

        {/* Header */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 font-bold text-xl flex items-center justify-center flex-shrink-0">
                {customer.companyName
                  ? <Building2 className="w-6 h-6" />
                  : initials(customer.firstName ?? "", customer.lastName ?? "")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold">{displayName}</h2>
                    <p className="text-sm text-muted-foreground">
                      {customer.customerNumber && <span className="mr-2">{customer.customerNumber}</span>}
                      <Badge className="bg-gray-100 text-gray-600 text-xs">{customer.type}</Badge>
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setEditMode(!editMode); setEditData({ ...customer }); }}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> {editMode ? "Cancel" : "Edit"}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-foreground">
                      <Mail className="w-3.5 h-3.5" /> {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-foreground">
                      <Phone className="w-3.5 h-3.5" /> {customer.phone}
                    </a>
                  )}
                  {customer.billingSuburb && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {customer.billingSuburb}{customer.billingState ? `, ${customer.billingState}` : ""}
                    </span>
                  )}
                </div>
                {customer.tags?.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {customer.tags.map((t: string) => (
                      <Badge key={t} className="bg-blue-50 text-blue-700 text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {editMode && (
              <div className="mt-5 pt-4 border-t grid grid-cols-2 gap-3">
                {[
                  { key: "firstName", label: "First Name" },
                  { key: "lastName", label: "Last Name" },
                  { key: "companyName", label: "Company Name" },
                  { key: "email", label: "Email", type: "email" },
                  { key: "phone", label: "Phone" },
                  { key: "mobile", label: "Mobile" },
                  { key: "billingStreet", label: "Street" },
                  { key: "billingSuburb", label: "Suburb" },
                  { key: "billingState", label: "State" },
                  { key: "billingPostcode", label: "Postcode" },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <input
                      type={type ?? "text"}
                      value={editData[key] ?? ""}
                      onChange={(e) => setEditData((p: any) => ({ ...p, [key]: e.target.value }))}
                      className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Internal Notes</label>
                  <textarea
                    value={editData.internalNotes ?? ""}
                    onChange={(e) => setEditData((p: any) => ({ ...p, internalNotes: e.target.value }))}
                    rows={2}
                    className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button size="sm" onClick={() => patchMutation.mutate(editData)} disabled={patchMutation.isPending}>
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Revenue", value: formatCurrency(totalRevenue) },
            { label: "Open Balance", value: formatCurrency(openBalance), highlight: openBalance > 0 },
            { label: "Total Jobs", value: String(customer._count?.jobs ?? 0) },
            { label: "Total Invoices", value: String(customer._count?.invoices ?? 0) },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-xl font-bold mt-0.5", s.highlight ? "text-red-600" : "")}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b flex gap-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Properties */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Home className="w-4 h-4" /> Properties
                  <Link href={`/customers/${id}/properties/new`} className="ml-auto">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                {customer.properties?.length > 0 ? (
                  customer.properties.map((p: any) => (
                    <div key={p.id} className="flex items-start gap-2 py-2 border-b last:border-0">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{p.streetAddress}</p>
                        <p className="text-xs text-muted-foreground">{p.suburb}{p.state ? `, ${p.state}` : ""} {p.postcode}</p>
                        {p.isPrimary && <Badge className="bg-green-50 text-green-700 text-xs mt-0.5">Primary</Badge>}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No properties.</p>
                )}
              </CardContent>
            </Card>

            {/* Recent jobs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Recent Jobs
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                {(customer._count?.jobs ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No jobs yet.</p>
                ) : (
                  <Link href="#" onClick={() => setTab("jobs")} className="text-sm text-primary hover:underline">
                    View all {customer._count?.jobs} jobs →
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {customer.internalNotes && (
              <Card className="col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Internal Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{customer.internalNotes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "jobs" && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-medium">Jobs ({jobs.length})</p>
                <Link href={`/jobs?newFor=${id}`}>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Job</Button>
                </Link>
              </div>
              {jobs.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No jobs yet.</p>
              ) : (
                jobs.map((j: any) => (
                  <Link key={j.id} href={`/jobs/${j.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{j.title}</p>
                      <p className="text-xs text-muted-foreground">{j.jobNumber} · {formatDate(j.scheduledStart ?? j.createdAt)}</p>
                    </div>
                    <Badge className={cn("text-xs flex-shrink-0", statusColor(j.status))}>{j.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {tab === "quotes" && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-medium">Quotes ({quotes.length})</p>
                <Link href={`/quotes/new?customerId=${id}`}>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Quote</Button>
                </Link>
              </div>
              {quotes.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No quotes yet.</p>
              ) : (
                quotes.map((q: any) => (
                  <Link key={q.id} href={`/quotes/${q.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{q.quoteNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{q.title}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(q.totalCents)}</p>
                      <Badge className={cn("text-xs", statusColor(q.status))}>{q.status}</Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {tab === "invoices" && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-medium">Invoices ({invoices.length})</p>
              </div>
              {invoices.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                invoices.map((inv: any) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(inv.totalCents)}</p>
                      <Badge className={cn("text-xs", statusColor(inv.status))}>{inv.status}</Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {tab === "activity" && (
          <Card>
            <CardContent className="p-4">
              {!activity ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (activity as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded.</p>
              ) : (
                <div className="space-y-3">
                  {(activity as any[]).map((a: any, i: number) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p>{a.description ?? a.type}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(a.createdAt ?? a.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
