#!/usr/bin/env bash
# macOS / Linux twin of run-local.bat
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "=== QMIS ERP backend — run-local ==="
echo

./setup-local.sh

if [[ ! -x ".venv/bin/python" ]]; then
  echo "ERROR: .venv missing after setup. Run ./setup-local.sh manually."
  exit 1
fi

if [[ ! -f ".env" ]]; then
  cp .env.example .env
fi

echo "Starting API on http://127.0.0.1:8000 ..."
echo "Press Ctrl+C to stop."
echo
exec .venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
