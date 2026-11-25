#!/usr/bin/env bash
# ==============================================================================
# AD-PRMS Pre-Build Health & Environment Diagnostic Script
# Verifies critical environment variables, Vite/React entry points, SQLite,
# Firebase configuration, and PostgreSQL 16 database connectivity before build.
#
# Usage:
#   ./check-health.sh                       # auto mode (adapts to CI / local env)
#   ./check-health.sh --mode frontend       # Node, Vite/React, SQLite, Firebase
#   ./check-health.sh --mode postgres       # Strict PostgreSQL 16 + Django env check
#   ./check-health.sh --mode all            # Strict full-stack check
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${CHECK_HEALTH_MODE:-auto}"
REQUIRE_FIREBASE_NET="${CHECK_FIREBASE_NETWORK:-false}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --mode=*)
      MODE="${1#*=}"
      shift
      ;;
    --check-firebase-network)
      REQUIRE_FIREBASE_NET="true"
      shift
      ;;
    -h|--help)
      sed -n '2,12p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "[FAIL] Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

case "$MODE" in
  auto|frontend|postgres|all) ;;
  *)
    echo "[FAIL] Invalid --mode '$MODE'. Expected: auto | frontend | postgres | all" >&2
    exit 2
    ;;
esac

FAILURES=0
WARNINGS=0

pass() {
  echo "[PASS] $1"
}

warn() {
  echo "[WARN] $1"
  WARNINGS=$((WARNINGS + 1))
}

fail() {
  echo "[FAIL] $1" >&2
  FAILURES=$((FAILURES + 1))
}

# Report whether an environment variable is set without printing secret values.
report_env() {
  local name="$1"
  local required="${2:-false}"
  local val="${!name:-}"

  if [[ -n "$val" ]]; then
    if [[ "$val" == CHANGE_ME* || "$val" == MY_* ]]; then
      if [[ "$required" == "true" ]]; then
        fail "Env $name is set to an unconfigured placeholder (${val:0:12}...)"
      else
        warn "Env $name is set to a placeholder value"
      fi
    else
      pass "Env $name is set (length ${#val})"
    fi
  else
    if [[ "$required" == "true" ]]; then
      fail "Required env $name is missing or empty"
    else
      echo "[INFO] Optional env $name is unset"
    fi
  fi
}

