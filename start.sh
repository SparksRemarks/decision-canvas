#!/usr/bin/env bash
# FF EV Calculator — one-line demo bootstrap.
# Safe to run repeatedly: it will NEVER overwrite an existing .env.

set -e
cd "$(dirname "$0")"

# 1. Install deps if missing
if [ ! -d node_modules ]; then
  echo "[ff-ev] installing dependencies (one-time, ~20s)..."
  npm install
fi

# 2. Create .env from template only if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "[ff-ev] Created .env from template."
  echo "[ff-ev] Add your ANTHROPIC_API_KEY to .env, then re-run ./start.sh"
  echo ""
  if command -v open >/dev/null 2>&1; then
    open -e .env
  fi
  exit 1
fi

# 3. Refuse to start if the key is still the placeholder
if grep -qE "ANTHROPIC_API_KEY=sk-ant-\.\.\." .env || grep -qE "^ANTHROPIC_API_KEY=$" .env; then
  echo "[ff-ev] ANTHROPIC_API_KEY in .env is still the placeholder."
  echo "[ff-ev] Edit .env and paste your real key, then re-run ./start.sh"
  if command -v open >/dev/null 2>&1; then
    open -e .env
  fi
  exit 1
fi

# 4. Boot
echo "[ff-ev] starting on http://localhost:5173 — Ctrl-C to stop"
exec npm run dev
