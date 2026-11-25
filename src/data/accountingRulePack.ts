import {
  AccountingPeriod,
  AccountingPolicyItem,
  LedgerAccountV2,
  OwnerId,
  PostingRuleDefinition,
  TaxCalendarObligation,
  TaxRuleRegisterItem,
  VersionedTaxRulePack,
} from '../types/prms';

export const ENABLE_LIVE_TAX_INVOICING = false as const;

export const ETHIOPIAN_FISCAL_MONTHS_2019: {
  monthIndex: number;
  monthNameEn: string;
  monthNameAm: string;
  periodCode: string;
  startDateGc: string;
  endDateGc: string;
}[] = [
  { monthIndex: 1, monthNameEn: 'Meskerem', monthNameAm: 'መስከረም', periodCode: '2019-01', startDateGc: '2026-09-11', endDateGc: '2026-10-10' },
  { monthIndex: 2, monthNameEn: 'Tikimt', monthNameAm: 'ጥቅምት', periodCode: '2019-02', startDateGc: '2026-10-11', endDateGc: '2026-11-09' },
  { monthIndex: 3, monthNameEn: 'Hidar', monthNameAm: 'ኅዳር', periodCode: '2019-03', startDateGc: '2026-11-10', endDateGc: '2026-12-09' },
  { monthIndex: 4, monthNameEn: 'Tahsas', monthNameAm: 'ታኅሣሥ', periodCode: '2019-04', startDateGc: '2026-12-10', endDateGc: '2027-01-08' },
  { monthIndex: 5, monthNameEn: 'Tir', monthNameAm: 'ጥር', periodCode: '2019-05', startDateGc: '2027-01-09', endDateGc: '2027-02-07' },
  { monthIndex: 6, monthNameEn: 'Yekatit', monthNameAm: 'የካቲት', periodCode: '2019-06', startDateGc: '2027-02-08', endDateGc: '2027-03-09' },
  { monthIndex: 7, monthNameEn: 'Megabit', monthNameAm: 'መጋቢት', periodCode: '2019-07', startDateGc: '2027-03-10', endDateGc: '2027-04-08' },
  { monthIndex: 8, monthNameEn: 'Miyazia', monthNameAm: 'ሚያዝያ', periodCode: '2019-08', startDateGc: '2027-04-09', endDateGc: '2027-05-08' },
  { monthIndex: 9, monthNameEn: 'Ginbot', monthNameAm: 'ግንቦት', periodCode: '2019-09', startDateGc: '2027-05-09', endDateGc: '2027-06-07' },
  { monthIndex: 10, monthNameEn: 'Sene', monthNameAm: 'ሰኔ', periodCode: '2019-10', startDateGc: '2027-06-08', endDateGc: '2027-07-07' },
  { monthIndex: 11, monthNameEn: 'Hamle', monthNameAm: 'ሐምሌ', periodCode: '2019-11', startDateGc: '2027-07-08', endDateGc: '2027-08-06' },
  { monthIndex: 12, monthNameEn: 'Nehase', monthNameAm: 'ነሐሴ', periodCode: '2019-12', startDateGc: '2027-08-07', endDateGc: '2027-09-05' },
  { monthIndex: 13, monthNameEn: 'Pagume', monthNameAm: 'ጳጉሜን', periodCode: '2019-13', startDateGc: '2027-09-06', endDateGc: '2027-09-10' },
];

export function buildOwnerFiscalPeriods2019(ownerId: OwnerId): AccountingPeriod[] {
  return ETHIOPIAN_FISCAL_MONTHS_2019.map((m) => ({
    id: `PER-${ownerId}-${m.periodCode}`,
    ownerId,
    fiscalYearEc: 2019,
    monthIndex: m.monthIndex,
    monthNameEn: m.monthNameEn,
    monthNameAm: m.monthNameAm,
    periodCode: m.periodCode,
    startDateGc: m.startDateGc,
    endDateGc: m.endDateGc,
    status: m.monthIndex < 3 ? 'Closed' : 'Open',
    ...(m.monthIndex < 3
      ? {
          closedAt: m.endDateGc,
          closedBy: 'Demo General Manager',
          lastTrialBalanceCents: 653500000,
        }
      : {}),
  }));
}

interface AccountBlueprintRow {
  code: string;
  name: string;
  nameAm: string;
  category: LedgerAccountV2['category'];
  subCategory: string;
  normalBalance: 'Debit' | 'Credit';
  taxDeductibleClass: LedgerAccountV2['taxDeductibleClass'];
  isTaxLocked: boolean;
  isSystemControlled: boolean;
  mappedFromV1Code?: string;
}

