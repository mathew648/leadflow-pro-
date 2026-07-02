/**
 * Seeds a set of evergreen, SEO-focused blog posts for the TradieJet marketing blog.
 *
 * Idempotent: upserts by unique slug, so it's safe to run repeatedly (re-running refreshes
 * the copy but preserves each post's original publish date). These are platform-global
 * marketing posts (BlogPost has no tenantId).
 *
 * Run against a database:
 *   DATABASE_URL="<your db url>" pnpm --filter @lfp/db db:seed:blog
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedPost {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  content: string;
}

const AUTHOR = "TradieJet Team";

const POSTS: SeedPost[] = [
  {
    slug: "how-to-quote-a-job-as-a-tradie",
    title: "How to Quote a Job as a Tradie: A Step-by-Step Guide",
    excerpt:
      "A clear, step-by-step guide to quoting trade jobs — what to include, how to price for profit, and how to send quotes that win more work.",
    tags: ["Quoting", "Guides", "Getting started"],
    content: `Quoting is where jobs are won or lost. Price too high and the customer goes elsewhere; too low and you erode your own margin. A clear, consistent quoting process fixes both — and makes you look far more professional than the tradie who scribbles a number on the back of a business card.

Here's a step-by-step process you can use on every job.

## 1. Understand the job before you price it

The best quotes start with good information. Before you put a number together, confirm:

- **Scope** — exactly what the customer wants done (and what they *don't*).
- **Site conditions** — access, existing work, anything that could slow you down.
- **Materials** — the specific fittings, fixtures and quantities required.
- **Timing** — when they want it done, and whether that affects your schedule.

If you can't get to site, ask the customer to send photos and details. A short "tell us about your job" form saves you a wasted trip and lets you quote the same day.

## 2. Build your price from a price book

Guessing prices from memory is slow and inconsistent. Instead, keep a **price book** of your common items — call-out fees, hourly rates, and the materials you use most — with your costs and sell prices saved. Then a quote becomes a matter of picking line items rather than recalculating from scratch.

Break every quote into three buckets so you can see your margin clearly:

- **Materials** — what the job consumes.
- **Labour** — your time (and your team's), at your hourly rate.
- **Other** — subcontractors, equipment hire, disposal, permits.

## 3. Add a fair margin

Your quote needs to cover materials, labour *and* a profit margin — the money that keeps your business running and growing. Decide on a target margin and apply it consistently. Don't discount to win a job you'll resent doing.

## 4. Make the quote easy to say yes to

A professional-looking quote wins more work than a plain text message. Include:

- Your logo and business details.
- A clear itemised breakdown (or a clean total, depending on the job).
- The total including GST.
- What's included and excluded.
- How long the quote is valid.
- A simple way to accept — ideally a link the customer can review and approve from their phone.

## 5. Send it fast — then follow up

Speed wins jobs. The tradie who quotes within a day almost always beats the one who takes a week. And if you don't hear back, a friendly follow-up a couple of days later recovers a surprising number of jobs — most people just get busy and forget.

## Let the software do the heavy lifting

TradieJet turns this whole process into a few taps: build quotes from your saved price book, send them for the customer to approve and e-sign online, and let automatic follow-ups chase the ones that go quiet. When a quote is approved, it rolls straight into a scheduled job.

[See how quoting works in TradieJet](/features) or [start a free trial](/register) and quote your next job in minutes.`,
  },
  {
    slug: "how-to-get-more-leads-trade-business",
    title: "How to Get More Leads for Your Trade Business: 9 Practical Ways",
    excerpt:
      "Nine proven ways for tradies to get more leads — from your own website and Google to reviews, referrals and fast follow-ups.",
    tags: ["Leads", "Marketing", "Growth"],
    content: `Every trade business runs on a steady flow of work. When the phone goes quiet, it's usually not a skills problem — it's a lead problem. Here are nine practical ways to get more of your own leads, without renting them from a marketplace that sends the same job to three competitors.

## 1. Own a simple "request a quote" page

You don't need an expensive website to capture leads. A single branded page where customers can request a quote — shared via a link and QR code — turns your Google profile, socials and email signature into lead sources. Put the link everywhere.

## 2. Claim your Google Business Profile

A complete Google Business Profile is the single highest-value free thing most tradies ignore. Add your trades, service area, photos of your work, and keep your hours current. It's how local customers find you when they search "electrician near me".

## 3. Ask every happy customer for a review

Reviews are social proof *and* a ranking signal. Get in the habit of asking for a review the moment a job is done and the customer is happy — a quick link makes it painless. More reviews means more trust and more calls.

## 4. Turn your socials into a funnel

Before-and-after photos of your work perform brilliantly on Facebook and Instagram. The key is a clear next step: put your quote-request link in your bio so interest turns into enquiries instead of just likes.

## 5. Respond in minutes, not days

Here's the uncomfortable truth: most leads go to whoever replies first. If an enquiry sits in your inbox until the weekend, you've probably lost it. An instant auto-reply buys you time and signals you're on the ball.

## 6. Make referrals easy

Your past customers are your best salespeople. A simple referral offer — a discount or a small thank-you — gives them a reason to pass your name along.

## 7. List where your customers already look

Directories and lead marketplaces have their place. Just make sure you funnel those enquiries into *your* system so you own the relationship and can follow up and re-market to them later.

## 8. Follow up on old quotes

Some of your best leads are ones you've already quoted. A polite nudge on quotes that went quiet recovers work you've already done the hard part for.

## 9. Capture every lead in one place

The real killer isn't a lack of leads — it's leads scattered across texts, voicemail, email and three different apps, some of which never get a reply. Bring them into one inbox so nothing slips through.

## Bring it all together

TradieJet captures leads from your website, Google, Meta and your quote page into one inbox, replies instantly, and follows up automatically — so you respond first and win more of the work that's already coming your way.

[See how lead capture works](/features), [find TradieJet for your trade](/for), or [start a free trial](/register).`,
  },
  {
    slug: "how-to-get-paid-faster-tradie-invoicing",
    title: "How to Get Paid Faster: 7 Invoicing Tips for Tradies",
    excerpt:
      "Seven simple invoicing habits that help tradies get paid faster — clear terms, online payments, automatic reminders and more.",
    tags: ["Invoicing", "Cash flow", "Getting paid"],
    content: `Doing great work is only half the job — getting paid for it on time is the other half. Late payments are one of the biggest sources of stress for trade businesses, and most of it comes down to invoicing habits you can fix today. Here are seven.

## 1. Invoice the moment the job is done

Every day you wait to send an invoice is a day added to when you get paid. The best time to invoice is the moment you finish, while the work is fresh and the customer is happy. Sending from your phone on site means it's done before you've packed up the van.

## 2. Set clear payment terms

"Payment on completion" or "due within 7 days" removes ambiguity. State your terms clearly on every invoice and quote so there are no surprises — and so an overdue invoice is unmistakably overdue.

## 3. Make it effortless to pay

The easier you make paying, the faster it happens. An invoice with a **"pay now" card button** gets paid far quicker than one that asks the customer to log into their banking app and type in your account details. Offer online payment and watch your average payment time drop.

## 4. Send professional, itemised invoices

A branded, itemised invoice looks legitimate and answers the customer's questions before they ask. Include your business details, the work done, GST, the total, and the due date. Professional invoices get paid; scrappy ones get questioned.

## 5. Take a deposit on bigger jobs

For larger jobs, a deposit up front protects your cash flow and filters out time-wasters. Progress payments at agreed milestones keep money coming in across long jobs instead of all at the end.

## 6. Automate your reminders

Chasing payments is awkward and easy to put off — so automate it. A polite automatic reminder when an invoice becomes overdue does the uncomfortable job for you, consistently, without you having to make the call.

## 7. Keep your books in sync

Manually re-entering every payment into your accounting software is a waste of an evening. When your invoicing syncs to Xero or MYOB automatically, your books stay current and reconciliation is painless.

## Get paid faster with TradieJet

TradieJet sends branded invoices with online card payment, chases overdue invoices for you, and syncs every payment to Xero or MYOB automatically — so you spend less time chasing money and more time earning it.

[See how invoicing and payments work](/features) or [start a free trial](/register).`,
  },
];

async function main() {
  console.log(`Seeding ${POSTS.length} blog posts…`);
  for (const post of POSTS) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: post.slug } });
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        tags: post.tags,
        authorName: AUTHOR,
        status: "published",
        publishedAt: new Date(),
      },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        tags: post.tags,
        authorName: AUTHOR,
        status: "published",
        // Preserve the original publish date on re-runs.
        publishedAt: existing?.publishedAt ?? new Date(),
      },
    });
    console.log(`  ✓ ${post.slug}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
