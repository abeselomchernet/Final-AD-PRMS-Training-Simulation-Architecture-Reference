# AD-PRMS Backlog Status Updates & Closure Gates (Issues #1 – #14)

Generated after completing Phases 1–4 remediations across the React/Vite training simulator, Express/SQLite server, and authoritative Django 5.x / PostgreSQL 16 backend.

> **Verification Separation Rule**: Local execution covers TypeScript, Python syntax (`compileall`), Vitest unit/HTTP security tests, Vite build, and Playwright Chromium E2E against Express/`node:sqlite`. Live PostgreSQL 16 `pg_dump`/migrations/`verify_wp2_postgres.py` (as `NOSUPERUSER NOBYPASSRLS` `adprms_app`) and Django `pytest` execute in the CI workflow (`backend-postgres-wp2` in `.github/workflows/ci.yml`).

---

## Parent Backlog: Issue #1 — Prototype-to-Production Gap Closure
**Suggested Status**: `In Progress (Code Complete — Pending First Green CI Run on backend-postgres-wp2 & Owner Sign-Offs)`
- **Completed**:
  - Formal runtime boundary ADR (`ADR-002`) isolating React/Vite/Express/SQLite to training-only vs Django/PG16/htmx for production (`#3`).
  - Hardened Express auth/session/bind-host (`#9`) & fail-closed gateway webhooks (`#10`).
  - Complete Django migrations (`0001`–`0003`), strict fail-closed RLS/tenant/RBAC scoping (`#4`, `#5`, `#6`, `#8`), server-bound Maker-Checker execution (`#7`), independent `DepositMovement` subledger (`#11`), versioned `TaxRulePack` engine (`#12`), full DB + document backup/restore reconciliation (`#13`), and PG 16 CI job (`#14`).
- **Close Criteria**: Keep `#1` open until `#2`–`#14` are verified green on `main` CI (`quality-and-unit`, `backend-postgres-wp2`, `e2e-playwright`) and owner/legal/tax sign-offs are recorded.

---

## Issue #2 — CI Lockfile & Pipeline Baseline
**Suggested Status**: `Ready to Close (Verified Green)`
- **Evidence**: `package-lock.json` committed cleanly; `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test`, `npm run build`, and Playwright E2E with green workflow runs.

---

## Issue #3 — Authoritative Production vs Training Runtime Boundary
**Suggested Status**: `Ready for Review / Close After PG16 CI Pass`
- **Changes**:
  - Published `/docs/ADR-002_TRAINING_VS_PRODUCTION_RUNTIME_BOUNDARY.md` codifying Option A: React 19/Vite + Express/`node:sqlite` is strictly Training/Simulator (`X-ADPRMS-Mode: TRAINING-SYNTHETIC-ONLY`), while Django 5.x + PostgreSQL 16 + Django Templates/htmx/Alpine.js (`/prod/`) is authoritative production.
  - Added `/backend/apps/portfolio/ui_views.py`, `ui_urls.py`, and `/backend/templates/adprms_prod/*` serving the staff-only production `/prod/` console.
- **Close Gate**: Confirm `backend-postgres-wp2` CI passes pytest coverage on `/prod/` and deployment templates exclude Vite/Express.

---

## Issue #4 — Complete Django Migrations & PostgreSQL 16 Schema/Trigger Graph
**Suggested Status**: `Ready for Review / Close After PG16 CI Pass`
- **Changes**:
  - Created `0001_initial.py` migrations for `accounts`, `portfolio`, `billing`, `documents`, `gateways`, `maintenance`, `notifications`, plus coherent `governance` (`0001_initial.py` -> `0002_audit_immutability.py` -> `0003_wp2_rls_and_triggers.py`) and `ledger/0003_deposit_subledger_and_tax_packs.py`.
  - Added explicit deterministic index names matching `models.py` so `makemigrations --check --dry-run` is clean.
  - Wrapped `init_wp2_roles.sql` `REVOKE ... ON governance_auditevent` in `to_regclass(...)` so role bootstrap works cleanly before or after migrations.
- **Close Gate**: `backend-postgres-wp2` passes `manage.py check --fail-level WARNING`, `makemigrations --check --dry-run`, forward + rollback `migrate`, and `verify_wp2_postgres.py` as `adprms_app`.

---

