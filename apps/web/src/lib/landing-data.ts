// ─────────────────────────────────────────────────────────────────────────────
// Data-driven copy for programmatic SEO landing pages.
//
// Two page families are generated from this file:
//   /for/[trade]          — trade-specific ("job management software for electricians")
//   /compare/[competitor] — competitor alternative pages ("ServiceM8 alternative")
//
// Each entry carries its own unique copy (headline, pain points, features, FAQs) so the
// generated pages are genuinely differentiated, not thin duplicates. Adding a trade or
// competitor here spins up a fully-formed, indexable page — this is also the shape the
// future CMS will edit.
// ─────────────────────────────────────────────────────────────────────────────

export type TradeFeature = { title: string; desc: string };
export type FAQ = { q: string; a: string };

export type Trade = {
  slug: string;
  name: string; // plural, title-case — "Electricians"
  singular: string; // "electrician"
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subhead: string;
  painPoints: string[];
  features: TradeFeature[];
  faqs: FAQ[];
};

export type CompareRow = { feature: string; them: boolean | "limited"; us: boolean | "limited" };

export type Competitor = {
  slug: string;
  name: string; // "ServiceM8"
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subhead: string;
  // Honest, defensible framing of who they suit — keeps the page credible, not a hit piece.
  theirStrength: string;
  whySwitch: TradeFeature[];
  comparison: CompareRow[];
  faqs: FAQ[];
};

