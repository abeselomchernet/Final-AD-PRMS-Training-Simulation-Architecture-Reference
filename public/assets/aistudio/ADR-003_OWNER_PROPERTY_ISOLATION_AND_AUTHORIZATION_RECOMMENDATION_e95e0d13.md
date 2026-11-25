# ADR-003: Owner/Property Isolation and Authorization Recommendation

**Status:** PROPOSED — Requires owner acknowledgment  
**Date:** 12 November 2026  
**Decision Owner:** Implementation Lead (technical defaults) / Property Owner (policy decisions)  
**Source:** C-10, C-11, C-12; Authorization Brief §4, §8, §9; Requirements Addendum ADD-OWN, ADD-SEC, ADD-AUD; Technical Design Addendum §§4, 5, 6, 7, 8

---

## 1. Context

The non-negotiable ownership model requires that every property, financial transaction, and report is attributed to a registered property owner, and that one owner's data is invisible to another owner's views. This ADR defines the recommended technical control patterns to implement these requirements.

## 2. Scope of Controls

This ADR covers eight control domains:

1. Mandatory owner and property attribution
2. Cross-owner data isolation
3. Configurable roles (RBAC)
4. System Administrator restrictions
5. Maker-checker workflow
6. Effective-dated configuration
7. Audit-event immutability
8. Consolidated reporting (approved-only)

---

## 3. Mandatory Owner and Property Attribution

### Requirement
Every property, unit, lease, invoice, receipt, payment allocation, deposit, expense, payable, journal entry, and owner report MUST carry the registered property owner as a mandatory, non-nullable dimension (ADD-OWN-001; C-10).

### Recommended Pattern

```
┌─────────────────────────────────────────────┐
│          ALL FINANCIAL TABLES               │
│                                             │
│  owner_party_id  UUID NOT NULL FK → party   │
│  building_id     UUID NOT NULL FK → building│
│  unit_id         UUID     NULL FK → unit    │
│                                             │
│  CHECK (owner_party_id IS NOT NULL)         │
│  FK (building.owner_party_id = owner_party) │
└─────────────────────────────────────────────┘
```

**Implementation:**
- Every model that represents a financial or operational record includes an `owner_party_id` foreign key.
- Database-level `NOT NULL` constraint ensures no record can exist without an owner.
- Application-level validation rejects any transaction submission without owner attribution.
- Django model mixin (`OwnerScopedMixin`) provides the field and validation on all relevant models.
- `building.owner_party_id` must match the owner on related transactions (referential integrity).

### Risk if not implemented
Financial records could be created without owner attribution, making owner-scoped reporting inaccurate and violating the non-negotiable ownership model.

---

## 4. Cross-Owner Data Isolation

### Requirement
Records belonging to one owner MUST NOT be visible in another owner's operational or financial views (ADD-OWN-006; C-10, C-12).

### Recommended Pattern: PostgreSQL Row-Level Security (RLS)

**Layer 1 — Database (defense-in-depth):**
```sql
-- Enable RLS on all owner-scoped tables
ALTER TABLE lease ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see rows matching their session owner scope
CREATE POLICY owner_isolation ON lease
    USING (owner_party_id = current_setting('app.current_owner_id')::uuid);

-- Application sets session variable on each request
SET app.current_owner_id = '<owner_uuid>';
```

**Layer 2 — Application (business logic):**
```python
# Django middleware sets PostgreSQL session variable from authenticated user's owner scope
class OwnerScopeMiddleware:
    def __call__(self, request):
        if request.user.is_authenticated:
            owner_id = request.user.profile.active_owner_id
            with connection.cursor() as cursor:
                cursor.execute("SET app.current_owner_id = %s", [str(owner_id)])
        return self.get_response(request)
```

**Layer 3 — Testing (verification):**
- ADD-TC-002: Create records for two owners; verify complete isolation in all views, reports, and API responses.
- Attempt to bypass RLS via raw SQL; verify denial.

### Alternative
Application-only filtering (filter all querysets by `owner_party_id`). **Not recommended** — a single missed filter clause exposes cross-owner data.

### Risk if not implemented
A single application bug could expose one owner's financial data to another owner, violating the non-negotiable ownership model and potentially creating legal liability.

---

## 5. Configurable Roles (RBAC)

### Requirement
The system MUST implement configurable RBAC with 11 initial proposed roles (ADD-SEC-001, ADD-SEC-002; C-17).

### Recommended Pattern: Django Groups + Custom Permissions

