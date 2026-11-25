# AD-PRMS — Business Capabilities & Feature Map
### What the System Will Do for Your Business

---

## Feature Overview by Business Area

### 1. 👤 Owner & Entity Management

| Capability | Description | Status |
|-----------|-------------|:------:|
| Register property owners | Individual persons or business entities (PLC, LLC) | 🔧 Foundation built |
| Owner profile versioning | Changes to name, TIN, address tracked with full history | 🔧 Foundation built |
| Multiple owner support | System isolates data per owner — ready for portfolio growth | 🔧 Foundation built |
| Business entity tracking | Legal structure, trading name, registration details | 🔧 Foundation built |

### 2. 🏢 Property Portfolio

| Capability | Description | Status |
|-----------|-------------|:------:|
| Property registration | Record properties with address, title reference, ownership | 🔧 Foundation built |
| Building management | Multiple buildings per property, with floor counts | 🔧 Foundation built |
| Floor & room tracking | Every rentable space tracked by floor, number, type, area | 🔧 Foundation built |
| Room renumbering history | Old room numbers preserved; historical references remain valid | 🔧 Foundation built |
| Ownership transfer | Effective-dated ownership records with evidence trail | 🔧 Foundation built |
| Unit status lifecycle | Vacant → Occupied → Maintenance → Reserved → Inactive | 🔧 Foundation built |
| Property screens & forms | User-friendly data entry for property management | 🔒 WP-4 |

### 3. 👥 Tenant & Lease Management

| Capability | Description | Status |
|-----------|-------------|:------:|
| Tenant profiles | Name, ID, contact, emergency contact, employer | 🔒 WP-4/5 |
| Lease agreements | Start/end dates, terms, rent amount, deposit, clauses | 🔒 WP-5 |
| Lease renewals | New lease version linked to previous; full history | 🔒 WP-5 |
| Occupancy tracking | Which tenant occupies which unit, effective dates | 🔒 WP-5 |
| Lease document storage | Digital copies of signed agreements linked to records | 🔒 WP-5 |

### 4. 💰 Rent & Collections

| Capability | Description | Status |
|-----------|-------------|:------:|
| Monthly rent schedules | Automated generation of monthly charges per lease | 🔒 WP-5 |
| Receipt issuance | Numbered, printed receipts for every payment | 🔒 WP-5 |
| Payment recording | Cash, bank transfer, cheque — with reference numbers | 🔒 WP-5 |
| Deposit management | Security deposit tracking, refund, forfeiture | 🔒 WP-5 |
| Arrears tracking | Automatic identification of overdue tenants | 🔒 WP-5 |
| Partial payments | Apply payments to specific charges or oldest-first | 🔒 WP-5 |

### 5. 📊 Accounting & Finance

| Capability | Description | Status |
|-----------|-------------|:------:|
| Chart of accounts | Owner-specific account structure with categories | 🔧 Foundation built |
| Account lifecycle | Draft → Active → Suspended → Retired with approval | 🔧 Foundation built |
| Journal entries | Double-entry bookkeeping with mandatory owner dimension | 🔒 WP-6 |
| Owner financial statements | Income statement, balance sheet per owner | 🔒 WP-6/7 |
| Non-destructive adjustments | Corrections via reversing entries, never overwriting | 🔒 WP-6 |
| Period closing | Monthly/annual close with approval workflow | 🔒 WP-6 |

### 6. 🏛️ Tax Management

| Capability | Description | Status |
|-----------|-------------|:------:|
| Tax categories | VAT, Withholding Tax, Stamp Duty — configurable per owner | 🔧 Foundation built |
| Tax rate versions | Full version history with effective dates | 🔧 Foundation built |
| Draft-to-active lifecycle | Tax rules require approval before they affect calculations | 🔧 Foundation built |
| Regulatory references | Link each rate to its proclamation or regulation | 🔧 Foundation built |
| Tax calculations | Automatic tax computation on transactions | 🔒 WP-8 |
| Filing workpapers | Generated reports for manual tax submission | 🔒 WP-8 |

### 7. 📋 Reports

| Capability | Description | Status |
|-----------|-------------|:------:|
| Owner income statement | Revenue minus expenses per owner, per period | 🔒 WP-7 |
| Receivable ageing | How much each tenant owes and for how long | 🔒 WP-7 |
| Occupancy report | Occupied vs vacant units, revenue impact | 🔒 WP-7 |
| Collections summary | Total collected, by payment method, by period | 🔒 WP-7 |
| Tax summary | Taxes collected, withheld, payable — per category | 🔒 WP-8 |
| Audit report | Who did what, when, searchable and filterable | 🔒 WP-7 |
| PDF/Excel export | All reports exportable for printing or external use | 🔒 WP-7 |

### 8. 🔐 Security & Access Control

| Capability | Description | Status |
|-----------|-------------|:------:|
| User authentication | Username + password with encrypted storage | 🔧 Foundation built |
| Configurable roles | 11 proposed roles — fully customisable | 🔧 Foundation built |
| Role-based access | Each role sees only what it's authorised to access | 🔧 Foundation built |
| Session management | Auto-logout after 1 hour of inactivity | 🔧 Foundation built |
| System Admin restrictions | Cannot self-approve, cannot bypass audit | 🔧 Foundation built |
| Password policy | Minimum 12 characters, complexity requirements | 🔧 Foundation built |
| Login screen | Web-based login interface | 🔒 WP-3 |

### 9. ✅ Approvals & Governance

| Capability | Description | Status |
|-----------|-------------|:------:|
| Maker-checker workflow | Every critical action requires two people | 🔧 Foundation built |
| Self-approval prevention | Enforced at software AND database level | 🔧 Foundation built |
| Configurable rules | Define which actions need approval and who can approve | 🔧 Foundation built |
| Multi-step approvals | Support for 1, 2, or more approval steps | 🔧 Foundation built |
| Financial thresholds | Different approval requirements based on amount | 🔧 Foundation built |
| Approval dashboard | Pending, approved, rejected requests at a glance | 🔒 WP-4 |

### 10. 📝 Audit Trail

| Capability | Description | Status |
|-----------|-------------|:------:|
| Complete event log | Every create, update, delete, login, approval recorded | 🔧 Foundation built |
| Before/after values | See exactly what changed | 🔧 Foundation built |
| Actor identity | Who performed the action | 🔧 Foundation built |
| Timestamp | When it happened (to the second) | 🔧 Foundation built |
| Reason and evidence | Why it was done, with supporting document reference | 🔧 Foundation built |
| Tamper-proof storage | Cannot be modified or deleted — ever | 🔧 Foundation built |
| Audit search interface | Search and filter audit events | 🔒 WP-4 |

### 11. 💾 Backup & Recovery

| Capability | Description | Status |
|-----------|-------------|:------:|
| Automated daily backup | Database + files backed up automatically | 🔒 WP-9 |
| Encrypted archives | Backups protected with AES-256 encryption | 🔒 WP-9 |
| Off-site rotation | Physical media rotation for disaster recovery | 🔒 WP-9 |
| Quarterly restore drills | Test that backups actually work, with sign-off | 🔒 WP-9 |
| Point-in-time recovery | Restore to any point within backup window | 🔒 WP-9 |

---

## Status Legend

| Symbol | Meaning |
|:------:|---------|
| 🔧 | Foundation built — database structure and business rules in place |
| 🔒 | Not yet started — planned for a future work package |
| ✅ | Fully complete and operational |

---

*Of the 70+ capabilities listed above, 35 have their foundational structures built and tested. The remaining capabilities are planned for future work packages, each requiring owner approval before proceeding.*
