#!/usr/bin/env sh
set -eu

SOCK_PATH="${SOCK_PATH:-/tmp/sonia-emu.sock}"
WEBUI_HOST="${WEBUI_HOST:-0.0.0.0}"
WEBUI_PORT="${WEBUI_PORT:-5000}"

cleanup() {
  kill "$emu_pid" "$web_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

cargo run --manifest-path sonia-emu/emulator/Cargo.toml -- "$SOCK_PATH" &
emu_pid=$!

(
  cd sonia-emu/webui/src
  SOCK_PATH="$SOCK_PATH" uvicorn webui:app --host "$WEBUI_HOST" --port "$WEBUI_PORT" --no-access-log --no-use-colors
) &
web_pid=$!

wait "$emu_pid" "$web_pid"