check_frontend_and_node() {
  echo ""
  echo "--- 1. Runtime, Build Entry Point & Dependencies ---"
  if command -v node >/dev/null 2>&1; then
    local node_ver node_major
    node_ver="$(node -v)"
    node_major="${node_ver#v}"
    node_major="${node_major%%.*}"
    if [[ "$node_major" -ge 20 ]]; then
      pass "Node.js $node_ver (>= 20 required)"
    else
      fail "Node.js $node_ver is too old (>= 20 required)"
    fi
  else
    fail "Node.js binary not found in PATH"
  fi

  if command -v npm >/dev/null 2>&1; then
    pass "npm $(npm -v) available"
  else
    fail "npm binary not found in PATH"
  fi

  for f in package.json tsconfig.json vite.config.ts index.html src/main.tsx src/App.tsx; do
    if [[ -f "$f" ]]; then
      pass "Found required file: $f"
    else
      fail "Missing required file: $f"
    fi
  done

  if [[ -f "index.html" ]]; then
    local entry_src
    entry_src="$(grep -oE '<script[^>]+src="[^"]+"' index.html | head -n 1 | sed -E 's/.*src="([^"]+)".*/\1/' || true)"
    if [[ -n "$entry_src" ]]; then
      local local_entry="${entry_src#/}"
      if [[ -f "$local_entry" ]]; then
        pass "index.html entry point resolves to $local_entry"
      else
        fail "index.html entry point '$entry_src' does not exist at '$local_entry'"
      fi
    else
      fail "No module <script src=...> entry point found in index.html"
    fi
  fi

  if [[ -d "node_modules" ]]; then
    pass "node_modules directory present"
  else
    fail "node_modules directory missing (run npm ci / npm install)"
  fi

  echo ""
  echo "--- 2. Frontend & Office Training Environment Variables ---"
  report_env "NODE_ENV" "false"
  report_env "PORT" "false"
  report_env "HOST" "false"
  report_env "DISABLE_HMR" "false"
  report_env "OFFICE_DB_PATH" "false"
  report_env "OFFICE_SESSION_SECRET" "false"
  report_env "VITE_APP_MODE" "false"
  report_env "VITE_API_BASE_URL" "false"

  echo ""
  echo "--- 3. Office SQLite (node:sqlite) Verification ---"
  if command -v node >/dev/null 2>&1; then
    local sqlite_target="${OFFICE_DB_PATH:-:memory:}"
    if node --input-type=module -e "
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.argv[1]);
      const row = db.prepare('SELECT sqlite_version() AS ver').get();
      if (!row || !row.ver) process.exit(1);
      console.log(row.ver);
      db.close();
    " "$sqlite_target" >/tmp/check_health_sqlite.out 2>/tmp/check_health_sqlite.err; then
      pass "SQLite connection succeeded (version $(cat /tmp/check_health_sqlite.out), target=$sqlite_target)"
    else
      fail "SQLite check failed: $(tr '\n' ' ' </tmp/check_health_sqlite.err)"
    fi
    rm -f /tmp/check_health_sqlite.out /tmp/check_health_sqlite.err
  fi

  echo ""
  echo "--- 4. Firebase / Firestore Configuration Check ---"
  if [[ -f "firebase-applet-config.json" ]]; then
    if node -e '
      const fs = require("fs");
      const cfg = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
      const required = ["projectId", "appId", "apiKey", "authDomain", "firestoreDatabaseId"];
      const missing = required.filter((k) => !cfg[k] || String(cfg[k]).trim() === "" || String(cfg[k]).includes("remixed-project-id"));
      if (missing.length > 0) {
        console.error("Missing/placeholder keys: " + missing.join(", "));
        process.exit(1);
      }
      console.log(cfg.projectId + " / " + cfg.firestoreDatabaseId);
    ' >/tmp/check_health_fb.out 2>/tmp/check_health_fb.err; then
      pass "firebase-applet-config.json valid ($(cat /tmp/check_health_fb.out))"
    else
      fail "firebase-applet-config.json invalid: $(cat /tmp/check_health_fb.err)"
    fi
    rm -f /tmp/check_health_fb.out /tmp/check_health_fb.err
  else
    warn "firebase-applet-config.json not found"
  fi

  for fb_file in firestore.rules firebase-blueprint.json; do
    if [[ -f "$fb_file" ]]; then
      pass "Found Firebase artifact: $fb_file"
    else
      warn "Missing Firebase artifact: $fb_file"
    fi
  done

  if [[ "$REQUIRE_FIREBASE_NET" == "true" && -f "firebase-applet-config.json" ]] && command -v curl >/dev/null 2>&1; then
    local fb_url http_code
    fb_url="$(node -e '
      const c = require("./firebase-applet-config.json");
      console.log(`https://firestore.googleapis.com/v1/projects/${c.projectId}/databases/${c.firestoreDatabaseId}/documents/test/connection`);
    ')"
    http_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$fb_url" || echo "000")"
    if [[ "$http_code" == "200" || "$http_code" == "401" || "$http_code" == "403" ]]; then
      pass "Firestore REST endpoint reachable (HTTP $http_code)"
    else
      warn "Firestore REST endpoint probe returned HTTP $http_code"
    fi
  fi
}

