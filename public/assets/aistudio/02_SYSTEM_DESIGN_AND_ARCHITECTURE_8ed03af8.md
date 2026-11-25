# AD-PRMS — System Design & Architecture
### For Business Stakeholders

---

## How the System Is Designed

AD-PRMS follows a **modular design** — the system is organised into clearly separated functional areas, each responsible for one part of the business. This makes the system easier to build, test, and maintain over time.

### The Nine Building Blocks

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    AD-PRMS SYSTEM MODULES                       │
│                                                                 │
│   ┌────────────┐  ┌────────────┐  ┌─────────────┐              │
│   │  IDENTITY  │  │   PARTIES  │  │ PROPERTIES  │              │
│   │            │  │            │  │             │              │
│   │ Users      │  │ Owners     │  │ Buildings   │              │
│   │ Roles      │  │ Entities   │  │ Floors      │              │
│   │ Passwords  │  │ Addresses  │  │ Rooms       │              │
│   │ Sessions   │  │ TINs       │  │ Unit history│              │
│   └─────┬──────┘  └─────┬──────┘  └──────┬──────┘              │
│         │               │                │                     │
│   ┌─────┴───────────────┴────────────────┴──────┐              │
│   │              CORE FOUNDATION                 │              │
│   │  Owner scoping • Effective dating • UUIDs    │              │
│   └──────────────────────┬───────────────────────┘              │
│                          │                                      │
│   ┌────────────┐  ┌──────┴──────┐  ┌─────────────┐             │
│   │ APPROVALS  │  │    AUDIT    │  │   CONFIG    │             │
│   │            │  │             │  │             │             │
│   │ Requests   │  │ Event log   │  │ Settings    │             │
│   │ Rules      │  │ Before/     │  │ Versions    │             │
│   │ Steps      │  │ after       │  │ History     │             │
│   │ Decisions  │  │ Immutable   │  │             │             │
│   └────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│   ┌────────────┐  ┌─────────────┐                               │
│   │ ACCOUNTING │  │     TAX     │                               │
│   │            │  │             │   ── Future ──                │
│   │ Chart of   │  │ Categories  │   Tenants, Leases,           │
│   │ accounts   │  │ Rates       │   Billing, Payments,         │
│   │ Categories │  │ Versions    │   Receipts, Reports          │
│   │ Lifecycle  │  │ Lifecycle   │                               │
│   └────────────┘  └─────────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### What Each Module Does

| Module | Business Purpose |
|--------|-----------------|
| **Identity** | Manages who can access the system. Each user has a username, password, and assigned roles. Passwords are encrypted. Sessions time out after 1 hour of inactivity. |
| **Parties** | Stores information about property owners and business entities. Changes to names, addresses, or TINs are versioned — the system remembers what the information was at any point in time. |
| **Properties** | Records the physical portfolio: which buildings belong to which owner, how many floors, what rooms exist, room numbering history. If a room is renumbered, the old number is preserved for historical reference. |
| **Approvals** | The two-person approval engine. Configurable rules define what actions need approval, who can approve, and how many approval steps are required. The system physically prevents someone from approving their own request. |
| **Audit** | The permanent, tamper-proof record of every action. Records who did what, when, before/after values, the reason, and supporting evidence. These records cannot be modified or deleted by anyone — including the System Administrator. |
| **Configuration** | Stores system settings (like currency, receipt prefixes, workflows) with full version history. Every configuration change records when it took effect and who made it. |
| **Accounting** | The chart of accounts — the financial structure of the business. Accounts go through a draft-to-active lifecycle: they must be approved before they can be used for financial recording. |
| **Tax** | Tax categories (VAT, WHT, stamp duty) and rate configurations. Like accounts, tax rules are drafted and versioned. They cannot be activated without approval from an authorised person. |
| **Core** | The invisible foundation that enforces rules across all modules: every record must belong to an owner, every change must be dated, every ID is unique. |

---

## Three Layers of Protection

The system protects the owner's data and financial integrity through three independent layers:

### Layer 1: The Application Rules

The software itself enforces business rules:
- Every record must have an owner
- Approval requests cannot be approved by the person who created them
- Audit records cannot be modified after creation
- Tax rules cannot be activated without going through approval

### Layer 2: The Database Rules