```
┌───────────────────────────────────────────┐
│            RBAC MODEL                     │
│                                           │
│  User ──M:N──> Role (Django Group)        │
│  Role ──M:N──> Permission                 │
│  Permission = app.action (e.g.,           │
│    lease.create, journal.approve,         │
│    tax_rule.activate, owner.change)       │
│                                           │
│  Role definitions stored in DB            │
│  (not hard-coded)                         │
│  Effective-dated role assignments         │
└───────────────────────────────────────────┘
```

**Implementation:**
- Django's built-in `Group` model represents roles.
- Custom `Permission` objects represent fine-grained actions.
- Role definitions are stored in the database and configurable via setup workflows (ADD-PLT-002).
- Role assignment changes are audited with before/after values (ADD-SEC-005).
- Initial 11 roles are created through setup workflow, not hard-coded (ADD-PLT-002).
- Production role activation gated by D-006.

---

## 6. System Administrator Restrictions

### Requirement
System Administrator MUST NOT approve their own privileged access, post financial adjustments, approve tax activation, or bypass audit logging (ADD-SEC-003).

### Recommended Pattern: Explicit Prohibition Rules

```python
# Approval validation
class ApprovalService:
    def approve(self, approval_id, approver):
        approval = Approval.objects.get(id=approval_id)

        # Rule 1: Maker cannot be checker
        if approval.requested_by == approver:
            raise PermissionDenied("Self-approval is prohibited")

        # Rule 2: System Admin cannot approve privileged operations
        if approver.has_role('system_administrator'):
            if approval.entity_type in PRIVILEGED_ENTITY_TYPES:
                raise PermissionDenied(
                    "System Administrator cannot approve privileged operations"
                )

        # Rule 3: Audit log is always written (no bypass)
        AuditEvent.objects.create(...)  # Append-only; no suppress option
```

**Privileged operations requiring business-approver maker-checker:**
- Role assignment and privilege escalation
- Financial configuration activation
- Tax rule activation
- Property-owner changes
- Approval-threshold changes
- Accounting period close/reopen

---

## 7. Maker-Checker Workflow

### Requirement
Privileged operations MUST require maker-checker approval (ADD-SEC-004; SRS §7.1).

### Recommended Pattern: Generic Approval Workflow Engine

```
┌────────────────────────────────────────────────────────┐
│              APPROVAL WORKFLOW ENGINE                   │
│                                                        │
│  approval_rule:                                        │
│    entity_type, action, threshold_amount,              │
│    required_approver_roles[], step_count               │
│                                                        │
│  approval:                                             │
│    entity_type, entity_id, step,                       │
│    requested_by, approver_id,                          │
│    decision (PENDING/APPROVED/REJECTED/RETURNED),      │
│    threshold_rule_id, reason, decided_at               │
│                                                        │
│  CONSTRAINTS:                                          │
│    requested_by ≠ approver_id  (DB CHECK)              │
│    approver must hold required role                    │
│    all steps must be APPROVED before activation        │
└────────────────────────────────────────────────────────┘
```

**Configurable aspects (via setup workflow, not hard-coded):**
- Which entity types and actions require approval
- Approval threshold amounts (e.g., expenses > ETB 25,000 require dual authorization)
- Required approver roles for each step
- Number of approval steps
- Delegation rules (time-limited, auditable)

**Database enforcement:**
```sql
ALTER TABLE approval ADD CONSTRAINT maker_neq_checker
    CHECK (requested_by != approver_id);
```

---

## 8. Effective-Dated Configuration

### Requirement
All master-data and configuration records MUST use effective-dated records preserving full history (ADD-AUD-004).

### Recommended Pattern: Temporal Columns

```sql
-- Every master-data table includes:
valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
valid_to        DATE NULL,    -- NULL = currently active
change_reason   TEXT NOT NULL,
changed_by      UUID NOT NULL REFERENCES user_account(user_id),
evidence_ref    VARCHAR(255), -- reference to supporting document
supersedes_id   UUID NULL,    -- previous version of this record

-- Current-state query:
SELECT * FROM tax_rule
WHERE valid_from <= CURRENT_DATE
  AND (valid_to IS NULL OR valid_to > CURRENT_DATE);

-- As-of-date query (historical):
SELECT * FROM tax_rule
WHERE valid_from <= '2026-06-30'
  AND (valid_to IS NULL OR valid_to > '2026-06-30');
```

**Entities requiring effective dating:**
- Owner/entity records (ADD-OWN-013)
- Property/building records (ADD-OWN-014)
- Unit/room identifiers with alias history (ADD-PRP-002)
- Chart of accounts with successor chain (ADD-FIN-003)
- Tax rule versions with lifecycle states (ADD-TAX-001)
- Role/permission assignments (ADD-SEC-005)
- Lease versions (SRS LSE-007)

