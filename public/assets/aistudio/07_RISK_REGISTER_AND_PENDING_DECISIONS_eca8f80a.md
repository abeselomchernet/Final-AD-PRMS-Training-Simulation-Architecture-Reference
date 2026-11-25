# AD-PRMS — Risk Register & Pending Decisions
### What the Owner Needs to Know and Decide

---

## Purpose

This document summarises the project risks, owner decisions already made, and decisions that remain pending. It is written for the property owner and business stakeholders — not for the development team.

Understanding these items helps the owner:
- Know what has been decided and what is still open.
- Appreciate where the project has mitigated risk and where risks remain.
- Prepare for decisions that will be needed before the next phases can begin.

---

## Part 1: Decisions Already Made ✅

These decisions have been formally recorded in the project approval log.

| # | Decision | What Was Decided | Date | Impact |
|---|----------|-----------------|------|--------|
| 1 | Technology stack | Python + Django 5.x for backend, PostgreSQL 16 for database, Django Templates + htmx + Alpine.js for screens | Nov 2026 | Sets the technical foundation for the entire system |
| 2 | Data isolation approach | PostgreSQL Row-Level Security + application-level authorization | Nov 2026 | Ensures owner data is separated at the deepest level |
| 3 | Audit approach | Database trigger-level audit + application audit events | Nov 2026 | Creates a tamper-proof record of all system activity |
| 4 | Development environment | Windows development, production OS deferred (D-008) | Nov 2026 | Development can proceed; server choice made later |
| 5 | Phase 1 scope | Synthetic data only — no real business data until system is validated | Nov 2026 | Protects real data while the system is under construction |

---

## Part 2: Decisions Pending — Owner Input Needed 🔶

These decisions cannot be made by the development team — they require the property owner's direction.

### D-008: Production Server Operating System

| Item | Detail |
|------|--------|
| **What needs deciding** | Whether the production server will run Linux (as recommended in the requirements) or Windows Server |
| **Why it matters** | Affects server setup procedures, security configuration, backup tools, and long-term maintenance costs |
| **When needed by** | Before WP-3 (production environment setup) begins |
| **Options** | **Linux (recommended):** Lower cost, better PostgreSQL integration, industry standard for servers. **Windows Server:** Familiar to current staff, but higher licensing costs and less common for this type of system. |
| **Project team recommendation** | Linux, but the owner's comfort and staff capabilities should be considered |

### D-009: Domain Name and Network Configuration

| Item | Detail |
|------|--------|
| **What needs deciding** | Whether the system will be accessed by IP address on the local network or via a local domain name |
| **Why it matters** | Affects how users access the system from their workstations and whether certificates are needed |
| **When needed by** | Before WP-3 |
| **Options** | IP address (simpler), local DNS name (more professional), or both |

### D-010: Backup Strategy and Frequency

| Item | Detail |
|------|--------|
| **What needs deciding** | How often should data be backed up, where should backups be stored, and how quickly must the system be recoverable |
| **Why it matters** | Protects the business against data loss from hardware failure, power outage, or human error |
| **When needed by** | Before the system goes live with real data |
| **Options** | Daily backups, hourly backups, real-time replication, off-site copies |
| **Project team recommendation** | At minimum: daily automated backups to a separate physical drive, with monthly off-site copies |

### D-011: User Authentication Method

| Item | Detail |
|------|--------|
| **What needs deciding** | How users will log in — username/password, or integration with existing systems (if any) |
| **Why it matters** | Affects security and user experience |
| **When needed by** | Before WP-4 (user interface development) |
| **Options** | Local username/password with strong password rules (simplest), or integration with Active Directory if available |

### D-012: Number of Initial Users and Roles

| Item | Detail |
|------|--------|
| **What needs deciding** | How many people will use the system, and what roles they will have |
| **Why it matters** | Determines how many user accounts to set up, what roles to configure, and the training plan |
| **When needed by** | Before user interface testing begins |
| **Suggested action** | List all staff who will interact with the system and what they should be able to do |

### D-013: Report Requirements and Formats

| Item | Detail |
|------|--------|
| **What needs deciding** | What reports the owner needs (income summaries, tenant statements, tax workpapers, vacancy reports) and in what format (screen, PDF, Excel) |
| **Why it matters** | Report design drives how data is structured and what the user interface shows |
| **When needed by** | Before WP-5/6 (reporting work packages) |
| **Suggested action** | Collect examples of current reports being prepared manually |

