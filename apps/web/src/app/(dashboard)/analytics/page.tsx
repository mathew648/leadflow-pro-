"use client";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  active: "#3B82F6",
  contacted: "#8B5CF6",
  converted: "#10B981",
  lost: "#EF4444",
  won: "#10B981",
};

const SOURCE_COLORS = [
  "#3B82F6", "#1877F2", "#EA4335", "#10B981", "#8B5CF6",
  "#F59E0B", "#06B6D4", "#EC4899", "#6B7280",
];

export default function AnalyticsPage() {
  const { data: dashboard } = useQuery({
    queryKey: ["analytics", "dashboard", "quarter"],
    queryFn: () => api.get<any>("/analytics/dashboard?period=quarter"),
  });

  const { data: revenue } = useQuery({
    queryKey: ["analytics", "revenue"],
    queryFn: () => api.get<any[]>("/analytics/revenue?groupBy=month"),
  });

  const { data: leads } = useQuery({
    queryKey: ["analytics", "leads"],
    queryFn: () => api.get<any>("/analytics/leads"),
  });

  const { data: insights } = useQuery({
    queryKey: ["analytics", "insights"],
    queryFn: () => api.get<any>("/ai/insights"),
  });

  const revenueChart = (revenue ?? []).map((r: any) => ({
    month: new Date(r.period).toLocaleDateString("en-AU", { month: "short" }),
    revenue: r.amount / 100,
    jobs: r.count,
  }));

  const leadStatusData = (leads?.byStatus ?? []).map((s: any) => ({
    name: s.status,
    value: s._count,
    color: STATUS_COLORS[s.status] ?? "#6B7280",
  }));

  const leadSourceData = (leads?.bySource ?? []).map((s: any, i: number) => ({
    name: s.source.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    count: s._count,
    fill: SOURCE_COLORS[i % SOURCE_COLORS.length],
  }));

  const metrics = dashboard?.metrics;

  return (
    <div>
      <Topbar title="Analytics" />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Leads (90d)", value: String(metrics?.leadsThisPeriod ?? 0) },
            { label: "Jobs Completed", value: String(metrics?.jobsCompleted ?? 0) },
            { label: "Revenue (90d)", value: formatCurrency(metrics?.revenueCents ?? 0) },
            { label: "Conversion Rate", value: `${leads?.conversionRate ?? 0}%` },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold mt-1">{m.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueChart} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Two charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lead sources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={leadSourceData} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {leadSourceData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Lead status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={leadStatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {leadStatusData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        {insights?.insights?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Business Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {insights.insights.map((insight: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-gray-700">{insight}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
