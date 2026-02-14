#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"

HEARTBEAT_INTERVAL_SECONDS="${HEARTBEAT_INTERVAL_SECONDS:-60}"
CODEX_TIMEOUT_SECONDS="${CODEX_TIMEOUT_SECONDS:-1800}"

WORKER_LOG="${WORKER_LOG:-/tmp/ralph_codex.log}"
WORKER_PID_FILE="${WORKER_PID_FILE:-/tmp/ralph_codex.pid}"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[$(timestamp)] missing required command: $1"
    exit 1
  fi
}

require_cmd jq
require_cmd npm
require_cmd codex

if ! [[ "$HEARTBEAT_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [ "$HEARTBEAT_INTERVAL_SECONDS" -lt 5 ]; then
  echo "[$(timestamp)] HEARTBEAT_INTERVAL_SECONDS must be >= 5"
  exit 1
fi

if ! [[ "$CODEX_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [ "$CODEX_TIMEOUT_SECONDS" -lt 1 ]; then
  echo "[$(timestamp)] CODEX_TIMEOUT_SECONDS must be >= 1"
  exit 1
fi

if [ ! -f "$PRD_FILE" ]; then
  echo "[$(timestamp)] prd file missing: $PRD_FILE"
  exit 1
fi

all_passed() {
  jq -e '.userStories | all(.passes == true)' "$PRD_FILE" >/dev/null 2>&1
}

remaining_count() {
  jq '.userStories | map(select(.passes == false)) | length' "$PRD_FILE" 2>/dev/null || echo "unknown"
}

echo "[$(timestamp)] keepalive started"
echo "[$(timestamp)] repo=$REPO_ROOT"
echo "[$(timestamp)] heartbeat=${HEARTBEAT_INTERVAL_SECONDS}s codex_timeout=${CODEX_TIMEOUT_SECONDS}s"

while true; do
  if all_passed; then
    echo "[$(timestamp)] all stories passed, keepalive exiting"
    exit 0
  fi

  remaining="$(remaining_count)"
  worker_pid=""
  if [ -f "$WORKER_PID_FILE" ]; then
    worker_pid="$(cat "$WORKER_PID_FILE" 2>/dev/null || true)"
  fi

  if [ -n "$worker_pid" ] && ps -p "$worker_pid" >/dev/null 2>&1; then
    echo "[$(timestamp)] heartbeat: worker alive pid=$worker_pid remaining=$remaining"
  else
    echo "[$(timestamp)] worker missing, starting new ralph run (remaining=$remaining)"
    (
      cd "$REPO_ROOT"
      nohup env CODEX_TIMEOUT_SECONDS="$CODEX_TIMEOUT_SECONDS" npm run ralph:codex >>"$WORKER_LOG" 2>&1 &
      echo "$!" > "$WORKER_PID_FILE"
    )
    new_pid="$(cat "$WORKER_PID_FILE" 2>/dev/null || true)"
    echo "[$(timestamp)] worker started pid=$new_pid"
  fi

  sleep "$HEARTBEAT_INTERVAL_SECONDS"
done
