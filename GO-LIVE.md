# LeadFlow Pro — Go-Live Checklist (non-technical)

Step-by-step to take the platform live. Keep this file for every future deploy.

> **You need two secret keys for Part B, Step 8: `JWT_SECRET` and `ENCRYPTION_KEY`.**
> Generate them yourself (each is one line) by running this in a terminal, twice:
>
> ```
> openssl rand -hex 32
> ```
>
> Paste the first output as `JWT_SECRET`, the second as `ENCRYPTION_KEY`.
> Treat these like passwords — keep them in a password manager, never commit them to git.
> (The pair generated during setup were shared privately in chat — reuse those, or generate fresh ones; if you change them later, existing logins/stored tokens are invalidated.)

---

## PART A — Put the code into the live branch (GitHub)

1. Open: **https://github.com/mathew648/leadflow-pro-/pull/new/integration/full-platform**
2. Confirm it reads **base: `main`** ← **compare: `integration/full-platform`**.
3. Title: `Full platform launch`. Click **Create pull request**.
4. Click **Merge pull request** → **Confirm merge**.
   ✅ Code is now on `main`. The other feature branches auto-close as already-merged — no duplicates.

---

## PART B — Turn it into a live website (Render)

> Render = the hosting service. If the blueprint was already applied before, skip to Step 7.

5. Go to **https://dashboard.render.com** and log in (or sign up — free).
6. Click **New → Blueprint**. Connect GitHub, pick the **`leadflow-pro-`** repo, click **Apply**.
   It creates 4 services (database, redis, api, web). Wait ~5–10 min for the build.
7. Click the **leadflow-pro-api** service → **Environment** tab.
8. Click **Add Environment Variable** for each (minimum to run):

   | Key | Value |
   |-----|-------|
   | `JWT_SECRET` | (see top of this file) |
   | `ENCRYPTION_KEY` | (see top of this file) |
   | `PLATFORM_ADMIN_EMAILS` | `mathew@webmaniacs.co.nz` |

   Click **Save Changes** → the API restarts.

   **Optional (add only when you want that feature):**
   - `RESEND_API_KEY` — real outgoing emails (from resend.com)
   - `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — card payments / paid signups
   - `XERO_CLIENT_ID` + `XERO_CLIENT_SECRET` + `XERO_REDIRECT_URI` — Xero sync
   - `MYOB_CLIENT_ID` + `MYOB_CLIENT_SECRET` + `MYOB_REDIRECT_URI` + `MYOB_API_KEY` — MYOB sync

---

## PART C — Check it's working

9. In Render, **leadflow-pro-web** and **leadflow-pro-api** show **"Live"** with URLs like
   `https://leadflow-pro-web.onrender.com`. Open the **web** URL.
10. You should see the marketing homepage ("Win more jobs. Do less admin."). Click **Start free**,
    register a test account, confirm the dashboard shows the setup checklist + starter price book.
11. To see the **admin panel** (all tradies): log in with the email in `PLATFORM_ADMIN_EMAILS`.
    A **"Platform Admin"** link appears in the bottom-left menu.

---

## Important notes

- **First load is slow (~30–60s)** on the free plan — services sleep when idle.
- For real client use, upgrade **api**, **web**, and the **database** to the ~US$7/mo "Starter" plan
  (Render → each service → Settings → Instance Type). The **free database is deleted after ~30 days** —
  upgrade it before storing anything you want to keep.
- **Card payments, accounting sync, and real email stay OFF** until you add the optional keys in Step 8.
  That's expected, not a bug.
- The build is verified to **compile and deploy**, but live third-party flows (Stripe billing, Xero/MYOB
  push, real email/SMS) are **not yet tested against real accounts** — smoke-test them on the live site
  with real test keys before relying on them with a paying customer.

---

## Updating later (after any change)

Render auto-deploys whenever `main` changes. So to ship an update:
1. Get the change merged into `main` on GitHub (via a pull request).
2. Render rebuilds and redeploys automatically — no other steps.

---

## What's in this platform

- **Lead capture:** website form, Google Ads, Meta Ads, manual entry — with instant auto-reply
- **Automations & alerts:** new-lead replies, quote follow-ups, business alerts (email + SMS)
- **Quoting → e-sign → invoicing → online payment** (Stripe)
- **Accounting sync:** Xero (and MYOB)
- **Tradie onboarding:** setup checklist, starter price-books per trade, Excel/CSV price import, branding
- **Marketing website** + **paid self-serve signup**
- **Platform admin panel:** all tradies, who's paying vs trial, MRR, send promo emails
