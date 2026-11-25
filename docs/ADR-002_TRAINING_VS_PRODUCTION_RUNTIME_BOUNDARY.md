# ADR-002: Authoritative Production Runtime vs. Isolated Training & Office Simulator Boundary

- **Date**: 2026-11-18
- **Status**: Accepted (Supersedes ambiguity noted in GitHub Issue #3)
- **Related Issues**: `#1`, `#2`, `#3`, `#4`, `#8`, `#9`, `#10`, `#14`

---

## 1. Context

During prototype-to-production security and architecture review (`#3`), two distinct runtimes existed in the same repository without a single machine-enforced boundary document:

1. **Django 5.x + PostgreSQL 16 + DRF (`backend/`)**: Built for PostgreSQL Row-Level Security (`SET LOCAL app.current_owner_id`), restricted `adprms_app` DB role (`NOSUPERUSER NOBYPASSRLS`), append-only audit triggers, database-enforced Maker-Checker triggers, double-entry ledger, and Django ORM persistence.
2. **React 19 / Vite + Express + `node:sqlite` (`src/`, `server.ts`, `server/officeStore.ts`)**: Built for bilingual (English/Amharic/Afaan Oromoo), Gregorian/Ethiopic interactive staff & tenant training, demo workflows, and offline/LAN classroom walkthroughs using synthetic `OWN-ALPHA` / `OWN-BETA` fixtures.

Running both concurrently without an explicit architectural ruling risked split-brain accounting engines, confusion over which stack handles real production tenants/funds, and exposure of training endpoints on untrusted network interfaces.

---

## 2. Decision (Option A — Strict Runtime Separation)

We formally confirm **Option A**:

1. **Authoritative Production Runtime**:
   - **Backend & Persistence**: **Django 5.x + PostgreSQL 16** (with Redis + Celery + Channels), enforced via restricted role `adprms_app` (`NOSUPERUSER NOBYPASSRLS`), atomic `SET LOCAL app.current_owner_id` RLS binding, immutable `AuditEvent` triggers, and server-authoritative Maker-Checker `ApprovalRequest` verification.
   - **Authoritative Production UI**: **Django Templates + htmx + Alpine.js** mounted under `backend/templates/` and Django views (`/prod/`), backed directly by DRF/Django transactional services with CSRF protection and zero client-supplied ledger trust.
   - **Real Portfolio Model**: Single registered Title-Holder (**Abdulwehab Dekebo**) across all five commercial/mixed-use buildings (`~20` rentable units per building with explicit `Verified` vs. `Provisional` unit-count status), keeping **Abdulwehab Dekebo Trading** as a separate pending party (`inter_entity_posting_enabled = False`) until documentary legal/tax confirmation.

2. **Isolated Training & Office Simulator Runtime**:
   - **Stack**: **React / Vite + Express + `node:sqlite` (`server.ts`)** remains strictly designated as an **offline/training/simulation harness** with permanent non-production watermarks (`TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION`) and `X-ADPRMS-Mode: TRAINING-SYNTHETIC-ONLY` HTTP headers.
   - **Network & Auth Hardening (`#9`)**:
     - Binds strictly to loopback **`127.0.0.1`** by default (`0.0.0.0` only when explicitly enabled via `--host` or `OFFICE_ENABLE_LAN=true`).
     - All `/api/office/*`, `/api/sms/dispatch`, `/api/gateways/*`, and `/ws` channels require a server-signed `HttpOnly` session cookie (`adprms_office_sid`).
     - Seed reset (`POST /api/office/reset`) and SQLite ledger mutations derive caller identity/role/owner scope exclusively from the verified session token, never from request body fields or `x-office-role` headers.
   - **Gateway & Tax Sandbox Safety (`#10`, `#12`)**:
     - Express webhook endpoints fail closed (`503`/`403`) when secrets/keys are absent, enforce replay & amount guards, and emit `sandbox:webhook:received` events rather than production settlement clearances.
     - Tax rules in the training simulator stay strictly marked `NON-FISCAL DRAFT`.

---

## 3. Consequences & Enforcement Gates

- **Zero Production Data in React/SQLite**: Real tenant PII, signed lease deeds, bank balances, or live Ethiopian tax invoices must **never** enter the Express/SQLite simulator.
- **No Production Cutover on Issue `#2` Alone**: Passing frontend CI (`npm ci`, Vitest, Vite build, Chromium E2E) closes build reproducibility (`#2`) for the simulator only; production readiness requires all Django + PostgreSQL 16 + RLS + Maker-Checker + backup reconciliation gates (`#4`–`#8`, `#10`–`#14`).
- **Dual-Track CI Verification (`#14`)**: `.github/workflows/ci.yml` executes separate jobs for the TypeScript/SQLite Training Simulator (`quality-and-unit`, `e2e-playwright`) and the Production Django/PostgreSQL 16 Engine (`backend-postgres-wp2`) so SQLite pass results can never masquerade as PostgreSQL 16 evidence.