export const TRADES: Trade[] = [
  {
    slug: "electricians",
    name: "Electricians",
    singular: "electrician",
    metaTitle: "Job Management Software for Electricians (AU & NZ) · TradieJet",
    metaDescription:
      "TradieJet is all-in-one job management software for electricians — capture leads, quote from your price book, schedule jobs, invoice and get paid. Flat pricing for your whole crew.",
    headline: "Job management software built for electricians",
    subhead:
      "From switchboard upgrades to full rewires — capture the enquiry, send the quote, book the job and get paid, all from your phone on site.",
    painPoints: [
      "Quotes for switchboard and rewire jobs take all evening to write up",
      "Leads from Google and Facebook get lost between texts, emails and voicemail",
      "Chasing payment after the job is done eats into your weekends",
    ],
    features: [
      { title: "Quote from your electrical price book", desc: "Save your common items — GPOs, switchboards, downlights, hourly rates — and build a professional quote in minutes, not hours." },
      { title: "Capture every job enquiry", desc: "Website, Google and Meta leads land in one inbox with an instant auto-reply, so you're first to respond and win the job." },
      { title: "Compliance-ready records", desc: "Attach photos, notes and certificates to each job and keep a clean record of every board and circuit you've worked on." },
      { title: "Invoice before you leave site", desc: "Turn the completed job into a branded invoice with online card payment, and sync it to Xero or MYOB automatically." },
    ],
    faqs: [
      { q: "Can I quote for electrical jobs from my phone?", a: "Yes — build quotes from your saved price book on the job, send them for the customer to approve and e-sign, and turn approved quotes straight into scheduled jobs." },
      { q: "Does it work for a solo sparky and for a team?", a: "Both. Sole traders start at $20/mo; the Company plan runs your whole crew (up to 15) on one flat price — not per user." },
      { q: "Can I store job photos and certificates?", a: "Yes — attach before/after photos, notes and documents to every job so you have a complete, searchable history." },
    ],
  },
  {
    slug: "plumbers",
    name: "Plumbers",
    singular: "plumber",
    metaTitle: "Job Management Software for Plumbers (AU & NZ) · TradieJet",
    metaDescription:
      "TradieJet helps plumbers capture leads, quote fast, schedule jobs and get paid on site. All-in-one plumbing software with flat pricing for your whole team.",
    headline: "Plumbing software that wins jobs and gets you paid",
    subhead:
      "Blocked drains, hot-water swaps, bathroom fit-outs — respond first, quote on the spot and take payment before you've packed up the van.",
    painPoints: [
      "Emergency call-outs come in while you're under a sink and get missed",
      "Writing up quotes for bathroom and fit-out jobs eats into family time",
      "Cash flow stalls waiting on invoices to be paid",
    ],
    features: [
      { title: "Never miss an emergency lead", desc: "Every call, form and ad enquiry lands in one inbox with an instant auto-reply — so the customer hears back in seconds, not hours." },
      { title: "Quote fit-outs from a price book", desc: "Save your fittings, fixtures and hourly rates once, then build detailed quotes for bathroom and kitchen jobs in minutes." },
      { title: "Recurring maintenance made easy", desc: "Put backflow testing and service agreements on autopilot — the job and invoice create themselves on schedule." },
      { title: "Get paid on the spot", desc: "Send a branded invoice with online card payment before you leave, and watch it sync to Xero or MYOB automatically." },
    ],
    faqs: [
      { q: "Can customers pay me online?", a: "Yes — invoices include an online card-payment link, so customers can pay on the spot and the payment syncs to your accounting." },
      { q: "Can I set up recurring service jobs?", a: "Yes — recurring maintenance agreements auto-create the job and the invoice on your chosen schedule, turning one-off work into steady income." },
      { q: "Is there a mobile app?", a: "TradieJet installs on your phone like an app, so you can quote, schedule and invoice from the van or the job." },
    ],
  },
  {
    slug: "builders",
    name: "Builders & Carpenters",
    singular: "builder",
    metaTitle: "Job Management Software for Builders & Carpenters · TradieJet",
    metaDescription:
      "TradieJet is job and project management software for builders and carpenters — quote, schedule, track job costs and profit, invoice and get paid. Flat team pricing.",
    headline: "Run every build from enquiry to final payment",
    subhead:
      "Decks, renovations, new builds — manage quotes, schedules, materials and progress payments in one place, and see your profit on every job.",
    painPoints: [
      "Job costs creep and you only find out your margin at the end",
      "Quotes and variations live across spreadsheets, email and paper",
      "Keeping clients updated on progress takes constant phone calls",
    ],
    features: [
      { title: "See profit on every job", desc: "Materials, labour and revenue add up automatically so you know your margin on each build — before it's too late to fix." },
      { title: "Detailed quotes with line-item types", desc: "Split materials, labour and subcontractors on every quote, then turn the approved quote straight into a job." },
      { title: "Schedule the crew and subbies", desc: "Assign work, track jobs through to completion, and coordinate subcontractors with no-login task links." },
      { title: "Invoice progress payments", desc: "Send branded invoices with online payment as the build hits milestones, and sync it all to Xero or MYOB." },
    ],
    faqs: [
      { q: "Can I track job costs and profit?", a: "Yes — TradieJet adds up materials, labour and revenue per job and shows your profit and margin, with a warning if any item is missing a cost." },
      { q: "Can I manage subcontractors?", a: "Yes — assign subbies a task on a job and send them a no-login link to see the work and mark it done with photos." },
      { q: "Does it handle variations and staged invoicing?", a: "You can add line items to quotes and jobs as scope changes, and send progress invoices with online payment at each milestone." },
    ],
  },
  {
    slug: "hvac",
    name: "HVAC & Air Conditioning",
    singular: "HVAC technician",
    metaTitle: "Job Management Software for HVAC & Air Con Installers · TradieJet",
    metaDescription:
      "TradieJet helps HVAC and air-conditioning businesses capture leads, quote installs, schedule service jobs and get paid. All-in-one, with recurring maintenance built in.",
    headline: "Software for HVAC and air-con businesses",
    subhead:
      "Split-system installs, ducted quotes and service contracts — win the enquiry, book the install and keep service agreements running on autopilot.",
    painPoints: [
      "Install quotes are complex and slow to put together",
      "Seasonal enquiry spikes are hard to respond to fast enough",
      "Service and maintenance contracts are tracked in a spreadsheet",
    ],
    features: [
      { title: "Quote installs from a price book", desc: "Save units, materials and install rates so you can turn a site visit into a professional quote the same day." },
      { title: "Capture the seasonal rush", desc: "Auto-reply to every summer and winter enquiry instantly so you book the work before the customer rings the next installer." },
      { title: "Recurring service agreements", desc: "Maintenance contracts auto-generate the job and invoice on schedule — steady revenue with zero admin." },
      { title: "Track every unit you service", desc: "Keep a full history of installs and service visits per customer, with photos and notes attached to each job." },
    ],
    faqs: [
      { q: "Can I manage recurring maintenance contracts?", a: "Yes — set up a service agreement and TradieJet auto-creates the job and invoice each cycle, so nothing slips through." },
      { q: "Can I quote ducted and multi-head installs?", a: "Yes — build detailed quotes from your saved price book, including units, materials and labour, and send them for online approval." },
      { q: "Does it keep a service history per site?", a: "Yes — every job, photo and note is stored against the customer so you always know what's installed and when it was last serviced." },
    ],
  },
  {
    slug: "landscapers",
    name: "Landscapers",
    singular: "landscaper",
    metaTitle: "Job Management Software for Landscapers & Gardeners · TradieJet",
    metaDescription:
      "TradieJet helps landscapers and gardeners win more jobs — capture leads, quote from photos, schedule crews, invoice and get paid. Flat pricing for the whole team.",
    headline: "Landscaping software that keeps the work coming",
    subhead:
      "Garden makeovers, paving, retaining walls and maintenance rounds — capture leads from your socials, quote fast and keep the calendar full.",
    painPoints: [
      "Leads come from Instagram and Facebook but are hard to keep on top of",
      "Quoting design and construction jobs takes ages",
      "Maintenance rounds and one-off jobs are juggled in your head",
    ],
    features: [
      { title: "Turn your socials into leads", desc: "Put your branded quote link in your Instagram bio — enquiries land in one inbox and get an instant auto-reply." },
      { title: "Quote from customer photos", desc: "Send a 'tell us about your job' link, get photos and details back, then build a quote without a site visit." },
      { title: "Schedule crews and rounds", desc: "Plan maintenance rounds and construction jobs, assign your team, and track everything to done." },
      { title: "Invoice and get paid faster", desc: "Send branded invoices with online payment the day the job's finished, and sync to Xero or MYOB." },
    ],
    faqs: [
      { q: "Can I quote without visiting every site?", a: "Yes — send customers a photo-and-details request link, and build an accurate quote from what they send back." },
      { q: "Can I manage regular maintenance clients?", a: "Yes — recurring jobs and invoices generate automatically, so weekly and monthly rounds run themselves." },
      { q: "Where do my leads come from?", a: "Your website, Google, Meta and your shareable quote link all feed one inbox, plus you can forward in Builderscrack and hipages jobs." },
    ],
  },
  {
    slug: "painters",
    name: "Painters",
    singular: "painter",
    metaTitle: "Job Management Software for Painters & Decorators · TradieJet",
    metaDescription:
      "TradieJet helps painting businesses capture leads, quote jobs fast, schedule the team and get paid. All-in-one painter software with flat, whole-team pricing.",
    headline: "Painting business software, all in one place",
    subhead:
      "Interior repaints, new builds and commercial jobs — respond to every enquiry fast, quote by the room or the job, and get paid on completion.",
    painPoints: [
      "Enquiries pile up during busy season and some never get a reply",
      "Quotes by room or square metre are fiddly to write up",
      "Following up on old quotes and unpaid invoices falls through the cracks",
    ],
    features: [
      { title: "Reply to every enquiry instantly", desc: "Website, Google and Meta leads hit one inbox with an auto-reply, so no job goes cold while you're on the tools." },
      { title: "Quote by room or by job", desc: "Save your rates and common items, then build a clear quote the customer can approve and e-sign from their phone." },
      { title: "Automatic quote follow-ups", desc: "TradieJet chases up sent quotes for you over email and SMS, so more of them turn into booked work." },
      { title: "Branded invoices, online payment", desc: "Get paid the day you finish with online card payment, and sync every invoice to Xero or MYOB." },
    ],
    faqs: [
      { q: "Can TradieJet follow up my quotes automatically?", a: "Yes — automated follow-ups nudge customers about sent quotes over email and SMS, lifting your win rate without any manual chasing." },
      { q: "Can I quote different rooms and surfaces?", a: "Yes — build line-item quotes from your saved price book so quoting by room, surface or the whole job is quick and consistent." },
      { q: "Is pricing per user?", a: "No — sole traders start at $20/mo and the Company plan covers your whole team (up to 15) for one flat price." },
    ],
  },
];

