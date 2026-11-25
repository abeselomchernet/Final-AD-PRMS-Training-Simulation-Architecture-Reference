# AD-PRMS Accounting Module: Research and Design Proposal

*Prepared for Abi, 15 to 16 November 2026. This is for the office test and training system (synthetic data only). It is research to guide the design. It is not tax or legal advice. A licensed Ethiopian accountant and tax adviser must confirm every rule before real money is involved.*

## 1. Summary

- **Where AD-PRMS is today.** It has the shape of accounting: 12 draft accounts per owner, a journal screen, rent charges, receipts, receipt allocation, tax rule drafts, approvals and a hash-chained audit log. But the journals on screen are marked "Prototype / Planned Capability". The Django backend has no ledger or journal tables yet. So nothing can be posted or reconciled.
- **What to build.** A double-entry, append-only ledger. One ledger per owner. Money events (rent invoice, receipt, deposit, expense, payment, tax) create balanced journal entries by posting rules. Nothing is edited or deleted. Mistakes are fixed by a reversing entry.
- **Why rules must be data.** Ethiopia changed a lot in 2024 to 2026: a new VAT law, Income Tax Amendment 1395/2025, Property Tax 1365/2025 and an e-invoicing directive 1142/2026. Rates and rules must live in dated, versioned rule packs. They must not be written into code.
- **Best training value.** A real month-end close: trial balance, mobile-money and bank reconciliation, a three-way deposit check, an owner statement and tax workpapers.
- **How to build it.** Seven small steps. Each step ends with tests that must pass, for example: total debits always equal total credits, and no entry can enter a closed period.

**Added since the first draft.** A full worked month with expected figures (section 12). A catalog of 27 posting rules (section 6.5). Who can post, approve, close and reopen (section 6.7). Two diagrams (sections 5 and 6.7). A rules register with sign-off status (section 13). Migration from the prototype (section 14). An English and Amharic glossary (section 15). Rent-control limits, foreign currency, staff payroll basics and backup restore tests (section 16). Salary and benefits (section 17). The build plan now has effort sizes (section 7).

## 2. Scope

**In scope for the training system**

- Ledger, chart of accounts, journals, periods and year-end
- Tenant receivables, advance rent and security deposits
- Receipts, allocation, mobile-money clearing and reconciliation
- Expenses and payables, fixed assets and depreciation
- Tax setup and tax workpapers (calculations shown as drafts)
- Owner statements and financial reports
- Training exercises and automatic test cases

**Out of scope**

- Live filing with the tax authority
- Real e-invoice submission
- Real payments

The existing ERCA verification gate already locks live tax features. Keep it.

## 3. What the research found

These Ethiopian rules shape the design. Items marked *verify* have conflicting or older sources.

| Topic | What research found | Effect on design |
| --- | --- | --- |
| Reporting standard | Proclamation 847/2014 requires IFRS or IFRS for SMEs for entities the AABE classes as in scope. Micro enterprises are outside it. AABE changes the criteria from time to time. | Statements follow the IFRS for SMEs shape. The accountant chooses the framework for each owner entity. |
| Lease income | For most property leases, the lessor treats the lease as an operating lease. Income is recognised straight-line over the lease term. | Rent schedules must handle free months and step-ups. The system computes accrued or deferred rent. |
| Rental income tax | Amendment 1395/2025 was enacted 17 July 2025 and took effect 8 July 2025. Individuals pay on annual rental income: 0% up to 24,000; 15% to 48,000; 20% to 84,000; 25% to 120,000; 30% to 168,000; 35% above. Companies pay a flat 30%. One law-firm summary says an individual's employment, rental and business income may be added together before the bands apply. Confirm this with the adviser (rule 19, section 13). *Verify:* one firm noted in July 2026 that the gazetted text was still awaited. | Tax engine needs owner type (individual or company). Bands are data with effective dates. |
| Deductions | With books: land lease cost, repairs and maintenance, depreciation, interest, insurance and city fees. Without books: older guidance gave a flat allowance (20%). A reported Addis Ababa directive uses a flat 35% for presumptive taxpayers. *Verify* for your city or region. | Expense accounts carry a "tax-deductible class". The workpaper shows the books method and the flat method side by side. |
| Sub-letting | Taxable rental income is rent received minus rent paid to the head lessor. | Optional account for head-lease rent paid. |
| VAT | VAT Proclamation 1341/2024 replaced the 2002 law. Standard rate is 15%. Registration threshold is ETB 2,000,000. Lease of a dwelling is exempt. Returns are monthly, due by the end of the next month. | Each lease has a supply type: residential (exempt) or commercial (standard). VAT accounts stay locked until the owner is VAT-registered. |
| Withholding | Local withholding on purchases rose from 2% to 3% from August 2025 (goods over 20,000 and services over 10,000 per transaction). Agents pay within 30 days after month end. Sources are unclear on whether it applies to rent payments. *Verify.* | Withholding is a rule with "applies to" flags and adviser sign-off. This matches the seed data note that research conflicts. |
| Cash limit | Amendment 1395/2025 bars cash payments above ETB 50,000 per transaction. | Control: warn or block cash receipts and payments above 50,000. Route them through bank or mobile money. |
| Advance tax | Categories A and B pay 25% of the prior year's tax within 30 days after each quarter. | Tax calendar creates reminders. An "advance tax paid" account holds the payments. |
| Tax year | 1 Hamle to 30 Sene (about 8 July to 7 July). | Fiscal years and periods are Ethiopian. Gregorian dates show beside them. |
| Stamp duty | Older guides: lease 0.5% of value. *Verify current rate.* | Versioned rule, locked until confirmed. |
| Property tax | Proclamation 1365/2025: taxable value is 25% of market or replacement value. Federal range for buildings is 0.1% to 1%. Local government sets the final rate. Sources disagree on the upper limit. | Property tax record per building: value, rate, due dates, payable account. |
| Record keeping | Keep records for the longer of the Commercial Code period (10 years for company books) or 5 years after filing. Keep them in Amharic or English and inside Ethiopia. | Nothing is deleted. Retention flags on all records. Production hosting must be in Ethiopia. |
| E-invoicing | Directive 1142/2026: invoices are registered with the Ministry system and carry an invoice registration number and QR code. The rollout schedule is not yet issued. The government target is large taxpayers by end of December 2026, VAT first. | Receipts and invoices get registration number, QR and status fields. The adapter stays off behind the ERCA gate. |
| Local rent rules | Addis Ababa requires lease registration and formal payment channels (Directive 7/2024). Your owners may follow Oromia or another city's rules. | Add a local jurisdiction pack per city or region. |

## 4. What a property accounting module must include

This list comes from IFRS lessor rules, Ethiopian tax law and how property-management platforms handle trust-style accounting.

1. **General ledger.** Double-entry, one ledger per owner, chart of accounts with versions.
2. **Periods.** Ethiopian fiscal year and months, open and closed states, year-end close.
3. **Tenant sub-ledger.** Invoices, receipts, allocation, ageing, advance rent, late fees.
4. **Deposit ledger.** Deposits are a liability, not income. Track each deposit by lease. Refund or deduct with approval and evidence.
5. **Clearing and reconciliation.** Telebirr and Arifpay money passes through a clearing account. Match bank and gateway statements to the ledger.
6. **Three-way check.** Bank balance, ledger balance and the sum of tenant and owner balances must agree. Peer platforms treat this as the key monthly control.
7. **Payables.** Vendor bills, approval, payment, withholding.
8. **Fixed assets.** Buildings and equipment, depreciation, disposal.
9. **Tax.** Rental income tax estimate, VAT, withholding, advance tax, stamp duty, property tax, and a calendar of due dates.
10. **Owner statements.** Income, expenses, deposits held, tax set aside, money paid to owner.
11. **Reports.** Trial balance, income statement, balance sheet, cash flow, receivable ageing, rent roll, tax summary.
12. **Controls.** Maker-checker, period lock, reversal-only corrections, audit trail with before and after values.

## 5. How it works

**The flow of money**

1. A lease is approved. The system builds a rent schedule (dates, amounts, free months, VAT type).
2. Each period the system raises a charge. A posting rule creates the journal entry.
3. The tenant pays (cash, bank, Telebirr, Arifpay, QR). A receipt is issued.
4. The receipt is allocated to charges. Extra money becomes advance rent.
5. Gateway money lands in the clearing account. When the settlement reaches the bank, clearing is cleared and fees are booked.
6. Expenses arrive as vendor bills, are approved by a second person, then paid.
7. At month end the checklist runs: reconcile, three-way check, accruals, depreciation, tax estimate. A second person approves the close. The period locks.
8. The system produces the owner statement and reports.

&#91;embedded content: money flow · lease to bank, 7 boxes\]

A charge is raised from the lease schedule. Cash and bank payments go straight to the bank. Gateway payments wait in clearing until the settlement reaches the bank. Extra money from a tenant goes to Advance Rent (2110).

**Examples (ETB)**

| Event | Debit | Credit |
| --- | --- | --- |
| Residential rent 20,000 invoiced (VAT exempt) | Rent Receivable 20,000 | Rental Income 20,000 |
| Commercial rent 50,000 + 15% VAT, owner VAT-registered | Rent Receivable 57,500 | Rental Income 50,000; Output VAT 7,500 |
| Deposit 40,000 received | Bank 40,000 | Tenant Deposit Liability 40,000 |
| Tenant pays 20,000 by Telebirr | Mobile-Money Clearing 20,000 | Rent Receivable 20,000 |
| Telebirr settles to bank | Bank (net); Gateway Fees | Mobile-Money Clearing 20,000 |
| Repair bill 12,000 | Repairs and Maintenance 12,000 | Accounts Payable 12,000 |
| Pay the bill, 3% withholding applies (only if the owner is a withholding agent) | Accounts Payable 12,000 | Bank 11,640; Withholding Tax Payable 360 |
| Deposit refunded | Tenant Deposit Liability | Bank |
| Monthly depreciation | Depreciation Expense | Accumulated Depreciation |
| Wrong entry found | Mirror of the original, linked to it | New correct entry posted separately |

