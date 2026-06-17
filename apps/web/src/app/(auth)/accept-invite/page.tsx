"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInvite, acceptInvite, type InviteInfo } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";

function AcceptInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const setAuth = useAuthStore((s) => s.setAuth);

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError("This invite link is missing its code."); setLoading(false); return; }
    getInvite(token)
      .then((info) => setInvite(info))
      .catch((e: any) => setError(e.message ?? "This invite link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 12) { toast({ title: "Password must be at least 12 characters", variant: "destructive" }); return; }
    if (password !== confirm) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const { user } = await acceptInvite(token, password);
      setAuth(user);
      toast({ title: `Welcome to the team, ${user.firstName}!` });
      router.push("/dashboard");
    } catch (err: any) {
      toast({ title: "Couldn't accept invite", description: err.message, variant: "destructive" });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Join the team</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking your invite…
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-destructive">{error}</p>
              <Link href="/login" className="text-primary font-medium hover:underline text-sm">Go to sign in</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You&apos;ve been invited to join <strong className="text-foreground">{invite?.businessName}</strong>
                {invite?.role ? <> as a <strong className="text-foreground">{invite.role}</strong></> : null}. Set a password to get started.
              </p>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={invite?.email ?? ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Create password</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters"
                  />
                  <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirm password</Label>
                <Input type={showPass ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Setting up…" : "Accept & join"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