check_postgres_and_django() {
  echo ""
  echo "--- 5. Backend & PostgreSQL 16 Environment Variables ---"
  local pg_strict="${1:-false}"
  local db_url="${DATABASE_URL:-}"

  if [[ -z "$db_url" ]]; then
    if [[ "$pg_strict" == "true" ]]; then
      fail "DATABASE_URL is required for PostgreSQL mode"
      return
    else
      warn "DATABASE_URL is unset; skipping PostgreSQL connectivity check in auto mode"
      return
    fi
  fi

  report_env "DATABASE_URL" "true"
  report_env "DJANGO_SECRET_KEY" "$pg_strict"
  report_env "DJANGO_ALLOWED_HOSTS" "false"
  report_env "DJANGO_SETTINGS_MODULE" "false"
  report_env "DJANGO_USE_PREMIGRATED_TEST_DB" "false"
  report_env "REDIS_URL" "false"

  echo ""
  echo "--- 6. PostgreSQL Database Connectivity & Role Check ---"
  if ! command -v python3 >/dev/null 2>&1; then
    fail "python3 is required to parse DATABASE_URL and verify Django/PostgreSQL"
    return
  fi

  local parsed_info
  if ! parsed_info="$(python3 -c '
import os, sys
from urllib.parse import urlparse
u = urlparse(os.environ["DATABASE_URL"])
if u.scheme not in ("postgres", "postgresql", "postgresql+psycopg"):
    print(f"Unsupported DATABASE_URL scheme: {u.scheme}", file=sys.stderr)
    sys.exit(1)
host = u.hostname or "127.0.0.1"
port = u.port or 5432
dbname = (u.path or "/").lstrip("/") or "postgres"
user = u.username or ""
print(f"{host}|{port}|{dbname}|{user}")
')"; then
    fail "Failed to parse DATABASE_URL"
    return
  fi

  local pg_host pg_port pg_db pg_user
  IFS='|' read -r pg_host pg_port pg_db pg_user <<< "$parsed_info"
  echo "[INFO] Target PostgreSQL: host=$pg_host port=$pg_port db=$pg_db user=${pg_user:-<default>}"

  if command -v pg_isready >/dev/null 2>&1; then
    local pg_isready_args=(-h "$pg_host" -p "$pg_port" -d "$pg_db")
    if [[ -n "$pg_user" ]]; then
      pg_isready_args+=(-U "$pg_user")
    fi
    if pg_isready "${pg_isready_args[@]}" >/dev/null 2>&1; then
      pass "pg_isready succeeded for $pg_host:$pg_port/$pg_db"
    else
      fail "pg_isready failed for $pg_host:$pg_port/$pg_db"
    fi
  fi

  if python3 -c '
import os, socket, sys
from urllib.parse import urlparse

u = urlparse(os.environ["DATABASE_URL"])
host = u.hostname or "127.0.0.1"
port = u.port or 5432

try:
    with socket.create_connection((host, port), timeout=5):
        pass
except OSError as exc:
    print(f"TCP connection to {host}:{port} failed: {exc}", file=sys.stderr)
    sys.exit(2)

try:
    import psycopg
except ImportError:
    print("NO_PSYCOPG")
    sys.exit(0)

with psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=5) as conn:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT current_database(), current_user, version(), r.rolsuper, r.rolbypassrls
            FROM pg_roles r
            WHERE r.rolname = current_user
        """)
        row = cur.fetchone()
        print(f"db={row[0]} user={row[1]} rolsuper={row[3]} rolbypassrls={row[4]}")
' >/tmp/check_health_pg.out 2>/tmp/check_health_pg.err; then
    local pg_out
    pg_out="$(cat /tmp/check_health_pg.out)"
    if [[ "$pg_out" == "NO_PSYCOPG" ]]; then
      if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -Atqc "SELECT current_database() || ' as ' || current_user;" >/tmp/check_health_psql.out 2>/tmp/check_health_psql.err; then
          pass "psql connected cleanly ($(cat /tmp/check_health_psql.out))"
        else
          fail "psql query failed: $(tr '\n' ' ' </tmp/check_health_psql.err)"
        fi
        rm -f /tmp/check_health_psql.out /tmp/check_health_psql.err
      else
        warn "TCP to $pg_host:$pg_port open, but neither psycopg nor psql is installed to verify SQL auth"
      fi
    else
      pass "PostgreSQL query succeeded ($pg_out)"
    fi
  else
    fail "PostgreSQL connectivity check failed: $(tr '\n' ' ' </tmp/check_health_pg.err)"
  fi
  rm -f /tmp/check_health_pg.out /tmp/check_health_pg.err
}

echo "=================================================================="
echo "AD-PRMS Pre-Build Health & Environment Check (mode=$MODE)"
echo "=================================================================="

case "$MODE" in
  frontend)
    check_frontend_and_node
    ;;
  postgres)
    check_postgres_and_django "true"
    ;;
  all)
    check_frontend_and_node
    check_postgres_and_django "true"
    ;;
  auto)
    check_frontend_and_node
    if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL:-}" == postgres* ]]; then
      check_postgres_and_django "true"
    else
      check_postgres_and_django "false"
    fi
    ;;
esac

echo ""
echo "=================================================================="
echo "Health Summary: failures=$FAILURES warnings=$WARNINGS"
echo "=================================================================="

if [[ "$FAILURES" -gt 0 ]]; then
  exit 1
fi
exit 0