---

## 9. Audit-Event Immutability

### Requirement
Audit log entries MUST NOT be editable, deletable, or suppressible — including by the System Administrator (ADD-AUD-003).

### Recommended Pattern: Append-Only Table with Database Enforcement

```sql
-- Audit event table
CREATE TABLE audit_event (
    audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id   UUID NOT NULL REFERENCES user_account(user_id),
    action          VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(100) NOT NULL,
    entity_id       UUID NOT NULL,
    before_value    JSONB,
    after_value     JSONB,
    reason          TEXT,
    evidence_ref    VARCHAR(255),
    approval_id     UUID REFERENCES approval(approval_id),
    workstation     VARCHAR(100),
    session_id      UUID
);

-- IMMUTABILITY ENFORCEMENT
REVOKE UPDATE, DELETE ON audit_event FROM app_role;
REVOKE TRUNCATE ON audit_event FROM app_role;

-- Only INSERT is permitted
GRANT INSERT ON audit_event TO app_role;
GRANT SELECT ON audit_event TO app_role;
```

**Additional protections:**
- No API endpoint for updating or deleting audit records.
- Application code has no method for modifying audit records.
- Django model: `class Meta: managed = True` but no `save()` override allows updates.
- Database triggers on all financial tables automatically log changes (dual-layer per ADR-001 §8).
- Optional: periodic hash-chain verification for tamper detection.

---

## 10. Consolidated Reporting (Approved-Only)

### Requirement
Cross-owner consolidated reporting MUST NOT be available by default. It may be enabled only with explicit owner approval (ADD-OWN-006; Authorization Brief §6.2).

### Recommended Pattern: Reporting-Scope Configuration

```
┌──────────────────────────────────────────────┐
│         REPORTING SCOPE TABLE                │
│                                              │
│  scope_id, scope_name, scope_type,           │
│  owner_ids[], approved_by, approved_at,      │
│  status (DRAFT / APPROVED / ACTIVE)          │
│                                              │
│  Default: one scope per owner (single-owner  │
│           views only)                        │
│                                              │
│  Consolidated scope: requires owner approval │
│  before activation                           │
└──────────────────────────────────────────────┘
```

**Implementation:**
- Reports accept a `reporting_scope_id` parameter.
- Default scopes show only single-owner data.
- A consolidated scope (spanning multiple owners) can be created but requires owner approval before activation.
- RLS policies are temporarily elevated for consolidated reports via a separate database role with explicit scope.
- This capability is **not developed in Release 1** unless the owner requests it; the design provision is made now to avoid future schema changes.

---

## 11. Summary of Control Patterns

| Control Domain | Pattern | Enforcement Layer | Status |
|----------------|---------|-------------------|--------|
| Owner attribution | NOT NULL FK + mixin | Database + Application | PROPOSED |
| Data isolation | PostgreSQL RLS | Database (defense-in-depth) | PROPOSED |
| RBAC | Django Groups + Permissions | Application + Database | PROPOSED |
| Admin restrictions | Explicit prohibition rules | Application + Database CHECK | PROPOSED |
| Maker-checker | Generic approval engine | Application + Database CHECK | PROPOSED |
| Effective dating | Temporal columns (valid_from/to) | Database + Application queries | PROPOSED |
| Audit immutability | Append-only table + REVOKE UPDATE/DELETE | Database (enforced) | PROPOSED |
| Consolidated reporting | Reporting-scope config (not active) | Application + RLS elevation | Design provision only |

---

## 12. Decisions Requiring Owner Input

| # | Decision | Default | Owner Action Needed |
|---|----------|---------|---------------------|
| 1 | RLS for data isolation | Recommended (defense-in-depth) | Acknowledge or override |
| 2 | Dual-layer audit (triggers + app) | Recommended | Acknowledge or override |
| 3 | Consolidated reporting provision | Design only; not active | Confirm exclusion from Release 1 |

All other patterns in this ADR are **low-risk technical defaults** that implement confirmed owner instructions (C-10, C-12, C-17, C-18) and approved requirements. They do not require explicit owner approval but are documented transparently per the Opus recommendation discipline (Authorization Brief §11).

---

*This ADR is a RECOMMENDATION. All patterns use synthetic data only during Phase 1 development. Production activation of RBAC (D-006, D-015), property data (D-002, D-003), and financial data (D-005) remains gated.*
