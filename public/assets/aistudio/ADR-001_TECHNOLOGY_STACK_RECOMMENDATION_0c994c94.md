# ADR-001: Technology Stack Recommendation

**Status:** PROPOSED — Requires owner approval before dependencies are installed  
**Date:** 12 November 2026  
**Decision Owner:** Property Owner (Abdulwehab Dekebo) + Implementation Lead  
**Source:** SRS v1.1 §12; Technical Design v1.0 §4; Authorization Brief §10; Requirements Addendum ADD-PLT-001–011

---

## 1. Context

The AD-PRMS system requires a technology stack that supports:

- Local-first deployment on an office LAN (Windows-based development and deployment environment)
- Multi-owner property management with strict data isolation
- Double-entry accounting with mandatory owner/property dimensions
- Configurable RBAC with maker-checker workflows
- Immutable audit logging with before/after values
- Effective-dated master data and configuration versioning
- Reusable platform with no hard-coded business data
- ~10 concurrent users, ~100 units initially, scalable to 1,000 units

The SRS v1.1 §12 suggests Linux/PostgreSQL/Django/Nginx. The Technical Design v1.0 proposes a Modular Monolith pattern. This ADR evaluates the SRS baseline against the current deployment environment (Windows) and the addendum requirements, and recommends a stack for owner approval.

---

## 2. Backend Framework

### Preferred: Python / Django 5.x

| Aspect | Detail |
|--------|--------|
| **Recommendation** | Django 5.x with Django REST Framework for API layer |
| **Rationale** | Django is the SRS v1.1 baseline recommendation. It provides built-in ORM with PostgreSQL support, authentication, session management, admin interface, migration framework, and a mature ecosystem. Excellent fit for data-heavy administrative applications. Runs natively on Windows for development; can deploy on Windows or Linux. |
| **Compatibility** | Directly aligned with SRS v1.1 §12.2 and Technical Design v1.0 §4.1 |
| **Trade-offs** | Django's ORM may require raw SQL for advanced PostgreSQL features (RLS, temporal queries). The monolithic structure matches the approved Modular Monolith pattern. |
| **Risks** | Django's synchronous request model may limit future real-time features; mitigated by Django Channels if needed later. |
| **Deployment** | `pip install` on Windows or Linux; runs via `manage.py runserver` for development, Waitress/Gunicorn + reverse proxy for production. |

### Alternative A: Python / FastAPI

| Aspect | Detail |
|--------|--------|
| **Description** | Modern async Python framework with automatic API documentation |
| **Trade-offs** | Faster API performance; no built-in ORM, admin, or migration framework — requires assembling these separately (SQLAlchemy, Alembic, etc.). More development effort for equivalent functionality. |
| **Risk** | Higher assembly complexity; less community precedent for admin-heavy accounting applications. |
| **When to prefer** | If future real-time/webhook requirements become primary; if the team has strong FastAPI experience. |

### Alternative B: C# / ASP.NET Core 8

| Aspect | Detail |
|--------|--------|
| **Description** | Microsoft's cross-platform web framework; native Windows development experience |
| **Trade-offs** | Excellent Windows deployment story and tooling. Strong typing catches errors at compile time. Entity Framework Core provides a capable ORM. Larger runtime footprint. Less aligned with SRS baseline. |
| **Risk** | Diverges from SRS v1.1 recommendation; may require re-evaluation of all SRS technical assumptions. |
| **When to prefer** | If the deployment team has strong .NET experience; if Windows Server is the confirmed production OS. |

### Decision required from owner
Confirm Django as the backend framework, or select an alternative. This decision gates all subsequent development.

---

## 3. Database Engine

### Preferred: PostgreSQL 16

