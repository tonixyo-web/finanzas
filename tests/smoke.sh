#!/usr/bin/env bash
# Usage: bash tests/smoke.sh [hash] [expected-text]
EDGE="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
ROOT="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || pwd)"
HASH="${1:-home}"
EXPECT="${2:-Inicio}"
OUT="$("$EDGE" --headless=new --disable-gpu --allow-file-access-from-files \
  --virtual-time-budget=5000 --dump-dom "file:///$ROOT/index.html#$HASH" 2>/dev/null)"
if grep -q "$EXPECT" <<<"$OUT"; then echo "SMOKE OK: #$HASH contiene '$EXPECT'"; else echo "SMOKE FAIL: #$HASH sin '$EXPECT'"; exit 1; fi
