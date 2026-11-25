# AD-PRMS Repository Issues Report
> **Scope:** Configuration, Build Setup & Dependencies  
> **Project:** [AD-PRMS Training Simulation Architecture Reference](https://github.com/abeselomchernet/AD-PRMS-Training-Simulation-Architecture-Reference)  
> **Analysed:** 2026-11-19 | **Phase 1 of 6** (Backend, Frontend, Services, UI, Tests analyses pending)

---

## Summary

| Severity | Count | Primary Impact |
|:---|:---:|:---|
| 🔴 **Critical** | 4 | Firestore backdoor, Windows CI crash, broken Vercel API, brute-force on OTP/auth |
| 🟠 **High** | 8 | npm start failure, non-strict TypeScript, memory leak, DNS rebinding, missing linting, missing env vars, `legacy-peer-deps` |
| 🟡 **Medium** | 11 | Production package bloat, non-portable scripts, no Vitest coverage gates, no CORS middleware, exposed Firebase key, CSP missing |
| 🟢 **Low** | 5 | Missing favicon, metadata name stutter, incomplete `.gitignore`, health endpoint leakage, no sourcemaps |

---

## 🔴 Critical Issues

### C-1 · Hardcoded Personal Admin Email Backdoor in Firestore Rules
**File:** [`firestore.rules`, lines 34–35](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/firestore.rules)

```javascript
function isAdmin() {
  return isSignedIn() && (
    exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
    request.auth.token.email == 'berhaneunity@gmail.com'  // ← BACKDOOR
  );
}
```

Anyone authenticating with this email bypasses the admin registry and gains full read/delete access over user profiles, PII subcollections, and all workspaces. This is a critical security vulnerability in a system handling real financial data.

**Fix:** Remove the email condition entirely. Use only `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or verified custom claims (`request.auth.token.admin == true`).

---

### C-2 · POSIX Inline Env Variables Crash on Windows (Playwright CI)
**File:** [`playwright.config.ts`, line 31](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/playwright.config.ts)

```typescript
command: 'NODE_ENV=production PORT=4173 OFFICE_DB_PATH=/tmp/adprms-playwright.db npx tsx server.ts',
```

Inline env var prefixes (`VAR=value cmd`) are POSIX-only. On Windows (`cmd.exe`/`pwsh`) this crashes. Also `/tmp/` does not exist on Windows by default.

**Fix:**
```typescript
webServer: {
  command: 'npx tsx server.ts',
  env: {
    NODE_ENV: 'production',
    PORT: '4173',
    OFFICE_DB_PATH: path.join(os.tmpdir(), 'adprms-playwright.db'),
  },
  url: 'http://127.0.0.1:4173/api/health',
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
}
```

---

### C-3 · Vercel Catch-All Rewrite Breaks All Backend API & WebSocket Endpoints
**File:** [`vercel.json`, lines 7–12](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/vercel.json)

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

Every request to `/api/*`, `/ws`, and gateway endpoints returns `200 OK` with `index.html` instead of JSON. The Express server, SQLite database, and WebSocket server **do not run on Vercel** without serverless function configuration. All ledger operations, auth sessions, and offline syncing silently break.

**Fix:** Either route `/api/*` to serverless function handlers (`api/[...path].ts`), OR clearly document in `README.md` and `vercel.json` that Vercel is frontend-preview-only.

---

### C-4 · No Rate Limiting on Auth & OTP Endpoints (Brute-Force Attack Vector)
**File:** [`server.ts`, lines 268–289, 702–748](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/server.ts)

Endpoints `/api/office/auth/login`, `/api/office/auth/tenant/otp/request`, and `/api/office/auth/tenant/otp/verify` have zero rate limiting. A 6-digit OTP has only 1,000,000 combinations — trivially brute-forced. `/api/sms/dispatch` and `/api/office/uploads` can also be spammed for DoS.

**Fix:** Add `express-rate-limit`:
```typescript
import rateLimit from 'express-rate-limit';
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
app.use('/api/office/auth', authLimiter);
```

---

## 🟠 High Issues

### H-1 · `npm start` Fails — Cannot Run `.ts` Files with `node`
**File:** [`package.json`, line 8](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/package.json)

```json
"start": "node server.ts"
```
Node cannot execute `.ts` files without experimental flags. No build step compiles `server.ts` → `server.js`.

**Fix:** Add `"build:server": "esbuild server.ts --platform=node --bundle --outfile=dist/server.js"` and change `"start": "node dist/server.js"`.

---

### H-2 · Dual Lockfiles (`bun.lock` + `package-lock.json`)
Both `bun.lock` and `package-lock.json` exist in the repo root. This causes non-deterministic dependency installs when different team members or CI use different package managers.

**Fix:** Standardise on one package manager and delete the other lockfile.

---

### H-3 · `"strict": true` Missing in TypeScript Config
**File:** [`tsconfig.json`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/tsconfig.json)

TypeScript strict mode is off by default. For a system handling financial calculations, currency conversions, and Maker-Checker role claims, `strictNullChecks` and `noImplicitAny` must be enabled or `null`/`undefined` errors pass compilation silently.

**Fix:** Add `"strict": true` to `compilerOptions`.

---

### H-4 · Restrictive `types` Array Excludes Node & Vitest Globals
**File:** [`tsconfig.json`, line 7](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/tsconfig.json)

```json
"types": ["vite/client", "vite-plugin-pwa/client"]
```
When `types` is specified, TypeScript stops auto-discovering `@types/*`. Node.js globals (`process`, `Buffer`) in `server.ts` and test globals (`describe`, `it`, `expect`) lose type definitions.

**Fix:** Add `"node"` and `"vitest/globals"` to the `types` array.

---

### H-5 · Unbounded In-Memory Set Memory Leak (Webhook Replay Guard)
**File:** [`server.ts`, lines 35, 842–846, 906–911](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/server.ts)

```typescript
const seenWebhookReplayKeys = new Set<string>();
```
Webhook replay keys are inserted and **never pruned**. On long-running instances with regular ArifPay/Telebirr traffic this Set grows unboundedly.

**Fix:** Replace with an LRU or TTL cache that evicts entries older than ~10 minutes.

---

### H-6 · `allowedHosts: true` Enables DNS Rebinding Attack
**File:** [`server.ts`, line 977](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/server.ts)

```typescript
server: { middlewareMode: true, allowedHosts: true }
```
Disabling host validation exposes developers to DNS rebinding attacks from malicious sites executing requests against `127.0.0.1`.

**Fix:** Remove `allowedHosts: true` or restrict to `['localhost', '127.0.0.1']`.

---

### H-7 · ESLint Only Lints Firebase Rules — Zero TS/React Coverage
**File:** [`eslint.config.mjs`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/eslint.config.mjs)

```javascript
export default [
  { ignores: ['dist/**/*', 'backend/**/*', 'node_modules/**/*'] },
  firebaseRulesPlugin.configs['flat/recommended'],
];
```
No `@typescript-eslint`, no `eslint-plugin-react-hooks`. Stale closures, missing `useEffect` dependencies, and unhandled promises are never caught.

**Fix:** Integrate `typescript-eslint` and `eslint-plugin-react-hooks` flat configs. Also fix `"lint": "tsc --noEmit"` → `"lint": "tsc --noEmit && eslint ."`.

---

### H-8 · `.env.example` Missing 12+ Critical Runtime Variables
**File:** [`.env.example`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/.env.example)

Only `GEMINI_API_KEY` and `APP_URL` are documented. Missing:

| Variable | Impact if Missing |
|---|---|
| `OFFICE_SESSION_SECRET` | New ephemeral secret on each restart → all users logged out |
| `ARIFPAY_WEBHOOK_SECRET` | HMAC verification silently disabled |
| `TELEBIRR_PUBLIC_KEY_PEM` | Gateway verification fails closed |
| `OFFICE_DB_PATH` | SQLite path is undefined |
| `ADMIN_DATABASE_URL` | Backend scripts fail silently |
| `BACKUP_ENCRYPTION_PASSPHRASE` | Backup drills fail |
| `VERCEL_TOKEN/ORG_ID/PROJECT_ID` | CI deployment breaks |
| `PORT`, `HOST`, `OFFICE_ENABLE_LAN` | Server binding undefined |

**Fix:** Document all variables with defaults and security implications.

---

### H-9 · `legacy-peer-deps=true` Suppresses Dependency Conflict Detection
**File:** [`.npmrc`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/.npmrc)

Disables npm peer dependency resolution globally. Can result in duplicate package copies, runtime version mismatches, and subtle reconciliation bugs — especially dangerous in financial accounting code.

**Fix:** Remove, audit with `npm install --dry-run`, and use explicit `overrides` in `package.json` for verified conflicts.

---

## 🟡 Medium Issues

| # | File | Issue |
|---|---|---|
| M-1 | `firestore.rules` L255/294/315 | `isAdmin()` missing from subcollection `list` rules — admins can't query audit trails |
| M-2 | `firestore.rules` L292/299/313/320 | Redundant billable `get()` calls on every audit event write — 3× read cost at scale |
| M-3 | `firestore.rules` L58–100 | `hasOnly()` schema validation too strict — any new summary field breaks all writes |
| M-4 | `playwright.config.ts` L4–5 | Hardcoded Linux headless shell path — useless on Windows/macOS |
| M-5 | `playwright.config.ts` | No Mobile Safari / Mobile Chrome tests for a declared PWA |
| M-6 | `vercel.json` | Missing `Content-Security-Policy` header and immutable asset caching |
| M-7 | `server.ts` L165 | Global 15 MB JSON body limit before auth — DoS vector |
| M-8 | `server.ts` L989 | `express.static` without `maxAge` — no browser caching on assets |
| M-9 | `server.ts` L995 | No global Express error handler — unhandled errors expose stack traces |
| M-10 | `package.json` L18–44 | 7+ dev/build packages in `dependencies` (eslint, vite plugins, type defs, testing libs) |
| M-11 | `package.json` L11 | `clean` script uses `rm -rf` — fails on Windows |
| M-12 | `tsconfig.json` | No `"include"` field — TypeScript compiles all files including scripts |
| M-13 | `vitest.config.ts` | No coverage thresholds — regressions in ledger logic go undetected in CI |
| M-14 | `vitest.config.ts` L13 | Global `jsdom` for all tests — slows pure Node.js ledger/crypto tests |
| M-15 | `index.html` | No `Content-Security-Policy` meta tag — XSS risk in a financial data app |
| M-16 | `index.html` L25–30 | External Google Fonts — breaks offline PWA; Amharic glyphs fail without internet |
| M-17 | `firebase-applet-config.json` L4 | Plaintext API key committed to repo |
| M-18 | `firebase-applet-config.json` L6 | Named Firestore DB but no `firebase.json` — `firebase deploy` targets wrong DB |
| M-19 | `README.md` L14/72–83 | Wrong port documented (3000 vs 4173); misleading Vercel full-stack capability claims |

---

## 🟢 Low Issues

| # | File | Issue |
|---|---|---|
| L-1 | `index.html` L12 | No `favicon.ico` fallback — 404 console errors in all browsers |
| L-2 | `metadata.json` L2 | App name stutters "Remix Remix AD-PRMS"; `requestFramePermissions: []` missing `camera` + `notifications` |
| L-3 | `.gitignore` | Missing: `*.db`, `*.sqlite`, `*.pem`, `*.key`, `.vscode/`, `.idea/`, `Thumbs.db` |
| L-4 | `server.ts` L243–254 | `/api/health` exposes internal `bindHost` and architecture flags without auth |
| L-5 | `vite.config.ts` | `build.sourcemap` unset — production errors in minified bundles are undebuggable |

---

## Prioritised Action Plan

```
Day 1 — Immediate Security
  ✅ Remove hardcoded email from firestore.rules
  ✅ Add express-rate-limit to auth/OTP endpoints
  ✅ Fix playwright.config.ts Windows webServer command
  ✅ Remove allowedHosts: true from server.ts

