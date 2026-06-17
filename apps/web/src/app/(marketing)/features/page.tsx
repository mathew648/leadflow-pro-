import Link from "next/link";
import { Inbox, FileText, CalendarCheck, CreditCard, Bot, BarChart3, Receipt, Upload } from "lucide-react";

export const metadata = { title: "Features — TradieJet" };

const SECTIONS = [
  { icon: Inbox, title: "Lead capture from everywhere", points: ["Embeddable website form", "Google & Meta lead ads", "Inbound SMS & manual entry", "Instant auto-reply to every lead", "Duplicate detection"] },
  { icon: FileText, title: "Quoting that wins", points: ["Build from your price book", "Branded PDF quotes", "Customer portal: review, e-sign, approve", "Automatic follow-ups", "Deposit & terms support"] },
  { icon: CalendarCheck, title: "Jobs & scheduling", points: ["Convert approved quotes to jobs", "Assign your team", "Field view for techs on the tools", "Before/after photos & checklists", "Time tracking"] },
  { icon: CreditCard, title: "Invoicing & payments", points: ["Branded invoices", "Online card payment (Stripe)", "Part-payments & deposits", "Automatic overdue reminders", "Payment receipts"] },
  { icon: Receipt, title: "Accounting sync", points: ["Connect Xero in a click", "Invoices & payments push automatically", "Contacts kept in sync", "MYOB & QuickBooks (Enterprise)"] },
  { icon: Bot, title: "Automation & AI", points: ["New-lead replies, quote follow-ups, review requests", "Email + SMS workflows", "AI lead scoring", "Runs while you're on the tools"] },
  { icon: Upload, title: "Set up in minutes", points: ["Guided onboarding checklist", "Starter price book for your trade", "Bulk-import your prices from Excel/CSV", "Your logo & brand colours"] },
  { icon: BarChart3, title: "Insights", points: ["Lead source breakdown", "Revenue & pipeline", "Conversion tracking", "Know where the next job comes from"] },
];

export default function FeaturesPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold">One platform, the whole job</h1>
        <p className="mt-3 text-gray-600">From the first enquiry to money in the bank — and the admin that runs itself.</p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <div key={s.title} className="rounded-2xl border p-7">
            <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
              <s.icon className="w-5 h-5" />
            </div>
            <h2 className="mt-4 font-semibold text-lg">{s.title}</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-gray-600 list-disc pl-5">
              {s.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-14 text-center">
        <Link href="/register" className="inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
          Start your free trial
        </Link>
      </div>
    </section>
  );
}
