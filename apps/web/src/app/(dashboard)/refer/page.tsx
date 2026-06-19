"use client";
import { useQuery } from "@tanstack/react-query";
import { Gift, Copy } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function ReferPage() {
  const { data } = useQuery({ queryKey: ["referral"], queryFn: () => api.get<any>("/tenant/referral") });
  const r = (data?.data ?? data) ?? {};

  const copy = (t: string) => { if (t) { navigator.clipboard.writeText(t); toast({ title: "Copied" }); } };
  const share = () => {
    if (!r.link) return;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any).share({ title: "TradieJet", text: "Run your trade business with TradieJet — sign up with my link:", url: r.link }).catch(() => {});
    } else copy(r.link);
  };

  return (
    <div>
      <Topbar title="Refer & Earn" />
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
        <Card className="border-brand-200">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-3"><Gift className="w-6 h-6" /></div>
            <h2 className="text-xl font-bold">Refer a mate — you both get a month free</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{r.reward ?? "Share your link. When a mate signs up and subscribes, you both get 1 month free."}</p>
            <div className="mt-4 flex gap-2 max-w-md mx-auto">
              <code className="flex-1 text-sm bg-muted rounded-md px-3 py-2.5 overflow-x-auto text-left">{r.link ?? "…"}</code>
              <Button type="button" variant="outline" onClick={() => copy(r.link)} aria-label="Copy link"><Copy className="w-4 h-4" /></Button>
            </div>
            <Button type="button" className="mt-3 w-full max-w-md mx-auto" onClick={share}>Share my link</Button>
            {r.code && <p className="text-xs text-muted-foreground mt-2">Your code: <strong className="font-mono">{r.code}</strong></p>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{r.total ?? 0}</p><p className="text-xs text-muted-foreground">Mates referred</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{r.converted ?? 0}</p><p className="text-xs text-muted-foreground">Signed up &amp; active</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Your referrals</CardTitle></CardHeader>
          <CardContent>
            {(r.referrals ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No referrals yet — share your link to get started. 🚀</p>
            ) : (
              <div className="divide-y">
                {r.referrals.map((x: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium">{x.businessName}</span>
                    <span className="text-xs text-muted-foreground capitalize">{String(x.status).replace(/_/g, " ")} · {new Date(x.joinedAt).toLocaleDateString("en-AU")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">Rewards are applied as account credit once your mate&apos;s subscription starts.</p>
      </div>
    </div>
  );
}
