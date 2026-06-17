"use client";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Users2, Briefcase, DollarSign,
  AlertCircle, ArrowRight, CheckCircle2, Clock,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime, statusColor, cn } from "@/lib/utils";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const SOURCE_COLORS: Record<string, string> = {
  meta_ads: "#1877F2",
  google_ads: "#EA4335",
  website: "#10B981",
  referral: "#8B5CF6",
  phone: "#F59E0B",
  sms: "#06B6D4",
  manual: "#6B7280",
};

function MetricCard({
  title, value, change, icon: Icon, color, href,
}: {
  title: string;
  value: string;
  change?: number | null;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change !== undefined && change !== null && (
              <div className={cn("flex items-center gap-1 mt-1 text-xs font-medium", change >= 0 ? "text-green-600" : "text-red-600")}>
                {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(change)}% vs last period
              </div>
            )}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {href && (
          <Link href={href} className="text-xs text-primary hover:underline flex items-center gap-1 mt-3">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.get<any>("/analytics/dashboard?period=month"),
    refetchInterval: 60000,
  });

  const { data: revenueData } = useQuery({
    queryKey: ["analytics", "revenue"],
    queryFn: () => api.get<any[]>("/analytics/revenue?groupBy=month"),
  });

  const metrics = dashboard?.metrics;

  if (isLoading) {
    return (
      <div>
        <Topbar title="Dashboard" />
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const leadsBySource = (dashboard?.leadsBySource ?? []).map((s: any) => ({
    name: s.source.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    value: s.count,
    color: SOURCE_COLORS[s.source] ?? "#6B7280",
  }));

  const chartData = (revenueData ?? []).map((r: any) => ({
    period: new Date(r.period).toLocaleDateString("en-AU", { month: "short", year: "2-digit" }),
    revenue: r.amount / 100,
    jobs: r.count,
  }));

  return (
    <div>
      <Topbar title="Dashboard" />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Guided setup checklist for new tradies */}
        <OnboardingChecklist />

        {/* Trial banner */}
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-brand-600" />
            <div>
              <p className="text-sm font-medium text-brand-900">Free trial active — 14 days remaining</p>
              <p className="text-xs text-brand-600">Upgrade to keep all your data and unlock unlimited leads</p>
            </div>
          </div>
          <Link href="/settings?tab=billing"><Button size="sm" className="flex-shrink-0">Upgrade now</Button></Link>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="New Leads (30d)"
            value={String(metrics?.leadsThisPeriod ?? 0)}
            change={metrics?.leadChange}
            icon={Users2}
            color="bg-blue-100 text-blue-600"
            href="/leads"
          />
          <MetricCard
            title="Jobs Completed"
            value={String(metrics?.jobsCompleted ?? 0)}
            change={metrics?.jobsChange}
            icon={CheckCircle2}
            color="bg-green-100 text-green-600"
            href="/jobs"
          />
          <MetricCard
            title="Revenue (30d)"
            value={formatCurrency(metrics?.revenueCents ?? 0)}
            change={metrics?.revenueChange}
            icon={DollarSign}
            color="bg-emerald-100 text-emerald-600"
            href="/invoices"
          />
          <MetricCard
            title="Active Jobs"
            value={String(metrics?.activeJobs ?? 0)}
            icon={Briefcase}
            color="bg-purple-100 text-purple-600"
            href="/jobs"
          />
        </div>

        {/* Overdue invoices alert */}
        {metrics?.overdueInvoicesCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  {metrics.overdueInvoicesCount} overdue invoice{metrics.overdueInvoicesCount !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-red-600">
                  {formatCurrency(metrics.overdueAmountCents)} outstanding
                </p>
              </div>
            </div>
            <Link href="/invoices?overdue=true">
              <Button size="sm" variant="destructive">Chase payments</Button>
            </Link>
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Revenue (12 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fill="url(#colorRev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Lead sources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Sources (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              {leadsBySource.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={leadsBySource} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {leadsBySource.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend iconSize={10} iconType="circle" formatter={(v) => <span className="text-xs">{v}</span>} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  No leads yet — add your first lead!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent jobs */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Jobs</CardTitle>
            <Link href="/jobs" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {dashboard?.recentJobs?.length > 0 ? (
              <div className="divide-y">
                {dashboard.recentJobs.slice(0, 8).map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-6 px-6 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.customer?.firstName} {job.customer?.lastName}
                          {job.scheduledStart && (
                            <> · <Clock className="w-3 h-3 inline" /> {formatDateTime(job.scheduledStart)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", statusColor(job.status))}>
                      {job.status.replace(/_/g, " ")}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No jobs yet. <Link href="/jobs" className="text-primary hover:underline">Create your first job</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