| Aspect | Detail |
|--------|--------|
| **Recommendation** | PostgreSQL 16 (latest stable) |
| **Rationale** | PostgreSQL is the SRS v1.1 and Technical Design v1.0 baseline. It provides Row-Level Security (RLS) critical for owner/property data isolation (ADR-003), JSONB for audit event storage, NUMERIC(18,2) for exact currency arithmetic, ACID transactions, CHECK constraints, exclusion constraints (for lease overlap prevention), and full-text search. Runs on Windows and Linux. |
| **Compatibility** | Directly aligned with SRS v1.1 §12.2, Technical Design v1.0 §4.2 |
| **Trade-offs** | Requires separate installation and management (vs. embedded databases). Well worth it for RLS, constraints, and financial-grade data integrity. |
| **Risks** | Minimal — PostgreSQL is the industry standard for applications with these requirements. |
| **Deployment** | Windows installer available; runs as a Windows service. |

### Alternative A: SQLite

| Aspect | Detail |
|--------|--------|
| **Description** | Embedded file-based database; zero configuration |
| **Trade-offs** | Simpler deployment; no RLS support; limited concurrent write performance; no CHECK constraint enforcement in older versions; no exclusion constraints. |
| **Risk** | Cannot implement Row-Level Security for owner isolation; cannot enforce lease overlap prevention at database level. **Not recommended for production.** |
| **When to prefer** | Development/testing portability only; not for production deployment. |

### Alternative B: Microsoft SQL Server Express

| Aspect | Detail |
|--------|--------|
| **Description** | Microsoft's relational database; native Windows integration |
| **Trade-offs** | Row-Level Security supported. Native Windows service. 10 GB database size limit on Express edition. Less aligned with SRS baseline. Different SQL dialect requires rewriting all queries/migrations. |
| **Risk** | Size limit may be reached with 10 years of financial data; licensing complexity for non-Express editions. |
| **When to prefer** | If the deployment environment mandates Microsoft-only infrastructure. |

### Decision required from owner
Confirm PostgreSQL as the database engine. This is strongly recommended and aligned with all governing documents.

---

## 4. Database Migrations

### Preferred: Django Migrations (built-in)

| Aspect | Detail |
|--------|--------|
| **Recommendation** | Django's built-in migration framework |
| **Rationale** | Automatically generates migrations from model changes. Tracks migration state. Supports forward and backward migrations. Integrates with Django ORM. Version-controlled alongside application code. |
| **Compatibility** | Standard Django practice; no additional tooling required. |
| **Trade-offs** | Tied to Django ORM; complex migrations may require manual SQL. |

### Alternative: Alembic (if FastAPI is selected)

| Aspect | Detail |
|--------|--------|
| **Description** | SQLAlchemy's migration tool; required if Django is not selected |
| **When to prefer** | Only if FastAPI + SQLAlchemy is chosen as the backend stack. |

### Decision required from owner
None — follows from the backend framework decision.

---

## 5. Frontend UI

### Preferred: Django Templates + htmx + Alpine.js

| Aspect | Detail |
|--------|--------|
| **Recommendation** | Server-rendered HTML via Django templates, enhanced with htmx for dynamic interactions and Alpine.js for lightweight client-side state |
| **Rationale** | Simplest deployment (no separate build pipeline, no Node.js required on server). All rendering happens server-side; htmx provides AJAX-like interactivity (partial page updates, search-as-you-type, modal dialogs) without a full SPA framework. Alpine.js handles small UI state (dropdowns, tabs, form validation). Compatible with local-first LAN deployment — no CDN or external dependencies. |
| **Compatibility** | Aligned with SRS v1.1 §12.2 "HTML5/JS UI"; extends it with modern interaction patterns. SRS §9.1 UI behaviors (modal confirmations, audit drawers) are achievable with htmx + Alpine.js. |
| **Trade-offs** | Less rich interactivity than a full SPA. Each interaction requires a server round-trip (fast on LAN). No offline client capability (not required per SRS §12.1). |
| **Risks** | If future requirements demand complex real-time dashboards or offline-capable clients, migration to a SPA may be needed. For Release 1 admin-focused workflows, this risk is low. |
| **Deployment** | No separate frontend build step. Templates served by Django. htmx and Alpine.js are small JS files (~14KB + ~15KB) bundled with the application. |