**Straight-line example.** A 12-month lease at 10,000 a month with the first month free has total rent of 110,000. Income is 110,000 divided by 12 = 9,166.67 each month. The difference from cash received sits in accrued rent or deferred rent.

**Tax test example (if the bands work as marginal bands).** An individual owner has taxable rental income of 200,000. Tax = 24,000 x 0% + 24,000 x 15% + 36,000 x 20% + 36,000 x 25% + 48,000 x 30% + 32,000 x 35% = 0 + 3,600 + 7,200 + 9,000 + 14,400 + 11,200 = **45,400**. The old law stored each band as rate minus a fixed deduction, which gives the same result. Confirm the exact schedule with the adviser, then keep this as an automatic test.

## 6. Proposed design

### 6.1 Principles

1. **Append-only.** Journal entries cannot be updated or deleted. Corrections are reversals.
2. **One owner, one ledger.** Every row has an owner. No journal mixes owners. Use the existing PostgreSQL row-level security.
3. **Rules are data.** Posting rules, tax rates and local rules are versioned with effective dates.
4. **Approval by two people.** Reuse the existing maker-checker engine and block self-approval in the database.
5. **Exact money.** Store ETB as fixed-decimal amounts. Never use floating point.
6. **Safe to repeat.** Every posting has an idempotency key so a retried payment cannot post twice.
7. **Two calendars.** Store Gregorian dates. Show Ethiopian dates beside them.
8. **Everything is audited.** Reuse the hash-chained audit event.

### 6.2 Where it fits

Add a `ledger` app to the Django backend. Billing, receipts, gateways, expenses and tax send events to a posting service. The posting service reads the posting rules and writes balanced journals. The React screens only show data and send requests. This keeps the logic in one place, whichever front end is used. This also removes the doubt about the earlier htmx decision.

**Reuse what exists:** ChartOfAccount with versions, Charge, PaymentReceipt, ReceiptAllocation, TaxRule with the ERCA gate, ApprovalRequest, AuditEvent and the owner isolation policies.

### 6.3 Main tables

- **Ledger** (one per owner): currency, basis (cash or accrual), framework.
- **Account:** code, name, type, tax class, active dates, version. Extends the current chart.
- **FiscalYear and Period:** Ethiopian dates, status (Open, Closing, Closed).
- **JournalEntry:** number, date, period, source type and id, idempotency key, status, maker, checker, reversal-of.
- **JournalLine:** account, debit, credit, tenant, unit, lease, vendor, tax code.
- **PostingRule:** event type, conditions, line templates, effective dates.
- **LeaseSchedule:** dates, amounts, VAT type, straight-line plan.
- **DepositRecord:** lease, amount, held in which account, status, refund or deduction links.
- **ClearingAccount and SettlementLine:** gateway, expected amount, fee, settled amount.
- **BankStatementLine and ReconciliationRun:** imported lines, matches, differences, sign-off.
- **Vendor, Bill, BillPayment:** with withholding fields.
- **FixedAsset and DepreciationRun.**
- **TaxRulePack and TaxRuleVersion:** jurisdiction, rule, bands or rates, effective dates, source, adviser sign-off.
- **TaxPeriodReturnDraft:** computed figures, workpaper, status.
- **OwnerStatement.**
- **CloseChecklist and CloseTask.**

**Database rules (not only code):**

- A journal cannot be posted unless debits equal credits.
- No update or delete on posted journals (same trigger style as the audit table).
- No posting into a closed period.
- Owner must match on the entry and all of its lines.
- Account must be Active and effective on the entry date.

### 6.4 Proposed chart of accounts

Same codes for every owner. The owner comes from the ledger, so the suffix on codes (such as -ALPHA) is no longer needed.

- **Assets:** 1010 Cash on Hand; 1020 Bank Operating; 1030 Bank Deposits Held; 1040 Mobile-Money Clearing; 1110 Rent Receivable; 1120 Allowance for Doubtful Accounts; 1130 Accrued Rent; 1190 Input VAT (locked); 1150 Staff Advances (section 17); 1195 Advance Income Tax Paid; 1210 Buildings (investment property); 1220 Accumulated Depreciation, Buildings; 1230 Furniture and Equipment; 1240 Accumulated Depreciation, Equipment.
- **Liabilities:** 2010 Accounts Payable; 2110 Advance Rent Received; 2120 Tenant Deposit Liability; 2130 Deferred Rent; 2210 Output VAT (locked); 2220 Withholding Tax Payable; 2230 Income Tax Payable; 2240 Property Tax Payable; 2250 Stamp Duty Payable; 2260 PAYE Payable; 2270 Pension Payable; 2275 Salaries Payable; 2280 Accrued Leave; 2285 Accrued Severance (all staff accounts, section 17); 2310 Loans Payable.
- **Equity:** 3100 Owner Capital; 3200 Owner Drawings; 3300 Retained Earnings (system).
- **Income:** 4100 Rental Income, Residential; 4110 Rental Income, Commercial; 4200 Service Charge Recoveries; 4300 Late Fee Income; 4400 Damage Recoveries; 4900 Other Income.
- **Expenses:** 5100 Repairs and Maintenance; 5200 Utilities; 5300 Insurance; 5400 Property Tax and City Fees; 5410 Land Lease Fees; 5500 Management and Staff (staff pay uses the 6100 series, section 17); 5600 Bank and Gateway Charges; 5700 Bad Debt; 5800 Interest; 5900 Depreciation; 5950 Penalties (not deductible).

Accounts 1190, 2210, 2220, 2230 and 2250 stay locked until the owner profile and adviser confirm the tax status.

**Check against the SRS.** Appendix A of SRS v1.1 is illustrative, and it puts salaries and depreciation in the 6000 range and bank charges and interest in the 7000 range. This chart, like the prototype's draft accounts, keeps depreciation (5900), bank and gateway charges (5600) and interest (5800) in the 5000 range. Decide before building: keep this chart and update the SRS appendix, or renumber (for example 5600 to 7100, 5800 to 7200, 5900 to 6900). Staff pay already follows the SRS range (section 17).

### 6.5 Posting rules

Start with the 27 rules in the catalog below, which cover the events in section 5 and the edge cases. Each rule is a row of data: when it applies, which accounts, and from which date. A change to a rule needs maker-checker approval and gets a new version. Old entries keep the version they were posted with.

#### Posting rule catalog (first release: 27 rules)

Every rule has an ID, the conditions that must be true before it posts, the journal lines, and who approves. "No entry" is a rule too: it stops a failed payment from creating income. Amounts in ETB. Thresholds are the prototype's synthetic values or tax placeholders and must be confirmed by the adviser.

