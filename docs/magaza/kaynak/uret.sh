#!/usr/bin/env bash
# Mağaza görsellerini yeniden üretir. Playwright depoya bağımlılık olarak EKLENMEZ;
# playwright-core geçici bir klasöre kurulur (varsayılan: $TMPDIR/okey-magaza-pw).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PW_DIR="${OKEY_PW_DIR:-${TMPDIR:-/tmp}/okey-magaza-pw}"
if [ ! -d "$PW_DIR/node_modules/playwright-core" ]; then
  mkdir -p "$PW_DIR"
  npm i --prefix "$PW_DIR" --no-save --no-audit --no-fund playwright-core@1.64.1 >/dev/null
fi
OKEY_PW_CORE="$PW_DIR/node_modules/playwright-core" node "$DIR/uret.cjs"
