# Phase 1 Synthetic Data Policy

**Status:** ACTIVE — Governs all Phase 1 development  
**Date:** 12 November 2026  
**Authority:** Phase 1 Conditional Implementation Authorization v0.1, §2.1; Authorization Brief §6.2

---

## 1. Purpose

This policy defines what data may and may not be used during Phase 1 development and testing. It protects the owner from premature entry of unverified records and ensures compliance with the conditional authorization scope.

## 2. Core Rule

> **All data used during Phase 1 development and testing MUST be synthetic or placeholder.**  
> No unverified property records, tenant identities, financial balances, or photographed-document data may be entered as production data.

## 3. What Is Synthetic Data

Synthetic data is test data that:

- Is clearly labelled as non-production (e.g., "Test Owner Alpha", "Building DEMO-001", "Tenant SYNTH-042")
- Does not use real names, addresses, TINs, phone numbers, ID numbers, or financial balances belonging to actual persons or entities
- Is designed to exercise system functionality, edge cases, and control patterns
- May be generated automatically by test factories (e.g., Factory Boy) or entered manually for specific test scenarios
- Is disposable and may be deleted or regenerated at any time

## 4. What Is NOT Permitted

| Prohibited Data | Reason | Unblocking Decision |
|-----------------|--------|---------------------|
| Real property titles, addresses, or building identifiers | Unverified — no approved property register | D-002 |
| Real unit/room identifiers, measurements, floor assignments | Unverified — no approved unit census | D-003 |
| Real tenant names, IDs, phone numbers, or personal data | Unverified — no approved tenant register | D-005 |
| Real lease terms, rent amounts, or occupancy records | Unverified — no reconciled data | D-005 |
| Real financial balances (deposits, receivables, payables, cash) | Unverified — no reconciled opening balances | D-005 |
| Real tax rates, TINs, or taxpayer classifications | Unapproved — no tax professional sign-off | D-004 |
| OCR-extracted or photographed-document data claimed as verified | Unverified — OCR not performed; images unread | G-003 |
| Production authority matrix, delegation limits, or maker-checker thresholds | Unapproved — authority matrix not signed | D-006 |

## 5. Synthetic Data Requirements for Testing

Phase 1 tests MUST use synthetic data that covers:

| Test Scenario | Synthetic Data Required |
|---------------|------------------------|
| Cross-owner isolation (ADD-TC-002) | At least 2 synthetic owners with separate properties, leases, and financial records |
| Owner history preservation (ADD-TC-003) | Synthetic property-owner change with effective date |
| Unit rename history (ADD-TC-004) | Synthetic unit with rename and historical lease references |
| Chart-of-accounts integrity (ADD-TC-005) | Synthetic accounts with posted journal entries |
| Tax draft-to-active gate (ADD-TC-006) | Synthetic tax rule versions in draft and active states |
| System Admin self-approval block (ADD-TC-007) | Synthetic System Administrator and business approver users |
| Maker-checker enforcement (ADD-TC-008) | Synthetic users with different roles |
| Setup workflow audit trail (ADD-TC-009) | Synthetic onboarding workflow with evidence references |
| No hard-coded data (ADD-TC-010) | Fresh deployment verification |

## 6. Planning Estimates

The planning estimate of **"approximately 100 units across 5 buildings"** may be used for:
- Schema sizing and capacity planning
- UI design and layout decisions
- Test data volume planning

It MUST NOT be treated as a verified inventory (Authorization Brief §7, item 12).

## 7. Transition to Production Data

Production data may be entered only after:
1. The relevant blocking decision (D-002 through D-006) is resolved
2. The owner approves the specific data load through the setup workflow
3. Evidence references and reconciliation checks are completed
4. The data passes validation and onboarding checklist requirements (ADD-PLT-009, ADD-PLT-010)

---

*This policy remains in effect throughout Phase 1 and is superseded only by explicit owner authorization to load specific categories of production data upon resolution of the blocking decisions.*