| ID | Event | Conditions to post | Entry | Approval and notes |
| --- | --- | --- | --- | --- |
| PR-01 | Rent charge, residential | Lease Active; charge is on the schedule; supply type residential | Dr 1110 Rent Receivable; Cr 4100 Rental Income, Residential | System posts. One journal per charge. |
| PR-02 | Rent charge, commercial, owner not VAT-registered | Lease Active; supply type commercial; owner VAT flag off | Dr 1110; Cr 4110 Rental Income, Commercial | System posts. VAT accounts stay locked. |
| PR-03 | Rent charge, commercial, owner VAT-registered | Owner VAT flag on; VAT rule version Active | Dr 1110 (gross); Cr 4110 (net); Cr 2210 Output VAT (15%) | Blocked until adviser confirms the VAT rule and the ERCA gate passes. |
| PR-04 | Straight-line: income ahead of billing (free month, discount) | Lease marked straight-line; income for the period is more than the amount billed | Dr 1130 Accrued Rent; Cr 4100 or 4110 | System posts on the first day of the period. No invoice needed. |
| PR-05 | Straight-line: billing ahead of income (step-up) | Lease marked straight-line; amount billed is more than income | Dr 1110; Cr 4100 or 4110 (income); Cr 1130 (release accrued rent) or Cr 2130 Deferred Rent when no accrued balance remains | System posts with the charge. |
| PR-06 | Receipt by cash or bank transfer | Receipt number issued; allocation set (default: oldest charge first); cash not over 50,000 | Dr 1010 Cash on Hand or 1020 Bank Operating; Cr 1110 | Cash over 50,000 is blocked unless the Owner approves a written exception. |
| PR-07 | Receipt by Telebirr, Arifpay or QR: success | Gateway status Success; webhook signature valid; idempotency key not seen before | Dr 1040 Mobile-Money Clearing; Cr 1110 | A repeated webhook is ignored. |
| PR-08 | Gateway payment failed, pending or expired | Any status other than Success | No entry | Audit event only. No receipt. The charge stays open. If it later succeeds, PR-07 posts on that later date. |
| PR-09 | Gateway settlement to bank | Settlement batch matches the receipts listed in it | Dr 1020 (net); Dr 5600 Bank and Gateway Charges (fee); Cr 1040 | Any difference stays in clearing and opens an exception task. Clearing must be zero at close, or every difference explained. |
| PR-10 | Partial payment | Payment is less than the oldest open charge | Same lines as PR-06 or PR-07 | Charge status Partly Paid. The rest stays in 1110 and ages. |
| PR-11 | Overpayment or early payment | Payment is more than all open charges | Dr cash, bank or clearing; Cr 1110 (open charges); Cr 2110 Advance Rent Received (the excess) | The excess is not income until the period it pays for. Advance rent of more than two months is flagged (rent-control rule, section 16.1). |
| PR-12 | Apply advance rent to a new charge | Advance balance exists for the lease; new charge posted | Dr 2110; Cr 1110 | System posts when the charge is raised. |
| PR-13 | Security deposit received | Lease reference; held in the account named in the deposit policy | Dr 1030 Bank Deposits Held (or 1020 or 1040); Cr 2120 Tenant Deposit Liability | Never income. Receipt is marked Deposit. |
| PR-14 | Deposit refund | Lease ended; move-out check done; refund not more than the deposit | Dr 2120; Cr 1030 | Maker-checker. Evidence attached. |
| PR-15 | Deposit deducted or forfeited (damage or arrears) | Evidence attached; amount not more than the deposit; tenant notified | Dr 2120; Cr 1110 (arrears) or Cr 4400 Damage Recoveries; then Dr 1020, Cr 1030 to move the cash | Second approver required. |
| PR-16 | Mid-lease rent increase | Amendment approved; effective date set; local rent-increase limit checked (if one applies) | No entry on the approval date | Later charges use the new amount. If the lease is straight-line, the schedule is rebuilt and PR-04 and PR-05 catch up from the effective date. Closed periods never change. |
| PR-17 | Early lease end | Termination approved; end date set | Dr 1110, Cr 4300 Late and Penalty Income (early-exit fee, if any); release straight-line balances: Dr 2130, Cr 4100 or 4110 (deferred rent), or Dr 4100 or 4110, Cr 1130 (accrued rent) | Future charges are cancelled. The deposit then follows PR-14 or PR-15. |
| PR-18 | Late fee | Fee policy active; grace period passed; fee approved | Dr 1110; Cr 4300 | The fee must follow the lease and any local limit. |
| PR-19 | Vendor bill | Approved by a second person; expense class tagged; capital items go to an asset account | Dr 5xxx expense (or 1210 or 1230); Dr 1190 Input VAT only if allowed; Cr 2010 Accounts Payable | Over 25,000: two-step approval (prototype value). |
| PR-20 | Bill payment with withholding | Bill approved; owner is a withholding agent; goods over 20,000 or services over 10,000 in one transaction; no cash over 50,000 | Dr 2010; Cr 1020 (net); Cr 2220 Withholding Tax Payable (3%) | Placeholder rule until the adviser confirms it. |
| PR-21 | Tax payment | Return draft approved; payment reference entered | Dr 2220, 2230, 2240, 2250 or 1195; Cr 1020 | Maker-checker. |
| PR-22 | Depreciation | Asset in service; schedule active; period open | Dr 5900 Depreciation; Cr 1220 or 1240 | System run. The close approver reviews it. |
| PR-23 | Bad-debt allowance and write-off | Allowance follows the ageing policy; write-off needs collection evidence | Allowance: Dr 5700, Cr 1120. Write-off: Dr 1120, Cr 1110 | Write-off: GM step 1, Owner final. |
| PR-24 | Owner draw or contribution | Owner request; funds available | Draw: Dr 3200, Cr 1020. Contribution: Dr 1020, Cr 3100 | Finance Officer prepares; Owner approves. |
| PR-25 | Reversal of any entry | Original posted; reason given; period open (otherwise next open period) | Mirror of the original lines | Links to the original. Maker-checker. The corrected entry is posted separately. |
| PR-26 | Receipt void | Clerk requests; checker is Finance Officer, GM or Owner | Mirror of the receipt entry | Allocation is released and the charge reopens. The receipt number stays used. |
| PR-27 | Year-end close | All periods closed (12 months and Pagume); adviser review done | Dr 4xxx and Cr 5xxx accounts to 3300 Retained Earnings; Dr 3300, Cr 3200 Owner Drawings | GM step 1, Owner final. Next year opens with the balances carried forward. |

### 6.6 Tax engine

- A **rule pack** per jurisdiction: federal, then a local pack for each city or region.
- Rules by **owner type** (individual or company), **property use** (residential or commercial) and **date**.
- Calculations as **drafts only:** rental income tax estimate, VAT output and input, withholding, advance tax, stamp duty, property tax.
- A **tax calendar** with due dates in both calendars.
- A **workpaper** for each return draft showing every number and the journal lines behind it.
- Status chain for every rule: Draft, Adviser reviewed, Owner approved, Active. Active stays blocked until the ERCA gate passes, as it does today.

### 6.7 Close and controls

**Month-end checklist (all must pass before close):**

1. All receipts allocated or held as advance rent.
2. Mobile-money clearing is zero, or each difference is explained.
3. Bank reconciliation signed off.
4. Three-way deposit check agrees.
5. Straight-line accruals and depreciation posted.
6. Bad-debt allowance reviewed.
7. Tax estimate and calendar updated.
8. Trial balance agrees to sub-ledgers.
9. Second person approves. Period locks.

&#91;embedded content: month-end close · 9 steps, 1 decision\]

Any failed check sends the month back to step 1. After the lock, the GM can authorize a reopening, with a documented reason that goes into the audit trail. If the GM asked for it, the Owner authorizes.

**Other controls:**

- Warn or block cash over ETB 50,000.
- Approval thresholds by amount.
- Deposit refund needs evidence and a second approver.
- No one approves their own entry, bill or close.
- Reopening a closed period needs a reason and approval, and is logged.

#### Who can post, approve, close and reopen

The prototype's rules stay as they are: nobody approves their own request, the System Administrator never approves business items, and the Auditor is read-only. The module adds accounting actions on top of them. Rows marked *existing* come from the prototype's permission rules. Rows marked *proposed* are new and need the Owner's approval.

| Action | Prepares (maker) | Approves (checker) | Blocked |
| --- | --- | --- | --- |
| Record a receipt (existing) | Clerk, Collections Clerk, Finance Officer, GM | None needed. The system posts it. | Property Clerk, Auditor, System Administrator |
| Cash receipt over ETB 50,000 (proposed) | Nobody | Owner, with a written exception | Everyone else |
| Request a receipt void (existing) | Clerk, Collections Clerk | Finance Officer, GM or Owner | The requester; Auditor; System Administrator |
| Vendor bill up to ETB 25,000 (proposed) | Finance Officer | GM | The preparer; Assistant Manager; System Administrator |
| Vendor bill over ETB 25,000 (existing threshold) | Finance Officer | GM step 1, Owner step 2 | The preparer; Assistant Manager |
| Manual journal (proposed) | Finance Officer | GM; Owner as well if over 25,000 | The preparer; Clerks; System Administrator |
| Reversal (proposed) | Finance Officer or GM | A different person: GM or Owner | The preparer approving their own |
| Chart of accounts change (existing) | Finance Officer | GM step 1, Owner final for version 2 and later | The preparer; System Administrator |
| Tax rule draft and activation (existing) | Finance Officer | GM step 1, adviser review, Owner final. Active stays blocked until the ERCA gate passes. | The preparer; System Administrator |
| Bank and clearing reconciliation (proposed) | Finance Officer | GM signs off | The preparer signing off |
| Deposit refund or deduction (proposed) | Finance Officer | GM | The preparer; Clerks |
| Owner draw (proposed) | Finance Officer | Owner | The preparer |
| Bad-debt write-off (proposed) | Finance Officer | GM step 1, Owner final | The preparer |
| **Close a month** (proposed) | Finance Officer runs the checklist | GM approves; the period locks | The person who prepared any item in the checklist cannot approve the close |
| **Close the year** (proposed) | Finance Officer | GM step 1, Owner final, adviser review recorded | Same as month close |
| **Reopen a closed period** (proposed) | Finance Officer, with a documented reason | GM authorizes, with a documented reason (Technical Design Addendum 9.3). If the GM is the requester, the Owner authorizes. Adviser note needed if a return was already drafted from that period. | Everyone else. Only the latest closed period can be reopened without a second approval from the adviser. |
| Read ledgers, journals and audit log (existing) | Not applicable | Not applicable | Edit or delete is blocked for all roles |

#### Role by role

The prototype lists 11 role slots. As far as I read the code, 9 are configured and 2 are empty placeholders. It also has a Training Coordinator persona for the training system. All roles work inside one owner at a time.

| Role | Accounting authority |
| --- | --- |
| Owner / Director | Final approver for year-end close, owner draws and write-offs, and for any reopening the GM requests. Cannot switch to another owner and cannot create routine entries. |
| General Manager | Checker for most items above: journals, reversals, reconciliations, month close, step 1 on chart, tax and year-end. Cannot activate tax rules. Authorizes reopening a closed period, but not one they requested themselves. |
| Assistant Manager | Read-only on the ledger and ageing reports. No posting or approval in the accounting module. |
| Finance Officer | Maker for journals, reconciliations, depreciation, close checklist, tax workpapers and owner statements. Checker for receipt voids. Never approves own work. |
| Clerk | Records receipts and deposits. Can request voids. No approvals. |
| Collections Clerk | Records and allocates receipts, requests voids, prepares arrears lists. No approvals. |
| Property Clerk | Prepares lease schedules (amounts, free months, VAT type). Cannot record receipts. |
| System Administrator | Sets up ledger configuration and runs backup restore tests. Cannot post, approve, close or reopen. |
| Auditor / Read-only reviewer | Reads everything, exports reports, comments on exceptions. Every change button stays off. |
| Training Coordinator | Runs exercises and may reset the synthetic ledger (the reset is logged). No posting or approving. |
| Slot 10 (Legal or Tax Reviewer, unassigned) | Proposed use: adviser marks tax rules Adviser reviewed. Read and comment only. Stays inactive until the Owner approves the authority matrix. |
| Slot 11 (External Maintenance Supervisor, unassigned) | No accounting authority. Stays inactive. |

