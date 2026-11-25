# WP-2 Database and RLS Validation Plan

**Date:** 2026-11-12  
**Status:** PENDING — requires PostgreSQL 16 instance  
**Source:** ADR-003 §4; WP-2 Authorization §7  

---

## 1. Purpose

This document defines the exact validation steps required to verify the
PostgreSQL-specific components of WP-2 that cannot be tested on SQLite.
These tests MUST be executed when a PostgreSQL 16 instance becomes available.

## 2. Runtime Prerequisites

Before running these validations:

1. PostgreSQL 16 installed and running locally
2. Database created: `adprms_dev`
3. Two database roles created:

```sql
-- Migration/admin role (superuser — can bypass RLS for maintenance)
CREATE ROLE adprms_admin WITH LOGIN PASSWORD '<secure>' SUPERUSER;

-- Application role (cannot bypass RLS)
CREATE ROLE adprms_app WITH LOGIN PASSWORD '<secure>' NOSUPERUSER NOBYPASSRLS;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO adprms_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO adprms_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO adprms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO adprms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO adprms_app;
```

4. Environment variables configured:
```
DB_ENGINE=django.db.backends.postgresql
DB_NAME=adprms_dev
DB_USER=adprms_admin
DB_PASSWORD=<secure>
DB_HOST=localhost
DB_PORT=5432
```

5. Migrations applied: `python manage.py migrate`

## 3. RLS Isolation Tests (ADD-TC-002)

### Test 3.1: Owner A Cannot See Owner B Records

```sql
-- Connect as adprms_app
-- Set owner context to Owner A
SET LOCAL app.current_owner_id = '<owner_a_uuid>';

-- Insert a property for Owner A
INSERT INTO property (id, owner_party_id, code, name, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), '<owner_a_uuid>', 'RLS-TEST-A', 'RLS Owner A Property', true, NOW(), NOW());

-- Switch context to Owner B
SET LOCAL app.current_owner_id = '<owner_b_uuid>';

-- Attempt to read Owner A's property — MUST return 0 rows
SELECT count(*) FROM property WHERE code = 'RLS-TEST-A';
-- Expected: 0
```

**Pass criteria:** Query returns 0 rows.

### Test 3.2: Owner B Cannot Modify Owner A Records

```sql
-- Connect as adprms_app, context = Owner B
SET LOCAL app.current_owner_id = '<owner_b_uuid>';

-- Attempt to update Owner A's property — MUST affect 0 rows
UPDATE property SET name = 'TAMPERED' WHERE code = 'RLS-TEST-A';
-- Expected: 0 rows affected

-- Attempt to delete Owner A's property — MUST affect 0 rows
DELETE FROM property WHERE code = 'RLS-TEST-A';
-- Expected: 0 rows affected
```

**Pass criteria:** 0 rows affected for both UPDATE and DELETE.

### Test 3.3: INSERT Respects Owner Context

```sql
-- Connect as adprms_app, context = Owner A
SET LOCAL app.current_owner_id = '<owner_a_uuid>';

-- Attempt to insert a record with Owner B's ID — MUST fail
INSERT INTO property (id, owner_party_id, code, name, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), '<owner_b_uuid>', 'RLS-INJECT', 'Injection Attempt', true, NOW(), NOW());
-- Expected: ERROR (RLS WITH CHECK violation)
```

**Pass criteria:** INSERT raises a policy violation error.

### Test 3.4: RLS Applies to All 13 Owner-Scoped Tables

Repeat Tests 3.1–3.3 for each table listed in `core/migrations/0001_rls_policies.py`:
- property, building, floor, unit, unit_identifier_history
- property_ownership, configuration_entry, approval_request
- account_category, account, tax_category, tax_rule_version
- role_assignment

### Test 3.5: Audit Event RLS (NULL Owner Handling)

```sql
-- System-level audit events (owner_party_id = NULL) visible to all
SET LOCAL app.current_owner_id = '<owner_a_uuid>';
SELECT count(*) FROM audit_event WHERE owner_party_id IS NULL;
-- Expected: returns system-level events

-- Owner-scoped audit events filtered
SELECT count(*) FROM audit_event WHERE owner_party_id = '<owner_b_uuid>';
-- Expected: 0 (cannot see Owner B's audit events)
```

### Test 3.6: Application Role Cannot Bypass RLS

```sql
-- Verify adprms_app does NOT have BYPASSRLS
SELECT rolbypassrls FROM pg_roles WHERE rolname = 'adprms_app';
-- Expected: false
```