### Alternative A: React + Django REST API

| Aspect | Detail |
|--------|--------|
| **Description** | Separate React SPA consuming Django REST API endpoints |
| **Trade-offs** | Richer client-side interactivity; separate build pipeline (Node.js, Webpack/Vite); more complex deployment (two servers or static file serving). More development effort. |
| **Risk** | Requires Node.js on development machines; more complex local deployment; increased maintenance surface. |
| **When to prefer** | If complex real-time dashboards or highly interactive data grids are prioritized. |

### Alternative B: Vue 3 + Django REST API

| Aspect | Detail |
|--------|--------|
| **Description** | Vue 3 SPA with composition API consuming Django REST API |
| **Trade-offs** | Similar to React but with a gentler learning curve. Same deployment complexity concerns. |
| **When to prefer** | If the team prefers Vue; same trade-offs as React. |

### Decision required from owner
Confirm the frontend approach. The preferred option (Django Templates + htmx) is the simplest to deploy and maintain on a local LAN. SPA alternatives offer richer UI but increase complexity.

---

## 6. Authentication and Session Management

### Preferred: Django Authentication + Session Framework

| Aspect | Detail |
|--------|--------|
| **Recommendation** | Django's built-in authentication system with server-side session storage in PostgreSQL |
| **Rationale** | Provides user model, password hashing (PBKDF2/Argon2), session management, login/logout, password reset, and permission checking out of the box. Sessions stored in PostgreSQL for durability. Configurable session timeout for inactivity (SRS NFR Security). |
| **Compatibility** | Aligned with SRS v1.1 §11.3; Technical Design v1.0 §9.1 (Identity & Access Service). |
| **Trade-offs** | Server-side sessions require database queries per request (negligible on LAN). |

### Alternative: Token-based (JWT)

| Aspect | Detail |
|--------|--------|
| **Description** | Stateless JWT tokens for API authentication |
| **Trade-offs** | Better for SPA/mobile clients; harder to revoke; requires token refresh logic. Overkill for server-rendered application on LAN. |
| **When to prefer** | Only if a SPA frontend is selected. |

### Decision required from owner
None — follows from the backend and frontend decisions.

---

## 7. RBAC and Data Isolation

### Preferred: Django Permission System + PostgreSQL Row-Level Security (RLS)

| Aspect | Detail |
|--------|--------|
| **Recommendation** | Django's built-in groups/permissions for RBAC; PostgreSQL RLS for owner/property data isolation |
| **Rationale** | Django permissions provide role-based access at the application level. PostgreSQL RLS enforces owner-scoped data isolation at the database level — even if application code has a bug, one owner's data cannot leak to another owner's views. This dual-layer approach satisfies ADD-OWN-006 and the non-negotiable ownership model. |
| **Compatibility** | Aligned with ADD-SEC-001 through ADD-SEC-007; Technical Design Addendum §4 (RLS recommendation). |
| **Trade-offs** | RLS requires setting a session variable (`SET app.current_owner_id = ...`) on each database connection. Django middleware can handle this transparently. |
| **Risks** | RLS policy errors could lock out legitimate access; mitigated by thorough testing with multi-owner synthetic data (ADD-TC-002). |

### Alternative: Application-only filtering

| Aspect | Detail |
|--------|--------|
| **Description** | Filter queries by `owner_party_id` in application code only; no database-level enforcement |
| **Trade-offs** | Simpler implementation; single missed filter clause exposes cross-owner data. |
| **Risk** | **High** — violates defense-in-depth principle for the non-negotiable ownership model. |

### Decision required from owner
Confirm RLS approach. This is a low-risk technical default but has significant security implications.

---

## 8. Audit Logging

