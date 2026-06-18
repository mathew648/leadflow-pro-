# Email-to-Lead — inbound mail setup

Lets tradies import leads from any portal (Builderscrack, hipages, NoCowboys, Oneflare, ServiceSeeking, Airtasker…) by forwarding the portal's notification emails to a unique TradieJet address. This sets up the mail service that receives those emails and hands them to the app.

Each tradie's address looks like: `leads-<key>@in.tradiejet.com` (shown in Settings → Lead Sources).

---

## Easiest option: SendGrid Inbound Parse (free, works with your current DNS)

You already use the registrar's DNS — just add MX records there. No need to move DNS.

### 1. SendGrid account
- Sign up at sendgrid.com (free tier is fine). You can use the same account for nothing else — this is only for *inbound*.

### 2. Add the MX record at your domain registrar
On `tradiejet.com`'s DNS, add an **MX** record on the `in` subdomain:

| Type | Host/Name | Value | Priority |
|---|---|---|---|
| MX | `in` (i.e. `in.tradiejet.com`) | `mx.sendgrid.net` | 10 |

### 3. Configure Inbound Parse in SendGrid
- SendGrid → **Settings → Inbound Parse → Add Host & URL**
- **Receiving Domain:** `in.tradiejet.com`
- **Destination URL:** `https://www.tradiejet.com/api/v1/webhooks/email?secret=YOUR_SECRET`
  - (the `?secret=` is optional but recommended — see step 5)
- Leave "POST the raw, full MIME message" **unchecked** (we want parsed fields).
- Save.

### 4. Test
- Send any email to `leads-<key>@in.tradiejet.com` (get the address from Settings → Lead Sources).
- It should appear as a new lead within seconds.

### 5. (Recommended) Set the shared secret + AI parsing in Render → `leadflow-pro-api-37bj` → Environment
- `INBOUND_EMAIL_SECRET` = a random string (the same one you put in the Destination URL `?secret=`). Blocks spam to the endpoint.
- `ANTHROPIC_API_KEY` = your Anthropic key → enables smart parsing (extracts name, phone, email, job). Without it, it still captures phone/email + tags the portal via simple rules.
- `INBOUND_EMAIL_DOMAIN` is already `in.tradiejet.com` by default (only change if you use a different subdomain).

---

## Alternative: Cloudflare Email Routing (free, if your DNS is on Cloudflare)

If you move `tradiejet.com`'s DNS to Cloudflare (free), you can use an **Email Worker** instead of SendGrid:
1. Cloudflare → your domain → **Email → Email Routing** → enable.
2. Create an **Email Worker** that POSTs JSON to `https://www.tradiejet.com/api/v1/webhooks/email`:
   ```js
   import PostalMime from "postal-mime";
   export default {
     async email(message, env) {
       const parsed = await PostalMime.parse(message.raw);
       await fetch("https://www.tradiejet.com/api/v1/webhooks/email", {
         method: "POST",
         headers: { "content-type": "application/json", "x-inbound-secret": env.INBOUND_EMAIL_SECRET },
         body: JSON.stringify({
           to: message.to,
           from: message.from,
           subject: parsed.subject,
           text: parsed.text || parsed.html || "",
         }),
       });
     },
   };
   ```
3. Route `*@in.tradiejet.com` (catch-all) to that Worker.

---

## How the endpoint works (for reference)
`POST /api/v1/webhooks/email` accepts JSON **or** multipart/form-data with fields `to, from, subject, text` (+ optional `secret`). It:
1. Reads the tenant key from the `to` address (`leads-<key>@…`).
2. Detects forwarding-confirmation emails (Gmail/Outlook) → surfaces the code in Settings (no lead made).
3. Otherwise AI-parses the customer and creates a lead, tagged with the detected portal, through the normal auto-reply / follow-up / scoring pipeline.