export const COMPETITORS: Competitor[] = [
  {
    slug: "servicem8",
    name: "ServiceM8",
    metaTitle: "ServiceM8 Alternative for AU & NZ Trades · TradieJet",
    metaDescription:
      "Looking for a ServiceM8 alternative? TradieJet captures your own leads and runs your whole team on one flat price — not per user. Quotes, jobs, invoices and payments in one place.",
    headline: "The ServiceM8 alternative that captures leads too",
    subhead:
      "ServiceM8 is solid job management. TradieJet adds lead capture and follow-up on the front end, and flat whole-team pricing instead of per-user fees.",
    theirStrength: "ServiceM8 is a well-established job-management app popular with AU trades for scheduling and invoicing on the go.",
    whySwitch: [
      { title: "Own your leads, don't just manage jobs", desc: "TradieJet captures enquiries from your website, Google and Meta into one inbox with instant auto-reply — the job doesn't start when you already have the customer." },
      { title: "Flat pricing, not per user", desc: "Run your whole crew (up to 15) on one price instead of paying per seat or per job as you grow." },
      { title: "A website and quote page included", desc: "Every account gets a hosted 'Request a Quote' page and QR code — no separate website subscription needed." },
    ],
    comparison: [
      { feature: "Quotes, jobs & invoicing", them: true, us: true },
      { feature: "Online card payments", them: true, us: true },
      { feature: "Xero & MYOB sync", them: true, us: true },
      { feature: "Capture your own leads (site/Google/Meta)", them: false, us: true },
      { feature: "Instant lead auto-reply & follow-ups", them: "limited", us: true },
      { feature: "Built-in website / quote page", them: false, us: true },
      { feature: "Flat whole-team pricing", them: false, us: true },
    ],
    faqs: [
      { q: "Can I move my data across from ServiceM8?", a: "You can import your customers and price-book items via CSV, and add integrations like Xero so your accounting stays connected." },
      { q: "Is TradieJet cheaper than ServiceM8?", a: "TradieJet uses flat pricing — sole traders from $20/mo and up to 15 users for one flat Company price — so it's typically cheaper as your team grows. Compare against your current per-user cost." },
    ],
  },
  {
    slug: "tradify",
    name: "Tradify",
    metaTitle: "Tradify Alternative for AU & NZ Trades · TradieJet",
    metaDescription:
      "A Tradify alternative that captures your leads and charges one flat price for the whole team. TradieJet does quoting, scheduling, invoicing and payments — plus lead capture Tradify leaves out.",
    headline: "The Tradify alternative with lead capture built in",
    subhead:
      "Tradify is great for tracking jobs. TradieJet adds the front end — capturing and auto-replying to leads — and runs your whole team on one flat price.",
    theirStrength: "Tradify is a popular NZ-born job-management tool for quoting, scheduling and invoicing across AU and NZ trades.",
    whySwitch: [
      { title: "Win the lead before you track the job", desc: "TradieJet captures enquiries from your site, Google and Meta and auto-replies instantly, so you respond first and book more work." },
      { title: "One flat price for the whole crew", desc: "No per-user seat fees — the Company plan covers up to 15 users for one price as you scale." },
      { title: "Built for AU and NZ out of the box", desc: "Correct GST, prices in AUD or NZD, and one-click sync to Xero and MYOB." },
    ],
    comparison: [
      { feature: "Quotes, jobs & invoicing", them: true, us: true },
      { feature: "Online card payments", them: true, us: true },
      { feature: "Xero & MYOB sync", them: true, us: true },
      { feature: "Capture your own leads (site/Google/Meta)", them: false, us: true },
      { feature: "Instant lead auto-reply & follow-ups", them: "limited", us: true },
      { feature: "Built-in website / quote page", them: false, us: true },
      { feature: "Flat whole-team pricing", them: false, us: true },
    ],
    faqs: [
      { q: "How is TradieJet different from Tradify?", a: "Both handle quoting, scheduling and invoicing. TradieJet adds lead capture and automatic follow-ups on the front end, includes a hosted quote page, and uses flat whole-team pricing." },
      { q: "Does TradieJet work in New Zealand?", a: "Yes — it's built for both AU and NZ, with correct GST, NZD pricing and Xero and MYOB sync." },
    ],
  },
  {
    slug: "fergus",
    name: "Fergus",
    metaTitle: "Fergus Alternative for AU & NZ Trades · TradieJet",
    metaDescription:
      "A simpler, all-in-one Fergus alternative. TradieJet captures leads, quotes, schedules, invoices and takes payment — with flat team pricing and easy onboarding.",
    headline: "The all-in-one Fergus alternative",
    subhead:
      "Fergus is powerful job management for trades. TradieJet keeps the job workflow simple, adds lead capture and follow-up, and gets you running in minutes.",
    theirStrength: "Fergus is a capable job and workflow management platform aimed at growing trade and plumbing businesses.",
    whySwitch: [
      { title: "Easy to set up and use", desc: "Guided onboarding, a starter price book for your trade and a default automation pack mean you're quoting on day one." },
      { title: "Lead capture and auto-reply included", desc: "Turn website, Google and Meta enquiries into booked jobs with one inbox and instant replies." },
      { title: "Flat pricing that scales", desc: "One price for the whole team instead of per-user fees, so growing your crew doesn't grow your software bill." },
    ],
    comparison: [
      { feature: "Quotes, jobs & invoicing", them: true, us: true },
      { feature: "Online card payments", them: true, us: true },
      { feature: "Xero & MYOB sync", them: true, us: true },
      { feature: "Capture your own leads (site/Google/Meta)", them: false, us: true },
      { feature: "Instant lead auto-reply & follow-ups", them: "limited", us: true },
      { feature: "Built-in website / quote page", them: false, us: true },
      { feature: "Flat whole-team pricing", them: "limited", us: true },
    ],
    faqs: [
      { q: "Is TradieJet simpler than Fergus?", a: "TradieJet focuses on a clean lead-to-paid workflow with guided setup, a trade-specific starter price book and built-in automations, so most tradies are up and running the same day." },
      { q: "Can I capture leads with TradieJet?", a: "Yes — that's a core difference. Enquiries from your site, Google and Meta land in one inbox and get an instant auto-reply." },
    ],
  },
  {
    slug: "aroflo",
    name: "AroFlo",
    metaTitle: "AroFlo Alternative for AU & NZ Trades · TradieJet",
    metaDescription:
      "A lighter, faster-to-adopt AroFlo alternative. TradieJet captures leads, quotes, schedules and invoices with flat team pricing — ideal for sole traders and small crews.",
    headline: "The AroFlo alternative for small and growing trades",
    subhead:
      "AroFlo suits larger field-service operations. TradieJet gives sole traders and small crews the same lead-to-paid workflow without the complexity or the setup cost.",
    theirStrength: "AroFlo is a feature-rich field-service and job-management platform aimed at established trade and service companies.",
    whySwitch: [
      { title: "Up and running in minutes, not weeks", desc: "No lengthy implementation — guided onboarding and a starter price book get you quoting straight away." },
      { title: "Lead capture on the front end", desc: "Website, Google and Meta enquiries flow into one inbox with instant auto-reply and automated follow-ups." },
      { title: "Flat, predictable pricing", desc: "Sole traders from $20/mo and the whole team on one flat price — no per-user or enterprise contracts." },
    ],
    comparison: [
      { feature: "Quotes, jobs & invoicing", them: true, us: true },
      { feature: "Online card payments", them: true, us: true },
      { feature: "Xero & MYOB sync", them: true, us: true },
      { feature: "Capture your own leads (site/Google/Meta)", them: false, us: true },
      { feature: "Instant lead auto-reply & follow-ups", them: "limited", us: true },
      { feature: "Built-in website / quote page", them: false, us: true },
      { feature: "Quick self-serve setup", them: "limited", us: true },
    ],
    faqs: [
      { q: "Is TradieJet a good fit for a sole trader?", a: "Yes — it's designed to be simple enough for a one-person business while scaling to a 15-person crew on flat pricing." },
      { q: "How long does setup take?", a: "Most tradies are quoting the same day thanks to guided onboarding, a trade-specific starter price book and a default automation pack." },
    ],
  },
  {
    slug: "simpro",
    name: "simPRO",
    metaTitle: "simPRO Alternative for AU & NZ Trades · TradieJet",
    metaDescription:
      "A simpler, more affordable simPRO alternative for small and mid-size trades. TradieJet captures leads, quotes, schedules and invoices with flat team pricing and fast setup.",
    headline: "The simPRO alternative without the enterprise overhead",
    subhead:
      "simPRO is built for large operations. TradieJet gives small and mid-size trades a complete lead-to-paid workflow that's quick to adopt and priced flat.",
    theirStrength: "simPRO is an enterprise-grade job and project management platform for larger trade and service businesses.",
    whySwitch: [
      { title: "No enterprise implementation", desc: "Skip the onboarding project and long contracts — sign up, follow the guided setup and start quoting the same day." },
      { title: "Lead capture built in", desc: "Capture and auto-reply to enquiries from your website, Google and Meta so you win more of the work that comes in." },
      { title: "Flat pricing for smaller teams", desc: "Sole traders from $20/mo and up to 15 users on one flat Company price, with no per-seat or enterprise fees." },
    ],
    comparison: [
      { feature: "Quotes, jobs & invoicing", them: true, us: true },
      { feature: "Online card payments", them: true, us: true },
      { feature: "Xero & MYOB sync", them: true, us: true },
      { feature: "Capture your own leads (site/Google/Meta)", them: false, us: true },
      { feature: "Instant lead auto-reply & follow-ups", them: "limited", us: true },
      { feature: "Built-in website / quote page", them: false, us: true },
      { feature: "Fast self-serve setup", them: false, us: true },
      { feature: "Flat pricing for small teams", them: false, us: true },
    ],
    faqs: [
      { q: "Is TradieJet cheaper than simPRO?", a: "For sole traders and small crews, yes — flat pricing from $20/mo with the whole team on one Company price, and no enterprise implementation fees." },
      { q: "Will I lose features moving from simPRO?", a: "TradieJet covers the core lead-to-paid workflow — leads, quotes, jobs, scheduling, invoicing, payments and accounting sync. Very large operations with complex project needs may still prefer an enterprise tool." },
    ],
  },
];

export const TRADE_SLUGS = TRADES.map((t) => t.slug);
export const COMPETITOR_SLUGS = COMPETITORS.map((c) => c.slug);

export function getTrade(slug: string): Trade | undefined {
  return TRADES.find((t) => t.slug === slug);
}
export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
