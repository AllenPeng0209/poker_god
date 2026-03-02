#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="$ROOT_DIR/docs/product/evidence"
mkdir -p "$EVIDENCE_DIR"

PORT="${US001_UI_EVIDENCE_PORT:-3130}"
OUT_FILE="${1:-$EVIDENCE_DIR/2026-03-02-us001-ui-acceptance.html}"

cd "$ROOT_DIR"

NEXT_PUBLIC_ADMIN_CAMPAIGN_READINESS_V1=1 \
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001 \
npm --workspace @poker-god/web run dev -- --hostname 127.0.0.1 --port "$PORT" >/tmp/poker_god_us001_ui_dev.log 2>&1 &
DEV_PID=$!

cleanup() {
  if kill -0 "$DEV_PID" >/dev/null 2>&1; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/app/reports" >/dev/null; then
    break
  fi
  sleep 1
done

curl -sS "http://127.0.0.1:${PORT}/app/reports" > "$OUT_FILE"

grep -q "Top Leakage Summary" "$OUT_FILE"
grep -q "查看 AI Coach History" "$OUT_FILE"

echo "US-001 UI acceptance evidence captured: $OUT_FILE"