### Test 3.7: Transaction-Scoped Context (SET LOCAL)

```sql
-- Verify SET LOCAL is transaction-scoped (not connection-scoped)
BEGIN;
SET LOCAL app.current_owner_id = '<owner_a_uuid>';
SELECT current_setting('app.current_owner_id');
-- Expected: '<owner_a_uuid>'
COMMIT;

-- After COMMIT, the setting should be reset
SELECT current_setting('app.current_owner_id', true);
-- Expected: NULL or error
```

**Pass criteria:** Setting does not persist after COMMIT.

## 4. Audit Immutability Tests (ADD-AUD-003)

### Test 4.1: Application Role Cannot UPDATE Audit Events

```sql
-- Connect as adprms_app
UPDATE audit_event SET reason = 'TAMPERED' WHERE TRUE;
-- Expected: ERROR (permission denied)
```

### Test 4.2: Application Role Cannot DELETE Audit Events

```sql
-- Connect as adprms_app
DELETE FROM audit_event WHERE TRUE;
-- Expected: ERROR (permission denied)
```

### Test 4.3: Application Role Cannot TRUNCATE Audit Events

```sql
-- Connect as adprms_app
TRUNCATE audit_event;
-- Expected: ERROR (permission denied)
```

### Test 4.4: Application Role CAN INSERT Audit Events

```sql
-- Connect as adprms_app
INSERT INTO audit_event (id, event_time, actor_id, action, entity_type, entity_id)
VALUES (gen_random_uuid(), NOW(), '<user_uuid>', 'CREATE', 'test', gen_random_uuid());
-- Expected: SUCCESS
```

## 5. Maker-Checker Trigger Test (ADD-SEC-003)

### Test 5.1: Self-Approval Rejected by Trigger

```sql
-- Create an approval_request where requested_by = user_a
-- Then try to set decided_by = user_a on approval_step
-- Expected: ERROR from trg_prevent_self_approval trigger
```

### Test 5.2: Different Maker and Checker Allowed

```sql
-- Create an approval_request where requested_by = user_a
-- Set decided_by = user_b on approval_step
-- Expected: SUCCESS
```

## 6. Migration Verification

### Test 6.1: Full Migration Suite

```bash
python manage.py migrate --run-syncdb
python manage.py showmigrations
# Expected: all migrations marked [X]
```

### Test 6.2: Migration Reversibility

```bash
# Reverse the PostgreSQL-specific migrations
python manage.py migrate core 0002_audit_immutability --reverse
python manage.py migrate core 0001_rls_policies --reverse
python manage.py migrate core zero

# Re-apply
python manage.py migrate
```

## 7. Validation Record

| Test | Status | Date | Tester | Notes |
|------|--------|------|--------|-------|
| 3.1 Owner isolation (SELECT) | ⏳ PENDING | — | — | Requires PostgreSQL |
| 3.2 Owner isolation (UPDATE/DELETE) | ⏳ PENDING | — | — | Requires PostgreSQL |
| 3.3 INSERT respects context | ⏳ PENDING | — | — | Requires PostgreSQL |
| 3.4 All 13 tables validated | ⏳ PENDING | — | — | Requires PostgreSQL |
| 3.5 Audit RLS NULL handling | ⏳ PENDING | — | — | Requires PostgreSQL |
| 3.6 App role no BYPASSRLS | ⏳ PENDING | — | — | Requires PostgreSQL |
| 3.7 SET LOCAL is tx-scoped | ⏳ PENDING | — | — | Requires PostgreSQL |
| 4.1 Audit no UPDATE | ⏳ PENDING | — | — | Requires PostgreSQL |
| 4.2 Audit no DELETE | ⏳ PENDING | — | — | Requires PostgreSQL |
| 4.3 Audit no TRUNCATE | ⏳ PENDING | — | — | Requires PostgreSQL |
| 4.4 Audit INSERT allowed | ⏳ PENDING | — | — | Requires PostgreSQL |
| 5.1 Self-approval trigger | ⏳ PENDING | — | — | Requires PostgreSQL |
| 5.2 Valid approval trigger | ⏳ PENDING | — | — | Requires PostgreSQL |
| 6.1 Full migration suite | ⏳ PENDING | — | — | Requires PostgreSQL |
| 6.2 Migration reversibility | ⏳ PENDING | — | — | Requires PostgreSQL |

---

*No PostgreSQL-specific test result is claimed as PASSED until executed against a running PostgreSQL 16 instance. SQLite test results are reported separately and do not substitute for PostgreSQL verification.*