### 6.8 Screens

The current Finance page has four tabs: design, policies, journals and summary. Extend it:

- **Chart of Accounts** (exists, add status and tax class)
- **Journals** (real entries, filters, drill down to source)
- **Receivables and Deposits**
- **Clearing and Reconciliation**
- **Payables and Assets**
- **Tax Workpapers and Calendar**
- **Period Close**
- **Owner Statement and Reports**

Every number links back to its journal, and every journal links back to its source document.

### 6.9 Training layer

This is what makes it a training system and not only a prototype.

- Ready scenarios for OWN-ALPHA and OWN-BETA (a full month of rent, a late payer, a deposit dispute, a failed Telebirr settlement).
- Twelve guided exercises: raise rent, take a deposit, allocate a part-payment, settle a gateway batch, record a repair with withholding, reverse a wrong entry, close a month, refund a deposit, run the tax estimate, find a three-way difference, handle a free-month lease, try to post into a closed period (and see it blocked).
- Automatic checks: trial balance equals zero, subledgers agree to the ledger, the 45,400 tax test passes, self-approval fails, closed periods reject posting.
- A reset button that rebuilds the synthetic ledger from seed data.

## 7. Build plan

| Step | Content | Must pass before next step |
| --- | --- | --- |
| 0 | Owner and accountant decisions (section 8) | Written answers filed in the approval log |
| 1 | Ledger core: accounts, periods, journals, database rules | Debits equal credits; no edit or delete; period lock |
| 2 | Receivables: rent schedules, charges, receipts, allocation, deposits | Tenant ageing agrees to ledger |
| 3 | Clearing and reconciliation: gateway settlements, bank lines, three-way check | Clearing reaches zero on seed data |
| 4 | Payables, expenses, fixed assets, depreciation | Bill approval and withholding tests |
| 5 | Tax rule packs, drafts, calendar, workpapers | 45,400 test; locks hold until ERCA gate |
| 6 | Close checklist, owner statements, reports | Full month close on both owners |
| 7 | E-invoice fields and adapter (off by default) | Fields stored; adapter cannot activate without gate |

**Rough effort (estimate, not measured).** One full-stack developer plus an accountant for about one day a week. Steps 1 to 7 add up to about 17 to 23 person-weeks. Training content and bug fixing are extra.

| Step | Person-weeks | What drives the size |
| --- | --- | --- |
| 0 | About 0.5 of effort; 1 to 2 weeks elapsed | Waiting for owner and adviser answers |
| 1 | 2 to 3 | Tables, database rules, tests |
| 2 | 3 to 4 | Straight-line schedules, allocation, deposits |
| 3 | 3 to 4 | Gateway and bank file formats are not known yet |
| 4 | 2 to 3 | Bill approval, withholding, depreciation |
| 5 | 3 to 4 | Rule packs. Adviser review time is separate. |
| 6 | 3 | Close checklist, owner statements, reports |
| 7 | 1 to 2 | Fields only. The adapter stays off. |

**Step 8 (optional): salary and benefits,** section 17. About 3 to 4 person-weeks (estimate), after step 6. It needs the open decisions 11 and 12 in section 8 first.

## 8. Decisions needed from the owner and adviser

1. Is each owner an individual or a company? This changes the tax from progressive bands to a flat 30%.
2. Cash basis or accrual basis for management reports?
3. Is each owner VAT-registered, or likely to pass ETB 2,000,000? Are any leases commercial?
4. Which books category and accounting framework applies to each owner?
5. Does withholding apply to rent in your case, and are your owners withholding agents?
6. Where are tenant deposits held, and what are the refund and deduction rules?
7. Which local rules apply (Oromia, your city, or Addis Ababa) for lease registration, payment channels and local taxes?
8. Depreciation rates and the capitalisation limit.
9. Do you manage property for several owners as a company (trust-style, with a management fee), or only for one owner family? This decides whether to add a management-company ledger.
10. Who signs off tax rules and closes? Name the roles.

**Added later (11 to 17).**

- **11. Is payroll in scope?** SRS v1.1 lists full payroll and HR as out of scope and keeps open decision D-20. Your request here answers it as include, so the SRS needs a change request.
- **12. Who employs the four internal staff?** The title-holder, or the operating business whose legal form is still to be confirmed? The payroll posts to that entity's ledger.
- **13. Account numbering.** Keep this chart and update SRS Appendix A, or renumber to the SRS ranges?
- **14. Rent increases.** Which cap and which regulator apply in your city (section 16.1)?
- **15. Foreign currency.** Does any lease use foreign currency (section 16.2)?
- **16. Amharic wording.** Which words for invoice and for reconciliation (section 15)?
- **17. Pay rules.** Does the employee pension lower taxable pay, and when are PAYE and pension due? Does an individual's employment, rental and business income combine before the tax bands apply? (adviser)

## 9. Main risks

- **Rules change often.** Mitigation: versioned rule packs and a quarterly review.
- **Source conflicts.** Some sources disagree on rates, deductions and rent withholding. Mitigation: nothing activates without adviser evidence.
- **Training mistaken for production.** Mitigation: keep the banner, the synthetic data policy and the ERCA gate.
- **Two code bases.** The Node and SQLite prototype and the Django backend can drift. Mitigation: the posting rules and test cases are written once as data and shared.
- **Over-building.** Mitigation: the seven steps, each with a pass test.

## 10. Sources and what to verify (sections 1 to 9)

Research used: EY, PwC, KPMG, Grant Thornton and Chambers summaries of Income Tax Amendment Proclamation 1395/2025; EY and other notes on VAT Proclamation 1341/2024 and the MoF VAT exemption directive; Addis Fortune and Capital Ethiopia reports on the Addis Ababa rental directive and the Property Tax Proclamation 1365/2025; DMR Law Firm and Addis Insight notes on property tax; VATupdate, EDICOM and e-invoice.app on Directive 1142/2026; IFRS Foundation jurisdiction profile for Ethiopia; PwC tax administration summary on record keeping; IFRS 16 summaries from ICAEW, KPMG and IAS Plus; and trust accounting guides from property-management software vendors.

**Verify with the gazette or an adviser before use:** the exact rental tax schedule, the flat deduction for owners without books, withholding on rent, the current stamp duty rate, the final property tax rates for your city, and the e-invoicing start date.

File checked for this proposal: the uploaded AD-PRMS prototype (chart of accounts seed data, Finance page, billing and governance models).

## 11. Open-source options

*Researched 15 November 2026. Licenses and versions change. Read each project's LICENSE file and release notes before you use it.*

**Recommendation:** borrow small building blocks. Do not adopt a whole new system. AD-PRMS already has a Django and PostgreSQL backend, owner isolation and an approval engine. A new system would replace those.

| Option | What it is | Use for AD-PRMS | Check first |
| --- | --- | --- | --- |
| django-hordak | A double-entry model layer for Django. Its core models have integrity constraints. It is a foundation, not a full app. | **Best fit** for the ledger core (section 6.3). Add owner isolation, periods, posting rules and tax on top. | Its page lists tests up to Django 5.0. The backend uses Django 5.1, so test that first. Confirm the license file. |
| django-ledger | A fuller accounting engine: chart of accounts, income statement, balance sheet, cash flow, invoices and bills. It is actively released (version 0.7.8 seen). | **Reference** for statement layouts and invoice and bill flows. Not recommended as the base: it is large and has its own opinions. | One registry lists its license as "Vim", which looks wrong. Read the LICENSE file before using any code. |
| Odoo Community | An open-source modular ERP with accounting, used for real estate. | **Benchmark.** Run it beside the prototype and compare trial balance, deposits and month-end close. | The Ethiopian packs seen in the Odoo app store are paid and use a proprietary license. The open OCA module l10n\_et\_base (AGPL-3) only covers Ethiopic names and a VAT field, for old Odoo versions. |
| ERPNext | An open-source ERP on the Frappe framework (GPL v3). | **Benchmark**, same as Odoo. | Copying GPL or AGPL code into your product brings legal duties. Keep it as a comparison tool. |
| Formance Ledger | An open-source programmable double-entry ledger that runs as a separate service. | **Not now.** Revisit if payment volume grows a lot. | Sources disagree on its license. Check the repository. |
| TigerBeetle | An open-source database for double-entry transactions, built for very high volume (Apache 2.0 per one source). | **Not now.** It is a separate system and too much for about 10 users. | Adds a second system to run, secure and keep inside Ethiopia. |
| Ethiopian calendar libraries | JavaScript: ethiopian-calendar-date-converter (MIT). Python: ethiopian-calendar (version 0.1.0, standard library only) and py-ethiopian-date-converter. | Use **one** behind your own wrapper function so you can swap it later. | The Python packages are young. Write tests with known dates, including leap years and the short month Pagume. |

### Suggested path

1. **One-day spike.** Install django-hordak on Django 5.1 in a test project. Post the 20,000 ETB rent entry from section 5. Confirm that an unbalanced entry is rejected. Check that an owner field and a period lock can be added without editing the library.
2. **If the spike passes** and the license is acceptable, build the `ledger` app on it (build step 1).
3. **If it fails,** write the core tables yourself: Account, Period, JournalEntry, JournalLine and PostingRule. They are small.
4. **Benchmark.** Set up Odoo Community or ERPNext on a separate test machine. Run the same month of synthetic rent, deposits and expenses. Compare the reports with AD-PRMS.
5. **Calendar.** Pick one converter, wrap it, and add the date tests to the automatic checks in section 6.9.

### Rules for using open-source code

- Record the name, version and license of every library in the project's approval log.
- Pin exact versions. Do not allow automatic upgrades.
- Do not copy code from GPL or AGPL projects into AD-PRMS without a license review.
- Review security before any library touches real data. Keep production hosting inside Ethiopia (section 3, record keeping).
- Never let a library change posted journals. The database rules in section 6.3 still apply.

