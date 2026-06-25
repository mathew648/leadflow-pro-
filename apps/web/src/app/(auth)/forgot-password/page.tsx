"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { JetMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try { await forgotPassword(email.trim()); } catch { /* always succeed (don't reveal existence) */ }
    setSent(true);
    setLoading(false);
  }

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
          <h1 className="text-3xl font-bold text-white">Reset your password</h1>
          <p className="text-brand-100 mt-1">We&apos;ll email you a secure reset link.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h2 className="mt-4 font-bold text-lg">Check your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password-reset link. It expires in 1 hour.
              </p>
              <Link href="/login" className="mt-6 inline-block text-primary font-medium hover:underline text-sm">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Mail className="w-4 h-4 mr-1.5" /> {loading ? "Sending…" : "Send reset link"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Remembered it?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