### D-014: Management Fee Structure

| Item | Detail |
|------|--------|
| **What needs deciding** | How management fees are calculated — fixed amount, percentage of collected rent, percentage of total rent due, or tiered structure |
| **Why it matters** | Affects the accounting module and owner statement calculations |
| **When needed by** | Before the accounting module is activated |

### D-015: Tax Categories and Current Rates

| Item | Detail |
|------|--------|
| **What needs deciding** | Which tax types apply to the rental business and their current rates |
| **Why it matters** | Must be configured correctly before any financial calculations can be trusted |
| **When needed by** | Before the tax module is activated |
| **Suggested action** | Provide current tax certificates, recent tax filings, or accountant's summary of applicable taxes |

---

## Part 3: Project Risks and Mitigations

### Active Risks

| # | Risk | Likelihood | Impact | Mitigation | Status |
|---|------|:----------:|:------:|-----------|:------:|
| R-1 | **PostgreSQL not yet installed** — database-level security (RLS, audit triggers, self-approval block) cannot be fully verified until PostgreSQL is running | High | Medium | All migration code is written and tested structurally. A detailed validation plan documents exactly what to test. Will be resolved in WP-3. | 🟡 Monitored |
| R-2 | **Low disk space** on development machine (~0.1 GB free) — could block PostgreSQL installation or future development | High | High | Old caches cleaned. PostgreSQL install may need 250+ MB. Owner may need to free space or use a different drive. | 🔴 Needs attention |
| R-3 | **Production OS not decided (D-008)** — deployment procedures, security hardening, and backup scripts depend on this choice | Medium | Medium | Development continues on Windows. Deployment procedures will be written once D-008 is decided. | 🟡 Monitored |
| R-4 | **Single developer** — if the developer is unavailable, project work stops | Medium | High | All code is version-controlled (Git). Documentation is comprehensive enough for another developer to continue. | 🟡 Monitored |
| R-5 | **Requirements changes** — real-world use may reveal needs not captured in the SRS | Medium | Medium | Modular architecture allows changes without rebuilding. ADRs document decisions for future reference. | 🟢 Mitigated |

### Retired Risks

| # | Risk | Resolution |
|---|------|-----------|
| R-0 | Technology choice mismatch with requirements | ✅ Resolved — owner approved the technology stack (ADR-001) |

---

## Part 4: What Happens If Things Go Wrong

### Scenarios and Protections

| Scenario | Protection in Place |
|----------|-------------------|
| **Staff member accidentally deletes records** | Non-destructive history — records are deactivated, not deleted. Full audit trail shows what happened. |
| **Computer hardware fails** | Backups (once configured) allow recovery. Version-controlled code can be redeployed to a new server. |
| **Someone tries to access another owner's data** | Row-Level Security blocks the attempt at the database level. Audit trail records the attempt. |
| **Tax rate entered incorrectly** | Maker-checker process requires a second person to approve. Change is recorded with before/after values. Can be corrected with a new approved version. |
| **Staff member leaves the company** | Their account is deactivated. All their actions remain in the audit trail. Their pending approvals expire. New staff are assigned appropriate roles. |
| **Power outage during data entry** | PostgreSQL is transactional — incomplete operations are automatically rolled back. No partial or corrupted data. |
| **Developer is no longer available** | Comprehensive documentation, standard technology choices, and version-controlled code allow any qualified developer to continue. |

---

## Part 5: Compliance Readiness Summary

| Compliance Area | System Readiness |
|----------------|:----------------:|
| Financial record keeping | 🔧 Foundation built (chart of accounts, effective dating) |
| Tax computation accuracy | 🔧 Foundation built (versioned tax rates with approval) |
| Data privacy and access control | 🔧 Foundation built (RLS, RBAC, owner isolation) |
| Audit trail for regulators | 🔧 Foundation built (immutable, append-only, before/after) |
| Separation of duties | 🔧 Foundation built (maker-checker, self-approval block) |
| Business continuity | ⏳ Awaiting backup configuration and disaster recovery plan |
| Staff training | ⏳ Awaiting user interface completion |

---

*Document created: November 2026*
*Part of the AD-PRMS Project Overview series*
*This document should be reviewed and updated at each project milestone.*