**Sources for this section:** package pages and repositories for django-hordak and django-ledger; Odoo Apps store listings for Ethiopia modules; the OCA l10n-ethiopia module page; project summaries for Formance and TigerBeetle; ERPNext cost and license summaries; npm and PyPI pages for the Ethiopian calendar packages.

## 12. Worked month: answer key for OWN-ALPHA

One training month for OWN-ALPHA has 19 journal entries and 1 failed payment that must create no entry. It ends with a trial balance of ETB 6,717,860 on each side. Use these figures as the expected results of the automatic tests. All data is synthetic.

### 12.1 Assumptions

- **Period:** Hidar 2019 E.C. (about 10 November to 9 December 2026). "Day" is the day of the Ethiopian month.
- **Owner:** OWN-ALPHA, treated as an individual on the accrual basis. Not VAT-registered, so no VAT lines appear. Acts as a withholding agent so that the withholding rule can be practised (training choice, not advice).
- **Telebirr fee:** 1.5% of each settled payment. Training value, not the real fee.
- **Depreciation:** buildings over 25 years and equipment over 5 years, straight line. Training values. The accountant sets the real rates.
- **Withholding:** 3% placeholder from section 3.

### 12.2 Opening balances

| Account | Debit | Credit |
| --- | --- | --- |
| 1020 Bank Operating | 300,000 |  |
| 1030 Bank Deposits Held | 100,000 |  |
| 1110 Rent Receivable (T3, last month) | 15,000 |  |
| 1210 Buildings | 6,000,000 |  |
| 1220 Accumulated Depreciation, Buildings |  | 600,000 |
| 1230 Furniture and Equipment | 120,000 |  |
| 1240 Accumulated Depreciation, Equipment |  | 36,000 |
| 2120 Tenant Deposit Liability |  | 100,000 |
| 3100 Owner Capital |  | 5,000,000 |
| 3300 Retained Earnings |  | 799,000 |
| **Total** | **6,535,000** | **6,535,000** |

### 12.3 Tenants and leases

| Tenant | Unit | Use | Rent a month | Deposit | How they behave this month |
| --- | --- | --- | --- | --- | --- |
| T1 | A1 | Residential | 18,000 | 36,000 | Pays by Telebirr, then pays next month early |
| T2 | A2 | Residential | 22,000 | 44,000 | Pays by bank transfer |
| T3 | A3 | Residential | 15,000 | 20,000 | Owes 15,000 from last month; pays 10,000 in cash |
| T4 | B1 | Commercial | 30,000 | 60,000 (paid this month) | New 12-month lease, first month free |

### 12.4 Journals

| Ref | Day | Rule | Event | Entry (ETB) |
| --- | --- | --- | --- | --- |
| J01 | 1 | PR-01 | Rent invoice, T1 | Dr 1110 18,000; Cr 4100 18,000 |
| J02 | 1 | PR-01 | Rent invoice, T2 | Dr 1110 22,000; Cr 4100 22,000 |
| J03 | 1 | PR-01 | Rent invoice, T3 | Dr 1110 15,000; Cr 4100 15,000 |
| J04 | 1 | PR-04 | Straight-line income, T4: 12 months x 30,000 less one free month = 330,000; 330,000 / 12 = 27,500 | Dr 1130 27,500; Cr 4110 27,500 |
| J05 | 3 | PR-07 | T1 pays 18,000 by Telebirr (receipt R-001) | Dr 1040 18,000; Cr 1110 18,000 |
| J06 | 4 | PR-06 | T2 pays 22,000 by bank transfer | Dr 1020 22,000; Cr 1110 22,000 |
| J07 | 5 | PR-13 | T4 deposit 60,000 into the deposit account | Dr 1030 60,000; Cr 2120 60,000 |
| J08 | 6 | PR-09 | Telebirr settles R-001; fee 270 | Dr 1020 17,730; Dr 5600 270; Cr 1040 18,000 |
| J09 | 8 | PR-10 | T3 pays 10,000 in cash, applied to last month's invoice first | Dr 1010 10,000; Cr 1110 10,000 |
| J10 | 9 | Transfer | Cash banked | Dr 1020 10,000; Cr 1010 10,000 |
| J11 | 10 | PR-19 | Plumbing bill for Unit A2, approved by a second person | Dr 5100 12,000; Cr 2010 12,000 |
| J12 | 12 | PR-20 | Pay the bill; 3% withholding = 360 | Dr 2010 12,000; Cr 1020 11,640; Cr 2220 360 |
| J13 | 14 | PR-11 | T1 pays next month's rent early by Telebirr (receipt R-002) | Dr 1040 18,000; Cr 2110 18,000 |
| E1 | 15 | PR-08 | T3 tries 5,000 by Telebirr; the gateway returns Failed | **No entry.** Audit event only. No receipt. |
| J14 | 16 | PR-09 | Telebirr settles R-002; fee 270 | Dr 1020 17,730; Dr 5600 270; Cr 1040 18,000 |
| J15 | 22 | Manual | Common-area utilities posted as 4,500 by mistake | Dr 5200 4,500; Cr 1020 4,500 |
| J16 | 23 | PR-25 | Reversal of J15, linked to it | Dr 1020 4,500; Cr 5200 4,500 |
| J17 | 23 | Manual | Utilities posted correctly | Dr 5200 4,200; Cr 1020 4,200 |
| J18 | 30 | PR-22 | Depreciation: buildings 6,000,000 / 25 years / 12; equipment 120,000 / 5 years / 12 | Dr 5900 22,000; Cr 1220 20,000; Cr 1240 2,000 |
| J19 | 30 | PR-24 | Owner draw | Dr 3200 50,000; Cr 1020 50,000 |

### 12.5 Trial balance at the end of Hidar

Accounts at zero: 1010 Cash on Hand, 1040 Mobile-Money Clearing, 2010 Accounts Payable.

| Account | Debit | Credit |
| --- | --- | --- |
| 1020 Bank Operating | 301,620 |  |
| 1030 Bank Deposits Held | 160,000 |  |
| 1110 Rent Receivable | 20,000 |  |
| 1130 Accrued Rent | 27,500 |  |
| 1210 Buildings | 6,000,000 |  |
| 1220 Accumulated Depreciation, Buildings |  | 620,000 |
| 1230 Furniture and Equipment | 120,000 |  |
| 1240 Accumulated Depreciation, Equipment |  | 38,000 |
| 2110 Advance Rent Received |  | 18,000 |
| 2120 Tenant Deposit Liability |  | 160,000 |
| 2220 Withholding Tax Payable |  | 360 |
| 3100 Owner Capital |  | 5,000,000 |
| 3200 Owner Drawings | 50,000 |  |
| 3300 Retained Earnings |  | 799,000 |
| 4100 Rental Income, Residential |  | 55,000 |
| 4110 Rental Income, Commercial |  | 27,500 |
| 5100 Repairs and Maintenance | 12,000 |  |
| 5200 Utilities | 4,200 |  |
| 5600 Bank and Gateway Charges | 540 |  |
| 5900 Depreciation | 22,000 |  |
| **Total** | **6,717,860** | **6,717,860** |

### 12.6 Month-end checks

| Check | Expected result |
| --- | --- |
| Mobile-money clearing | 0. J05 and J13 add 18,000 each; J08 and J14 remove 18,000 each. |
| Bank operating reconciliation | Statement and ledger both 301,620. Opening 300,000 + received 67,460 (22,000 + 17,730 + 10,000 + 17,730) - paid 65,840 (11,640 + 4,200 + 50,000). J15 and J16 cancel each other. |
| Deposit three-way check | Deposit bank account 160,000 = ledger 2120 160,000 = tenants T1 36,000 + T2 44,000 + T3 20,000 + T4 60,000. |
| Receivable ageing agrees to ledger | 20,000 (see 12.7) |
| Advance rent agrees to ledger | 18,000, all T1 |
| Accrued rent agrees to T4 lease schedule | 27,500 after month 1. From month 2, each invoice of 30,000 books income of 27,500 and uses 2,500 of accrued rent. After 11 months the balance is zero. |
| Withholding payable | 360, due within 30 days after month end (placeholder rule) |
| Balance sheet | Assets 5,971,120 = liabilities 178,360 + equity 5,792,760 |

### 12.7 Tenant ageing at day 30

J03 fell due on day 1, so it is 29 days overdue (1 to 30 days). The 15,000 from last month was paid down by 10,000 (oldest first). The 5,000 left is 59 days overdue (31 to 60 days).

| Tenant | Unit | 1 to 30 days | 31 to 60 days | Total receivable | Advance rent held |
| --- | --- | --- | --- | --- | --- |
| T1 | A1 | 0 | 0 | 0 | 18,000 |
| T2 | A2 | 0 | 0 | 0 | 0 |
| T3 | A3 | 15,000 | 5,000 | 20,000 | 0 |
| T4 | B1 | 0 | 0 | 0 | 0 |
| **Total** |  | **15,000** | **5,000** | **20,000** | **18,000** |

T4 has no receivable because the first month is free. Its 27,500 sits in Accrued Rent, not in tenant ageing.

### 12.8 Owner statement for Hidar

