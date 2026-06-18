"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api, getToken } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { cn, initials } from "@/lib/utils";
import { useRef } from "react";
import { User, Building2, Users, CreditCard, Plug, Settings2, GitBranch, Plus, Trash2, Upload, Inbox, Copy } from "lucide-react";
import { EnableNotifications } from "@/components/enable-notifications";
import { QRCodeSVG } from "qrcode.react";

const TABS = [
  { id: "profile",   label: "Profile",     icon: User },
  { id: "business",  label: "Business",    icon: Building2 },
  { id: "leadsources", label: "Lead Sources", icon: Inbox },
  { id: "documents", label: "Documents",   icon: Settings2 },
  { id: "pipeline",  label: "Pipeline",    icon: GitBranch },
  { id: "users",     label: "Team",        icon: Users },
  { id: "billing",   label: "Billing",     icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Plug },
];

/* ─── Profile ─── */
function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", phone: user?.phone ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.patch("/auth/me", data),
    onSuccess: () => toast({ title: "Profile updated" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testEmail = useMutation({
    mutationFn: () => api.post<any>("/tenant/test-email", {}),
    onSuccess: (r: any) => {
      const d = r?.data ?? r;
      if (d?.sent) toast({ title: "Test email sent", description: `Check the inbox for ${d.to}` });
      else toast({ title: "Email not sent", description: d?.reason ?? "Email isn't configured yet", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "Couldn't send test", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-brand-500 text-white text-2xl font-bold flex items-center justify-center">
            {user ? initials(user.firstName, user.lastName) : "?"}
          </div>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input {...register("firstName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input {...register("lastName")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="opacity-60" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...register("phone")} placeholder="+61 4xx xxx xxx" />
          </div>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>Save changes</Button>
        </form>

        <div className="border-t pt-4">
          <Label className="text-sm font-semibold">Email delivery</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">
            Send yourself a test to confirm quotes, invoices &amp; auto-replies can be emailed.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => testEmail.mutate()}
            disabled={testEmail.isPending}
          >
            {testEmail.isPending ? "Sending…" : "Send test email"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Business ─── */
function BusinessTab() {
  const qc = useQueryClient();
  const { data: tenantData } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<any>("/tenant"),
  });
  const tenant = tenantData?.data;

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    values: tenant ? {
      businessName: tenant.businessName ?? "",
      phone: tenant.phone ?? "",
      abn: tenant.abn ?? "",
      streetAddress: tenant.streetAddress ?? "",
      suburb: tenant.suburb ?? "",
      state: tenant.state ?? "",
      postcode: tenant.postcode ?? "",
      timezone: tenant.timezone ?? "Australia/Sydney",
      primaryColor: tenant.primaryColor ?? "#2563EB",
    } : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.patch("/tenant", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant"] }); toast({ title: "Business details updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Logo upload: presigned direct-to-R2 upload, then confirm (persists tenant.logoUrl).
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = getToken();
      const auth = token ? { Authorization: `Bearer ${token}` } : undefined;
      const pre: any = await api.post("/upload/presigned", {
        filename: file.name, contentType: file.type, category: "logo",
      });
      const put = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("Upload failed (storage not configured?)");
      await api.post("/upload/confirm", {
        key: pre.key, publicUrl: pre.publicUrl, category: "logo", entityType: "tenant",
      });
      return pre.publicUrl as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant"] }); toast({ title: "Logo updated" }); },
    onError: (e: any) => toast({ title: "Logo upload failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Details</CardTitle>
        <CardDescription>Shown on quotes and invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Business name</Label>
            <Input {...register("businessName")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>ABN / Tax Number</Label>
              <Input {...register("abn")} placeholder="12 345 678 901" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Street address</Label>
            <Input {...register("streetAddress")} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Suburb</Label>
              <Input {...register("suburb")} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input {...register("state")} />
            </div>
            <div className="space-y-1.5">
              <Label>Postcode</Label>
              <Input {...register("postcode")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <select {...register("timezone")} className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              <option value="Australia/Melbourne">Australia/Melbourne</option>
              <option value="Australia/Brisbane">Australia/Brisbane</option>
              <option value="Australia/Perth">Australia/Perth</option>
              <option value="Australia/Adelaide">Australia/Adelaide</option>
              <option value="Pacific/Auckland">Pacific/Auckland (NZST)</option>
            </select>
          </div>
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold">Branding</Label>
            <p className="text-xs text-muted-foreground -mt-1">Your logo and colour appear on quotes, invoices and customer emails.</p>
            <div className="flex items-center gap-4">
              {tenant?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-contain border bg-white" />
              ) : (
                <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground text-xs">Logo</div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) logoMutation.mutate(f); e.target.value = ""; }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoMutation.isPending}>
                <Upload className="w-4 h-4 mr-1.5" />
                {logoMutation.isPending ? "Uploading…" : "Upload logo"}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Brand colour</Label>
              <div className="flex items-center gap-3">
                <input type="color" {...register("primaryColor")} className="h-9 w-14 rounded border cursor-pointer p-0.5" />
                <Input {...register("primaryColor")} placeholder="#2563EB" className="w-32 font-mono" />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting || mutation.isPending}>Save changes</Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── Documents (Invoice & Quote settings) ─── */
function DocumentsTab() {
  const qc = useQueryClient();
  const { data: tenantData } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<any>("/tenant"),
  });
  const settings = tenantData?.data?.settings;

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    values: settings ? {
      invoicePrefix: settings.invoicePrefix ?? "INV",
      invoicePaymentTerms: settings.invoicePaymentTerms ?? 14,
      invoiceFooterText: settings.invoiceFooterText ?? "",
      quotePrefix: settings.quotePrefix ?? "QT",
      quoteValidityDays: settings.quoteValidityDays ?? 30,
      quoteDepositPercent: settings.quoteDepositPercent ?? 0,
      quoteTermsConditions: settings.quoteTermsConditions ?? "",
      requireCustomerSignoff: settings.requireCustomerSignoff ?? false,
      notifyNewLeadEmail: settings.notifyNewLeadEmail ?? true,
      notifyNewLeadSms: settings.notifyNewLeadSms ?? false,
      notifyQuoteViewed: settings.notifyQuoteViewed ?? true,
      notifyQuoteApproved: settings.notifyQuoteApproved ?? true,
      notifyPaymentReceived: settings.notifyPaymentReceived ?? true,
      autoSendReviewRequest: settings.autoSendReviewRequest ?? false,
      reviewRequestDelayHours: settings.reviewRequestDelayHours ?? 24,
      googleReviewUrl: settings.googleReviewUrl ?? "",
    } : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.patch("/tenant/settings", {
      ...data,
      invoicePaymentTerms: Number(data.invoicePaymentTerms),
      quoteValidityDays: Number(data.quoteValidityDays),
      quoteDepositPercent: Number(data.quoteDepositPercent),
      reviewRequestDelayHours: Number(data.reviewRequestDelayHours),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant"] }); toast({ title: "Settings saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Invoice number prefix</Label>
              <Input {...register("invoicePrefix")} placeholder="INV" />
            </div>
            <div className="space-y-1.5">
              <Label>Default payment terms (days)</Label>
              <Input type="number" {...register("invoicePaymentTerms")} min="0" max="365" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Invoice footer / bank details</Label>
            <textarea
              {...register("invoiceFooterText")}
              rows={3}
              placeholder="Bank: ANZ&#10;BSB: 012-345&#10;Account: 123456789"
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Quotes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Quote number prefix</Label>
              <Input {...register("quotePrefix")} placeholder="QT" />
            </div>
            <div className="space-y-1.5">
              <Label>Default validity (days)</Label>
              <Input type="number" {...register("quoteValidityDays")} min="1" max="365" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Default deposit %</Label>
            <Input type="number" {...register("quoteDepositPercent")} min="0" max="100" step="5" />
          </div>
          <div className="space-y-1.5">
            <Label>Default terms & conditions</Label>
            <textarea
              {...register("quoteTermsConditions")}
              rows={4}
              placeholder="Standard terms…"
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register("requireCustomerSignoff")} className="rounded" />
            Require customer digital signature on quotes
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notifications & Automations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register("notifyNewLeadEmail")} className="rounded" />
            Email me when a new lead comes in
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register("notifyNewLeadSms")} className="rounded" />
            SMS me when a new lead comes in
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register("notifyQuoteViewed")} className="rounded" />
            Notify me when a customer views a quote
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register("notifyQuoteApproved")} className="rounded" />
            Notify me when a customer approves a quote
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register("notifyPaymentReceived")} className="rounded" />
            Notify me when a payment is received
          </label>
          <div className="pt-2 border-t mt-2">
            <EnableNotifications />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register("autoSendReviewRequest")} className="rounded" />
            Automatically request a review after job completion
          </label>
          <div className="space-y-1.5">
            <Label>Review request delay (hours after completion)</Label>
            <Input type="number" {...register("reviewRequestDelayHours")} min="0" max="168" className="max-w-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Google review link</Label>
            <Input {...register("googleReviewUrl")} placeholder="https://g.page/r/your-review-link" />
            <p className="text-xs text-muted-foreground">
              From your Google Business Profile → &ldquo;Get more reviews&rdquo; → copy the link. Needed for review requests to send.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting || mutation.isPending}>Save all settings</Button>
    </form>
  );
}

/* ─── Pipeline Stages ─── */
function PipelineTab() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");

  const { data } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => api.get<any>("/tenant/pipeline-stages"),
  });
  const stages: any[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => api.post("/tenant/pipeline-stages", {
      name: newName, color: newColor, position: stages.length,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      setNewName("");
      toast({ title: "Stage added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Stages</CardTitle>
        <CardDescription>Customise your sales pipeline columns</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="divide-y">
          {stages.map((s: any, i: number) => (
            <div key={s.id} className="flex items-center gap-3 py-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color ?? "#6B7280" }} />
              <span className="text-sm font-medium flex-1">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.slaHours ? `${s.slaHours}h SLA` : ""}</span>
              <span className="text-xs text-muted-foreground">Position {i + 1}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Add new stage</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border"
            />
            <Input
              placeholder="Stage name (e.g. Proposal Sent)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName || createMutation.isPending}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Team ─── */
function TeamTab() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "technician" });
  const [inviteLink, setInviteLink] = useState<{ url: string; emailSent: boolean } | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ["tenant-users"],
    queryFn: () => api.get<any>("/tenant/users"),
  });
  const users: any[] = usersData?.data ?? [];

  const inviteMutation = useMutation({
    mutationFn: () => api.post<any>("/tenant/users/invite", form),
    onSuccess: (res: any) => {
      const d = res?.data ?? res;
      qc.invalidateQueries({ queryKey: ["tenant-users"] });
      setInviteOpen(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", role: "technician" });
      if (d?.acceptUrl) setInviteLink({ url: d.acceptUrl, emailSent: Boolean(d.emailSent) });
      toast({ title: d?.emailSent ? "Invite emailed!" : "Invite created — share the link below" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const ROLE_COLOR: Record<string, string> = {
    owner: "bg-purple-100 text-purple-800",
    admin: "bg-blue-100 text-blue-800",
    manager: "bg-green-100 text-green-800",
    technician: "bg-yellow-100 text-yellow-800",
    sales: "bg-orange-100 text-orange-800",
    viewer: "bg-gray-100 text-gray-600",
  };

  const canInvite = form.firstName && form.lastName && form.email;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>{users.length} user{users.length !== 1 ? "s" : ""}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Invite user
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {users.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {initials(u.firstName, u.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", ROLE_COLOR[u.role] ?? "bg-gray-100")}>
                  {u.role}
                </span>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                  u.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
                  {u.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {inviteLink && (
        <Card className="border-brand-200 bg-brand-50/40">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">
              {inviteLink.emailSent ? "✅ Invite email sent. You can also share this link:" : "Share this invite link with your teammate:"}
            </p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-white border rounded-md px-3 py-2 overflow-x-auto">{inviteLink.url}</code>
              <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(inviteLink.url); toast({ title: "Invite link copied" }); }}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">They&apos;ll set their password and join your team. Link expires in 7 days.</p>
          </CardContent>
        </Card>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-lg">Invite Team Member</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">First Name *</label>
                <Input
                  autoFocus
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="mt-0.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Last Name *</label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="mt-0.5"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email *</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full mt-0.5 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="technician">Technician</option>
                <option value="sales">Sales</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer (read-only)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={() => inviteMutation.mutate()} disabled={!canInvite || inviteMutation.isPending}>
                {inviteMutation.isPending ? "Inviting…" : "Send Invite"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Integrations ─── */
function IntegrationsTab() {
  const { data: connections } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.get<any[]>("/integrations"),
  });

  const integrations = [
    { id: "xero",     name: "Xero",     description: "Sync invoices and contacts to Xero accounting",         logo: "X" },
    { id: "myob",     name: "MYOB",     description: "Sync to MYOB AccountRight or Essentials",               logo: "M" },
    { id: "stripe",   name: "Stripe",   description: "Accept card payments online on quotes and invoices",    logo: "S" },
    { id: "windcave", name: "Windcave", description: "NZ payment gateway for card processing",                logo: "W" },
  ];

  const connect = useMutation({
    mutationFn: async (id: string) => {
      if (id === "xero" || id === "myob") return api.get<any>(`/integrations/${id}/connect`);
      if (id === "stripe") return api.get<any>("/integrations/stripe/setup");
      throw new Error("This integration is coming soon");
    },
    onSuccess: (r: any) => {
      const url = r?.authUrl ?? r?.url;
      if (url) window.location.href = url;
      else toast({ title: "Couldn't start connection", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: e.message ?? "Coming soon" }),
  });
  const importData = useMutation({
    mutationFn: (id: string) => api.post<any>(`/integrations/${id}/import`, {}),
    onSuccess: (r: any) => {
      const d = r?.data ?? r;
      toast({ title: "Import complete", description: `${d?.customers ?? 0} customers and ${d?.items ?? 0} price items imported` });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });
  const connList = Array.isArray(connections) ? connections : (connections as any)?.data ?? [];

  return (
    <div className="space-y-4">
      {integrations.map((integration) => {
        const conn = connList.find((c: any) => c.provider === integration.id);
        return (
          <Card key={integration.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {integration.logo}
                  </div>
                  <div>
                    <p className="font-medium">{integration.name}</p>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {conn?.status === "active" ? (
                    <>
                      {(integration.id === "xero" || integration.id === "myob") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={importData.isPending}
                          onClick={() => importData.mutate(integration.id)}
                          title="Import your existing customers & price list"
                        >
                          {importData.isPending ? "Importing…" : "Import data"}
                        </Button>
                      )}
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Connected
                      </span>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={connect.isPending || integration.id === "windcave"}
                      onClick={() => connect.mutate(integration.id)}
                    >
                      {integration.id === "windcave" ? "Coming soon" : "Connect"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Lead Sources ─── */
function LeadSourcesTab() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const slug = user?.tenant?.slug;
  const quoteUrl = slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/q/${slug}` : "";
  const { data: webForm } = useQuery({ queryKey: ["web-form"], queryFn: () => api.get<any>("/leads/web-form") });
  const { data: googleHook } = useQuery({ queryKey: ["google-webhook"], queryFn: () => api.get<any>("/leads/google-ads-webhook") });
  const { data: metaStatus } = useQuery({ queryKey: ["meta-status"], queryFn: () => api.get<any>("/integrations/meta/status") });
  const { data: inboundEmail } = useQuery({ queryKey: ["inbound-email"], queryFn: () => api.get<any>("/leads/inbound-email") });

  const wf = (webForm?.data ?? webForm) ?? {};
  const gh = (googleHook?.data ?? googleHook) ?? {};
  const ie = (inboundEmail?.data ?? inboundEmail) ?? {};
  const ms = (metaStatus?.data ?? metaStatus) ?? {};
  const [selectedPage, setSelectedPage] = useState<string>("");

  const metaConnect = useMutation({
    mutationFn: () => api.get<any>("/integrations/meta/connect"),
    onSuccess: (r: any) => { const url = (r?.data ?? r)?.authUrl; if (url) window.location.href = url; else toast({ title: "Meta isn't configured on the server yet", variant: "destructive" }); },
    onError: (e: any) => toast({ title: e.message ?? "Meta not configured", variant: "destructive" }),
  });
  const metaSubscribe = useMutation({
    mutationFn: (pageId: string) => api.post<any>("/integrations/meta/subscribe", { pageId }),
    onSuccess: () => { toast({ title: "Facebook Page connected!" }); qc.invalidateQueries({ queryKey: ["meta-status"] }); },
    onError: (e: any) => toast({ title: "Couldn't connect Page", description: e.message, variant: "destructive" }),
  });
  const metaDisconnect = useMutation({
    mutationFn: () => api.delete<any>("/integrations/meta"),
    onSuccess: () => { toast({ title: "Facebook disconnected" }); qc.invalidateQueries({ queryKey: ["meta-status"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const clearVerification = useMutation({
    mutationFn: () => api.post<any>("/leads/inbound-email/clear-verification", {}),
    onSuccess: () => { toast({ title: "Dismissed" }); qc.invalidateQueries({ queryKey: ["inbound-email"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const CopyBtn = ({ text, label }: { text: string; label: string }) => (
    <Button type="button" variant="outline" size="sm" onClick={() => copy(text, label)} disabled={!text}>
      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
    </Button>
  );

  const codeBox = "block w-full text-xs font-mono bg-muted rounded-md p-3 overflow-x-auto whitespace-pre";

  return (
    <div className="space-y-5">
      {/* Hosted quote page — no website needed */}
      <Card className="border-brand-200">
        <CardHeader>
          <CardTitle className="text-base">⚡ Your quote page (no website needed)</CardTitle>
          <CardDescription>Share this link anywhere — Google profile, Instagram bio, email signature, or print the QR on your van. Every request becomes a lead.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex-1 w-full space-y-3">
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 overflow-x-auto">{quoteUrl || "…"}</code>
                <CopyBtn text={quoteUrl} label="Quote page link" />
              </div>
              <div className="flex gap-2">
                <a href={quoteUrl || "#"} target="_blank" rel="noopener noreferrer">
                  <Button type="button" size="sm" disabled={!quoteUrl}>Open my page</Button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground">Tip: add it as a &ldquo;Get a Quote&rdquo; button on your site, or text it straight to a customer.</p>
            </div>
            {quoteUrl && (
              <div className="text-center">
                <div className="bg-white p-2 rounded-lg border inline-block">
                  <QRCodeSVG value={quoteUrl} size={116} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Scan to open</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Website form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🌐 Embed on your website</CardTitle>
          <CardDescription>Prefer it built into your site? Paste this — every submission becomes a lead with an instant auto-reply.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className={codeBox}>{wf.embedSnippet ?? "Loading…"}</pre>
          <div className="flex items-center gap-2">
            <CopyBtn text={wf.embedSnippet ?? ""} label="Form code" />
            {wf.lastEventAt && <span className="text-xs text-muted-foreground">Last lead received: {new Date(wf.lastEventAt).toLocaleString("en-AU")}</span>}
          </div>
          <p className="text-xs text-muted-foreground">Add it to your contact page or footer. Works on any website (Wix, Squarespace, WordPress, custom).</p>
        </CardContent>
      </Card>

      {/* Email-to-Lead — import from Builderscrack/hipages/etc. */}
      <Card className="border-brand-200">
        <CardHeader>
          <CardTitle className="text-base">📥 Import leads from any portal (Builderscrack, hipages…)</CardTitle>
          <CardDescription>Forward your lead-platform notification emails here and they become leads automatically — with auto-reply &amp; follow-ups, all in one inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Your lead-import email address</Label>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 overflow-x-auto">{ie.address ?? "…"}</code>
              <CopyBtn text={ie.address ?? ""} label="Lead-import address" />
            </div>
            {ie.lastEventAt && <span className="text-xs text-muted-foreground">Last lead received: {new Date(ie.lastEventAt).toLocaleString("en-AU")}</span>}
          </div>
          {/* Captured forwarding-verification code (Gmail/Outlook) */}
          {ie.verification && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-900">⏳ Forwarding confirmation received</p>
              {ie.verification.code && (
                <p className="text-sm text-amber-900">Confirmation code: <strong className="font-mono">{ie.verification.code}</strong> <CopyBtn text={ie.verification.code} label="Code" /></p>
              )}
              <div className="flex flex-wrap gap-2">
                {ie.verification.link && (
                  <a href={ie.verification.link} target="_blank" rel="noopener noreferrer">
                    <Button type="button" size="sm">Confirm forwarding →</Button>
                  </a>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => clearVerification.mutate()} disabled={clearVerification.isPending}>Dismiss</Button>
              </div>
              <p className="text-xs text-amber-800">Paste the code into Gmail/Outlook, or click Confirm. Then your portal leads will flow in automatically.</p>
            </div>
          )}

          {/* How-to guide */}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">How to forward your portal leads →</summary>
            <div className="mt-2 space-y-2 pl-1">
              <p><strong>Option A — set it in the portal:</strong> In Builderscrack / hipages / NoCowboys / Oneflare account settings, set your lead/job notification email to the address above.</p>
              <p><strong>Option B — auto-forward from your inbox:</strong></p>
              <p className="pl-3"><strong>Gmail:</strong> Settings → Filters → Create filter → From: <code className="bg-muted px-1 rounded">builderscrack.co.nz</code> (etc.) → Forward to → your address above. Gmail sends a confirmation code — it appears right here for you to confirm.</p>
              <p className="pl-3"><strong>Outlook:</strong> Settings → Rules → Add rule → From contains the portal → Forward to → your address above.</p>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Google Ads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔍 Google Ads Lead Forms</CardTitle>
          <CardDescription>Capture leads from Google Lead Form ads automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Webhook URL</Label>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 overflow-x-auto">{gh.webhookUrl ?? "…"}</code>
              <CopyBtn text={gh.webhookUrl ?? ""} label="Webhook URL" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Key</Label>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 overflow-x-auto">{gh.googleKey ?? "…"}</code>
              <CopyBtn text={gh.googleKey ?? ""} label="Key" />
            </div>
          </div>
          <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
            <li>In Google Ads, open your Lead Form asset → <strong>Data &amp; integration → Webhook</strong>.</li>
            <li>Paste the <strong>Webhook URL</strong> and <strong>Key</strong> above.</li>
            <li>Click <strong>Send test data</strong> — a test lead should appear in your Leads.</li>
          </ol>
        </CardContent>
      </Card>

      {/* Meta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📣 Meta (Facebook / Instagram) Lead Ads</CardTitle>
          <CardDescription>Connect your Facebook Page to capture lead-form ad submissions automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ms.connected ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Connected to <strong>{ms.pageName}</strong>
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => metaDisconnect.mutate()} disabled={metaDisconnect.isPending}>
                Disconnect
              </Button>
            </div>
          ) : Array.isArray(ms.pages) && ms.pages.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm">Choose which Facebook Page to connect:</p>
              <div className="flex gap-2">
                <select
                  aria-label="Facebook Page"
                  value={selectedPage}
                  onChange={(e) => setSelectedPage(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border rounded-md"
                >
                  <option value="">Select a Page…</option>
                  {ms.pages.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Button type="button" size="sm" disabled={!selectedPage || metaSubscribe.isPending} onClick={() => metaSubscribe.mutate(selectedPage)}>
                  {metaSubscribe.isPending ? "Connecting…" : "Connect Page"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Button type="button" onClick={() => metaConnect.mutate()} disabled={metaConnect.isPending}>
                {metaConnect.isPending ? "Opening Facebook…" : "Connect Facebook"}
              </Button>
              <p className="text-xs text-muted-foreground">
                You&apos;ll sign in with Facebook and pick the Page running your lead ads. Requires the platform&apos;s Meta
                app to be set up (see admin).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Billing ─── */
function BillingTab() {
  const { data: tenantData } = useQuery({ queryKey: ["tenant"], queryFn: () => api.get<any>("/tenant") });
  const { data: plans } = useQuery({ queryKey: ["billing-plans"], queryFn: () => api.get<any>("/billing/plans") });
  const sub = tenantData?.subscription ?? tenantData?.data?.subscription;
  const currentTier = sub?.tier ?? "starter";
  const status = sub?.status ?? "trialing";
  const planList: any[] = Array.isArray(plans) ? plans : plans?.data ?? [];
  const [annual, setAnnual] = useState(false);

  const checkout = useMutation({
    mutationFn: (plan: string) => api.post<any>("/billing/checkout", { plan, cycle: annual ? "annual" : "monthly" }),
    onSuccess: (r: any) => { if (r?.url) window.location.href = r.url; },
    onError: (e: any) => toast({ title: "Couldn't start checkout", description: e.message, variant: "destructive" }),
  });
  const portal = useMutation({
    mutationFn: () => api.post<any>("/billing/portal", {}),
    onSuccess: (r: any) => { if (r?.url) window.location.href = r.url; },
    onError: (e: any) => toast({ title: "Couldn't open billing portal", description: e.message, variant: "destructive" }),
  });

  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
          <CardDescription>
            Current plan: <span className="font-semibold capitalize">{currentTier}</span>
            {" · "}<span className="capitalize">{status}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Billing cycle toggle */}
          <div className="flex items-center gap-2 mb-4 text-sm">
            <span className={annual ? "text-muted-foreground" : "font-semibold"}>Monthly</span>
            <button type="button" onClick={() => setAnnual((a) => !a)} className="relative w-12 h-6 rounded-full bg-primary" aria-label="Toggle annual billing">
              <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", annual ? "left-7" : "left-1")} />
            </button>
            <span className={annual ? "font-semibold" : "text-muted-foreground"}>Annual <span className="text-green-600">· 2 months free</span></span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {planList.map((p) => {
              const isCurrent = p.id === currentTier && status === "active";
              const cents = annual ? (p.annualCents ?? p.priceCents * 10) : p.priceCents;
              return (
                <div key={p.id} className={cn("rounded-xl border p-5", isCurrent && "ring-1 ring-primary border-primary")}>
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  <p className="mt-1 text-2xl font-bold">{money(cents, p.currency)}<span className="text-sm font-normal text-muted-foreground">{annual ? "/yr" : "/mo"}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Up to {p.maxUsers} user{p.maxUsers === 1 ? "" : "s"}{annual ? ` · save ${money(p.priceCents * 2, p.currency)}` : ""}</p>
                  <Button
                    className="w-full mt-4"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || checkout.isPending}
                    onClick={() => checkout.mutate(p.id)}
                  >
                    {isCurrent ? "Current plan" : checkout.isPending ? "Redirecting…" : "Choose plan"}
                  </Button>
                </div>
              );
            })}
          </div>
          {sub?.stripeCustomerId && (
            <Button variant="outline" size="sm" className="mt-5" onClick={() => portal.mutate()} disabled={portal.isPending}>
              Manage billing & payment method
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Secure checkout by Stripe. You can cancel anytime from the billing portal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Page ─── */
export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab")! : "profile";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div>
      <Topbar title="Settings" />

      <div className="flex gap-6 p-4 lg:p-6">
        {/* Sidebar nav */}
        <div className="w-48 flex-shrink-0 hidden md:block">
          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors",
                  activeTab === id
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Mobile select */}
        <div className="md:hidden w-full mb-4">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "profile"      && <ProfileTab />}
          {activeTab === "business"     && <BusinessTab />}
          {activeTab === "leadsources"  && <LeadSourcesTab />}
          {activeTab === "documents"    && <DocumentsTab />}
          {activeTab === "pipeline"     && <PipelineTab />}
          {activeTab === "users"        && <TeamTab />}
          {activeTab === "billing"      && <BillingTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
        </div>
      </div>
    </div>
  );
}
