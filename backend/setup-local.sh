#!/usr/bin/env bash
# macOS / Linux twin of setup-local.bat
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "=== QMIS ERP backend — setup-local ==="
echo

# ---- 1) Locate psql ----
PSQL="$(command -v psql || true)"
if [[ -z "$PSQL" ]]; then
  for candidate in \
    /opt/homebrew/bin/psql \
    /usr/local/bin/psql \
    /Applications/Postgres.app/Contents/Versions/latest/bin/psql
  do
    if [[ -x "$candidate" ]]; then
      PSQL="$candidate"
      break
    fi
  done
fi
if [[ -z "$PSQL" ]]; then
  echo "ERROR: PostgreSQL client (psql) not found."
  echo "Install via Homebrew: brew install postgresql@17"
  echo "Or install Postgres.app."
  exit 1
fi

# ---- 2) Create database qmis_erp if missing ----
# Prefer PostgreSQL 18 (EnterpriseDB / pgAdmin) on this Mac — usually port 5433.
# Homebrew postgresql@14 often still owns 5432; do not use that unless forced.
PGHOST="${PGHOST:-localhost}"

pick_psql() {
  if [[ -x /Library/PostgreSQL/18/bin/psql ]]; then
    echo /Library/PostgreSQL/18/bin/psql
  else
    echo "$PSQL"
  fi
}
PSQL="$(pick_psql)"

if [[ -z "${PGPORT:-}" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]] && [[ -x /Library/PostgreSQL/18/bin/psql ]]; then
    PGPORT=5433
  else
    PGPORT=5432
  fi
fi

if [[ -n "${PGUSER:-}" ]]; then
  :
else
  PGUSER="postgres"
fi

if [[ -n "${PGPASSWORD+x}" ]]; then
  export PGPASSWORD
else
  export PGPASSWORD=root
fi

echo "Using: $PSQL"
echo "Using Postgres user: $PGUSER @ $PGHOST:$PGPORT"
echo "Creating database qmis_erp if needed..."

if ! "$PSQL" -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
  echo "ERROR: Cannot connect as user \"$PGUSER\" on port $PGPORT."
  echo "This Mac: PostgreSQL 18 (pgAdmin) is usually on 5433 with user postgres / password root."
  echo "Homebrew PG14 is on 5432 and has no postgres role — avoid it for this project."
  echo "Override example:  PGPORT=5433 PGUSER=postgres PGPASSWORD=root ./setup-local.sh"
  exit 1
fi

SERVER_VER="$("$PSQL" -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d postgres -Atc "SHOW server_version;")"
echo "Connected server version: $SERVER_VER"

exists="$("$PSQL" -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'qmis_erp'" | tr -d '[:space:]')"
if [[ "$exists" != "1" ]]; then
  "$PSQL" -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d postgres -c "CREATE DATABASE qmis_erp"
fi
echo "Database qmis_erp is ready on port $PGPORT."

# ---- 3) Python venv ----
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "ERROR: Python 3.11+ is not installed."
  exit 1
fi

if [[ ! -x ".venv/bin/python" ]]; then
  echo "Creating virtual environment .venv ..."
  "$PY" -m venv .venv
else
  echo "Virtual environment .venv already exists."
fi

# ---- 4) Install dependencies ----
echo "Installing requirements..."
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

# ---- 5) .env from example (and Mac DATABASE_URL fix) ----
if [[ ! -f ".env" ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# Keep .env pointed at the server we just used (PG18 on 5433 on this Mac).
if [[ "$(uname -s)" == "Darwin" ]]; then
  TARGET_URL="postgresql+psycopg://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/qmis_erp"
  if grep -q '^DATABASE_URL=' .env 2>/dev/null; then
    # Escape / for sed
    ESCAPED="$(printf '%s' "$TARGET_URL" | sed 's/[\/&]/\\&/g')"
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=${ESCAPED}|" .env
    echo "Updated .env DATABASE_URL → $TARGET_URL"
  fi
fi

echo
echo "Setup complete."
echo "Using PostgreSQL $SERVER_VER as $PGUSER @ $PGHOST:$PGPORT / qmis_erp"
echo "Next: stop any old API, then ./run-local.sh"
echo "Health: http://127.0.0.1:8000/api/v1/health"
echo "Swagger: http://127.0.0.1:8000/docs"
echo

