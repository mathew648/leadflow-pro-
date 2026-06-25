"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { JetMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: any) {
      setError(err?.message ?? "This reset link is invalid or has expired.");
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      {!token ? (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">This reset link is missing or invalid. Please request a new one.</p>
          <Link href="/forgot-password" className="mt-4 inline-block text-primary font-medium hover:underline text-sm">Request a reset link</Link>
        </div>
      ) : done ? (
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
          <h2 className="mt-4 font-bold text-lg">Password updated</h2>
          <p className="mt-2 text-sm text-muted-foreground">Redirecting you to sign in…</p>
          <Link href="/login" className="mt-4 inline-block text-primary font-medium hover:underline text-sm">Sign in now</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} placeholder="••••••••••••" className="pr-10" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShow((v) => !v)}>
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" type={show ? "text" : "password"} placeholder="••••••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Updating…" : "Set new password"}</Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-brand-100 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>
        <div className="text-center mb-8">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <JetMark className="w-8 h-8 text-white" />
          </span>
          <h1 className="text-3xl font-bold text-white">Choose a new password</h1>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl shadow-2xl p-8 text-center text-sm text-muted-foreground">Loading…</div>}>
          <ResetInner />
        </Suspense>
      </div>
    </div>
  );
}
