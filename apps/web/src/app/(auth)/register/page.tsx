"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register as registerUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";

const TRADE_TYPES = [
  "Electrical", "Plumbing", "HVAC/Air Conditioning", "Solar", "Carpentry",
  "Painting", "Tiling", "Roofing", "Landscaping", "Concreting",
  "Fencing", "Pest Control", "Cleaning", "Security Systems",
];

const schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(12, "Minimum 12 characters"),
  businessName: z.string().min(1, "Required"),
  abn: z.string().optional(),
  phone: z.string().optional(),
  country: z.enum(["AU", "NZ"]),
  tradeTypes: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [accountType, setAccountType] = useState<"tradie" | "non_tradie">("tradie");
  const [step, setStep] = useState(1);
  const [bizNumber, setBizNumber] = useState("");
  const [lookupStatus, setLookupStatus] = useState<{ kind: "idle" | "loading" | "ok" | "error"; msg: string }>({ kind: "idle", msg: "" });

  const { register, handleSubmit, setValue, watch, trigger, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { country: "AU", tradeTypes: [] },
  });

  const country = watch("country") ?? "AU";
  const bizNumberLabel = country === "NZ" ? "NZBN" : "ABN";

  // Auto-fill business name from the ABN/NZBN register (so tradies barely type).
  async function lookupBusiness() {
    if (!bizNumber.trim()) return;
    setLookupStatus({ kind: "loading", msg: "Looking up…" });
    try {
      const res = await fetch(`/api/v1/lookup/business?country=${country}&number=${encodeURIComponent(bizNumber.trim())}`);
      const json = await res.json();
      if (res.ok && json?.data?.name) {
        setValue("businessName", json.data.name, { shouldValidate: true });
        setValue("abn", bizNumber.trim());
        setLookupStatus({ kind: "ok", msg: `✓ ${json.data.name}` });
      } else if (res.status === 503) {
        setLookupStatus({ kind: "error", msg: "Lookup not enabled — type your business name below." });
      } else {
        setLookupStatus({ kind: "error", msg: json?.error?.message ?? "Not found — type your business name below." });
      }
    } catch {
      setLookupStatus({ kind: "error", msg: "Lookup unavailable — type your business name below." });
    }
  }

  function toggleTrade(trade: string) {
    const next = selectedTrades.includes(trade)
      ? selectedTrades.filter((t) => t !== trade)
      : [...selectedTrades, trade];
    setSelectedTrades(next);
    setValue("tradeTypes", next);
  }

  async function onSubmit(values: FormValues) {
    try {
      const { user } = await registerUser({
        ...values,
        tradeTypes: accountType === "tradie" ? selectedTrades : [],
        accountType,
      });
      setAuth(user);
      router.push("/dashboard");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    }
  }

  // Tradies pick trades on step 2; non-tradies submit straight from step 1.
  async function handlePrimary() {
    const ok = await trigger(["firstName", "lastName", "businessName", "email", "password"]);
    if (!ok) return;
    if (accountType === "tradie") setStep(2);
    else handleSubmit(onSubmit)();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Start free trial</h1>
          <p className="text-brand-100 mt-1">14 days free — no credit card required</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= s ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 2 && <div className={`h-0.5 flex-1 w-20 ${step > s ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-lg">What kind of business?</h2>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setAccountType("tradie")}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium ${accountType === "tradie" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                    >
                      🔧 Tradie business
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("non_tradie")}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium ${accountType === "non_tradie" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                    >
                      💼 Other (lead manager)
                    </button>
                  </div>
                </div>
                <h2 className="font-semibold text-lg">Your details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First name</Label>
                    <Input placeholder="John" {...register("firstName")} />
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last name</Label>
                    <Input placeholder="Smith" {...register("lastName")} />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{bizNumberLabel} <span className="text-muted-foreground font-normal">(optional — auto-fills your details)</span></Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={country === "NZ" ? "9429... (13 digits)" : "12 345 678 901"}
                      value={bizNumber}
                      onChange={(e) => setBizNumber(e.target.value)}
                      onBlur={() => { if (bizNumber.trim().length >= 8) lookupBusiness(); }}
                    />
                    <Button type="button" variant="outline" onClick={lookupBusiness} disabled={lookupStatus.kind === "loading"}>
                      {lookupStatus.kind === "loading" ? "…" : "Look up"}
                    </Button>
                  </div>
                  {lookupStatus.msg && (
                    <p className={`text-xs ${lookupStatus.kind === "ok" ? "text-green-600" : lookupStatus.kind === "error" ? "text-muted-foreground" : "text-muted-foreground"}`}>
                      {lookupStatus.msg}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Business name</Label>
                  <Input placeholder="Smith Electrical Pty Ltd" {...register("businessName")} />
                  {errors.businessName && <p className="text-xs text-destructive">{errors.businessName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" placeholder="you@company.com.au" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" placeholder="Min 12 characters" {...register("password")} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Country</Label>
                    <select {...register("country")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="AU">Australia</option>
                      <option value="NZ">New Zealand</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone (optional)</Label>
                    <Input type="tel" placeholder="+61 4xx xxx xxx" {...register("phone")} />
                  </div>
                </div>
                <Button type="button" className="w-full" onClick={handlePrimary} disabled={isSubmitting}>
                  {accountType === "tradie" ? "Next: Select Trade →" : (isSubmitting ? "Creating account…" : "Start free trial")}
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-lg">What trades do you do?</h2>
                <p className="text-sm text-muted-foreground">Select all that apply</p>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {TRADE_TYPES.map((trade) => (
                    <button
                      key={trade}
                      type="button"
                      onClick={() => toggleTrade(trade)}
                      className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                        selectedTrades.includes(trade)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      {trade}
                    </button>
                  ))}
                </div>
                {errors.tradeTypes && <p className="text-xs text-destructive">{errors.tradeTypes.message}</p>}
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    ← Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting || selectedTrades.length === 0}>
                    {isSubmitting ? "Creating account…" : "Start free trial"}
                  </Button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
