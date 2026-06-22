"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import Link from "next/link";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const STATUS_ICON: Record<string, React.ElementType> = {
  draft: FileText,
  sent: Send,
  approved: CheckCircle,
  rejected: XCircle,
  expired: Clock,
};

export default function QuotesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", search, status],
    queryFn: () => api.get<any>(
      `/quotes?search=${encodeURIComponent(search)}&${status ? `status=${status}&` : ""}limit=50`
    ),
  });

  const quotes: any[] = (Array.isArray(data) ? data : (data?.data ?? []));

  return (
    <div>
      <Topbar title="Quotes" action={{ label: "New Quote", onClick: () => router.push("/quotes/new") }} />

      {/* Status tabs */}
      <div className="flex items-center gap-1 px-4 lg:px-6 pt-4 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              status === tab.value
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b bg-white mt-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search quotes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <span className="text-sm text-muted-foreground">{data?.meta?.total ?? 0} quotes</span>
      </div>

      <div className="p-4 lg:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quote #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotes.map((q: any) => {
                  const Icon = STATUS_ICON[q.status] ?? FileText;
                  const isExpired = q.expiresAt && new Date(q.expiresAt) < new Date();
                  return (
                    <Link key={q.id} href={`/quotes/${q.id}`} legacyBehavior>
                      <tr className="hover:bg-muted/30 cursor-pointer transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-mono font-medium">{q.quoteNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{q.customer?.firstName} {q.customer?.lastName}</p>
                          {q.customer?.companyName && <p className="text-xs text-muted-foreground">{q.customer.companyName}</p>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColor(q.status))}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(q.totalCents)}</td>
                        <td className={cn("px-4 py-3 text-xs hidden lg:table-cell", isExpired ? "text-red-500" : "text-muted-foreground")}>
                          {formatDate(q.expiresAt)}
                        </td>
                      </tr>
                    </Link>
                  );
                })}
              </tbody>
            </table>
            {quotes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No quotes yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
