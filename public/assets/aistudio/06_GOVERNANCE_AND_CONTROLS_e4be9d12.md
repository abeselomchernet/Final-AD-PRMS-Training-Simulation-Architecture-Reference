# AD-PRMS — Governance, Controls & Security Framework
### How the System Protects Your Business

---

## Why Governance Matters

Managing rental properties involves handling money, legal agreements, tax obligations, and personal information. A single mistake — an incorrect tax rate, an unapproved ownership change, or a lost financial record — can have serious legal and financial consequences.

AD-PRMS is built with **governance at its foundation**, not added as an afterthought. Every control described below is enforced by the system itself, not by trusting people to follow procedures manually.

---

## The Three Lines of Defence

```
┌─────────────────────────────────────────────────────────────────┐
│                    AD-PRMS PROTECTION MODEL                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LINE 1: APPLICATION CONTROLS                                   │
│  ├── Who can log in                                             │
│  ├── What each person can see and do (roles & permissions)      │
│  ├── Maker-checker approval workflows                           │
│  └── Input validation and business rules                        │
│                                                                 │
│  LINE 2: DATABASE CONTROLS                                      │
│  ├── Row-Level Security (invisible data walls per owner)        │
│  ├── Immutable audit log (no one can edit or delete history)    │
│  ├── Self-approval block (enforced by database rule)            │
│  └── Constraint checks (data integrity enforced by database)    │
│                                                                 │
│  LINE 3: OPERATIONAL CONTROLS                                   │
│  ├── Backups and recovery procedures                            │
│  ├── Privileged access restrictions and logging                 │
│  └── Evidence-based change management                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

If the application has a bug, the database still enforces the rules.
If someone bypasses the application, the database still blocks them.
If the database is accessed directly, the audit trail still records what happened.

---

## 1. Who Can Do What — Role-Based Access Control

### How It Works

Instead of giving each person individual permissions, the system uses **roles**. A role is a named set of permissions — like a job description for system access.

| Role Example | Typical Permissions | Cannot Do |
|-------------|-------------------|-----------|
| **Property Manager** | Add/edit properties, register rooms, update unit status | Change tax rates, approve financial configs, access other owners' data |
| **Accountant** | View financial records, prepare reports, propose chart-of-accounts changes | Approve their own proposals, modify audit records, manage user accounts |
| **System Administrator** | Create user accounts, assign roles, manage system configuration | Self-approve sensitive changes, modify audit trail, bypass maker-checker |
| **Owner / Director** | Review and approve critical changes, view all reports for their properties | Access other owners' data, delete audit history |

### Key Principles

- **Least Privilege:** Each person gets only the permissions they need — nothing more.
- **No Super-User:** There is no role that can do everything without oversight. Even the System Administrator has restrictions.
- **Owner Boundary:** No role, no matter how privileged, can cross the boundary between owners. Owner A's administrator cannot see Owner B's data.

---

## 2. Maker-Checker Approval Process

### What Requires Approval?

Not every action needs a second person's approval. Routine tasks — like viewing a property list or printing a report — do not. But **sensitive changes** require the maker-checker process:

| Change Category | Examples | Why Approval Is Needed |
|----------------|----------|----------------------|
| **Financial Configuration** | New chart-of-accounts entry, account reclassification | Affects how all financial transactions are categorised |
| **Tax Rate Changes** | New tax rate, rate modification, rate deactivation | Directly affects tax calculations and legal compliance |
| **Ownership Changes** | Transfer of property ownership, new owner registration | Changes who controls assets and receives income |
| **User Access Changes** | New user account, role assignment, permission elevation | Controls who can access and modify business data |
| **Audit Configuration** | Changes to what gets audited and how | Affects the integrity of the entire compliance system |

### How It Works — Step by Step

```
  MAKER                                  CHECKER
  ─────                                  ───────

  1. Creates a change request         
     ├── Describes what and why        
     ├── Attaches evidence             
     └── Selects approval type         
                    │
                    ▼
            ┌──────────────┐
            │  PENDING      │ ──── System blocks the
            │  APPROVAL     │      maker from also
            └──────┬───────┘      being the checker
                    │
                    ▼
                                  2. Reviews the request
                                     ├── Checks evidence
                                     ├── Verifies correctness
                                     └── Decides:
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                         APPROVED     REJECTED    RETURNED
                         (activates   (blocked,   (sent back
                          change)     with        for more
                                      reason)     information)