// Canonical Steps 1–7 Chart of Accounts (Proposal §6.4 — keeps 5xxx codes 5600/5800/5900; excludes Step 8 payroll accounts)
export const CANONICAL_COA_V2_TEMPLATE: AccountBlueprintRow[] = [
  // Assets
  { code: '1010', name: 'Cash on Hand', nameAm: 'በእጅ ያለ ጥሬ ገንዘብ', category: 'Assets', subCategory: 'Cash & Bank', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false },
  { code: '1020', name: 'Bank Operating', nameAm: 'መደበኛ የባንክ ሂሳብ', category: 'Assets', subCategory: 'Cash & Bank', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false },
  { code: '1030', name: 'Bank Deposits Held', nameAm: 'የተከራይ ዋስትና የባንክ ሂሳብ', category: 'Assets', subCategory: 'Trust / Custody Bank', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true },
  { code: '1040', name: 'Mobile-Money Clearing', nameAm: 'የሞባይል ገንዘብ መሸጋገሪያ ሂሳብ', category: 'Assets', subCategory: 'Gateway Clearing', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true },
  { code: '1110', name: 'Rent Receivable', nameAm: 'ተሰብሳቢ ኪራይ', category: 'Assets', subCategory: 'Receivables', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true, mappedFromV1Code: '1110' },
  { code: '1120', name: 'Allowance for Doubtful Accounts', nameAm: 'የተጠራጣሪ ሂሳብ መጠባበቂያ', category: 'Assets', subCategory: 'Receivables Contra', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false, mappedFromV1Code: '1120' },
  { code: '1130', name: 'Accrued Rent', nameAm: 'የተጠራቀመ ኪራይ (Straight-Line)', category: 'Assets', subCategory: 'Lease Accruals', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true },
  { code: '1190', name: 'Input VAT', nameAm: 'ተቀናሽ ተ.እ.ታ (Input VAT)', category: 'Assets', subCategory: 'Tax Receivable', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: true, isSystemControlled: true, mappedFromV1Code: '1190' },
  { code: '1195', name: 'Advance Income Tax Paid', nameAm: 'በቅድሚያ የተከፈለ የገቢ ግብር', category: 'Assets', subCategory: 'Tax Receivable', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: true, isSystemControlled: true },
  { code: '1210', name: 'Buildings (Investment Property)', nameAm: 'ሕንጻዎች (የኢንቨስትመንት ንብረት)', category: 'Assets', subCategory: 'Fixed Assets', normalBalance: 'Debit', taxDeductibleClass: 'Capital', isTaxLocked: false, isSystemControlled: false },
  { code: '1220', name: 'Accumulated Depreciation, Buildings', nameAm: 'የተጠራቀመ የሕንጻ እርጅና ቅናሽ', category: 'Assets', subCategory: 'Accumulated Depreciation', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true },
  { code: '1230', name: 'Furniture and Equipment', nameAm: 'የቤት ዕቃዎችና መሣሪያዎች', category: 'Assets', subCategory: 'Fixed Assets', normalBalance: 'Debit', taxDeductibleClass: 'Capital', isTaxLocked: false, isSystemControlled: false },
  { code: '1240', name: 'Accumulated Depreciation, Equipment', nameAm: 'የተጠራቀመ የመሣሪያዎች እርጅና ቅናሽ', category: 'Assets', subCategory: 'Accumulated Depreciation', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true },

  // Liabilities
  { code: '2010', name: 'Accounts Payable', nameAm: 'ተከፋይ ሂሳብ', category: 'Liabilities', subCategory: 'Payables', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false },
  { code: '2110', name: 'Advance Rent Received', nameAm: 'የተቀበለ የቅድሚያ ኪራይ', category: 'Liabilities', subCategory: 'Deferred Revenue', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true, mappedFromV1Code: '2110' },
  { code: '2120', name: 'Tenant Deposit Liability', nameAm: 'ለተከራይ የሚመለስ ተቀማጭ ዕዳ', category: 'Liabilities', subCategory: 'Security Deposits', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true, mappedFromV1Code: '2120' },
  { code: '2130', name: 'Deferred Rent', nameAm: 'የተላለፈ ኪራይ', category: 'Liabilities', subCategory: 'Deferred Revenue', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true },
  { code: '2210', name: 'Output VAT', nameAm: 'ተሰብሳቢ ተ.እ.ታ (Output VAT)', category: 'Liabilities', subCategory: 'Tax Liabilities', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: true, isSystemControlled: true, mappedFromV1Code: '2210' },
  { code: '2220', name: 'Withholding Tax Payable', nameAm: 'ተከፋይ ተቀናሽ ታክስ (WHT)', category: 'Liabilities', subCategory: 'Tax Liabilities', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true, mappedFromV1Code: '2220' },
  { code: '2230', name: 'Income Tax Payable', nameAm: 'ተከፋይ የገቢ ግብር', category: 'Liabilities', subCategory: 'Tax Liabilities', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: true, isSystemControlled: true },
  { code: '2240', name: 'Property Tax Payable', nameAm: 'ተከፋይ የንብረት ግብር', category: 'Liabilities', subCategory: 'Tax Liabilities', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true },
  { code: '2250', name: 'Stamp Duty Payable', nameAm: 'ተከፋይ የቴምብር ቀረጥ', category: 'Liabilities', subCategory: 'Tax Liabilities', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: true, isSystemControlled: true },
  { code: '2310', name: 'Loans Payable', nameAm: 'ተከፋይ ብድሮች', category: 'Liabilities', subCategory: 'Long-Term Debt', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false },

  // Equity
  { code: '3100', name: 'Owner Capital', nameAm: 'የባለቤት ካፒታል', category: 'Equity', subCategory: 'Capital', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false, mappedFromV1Code: '3100' },
  { code: '3200', name: 'Owner Drawings', nameAm: 'የባለቤት ገንዘብ ማውጣት', category: 'Equity', subCategory: 'Drawings', normalBalance: 'Debit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false, mappedFromV1Code: '3100' },
  { code: '3300', name: 'Retained Earnings', nameAm: 'ያልተከፋፈለ ትርፍ', category: 'Equity', subCategory: 'Retained Earnings', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true, mappedFromV1Code: '3100' },

  // Income
  { code: '4100', name: 'Rental Income, Residential', nameAm: 'የመኖሪያ ቤት ኪራይ ገቢ', category: 'Income', subCategory: 'Lease Revenue', normalBalance: 'Credit', taxDeductibleClass: 'Exempt', isTaxLocked: false, isSystemControlled: true, mappedFromV1Code: '4100' },
  { code: '4110', name: 'Rental Income, Commercial', nameAm: 'የንግድ ኪራይ ገቢ', category: 'Income', subCategory: 'Lease Revenue', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: true, mappedFromV1Code: '4100' },
  { code: '4200', name: 'Service Charge Recoveries', nameAm: 'የአገልግሎት ክፍያ ማካካሻ ገቢ', category: 'Income', subCategory: 'Recoveries', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false, mappedFromV1Code: '4200' },
  { code: '4300', name: 'Late Fee Income', nameAm: 'የዘገየ ክፍያ ቅጣት ገቢ', category: 'Income', subCategory: 'Penalties & Fees', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false },
  { code: '4400', name: 'Damage Recoveries', nameAm: 'የጉዳት ማካካሻ ገቢ', category: 'Income', subCategory: 'Recoveries', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false },
  { code: '4900', name: 'Other Income', nameAm: 'ሌላ ገቢ', category: 'Income', subCategory: 'Misc Income', normalBalance: 'Credit', taxDeductibleClass: 'N/A', isTaxLocked: false, isSystemControlled: false },

  // Expenses (5xxx preserved per confirmed decision)
  { code: '5100', name: 'Repairs and Maintenance', nameAm: 'የጥገናና እድሳት ወጪ', category: 'Expenses', subCategory: 'Operating Maintenance', normalBalance: 'Debit', taxDeductibleClass: 'Deductible', isTaxLocked: false, isSystemControlled: false, mappedFromV1Code: '5100' },
  { code: '5200', name: 'Utilities', nameAm: 'የመብራትና ውሃ ወጪ', category: 'Expenses', subCategory: 'Utilities', normalBalance: 'Debit', taxDeductibleClass: 'Deductible', isTaxLocked: false, isSystemControlled: false },
  { code: '5300', name: 'Insurance', nameAm: 'የኢንሹራንስ ወጪ', category: 'Expenses', subCategory: 'Property Insurance', normalBalance: 'Debit', taxDeductibleClass: 'Deductible', isTaxLocked: false, isSystemControlled: false },
  { code: '5400', name: 'Property Tax and City Fees', nameAm: 'የንብረት ግብርና የከተማ ክፍያዎች', category: 'Expenses', subCategory: 'Municipal Fees', normalBalance: 'Debit', taxDeductibleClass: 'Deductible', isTaxLocked: false, isSystemControlled: false },
  { code: '5410', name: 'Land Lease Fees', nameAm: 'የመሬት ሊዝ ክፍያ', category: 'Expenses', subCategory: 'Land Lease', normalBalance: 'Debit', taxDeductibleClass: 'Deductible', isTaxLocked: false, isSystemControlled: false },
  { code: '5500', name: 'Management and Staff', nameAm: 'የአስተዳደርና ሠራተኞች ወጪ', category: 'Expenses', subCategory: 'Administration', normalBalance: 'Debit', taxDeductibleClass: 'Partially Deductible', isTaxLocked: false, isSystemControlled: false },
  { code: '5600', name: 'Bank and Gateway Charges', nameAm: 'የባንክና ጌትዌይ አገልግሎት ክፍያ', category: 'Expenses', subCategory: 'Financial Charges', normalBalance: 'Debit', taxDeductibleClass: 'Deductible', isTaxLocked: false, isSystemControlled: false },
  { code: '5700', name: 'Bad Debt', nameAm: 'የተበላሸ ዕዳ ወጪ', category: 'Expenses', subCategory: 'Credit Loss', normalBalance: 'Debit', taxDeductibleClass: 'Partially Deductible', isTaxLocked: false, isSystemControlled: false },
  { code: '5800', name: 'Interest', nameAm: 'የብድር ወለድ ወጪ', category: 'Expenses', subCategory: 'Financing Cost', normalBalance: 'Debit', taxDeductibleClass: 'Deductible', isTaxLocked: false, isSystemControlled: false },
  { code: '5900', name: 'Depreciation', nameAm: 'የእርጅና ቅናሽ ወጪ', category: 'Expenses', subCategory: 'Depreciation', normalBalance: 'Debit', taxDeductibleClass: 'Deductible', isTaxLocked: false, isSystemControlled: true, mappedFromV1Code: '5900' },
  { code: '5950', name: 'Penalties (Non-Deductible)', nameAm: 'ቅጣቶች (ከታክስ የማይቀነስ)', category: 'Expenses', subCategory: 'Non-Deductible', normalBalance: 'Debit', taxDeductibleClass: 'Non-Deductible', isTaxLocked: false, isSystemControlled: false },
];

export function buildLedgerAccountsV2(ownerId: OwnerId, vatRegistered = false): LedgerAccountV2[] {
  return CANONICAL_COA_V2_TEMPLATE.map((row) => ({
    id: `COA2-${ownerId}-${row.code}`,
    ownerId,
    code: row.code,
    name: row.name,
    nameAm: row.nameAm,
    category: row.category,
    subCategory: row.subCategory,
    normalBalance: row.normalBalance,
    taxDeductibleClass: row.taxDeductibleClass,
    isTaxLocked:
      row.code === '1190' || row.code === '2210'
        ? !vatRegistered
        : row.isTaxLocked,
    isSystemControlled: row.isSystemControlled,
    effectiveFrom: '2026-07-08', // 1 Hamle 2018 / FY 2019 baseline
    status: 'Active',
    version: 2,
    mappedFromV1Code: row.mappedFromV1Code,
  }));
}

export const POSTING_RULES_CATALOG: PostingRuleDefinition[] = [
  { ruleId: 'PR-01', version: 1, title: 'Rent charge, residential', eventSummary: 'Lease active; supply type residential', conditions: 'Lease Active; period Open; no duplicate charge key', debitAccounts: ['1110 Rent Receivable'], creditAccounts: ['4100 Rental Income, Residential'], approvalControl: 'System posts automatically per schedule', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-02', version: 1, title: 'Rent charge, commercial (non-VAT)', eventSummary: 'Lease active; commercial; owner not VAT-registered', conditions: 'Owner VAT flag OFF', debitAccounts: ['1110 Rent Receivable'], creditAccounts: ['4110 Rental Income, Commercial'], approvalControl: 'System posts automatically; VAT accounts stay locked', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-03', version: 1, title: 'Rent charge, commercial (VAT 15% Draft)', eventSummary: 'Commercial charge when VAT draft simulation enabled', conditions: 'Owner VAT flag ON; ERCA Gate governs live output', debitAccounts: ['1110 Rent Receivable (gross)'], creditAccounts: ['4110 Rental Income, Commercial (net)', '2210 Output VAT (15%)'], approvalControl: 'Draft scenario or post-ERCA verification', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-04', version: 1, title: 'Straight-line accrual (income ahead of billing)', eventSummary: 'Free-month / rent holiday accrual', conditions: 'Straight-line lease; monthly recognized > billed', debitAccounts: ['1130 Accrued Rent'], creditAccounts: ['4100 or 4110'], approvalControl: 'System posts on period Day 1', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-05', version: 1, title: 'Straight-line release / deferred rent', eventSummary: 'Billing ahead of straight-line income', conditions: 'Straight-line lease; billed > recognized', debitAccounts: ['1110 Rent Receivable'], creditAccounts: ['4100 or 4110', '1130 Accrued Rent or 2130 Deferred Rent'], approvalControl: 'System posts with charge', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-06', version: 1, title: 'Receipt by cash or bank transfer', eventSummary: 'Cash/Bank payment allocated FIFO', conditions: 'Cash <= ETB 50,000 unless written Owner exception', debitAccounts: ['1010 Cash on Hand or 1020 Bank Operating'], creditAccounts: ['1110 Rent Receivable'], approvalControl: 'Clerk/Finance posts; >50k cash blocked', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-07', version: 1, title: 'Gateway receipt success (Telebirr / ArifPay)', eventSummary: 'Verified digital gateway receipt', conditions: 'Gateway status=Success; idempotency key unused', debitAccounts: ['1040 Mobile-Money Clearing'], creditAccounts: ['1110 Rent Receivable'], approvalControl: 'Webhook / Clerk verification; idempotent', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-08', version: 1, title: 'Gateway payment failed / pending / expired', eventSummary: 'Non-success gateway status', conditions: 'Status != Success', debitAccounts: [], creditAccounts: [], approvalControl: 'ZERO journal entry; audit record only', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-09', version: 1, title: 'Gateway settlement to bank', eventSummary: 'Batch clears 1040 to 1020 + 5600 fee', conditions: 'Gross == Net + Fee; matches receipt list', debitAccounts: ['1020 Bank Operating (net)', '5600 Bank and Gateway Charges (fee)'], creditAccounts: ['1040 Mobile-Money Clearing (gross)'], approvalControl: 'Finance Officer prepares; GM signs recon', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-10', version: 1, title: 'Partial payment allocation', eventSummary: 'Receipt < oldest open charge', conditions: 'Oldest charge open > 0', debitAccounts: ['1010 / 1020 / 1040'], creditAccounts: ['1110 Rent Receivable'], approvalControl: 'Remaining receivable stays open & ages', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-11', version: 1, title: 'Overpayment / advance rent received', eventSummary: 'Payment > all open charges', conditions: 'Excess booked to 2110; >2 months triggers rent-control alert', debitAccounts: ['1010 / 1020 / 1040'], creditAccounts: ['1110 (open)', '2110 Advance Rent Received (excess)'], approvalControl: 'Flagged if > 2 months advance rent', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-12', version: 1, title: 'Apply advance rent to new charge', eventSummary: 'Offset 2110 against newly billed charge', conditions: 'Advance rent balance > 0 on lease', debitAccounts: ['2110 Advance Rent Received'], creditAccounts: ['1110 Rent Receivable'], approvalControl: 'System posts automatically on charge generation', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-13', version: 1, title: 'Security deposit received', eventSummary: 'Custody deposit held in 1030', conditions: 'Deposit flagged; never revenue', debitAccounts: ['1030 Bank Deposits Held'], creditAccounts: ['2120 Tenant Deposit Liability'], approvalControl: 'Three-way check must remain balanced', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-14', version: 1, title: 'Deposit refund on move-out', eventSummary: 'Return deposit after move-out check', conditions: 'Checklist done; amount <= held; evidence attached', debitAccounts: ['2120 Tenant Deposit Liability'], creditAccounts: ['1030 Bank Deposits Held'], approvalControl: 'Finance Officer maker; GM checker', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-15', version: 1, title: 'Deposit deduction / forfeiture', eventSummary: 'Offset arrears or repair damage recovery', conditions: 'Evidence attached; tenant notified', debitAccounts: ['2120 Tenant Deposit Liability', '1020 Bank Operating'], creditAccounts: ['1110 or 4400 Damage Recoveries', '1030 Bank Deposits Held'], approvalControl: 'Finance Officer maker; GM checker', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-16', version: 1, title: 'Mid-lease rent increase amendment', eventSummary: 'Schedule rebuilt prospectively', conditions: 'Max once per 12m; within cap; written notice attached', debitAccounts: [], creditAccounts: [], approvalControl: 'No journal on approval; updates future schedule', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-17', version: 1, title: 'Early lease termination', eventSummary: 'Exit fee + accrued/deferred rent release', conditions: 'Termination approved; future charges cancelled', debitAccounts: ['1110 (exit fee)', '2130 or 4100/4110'], creditAccounts: ['4300 Late Fee Income', '4100/4110 or 1130'], approvalControl: 'GM approval required', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-18', version: 1, title: 'Late fee assessment', eventSummary: 'Grace period elapsed per lease policy', conditions: 'Grace days exceeded; lease clause active', debitAccounts: ['1110 Rent Receivable'], creditAccounts: ['4300 Late Fee Income'], approvalControl: 'GM approval if manual override', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-19', version: 1, title: 'Vendor bill recognition', eventSummary: 'Approved expense or capital addition', conditions: 'Second-person approval (>25k 2-step); receipt/invoice attached', debitAccounts: ['5xxx Expense or 1210/1230 Asset'], creditAccounts: ['2010 Accounts Payable'], approvalControl: 'Finance Officer maker; GM (<=25k) / Owner (>25k)', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-20', version: 1, title: 'Bill payment with 3% withholding', eventSummary: 'Pay approved bill; 3% WHT if above threshold', conditions: 'Withholding agent & (Goods > 20k OR Services > 10k)', debitAccounts: ['2010 Accounts Payable'], creditAccounts: ['1020 Bank Operating (net)', '2220 Withholding Tax Payable (3%)'], approvalControl: 'Cash > 50,000 ETB blocked', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-21', version: 1, title: 'Tax remittance / advance tax payment', eventSummary: 'Settle WHT, property tax, or quarterly advance', conditions: 'Approved return draft & payment reference', debitAccounts: ['2220 / 2230 / 2240 / 2250 / 1195'], creditAccounts: ['1020 Bank Operating'], approvalControl: 'Maker-Checker required', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-22', version: 1, title: 'Monthly straight-line depreciation', eventSummary: 'Buildings 25y, Equipment 5y monthly run', conditions: 'Asset in service; period Open; not already posted this period', debitAccounts: ['5900 Depreciation'], creditAccounts: ['1220 Accum Depr Buildings', '1240 Accum Depr Equipment'], approvalControl: 'Finance Officer runs; GM verifies in close', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-23', version: 1, title: 'Bad-debt allowance & write-off', eventSummary: 'Provision or write-off with collection evidence', conditions: 'Ageing review or formal write-off dossier', debitAccounts: ['5700 Bad Debt (allowance) or 1120 (write-off)'], creditAccounts: ['1120 Allowance or 1110 Receivable'], approvalControl: 'Write-off: GM Step 1 -> Owner Final', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-24', version: 1, title: 'Owner draw or capital contribution', eventSummary: 'Equity movement isolated from P&L', conditions: 'Funds available; non-expense equity account', debitAccounts: ['3200 Owner Drawings (draw) or 1020 Bank (contrib)'], creditAccounts: ['1020 Bank Operating (draw) or 3100 Capital (contrib)'], approvalControl: 'Finance Officer prepares; Owner approves', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-25', version: 1, title: 'Mirror reversal of posted journal', eventSummary: 'Swaps Dr/Cr and links to original journal', conditions: 'Original Posted & not already reversed; reason logged', debitAccounts: ['Mirror of original Credits'], creditAccounts: ['Mirror of original Debits'], approvalControl: 'Maker != Checker (GM or Owner)', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-26', version: 1, title: 'Receipt void / reversal', eventSummary: 'Mirrors receipt journal and releases allocation', conditions: 'Clerk requests; Finance/GM/Owner approves', debitAccounts: ['1110 Rent Receivable (or 2110)'], creditAccounts: ['1010 / 1020 / 1040'], approvalControl: 'Receipt number remains permanently marked Reversed', effectiveDate: '2026-07-08' },
  { ruleId: 'PR-27', version: 1, title: 'Year-end close to Retained Earnings', eventSummary: 'Zero 4xxx/5xxx & 3200 into 3300 Retained Earnings', conditions: 'All 13 Ethiopian periods closed; adviser review done', debitAccounts: ['4xxx Income', '3300 (net loss / drawings)'], creditAccounts: ['5xxx Expenses', '3200 Owner Drawings', '3300 Retained Earnings'], approvalControl: 'GM Step 1 -> Owner Final', effectiveDate: '2026-07-08' },
];

export function buildAccountingPoliciesV2(ownerId: OwnerId): AccountingPolicyItem[] {
  const topics: { topic: string; treatment: string; notes: string }[] = [
    { topic: 'Deposits (1030 / 2120)', treatment: 'Segregate tenant deposits in dedicated Bank Deposits Held (1030) matching Tenant Deposit Liability (2120) and lease sub-ledger 3-way equality.', notes: 'Never recognized as rental income unless lawfully deducted via PR-15 with move-out evidence and GM approval.' },
    { topic: 'Advance rent (2110)', treatment: 'Defer prepaid multi-month rent into Advance Rent Received (2110) via PR-11 and apply automatically to future periods via PR-12.', notes: 'Rent-control check flags advance rent > 2 months for residential leases (Proclamation 1320/2016 E.C.).' },
    { topic: 'Straight-line operating leases (PR-04 / PR-05)', treatment: 'Recognize total net rent including rent-free months evenly over the lease term under IFRS for SMEs / IFRS 16 lessor rules.', notes: 'Accrued Rent (1130) tracks earned unbilled rent; Deferred Rent (2130) tracks step-up prepayments.' },
    { topic: 'Arrears & bad-debt allowance (1110 / 1120)', treatment: 'Allocate partial receipts FIFO oldest-first and maintain 1–30, 31–60, 61–90, and 90+ day ageing reconciled to 1110.', notes: 'Write-offs via PR-23 require GM Step 1 and Owner Final sign-off.' },
    { topic: 'Mobile-money clearing (1040)', treatment: 'Route Telebirr & ArifPay collections into 1040 Clearing; transfer net settled cash + 5600 fee on batch settlement (PR-09).', notes: 'Failed gateway webhooks (PR-08) create 0 journal entries and log audit events only.' },
    { topic: 'Cash limit control (ETB 50,000)', treatment: 'Warn/block single cash receipts or vendor payments exceeding ETB 50,000 (1395/2025 control) unless written Owner exception.', notes: 'Encourages traceable bank transfer, Telebirr, or ArifPay channels.' },
    { topic: 'Repairs vs. capital improvements', treatment: 'Expense routine upkeep (5100) via approved vendor bills (PR-19); capitalize structural improvements to 1210/1230.', notes: 'Bills over ETB 25,000 trigger two-step GM + Owner approval.' },
    { topic: 'Fixed-asset depreciation (PR-22)', treatment: 'Depreciate Buildings over 25 years and Equipment over 5 years straight-line monthly into 5900 / 1220 / 1240.', notes: 'Training parameters; final statutory tax vs. IFRS rates require chartered accountant sign-off.' },
    { topic: 'VAT residential vs. commercial separation', treatment: 'Keep Residential (4100) VAT-exempt; separate Commercial (4110) and keep Output/Input VAT locked until ERCA gate passes.', notes: 'Workpapers & VAT-enabled T4 training copy simulate 15% under Proclamation 1341/2024.' },
    { topic: 'Owner drawings vs. expenses (3200)', treatment: 'Book owner cash draws strictly to 3200 Owner Drawings (PR-24), never into operating expenses.', notes: 'Closed at year-end (PR-27) into 3300 Retained Earnings.' },
    { topic: 'Append-only reversals (PR-25 / PR-26)', treatment: 'Never edit or delete posted journals; all corrections post mirror reversals linked via reversalOfJournalId.', notes: 'Enforced at UI, Node/SQLite trigger, and Django/Postgres trigger levels.' },
  ];
  return topics.map((t, i) => ({
    id: `POL-${ownerId}-${i + 1}`,
    ownerId,
    topic: t.topic,
    proposedTreatment: t.treatment,
    reviewStatus: 'Professional review required',
    postingAvailability: 'No production posting available',
    notes: t.notes,
  }));
}

// Proposal §13 — 21-item Ethiopian Tax & Compliance Rules Register
export const RULES_REGISTER_21: TaxRuleRegisterItem[] = [
  { id: 1, ruleTitle: '1. Rental income tax bands (Amendment 1395/2025)', moduleAssumption: 'Individuals: 0%, 15%, 20%, 25%, 30%, 35% by band. Companies: flat 30%. Bands stored as dated data.', sourceSummary: 'EY, PwC & KPMG summaries; Federal Negarit Gazette note (effective July 2025).', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 2, ruleTitle: '2. Deductions & flat allowance', moduleAssumption: 'Books method and flat method (20% older / 35% Addis presumptive) shown side by side.', sourceSummary: 'Older federal guidance (20%); Addis Ababa directive report (35%).', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 3, ruleTitle: '3. Withholding on rent', moduleAssumption: 'Not applied to tenant rent receipts until licensed adviser confirms applicability.', sourceSummary: 'Press reports vs. prototype conflicting research note.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 4, ruleTitle: '4. Withholding on purchases', moduleAssumption: '3% on goods > ETB 20,000 and services > ETB 10,000 per transaction (withholding agents).', sourceSummary: 'EY & PwC tax alerts on Aug 2025 amendment.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: false },
  { id: 5, ruleTitle: '5. VAT (Proclamation 1341/2024)', moduleAssumption: 'Residential lease exempt. Threshold ETB 2,000,000. Commercial lease standard-rated 15% once registered.', sourceSummary: 'EY alert on VAT Proclamation 1341/2024 & Regulation 570/2025.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 6, ruleTitle: '6. Cash transaction limit (ETB 50,000)', moduleAssumption: 'Warn/block cash receipts and payments above ETB 50,000 per transaction.', sourceSummary: 'Amendment 1395/2025 cash restriction (Grant Thornton summary).', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 7, ruleTitle: '7. Quarterly advance tax', moduleAssumption: '25% of prior year income tax paid within 30 days after each quarter.', sourceSummary: 'EY and PwC Ethiopia tax summaries.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: false },
  { id: 8, ruleTitle: '8. Filing deadlines', moduleAssumption: 'Held as dated rule data. No hard-coded filing date assumed final without confirmation.', sourceSummary: 'Pending gazetted procedural confirmation.', checkedDate: 'Pending', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 9, ruleTitle: '9. Stamp duty on leases', moduleAssumption: '0.5% lease value placeholder; Account 2250 locked until confirmed.', sourceSummary: 'Ethiopian Stamp Duty Proclamation guides.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 10, ruleTitle: '10. Property tax (Proclamation 1365/2025)', moduleAssumption: 'Taxable base 25% of market/replacement value; federal range 0.1%–1.0% set by city.', sourceSummary: 'Proclamation 1365/2025 summaries (upper limit disagreement flagged).', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 11, ruleTitle: '11. E-invoicing (Directive 1142/2026)', moduleAssumption: 'IRN & QR fields stored; live submission adapter permanently disabled behind ERCA gate.', sourceSummary: 'Directive 1142/2026 ministry rollout guidance.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: false },
  { id: 12, ruleTitle: '12. Record keeping & Ethiopia residency', moduleAssumption: 'Append-only retention (10y company books / 5y post-filing), Amharic or English, hosted in Ethiopia.', sourceSummary: 'PwC Tax Administration & Ethiopian Commercial Code.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: false },
  { id: 13, ruleTitle: '13. Financial reporting framework', moduleAssumption: 'IFRS for SMEs financial statement structure; owner entity framework confirmed by accountant.', sourceSummary: 'Proclamation 847/2014 & AABE IFRS profile.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: false },
  { id: 14, ruleTitle: '14. Residential rent control (1320/2016 E.C.)', moduleAssumption: 'Max 1 increase/year, max 2 months advance warning, 11.5% Addis ref cap, 4-year new-build exemption.', sourceSummary: 'Addis Fortune / Reporter / Dablo summaries.', checkedDate: '2026-11-16', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 15, ruleTitle: '15. Foreign-currency leases', moduleAssumption: 'All ledger entries & leases strictly in ETB; FX conversion deferred unless adviser approves.', sourceSummary: 'NBE birr payment directives.', checkedDate: '2026-11-16', signOffStatus: 'Not reviewed', hasConflict: false },
  { id: 16, ruleTitle: '16. Payroll tax & pension (Scope Deferred — Step 8)', moduleAssumption: 'Tracked in register only; Step 8 payroll accounts excluded from Steps 1–7 build.', sourceSummary: 'SRS v1.1 D-20 deferral decision.', checkedDate: '2026-11-16', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 17, ruleTitle: '17. Local lease registration & channels', moduleAssumption: 'Addis Ababa Directive 7/2024 vs Oromia/Regional jurisdiction packs stored as data.', sourceSummary: 'Municipal lease registration directives.', checkedDate: '2026-11-15', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 18, ruleTitle: '18. Depreciation rates & capitalization limit', moduleAssumption: 'Training values: Buildings 25 years (4%), Equipment 5 years (20%).', sourceSummary: 'Training assumption; accountant confirms final tax vs book rates.', checkedDate: 'Pending', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 19, ruleTitle: '19. Combined individual income aggregation', moduleAssumption: 'Supports standalone rental vs. combined individual income workpaper toggle pending adviser opinion.', sourceSummary: 'Chambers summary of Amendment 1395/2025.', checkedDate: '2026-11-16', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 20, ruleTitle: '20. Salary PAYE bands (Reference Only)', moduleAssumption: 'Out of scope in Steps 1–7 build; retained for Step 8 SRS CR tracking.', sourceSummary: 'Amendment 1395/2025 employment schedule.', checkedDate: '2026-11-16', signOffStatus: 'Not reviewed', hasConflict: true },
  { id: 21, ruleTitle: '21. Labour-law pay rules (Reference Only)', moduleAssumption: 'Out of scope in Steps 1–7 build; retained for Step 8 SRS CR tracking.', sourceSummary: 'Proclamation 1156/2019 summaries.', checkedDate: '2026-11-16', signOffStatus: 'Not reviewed', hasConflict: true },
];

export const VERSIONED_TAX_RULE_PACKS: VersionedTaxRulePack[] = [
  {
    id: 'PACK-FED-IND-1395',
    packCode: 'ET-FED-IND-2019EC',
    jurisdiction: 'Federal Ethiopia',
    entityType: 'Individual',
    taxLawRef: 'Income Tax Amendment Proclamation No. 1395/2025',
    effectiveFrom: '2025-07-08',
    lifecycleStage: 'Submitted for Review',
    activeGateLocked: true,
    marginalBands: [
      { upToEtb: 24000, ratePercent: 0 },
      { upToEtb: 48000, ratePercent: 15 },
      { upToEtb: 84000, ratePercent: 20 },
      { upToEtb: 120000, ratePercent: 25 },
      { upToEtb: 168000, ratePercent: 30 },
      { upToEtb: null, ratePercent: 35 },
    ],
    presumptiveDeductionOptionsPercent: [20, 35],
    whtGoodsThresholdEtb: 20000,
    whtServicesThresholdEtb: 10000,
    whtRatePercent: 3,
    cashTransactionLimitEtb: 50000,
    advanceTaxQuarterPercent: 25,
  },
  {
    id: 'PACK-FED-CORP-1395',
    packCode: 'ET-FED-CORP-2019EC',
    jurisdiction: 'Federal Ethiopia',
    entityType: 'Company',
    taxLawRef: 'Income Tax Amendment Proclamation No. 1395/2025 (Corporate)',
    effectiveFrom: '2025-07-08',
    lifecycleStage: 'Draft',
    activeGateLocked: true,
    flatCompanyRatePercent: 30,
    whtGoodsThresholdEtb: 20000,
    whtServicesThresholdEtb: 10000,
    whtRatePercent: 3,
    cashTransactionLimitEtb: 50000,
    advanceTaxQuarterPercent: 25,
  },
  {
    id: 'PACK-FED-VAT-1341',
    packCode: 'ET-FED-VAT-1341',
    jurisdiction: 'Federal Ethiopia',
    entityType: 'All',
    taxLawRef: 'VAT Proclamation No. 1341/2024 & Reg 570/2025',
    effectiveFrom: '2024-08-01',
    lifecycleStage: 'Draft',
    activeGateLocked: true,
    vatRatePercent: 15,
    vatRegistrationThresholdEtb: 2000000,
  },
  {
    id: 'PACK-AA-MUN-1365',
    packCode: 'ET-AA-RENT-PROP-2019EC',
    jurisdiction: 'Addis Ababa Reference',
    entityType: 'All',
    taxLawRef: 'Property Tax Proc. 1365/2025 & Rent Control 1320/2016 E.C.',
    effectiveFrom: '2026-07-08',
    lifecycleStage: 'Draft',
    activeGateLocked: true,
    propertyTaxBasePercent: 25,
    propertyTaxFederalRangeLabel: '0.1% – 1.0% of taxable value (25% of market/replacement)',
    rentIncreaseAnnualCapPercent: 11.5,
    maxAdvanceRentMonths: 2,
  },
];

export function buildOwnerTaxCalendar(ownerId: OwnerId): TaxCalendarObligation[] {
  return [
    {
      id: `TAXCAL-${ownerId}-01`,
      ownerId,
      obligationCode: 'WHT-HIDAR-2019',
      titleEn: 'Withholding Tax Remittance (3% Purchases)',
      titleAm: 'የተቀናሽ ታክስ ክፍያ (3% ግዢዎች)',
      ecScheduleLabel: '30 days after Hidar close (30 Tahsas 2019 E.C.)',
      gcDueDate: '2027-01-08',
      frequency: 'Monthly',
      draftEstimateCents: ownerId === 'OWN-ALPHA' ? 36000 : 0,
      status: 'Draft Reminder — Filing Locked',
      ruleRef: 'Rule #4 (Withholding 3%)',
    },
    {
      id: `TAXCAL-${ownerId}-02`,
      ownerId,
      obligationCode: 'VAT-HIDAR-2019',
      titleEn: 'Monthly VAT Return Draft (15% Commercial Only)',
      titleAm: 'ወርሃዊ የተ.እ.ታ ረቂቅ መግለጫ',
      ecScheduleLabel: 'End of Tahsas 2019 E.C.',
      gcDueDate: '2027-01-08',
      frequency: 'Monthly',
      draftEstimateCents: 0,
      status: 'Draft Reminder — Filing Locked',
      ruleRef: 'Rule #5 (VAT Proc. 1341/2024)',
    },
    {
      id: `TAXCAL-${ownerId}-03`,
      ownerId,
      obligationCode: 'ADV-Q2-2019',
      titleEn: 'Quarterly Advance Income Tax (25% Prior Tax)',
      titleAm: 'የሩብ ዓመት ቅድሚያ የገቢ ግብር (25%)',
      ecScheduleLabel: '30 days after Q2 close (30 Yekatit 2019 E.C.)',
      gcDueDate: '2027-03-09',
      frequency: 'Quarterly',
      draftEstimateCents: 0,
      status: 'Draft Reminder — Filing Locked',
      ruleRef: 'Rule #7 (Advance Tax 25%)',
    },
    {
      id: `TAXCAL-${ownerId}-04`,
      ownerId,
      obligationCode: 'ANNUAL-RENT-2019',
      titleEn: 'Annual Rental Income Tax Return (1 Hamle – 30 Sene)',
      titleAm: 'ዓመታዊ የኪራይ ገቢ ግብር መግለጫ (1 ሐምሌ – 30 ሰኔ)',
      ecScheduleLabel: 'Sene 30 Fiscal Year-End Filing Window',
      gcDueDate: '2027-09-05',
      frequency: 'Annual',
      draftEstimateCents: 0,
      status: 'Draft Reminder — Filing Locked',
      ruleRef: 'Rule #1 & #2 (Amendment 1395/2025)',
    },
  ];
}
