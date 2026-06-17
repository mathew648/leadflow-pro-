import Link from "next/link";
import {
  Zap, Inbox, FileText, CalendarCheck, CreditCard, Bot, BarChart3,
  ArrowRight, MapPin, Smartphone, ShieldCheck, Star,
} from "lucide-react";
import { HeroMockup } from "@/components/hero-mockup";

// Illustrative testimonials — REPLACE with real customer quotes before a public launch.
const TESTIMONIALS = [
  { quote: "Leads used to sit in my inbox till the weekend. Now they get a reply in two minutes and I'm winning jobs I used to miss.", name: "Jase W.", trade: "Electrician", loc: "Gold Coast, QLD" },
  { quote: "Swapped off per-user software — I've got 6 blokes on it for fifty bucks flat. Quoting from the van is a game changer.", name: "Mark T.", trade: "Plumbing", loc: "Hamilton, NZ" },
  { quote: "The quote page link in my Instagram bio brings in jobs while I'm on the tools. Set up in an arvo.", name: "Steph R.", trade: "Landscaping", loc: "Perth, WA" },
];

const FAQS = [
  { q: "Do I need a website to use TradieJet?", a: "No. Every account gets a hosted 'Request a Quote' page with a shareable link and QR code — put it in your Google profile, socials or email signature. If you want a full website, the Pro + Website plan builds one for you." },
  { q: "Is it really one flat price for my whole team?", a: "Yes. The Team plan covers up to 15 users for $50/mo — not per user. No surprise seat fees as you grow." },
  { q: "Can I cancel anytime?", a: "Yes — no lock-in contracts. Cancel from the billing portal and you keep access until the end of your period." },
  { q: "Does it work in both Australia and New Zealand?", a: "Built for both — correct GST, prices in AUD or NZD, and one-click sync to Xero and MYOB." },
  { q: "How do leads come in automatically?", a: "From your quote page, website form, Google and Meta lead ads — they all land in one inbox and trigger an instant auto-reply, so you respond first and win the job." },
  { q: "Is my customer data mine?", a: "Always. Your customers and leads belong to you, your branding is on every quote and invoice, and you can export anytime." },
];

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
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
              <Zap className="w-3.5 h-3.5" /> For AU &amp; NZ trades
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight">
              Win more jobs.<br /> Do less admin.
            </h1>
            <p className="mt-5 text-lg text-brand-100 max-w-xl mx-auto lg:mx-0">
              TradieJet is the all-in-one platform for tradies — capture leads, send quotes,
              schedule jobs, invoice and get paid. The follow-ups run themselves.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3">
              <Link href="/register" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50 shadow-lg shadow-brand-900/20">
                Start your 14-day free trial
              </Link>
              <Link href="/compare" className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10">
                Why TradieJet?
              </Link>
            </div>
            <p className="mt-4 text-sm text-brand-200">No credit card required · Set up in minutes</p>
            <div className="mt-6 flex items-center justify-center lg:justify-start gap-2 text-sm text-brand-100">
              <span className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-300" fill="currentColor" />)}</span>
              Loved by AU &amp; NZ tradies
            </div>
          </div>
          <div className="pb-6 lg:pb-0"><HeroMockup /></div>
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

      {/* Testimonials */}
      <section className="bg-gray-50 border-y">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold">Tradies are winning more work</h2>
            <p className="mt-3 text-gray-600">Real workflows, less admin, faster payments.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-2xl border bg-white p-6 flex flex-col">
                <div className="flex gap-0.5 text-yellow-400">{[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4" fill="currentColor" />)}</div>
                <blockquote className="mt-3 text-sm text-gray-700 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-gray-500"> · {t.trade} · {t.loc}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-3xl font-bold text-center">Questions, answered</h2>
        <div className="mt-10 divide-y border-y">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex items-center justify-between cursor-pointer list-none font-medium">
                {f.q}
                <span className="ml-4 text-brand-600 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{f.a}</p>
            </details>
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