```

### System-Enforced Rules

These are not guidelines — they are hard rules enforced by the system:

| Rule | How It Is Enforced |
|------|-------------------|
| **No self-approval** | The system checks that the checker is a different person from the maker. This check exists in both the application AND the database, so it cannot be bypassed by either layer alone. |
| **Evidence required** | Certain approval types require an evidence reference (document, government notice, board resolution) before submission. |
| **Approval expires** | Pending approvals that are not acted upon within a defined period expire automatically. |
| **Full audit trail** | Every approval action — submission, review, approval, rejection, return — is recorded permanently. |
| **No retroactive changes** | Once an approval is granted or denied, the decision record cannot be modified. |

---

## 3. Owner Data Isolation

### The Problem This Solves

If AD-PRMS manages properties for more than one owner, it is **critical** that:
- Owner A cannot see Owner B's properties, tenants, financial records, or reports.
- A bug in one owner's workflow cannot accidentally affect another owner's data.
- A staff member working on Owner A's properties cannot browse Owner B's information.

### How Isolation Works

**Layer 1 — Application Level:**
Every query the application makes automatically includes the current owner's identity. The application never asks the database "show me all properties" — it always asks "show me all properties belonging to Owner X."

**Layer 2 — Database Level (Row-Level Security):**
Even if the application has a bug, the database has its own independent check. Each database session is tagged with the current owner, and PostgreSQL's Row-Level Security automatically filters every query. A query that accidentally omits the owner filter still returns only the correct owner's data.

**Layer 3 — Record Level:**
Every record that belongs to an owner has a mandatory owner identifier field. This field cannot be empty (NULL) and cannot be changed after creation. It is physically impossible to create an "orphaned" record that doesn't belong to any owner.

```
  ┌────────────────────┐    ┌────────────────────┐
  │    OWNER A'S       │    │    OWNER B'S        │
  │    DATA SPACE      │    │    DATA SPACE       │
  │                    │    │                     │
  │  Properties ■      │    │  Properties ■       │
  │  Tenants    ■      │    │  Tenants    ■       │
  │  Finances   ■      │    │  Finances   ■       │
  │  Audit Log  ■      │    │  Audit Log  ■       │
  │                    │    │                     │
  │  ══════════════    │    │  ══════════════     │
  │  RLS BOUNDARY      │    │  RLS BOUNDARY       │
  │  (Database-level)  │    │  (Database-level)   │
  └────────────────────┘    └────────────────────┘
          ▲                          ▲
          │  CANNOT CROSS            │
          └──────────────────────────┘
