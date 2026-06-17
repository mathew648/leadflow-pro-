"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Rocket, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/**
 * A guided setup checklist for new tradies, shown on the dashboard until everything
 * is done (or dismissed). Completion is derived from real data so it stays accurate.
 */
export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("lfp_onboarding_dismissed") === "1"
  );

  const { data: tenant } = useQuery({ queryKey: ["tenant"], queryFn: () => api.get<any>("/tenant") });
  const { data: catalog } = useQuery({ queryKey: ["onboarding-catalog"], queryFn: () => api.get<any>("/catalog/items?limit=1") });
  const { data: quotes } = useQuery({ queryKey: ["onboarding-quotes"], queryFn: () => api.get<any>("/quotes?limit=1") });
  const { data: integrations } = useQuery({ queryKey: ["integrations"], queryFn: () => api.get<any>("/integrations") });

  if (dismissed || !tenant) return null;

  // api.get unwraps the response envelope, so list calls may arrive as a raw array
  // or as { data, meta } depending on the endpoint — handle both.
  const count = (r: any): number => {
    if (!r) return 0;
    if (typeof r?.meta?.total === "number") return r.meta.total;
    if (Array.isArray(r)) return r.length;
    if (Array.isArray(r?.data)) return r.data.length;
    return 0;
  };

  const t = tenant; // GET /tenant returns the tenant object as the unwrapped data
  const integrationList = Array.isArray(integrations) ? integrations : integrations?.data ?? [];
  const hasXero = integrationList.some((c: any) => c.provider === "xero" && c.status === "active");

  const steps: Step[] = [
    {
      key: "profile",
      label: "Complete your business profile",
      hint: "Phone & address — shown on quotes and invoices",
      href: "/settings",
      done: Boolean(t.phone && t.streetAddress),
    },
    {
      key: "branding",
      label: "Add your logo & brand colour",
      hint: "Make your quotes and emails look professional",
      href: "/settings",
      done: Boolean(t.logoUrl),
    },
    {
      key: "pricebook",
      label: "Set up your price book",
      hint: "We pre-loaded starter items — review or import your own",
      href: "/catalog",
      done: count(catalog) > 0,
    },
    {
      key: "payments",
      label: "Connect payments (Stripe)",
      hint: "Let customers pay invoices online",
      href: "/settings",
      done: Boolean(t.stripeAccountId),
    },
    {
      key: "accounting",
      label: "Connect accounting (Xero)",
      hint: "Auto-sync invoices and payments",
      href: "/settings",
      done: hasXero,
    },
    {
      key: "first-quote",
      label: "Create & send your first quote",
      hint: "Turn a lead into a signed job",
      href: "/quotes/new",
      done: count(quotes) > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // fully set up — hide it

  function dismiss() {
    window.localStorage.setItem("lfp_onboarding_dismissed", "1");
    setDismissed(true);
  }

  return (
    <Card className="border-brand-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="w-4 h-4 text-brand-600" />
          Get set up — {doneCount} of {steps.length} done
        </CardTitle>
        <button type="button" onClick={dismiss} title="Hide setup guide" className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="h-1.5 w-full bg-muted rounded-full mb-3 overflow-hidden">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        {steps.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
              s.done ? "opacity-60" : "hover:bg-muted"
            )}
          >
            {s.done
              ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", s.done && "line-through")}>{s.label}</p>
              {!s.done && <p className="text-xs text-muted-foreground">{s.hint}</p>}
            </div>
            {!s.done && <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
