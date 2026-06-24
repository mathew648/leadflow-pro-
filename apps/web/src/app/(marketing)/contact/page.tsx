import { Mail, Clock, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

export const metadata = { title: "Contact us — TradieJet" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Get in touch</h1>
        <p className="mt-3 text-gray-600 max-w-xl mx-auto">
          Questions about TradieJet, your account, or getting set up? We&apos;re a real team based in New Zealand and we&apos;re happy to help.
        </p>
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-6 items-start">
        <ContactForm />

        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-6">
            <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center"><Mail className="w-5 h-5" /></div>
            <p className="mt-3 text-sm text-gray-500">Email us anytime</p>
            <a href="mailto:support@tradiejet.com" className="text-xl font-semibold text-brand-700 hover:underline">support@tradiejet.com</a>
            <p className="mt-2 text-sm text-gray-500">We aim to reply within one business day.</p>
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <Clock className="w-5 h-5 text-brand-600" />
            <h2 className="mt-3 font-semibold">Support hours</h2>
            <p className="mt-1 text-sm text-gray-600">11am – 7pm NZT, Monday to Friday. Message us outside these hours and we&apos;ll get back to you as soon as we&apos;re online.</p>
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <MessageCircle className="w-5 h-5 text-brand-600" />
            <h2 className="mt-3 font-semibold">Already a customer?</h2>
            <p className="mt-1 text-sm text-gray-600">Log in and tap the <strong>Support</strong> button in your dashboard to chat with our team live — right where you work.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