```

---

## 4. The Audit Trail — Your Permanent Record

### What Gets Recorded

Every significant action in the system creates a permanent audit entry:

| Information Captured | Example |
|---------------------|---------|
| **Who** (actor) | "Accountant Meron (user ID: ...)" |
| **What** (action) | "Changed tax rate for category: Rental Income Tax" |
| **When** (timestamp) | "2026-11-12 14:35:22 UTC" |
| **Why** (reason) | "Government gazette ref. GZ-2026-1234 effective Jan 1, 2027" |
| **Before** (old value) | "Rate: 15%" |
| **After** (new value) | "Rate: 17.5%" |
| **Which owner** | "Owner: Abdulwehab Dekebo (SYNTH-OWNER-001)" |
| **Which property** | "Property: Commercial Building Alpha" (if applicable) |
| **Linked approval** | "Approval Request #AR-2026-0045 — approved by Director Yonas" |
| **Evidence** | "Reference: Government Gazette GZ-2026-1234" |

### What Makes the Audit Trail Trustworthy

| Protection | How It Works |
|-----------|-------------|
| **Append-only** | New entries can be added, but existing entries can never be changed or deleted — even by system administrators. |
| **Database-enforced** | The "no update, no delete" rule is enforced by a database trigger, not just application code. Even if someone accesses the database directly, they cannot modify audit records. |
| **Tamper-evident** | If any attempt is made to alter audit records through an unexpected path, the database trigger blocks it and logs the attempt. |
| **Complete history** | Before and after values are captured for every change, allowing full reconstruction of any record's history from creation to present. |
| **Independent from application** | The audit log works at the database level. Even if the application is replaced or upgraded, the existing audit history remains intact and unmodifiable. |

### Who Can View Audit Records?

- **Owners** can view audit records for their own properties and data.
- **Auditors** (when the role is implemented) can view audit records but cannot modify them.
- **System Administrators** can view audit records for system-level events but cannot modify any audit records.
- **No one** can delete, edit, or backdate audit entries.

---

## 5. Data Integrity Principles

### Effective Dating — Nothing Is Ever "Deleted"

AD-PRMS follows a principle called **non-destructive history**. When something changes, the old record is kept and a new record is created with the new effective date.

**Example — A Tax Rate Change:**

| Version | Rate | Effective From | Effective To | Status |
|---------|------|---------------|-------------|--------|
| v1 | 15% | 01-Jan-2025 | 31-Dec-2026 | Historical |
| v2 | 17.5% | 01-Jan-2027 | (ongoing) | Active |

Both versions remain in the system permanently. If you need to know what tax rate applied to a transaction in June 2026, the system gives you the correct answer: 15%.

### UUID Identifiers — Unpredictable and Unique

Every record in the system uses a UUID (a long random code) as its identifier, rather than sequential numbers like 1, 2, 3. This means:

- **No guessing:** You cannot guess another record's ID by incrementing a number.
- **No conflicts:** Even if data from two separate installations were merged, there would be no ID collisions.
- **Security by design:** Sequential IDs can reveal information (e.g., "there are 47 tenants"). UUIDs reveal nothing.

---

## 6. System Administrator — Powers and Restrictions

The System Administrator role deserves special attention because it has significant responsibilities but also significant restrictions.

### What the System Administrator CAN Do

- Create and manage user accounts
- Assign and revoke roles
- Configure system settings (non-financial)
- Run database maintenance operations
- Monitor system health and performance
- Manage backups (when implemented)

### What the System Administrator CANNOT Do

| Restriction | Reason |
|------------|--------|
| Self-approve any sensitive change | Prevents a single person from making and approving critical changes |
| Modify or delete audit records | Preserves the integrity of the compliance trail |
| Access other owners' data without authorisation | Owner isolation applies to administrators too |
| Activate tax rates or financial configurations alone | Requires maker-checker approval by an authorised business user |
| Grant themselves business-approval authority | Administrative and business-approval roles are separated |
| Bypass Row-Level Security | RLS is enforced at the database level, below the application |

### Why These Restrictions Exist

In many systems, the administrator is an all-powerful "super-user" who can do anything. AD-PRMS deliberately rejects this model because:

1. A single compromised account should not be able to cause catastrophic damage.
2. Financial controls require separation of duties — the person maintaining the system should not also control financial configuration.
3. The audit trail must be trustworthy even to the people being audited, including system administrators.

---

## 7. Change Management — How System Changes Are Controlled

### Project Changes

Every phase of the AD-PRMS project follows this process:

```
  Requirements    →    Owner        →    Work Package    →    Implementation
  Document              Review            Authorisation         & Testing
       │                   │                   │                    │
       └───────────────────┴───────────────────┴────────────────────┘
                    Full traceability chain maintained
```

- No work begins without documented authorisation.
- Every decision is recorded in the approval log.
- Deferred decisions are tracked and revisited at the appropriate time.
- The owner approves the technology choices, not just the business requirements.

### Configuration Changes (In Production)

Once the system is live, configuration changes (tax rates, account structures, approval rules) will follow the maker-checker process described in Section 2 above. This ensures that:

- No one person can unilaterally change how the system calculates taxes, categorises finances, or controls access.
- Every change is documented with a reason and evidence.
- Changes can be audited at any time.

---

## 8. Current Governance Status

| Control | Design Status | Runtime Status |
|---------|:------------:|:--------------:|
| Role-Based Access Control (RBAC) | ✅ Designed & modelled | ⏳ Awaiting user interface |
| Maker-Checker Approval | ✅ Designed & modelled | ⏳ Awaiting workflows |
| Self-Approval Block | ✅ Database constraint ready | ⏳ Awaiting PostgreSQL testing |
| Row-Level Security (RLS) | ✅ Migration definitions ready | ⏳ Awaiting PostgreSQL testing |
| Immutable Audit Log | ✅ Model & triggers ready | ⏳ Awaiting PostgreSQL testing |
| Owner Isolation | ✅ Mandatory fields & constraints | ⏳ Awaiting integration tests |
| UUID Primary Keys | ✅ Active on all models | ✅ Verified |
| Effective Dating | ✅ Active on relevant models | ✅ Verified |
| Non-Destructive History | ✅ Active on relevant models | ✅ Verified |
| Evidence-Based Approvals | ✅ Model supports evidence refs | ⏳ Awaiting workflows |

> **Note:** "Awaiting PostgreSQL testing" means the design and database migration code are written and ready, but cannot be fully verified until a PostgreSQL database server is installed. This is planned as part of the next project phase.

---

*Document created: November 2026*
*Part of the AD-PRMS Project Overview series*
*For questions about the governance framework, contact the project team.*