| Line | ETB |
| --- | --- |
| **Income (accrual)** |  |
| Rent, residential | 55,000 |
| Rent, commercial (straight-line) | 27,500 |
| Total income | 82,500 |
| **Expenses** |  |
| Repairs and maintenance | 12,000 |
| Utilities | 4,200 |
| Bank and gateway charges | 540 |
| Depreciation (no cash) | 22,000 |
| Total expenses | 38,740 |
| **Net income** | **43,760** |
| **Operating bank account** |  |
| Opening balance | 300,000 |
| Rent received, after gateway fees | 67,460 |
| Repair bill paid, after withholding | -11,640 |
| Utilities paid | -4,200 |
| Paid to owner | -50,000 |
| Closing balance | 301,620 |
| **Held for others or set aside** |  |
| Tenant deposits (separate account) | 160,000 |
| Advance rent held for T1 | 18,000 |
| Withholding tax to pay | 360 |
| **Not yet received** |  |
| Rent owed by T3 | 20,000 |
| Accrued rent, T4 (not cash) | 27,500 |

### 12.9 Automatic tests from this answer key

1. Opening balances total 6,535,000 on each side. Closing trial balance totals 6,717,860 on each side.
2. Net income is 43,760. Total income is 82,500. Total expenses are 38,740.
3. Mobile-money clearing is 0 and the bank operating balance is 301,620.
4. Rent Receivable is 20,000. Ageing shows 15,000 and 5,000 for T3 and nothing for the others.
5. The deposit three-way check agrees at 160,000.
6. The failed Telebirr payment (E1) creates 0 journals. The month has exactly 19 journals.
7. J15 and J16 net to zero, J16 links to J15, and J15 is still visible.
8. A Finance Officer cannot approve a bill they prepared (J11). The attempt is refused and logged.
9. After the month is closed, any new entry dated in the month is refused.
10. The tax test in section 5 returns 45,400 for taxable rental income of 200,000.

To practise VAT, copy this month, set OWN-ALPHA as VAT-registered after adviser sign-off, and bill T4 with 15% VAT using PR-03.

## 13. Rules register

Twenty-one rules (18 in the first table, 3 more in the second) still need adviser sign-off before any of them goes live. Change the status in the last column as each one is reviewed. "Checked" is the date I last looked at the sources, not the date an adviser confirmed it.

| Rule | What the module assumes | Source | Checked | Sign-off |
| --- | --- | --- | --- | --- |
| 1. Rental income tax bands (Amendment 1395/2025) | Individuals: 0%, 15%, 20%, 25%, 30%, 35% by band. Companies: flat 30%. Bands stored as dated data. | EY, PwC and KPMG tax summaries. PwC (July 2026) noted the gazetted text was still awaited, but a law firm reports publication in the Federal Negarit Gazette on 1 September 2025. | 15 Nov 2026 | Not reviewed |
| 2. Deductions and flat allowance | Books method and flat method shown side by side. No flat rate is fixed. | Older guidance (20%); press report on an Addis Ababa directive (35%) | 15 Nov 2026 | Not reviewed |
| 3. Withholding on rent | Not applied to rent until the adviser decides. | Press report on an Addis Ababa directive; the prototype's own seed note | 15 Nov 2026 | Not reviewed |
| 4. Withholding on purchases | 3% on goods over ETB 20,000 and services over ETB 10,000 per transaction. | EY and other tax alerts on the 2025 amendment | 15 Nov 2026 | Not reviewed |
| 5. VAT | Residential lease exempt. Threshold ETB 2,000,000. Commercial lease standard-rated at 15% once registered. | EY alert on VAT Proclamation 1341/2024. The commercial-lease point is my reading of it. | 15 Nov 2026 | Not reviewed |
| 6. Cash limit | Warn or block cash over ETB 50,000 per transaction. | Summaries of Amendment 1395/2025 (for example Grant Thornton). Whether it covers tenant rent receipts needs confirming. | 15 Nov 2026 | Not reviewed |
| 7. Advance tax | 25% of the prior year's tax, paid quarterly. Calendar reminders only. | EY and PwC summaries | 15 Nov 2026 | Not reviewed |
| 8. Filing deadlines | Held as rule data. No date is fixed in the module. | Not confirmed for the amended law | Not checked | Not reviewed |
| 9. Stamp duty on leases | 0.5% of value. Locked until confirmed. | Older tax guides | 15 Nov 2026 | Not reviewed |
| 10. Property tax | Rate per building set by the city, inside the federal range. | Summaries of Proclamation 1365/2025. Sources disagree on the upper limit. | 15 Nov 2026 | Not reviewed |
| 11. E-invoicing | Fields stored. Adapter off. | Reports on Directive 1142/2026. Rollout dates not yet issued. | 15 Nov 2026 | Not reviewed |
| 12. Record keeping | Nothing deleted. Records kept inside Ethiopia, in Amharic or English. | PwC tax administration summary | 15 Nov 2026 | Not reviewed |
| 13. Reporting framework | IFRS for SMEs shape. The accountant confirms it for each owner entity. | Proclamation 847/2014; IFRS Foundation profile for Ethiopia | 15 Nov 2026 | Not reviewed |
| 14. Rent control | One increase a year. Advance rent up to two months. Annual cap set by the city. Written notice of any increase. | The Reporter, Addis Fortune, Dablo Law Firm. The cap for your city was not found. | 16 Nov 2026 | Not reviewed |
| 15. Foreign-currency rent | All leases in ETB. | No clear rule found for private rent. National Bank rule: finance leases are paid in birr. | 16 Nov 2026 | Not reviewed |
| 16. Payroll tax and pension | Employee pension 7% and employer 11% of basic salary. PAYE bands and dates held as data. | PwC other-taxes summary. Tax-guide sites disagree on PAYE dates and on whether pension reduces taxable pay. | 16 Nov 2026 | Not reviewed |
| 17. Local lease registration and payment channels | Addis Ababa rules shown as an example. Your city's rules are added as a local pack. | Press reports on the Addis Ababa directive | 15 Nov 2026 | Not reviewed |
| 18. Depreciation rates and capitalisation limit | Training values only: buildings 25 years, equipment 5 years. | No source reviewed | Not checked | Not reviewed |

**Added with the payroll work (rules 19 to 21).**

| Rule | What the module assumes | Source | Checked | Sign-off |
| --- | --- | --- | --- | --- |
| 19. Combined income of individuals | Rental income may be added to employment and business income before the bands apply. The engine supports both ways until the adviser decides. | Chambers summary of Amendment 1395/2025. One source only. | 16 Nov 2026 | Not reviewed |
| 20. Salary PAYE bands and exempt or taxable pay | Bands, exempt allowances, taxable allowances and the 10% fringe-benefit cap as in section 17.5. | Workpay, Chambers, PwC and DLA Piper summaries; countrytaxcalc guides | 16 Nov 2026 | Not reviewed |
| 21. Labour-law pay rules | Overtime, leave, sick pay, maternity and paternity, public holidays and severance as in section 17.5. | Secondary guides that differ in places. The proclamation text itself was not read. | 16 Nov 2026 | Not reviewed |

## 14. Migration from the prototype

The prototype's 12 draft accounts per owner map cleanly to the new chart, and its charges and receipts can be replayed as journal entries. Two prototype journals (77,000 for Alpha and 38,000 for Beta) are display-only and are not migrated. In a training system, a failed migration can simply be reset and run again.

### 14.1 Account mapping

The prototype names accounts with an owner suffix, for example 1110-ALPHA. In the new design the owner comes from the ledger, so the suffix goes away.

| Prototype account (each owner) | New account | Change |
| --- | --- | --- |
| 1110 Rent Receivable | 1110 Rent Receivable | Same. Suffix dropped. |
| 1120 Allowance for Doubtful Accounts | 1120 | Same |
| 1190 Input VAT Placeholder | 1190 Input VAT | Stays locked |
| 2110 Unearned / Advance Rent | 2110 Advance Rent Received | Renamed |
| 2120 Refundable Tenant Deposit Liability | 2120 Tenant Deposit Liability | Renamed |
| 2210 Output VAT Placeholder | 2210 Output VAT | Stays locked |
| 2220 Withholding-Tax Placeholder | 2220 Withholding Tax Payable | Stays locked until the adviser decides |
| 3100 Owner Equity and Drawings Control | 3100 Owner Capital, 3200 Owner Drawings, 3300 Retained Earnings | Split in three |
| 4100 Rental Income | 4100 Residential, 4110 Commercial | Split by lease use |
| 4200 Service-Charge Placeholder | 4200 Service Charge Recoveries | Renamed |
| 5100 Repair and Maintenance | 5100 Repairs and Maintenance | Same |
| 5900 Depreciation Placeholder | 5900 Depreciation | Same |

New accounts with no prototype twin: 1010, 1020, 1030, 1040, 1130, 1195, 1210 to 1240, 2010, 2130, 2230 to 2250, 2310, 4300, 4400, 4900, 5200 to 5800 and 5950.

The prototype accounts are all in Draft status, version 1. Keep them as version 1. The new chart is version 2, effective on a date the Owner chooses. The Finance Officer proposes it and the GM and Owner approve it, as for any chart change.

### 14.2 Records to journals

| Prototype record | Becomes | Rule and checks |
| --- | --- | --- |
| Charge (period, due date, billed amount) | One journal per charge | PR-01 or PR-02 by lease use. Idempotency key is the charge ID, so a re-run cannot double-post. |
| Payment receipt (amount, method, reference) | One journal per receipt | PR-06 for cash and bank. PR-07 for Telebirr, Arifpay and QR. Dated on the payment date. |
| Receipt allocation | A link between receipt and charge | No journal of its own. Any excess over the open charges goes to Advance Rent (PR-11). |
| Charge status (Open, Partly Paid, Overdue, Paid) | Worked out from allocations, not stored | The stored paid amount must equal the sum of allocations. Differences are listed and fixed before posting. |
| Voided receipts | Reversal pair | PR-26 |
| Security deposit on a lease (placeholder) | Opening deposit entry | PR-13, with the deposit bank balance agreed to the ledger |
| The two prototype journals | Not migrated | Replaced by real entries. Their totals (77,000 and 38,000) become a check on the replayed charges. |

