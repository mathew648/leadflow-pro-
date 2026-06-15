#!/usr/bin/env bash
#
# Exposes the running demo (http://localhost:3000) on a temporary public HTTPS
# URL so a remote client can click through it. The Next.js server proxies /api
# to the backend internally, so only port 3000 needs to be tunnelled.
#
# Run this ONLY while you're actively demoing — it makes your local app
# reachable from the internet. Press Ctrl+C to close the tunnel.
#
# Usage:  ./scripts/demo-tunnel.sh
#
set -euo pipefail

if ! nc -z localhost 3000 >/dev/null 2>&1; then
  echo "✗ Nothing is running on :3000. Start the demo first (./scripts/demo.sh)."
  exit 1
fi

echo "▶ Opening a public tunnel to http://localhost:3000"
echo "  Share the https://…trycloudflare.com link that appears with your client."
echo "  Press Ctrl+C when the demo is finished to close it."
echo
exec npx cloudflared tunnel --url http://localhost:3000