### Preferred: Dual-Layer — PostgreSQL Triggers + Application Audit Events

| Aspect | Detail |
|--------|--------|
| **Recommendation** | PostgreSQL triggers capture all data changes at the database level; application layer adds business context (reason, evidence reference, approval, actor identity) to an `audit_event` table |
| **Rationale** | Dual-layer ensures that even direct database changes (maintenance, emergency fixes) are captured. Application layer provides the business justification required by ADD-AUD-002. The `audit_event` table is append-only with REVOKE UPDATE, DELETE. |
| **Compatibility** | Aligned with ADD-AUD-001 through ADD-AUD-006; Technical Design Addendum §6. |
| **Trade-offs** | Higher storage consumption; more complex implementation. Worth it for financial-grade auditability. |

### Alternative: Application-only audit

| Aspect | Detail |
|--------|--------|
| **Description** | `django-auditlog` or custom middleware captures changes at the application level only |
| **Trade-offs** | Simpler; misses direct database changes; sufficient for many applications but not for financial-grade audit requirements. |

### Decision required from owner
None — low-risk technical default. Dual-layer is recommended.

---

## 9. Document Storage

### Preferred: File System + PostgreSQL Metadata

| Aspect | Detail |
|--------|--------|
| **Recommendation** | Store document files on a protected file-system directory (or NAS); store metadata (filename, MIME type, SHA-256 hash, upload user, access classification) in PostgreSQL |
| **Rationale** | Aligned with Technical Design v1.0 §4 (file storage outside PostgreSQL). Keeps database size manageable. SHA-256 integrity verification. Access control via application RBAC. |
| **Compatibility** | Aligned with SRS v1.1 §5.15 (DOC-001–DOC-006); Technical Design v1.0 architecture decision. |
| **Trade-offs** | Requires backup of both database and file storage. File-system permissions must be configured correctly. |

### Alternative: PostgreSQL Large Objects (BYTEA/LO)

| Aspect | Detail |
|--------|--------|
| **Description** | Store files directly in PostgreSQL |
| **Trade-offs** | Simplifies backup (single database); increases database size significantly; may degrade performance. |
| **When to prefer** | Only if file-system management is impractical. |

### Decision required from owner
None — follows from Technical Design v1.0 baseline.

---

## 10. Automated Testing

### Preferred: pytest + Django Test Framework + Factory Boy

| Aspect | Detail |
|--------|--------|
| **Recommendation** | `pytest` as test runner; Django's built-in test client for integration tests; `factory_boy` for synthetic test data generation |
| **Rationale** | pytest provides clear test output, fixtures, and parametrization. Django test client enables full request/response testing. Factory Boy generates realistic synthetic data for multi-owner, multi-property test scenarios required by ADD-TC-001 through ADD-TC-012. |
| **Compatibility** | Aligned with SRS v1.1 §15; Technical Design v1.0 §12; Technical Design Addendum §11. |
| **Test categories** | Cross-owner isolation, historical integrity, approval workflow, tax-version, chart-of-accounts, security/RBAC, setup workflow, idempotency, backup/restore (per Technical Design Addendum §11.1). |

### Alternative: unittest (built-in)

| Aspect | Detail |
|--------|--------|
| **Description** | Python's built-in unittest framework |
| **Trade-offs** | No additional dependency; less expressive; no parametrization; verbose syntax. |

### Decision required from owner
None — low-risk development tooling choice.

---

## 11. Backup and Restore

### Preferred: pg_dump + File-System Copy + Encrypted Archive

| Aspect | Detail |
|--------|--------|
| **Recommendation** | Automated daily `pg_dump` (database) + file-system copy (documents) → encrypted archive (AES-256) → local + off-site rotation |
| **Rationale** | Aligned with SRS v1.1 §12.4 (3-2-1 encrypted backup model). PostgreSQL WAL archiving for point-in-time recovery. RPO ≤ 24h, RTO ≤ 8 business hours. Quarterly restore drills. |
| **Compatibility** | Aligned with SRS v1.1 NFR-010–NFR-015; Technical Design v1.0 §4.4. |
| **Trade-offs** | Requires scheduled task (Windows Task Scheduler or cron) and off-site storage media rotation. |
| **Deployment** | Scripts in `infrastructure/backup/`; configuration in `config/`. |

