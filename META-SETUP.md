# Meta (Facebook/Instagram) Lead Ads — Setup

The "Connect Facebook" flow is built into LeadFlow (Settings → Lead Sources). For it to work,
**you (the platform owner) create ONE Meta app**; then each tradie connects their own Page through it.

> Plain version: think of the Meta app as LeadFlow's "key" to talk to Facebook. You make it once.
> Your tradies then click "Connect Facebook" and pick their Page — no developer setup on their side.

---

## Part 1 — Create the Meta app (one time, ~30 min)

1. Go to **https://developers.facebook.com** → log in → **My Apps → Create App**.
2. App type: **Business**. Name it "LeadFlow Pro". 
3. In the app dashboard, **Add Products**:
   - **Facebook Login** → Settings → add the redirect URI (see Part 2).
   - **Webhooks** → subscribe to the **Page** object, field **`leadgen`**, with:
     - Callback URL: `https://leadflow-pro-api-37bj.onrender.com/api/v1/webhooks/meta`
     - Verify token: any secret string you choose (you'll reuse it as `META_VERIFY_TOKEN`).
4. **App Settings → Basic**: copy the **App ID** and **App Secret**. Add a **Privacy Policy URL** (required).

## Part 2 — Set 4 env vars in Render
Render → **leadflow-pro-api-37bj** → **Environment**:

| Key | Value |
|---|---|
| `META_APP_ID` | App ID from Part 1 |
| `META_APP_SECRET` | App Secret from Part 1 |
| `META_VERIFY_TOKEN` | the verify token string you chose |
| `META_REDIRECT_URI` | `https://leadflow-pro-api-37bj.onrender.com/api/v1/integrations/meta/callback` |

Also add that same redirect URI under **Facebook Login → Settings → Valid OAuth Redirect URIs** in the Meta app.
Save → the API redeploys.

## Part 3 — App Review (required for your CLIENT to connect their own Page)
Facebook restricts lead access. To let **other businesses** (your NZ client) connect their Pages:
- Submit the app for **App Review** requesting **Advanced Access** to: `leads_retrieval`,
  `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`, `business_management`.
- Review needs a screencast of the connect flow + a use-case description. Takes a few days.

**Before review is approved:** only people with a **role on your Meta app** (Admin / Developer / Tester)
can connect. So for your client to TEST now, add them as a **Tester** in the Meta app
(App Roles → Roles → Add Testers → their Facebook account).

---

## How a tradie connects (once Parts 1–2 are done)
1. Settings → **Lead Sources** → **Connect Facebook**.
2. Sign in with Facebook, approve permissions.
3. Pick the **Page** that runs their lead ads → **Connect Page**.
4. Done — every lead-form submission on that Page now flows into LeadFlow automatically
   (with the auto-reply + your alert), exactly like website leads.

## How to test end-to-end
- In Meta's **Lead Ads Testing Tool** (`developers.facebook.com/tools/lead-ads-testing`), pick the
  connected Page + a lead form, and submit a test lead. It should appear in LeadFlow → Leads within seconds.

---

## Honest status
- ✅ The connect flow, Page subscription, webhook intake, and lead creation are **built and live in the code**.
- ⚠️ It is **unverified against real Facebook** here (no Meta app credentials in this environment) — like Xero/MYOB live paths, it needs Parts 1–3 to actually run.
- ⚠️ **App Review is the gating item** for your client to use their own Page in production. Plan a few days for it.
