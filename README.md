# AD-PRMS — Abdulwehab Dekebo Property & Rental Management System (Training Prototype)

> **TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION**  
> Interactive UI/UX & workflow reference prototype with bilingual English/Amharic (`አማርኛ`) support, Ethiopian (`ዓ.ም`) / Gregorian / Dual calendar rendering, strict single-owner context isolation (`OWN-ALPHA` / `OWN-BETA`), Actor-ID Maker-Checker Segregation of Duties, immutable audit simulation, and Compliance Readiness gates.  
> **Architecture Boundary**: See [`docs/ADR-002_TRAINING_VS_PRODUCTION_RUNTIME_BOUNDARY.md`](docs/ADR-002_TRAINING_VS_PRODUCTION_RUNTIME_BOUNDARY.md) — React/Vite + Express/SQLite is strictly isolated for training/demos (binds to `127.0.0.1` loopback by default with `HttpOnly` session auth unless `OFFICE_ENABLE_LAN=true`), while **Django 5.x + PostgreSQL 16 + Django Templates + htmx + Alpine.js** is the authoritative production baseline.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`. (For opt-in classroom LAN mode, pass `--host 0.0.0.0` or set `OFFICE_ENABLE_LAN=true`; all state/ledger/upload/WS endpoints require a verified training session cookie.)

## Quality, Unit, Integration & E2E Testing

```bash
# TypeScript static type-check
npm run lint

# Vitest unit & React Testing Library integration tests
npm test

# Production Vite build
npm run build

# Playwright Chromium E2E suite (runs against built Office Express + SQLite server on port 4173)
npx playwright install chromium   # one-time local browser download if not cached
npm run test:e2e

# Run the complete verification pipeline (runs sequentially to avoid CPU contention)
npm run test:all
```

## Production Django + PostgreSQL 16 Verification (WP-2, Backups & CI)

```bash
# 1. Initialize restricted adprms_app role (NOSUPERUSER NOBYPASSRLS)
psql "$ADMIN_DATABASE_URL" -f backend/postgres/init_wp2_roles.sql

# 2. Apply Django migrations (attaches RLS policies, audit triggers & Maker-Checker trigger)
cd backend && python3 manage.py migrate

# 3. Execute live PostgreSQL WP-2 suite as adprms_app
DATABASE_URL="$APP_DATABASE_URL" python3 backend/scripts/verify_wp2_postgres.py

# 4. Execute Django backend pytest suite against PostgreSQL 16
cd backend && pytest --junitxml=../test-results/django-pytest.xml

# 5. Run encrypted pg_dump + document vault backup & full reconciled restore drill
DATABASE_URL="$ADMIN_DATABASE_URL" BACKUP_ENCRYPTION_PASSPHRASE="..." VERIFY_RESTORE=true ./backend/scripts/backup_and_restore_drill.sh
```

## CI/CD Workflows (GitHub Actions)

- `.github/workflows/ci.yml`: Runs on every push (`main`, `master`, `develop`) and pull request:
  1. `quality-and-unit`: `npm ci` → `npm run lint` → `python3 -m compileall -q backend` → `npm test` → `npm run build:frontend && npm run build`
  2. `backend-postgres-wp2`: Spins up **PostgreSQL 16**, initializes `adprms_app`, validates Django `check` + `makemigrations --check` + `migrate` + rollback check + `verify_wp2_postgres.py` + `pytest`, and publishes durable DB/pytest artifacts
  3. `e2e-playwright`: Runs Playwright Chromium E2E tests against the full-stack Office server (`server.ts`) serving `dist/` with isolated SQLite state and LAN/offline separation checks
- `.github/workflows/deploy-vercel.yml`: Validates `npm run build:frontend` (`dist/client`) and optionally deploys to Vercel only when Vercel repository secrets are configured.

## Deploying Frontend to Cloudflare Pages (Stage 1 Target)

1. In **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**, select `Final-AD-PRMS-Training-Simulation-Architecture-Reference` (do **not** create a Cloudflare Worker or run `npx wrangler deploy`).
2. Configure:
   - **Production branch**: `main`
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build:frontend`
   - **Build output directory**: `dist/client`
3. Add **only** public frontend variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` as `sb_publishable_...`, and `VITE_APP_MODE=training`). Express (`dist/server.js`), SQLite, and MCP (`dist/mcp-server.js`) must never be deployed to Cloudflare Pages.

## Deploying to Vercel (Optional Legacy Parity)

Vercel auto-detects `vercel.json` (`vite` framework, `npm ci`, `npm run build:frontend`, output directory `dist/client`, SPA rewrites, and security headers). Automated GitHub Actions deployment in `deploy-vercel.yml` activates only if `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` repository secrets are added.