### Decision required from owner
Infrastructure decisions (D-008) — server specification, backup media, and restore-test schedule.

---

## 12. Windows-Based Development and Deployment

### Preferred: Native Windows Development + Windows or Linux Production

| Aspect | Detail |
|--------|--------|
| **Recommendation** | Develop on Windows using Python (native installer), PostgreSQL (Windows installer), and Django (pip install). Production deployment on Windows Server or Linux depending on owner's IT infrastructure decision (D-008). |
| **Rationale** | The development environment is Windows-based. Python, PostgreSQL, Django, htmx, and Alpine.js all run natively on Windows without WSL or Docker. This simplifies the development workflow and aligns with the current environment. |
| **Compatibility** | SRS v1.1 §12.2 suggests Linux; this recommendation adapts for Windows development while preserving Linux deployment as an option. |
| **Trade-offs** | Some PostgreSQL features (e.g., unix domain sockets) are Linux-only but not required. Deployment scripts may need OS-specific variants. |
| **Production options** | (a) Windows Server with PostgreSQL Windows service + Waitress/IIS reverse proxy. (b) Linux server with standard Gunicorn + Nginx stack per SRS baseline. Both are viable. |

### Decision required from owner
Confirm production deployment OS as part of infrastructure decision (D-008).

---

## 13. Recommended Stack Summary

| Layer | Recommended | Status |
|-------|-------------|--------|
| **Backend** | Python 3.12+ / Django 5.x / Django REST Framework | PROPOSED — requires owner approval |
| **Database** | PostgreSQL 16 | PROPOSED — strongly aligned with SRS baseline |
| **Migrations** | Django Migrations (built-in) | Follows from backend choice |
| **Frontend** | Django Templates + htmx 2.x + Alpine.js 3.x | PROPOSED — requires owner approval |
| **Authentication** | Django Authentication + PostgreSQL sessions | Follows from backend choice |
| **RBAC** | Django Permissions + PostgreSQL RLS | PROPOSED — low-risk technical default |
| **Audit** | PostgreSQL triggers + application audit_event table | PROPOSED — low-risk technical default |
| **Document storage** | File system + PostgreSQL metadata | Aligned with Technical Design v1.0 |
| **Testing** | pytest + Django Test Client + Factory Boy | Low-risk development tooling |
| **Backup** | pg_dump + file-system copy + encrypted archive | Aligned with SRS v1.1 §12.4 |
| **Dev environment** | Windows native (Python, PostgreSQL, Django) | Current environment |
| **Production server** | Windows Server or Linux (owner decision D-008) | UNRESOLVED — requires D-008 |
| **Reverse proxy** | Waitress (Windows) or Gunicorn + Nginx (Linux) | Follows from production OS choice |

---

## 14. Decisions Requiring Owner Approval

| # | Decision | Options | Impact | Urgency |
|---|----------|---------|--------|---------|
| 1 | **Backend framework** | Django (preferred) / FastAPI / ASP.NET Core | Gates all development | Before WP-2 |
| 2 | **Database engine** | PostgreSQL (preferred) / SQL Server Express | Gates schema design | Before WP-2 |
| 3 | **Frontend approach** | Templates + htmx (preferred) / React SPA / Vue SPA | Gates UI development | Before WP-2 |
| 4 | **Production deployment OS** | Windows Server / Linux | Gates deployment scripts | Before WP-8 (D-008) |

---

*This ADR is a RECOMMENDATION. No dependencies will be installed, and no code will be written until the owner approves the technology stack.*