Day 2 — Build, Type Safety & Runtime Stability
  ✅ Enable "strict": true in tsconfig.json
  ✅ Fix "start" script: build server.ts → server.js
  ✅ Add TTL/LRU pruning to seenWebhookReplayKeys
  ✅ Fully populate .env.example with all variables

Day 3 — Linting, CI & Deployment
  ✅ Add typescript-eslint + react-hooks to eslint.config.mjs
  ✅ Fix lint script to run eslint
  ✅ Clarify Vercel static-only boundary in vercel.json + README
  ✅ Remove bun.lock or package-lock.json (pick one)
  ✅ Remove legacy-peer-deps=true from .npmrc
```

---

> [!NOTE]
> **All 6 phases complete.** See Executive Summary at the bottom for the full prioritised fix list.

---

# Phase 6 — Tests, CI/CD & Migrations Issues

> **Scope:** 17 frontend unit tests, 4 backend pytest files, 2 CI/CD workflows, 7 Django migrations, `server/officeStore.ts`, `server/security.ts`, docs, `check-health.sh`

## Summary

| Severity | Count |
|:---|:---:|
| 🟠 High | 2 |
| 🟡 Medium | 4 |
| 🟢 Low | 2 |

---

## 🟠 High

### H-1 · Deploy Workflow Has No Gate on CI Pass — Vercel Deploys on Failing Tests
**File:** [`.github/workflows/deploy-vercel.yml`, lines 3–8](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/.github/workflows/deploy-vercel.yml)

The Vercel deploy workflow triggers on pushes and PRs to `main` and runs tests internally, but does not formally depend on `ci.yml` completing successfully. A PR with a failing test suite can still trigger a Vercel preview build. No dependency vulnerability scanning (`npm audit` / `pip-audit` / Dependabot) exists in either workflow.

**Fix:**
```yaml
# deploy-vercel.yml
needs: [ci]   # wait for ci.yml to pass first
```
Add a separate `audit` job:
```yaml
- run: npm audit --audit-level=high
- run: pip-audit -r backend/requirements.txt
```

---

### H-2 · Missing Negative & Overflow Edge Cases in Accounting Engine Tests
**File:** [`tests/unit/accountingEngine.test.ts`, lines 37–50](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/tests/unit/accountingEngine.test.ts)

Tests only cover happy-path trial balances. Missing test scenarios:
- Zero-amount journal entries
- Negative line items passed to `postLedgerEvent`
- Cent overflow beyond ETB 10,000,000,000
- Concurrent posting race conditions
- Floating-point rounding edge cases at the `toCents()` boundary

**Fix:** Add parameterised tests for boundary values:
```typescript
it.each([
  [0, 'zero amount'],
  [-100, 'negative amount'],
  [Number.MAX_SAFE_INTEGER, 'overflow'],
])('rejects %i (%s)', (amount) => {
  expect(() => postLedgerEvent({ amount })).toThrow();
});
```

---

## 🟡 Medium

### M-1 · Hardcoded DB Passwords in CI Workflow Logs
**File:** [`.github/workflows/ci.yml`, line 101](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/.github/workflows/ci.yml)

Connection strings (`postgres://adprms_admin:wp2_admin_password@...`) are passed as literal environment variables. Any debug `echo` or failed step output leaks them into GitHub Actions build logs.