### 14.3 Order of work

1. Freeze changes and take a backup snapshot (the existing backup drill).
2. Create one ledger per owner and the new chart.
3. Post the opening-balance journal. Owner Capital is the balancing figure.
4. Replay charges and receipts in date order.
5. Compare: Rent Receivable equals the sum of open charges; ageing agrees; receipts posted equals receipts in the old table; the deposit three-way check agrees.
6. Approve the migration (maker-checker, Owner final) and lock the migration period.
7. Keep the old tables read-only. Because the ledger is append-only, a bad run is undone by restoring the snapshot or reversing the migration entries.

## 15. Glossary: English and Amharic

Use these words on every screen, report and training sheet. Terms marked *App* are already used in the prototype's Amharic screens. Terms marked *Draft* are my proposals. I found no reliable published Amharic accounting glossary, so an Amharic-speaking accountant must review every *Draft* term before it goes on a screen.

Two clashes need a decision:

- **Invoice and receipt.** The prototype uses ደረሰኝ for both. I suggest keeping ደረሰኝ for the receipt and using የክፍያ መጠየቂያ for the invoice.
- **Reconciliation.** The prototype shows it as ማረጋገጫ, which means confirmation. I suggest ማስታረቅ.

| English | Amharic | Source |
| --- | --- | --- |
| Ledger | መዝገብ | App |
| Double entry | ድርብ-መዝገብ | App |
| Journal entry | የጆርናል ግቤት | App |
| Account (ledger account) | የሂሳብ መደብ | App |
| Account code | የሂሳብ ኮድ | App |
| Chart of accounts | የሂሳብ መደቦች ዝርዝር | Draft |
| Debit / Credit | ዴቢት / ክሬዲት | Draft |
| Trial balance | የሙከራ ሚዛን | Draft |
| Balance sheet | የሀብትና የዕዳ መግለጫ | Draft |
| Income statement | የገቢ መግለጫ | App |
| Assets / Liabilities / Equity | ሀብት / ዕዳ / የባለቤትነት ድርሻ | Draft |
| Income / Expense | ገቢ / ወጪ | App (expense), Draft (income) |
| Net income | የተጣራ ገቢ | Draft |
| Rent | ኪራይ | App |
| Monthly rent | ወርሃዊ ኪራይ | App |
| Tenant / Lease / Owner | ተከራይ / ውል / ባለቤት | App |
| Owner scope | የባለቤት ክልል | App |
| Rent receivable | ተሰብሳቢ ኪራይ | Draft |
| Outstanding receivables | ያልተሰበሰበ ቀሪ | App |
| Receivables ageing | ያልተሰበሰቡ ሂሳቦች ዕድሜ ሪፖርት | App |
| Open balance | ቀሪ ሂሳብ | App |
| Accounts payable | ተከፋይ ሂሳብ | Draft |
| Invoice | ደረሰኝ ቁጥር (see clash above) | App |
| Receipt | ደረሰኝ | App |
| Payment | ክፍያ | App |
| Partial-payment allocation | የክፍያ ድልድል | App |
| Advance rent | የቅድሚያ ኪራይ | Draft |
| Security deposit | የዋስትና ተቀማጭ | App |
| Deposit liability | ለተከራይ የሚመለስ ተቀማጭ ዕዳ | Draft |
| Accrued rent | የተጠራቀመ ኪራይ | Draft |
| Deferred rent | የተላለፈ ኪራይ | Draft |
| Clearing account (mobile money) | መሸጋገሪያ ሂሳብ | Draft |
| Depreciation | የእርጅና ቅናሽ | Draft |
| Allowance for doubtful accounts | የተጠራጣሪ ሂሳብ መጠባበቂያ | Draft |
| Withholding tax | ተቀናሽ ታክስ | Draft |
| Tax | ታክስ | App |
| Reconciliation | ሂሳብ ማስታረቅ (prototype: ማረጋገጫ) | Draft |
| Three-way check | ሦስትዮሽ ማስታረቅ | Draft |
| Reversal | ተገላቢጦሽ ግቤት | Draft |
| Receipt void or reversal | የደረሰኝ መሰረዝ / መመለስ | App |
| Period | ወቅት | App |
| Period close / Reopen | የሂሳብ ወቅት መዝጊያ / እንደገና መክፈት | Draft |
| Maker / Checker | አዘጋጅ / አጽዳቂ | Draft |
| Approve | አጽድቅ | App |
| Draft (status) | ረቂቅ | App |
| Owner draw | የባለቤት ገንዘብ ማውጣት | Draft |
| Tenant statement | የተከራይ ሂሳብ መግለጫ | App |
| Audit log | የኦዲት መዝገብ | App |
| Backup and recovery | ምትኬና መልሶ ማግኛ | App |

## 16. Other items

Four more areas that touch the accounting module. Each is also in the rules register (section 13).

### 16.1 Rent-control limits

**What I found.** A federal residential rent-control law (Proclamation 1320/2016 E.C.) was approved in 2024. Press reports say it:

- bars more than one rent increase a year;
- limits advance rent to two months;
- has the city or regional regulator set an annual cap each June;
- exempts newly built housing from the cap for up to four years;
- requires written notice of an increase to the regulator and the tenant.

Addis Ababa set an 11.5% cap on renewed private residential leases for 2026/27. Renewal registration began on 8 July 2026 and the deadline was later moved to 5 September 2026. The reports cover Addis Ababa, Dire Dawa and other regional cities. **I did not find the cap or the regulator for your city.** Ask the city housing office.

**Design effect.**

- The rent-increase rule pack holds, per city and fiscal year: the cap, the once-a-year limit and any new-build exemption end date.
- A lease amendment (rule PR-16) is blocked if the increase is above the cap, if there was already an increase in the last 12 months, or if no written notice is attached.
- Advance rent of more than two months of rent is flagged in rule PR-11.
- Lease records carry a "newly built until" date.

### 16.2 Foreign-currency leases

**What I found.** I found no clear rule on private rent priced in foreign currency. The National Bank of Ethiopia has required that finance leases be paid in fixed birr amounts since 2021, and its rules limit which businesses may accept foreign currency inside Ethiopia. Foreign-exchange directives changed in July 2024 and again in February 2026.

**Design effect.** The ledger is in ETB only and every lease currency defaults to ETB. Do not build foreign-currency leases until an owner actually has one and the adviser says it is allowed. If that happens: store the contract currency and amount, post in ETB at the rate the bank used on the receipt date, and book the difference to a new exchange gain or loss account.

### 16.3 Payroll tax, if the office has staff

**What I found.**

- Pension is 7% of basic salary from the employee and 11% from the employer.
- Under Amendment 1395/2025, one tax guide gives a tax-free monthly pay of ETB 2,000 and a top rate of 35% above ETB 14,000 a month. Older pages still show the old ETB 600 floor.
- Sources disagree on the PAYE payment date (the 8th of the next month or the end of the month) and on whether the employee pension reduces taxable pay.

All of these are in the rules register as open.

**Design effect.** Section 17 now covers salary and benefits in full. This manual journal is the simplest version of the same entry:

| Debit | Credit |
| --- | --- |
| 6100 Salaries and Wages (gross pay) | 2260 PAYE Payable |
| 6130 Employer Pension (11%) | 2270 Pension Payable (employee 7% plus employer 11%) |
|  | 1020 Bank Operating (net pay) |

If the staff belong to a management company, that company needs its own ledger (open decision 9 in section 8).

### 16.4 Backup restore tests

A backup only counts if a restore gives back the same books. The prototype already has backup records and a backup drill that needs GM and Owner approval. Add these checks to every restore.

**Store in each backup's manifest:** per ledger, the journal count, total debits, total credits, the closing trial balance totals of the last closed month, and the last audit-chain hash.

**After each restore into a clean database:**

1. Journal counts and totals equal the manifest.
2. Debits equal credits in every ledger and every period.
3. The trial balance of the last closed month equals the saved one.
4. The audit chain verifies from the first event to the last.
5. Sub-ledgers agree to the control accounts: ageing equals 1110, deposits equal 2120, clearing equals 1040.
6. A closed period still rejects a new entry.
7. A user of OWN-ALPHA still sees nothing of OWN-BETA.
8. The restore time is recorded.

Any difference means the drill failed. For training, restore the worked month from section 12: the trial balance must come back as 6,717,860 on each side. Run the drill before and after each build step and once a quarter.

**Sources for this section:** The Reporter, Addis Fortune and Dablo Law Firm on rent control; VOA, Reuters-based reports and National Bank of Ethiopia notices on foreign exchange and leases; PwC's other-taxes summary and tax-guide sites for payroll.

## 17. Salary and benefits (staff payroll)

### 17.1 Where it stands

Short answer: AD-PRMS does not have salary and benefits yet.

- **The SRS leaves it out.** SRS v1.1 lists full enterprise HR and payroll as out of scope. It keeps open decision D-20: "Should payroll, employee tax and full fixed-asset depreciation be included now or deferred?" It also asks whether payroll, pension and employment-tax functions belong in this system or in another payroll system.
- **The prototype has no payroll screens.** The only trace is a "Salary and Wages" line in a business-income tax sample form.
- **My earlier sections only allowed a manual salary journal** (section 16.3).

Your request answers D-20 as *include*. That needs a change request to the SRS. The scope proposed here is payroll for the office's own staff. The SRS plans for four internal staff roles. It is not full HR: no recruitment, performance reviews or time-clock hardware.

### 17.2 Who is the employer

The design documents describe one individual title-holder with five buildings, and a separate operating business (Abdulwehab Dekebo Trading) whose legal form and relationship to the title-holder are still to be confirmed. Management fees and inter-party balances stay disabled until legal advice is given.

