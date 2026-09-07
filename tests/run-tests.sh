#!/usr/bin/env bash
# Runs tests/tests.html in headless Edge and prints the summary and failures.
EDGE="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
DIR="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)"
"$EDGE" --headless=new --disable-gpu --allow-file-access-from-files \
  --virtual-time-budget=5000 --dump-dom "file:///$DIR/tests.html" 2>/dev/null \
  | grep -oE '(TESTS|FAIL): [^<]*'