**Fix:** Store all credentials as GitHub Actions secrets and add log masking:
```yaml
- run: echo "::add-mask::${{ secrets.DB_PASSWORD }}"
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

### M-2 · Non-Idempotent RLS & Trigger SQL in Ledger Migration
**File:** [`backend/apps/ledger/migrations/0002_pg_ledger_triggers_and_rls.py`, lines 50–80](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/ledger/migrations/0002_pg_ledger_triggers_and_rls.py)

RLS policy DDL does not fully scope table names with schema qualifiers. On partial schema initialization or re-run, policies can attach to `public` namespace tables unexpectedly.

**Fix:** Qualify all table names (`public.ledger_journalentry`) and wrap DDL in idempotent guards:
```sql
SET search_path = public;
DROP POLICY IF EXISTS rls_owner_isolation ON public.ledger_journalentry;
CREATE POLICY rls_owner_isolation ON public.ledger_journalentry ...;
```

---

### M-3 · Missing Reverse Functions on Custom SQL Migrations
**Files:** Multiple migrations across `governance/`, `ledger/`, `portfolio/`

`RunPython` and raw SQL migrations that install triggers and RLS policies have no `reverse_code`. Running `manage.py migrate app <previous>` in production leaves orphaned triggers and policies.

**Fix:** Add explicit reverse handlers to every custom migration:
```python
migrations.RunPython(apply_rls_triggers, reverse_code=remove_rls_triggers)
```

---

### M-4 · Over-Mocking in Payment Gateway Tests — Real Failure Cases Untested
**Files:** [`tests/unit/telebirrGatewayService.test.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/tests/unit/telebirrGatewayService.test.ts), [`tests/unit/arifpayGatewayService.test.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/tests/unit/arifpayGatewayService.test.ts)

Gateway tests mock all fetch calls and never test:
- Network timeout / `AbortController` cancellation
- Malformed JSON from upstream providers
- Invalid HMAC webhook signature rejection
- Idempotency key collision handling

**Fix:** Add negative-path tests with `msw` (Mock Service Worker) handlers that simulate upstream failures, timeouts, and tampered signatures.

---

## 🟢 Low

### L-1 · No Production Incident Runbook in `docs/`
**File:** [`docs/`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/docs/)

ADRs and status updates are well-documented, but no incident runbook exists for: DB lockups, RLS bypass attempts, failed payment gateway reconciliation batches, or corrupted ledger states.

**Fix:** Add `docs/RUNBOOK.md` covering: on-call escalation, DB recovery steps, gateway reconciliation procedures, and RLS audit verification commands.

---

### L-2.5 · `npx vitest` Fetches Non-Existent `vitest@5.1.0` — Tests Cannot Run Outside `npm test`
**File:** [`package.json`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/package.json)

Running `npx vitest` directly (or in a CI step that bypasses `npm test`) causes npx to attempt fetching `vitest@5.1.0` from the registry — a version that does not exist — and fails. Tests only work via `npm test` using the local `node_modules/.bin/vitest` binary. Any CI step or developer shortcut invoking `npx vitest` directly will silently fail or error.

**Fix:** Pin vitest to an existing version in `package.json` and document that tests must be run via `npm test` / `npx --no vitest` (which skips auto-fetch and uses the local binary).

---

### L-2 · `check-health.sh` Missing Error Handling & Hardcoded Ports
**File:** [`check-health.sh`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/check-health.sh)

Script lacks `set -euo pipefail` — a failed health check curl silently passes. Ports/hostnames are hardcoded instead of read from environment.

**Fix:**
```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${APP_HOST:-127.0.0.1}"
PORT="${APP_PORT:-3000}"
curl -sf "http://${HOST}:${PORT}/api/health" || exit 1
```

---

# ═══════════════════════════════════════
# MASTER EXECUTIVE SUMMARY — All 6 Phases
# ═══════════════════════════════════════

> **Project:** AD-PRMS Training Simulation Architecture Reference  
> **Repo:** https://github.com/abeselomchernet/AD-PRMS-Training-Simulation-Architecture-Reference  
> **Analysis Date:** 2026-11-19  
> **Files Reviewed:** ~160 files across frontend, backend, infra, tests, docs

## Total Issue Count

| Severity | Count | Phase Breakdown |
|:---|:---:|:---|
| 🔴 **Critical** | **15** | Ph1: 4 · Ph2: 1 · Ph3: 5 · Ph4: 3 · Ph5: 2 · Ph6: 0 |
| 🟠 **High** | **29** | Ph1: 9 · Ph2: 4 · Ph3: 8 · Ph4: 4 · Ph5: 4 · Ph6: 2 |
| 🟡 **Medium** | **36** | Ph1: 11 · Ph2: 5 · Ph3: 7 · Ph4: 3 · Ph5: 3 · Ph6: 4 |
| 🟢 **Low** | **11** | Ph1: 5 · Ph2: 1 · Ph3: 0 · Ph4: 2 · Ph5: 1 · Ph6: 2 |
| **Total** | **91** | |

---

## 🔴 Top 15 Critical Issues (Fix Immediately)

| # | Issue | File(s) |
|---|---|---|
| 1 | Hardcoded admin email backdoor in Firestore rules | `firestore.rules` |
| 2 | No rate limiting on OTP/auth — brute-force trivial | `server.ts` |
| 3 | Vercel catch-all rewrite silently breaks all API calls | `vercel.json` |
| 4 | Playwright CI crashes on Windows (POSIX env vars) | `playwright.config.ts` |
| 5 | `float` for all ETB amounts — silent rounding across type system | `src/types/prms.ts` |
| 6 | Floating-point ledger drift over thousands of journal entries | `accountingEngine.ts` |
| 7 | JWT stored in `localStorage` — stolen by any XSS | `productionApiClient.ts` |
| 8 | Cross-tenant Firestore queries without owner scoping | `firebaseWorkspaceService.ts` |
| 9 | Payment nonce cache in memory — session replay across tabs | `arifpayGatewayService.ts` |
| 10 | XSS in export filename from unsanitized user input | `exportDownload.ts` |
| 11 | `dangerouslySetInnerHTML` on lease contracts without DOMPurify | `OromifaContractBuilder.tsx` |
| 12 | No page-level auth/RBAC guards on Finance, Tax, Audit pages | Multiple pages |
| 13 | Raw cents/unformatted floats shown in ledger UI | `FinanceLedgerTabs.tsx` |
| 14 | Client-side-only RBAC — backend enforces nothing | `rbac.ts` |
| 15 | `DEBUG=True` + `ALLOWED_HOSTS=['*']` could reach production | `settings/dev.py` |

---

## Prioritised Fix Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAY 1 — Stop the bleeding (Security)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Remove berhaneunity@gmail.com from firestore.rules
✅ Add express-rate-limit to /auth and /otp endpoints
✅ Move JWTs from localStorage → HttpOnly cookies
✅ Add owner scoping to all Firestore queries
✅ Fix Vercel rewrites: exclude /api/* from catch-all
✅ Sanitize dangerouslySetInnerHTML with DOMPurify
✅ Add RequireAuth/RequireRole guards to Finance, Tax, Audit pages
✅ Remove allowedHosts: true from server.ts Vite config

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAY 2 — Financial Data Integrity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Replace all ETB `number` → `Cents` branded type in prms.ts
✅ Replace float gateway args with Decimal in Django & TS
✅ Add BigInt summation to accounting engine subledger totals
✅ Add AbortController timeouts to all gateway fetch calls
✅ Enforce idempotency server-side (unique DB constraint on nonce)
✅ Sign QR payloads with HMAC-SHA256 + expiry timestamp
✅ Wrap Firestore multi-doc writes in runTransaction()
✅ Format all ETB values through formatCurrency() before render

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAY 3 — Build, Config & Type Safety
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Enable "strict": true in tsconfig.json
✅ Fix "start" script: compile server.ts → server.js
✅ Remove bun.lock OR package-lock.json (pick one)
✅ Remove legacy-peer-deps=true from .npmrc
✅ Add typescript-eslint + react-hooks to eslint.config.mjs
✅ Add "node" and "vitest/globals" to tsconfig types array
✅ Populate .env.example with all 12+ missing variables
✅ Gate training/simulation data behind import.meta.env.DEV

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAY 4 — Backend Hardening
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Remove SECRET_KEY fallback string from base.py
✅ Raise ImproperlyConfigured if FIELD_ENCRYPTION_KEY unset
✅ Audit all APIViews: add OwnerScopedMixin where missing
✅ Enforce JWT validation in WebSocket connect() handler
✅ Add @shared_task(bind=True, max_retries=3) to Celery tasks
✅ Add Docker resource limits (CPU/memory) to docker-compose.prod.yml
✅ Fix backup script: pass passphrase via fd not CLI arg
✅ Mirror RBAC rules as Django permission_classes on all endpoints

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEEK 2 — Quality, Testing & UX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Add CI gate: deploy-vercel.yml needs: [ci]
✅ Add npm audit + pip-audit to CI pipeline
✅ Add migration reverse_code handlers
✅ Add negative/overflow/boundary tests to accountingEngine
✅ Add msw gateway tests: timeout, bad HMAC, malformed JSON
✅ Add min/max/step to all financial input fields
✅ Add confirmation dialogs before void/delete/terminate actions
✅ Implement exponential backoff on WebSocket reconnects
✅ Add aria-label to all icon buttons + focus traps on modals
✅ Split FinanceLedgerTabs (1500 ln) + TenantMobileApp (2000 ln)
✅ Add Vitest coverage thresholds (80% lines/functions)
✅ Add service worker onNeedRefresh update banner
✅ Persist locale/dateMode to localStorage
✅ Add docs/RUNBOOK.md for production incidents
```

---

# Phase 5 — Frontend Core Issues

> **Scope:** `App.tsx`, `main.tsx`, `types/prms.ts`, all 3 contexts, `rbac.ts`, 6 data files, `sw.ts`

## Summary

| Severity | Count |
|:---|:---:|
| 🔴 Critical | 2 |
| 🟠 High | 4 |
| 🟡 Medium | 3 |
| 🟢 Low | 1 |

---

## 🔴 Critical

### C-1 · Financial Amount Fields Typed as `number` — Floating-Point Risk System-Wide
**File:** [`src/types/prms.ts`, lines 367, 422, 470, 495, 514, 583+](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/types/prms.ts)

```typescript
baseRentEtb: number       // line 367
billedEtb: number         // line 495
debitEtb: number          // line 583
```

Primitive `number` on every financial field propagates IEEE-754 rounding errors throughout the entire type system. Any component or service consuming these types inherits the float precision bug.

**Fix:** Introduce a branded `Cents` type and enforce it on all monetary fields:
```typescript
export type Cents = number & { readonly __brand: unique symbol };
// then:
baseRentCents: Cents;
billedCents: Cents;
```

---

### C-2 · Client-Side-Only RBAC Enforcement — Fully Bypassable
**File:** [`src/policies/rbac.ts`, lines 439, 485, 605](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/policies/rbac.ts)

`checkActionPermission`, `checkApprovalAuthority`, and `getModuleAccess` only run in the browser. Any attacker with API access or a modified client can bypass every permission check. Backend APIs perform no independent role verification.

**Fix:** Mirror all RBAC and Maker-Checker SoD rules in server-side middleware — PostgreSQL RLS policies and Django `permission_classes`. Client-side RBAC is UI-only and must never be the sole gate.

---

## 🟠 High

### H-1 · `PrmsContext` Value Not Memoized — Full App Re-renders on Any State Change
**File:** [`src/context/PrmsContext.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/context/PrmsContext.tsx)

The context provider's `value` object is recreated on every render. Every consumer component (all pages, all components) re-renders on any state change — including unrelated state like toast notifications.

**Fix:**
```tsx
const value = useMemo(() => ({
  ...state, dispatch, ...helpers
}), [state, dispatch]);
return <PrmsContext.Provider value={value}>{children}</PrmsContext.Provider>;
```

---

### H-2 · Locale & Date Mode Preferences Not Persisted to `localStorage`
**File:** [`src/context/PrmsContext.tsx`, lines 687–688](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/context/PrmsContext.tsx)

```typescript
const [locale, setLocale] = useState<UiLocale>('en');
const [dateMode, setDateMode] = useState<DateDisplayMode>('gregorian');
```

User preferences for Amharic (`am`) locale and Ethiopic calendar reset to English/Gregorian on every page refresh, forcing users to re-select on each session.

**Fix:**
```typescript
const [locale, setLocale] = useState<UiLocale>(
  () => (localStorage.getItem('ad_prms_locale_v1') as UiLocale) ?? 'en'
);
```

---

### H-3 · Service Worker Stale Cache — Users Stuck on Old Deployments
**File:** [`src/main.tsx`, lines 6–8](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/main.tsx), [`src/sw.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/sw.ts)

```typescript
registerSW({ immediate: true })
```

`immediate: true` activates the new service worker immediately but the `onNeedRefresh` callback is not handled. Users see stale UI with no prompt to reload after a deployment, breaking the update lifecycle silently.

**Fix:**
```typescript
registerSW({
  onNeedRefresh() {
    showUpdateBanner({ onConfirm: () => location.reload() });
  },
  onOfflineReady() { showOfflineReadyToast(); },
});
```

---

### H-4 · Training/Simulation Data Bundled Into Production Build
**Files:** [`src/data/trainingCatalog.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/data/trainingCatalog.ts), [`src/data/hidarWorkedMonth.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/data/hidarWorkedMonth.ts)

Training exercise bundles and simulation seed data are imported unconditionally in the main entry path and included in every production build. Mock tenant records could be confused with real data in a production deployment.

**Fix:** Gate all training/simulation imports behind `import.meta.env.DEV`:
```typescript
if (import.meta.env.DEV) {
  const { trainingCatalog } = await import('./data/trainingCatalog');
}
```

---

## 🟡 Medium

### M-1 · `Record<string, unknown>` on Audit Trail Payloads — Weak Type Safety
**File:** [`src/types/prms.ts`, lines 764, 766](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/types/prms.ts)

```typescript
beforeValues: Record<string, string | number>
payload: Record<string, unknown>
```

Audit trail and approval payloads use untyped records. Any field can be omitted, misspelled, or injected without compile-time detection.

**Fix:** Define discriminated union types per `ApprovalCategory`:
```typescript
type ApprovalPayload =
  | { category: 'RENT_POSTING'; amount: Cents; leaseId: LeaseId }
  | { category: 'PERIOD_CLOSE'; periodId: PeriodId }
  | ...;
```

---

### M-2 · Seed Data ETB Amounts as Floats — Inconsistent with Accounting Engine
**Files:** [`src/data/seedData.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/data/seedData.ts), [`src/data/extendedSeedData.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/data/extendedSeedData.ts)

Monetary amounts in seed data (e.g. `18000`) are bare floats. When these are summed by the accounting engine expecting integer cents, discrepancies appear in training scenario balance sheets.

**Fix:** Convert all seed amounts using `toCents()` from `accountingEngine.ts`, or store them pre-converted as integer cents.

---

### M-3 · No Localized Error Boundaries Around High-Risk Financial Routes
**File:** [`src/App.tsx`, line 254](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/App.tsx)

The root `<ErrorBoundary>` exists, but individual high-risk lazy routes (Finance, Tax, Approvals Centre) have no local error boundary. A crash in `FinanceLedgerTabs` propagates up and blanks the entire app instead of showing a contained fallback.

**Fix:** Wrap each high-risk route in its own `<ErrorBoundary fallback={<FinanceErrorFallback />}>`.

---

## 🟢 Low

### L-1 · Role Identifiers Compared as Magic Strings at Runtime
**File:** [`src/policies/rbac.ts`, lines 57–183](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/policies/rbac.ts)

Roles are string literals checked at runtime. TypeScript guards compile-time correctness, but runtime injection of unexpected role strings from API responses could bypass checks without input validation.

**Fix:** Freeze role identifiers into a constant object and validate incoming role strings against it before trusting them:
```typescript
export const ROLES = Object.freeze({ OWNER_ADMIN: 'owner_admin', ... });
function isValidRole(r: string): r is PersonaRole {
  return Object.values(ROLES).includes(r as PersonaRole);
}
```

---

# Phase 4 — UI Components & Pages Issues

> **Scope:** 23 pages + 18 components — route guards, state management, performance, a11y, forms, error handling, mobile/PWA, security, component architecture

## Summary

| Severity | Count |
|:---|:---:|
| 🔴 Critical | 3 |
| 🟠 High | 4 |
| 🟡 Medium | 3 |
| 🟢 Low | 2 |

---

## 🔴 Critical

### C-1 · `dangerouslySetInnerHTML` Without Sanitization — Stored XSS
**Files:**
- [`src/components/leases/OromifaContractBuilder.tsx`, lines ~142, ~310](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/leases/OromifaContractBuilder.tsx)
- [`src/components/compliance/RecordRetentionMatrix.tsx`, line ~89](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/compliance/RecordRetentionMatrix.tsx)

Legal contract clauses and compliance statutory excerpts are rendered directly via `dangerouslySetInnerHTML` without sanitization. In a multi-tenant system where property managers or tenants can supply contract amendments, this is a stored XSS vector.

**Fix:** Wrap all HTML strings with `DOMPurify.sanitize(htmlString)` before passing to `dangerouslySetInnerHTML`:
```tsx
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(clause) }} />
```

---

### C-2 · Missing Authentication & RBAC Guards on Sensitive Financial Pages
**Files:**
- [`src/pages/FinancePage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/FinancePage.tsx) lines 1–50
- [`src/pages/RentCollectionsPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentCollectionsPage.tsx) lines 1–50
- [`src/pages/TaxConfigurationPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/TaxConfigurationPage.tsx) lines 1–50
- [`src/pages/ProductionSecurityArchitecturePage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/ProductionSecurityArchitecturePage.tsx) lines 1–50

Page components do not verify auth state or role independently of `AppShell`. Direct deep-linking renders ledger entries, payment gateway configuration, and tax workpapers to unauthenticated users or standard tenants.

**Fix:** Add a `RequireAuth` / `RequireRole` guard at the top of every sensitive page:
```tsx
const { user, role } = usePrmsContext();
if (!user) return <Navigate to="/login" replace />;
if (role !== 'finance_admin') return <Navigate to="/403" replace />;
```

---

### C-3 · Raw/Unformatted Financial Figures in Ledger & Collections UI
**Files:**
- [`src/components/finance/FinanceLedgerTabs.tsx`, lines 240–310](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/finance/FinanceLedgerTabs.tsx)
- [`src/pages/RentCollectionsPage.tsx`, lines 410–480](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentCollectionsPage.tsx)

Raw numerical values and unformatted float strings for ETB amounts are displayed in transaction summary cards and audit trail tables. This causes rounding display discrepancies in financial records.

**Fix:** Route all monetary values through a strict formatter: `formatCurrency(val, 'ETB')` with explicit 2-decimal rounding before rendering.

---

## 🟠 High

### H-1 · Financial Input Fields Missing `min`/`max`/`step` Validation
**Files:**
- [`src/pages/RentCollectionsPage.tsx`, lines 320–380](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentCollectionsPage.tsx)
- [`src/pages/ExpensesPayablesPage.tsx`, lines 120–160](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/ExpensesPayablesPage.tsx)
- [`src/components/gateway/TenantGatewayModal.tsx`, lines 180–230](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/gateway/TenantGatewayModal.tsx)

Payment amount inputs accept negative numbers, zero, or arbitrary decimal precision — enabling erroneous negative receipts or overflow values to reach the ledger.

**Fix:**
```tsx
<input type="number" min="0.01" max="9999999.99" step="0.01" required />
```
Add matching server-side validation as a second gate.

---

### H-2 · No Confirmation Dialog Before Destructive Financial Actions
**Files:**
- [`src/pages/FinancePage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/FinancePage.tsx) — void ledger entry
- [`src/pages/PropertyPortfolioPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/PropertyPortfolioPage.tsx) — delete property/unit
- [`src/pages/TenantsLeasesPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/TenantsLeasesPage.tsx) — terminate lease

Voiding ledger entries, terminating leases, and deleting properties execute immediately on click with no confirmation modal or reason logging.

**Fix:** Gate all destructive actions behind a typed-confirmation modal (e.g. "Type VOID to confirm") and log the action reason to the audit trail before executing.

---

### H-3 · File Upload Accepts Any Type & Size — DoS / Malicious Upload Risk
**Files:**
- [`src/components/ui/DocumentUploadField.tsx`, lines 45–90](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/ui/DocumentUploadField.tsx)
- [`src/pages/RentalApplicationsPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentalApplicationsPage.tsx)

No file type whitelist or size limit enforced client-side. Large payloads or executable uploads pass through to the server.

**Fix:**
```tsx
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Invalid file type');
if (file.size > MAX_SIZE) throw new Error('File too large');
```

---

### H-4 · Sensitive Inputs Missing `autoComplete` Protection
**Files:**
- [`src/pages/LoginPage.tsx`, lines 46–55](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/LoginPage.tsx)
- [`src/components/gateway/TenantGatewayModal.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/gateway/TenantGatewayModal.tsx)

OTP, PIN, and payment token inputs allow browser autofill, risking autofill-based credential harvesting on shared devices.

**Fix:** Set `autoComplete="one-time-code"` on OTP fields, `autoComplete="current-password"` on passwords, and `autoComplete="off"` on payment PINs.

---

## 🟡 Medium

### M-1 · D3/Recharts Data Not Memoized — Dashboard Re-render Stutter
**Files:**
- [`src/components/dashboard/FiscalRevenueD3Chart.tsx`, lines 60–140](file:///c:/Users/microsoft/Documents/Abu Dekebo/remix-remix-ad-prms-prototype/src/components/dashboard/FiscalRevenueD3Chart.tsx)
- [`src/components/dashboard/OccupancyTrendRechartsWidget.tsx`, lines 50–120](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/dashboard/OccupancyTrendRechartsWidget.tsx)
- [`src/pages/PropertyPortfolioPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/PropertyPortfolioPage.tsx)

Complex D3 transforms and chart datasets recalculate on every parent render. Large property/lease lists have no virtualization.

**Fix:** Wrap data transforms in `useMemo`. For lists >50 items use `react-window` or `@tanstack/react-virtual`.

---

### M-2 · Accessibility — Icon Buttons Missing `aria-label`, Modals Missing Focus Trap
**Files:**
- [`src/components/layout/AppShell.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/layout/AppShell.tsx) — sidebar toggle, theme switch
- [`src/components/mobile/BottomSheet.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/mobile/BottomSheet.tsx) — close button
- [`src/components/gateway/TenantGatewayModal.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/gateway/TenantGatewayModal.tsx) — dismiss button

Icon-only buttons have no `aria-label`. Modals lack `role="dialog"`, `aria-modal="true"`, and focus trapping.

**Fix:** Add `aria-label` to all icon buttons. Use a focus trap library (`focus-trap-react`) for all modal/bottom-sheet dialogs.

---

### M-3 · Mobile Touch Targets <44px + PWA Install Banner Always Visible
**Files:**
- [`src/components/mobile/TenantMobileApp.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/mobile/TenantMobileApp.tsx)
- [`src/components/pwa/PWAInstallButton.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/pwa/PWAInstallButton.tsx)

Mobile toolbar buttons fall below the 44×44px WCAG touch target minimum. PWA install button doesn't check `window.matchMedia('(display-mode: standalone)')` — shows inside an already-installed app.

**Fix:** Enforce `min-h-[44px] min-w-[44px]` on all touch elements. Add standalone display-mode guard before rendering the install button.

---

## 🟢 Low

### L-1 · God Components — Monolithic Files >1,000 Lines
| File | Approx. Size | Issue |
|---|---|---|
| [`FinanceLedgerTabs.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/finance/FinanceLedgerTabs.tsx) | ~1,500 lines | Mixes data fetch, business logic, and 6 tab renders |
| [`TenantMobileApp.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/mobile/TenantMobileApp.tsx) | ~2,000 lines | Full app shell, state, payment flows in one file |
| [`OromifaContractBuilder.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/leases/OromifaContractBuilder.tsx) | ~1,200 lines | Contract generation, preview, and signing in one file |

**Fix:** Decompose into sub-components and custom hooks. Each file should own one responsibility.

---

### L-2 · Missing `useEffect` Cleanup on Timers & Camera Scanner
**Files:**
- [`src/pages/RentCollectionsPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentCollectionsPage.tsx) — auto-refresh poll timers
- [`src/components/mobile/PaymentQrScannerSheet.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/mobile/PaymentQrScannerSheet.tsx) — camera scanner interval

Timers/intervals started in `useEffect` lack cleanup functions, causing memory leaks when components unmount.

**Fix:**
```tsx
useEffect(() => {
  const id = setInterval(refresh, 30_000);
  return () => clearInterval(id);
}, []);
```

---

# Phase 3 — Frontend Services & Security Issues

> **Scope:** `accountingEngine`, ArifPay/Telebirr gateways, Firebase, `productionApiClient`, WebSocket sync, SMS, export utils, QR, payment reminders, PWA hooks

## Summary

| Severity | Count |
|:---|:---:|
| 🔴 Critical | 5 |
| 🟠 High | 8 |
| 🟡 Medium | 7 |

---

## 🔴 Critical

### C-1 · Floating-Point Drift in Ledger Balance Summations
**File:** [`src/services/accountingEngine.ts`, lines 456–464, 473–476, 624–635](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/accountingEngine.ts)

While `toCents()` converts ETB to integer cents via `Math.round(etb * 100)`, downstream aggregations across subledgers use JavaScript floating-point addition. Over thousands of journal entries, cumulative IEEE-754 drift corrupts closing balances silently.

**Fix:** Use `BigInt` arithmetic for all ledger balance totals and subledger reconciliations. Never mix `number` and financial cent values in summations.

---

### C-2 · In-Memory Nonce Cache — Payment Session Replay Across Tabs
**File:** [`src/services/arifpayGatewayService.ts`, lines 50, 74–108](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/arifpayGatewayService.ts)

`clientNonceCache` is an in-memory `Map`. Browser refresh or multi-tab sessions reset or fork this cache, allowing the same payment session to be replayed or idempotency keys to be overridden — risking double charges.

**Fix:** Enforce server-side idempotency via unique database constraints on `idempotencyKey`/`nonce`. Require `X-ArifPay-Signature` HMAC-SHA256 verification on all webhook handlers.

---

### C-3 · Cross-Tenant Data Leak via Unscoped Firestore Queries
**File:** [`src/services/firebaseWorkspaceService.ts`, lines 43, 63, 152](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/firebaseWorkspaceService.ts)

Firestore refs like `users/${uid}` and `workspaces/${workspaceId}` are accessed without verifying the authenticated user owns that workspace. No `ownerId` filtering enforced at the client query level.

**Fix:** Add `where('ownerUid', '==', auth.currentUser.uid)` to all workspace/document queries. Reinforce with Firestore Security Rules (`request.auth.uid == resource.data.ownerUid`).

---

### C-4 · JWT Stored in `localStorage` — XSS Exfiltration Risk
**File:** [`src/services/productionApiClient.ts`, lines 12, 48, 57](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/productionApiClient.ts)

```typescript
const TOKEN_STORAGE_KEY = 'adprms.prod.jwt';
localStorage.setItem(TOKEN_STORAGE_KEY, token);
```

Any XSS in the app or a third-party dependency can exfiltrate staff and tenant JWTs from `localStorage`.

**Fix:** Store tokens in `HttpOnly; Secure; SameSite=Strict` cookies set by the backend. Remove all `localStorage` token reads/writes from the client.

---

### C-5 · XSS & Path Traversal in Export Filename Generation
**File:** [`src/utils/exportDownload.ts`, lines 146–154](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/utils/exportDownload.ts)

Filenames are built from unescaped user-supplied `title` and `ownerName` strings. Malicious input can inject path traversal sequences or script execution in downloaded CSV/HTML files.

**Fix:**
```typescript
const safe = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, '_');
const filename = `${safe(title)}_${safe(ownerName)}.csv`;
```

---

## 🟠 High

### H-1 · Division by Zero — `NaN` Propagation in Financial Reports
**File:** [`src/services/accountingEngine.ts`, lines 733–790](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/accountingEngine.ts)

`computeOwnerStatement` and ratio calculations do not guard against zero denominators. `NaN` silently propagates into owner statement reports displayed to users.

**Fix:** Add `if (denominator === 0) return 0;` guards before every division.

---

### H-2 · No `AbortController` Timeout on Gateway Fetch Calls
**File:** [`src/services/arifpayGatewayService.ts`, lines 117–130](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/arifpayGatewayService.ts), [`src/services/telebirrGatewayService.ts`](file:///c:/Users/microsoft/Documents/Abu Dekebo/remix-remix-ad-prms-prototype/src/services/telebirrGatewayService.ts)

`fetch` calls to payment gateway endpoints have no timeout. A hung gateway response blocks the UI indefinitely.

**Fix:**
```typescript
const controller = new AbortController();
const id = setTimeout(() => controller.abort(), 10_000);
const res = await fetch(url, { signal: controller.signal });
clearTimeout(id);
```

---

### H-3 · Missing Offline Persistence & Error Swallowing in Firebase
**File:** [`src/lib/firebase.ts`, lines 41–51](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/lib/firebase.ts), [`src/services/firebaseWorkspaceService.ts`, lines 58, 80](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/firebaseWorkspaceService.ts)

`experimentalForceLongPolling: true` without `enableIndexedDbPersistence` means offline PWA mode has no Firestore cache. Catch blocks swallow errors and throw raw JSON strings directly to UI.

**Fix:** Enable `enableIndexedDbPersistence(db)` in `firebase.ts`. Sanitize all error messages before surfacing to UI components.

---

### H-4 · Multi-Document Firestore Writes Without Transactions
**File:** [`src/services/firebaseWorkspaceService.ts`, lines 152–171](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/firebaseWorkspaceService.ts)

`syncWorkspaceSnapshotToFirestore` calls `setDoc`/`updateDoc` sequentially without a `runTransaction()`. Concurrent updates leave partial writes (e.g. summary updated but revision not).

**Fix:** Wrap all multi-document updates in `runTransaction()` or `writeBatch()`.

---

### H-5 · Missing CSRF Token on State-Changing API Requests
**File:** [`src/services/productionApiClient.ts`, lines 96–101](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/productionApiClient.ts)

`apiRequest` sends `Authorization: Bearer` but no `X-CSRFToken` header on POST/PUT/DELETE requests.

**Fix:** Read the CSRF token from the cookie jar and include it on all non-GET requests:
```typescript
headers['X-CSRFToken'] = getCookie('csrftoken') ?? '';
```

---

### H-6 · WebSocket Reconnects With Fixed 3s Delay — Infinite Loop Risk
**File:** [`src/services/realtimeSyncClient.ts`, lines 131–134](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/realtimeSyncClient.ts)

`ws.onclose` retries forever at exactly 3,000 ms. When the server is down, the client hammers it indefinitely, draining battery and generating useless load.

**Fix:** Implement exponential backoff with jitter and a maximum of ~10 attempts before switching to polling:
```typescript
const delay = Math.min(1000 * 2 ** attempt + Math.random() * 1000, 30_000);
```

---

### H-7 · Unencrypted Sensitive Data in QR Payloads
**File:** [`src/utils/paymentQr.ts`, lines 24–43](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/utils/paymentQr.ts)

Raw invoice numbers, ETB amounts, and session IDs are encoded in plain-text QR strings — readable by anyone who scans the code.

**Fix:** Sign QR payloads with an HMAC-SHA256 token (server-generated) and include an expiry timestamp. Verify signature server-side before processing.

---

### H-8 · Stale Push Subscriptions Not Revoked on Logout
**File:** [`src/hooks/useWebPush.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/hooks/useWebPush.ts)

VAPID keys fall back to empty strings if env vars are missing. Push subscriptions are never unregistered from the server on logout, leaving stale tokens that can receive notifications meant for other sessions.

**Fix:** Call `pushSubscription.unsubscribe()` and DELETE the subscription from the server on `signOut()`.

---

## 🟡 Medium

| # | File | Issue |
|---|---|---|
| M-1 | `accountingEngine.ts` L231–246 | No account-code-to-category validation before posting journal entries |
| M-2 | `arifpayGatewayService.ts` L96, `telebirrGatewayService.ts` L252 | Tenant MSISDN stored unmasked in client session state |
| M-3 | `smsNotificationService.ts` L46–64 | Phone numbers logged plain-text; no client-side SMS debounce (duplicate dispatch risk) |
| M-4 | `realtimeSyncClient.ts` L40, L105 | Incoming WebSocket/BroadcastChannel messages cast to type without runtime schema validation (Zod/ajv) |
| M-5 | `productionApiClient.ts` L121–123 | Server error `detail`/`msg` fields returned directly to UI — may leak internal stack traces |
| M-6 | `utils/formatting.ts` L49–69 | Ethiopic calendar silently falls back to Gregorian in non-Chromium browsers — misdates statutory reports |
| M-7 | `utils/paymentReminders.ts` L74–127 | No reminder deduplication — same reminder can be dispatched multiple times to same tenant |

---

# Phase 2 — Django Backend Issues

> **Scope:** Settings, models, views, serializers, payment gateways, Celery, WebSockets, Docker/Nginx, crypto, templates, scripts & SQL

## Summary

| Severity | Count |
|:---|:---:|
| 🔴 Critical | 1 |
| 🟠 High | 4 |
| 🟡 Medium | 5 |
| 🟢 Low | 1 |

---

## 🔴 Critical

### C-1 · DEBUG=True + Wildcard ALLOWED_HOSTS in Dev Settings
**File:** [`backend/config/settings/dev.py`, lines 3–4](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/config/settings/dev.py)

```python
DEBUG = True
ALLOWED_HOSTS = ['*']
```

If `dev.py` is accidentally activated in production (misconfigured `DJANGO_SETTINGS_MODULE`), `DEBUG=True` exposes full tracebacks, internal settings, and stack state publicly. `ALLOWED_HOSTS = ['*']` permits HTTP Host header poisoning attacks across all environments.

**Fix:** Enforce `prod.py` via strict `DJANGO_SETTINGS_MODULE` validation at startup. Add a guard in `base.py` that raises `ImproperlyConfigured` if `DEBUG=True` and `ALLOWED_HOSTS` contains `'*'` simultaneously.

---

## 🟠 High

### H-1 · Hardcoded Weak Fallback SECRET_KEY
**File:** [`backend/config/settings/base.py`, line 8](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/config/settings/base.py)

```python
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'unsafe-dev-key-override-in-prod')
```

If environment variable loading fails silently in staging/pre-production, the fallback key is used — compromising CSRF tokens, JWT signing, and session cookies system-wide.

**Fix:** Remove the fallback string entirely. Raise an immediate `ImproperlyConfigured` exception if `DJANGO_SECRET_KEY` is unset, in every environment.

---

### H-2 · `float` Used for Financial Amounts in Payment Gateways
**File:** [`backend/apps/gateways/clients.py`, lines 21, 89](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/gateways/clients.py)

```python
def create_arifpay_live_session(*, ..., amount_etb: float, ...):
def initiate_telebirr_preorder(*, ..., amount_etb: float, ...):
```

IEEE-754 floating-point precision errors can silently corrupt ETB rent amounts and tax calculations (e.g., `0.1 + 0.2 ≠ 0.3`). This is a known source of financial bugs.

**Fix:** Replace all `float` amount types with `decimal.Decimal`. Use `Decimal('0.01')` quantization for ETB cent-level precision.

---

### H-3 · Views Missing `OwnerScopedMixin` / `AtomicRlsViewMixin` — RLS Bypass Risk
**File:** [`backend/apps/common/permissions.py`, lines 65–73](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/common/permissions.py)

API views that don't inherit from `OwnerScopedMixin` or `AtomicRlsViewMixin` execute outside PostgreSQL RLS context. Any such endpoint can read or mutate cross-owner data, bypassing the entire row-level isolation model.

**Fix:** Audit every `APIView`/`ModelViewSet` subclass in all 10 apps. Enforce mixin inheritance via a base class or a Django system check that fails startup if any registered view lacks RLS context.

---

### H-4 · WebSocket Authentication Not Enforced at Handshake
**File:** [`backend/apps/realtime/middleware.py`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/realtime/middleware.py), [`consumers.py`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/realtime/consumers.py)

If `TokenAuthMiddleware` does not reject unauthenticated or expired JWT tokens **before** accepting the WebSocket channel group, tenants can subscribe to other owners' ledger and portfolio real-time channels.

**Fix:** In `TokenAuthMiddleware.connect()`, validate the JWT, resolve the user, and call `self.close()` before `channel_layer.group_add` if the token is invalid or expired.

---

## 🟡 Medium

### M-1 · Missing Encryption Key Startup Guard in `crypto.py`
**File:** [`backend/apps/common/crypto.py`, lines 23–29](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/common/crypto.py)

If `FIELD_ENCRYPTION_KEY` is unset, the system silently falls back to `sha256(SECRET_KEY)`. If `SECRET_KEY` is ever rotated or weak, all encrypted PII fields (tenant names, phone numbers, national IDs) become decryptable.

**Fix:** Raise `ImproperlyConfigured` on startup if `FIELD_ENCRYPTION_KEY` is not explicitly set in production.

---

### M-2 · Missing Database Indexes on Ledger Foreign Keys
**File:** [`backend/apps/ledger/models.py`, lines 216–226](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/ledger/models.py)

`LeaseAccountingSchedule` joins `owner`, `lease`, and `period` without composite indexes. Monthly accrual queries and reporting will cause full table scans as data grows.

**Fix:**
```python
class Meta:
    indexes = [models.Index(fields=['owner', 'lease', 'period'])]
```

---

### M-3 · Missing Retry Logic & Atomicity on Celery Tasks
**File:** [`backend/apps/governance/tasks.py`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/governance/tasks.py), [`backend/apps/notifications/tasks.py`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/notifications/tasks.py)

Tasks mutating the database or calling external APIs lack `bind=True`, `max_retries`, and `transaction.atomic()` wrappers. A Redis or DB connection drop mid-task can leave partial state (e.g., notification sent but ledger not updated).

**Fix:**
```python
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def my_task(self, ...):
    with transaction.atomic():
        ...
```

---

### M-4 · No CPU/Memory Resource Limits in Docker Compose
**File:** [`backend/docker-compose.prod.yml`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/docker-compose.prod.yml)

Services `api`, `asgi`, `celery_worker`, `postgres`, and `redis` have no resource limits. A runaway Celery task or memory leak can take down the entire host.

**Fix:** Add to each service:
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
```

---

### M-5 · Backup Script Leaks Passphrase in Process List
**File:** [`backend/scripts/backup_and_restore_drill.sh`, lines 62–65](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/scripts/backup_and_restore_drill.sh)

`BACKUP_ENCRYPTION_PASSPHRASE` passed as a command-line argument to OpenSSL is visible in `ps aux` output to any user on the host.

**Fix:** Use OpenSSL's `-pass fd:N` or `--passphrase-fd` to pass the passphrase via a file descriptor instead of a CLI argument.

---

## 🟢 Low

### L-1 · CSRF Token Audit Needed in Server-Rendered Templates
**File:** [`backend/templates/adprms_prod/`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/templates/adprms_prod/)

Server-rendered HTML partials (`dashboard.html`, `ledger_partial.html`, `portfolio_partial.html`) must include `{% csrf_token %}` in every state-changing form to prevent CSRF attacks.

**Fix:** Grep for `<form` tags without `{% csrf_token %}` and add where missing.

---

> [!NOTE]
> **All 6 phases complete.** See Executive Summary at the bottom for the full prioritised fix list.

---

# Phase 6 — Tests, CI/CD & Migrations Issues

> **Scope:** 17 frontend unit tests, 4 backend pytest files, 2 CI/CD workflows, 7 Django migrations, `server/officeStore.ts`, `server/security.ts`, docs, `check-health.sh`

## Summary

| Severity | Count |
|:---|:---:|
| 🟠 High | 2 |
| 🟡 Medium | 4 |
| 🟢 Low | 2 |

---

## 🟠 High

### H-1 · Deploy Workflow Has No Gate on CI Pass — Vercel Deploys on Failing Tests
**File:** [`.github/workflows/deploy-vercel.yml`, lines 3–8](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/.github/workflows/deploy-vercel.yml)

The Vercel deploy workflow triggers on pushes and PRs to `main` and runs tests internally, but does not formally depend on `ci.yml` completing successfully. A PR with a failing test suite can still trigger a Vercel preview build. No dependency vulnerability scanning (`npm audit` / `pip-audit` / Dependabot) exists in either workflow.

**Fix:**
```yaml
# deploy-vercel.yml
needs: [ci]   # wait for ci.yml to pass first
```
Add a separate `audit` job:
```yaml
- run: npm audit --audit-level=high
- run: pip-audit -r backend/requirements.txt
```

---

### H-2 · Missing Negative & Overflow Edge Cases in Accounting Engine Tests
**File:** [`tests/unit/accountingEngine.test.ts`, lines 37–50](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/tests/unit/accountingEngine.test.ts)

Tests only cover happy-path trial balances. Missing test scenarios:
- Zero-amount journal entries
- Negative line items passed to `postLedgerEvent`
- Cent overflow beyond ETB 10,000,000,000
- Concurrent posting race conditions
- Floating-point rounding edge cases at the `toCents()` boundary

**Fix:** Add parameterised tests for boundary values:
```typescript
it.each([
  [0, 'zero amount'],
  [-100, 'negative amount'],
  [Number.MAX_SAFE_INTEGER, 'overflow'],
])('rejects %i (%s)', (amount) => {
  expect(() => postLedgerEvent({ amount })).toThrow();
});
```

---

## 🟡 Medium

### M-1 · Hardcoded DB Passwords in CI Workflow Logs
**File:** [`.github/workflows/ci.yml`, line 101](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/.github/workflows/ci.yml)

Connection strings (`postgres://adprms_admin:wp2_admin_password@...`) are passed as literal environment variables. Any debug `echo` or failed step output leaks them into GitHub Actions build logs.

**Fix:** Store all credentials as GitHub Actions secrets and add log masking:
```yaml
- run: echo "::add-mask::${{ secrets.DB_PASSWORD }}"
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

### M-2 · Non-Idempotent RLS & Trigger SQL in Ledger Migration
**File:** [`backend/apps/ledger/migrations/0002_pg_ledger_triggers_and_rls.py`, lines 50–80](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/backend/apps/ledger/migrations/0002_pg_ledger_triggers_and_rls.py)

RLS policy DDL does not fully scope table names with schema qualifiers. On partial schema initialization or re-run, policies can attach to `public` namespace tables unexpectedly.

**Fix:** Qualify all table names (`public.ledger_journalentry`) and wrap DDL in idempotent guards:
```sql
SET search_path = public;
DROP POLICY IF EXISTS rls_owner_isolation ON public.ledger_journalentry;
CREATE POLICY rls_owner_isolation ON public.ledger_journalentry ...;
```

---

### M-3 · Missing Reverse Functions on Custom SQL Migrations
**Files:** Multiple migrations across `governance/`, `ledger/`, `portfolio/`

`RunPython` and raw SQL migrations that install triggers and RLS policies have no `reverse_code`. Running `manage.py migrate app <previous>` in production leaves orphaned triggers and policies.

**Fix:** Add explicit reverse handlers to every custom migration:
```python
migrations.RunPython(apply_rls_triggers, reverse_code=remove_rls_triggers)
```

---

### M-4 · Over-Mocking in Payment Gateway Tests — Real Failure Cases Untested
**Files:** [`tests/unit/telebirrGatewayService.test.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/tests/unit/telebirrGatewayService.test.ts), [`tests/unit/arifpayGatewayService.test.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/tests/unit/arifpayGatewayService.test.ts)

Gateway tests mock all fetch calls and never test:
- Network timeout / `AbortController` cancellation
- Malformed JSON from upstream providers
- Invalid HMAC webhook signature rejection
- Idempotency key collision handling

**Fix:** Add negative-path tests with `msw` (Mock Service Worker) handlers that simulate upstream failures, timeouts, and tampered signatures.

---

## 🟢 Low

### L-1 · No Production Incident Runbook in `docs/`
**File:** [`docs/`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/docs/)

ADRs and status updates are well-documented, but no incident runbook exists for: DB lockups, RLS bypass attempts, failed payment gateway reconciliation batches, or corrupted ledger states.

**Fix:** Add `docs/RUNBOOK.md` covering: on-call escalation, DB recovery steps, gateway reconciliation procedures, and RLS audit verification commands.

---

### L-2.5 · `npx vitest` Fetches Non-Existent `vitest@5.1.0` — Tests Cannot Run Outside `npm test`
**File:** [`package.json`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/package.json)

Running `npx vitest` directly (or in a CI step that bypasses `npm test`) causes npx to attempt fetching `vitest@5.1.0` from the registry — a version that does not exist — and fails. Tests only work via `npm test` using the local `node_modules/.bin/vitest` binary. Any CI step or developer shortcut invoking `npx vitest` directly will silently fail or error.

**Fix:** Pin vitest to an existing version in `package.json` and document that tests must be run via `npm test` / `npx --no vitest` (which skips auto-fetch and uses the local binary).

---

### L-2 · `check-health.sh` Missing Error Handling & Hardcoded Ports
**File:** [`check-health.sh`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/check-health.sh)

Script lacks `set -euo pipefail` — a failed health check curl silently passes. Ports/hostnames are hardcoded instead of read from environment.

**Fix:**
```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${APP_HOST:-127.0.0.1}"
PORT="${APP_PORT:-3000}"
curl -sf "http://${HOST}:${PORT}/api/health" || exit 1
```

---

# ═══════════════════════════════════════
# MASTER EXECUTIVE SUMMARY — All 6 Phases
# ═══════════════════════════════════════

> **Project:** AD-PRMS Training Simulation Architecture Reference  
> **Repo:** https://github.com/abeselomchernet/AD-PRMS-Training-Simulation-Architecture-Reference  
> **Analysis Date:** 2026-11-19  
> **Files Reviewed:** ~160 files across frontend, backend, infra, tests, docs

## Total Issue Count

| Severity | Count | Phase Breakdown |
|:---|:---:|:---|
| 🔴 **Critical** | **15** | Ph1: 4 · Ph2: 1 · Ph3: 5 · Ph4: 3 · Ph5: 2 · Ph6: 0 |
| 🟠 **High** | **29** | Ph1: 9 · Ph2: 4 · Ph3: 8 · Ph4: 4 · Ph5: 4 · Ph6: 2 |
| 🟡 **Medium** | **36** | Ph1: 11 · Ph2: 5 · Ph3: 7 · Ph4: 3 · Ph5: 3 · Ph6: 4 |
| 🟢 **Low** | **11** | Ph1: 5 · Ph2: 1 · Ph3: 0 · Ph4: 2 · Ph5: 1 · Ph6: 2 |
| **Total** | **91** | |

---

## 🔴 Top 15 Critical Issues (Fix Immediately)

| # | Issue | File(s) |
|---|---|---|
| 1 | Hardcoded admin email backdoor in Firestore rules | `firestore.rules` |
| 2 | No rate limiting on OTP/auth — brute-force trivial | `server.ts` |
| 3 | Vercel catch-all rewrite silently breaks all API calls | `vercel.json` |
| 4 | Playwright CI crashes on Windows (POSIX env vars) | `playwright.config.ts` |
| 5 | `float` for all ETB amounts — silent rounding across type system | `src/types/prms.ts` |
| 6 | Floating-point ledger drift over thousands of journal entries | `accountingEngine.ts` |
| 7 | JWT stored in `localStorage` — stolen by any XSS | `productionApiClient.ts` |
| 8 | Cross-tenant Firestore queries without owner scoping | `firebaseWorkspaceService.ts` |
| 9 | Payment nonce cache in memory — session replay across tabs | `arifpayGatewayService.ts` |
| 10 | XSS in export filename from unsanitized user input | `exportDownload.ts` |
| 11 | `dangerouslySetInnerHTML` on lease contracts without DOMPurify | `OromifaContractBuilder.tsx` |
| 12 | No page-level auth/RBAC guards on Finance, Tax, Audit pages | Multiple pages |
| 13 | Raw cents/unformatted floats shown in ledger UI | `FinanceLedgerTabs.tsx` |
| 14 | Client-side-only RBAC — backend enforces nothing | `rbac.ts` |
| 15 | `DEBUG=True` + `ALLOWED_HOSTS=['*']` could reach production | `settings/dev.py` |

---

## Prioritised Fix Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAY 1 — Stop the bleeding (Security)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Remove berhaneunity@gmail.com from firestore.rules
✅ Add express-rate-limit to /auth and /otp endpoints
✅ Move JWTs from localStorage → HttpOnly cookies
✅ Add owner scoping to all Firestore queries
✅ Fix Vercel rewrites: exclude /api/* from catch-all
✅ Sanitize dangerouslySetInnerHTML with DOMPurify
✅ Add RequireAuth/RequireRole guards to Finance, Tax, Audit pages
✅ Remove allowedHosts: true from server.ts Vite config

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAY 2 — Financial Data Integrity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Replace all ETB `number` → `Cents` branded type in prms.ts
✅ Replace float gateway args with Decimal in Django & TS
✅ Add BigInt summation to accounting engine subledger totals
✅ Add AbortController timeouts to all gateway fetch calls
✅ Enforce idempotency server-side (unique DB constraint on nonce)
✅ Sign QR payloads with HMAC-SHA256 + expiry timestamp
✅ Wrap Firestore multi-doc writes in runTransaction()
✅ Format all ETB values through formatCurrency() before render

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAY 3 — Build, Config & Type Safety
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Enable "strict": true in tsconfig.json
✅ Fix "start" script: compile server.ts → server.js
✅ Remove bun.lock OR package-lock.json (pick one)
✅ Remove legacy-peer-deps=true from .npmrc
✅ Add typescript-eslint + react-hooks to eslint.config.mjs
✅ Add "node" and "vitest/globals" to tsconfig types array
✅ Populate .env.example with all 12+ missing variables
✅ Gate training/simulation data behind import.meta.env.DEV

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DAY 4 — Backend Hardening
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Remove SECRET_KEY fallback string from base.py
✅ Raise ImproperlyConfigured if FIELD_ENCRYPTION_KEY unset
✅ Audit all APIViews: add OwnerScopedMixin where missing
✅ Enforce JWT validation in WebSocket connect() handler
✅ Add @shared_task(bind=True, max_retries=3) to Celery tasks
✅ Add Docker resource limits (CPU/memory) to docker-compose.prod.yml
✅ Fix backup script: pass passphrase via fd not CLI arg
✅ Mirror RBAC rules as Django permission_classes on all endpoints

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEEK 2 — Quality, Testing & UX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Add CI gate: deploy-vercel.yml needs: [ci]
✅ Add npm audit + pip-audit to CI pipeline
✅ Add migration reverse_code handlers
✅ Add negative/overflow/boundary tests to accountingEngine
✅ Add msw gateway tests: timeout, bad HMAC, malformed JSON
✅ Add min/max/step to all financial input fields
✅ Add confirmation dialogs before void/delete/terminate actions
✅ Implement exponential backoff on WebSocket reconnects
✅ Add aria-label to all icon buttons + focus traps on modals
✅ Split FinanceLedgerTabs (1500 ln) + TenantMobileApp (2000 ln)
✅ Add Vitest coverage thresholds (80% lines/functions)
✅ Add service worker onNeedRefresh update banner
✅ Persist locale/dateMode to localStorage
✅ Add docs/RUNBOOK.md for production incidents
```

---

# Phase 5 — Frontend Core Issues

> **Scope:** `App.tsx`, `main.tsx`, `types/prms.ts`, all 3 contexts, `rbac.ts`, 6 data files, `sw.ts`

## Summary

| Severity | Count |
|:---|:---:|
| 🔴 Critical | 2 |
| 🟠 High | 4 |
| 🟡 Medium | 3 |
| 🟢 Low | 1 |

---

## 🔴 Critical

### C-1 · Financial Amount Fields Typed as `number` — Floating-Point Risk System-Wide
**File:** [`src/types/prms.ts`, lines 367, 422, 470, 495, 514, 583+](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/types/prms.ts)

```typescript
baseRentEtb: number       // line 367
billedEtb: number         // line 495
debitEtb: number          // line 583
```

Primitive `number` on every financial field propagates IEEE-754 rounding errors throughout the entire type system. Any component or service consuming these types inherits the float precision bug.

**Fix:** Introduce a branded `Cents` type and enforce it on all monetary fields:
```typescript
export type Cents = number & { readonly __brand: unique symbol };
// then:
baseRentCents: Cents;
billedCents: Cents;
```

---

### C-2 · Client-Side-Only RBAC Enforcement — Fully Bypassable
**File:** [`src/policies/rbac.ts`, lines 439, 485, 605](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/policies/rbac.ts)

`checkActionPermission`, `checkApprovalAuthority`, and `getModuleAccess` only run in the browser. Any attacker with API access or a modified client can bypass every permission check. Backend APIs perform no independent role verification.

**Fix:** Mirror all RBAC and Maker-Checker SoD rules in server-side middleware — PostgreSQL RLS policies and Django `permission_classes`. Client-side RBAC is UI-only and must never be the sole gate.

---

## 🟠 High

### H-1 · `PrmsContext` Value Not Memoized — Full App Re-renders on Any State Change
**File:** [`src/context/PrmsContext.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/context/PrmsContext.tsx)

The context provider's `value` object is recreated on every render. Every consumer component (all pages, all components) re-renders on any state change — including unrelated state like toast notifications.

**Fix:**
```tsx
const value = useMemo(() => ({
  ...state, dispatch, ...helpers
}), [state, dispatch]);
return <PrmsContext.Provider value={value}>{children}</PrmsContext.Provider>;
```

---

### H-2 · Locale & Date Mode Preferences Not Persisted to `localStorage`
**File:** [`src/context/PrmsContext.tsx`, lines 687–688](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/context/PrmsContext.tsx)

```typescript
const [locale, setLocale] = useState<UiLocale>('en');
const [dateMode, setDateMode] = useState<DateDisplayMode>('gregorian');
```

User preferences for Amharic (`am`) locale and Ethiopic calendar reset to English/Gregorian on every page refresh, forcing users to re-select on each session.

**Fix:**
```typescript
const [locale, setLocale] = useState<UiLocale>(
  () => (localStorage.getItem('ad_prms_locale_v1') as UiLocale) ?? 'en'
);
```

---

### H-3 · Service Worker Stale Cache — Users Stuck on Old Deployments
**File:** [`src/main.tsx`, lines 6–8](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/main.tsx), [`src/sw.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/sw.ts)

```typescript
registerSW({ immediate: true })
```

`immediate: true` activates the new service worker immediately but the `onNeedRefresh` callback is not handled. Users see stale UI with no prompt to reload after a deployment, breaking the update lifecycle silently.

**Fix:**
```typescript
registerSW({
  onNeedRefresh() {
    showUpdateBanner({ onConfirm: () => location.reload() });
  },
  onOfflineReady() { showOfflineReadyToast(); },
});
```

---

### H-4 · Training/Simulation Data Bundled Into Production Build
**Files:** [`src/data/trainingCatalog.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/data/trainingCatalog.ts), [`src/data/hidarWorkedMonth.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/data/hidarWorkedMonth.ts)

Training exercise bundles and simulation seed data are imported unconditionally in the main entry path and included in every production build. Mock tenant records could be confused with real data in a production deployment.

**Fix:** Gate all training/simulation imports behind `import.meta.env.DEV`:
```typescript
if (import.meta.env.DEV) {
  const { trainingCatalog } = await import('./data/trainingCatalog');
}
```

---

## 🟡 Medium

### M-1 · `Record<string, unknown>` on Audit Trail Payloads — Weak Type Safety
**File:** [`src/types/prms.ts`, lines 764, 766](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/types/prms.ts)

```typescript
beforeValues: Record<string, string | number>
payload: Record<string, unknown>
```

Audit trail and approval payloads use untyped records. Any field can be omitted, misspelled, or injected without compile-time detection.

**Fix:** Define discriminated union types per `ApprovalCategory`:
```typescript
type ApprovalPayload =
  | { category: 'RENT_POSTING'; amount: Cents; leaseId: LeaseId }
  | { category: 'PERIOD_CLOSE'; periodId: PeriodId }
  | ...;
```

---

### M-2 · Seed Data ETB Amounts as Floats — Inconsistent with Accounting Engine
**Files:** [`src/data/seedData.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/data/seedData.ts), [`src/data/extendedSeedData.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/data/extendedSeedData.ts)

Monetary amounts in seed data (e.g. `18000`) are bare floats. When these are summed by the accounting engine expecting integer cents, discrepancies appear in training scenario balance sheets.

**Fix:** Convert all seed amounts using `toCents()` from `accountingEngine.ts`, or store them pre-converted as integer cents.

---

### M-3 · No Localized Error Boundaries Around High-Risk Financial Routes
**File:** [`src/App.tsx`, line 254](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/App.tsx)

The root `<ErrorBoundary>` exists, but individual high-risk lazy routes (Finance, Tax, Approvals Centre) have no local error boundary. A crash in `FinanceLedgerTabs` propagates up and blanks the entire app instead of showing a contained fallback.

**Fix:** Wrap each high-risk route in its own `<ErrorBoundary fallback={<FinanceErrorFallback />}>`.

---

## 🟢 Low

### L-1 · Role Identifiers Compared as Magic Strings at Runtime
**File:** [`src/policies/rbac.ts`, lines 57–183](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/policies/rbac.ts)

Roles are string literals checked at runtime. TypeScript guards compile-time correctness, but runtime injection of unexpected role strings from API responses could bypass checks without input validation.

**Fix:** Freeze role identifiers into a constant object and validate incoming role strings against it before trusting them:
```typescript
export const ROLES = Object.freeze({ OWNER_ADMIN: 'owner_admin', ... });
function isValidRole(r: string): r is PersonaRole {
  return Object.values(ROLES).includes(r as PersonaRole);
}
```

---

# Phase 4 — UI Components & Pages Issues

> **Scope:** 23 pages + 18 components — route guards, state management, performance, a11y, forms, error handling, mobile/PWA, security, component architecture

## Summary

| Severity | Count |
|:---|:---:|
| 🔴 Critical | 3 |
| 🟠 High | 4 |
| 🟡 Medium | 3 |
| 🟢 Low | 2 |

---

## 🔴 Critical

### C-1 · `dangerouslySetInnerHTML` Without Sanitization — Stored XSS
**Files:**
- [`src/components/leases/OromifaContractBuilder.tsx`, lines ~142, ~310](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/leases/OromifaContractBuilder.tsx)
- [`src/components/compliance/RecordRetentionMatrix.tsx`, line ~89](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/compliance/RecordRetentionMatrix.tsx)

Legal contract clauses and compliance statutory excerpts are rendered directly via `dangerouslySetInnerHTML` without sanitization. In a multi-tenant system where property managers or tenants can supply contract amendments, this is a stored XSS vector.

**Fix:** Wrap all HTML strings with `DOMPurify.sanitize(htmlString)` before passing to `dangerouslySetInnerHTML`:
```tsx
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(clause) }} />
```

---

### C-2 · Missing Authentication & RBAC Guards on Sensitive Financial Pages
**Files:**
- [`src/pages/FinancePage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/FinancePage.tsx) lines 1–50
- [`src/pages/RentCollectionsPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentCollectionsPage.tsx) lines 1–50
- [`src/pages/TaxConfigurationPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/TaxConfigurationPage.tsx) lines 1–50
- [`src/pages/ProductionSecurityArchitecturePage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/ProductionSecurityArchitecturePage.tsx) lines 1–50

Page components do not verify auth state or role independently of `AppShell`. Direct deep-linking renders ledger entries, payment gateway configuration, and tax workpapers to unauthenticated users or standard tenants.

**Fix:** Add a `RequireAuth` / `RequireRole` guard at the top of every sensitive page:
```tsx
const { user, role } = usePrmsContext();
if (!user) return <Navigate to="/login" replace />;
if (role !== 'finance_admin') return <Navigate to="/403" replace />;
```

---

### C-3 · Raw/Unformatted Financial Figures in Ledger & Collections UI
**Files:**
- [`src/components/finance/FinanceLedgerTabs.tsx`, lines 240–310](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/finance/FinanceLedgerTabs.tsx)
- [`src/pages/RentCollectionsPage.tsx`, lines 410–480](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentCollectionsPage.tsx)

Raw numerical values and unformatted float strings for ETB amounts are displayed in transaction summary cards and audit trail tables. This causes rounding display discrepancies in financial records.

**Fix:** Route all monetary values through a strict formatter: `formatCurrency(val, 'ETB')` with explicit 2-decimal rounding before rendering.

---

## 🟠 High

### H-1 · Financial Input Fields Missing `min`/`max`/`step` Validation
**Files:**
- [`src/pages/RentCollectionsPage.tsx`, lines 320–380](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentCollectionsPage.tsx)
- [`src/pages/ExpensesPayablesPage.tsx`, lines 120–160](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/ExpensesPayablesPage.tsx)
- [`src/components/gateway/TenantGatewayModal.tsx`, lines 180–230](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/gateway/TenantGatewayModal.tsx)

Payment amount inputs accept negative numbers, zero, or arbitrary decimal precision — enabling erroneous negative receipts or overflow values to reach the ledger.

**Fix:**
```tsx
<input type="number" min="0.01" max="9999999.99" step="0.01" required />
```
Add matching server-side validation as a second gate.

---

### H-2 · No Confirmation Dialog Before Destructive Financial Actions
**Files:**
- [`src/pages/FinancePage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/FinancePage.tsx) — void ledger entry
- [`src/pages/PropertyPortfolioPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/PropertyPortfolioPage.tsx) — delete property/unit
- [`src/pages/TenantsLeasesPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/TenantsLeasesPage.tsx) — terminate lease

Voiding ledger entries, terminating leases, and deleting properties execute immediately on click with no confirmation modal or reason logging.

**Fix:** Gate all destructive actions behind a typed-confirmation modal (e.g. "Type VOID to confirm") and log the action reason to the audit trail before executing.

---

### H-3 · File Upload Accepts Any Type & Size — DoS / Malicious Upload Risk
**Files:**
- [`src/components/ui/DocumentUploadField.tsx`, lines 45–90](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/ui/DocumentUploadField.tsx)
- [`src/pages/RentalApplicationsPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentalApplicationsPage.tsx)

No file type whitelist or size limit enforced client-side. Large payloads or executable uploads pass through to the server.

**Fix:**
```tsx
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Invalid file type');
if (file.size > MAX_SIZE) throw new Error('File too large');
```

---

### H-4 · Sensitive Inputs Missing `autoComplete` Protection
**Files:**
- [`src/pages/LoginPage.tsx`, lines 46–55](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/LoginPage.tsx)
- [`src/components/gateway/TenantGatewayModal.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/gateway/TenantGatewayModal.tsx)

OTP, PIN, and payment token inputs allow browser autofill, risking autofill-based credential harvesting on shared devices.

**Fix:** Set `autoComplete="one-time-code"` on OTP fields, `autoComplete="current-password"` on passwords, and `autoComplete="off"` on payment PINs.

---

## 🟡 Medium

### M-1 · D3/Recharts Data Not Memoized — Dashboard Re-render Stutter
**Files:**
- [`src/components/dashboard/FiscalRevenueD3Chart.tsx`, lines 60–140](file:///c:/Users/microsoft/Documents/Abu Dekebo/remix-remix-ad-prms-prototype/src/components/dashboard/FiscalRevenueD3Chart.tsx)
- [`src/components/dashboard/OccupancyTrendRechartsWidget.tsx`, lines 50–120](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/dashboard/OccupancyTrendRechartsWidget.tsx)
- [`src/pages/PropertyPortfolioPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/PropertyPortfolioPage.tsx)

Complex D3 transforms and chart datasets recalculate on every parent render. Large property/lease lists have no virtualization.

**Fix:** Wrap data transforms in `useMemo`. For lists >50 items use `react-window` or `@tanstack/react-virtual`.

---

### M-2 · Accessibility — Icon Buttons Missing `aria-label`, Modals Missing Focus Trap
**Files:**
- [`src/components/layout/AppShell.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/layout/AppShell.tsx) — sidebar toggle, theme switch
- [`src/components/mobile/BottomSheet.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/mobile/BottomSheet.tsx) — close button
- [`src/components/gateway/TenantGatewayModal.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/gateway/TenantGatewayModal.tsx) — dismiss button

Icon-only buttons have no `aria-label`. Modals lack `role="dialog"`, `aria-modal="true"`, and focus trapping.

**Fix:** Add `aria-label` to all icon buttons. Use a focus trap library (`focus-trap-react`) for all modal/bottom-sheet dialogs.

---

### M-3 · Mobile Touch Targets <44px + PWA Install Banner Always Visible
**Files:**
- [`src/components/mobile/TenantMobileApp.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/mobile/TenantMobileApp.tsx)
- [`src/components/pwa/PWAInstallButton.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/pwa/PWAInstallButton.tsx)

Mobile toolbar buttons fall below the 44×44px WCAG touch target minimum. PWA install button doesn't check `window.matchMedia('(display-mode: standalone)')` — shows inside an already-installed app.

**Fix:** Enforce `min-h-[44px] min-w-[44px]` on all touch elements. Add standalone display-mode guard before rendering the install button.

---

## 🟢 Low

### L-1 · God Components — Monolithic Files >1,000 Lines
| File | Approx. Size | Issue |
|---|---|---|
| [`FinanceLedgerTabs.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/finance/FinanceLedgerTabs.tsx) | ~1,500 lines | Mixes data fetch, business logic, and 6 tab renders |
| [`TenantMobileApp.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/mobile/TenantMobileApp.tsx) | ~2,000 lines | Full app shell, state, payment flows in one file |
| [`OromifaContractBuilder.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/leases/OromifaContractBuilder.tsx) | ~1,200 lines | Contract generation, preview, and signing in one file |

**Fix:** Decompose into sub-components and custom hooks. Each file should own one responsibility.

---

### L-2 · Missing `useEffect` Cleanup on Timers & Camera Scanner
**Files:**
- [`src/pages/RentCollectionsPage.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/pages/RentCollectionsPage.tsx) — auto-refresh poll timers
- [`src/components/mobile/PaymentQrScannerSheet.tsx`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/components/mobile/PaymentQrScannerSheet.tsx) — camera scanner interval

Timers/intervals started in `useEffect` lack cleanup functions, causing memory leaks when components unmount.

**Fix:**
```tsx
useEffect(() => {
  const id = setInterval(refresh, 30_000);
  return () => clearInterval(id);
}, []);
```

---

# Phase 3 — Frontend Services & Security Issues

> **Scope:** `accountingEngine`, ArifPay/Telebirr gateways, Firebase, `productionApiClient`, WebSocket sync, SMS, export utils, QR, payment reminders, PWA hooks

## Summary

| Severity | Count |
|:---|:---:|
| 🔴 Critical | 5 |
| 🟠 High | 8 |
| 🟡 Medium | 7 |

---

## 🔴 Critical

### C-1 · Floating-Point Drift in Ledger Balance Summations
**File:** [`src/services/accountingEngine.ts`, lines 456–464, 473–476, 624–635](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/accountingEngine.ts)

While `toCents()` converts ETB to integer cents via `Math.round(etb * 100)`, downstream aggregations across subledgers use JavaScript floating-point addition. Over thousands of journal entries, cumulative IEEE-754 drift corrupts closing balances silently.

**Fix:** Use `BigInt` arithmetic for all ledger balance totals and subledger reconciliations. Never mix `number` and financial cent values in summations.

---

### C-2 · In-Memory Nonce Cache — Payment Session Replay Across Tabs
**File:** [`src/services/arifpayGatewayService.ts`, lines 50, 74–108](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/arifpayGatewayService.ts)

`clientNonceCache` is an in-memory `Map`. Browser refresh or multi-tab sessions reset or fork this cache, allowing the same payment session to be replayed or idempotency keys to be overridden — risking double charges.

**Fix:** Enforce server-side idempotency via unique database constraints on `idempotencyKey`/`nonce`. Require `X-ArifPay-Signature` HMAC-SHA256 verification on all webhook handlers.

---

### C-3 · Cross-Tenant Data Leak via Unscoped Firestore Queries
**File:** [`src/services/firebaseWorkspaceService.ts`, lines 43, 63, 152](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/firebaseWorkspaceService.ts)

Firestore refs like `users/${uid}` and `workspaces/${workspaceId}` are accessed without verifying the authenticated user owns that workspace. No `ownerId` filtering enforced at the client query level.

**Fix:** Add `where('ownerUid', '==', auth.currentUser.uid)` to all workspace/document queries. Reinforce with Firestore Security Rules (`request.auth.uid == resource.data.ownerUid`).

---

### C-4 · JWT Stored in `localStorage` — XSS Exfiltration Risk
**File:** [`src/services/productionApiClient.ts`, lines 12, 48, 57](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/productionApiClient.ts)

```typescript
const TOKEN_STORAGE_KEY = 'adprms.prod.jwt';
localStorage.setItem(TOKEN_STORAGE_KEY, token);
```

Any XSS in the app or a third-party dependency can exfiltrate staff and tenant JWTs from `localStorage`.

**Fix:** Store tokens in `HttpOnly; Secure; SameSite=Strict` cookies set by the backend. Remove all `localStorage` token reads/writes from the client.

---

### C-5 · XSS & Path Traversal in Export Filename Generation
**File:** [`src/utils/exportDownload.ts`, lines 146–154](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/utils/exportDownload.ts)

Filenames are built from unescaped user-supplied `title` and `ownerName` strings. Malicious input can inject path traversal sequences or script execution in downloaded CSV/HTML files.

**Fix:**
```typescript
const safe = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, '_');
const filename = `${safe(title)}_${safe(ownerName)}.csv`;
```

---

## 🟠 High

### H-1 · Division by Zero — `NaN` Propagation in Financial Reports
**File:** [`src/services/accountingEngine.ts`, lines 733–790](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/accountingEngine.ts)

`computeOwnerStatement` and ratio calculations do not guard against zero denominators. `NaN` silently propagates into owner statement reports displayed to users.

**Fix:** Add `if (denominator === 0) return 0;` guards before every division.

---

### H-2 · No `AbortController` Timeout on Gateway Fetch Calls
**File:** [`src/services/arifpayGatewayService.ts`, lines 117–130](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/arifpayGatewayService.ts), [`src/services/telebirrGatewayService.ts`](file:///c:/Users/microsoft/Documents/Abu Dekebo/remix-remix-ad-prms-prototype/src/services/telebirrGatewayService.ts)

`fetch` calls to payment gateway endpoints have no timeout. A hung gateway response blocks the UI indefinitely.

**Fix:**
```typescript
const controller = new AbortController();
const id = setTimeout(() => controller.abort(), 10_000);
const res = await fetch(url, { signal: controller.signal });
clearTimeout(id);
```

---

### H-3 · Missing Offline Persistence & Error Swallowing in Firebase
**File:** [`src/lib/firebase.ts`, lines 41–51](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/lib/firebase.ts), [`src/services/firebaseWorkspaceService.ts`, lines 58, 80](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/firebaseWorkspaceService.ts)

`experimentalForceLongPolling: true` without `enableIndexedDbPersistence` means offline PWA mode has no Firestore cache. Catch blocks swallow errors and throw raw JSON strings directly to UI.

**Fix:** Enable `enableIndexedDbPersistence(db)` in `firebase.ts`. Sanitize all error messages before surfacing to UI components.

---

### H-4 · Multi-Document Firestore Writes Without Transactions
**File:** [`src/services/firebaseWorkspaceService.ts`, lines 152–171](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/firebaseWorkspaceService.ts)

`syncWorkspaceSnapshotToFirestore` calls `setDoc`/`updateDoc` sequentially without a `runTransaction()`. Concurrent updates leave partial writes (e.g. summary updated but revision not).

**Fix:** Wrap all multi-document updates in `runTransaction()` or `writeBatch()`.

---

### H-5 · Missing CSRF Token on State-Changing API Requests
**File:** [`src/services/productionApiClient.ts`, lines 96–101](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/productionApiClient.ts)

`apiRequest` sends `Authorization: Bearer` but no `X-CSRFToken` header on POST/PUT/DELETE requests.

**Fix:** Read the CSRF token from the cookie jar and include it on all non-GET requests:
```typescript
headers['X-CSRFToken'] = getCookie('csrftoken') ?? '';
```

---

### H-6 · WebSocket Reconnects With Fixed 3s Delay — Infinite Loop Risk
**File:** [`src/services/realtimeSyncClient.ts`, lines 131–134](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/services/realtimeSyncClient.ts)

`ws.onclose` retries forever at exactly 3,000 ms. When the server is down, the client hammers it indefinitely, draining battery and generating useless load.

**Fix:** Implement exponential backoff with jitter and a maximum of ~10 attempts before switching to polling:
```typescript
const delay = Math.min(1000 * 2 ** attempt + Math.random() * 1000, 30_000);
```

---

### H-7 · Unencrypted Sensitive Data in QR Payloads
**File:** [`src/utils/paymentQr.ts`, lines 24–43](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/utils/paymentQr.ts)

Raw invoice numbers, ETB amounts, and session IDs are encoded in plain-text QR strings — readable by anyone who scans the code.

**Fix:** Sign QR payloads with an HMAC-SHA256 token (server-generated) and include an expiry timestamp. Verify signature server-side before processing.

---

### H-8 · Stale Push Subscriptions Not Revoked on Logout
**File:** [`src/hooks/useWebPush.ts`](file:///c:/Users/microsoft/Documents/Abu%20Dekebo/remix-remix-ad-prms-prototype/src/hooks/useWebPush.ts)

VAPID keys fall back to empty strings if env vars are missing. Push subscriptions are never unregistered from the server on logout, leaving stale tokens that can receive notifications meant for other sessions.

**Fix:** Call `pushSubscription.unsubscribe()` and DELETE the subscription from the server on `signOut()`.

---

## 🟡 Medium

| # | File | Issue |
|---|---|---|
| M-1 | `accountingEngine.ts` L231–246 | No account-code-to-category validation before posting journal entries |
| M-2 | `arifpayGatewayService.ts` L96, `telebirrGatewayService.ts` L252 | Tenant MSISDN stored unmasked in client session state |
| M-3 | `smsNotificationService.ts` L46–64 | Phone numbers logged plain-text; no client-side SMS debounce (duplicate dispatch risk) |
| M-4 | `realtimeSyncClient.ts` L40, L105 | Incoming WebSocket/BroadcastChannel messages cast to type without runtime schema validation (Zod/ajv) |
| M-5 | `productionApiClient.ts` L121–123 | Server error `detail`/`msg` fields returned directly to UI — may leak internal stack traces |
| M-6 | `utils/formatting.ts` L49–69 | Ethiopic calendar silently falls back to Gregorian in non-Chromium browsers — misdates statutory reports |
| M-7 | `utils/paymentReminders.ts` L74–127 | No reminder deduplication — same reminder can be dispatched multiple times to same tenant |