So each employee record has an **employer entity**, and a payroll run posts to that entity's ledger. There is no sharing of staff cost between owners in the first release. Whether staff cost can be set against the title-holder's rental income is a question for the tax adviser.

### 17.3 What the module includes

| Part | What it holds |
| --- | --- |
| Employee record | Employer entity, TIN, pension number, start date, probation end date, status, bank or mobile-money account for pay |
| Pay items | Basic salary; allowances (transport, hardship, housing, position); overtime; bonus and commission. Each item is tagged taxable, exempt or fringe, and pensionable or not. |
| Benefits | Employer-paid medical cost; paid leave (annual, sick, maternity, paternity, public holidays); staff advances; severance (only if the Owner sets a policy) |
| Deductions | PAYE; employee pension 7%; advance recovery; other agreed deductions |
| Employer cost | Pension 11% |
| Leave ledger | Entitlement, days taken and balance for each employee |
| Overtime sheet | Hours by type (ordinary day, night, rest day, public holiday) with the legal limits |
| Payroll run | Monthly, by Ethiopian month: calculate, review, approve, post |
| Payslip | Bilingual, with pay items, deductions and net pay |
| Remittances | PAYE and pension amounts owed and paid, with due dates in the tax calendar |
| Year-end | Annual payroll summary for each employee |
| Reports | Payroll register, staff cost by month, liabilities, leave balances |

### 17.4 How a month works

1. **Inputs.** The Finance Officer enters overtime hours, leave taken, advances and one-off items.
2. **Calculate.** The engine picks the rule versions in force for the month. It works out pay, taxable pay, PAYE, pension and net pay for each employee.
3. **Review and approve.** The Finance Officer checks the payroll register and the GM approves. Nobody approves a run that contains a change to their own pay.
4. **Post.** One journal for the run (rule PR-28).
5. **Pay.** Net pay goes out by bank or mobile money (PR-29). Cash over ETB 50,000 per person is blocked.
6. **Remit.** PAYE (PR-30) and pension (PR-31) are paid by their due dates.
7. **Payslips** are issued and the run is locked.

### 17.5 Rules the engine uses

All of these are data with effective dates. All need adviser sign-off (rules 20 and 21 in section 13). The sources are secondary guides and law-firm summaries. I did not read the proclamation texts themselves.

| Rule | What the module assumes | Do sources agree? |
| --- | --- | --- |
| PAYE bands, monthly (Amendment 1395/2025) | 0 to 2,000: 0%. To 4,000: 15%. To 7,000: 20%. To 10,000: 25%. To 14,000: 30%. Above 14,000: 35%. | Yes, in the recent summaries. Older pages still show the old ETB 600 floor. |
| Pension | Employee 7% and employer 11% of basic salary, no cap | Yes on the rates. Sources differ on whether the 7% lowers taxable pay, so the engine has a switch. |
| Exempt pay | Transport allowance in lieu of transport, hardship allowance, employer-paid actual medical treatment | The size limit on transport allowance is not confirmed. An older rule was the lesser of ETB 2,200 and 25% of salary. |
| Taxable pay | Salary, wages, housing and position allowances, bonus, commission, gratuity, fringe benefits. Tax on fringe benefits is capped at 10% of salary income. | One main source (PwC). |
| Overtime | Ordinary day x1.25; night x1.5 (one source says x1.75); weekly rest day x2; public holiday x2.5. Limit 4 hours a day and 12 hours a week. The hourly-rate divisor must be confirmed. | Differs on night and rest-day rates. |
| Annual leave | 16 working days after the first year, plus 1 day for every two further years | Maximum differs by source (30 working days in one). |
| Sick leave | Paid with a medical certificate, in tiers | Pay rate after the first month differs between sources. |
| Maternity and paternity | Maternity 120 days (30 before, 90 after) at full pay. Paternity 3 days. | One source says 5 days for paternity. |
| Public holidays | 13 paid days a year | One source. |
| Severance | For listed endings, after probation, for employees not eligible for pension (Articles 39 and 40) | The amount differs between sources. Accrue only if the Owner sets a policy. |
| Probation | Up to 60 working days | Yes. |
| Payment dates | PAYE and pension due dates held as data | Sources differ (the 8th of the next month, or month end). |

### 17.6 Accounts

Staff pay follows the SRS 6000 range for operating expenses.

- **Expenses:** 6100 Salaries and Wages; 6110 Allowances; 6120 Overtime; 6130 Employer Pension; 6140 Other Staff Benefits (medical cost, leave and severance charges).
- **Liabilities:** 2260 PAYE Payable; 2270 Pension Payable; 2275 Salaries Payable (net pay owed before it is paid); 2280 Accrued Leave; 2285 Accrued Severance.
- **Asset:** 1150 Staff Advances.

### 17.7 Posting rules PR-28 to PR-34

| ID | Event | Entry | Notes |
| --- | --- | --- | --- |
| PR-28 | Payroll run approved | Dr 6100 basic pay; Dr 6110 allowances; Dr 6120 overtime; Dr 6140 benefits given; Dr 6130 employer pension. Cr 2260 PAYE; Cr 2270 pension (employee 7% plus employer 11%); Cr 1150 advances recovered; Cr 2275 net pay. | One journal per run and per employer entity. GM approves. Blocked if a needed rule version is missing. |
| PR-29 | Net pay paid | Dr 2275; Cr 1020 Bank Operating (or 1040 for a mobile-money payout) | Cash over 50,000 per person is blocked. |
| PR-30 | PAYE paid | Dr 2260; Cr 1020 | Return draft approved first. |
| PR-31 | Pension paid | Dr 2270; Cr 1020 | Same approval. |
| PR-32 | Staff advance given | Dr 1150; Cr 1020 or 1010 | GM approves. Recovered through PR-28. |
| PR-33 | Leave or severance accrual (only if the Owner sets the policy) | Dr 6140; Cr 2280 or 2285. Payout: Dr 2280 or 2285; Cr 1020. | Policy approved first. |
| PR-34 | Medical cost reimbursed | Dr 6140; Cr 1020 | Receipt attached. Treated as exempt only for the actual cost. |

### 17.8 Worked example (ETB)

Staff A, one month. Basic salary 12,000. Transport allowance 1,500, treated as exempt (assumption). No overtime.

| Line | ETB |
| --- | --- |
| Basic salary | 12,000 |
| Transport allowance (exempt) | 1,500 |
| Taxable pay | 12,000 |
| PAYE: 2,000 x 0% + 2,000 x 15% + 3,000 x 20% + 3,000 x 25% + 2,000 x 30% | 0 + 300 + 600 + 750 + 600 = 2,250 |
| Employee pension, 7% of 12,000 | 840 |
| **Net pay:** 12,000 + 1,500 - 2,250 - 840 | **10,410** |
| Employer pension, 11% of 12,000 | 1,320 |
| **Cost to the employer:** 12,000 + 1,500 + 1,320 | **14,820** |

**Journal for the run (PR-28):** Dr 6100 12,000; Dr 6110 1,500; Dr 6130 1,320 (total 14,820). Cr 2260 2,250; Cr 2270 2,160; Cr 2275 10,410 (total 14,820).

**Payments:** PR-29 pays 10,410. PR-30 pays 2,250. PR-31 pays 2,160. After all three, accounts 2260, 2270 and 2275 are at zero.

**If the adviser decides the employee pension lowers taxable pay,** taxable pay is 11,160 and PAYE is 1,998 (300 + 600 + 750 + 348). Net pay is then 10,662. This is why the engine keeps it as a setting.

### 17.9 Who can do what

Salaries are confidential. Only people who need to see them can.

| Action | Prepares | Approves | Blocked |
| --- | --- | --- | --- |
| Add an employee or change a pay rate | Finance Officer | GM. The Owner approves changes to the GM's or Finance Officer's own pay. | The person whose pay changes |
| Run payroll | Finance Officer | GM | The preparer. No one can approve a run that includes their own pay change. |
| Pay net salaries, pay PAYE and pension | Finance Officer | GM | The preparer |
| Reopen a closed payroll month | Finance Officer, with a documented reason | GM, or the Owner if the GM asked | Everyone else |
| See salaries and payslips | Owner, GM, Finance Officer. Each employee sees only their own payslip. | Not applicable | Clerks, Property Clerk, Assistant Manager and System Administrator see no pay data. The Auditor is read-only. |

Pay data is masked in exports and logs unless the user has the pay permission, and every view of it is in the audit trail.

### 17.10 Automatic tests

1. Staff A: PAYE 2,250, net pay 10,410, employer cost 14,820.
2. The run journal balances at 14,820 on each side. After the three payments, 2260, 2270 and 2275 are zero.
3. With the pension-lowers-tax switch on, PAYE is 1,998 and net pay is 10,662.
4. A pay change effective next month does not change a locked month.
5. The preparer cannot approve a run that contains their own pay change.
6. A run is blocked if a rule version is missing for that month.
7. A Clerk and the Property Clerk cannot open any pay data. The Auditor cannot change any.
8. A cash salary payment over 50,000 is refused.

### 17.11 What this needs

- **Build size:** optional step 8 in section 7, about 3 to 4 person-weeks (estimate).
- **Decisions:** items 11, 12 and 17 in section 8.
- **Rules to confirm:** rules 19 to 21 in section 13.

**Sources for this section:** SRS v1.1 and the Technical Design Package (scope, staff count, operating business); PwC income-determination summary; Workpay, Chambers, Dablo Law Firm and DLA Piper notes on Amendment 1395/2025; countrytaxcalc PAYE guides; RemotePeople, AddisTools and StudyRaid summaries of Labour Proclamation 1156/2019.