## Issue #5 — Fail-Closed Multi-Owner / RLS & Cross-Owner DB Invariants
**Suggested Status**: `Ready for Review / Close After PG16 CI Pass`
- **Changes**:
  - Removed `'OWN-ALPHA'` fallback in `get_active_owner_code_for_request()`; `bind_postgres_rls_owner()` now raises `RuntimeError` if called outside `transaction.atomic()` on PostgreSQL.
  - Added `AtomicRlsViewMixin` to all `APIView` endpoints (`gateways`, `documents`, `governance`, `ledger`).
  - Added cross-owner `clean()` and PostgreSQL trigger checks (`portfolio/migrations/0002_cross_owner_triggers.py`) on `Building`, `Unit`, and `Lease`.
  - Updated `verify_wp2_postgres.py` to test cross-owner SELECT/UPDATE/DELETE/INSERT isolation + `DepositMovement` RLS + `SET LOCAL` context non-leakage as `adprms_app`.
- **Close Gate**: Green PG 16 `verify_wp2_postgres.py` and pytest execution in CI.

---

## Issue #6 — Single Registered Title-Holder (5 Buildings) vs Pending Trading Identity
**Suggested Status**: `Ready for Review / Close After Documentary Confirmation Check`
- **Changes**:
  - Added `PartyIdentity` model (`Registered Title-Holder` vs `Pending Trading Identity`, `inter_entity_posting_enabled=False`) and `seed_single_title_holder_portfolio()` seeding **Abdulwehab Dekebo** with 5 buildings (`B1`–`B5`, `total_units_expected=20`, `unit_count_status='Provisional'`) and **Abdulwehab Dekebo Trading** as `Pending Documentary Confirmation`.
  - Added `assert_inter_entity_posting_permitted()` blocking inter-entity postings until legal/tax confirmation.
  - Clarified synthetic `OWN-ALPHA`/`OWN-BETA` simulator fixtures in `src/pages/OwnersEntitiesPage.tsx`.
- **Close Gate**: Pytest `test_single_title_holder_five_buildings_and_inter_entity_block` passes; physical deed counts verified by owner.

---

## Issue #7 — Server-Enforced Maker-Checker SoD & Payload Integrity
**Suggested Status**: `Ready for Review / Close After PG16 CI Pass`
- **Changes**:
  - Added `payload_json`, `payload_hash` (SHA-256), and `approved_checker_actor_id` to `ApprovalRequest`.
  - Locked `ApprovalRequestSerializer`, derived `maker_actor_id` / `checker_actor_id` strictly from authenticated `request.user.actor_id`, wrapped `decide()` in `@transaction.atomic` with `select_for_update()`.
  - Updated `PostJournalApiView` (manual journals), `ReverseJournalApiView`, and `PeriodCloseApiView` to require an `Approved` `ApprovalRequest` matching `payload_hash` and rejected client-forged `maker_actor_id`/`checker_actor_id`.
  - Strengthened PostgreSQL `prevent_self_approval()` trigger to enforce `approved_checker_actor_id <> maker_actor_id`.
- **Close Gate**: `test_api_security_and_backup.py` + PG 16 `trg_prevent_self_approval` pass in CI.

---

## Issue #8 — Explicit Serializers & Tenant/Auditor/Staff RBAC Hardening
**Suggested Status**: `Ready for Review / Close After PG16 CI Pass`
- **Changes**:
  - Replaced `fields = '__all__'` across `portfolio`, `billing`, `gateways`, `maintenance`, `notifications`, `governance`, `ledger` serializers with explicit allowlists and `read_only_fields`.
  - Restricted staff endpoints (`Unit`, `TenantProfile`, `Lease`, `GatewayTransaction`) with `IsStaffUser`; added read-only tenant self-service routes (`my/units/`, `my/profile/`, `my/leases/`); locked `MaintenanceTicket` updates to staff and pinned tenant `create` defaults; restricted tenant uploads in `documents` to `CBE_SLIP`/`TENANT_KYC` bound to own `tenant_id_ref`.
- **Close Gate**: Backend RBAC pytest suite passes in CI.

---

## Issue #9 — Training Server Loopback Default, Cookie Auth & Spoofed Header Removal
**Suggested Status**: `Ready for Verification / Close After Local & CI Tests`
- **Changes**:
  - Created `/server/security.ts`: Express training server now defaults to `127.0.0.1` unless `--host`, `HOST`, or `OFFICE_ENABLE_LAN=true` is explicitly set.
  - Added HMAC-SHA256 `HttpOnly` cookie session (`/api/office/auth/{session,login,logout}`) enforced across `/api/office/*`, `/api/sms/*`, `/api/gateways/*`, and `/ws` upgrades (`401` when unauthenticated).
  - Removed header-based role spoofing (`X-Office-Role`); `/api/office/reset` now requires a verified `Training Coordinator` session cookie.
- **Evidence**: Verified locally via Vitest (`tests/unit/officeServerSecurity.test.ts`) and Playwright Chromium E2E (`tests/e2e/ad-prms.spec.ts`).

---

