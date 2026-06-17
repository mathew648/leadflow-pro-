# LeadFlow Pro — Roadmap & Task Backlog

Prioritised as CTO + market analyst, to hit: **easy onboarding · beat AU/NZ competitors · scale toward 50k users.**
Legend: ✅ done · 🔜 next · ⬜ pending · 🔒 blocked (needs your input/credentials)

---

## Phase 0 — Built so far ✅
- ✅ Lead capture: website form (open CORS, embeddable), Google Ads webhook, Meta webhook + self-serve connect flow, manual
- ✅ Automations engine + default pack (new-lead reply, quote follow-up, quote-approved) + fixed rendering bugs
- ✅ Business alerts + notification toggles (new lead / quote viewed / approved / payment)
- ✅ Quotes → e-sign portal → jobs → invoices → Stripe payment
- ✅ Xero + MYOB sync workers (provider-aware) — *live push unverified*
- ✅ Tradie onboarding checklist, starter price-books per trade, Excel/CSV price import, branding (logo/colour)
- ✅ Marketing site (home/pricing/features), paid Stripe signup, 4-plan structure, non-tradie simple mode
- ✅ Platform admin panel (all tradies, MRR, signups chart, last-active, promo emails)
- ✅ Email sending (Resend) + "send test email"; production deployed & live

---

## Phase 1 — Make it production-trustworthy (do FIRST; can't scale on shaky ground)
- 🔒 **Fix `API_URL` in Render** → `https://leadflow-pro-api-37bj.onrender.com` (lead-source URLs depend on it)
- 🔒 **Verify live integrations with real creds**: Stripe checkout+webhook, Xero push, MYOB push, Meta connect, email domain
- 🔒 **Verify a sending domain in Resend** (so customer emails actually deliver, not just to yourself)
- ⬜ **Upgrade off free tier** (api/web/Redis/DB → Starter): kills cold-start errors + free-DB-deletion risk
- ⬜ **Consolidate to a clean release flow**: merge integration → main, set up CI (typecheck/build on PR), staging vs prod
- ⬜ **Error monitoring + uptime**: confirm Sentry DSN set; add an uptime/health alert
- ⬜ **Privacy Policy + Terms pages** (`/privacy`, `/terms`) — required for Meta review + customer trust
- ⬜ **Automated tests** for the core flow (lead→quote→invoice→pay) so we ship fast without breakage

## Phase 2 — Onboarding engine (the growth flywheel — highest ROI build)
- 🔜 **ABN/NZBN auto-lookup** at signup → auto-fill business name/address/GST (minimal typing)
- 🔜 **Import from Xero/MYOB on signup** → pull existing customers, price items, invoices (arrive with data)
- ⬜ **"Switch from ServiceM8/Tradify" importer** (CSV/API) → migrate competitors' customers in 1 click
- ⬜ **AI setup assistant** → "tell me your trade" → configures pipeline, automations, quote templates
- ⬜ **SMS/phone-first signup** → start by texting a number (tradies live on phones)
- ⬜ **Concierge onboarding** for Company/Website plans (human or AI-guided setup)

## Phase 3 — Daily-use product (retention + competitive parity)
- ⬜ **Mobile app / installable PWA** → tradies are on phones; exploits ServiceM8's weak Android
- ⬜ **Offline mode** → on-site dead zones; Tradify lacks this
- ⬜ **Reviews / reputation automation** → auto-request Google reviews after a job (huge for trades)
- ⬜ **Push notifications** (new lead, quote signed, payment) to the phone
- ⬜ **Supplier catalog price-book import** (Reece/Tradelink/Ideal Electrical) — AroFlo's strength

## Phase 4 — Growth & marketing wedges
- ⬜ **Anti-hipages landing page** ("stop paying for shared leads — capture your own")
- ⬜ **Flat-vs-per-user pricing comparison page** ("15 users for $50, not $780")
- ⬜ **Referral program** ("refer a mate, both get a month free")
- ⬜ **Partner/reseller program** (web agencies resell the Website plan; supplier & association deals)
- ⬜ **SEO content hub** ("[trade] software", "tradie CRM", migration guides)

## Phase 5 — Big bets
- ⬜ **Website builder** (the $149 plan's headline feature) — admin designs, customer edits, hosting
- ⬜ **Deeper AI** (lead scoring quality, AI quote drafting, AI follow-up copy per trade)
- ⬜ **QuickBooks integration** (round out accounting)
- ⬜ **Multi-trade marketplace / directory** (own the lead source, compete with hipages directly)

## Cross-cutting / compliance
- 🔒 **Meta App Review + Business Verification** (so clients connect their own Page in production)
- ⬜ **Security review** (auth, rate limits, tenant isolation, token encryption) before scale
- ⬜ **Scalability pass** (DB indexes/pooling, queue capacity, multi-region) as users grow
- ⬜ **Support tooling** (in-app help, knowledge base) — critical for non-techy users at volume

---

## Recommended build order (start here)
1. **Phase 1 trust items** you can action now: `API_URL` fix, verify domain, upgrade plan.
2. **ABN/NZBN lookup** (Phase 2) — small, high-impact "it's ready for them" win.
3. **Xero/MYOB import on signup** (Phase 2) — removes the #1 setup chore + aids competitor switching.
4. **Mobile/PWA + offline** (Phase 3) — daily usability + competitive parity.
5. **Anti-hipages + pricing-comparison pages** (Phase 4) — convert the wedge into signups.
