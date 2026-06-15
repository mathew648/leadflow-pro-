# Deploying LeadFlow Pro (Render)

This deploys the whole system — Postgres, Redis, the Fastify API (which also runs the
background workers), and the Next.js web app — from one `render.yaml` blueprint.

> The web app proxies `/api/*` to the API service, so the browser only ever talks to the
> web origin (cookies + auth work cleanly). You only expose two public URLs: web + API.

---

## 0. One-time prep (local)

**Generate the two secrets** you'll paste into Render later:

```bash
# JWT signing secret (needs >=32 chars)
openssl rand -hex 32

# Encryption key for stored integration tokens (needs >=64 chars -> 32 bytes hex = 64)
openssl rand -hex 32
```

Keep both handy.

---

## 1. Push the repo to GitHub

The project isn't a git repo yet. From the project root:

```bash
cd /Users/ksrinivasrao/leadflow-pro-app
git init
git add .
git commit -m "Initial commit — LeadFlow Pro"
```

Create an **empty** GitHub repo (no README), then:

```bash
git remote add origin https://github.com/<you>/leadflow-pro.git
git branch -M main
git push -u origin main
```

(`.env` is gitignored — your local secrets are not pushed.)

---

## 2. Apply the Render blueprint

1. Go to **dashboard.render.com -> New -> Blueprint**.
2. Connect the GitHub repo you just pushed.
3. Render reads `render.yaml` and shows: **db**, **redis**, **api**, **web**. Click **Apply**.
4. It provisions Postgres + Redis and starts building the API and Web services.

---

## 3. Set the two API secrets

In **leadflow-pro-api -> Environment**, fill the two values left blank in the blueprint:

| Key | Value |
|---|---|
| `JWT_SECRET` | first `openssl rand -hex 32` output |
| `ENCRYPTION_KEY` | second `openssl rand -hex 32` output |

(Optional, to enable those features: `RESEND_API_KEY` for email, `ANTHROPIC_API_KEY` for AI.)

Save -> the API redeploys automatically.

---

## 4. Confirm the public URLs

Render names services `https://leadflow-pro-api.onrender.com` and
`https://leadflow-pro-web.onrender.com`. **If Render appended a suffix** (name already taken),
update these env vars to match the real URLs, then redeploy:

- API service -> `APP_URL` (web URL), `API_URL` (its own URL)
- Web service -> `API_URL` (API URL)

---

## 5. Create the database tables + demo data

Tables are created automatically by the API's pre-deploy step (`prisma db push`).
To load the **NZ demo data**, open **leadflow-pro-api -> Shell** and run:

```bash
pnpm --filter @lfp/db exec tsx prisma/seed.ts
```

(`DATABASE_URL` is already in the service environment.)

---

## 6. Test it

- Open the **web URL** -> log in:
  - Owner: `owner@sparksnz.co.nz` / `Demo1234!`
  - Tech:  `tech@sparksnz.co.nz` / `Demo1234!`
- API health: `https://leadflow-pro-api.onrender.com/health` -> `{ "status": "ok", "db": "connected" }`

---

## Free tier notes (important for a client demo)

The blueprint uses **free** plans so it applies with no charges. For live client use:

- **Cold starts:** free web services sleep after ~15 min idle (first load 30–60s). Upgrade
  **api** and **web** to **Starter** (~US$7/mo each) for always-on.
- **Database:** the free Postgres is removed after ~30 days. Upgrade the DB plan to keep data.
- **Build memory:** if a free build runs out of memory, bump that service to Starter and redeploy.

Upgrade per service in **Settings -> Instance Type** — no code changes needed.

---

## Updating after changes

```bash
git add . && git commit -m "..." && git push
```

Render auto-deploys on push. Schema changes apply via the pre-deploy `prisma db push`.
(For production-grade change control, switch to Prisma migrations later.)