## Issue #10 — Fail-Closed Gateway Webhooks (Express Sandbox & Django Production)
**Suggested Status**: `Ready for Review / Close After PG16 CI Pass`
- **Changes**:
  - Added `ENABLE_LIVE_GATEWAYS = False` default in `backend/config/settings/base.py`.
  - Django ArifPay & Telebirr webhooks fail closed (`503` when disabled or secrets missing), validate HMAC / RSA-SHA256 signatures, enforce 300s timestamp window, check replay nonces (`409`), verify exact `amount_etb`, `currency=ETB`, and `TELEBIRR_MERCHANT_CODE`.
  - Express sandbox webhooks reject missing secrets (`503`), invalid HMAC/keys (`403`), and replays (`409`).
- **Evidence**: Express webhooks verified in Vitest; Django webhooks covered in `test_api_security_and_backup.py`.

---

## Issue #11 — Independent `DepositMovement` Subledger & Configurable Cash Cap
**Suggested Status**: `Ready for Review / Close After PG16 CI Pass`
- **Changes**:
  - Added append-only `DepositMovement` model (+ PG RLS & mutation trigger in `ledger/0003`) tracking `Receipt`, `Refund`, `Deduction`, `LeaseTransfer`, `OpeningBalance` independently of `JournalLine`.
  - Rewrote `evaluate_three_way_deposit_check()` to reconcile Active Lease net deposits ↔ `DepositMovement` subledger ↔ GL `2120` (plus unlinked movement check).
  - Changed daily ETB 50,000 cash cap to track cumulative daily cash on account `1010` per `(owner, entry_date)`, gated behind `Ledger.enforce_daily_cash_cap` (default `False`).
- **Close Gate**: `test_ledger_and_tax.py` + PG 16 `verify_wp2_postgres.py` (`DepositMovement`) pass in CI.

---

## Issue #12 — Versioned `TaxRulePack`, `Undetermined` Legal Form Default & Non-Fiscal Labeling
**Suggested Status**: `Ready for Review / Close After Adviser Sign-Off (Code Complete)`
- **Changes**:
  - Removed hardcoded statutory assumptions from `backend/apps/ledger/tax_engine.py`; all marginal bands, flat allowances, corporate rate, VAT, WHT, advance tax, and property-tax ratios load from versioned `TaxRulePack.parameters_json` with historical `as_of_date` lookup.
  - Defaulted `Ledger.entity_type` and `compute_workpaper_comparison` to `Undetermined` (never assuming `SoleProprietor` or `PLC`).
  - Live fiscal mode requires `ENABLE_LIVE_TAX_INVOICING=True`, `TaxRulePack.lifecycle_stage='Active'`, `reviewer_license_ref`, verified ERCA 4-signoffs, and confirmed legal form.
- **Close Gate**: Historical date & undetermined tests pass in CI; qualified Ethiopian adviser sign-off recorded before production tax use.

---

## Issue #13 — Full Recovery Set (DB + Documents + Key-ID Manifest + Business Reconciliation)
**Suggested Status**: `Ready for Review / Close After PG16 CI Restore Drill & Owner Sign-Off`
- **Changes**:
  - Upgraded `backend/scripts/backup_and_restore_drill.sh` to archive & encrypt both PostgreSQL dump and document/object storage alongside a secret-free JSON manifest (`backup_id`, `timestamp`, `app_version`, `encryption_key_id`, `database_dump_sha256`, `documents_archive_sha256`).
  - Added `backend/scripts/verify_restore_reconciliation.py` verifying file hashes, Trial Balance balance, 3-way deposit tie-out, Billing/Gateway/Document counts, and SHA-256 `AuditEvent` chain integrity.
  - Updated `BackupSnapshotRecord` model and `BackupRecoveryPage.tsx`.
- **Close Gate**: CI PG 16 restore & reconciliation drill passes; owner signs off RPO/RTO targets and witness drill log.

---

## Issue #14 — Layered CI Pipeline (PG 16, `adprms_app`, Pytest, E2E & Offline/LAN Acceptance)
**Suggested Status**: `Ready for Review / Close After First Green Multi-Job CI Run`
- **Changes**:
  - Updated `.github/workflows/ci.yml` with `backend-postgres-wp2` (PostgreSQL 16 service, `check`, `makemigrations --check`, `migrate` + rollback check, `verify_wp2_postgres.py` as `adprms_app`, PG + SQLite `pytest` runs, backup/restore drill, durable artifacts).
  - Added Playwright E2E coverage for `401` auth barrier and Internet-unavailable vs Server-unavailable offline/LAN acceptance in `tests/e2e/ad-prms.spec.ts`.
- **Close Gate**: All 3 CI jobs (`quality-and-unit`, `backend-postgres-wp2`, `e2e-playwright`) pass cleanly on `main`.
