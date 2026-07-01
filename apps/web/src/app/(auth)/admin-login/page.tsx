"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, verifyLoginOtp, resendLoginOtp, type AuthUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPass, setShowPass] = useState(false);

  const [challenge, setChallenge] = useState<{ challengeId: string; email: string } | null>(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Signs the user in and routes based on platform-admin access.
  function completeLogin(user: AuthUser) {
    setAuth(user);
    if (user.isPlatformAdmin) {
      router.push("/admin");
    } else {
      toast({ title: "Not a platform admin", description: "This account doesn't have admin access.", variant: "destructive" });
      router.push("/dashboard");
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      const result = await login(values.email, values.password);
      if ("requiresOtp" in result && result.requiresOtp) {
        setChallenge({ challengeId: result.challengeId, email: result.email });
        return;
      }
      completeLogin(result.user);
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setVerifying(true);
    try {
      const { user } = await verifyLoginOtp(challenge.challengeId, code.trim(), rememberDevice);
      completeLogin(user);
    } catch (err: any) {
      toast({ title: "Couldn't verify code", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    if (!challenge) return;
    setResending(true);
    try {
      const next = await resendLoginOtp(challenge.challengeId);
      setChallenge(next);
      setCode("");
      toast({ title: "New code sent", description: `We emailed a fresh code to ${next.email}.` });
    } catch (err: any) {
      toast({ title: "Couldn't resend code", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400/20 backdrop-blur mb-4">
            <ShieldCheck className="w-8 h-8 text-amber-300" />
          </div>
          <h1 className="text-3xl font-bold text-white">TradieJet Admin</h1>
          <p className="text-gray-300 mt-1">{challenge ? "Verify it's you" : "Platform operator sign in"}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!challenge ? (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Admin email</Label>
                  <Input id="email" type="email" placeholder="info@tradiejet.com" autoComplete="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPass ? "text" : "password"} autoComplete="current-password" className="pr-10" {...register("password")} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPass((v) => !v)}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in…" : "Sign in to admin"}
                </Button>
              </form>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                <Link href="/login" className="text-primary font-medium hover:underline">← Tradie sign in</Link>
              </div>
            </>
          ) : (
            <form onSubmit={onVerify} className="space-y-5">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <MailCheck className="w-6 h-6" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  We emailed a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{challenge.email}</span>. Enter it to continue.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  className="text-center text-2xl tracking-[0.5em] font-semibold"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
                Trust this device for 30 days
              </label>

              <Button type="submit" className="w-full" disabled={verifying || code.length !== 6}>
                {verifying ? "Verifying…" : "Verify & sign in"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setChallenge(null); setCode(""); setRememberDevice(false); }} className="text-muted-foreground hover:text-foreground">
                  ← Back
                </button>
                <button type="button" onClick={onResend} disabled={resending} className="text-primary font-medium hover:underline disabled:opacity-50">
                  {resending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
