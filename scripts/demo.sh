#!/usr/bin/env bash
#
# One-command demo launcher for LeadFlow Pro.
#   - verifies Postgres + Redis are up
#   - reseeds the NZ demo tenant (Sparks Electrical NZ)
#   - opens the browser
#   - starts API + workers + web (unless already running)
#
# Usage:  ./scripts/demo.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# DATABASE_URL is extracted directly (the root .env has a multiline value that
# breaks plain shell sourcing).
export DATABASE_URL="$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"

port_up() { nc -z localhost "$1" >/dev/null 2>&1; }

echo "▶ Checking infrastructure…"
if ! port_up 5433; then
  echo "  ✗ Postgres not running on :5433 — start it with: pnpm docker:up"
  exit 1
fi
if ! port_up 6379; then
  echo "  ✗ Redis not running on :6379 — start it with: pnpm docker:up"
  exit 1
fi
echo "  ✓ Postgres and Redis are up"

echo "▶ Reseeding NZ demo data…"
( cd packages/db && npx tsx prisma/seed.ts )

cat <<'EOF'

──────────────────────────────────────────────
  Demo ready →  http://localhost:3000

  Owner : owner@sparksnz.co.nz  / Demo1234!
  Tech  : tech@sparksnz.co.nz   / Demo1234!  (Field App)
──────────────────────────────────────────────
EOF

# Open the browser shortly after (gives the dev server a moment if we start it).
( sleep 4; command -v open >/dev/null 2>&1 && open http://localhost:3000 || true ) &

if port_up 3000 && port_up 4000; then
  echo "▶ Apps already running — browser opening. (Leave your existing 'pnpm dev' running.)"
else
  echo "▶ Starting API + workers + web … (press Ctrl+C to stop)"
  pnpm dev
fi
