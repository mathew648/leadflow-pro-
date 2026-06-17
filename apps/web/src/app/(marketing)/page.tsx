import Link from "next/link";
import {
  Zap, Inbox, FileText, CalendarCheck, CreditCard, Bot, BarChart3,
  ArrowRight, MapPin, Smartphone, ShieldCheck,
} from "lucide-react";

const FEATURES = [
  { icon: Inbox, title: "Capture every lead", desc: "Google, Meta, your website form, or manual — leads land in one inbox and get an instant auto-reply." },
  { icon: FileText, title: "Quote in minutes", desc: "Build quotes from your price book. Customers review, e-sign and approve from their phone." },
  { icon: CalendarCheck, title: "Schedule & track jobs", desc: "Turn approved quotes into jobs, assign your team, and track them through to completion." },
  { icon: CreditCard, title: "Invoice & get paid", desc: "Send branded invoices with online card payment. Mark paid and it syncs to Xero automatically." },
  { icon: Bot, title: "Automated follow-ups", desc: "New-lead replies, quote follow-ups and review requests run themselves over email and SMS." },
  { icon: BarChart3, title: "Know your numbers", desc: "See leads, revenue and pipeline at a glance, so you know where the next job is coming from." },
];

const STEPS = [
  { n: 1, title: "Lead comes in", desc: "From your ads, website or phone — captured instantly." },
  { n: 2, title: "Quote & win", desc: "Send a professional quote; the customer approves and signs online." },
  { n: 3, title: "Do the job", desc: "Schedule it, complete it, snap before/after photos." },
  { n: 4, title: "Get paid", desc: "Invoice, take payment online, and sync to your accounting." },
];

const VALUES = [
  { icon: MapPin, title: "Built for AU & NZ", desc: "GST done right, and one-click sync to Xero & MYOB. Prices in AUD or NZD." },
  { icon: Smartphone, title: "Works on the tools", desc: "Install it on your phone like an app. Quote and update jobs from the van or the site." },
  { icon: ShieldCheck, title: "Your data, your branding", desc: "Your logo on every quote and invoice. Your customer list stays yours — always." },
];

export default function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
            <Zap className="w-3.5 h-3.5" /> For AU &amp; NZ trades
          </span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
            Win more jobs.<br className="hidden sm:block" /> Do less admin.
          </h1>
          <p className="mt-5 text-lg text-brand-100 max-w-2xl mx-auto">
            TradieJet is the all-in-one platform for tradies — capture leads, send quotes,
            schedule jobs, invoice and get paid. The follow-ups run themselves.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50 shadow-lg shadow-brand-900/20">
              Start your 14-day free trial
            </Link>
            <Link href="/compare" className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Why TradieJet?
            </Link>
          </div>
          <p className="mt-4 text-sm text-brand-200">No credit card required · Set up in minutes</p>

          {/* Quick proof points */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-brand-100">
            <span className="inline-flex items-center gap-1.5">⚡ Instant lead replies</span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5">💳 Get paid online</span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5">📱 Works on your phone</span>
          </div>
        </div>
      </section>

      {/* Integrations strip */}
      <section className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-x-10 gap-y-3 text-sm">
            <span className="text-gray-500">
              <strong className="text-gray-900">Captures leads from</strong>{" "}
              {["Google Ads", "Meta", "Your website"].map((s) => (
                <span key={s} className="inline-block mx-1 rounded-md bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{s}</span>
              ))}
            </span>
            <span className="hidden lg:block text-gray-300">|</span>
            <span className="text-gray-500">
              <strong className="text-gray-900">Syncs with</strong>{" "}
              {["Xero", "MYOB", "Stripe"].map((s) => (
                <span key={s} className="inline-block mx-1 rounded-md bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{s}</span>
              ))}
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold">Everything you need to run the business</h2>
          <p className="mt-3 text-gray-600">From the first enquiry to money in the bank — without the spreadsheets.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border p-6 hover:shadow-lg hover:border-brand-200 transition-all">
              <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-y">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold">How it works</h2>
            <p className="mt-3 text-gray-600">One smooth flow from lead to paid.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl bg-white border p-6">
                <div className="w-9 h-9 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center">{s.n}</div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why TradieJet — value cards */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold">Made for the way tradies work</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border bg-gradient-to-b from-white to-gray-50 p-7 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center">
                <v.icon className="w-6 h-6" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{v.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold">Ready to win back your evenings?</h2>
          <p className="mt-3 text-brand-100">Start free today. No credit card, no lock-in.</p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50"
          >
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
