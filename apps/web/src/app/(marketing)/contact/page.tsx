import Link from "next/link";
import { Mail, Clock, MessageCircle } from "lucide-react";

export const metadata = { title: "Contact us — TradieJet" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Get in touch</h1>
        <p className="mt-3 text-gray-600 max-w-xl mx-auto">
          Questions about TradieJet, your account, or getting set up? We&apos;re a real team based in New Zealand and we&apos;re happy to help.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border bg-white p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto">
          <Mail className="w-6 h-6" />
        </div>
        <p className="mt-4 text-sm text-gray-500">Email us anytime</p>
        <a href="mailto:support@tradiejet.com" className="mt-1 inline-block text-xl sm:text-2xl font-semibold text-brand-700 hover:underline">
          support@tradiejet.com
        </a>
        <p className="mt-3 text-sm text-gray-500">We aim to reply within one business day.</p>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-6">
          <Clock className="w-5 h-5 text-brand-600" />
          <h2 className="mt-3 font-semibold">Support hours</h2>
          <p className="mt-1 text-sm text-gray-600">11am – 7pm NZT, Monday to Friday. Email us outside these hours and we&apos;ll get back to you as soon as we&apos;re online.</p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <MessageCircle className="w-5 h-5 text-brand-600" />
          <h2 className="mt-3 font-semibold">Already a customer?</h2>
          <p className="mt-1 text-sm text-gray-600">
            Log in and tap the <strong>Support</strong> button in your dashboard to chat with our team live or open a ticket — right where you work.
          </p>
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className="text-gray-600">Not signed up yet?</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <Link href="/register" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Start free</Link>
          <Link href="/waitlist" className="rounded-lg border px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Join the waitlist</Link>
        </div>
      </div>
    </div>
  );
}