Even if the software has a bug, the database independently enforces:
- **Row-Level Security (RLS):** The database itself hides Owner A's data from Owner B's queries. This is not just a software filter — it's a physical barrier in the database engine.
- **Immutable audit table:** The database refuses UPDATE and DELETE commands on audit records, regardless of what the software requests.
- **Self-approval trigger:** The database rejects any attempt to record the same person as both maker and checker.

### Layer 3: The Operational Rules

- The System Administrator role cannot approve its own privilege changes
- Production data loading requires evidence and owner sign-off
- Tax activation requires professional sign-off
- Critical configuration changes require two-person approval

```
┌──────────────────────────────────────────────────┐
│                 PROTECTION LAYERS                 │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │  Layer 3: OPERATIONAL RULES              │   │
│   │  Policies, procedures, evidence          │   │
│   │  ┌──────────────────────────────────┐    │   │
│   │  │  Layer 2: DATABASE RULES         │    │   │
│   │  │  RLS, REVOKE, triggers           │    │   │
│   │  │  ┌──────────────────────────┐    │    │   │
│   │  │  │  Layer 1: APPLICATION    │    │    │   │
│   │  │  │  Validation, mixins      │    │    │   │
│   │  │  │                          │    │    │   │
│   │  │  │     YOUR DATA            │    │    │   │
│   │  │  │                          │    │    │   │
│   │  │  └──────────────────────────┘    │    │   │
│   │  └──────────────────────────────────┘    │   │
│   └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## How Data Changes Are Handled

AD-PRMS never overwrites data. Instead, it keeps a complete history:

### Example: A Room Is Renumbered

```
BEFORE                          AFTER
─────────                       ─────────

Room R-101                      Room R-201
  on Floor 1                      on Floor 2
  Building Alpha                  Building Alpha

The system records:
  ✓ Old number: R-101
  ✓ New number: R-201
  ✓ Date of change: 15 March 2027
  ✓ Reason: "Floor reassignment after renovation"
  ✓ Changed by: Property Clerk — Tadesse Bekele
  ✓ Evidence: Approval #A-0032

If someone searches for "R-101" — the system finds it
in history and shows the current number is R-201.
Old receipts and leases that reference R-101 still work.
```

### Example: A Tax Rate Changes

```
Version 1 (RETIRED)              Version 2 (ACTIVE)
───────────────────              ──────────────────
VAT: 15%                         VAT: 15%
Effective: 1 Jan 2020            Effective: 1 Jul 2027
Expired: 30 Jun 2027             Expires: —
Approved by: Finance Director    Approved by: Finance Director

Historical invoices from 2025 still calculate at 15%.
Future invoices from August 2027 also use 15%.
If the rate had changed, each period uses the rate
that was active at the time — automatically.
```

---

## Technology Choices — In Plain Language

| Question | Answer |
|----------|--------|
| **What programming language?** | Python — widely used, well-supported, large talent pool |
| **What framework?** | Django — the standard framework for business applications in Python. Handles users, security, databases, and administration out of the box. |
| **What database?** | PostgreSQL — the most reliable open-source database. Used by banks, governments, and enterprises worldwide. Provides the row-level security that protects owner data. |
| **What do users see?** | A web interface accessed through a standard browser (Chrome, Edge, Firefox). No special software needs to be installed on staff computers. |
| **Where does it run?** | On a server in your office, connected to your office network. No cloud, no internet required. |
| **Is it secure?** | Encrypted passwords, session timeouts, role-based access, two-person approvals, tamper-proof audit trail, database-level data isolation. |
| **Can it be backed up?** | Automated daily backups, encrypted, with quarterly restore testing. |
| **Can it grow?** | Designed for ~100 units initially, scalable to 1,000+ units. New owners and properties can be added through configuration. |

---

## What Makes This System Different

| Feature | Typical Software | AD-PRMS |
|---------|-----------------|---------|
| Data ownership | One shared database | Strict per-owner isolation at database level |
| Audit trail | Basic "last modified" field | Complete before/after record of every change, permanently |
| Approvals | Optional workflows | Enforced by both software and database — cannot be bypassed |
| Tax handling | Fixed rates in settings | Versioned, draft-to-active lifecycle with professional sign-off gate |
| Configuration | Hard-coded for one business | Fully configurable for any property business |
| Deployment | Cloud/internet required | Runs on your own server, your own network, your own data |
| History | Current values only | Full temporal history — reconstruct any record as of any past date |

---

*This document explains the system design in business terms. For technical architecture details, see `02_IMPLEMENTATION/docs/ADR-001` through `ADR-003`.*
