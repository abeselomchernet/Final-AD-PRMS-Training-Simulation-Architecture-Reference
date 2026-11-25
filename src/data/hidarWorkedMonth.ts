import {
  BankStatementLine,
  DepositCustodyRecord,
  FailedGatewayEventLog,
  FixedAssetRecord,
  GatewaySettlementBatch,
  LedgerJournalEntry,
  LedgerTenantSubRecord,
  OwnerLedgerConfig,
  ReconciliationRun,
  TaxWorkpaperDraft,
  TrainingExercise,
  VendorBill,
} from '../types/prms';
import { buildLedgerAccountsV2, buildOwnerFiscalPeriods2019 } from './accountingRulePack';
import {
  buildEInvoiceMetadata,
  computeClearingStatus,
  computeIncomeStatement,
  computeMarginalTax1395,
  computeTaxWorkpaperDraft,
  computeTenantAgeing,
  computeThreeWayDepositCheck,
  computeTrialBalance,
  evaluateCloseChecklist,
  LedgerOwnerBundle,
  postLedgerEvent,
  toCents,
} from '../services/accountingEngine';

function buildHidarAlphaEntries(config: OwnerLedgerConfig): LedgerJournalEntry[] {
  const mkLine = (
    jNum: string,
    idx: number,
    accountCode: string,
    accountName: string,
    debitEtb: number,
    creditEtb: number,
    extra?: { tenantId?: string; unitId?: string; leaseId?: string; description?: string }
  ) => ({
    id: `JL-ALPHA-${jNum}-${idx}`,
    lineNumber: idx,
    accountCode,
    accountName,
    debitCents: toCents(debitEtb),
    creditCents: toCents(creditEtb),
    ...extra,
  });

  const baseDate = (day: number) => {
    // 1 Hidar 2019 E.C. = 2026-11-10; 30 Hidar 2019 E.C. = 2026-12-09
    const dt = new Date(Date.UTC(2026, 10, 10 + (day - 1)));
    return dt.toISOString().slice(0, 10);
  };

  const makeEntry = (
    num: string,
    day: number,
    ruleId: LedgerJournalEntry['ruleId'],
    sourceType: LedgerJournalEntry['sourceType'],
    sourceId: string,
    description: string,
    makerActorId: string,
    makerName: string,
    lines: LedgerJournalEntry['lines'],
    opts?: {
      checkerActorId?: string;
      checkerName?: string;
      status?: LedgerJournalEntry['status'];
      reversalOfJournalId?: string;
      reversedByJournalId?: string;
      propertyUse?: 'Residential' | 'Commercial';
    }
  ): LedgerJournalEntry => ({
    id: `JE-ALPHA-2019-03-${num}`,
    ownerId: 'OWN-ALPHA',
    journalNumber: num,
    entryDate: baseDate(day),
    ethiopianDateLabel: `${day} Hidar 2019 E.C.`,
    periodCode: '2019-03',
    ruleId,
    ruleVersion: 1,
    sourceType,
    sourceId,
    idempotencyKey: `HIDAR-ALPHA-${num}`,
    description,
    status: opts?.status || 'Posted',
    makerActorId,
    makerName,
    checkerActorId: opts?.checkerActorId,
    checkerName: opts?.checkerName,
    reversalOfJournalId: opts?.reversalOfJournalId,
    reversedByJournalId: opts?.reversedByJournalId,
    eInvoiceMetadata: buildEInvoiceMetadata(
      sourceType,
      sourceId,
      config,
      opts?.propertyUse || 'Residential',
      false
    ),
    lines,
    createdAt: `${baseDate(day)} 09:00`,
  });

  return [
    makeEntry('J01', 1, 'PR-01', 'Charge', 'CHG-HIDAR-T1', 'Rent invoice, T1 (Unit A1, Residential)', 'SYSTEM', 'AD-PRMS Billing Engine', [
      mkLine('J01', 1, '1110', 'Rent Receivable', 18000, 0, { tenantId: 'TEN-HIDAR-T1', unitId: 'A1' }),
      mkLine('J01', 2, '4100', 'Rental Income, Residential', 0, 18000, { tenantId: 'TEN-HIDAR-T1', unitId: 'A1' }),
    ]),
    makeEntry('J02', 1, 'PR-01', 'Charge', 'CHG-HIDAR-T2', 'Rent invoice, T2 (Unit A2, Residential)', 'SYSTEM', 'AD-PRMS Billing Engine', [
      mkLine('J02', 1, '1110', 'Rent Receivable', 22000, 0, { tenantId: 'TEN-HIDAR-T2', unitId: 'A2' }),
      mkLine('J02', 2, '4100', 'Rental Income, Residential', 0, 22000, { tenantId: 'TEN-HIDAR-T2', unitId: 'A2' }),
    ]),
    makeEntry('J03', 1, 'PR-01', 'Charge', 'CHG-HIDAR-T3', 'Rent invoice, T3 (Unit A3, Residential)', 'SYSTEM', 'AD-PRMS Billing Engine', [
      mkLine('J03', 1, '1110', 'Rent Receivable', 15000, 0, { tenantId: 'TEN-HIDAR-T3', unitId: 'A3' }),
      mkLine('J03', 2, '4100', 'Rental Income, Residential', 0, 15000, { tenantId: 'TEN-HIDAR-T3', unitId: 'A3' }),
    ]),
    makeEntry(
      'J04',
      1,
      'PR-04',
      'Charge',
      'SL-HIDAR-T4',
      'Straight-line income, T4 (12m x 30,000 less 1 free month = 330,000 / 12 = 27,500)',
      'SYSTEM',
      'AD-PRMS Straight-Line Engine',
      [
        mkLine('J04', 1, '1130', 'Accrued Rent', 27500, 0, { tenantId: 'TEN-HIDAR-T4', unitId: 'B1' }),
        mkLine('J04', 2, '4110', 'Rental Income, Commercial', 0, 27500, { tenantId: 'TEN-HIDAR-T4', unitId: 'B1' }),
      ],
      { propertyUse: 'Commercial' }
    ),
    makeEntry('J05', 3, 'PR-07', 'Receipt', 'R-001', 'T1 pays 18,000 by Telebirr (Receipt R-001)', 'USR-SYNTH-04', 'Demo Collections Clerk', [
      mkLine('J05', 1, '1040', 'Mobile-Money Clearing', 18000, 0, { tenantId: 'TEN-HIDAR-T1', unitId: 'A1' }),
      mkLine('J05', 2, '1110', 'Rent Receivable', 0, 18000, { tenantId: 'TEN-HIDAR-T1', unitId: 'A1' }),
    ]),
    makeEntry('J06', 4, 'PR-06', 'Receipt', 'RCT-HIDAR-T2', 'T2 pays 22,000 by bank transfer', 'USR-SYNTH-04', 'Demo Collections Clerk', [
      mkLine('J06', 1, '1020', 'Bank Operating', 22000, 0, { tenantId: 'TEN-HIDAR-T2', unitId: 'A2' }),
      mkLine('J06', 2, '1110', 'Rent Receivable', 0, 22000, { tenantId: 'TEN-HIDAR-T2', unitId: 'A2' }),
    ]),
    makeEntry('J07', 5, 'PR-13', 'Deposit', 'DEP-HIDAR-T4', 'T4 deposit 60,000 into segregated deposit bank account (1030)', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J07', 1, '1030', 'Bank Deposits Held', 60000, 0, { tenantId: 'TEN-HIDAR-T4', unitId: 'B1' }),
      mkLine('J07', 2, '2120', 'Tenant Deposit Liability', 0, 60000, { tenantId: 'TEN-HIDAR-T4', unitId: 'B1' }),
    ]),
    makeEntry('J08', 6, 'PR-09', 'GatewaySettlement', 'TB-BATCH-001', 'Telebirr settles R-001 (gross 18,000, fee 270, net 17,730)', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J08', 1, '1020', 'Bank Operating', 17730, 0),
      mkLine('J08', 2, '5600', 'Bank and Gateway Charges', 270, 0),
      mkLine('J08', 3, '1040', 'Mobile-Money Clearing', 0, 18000),
    ], { checkerActorId: 'USR-SYNTH-02', checkerName: 'Demo General Manager' }),
    makeEntry('J09', 8, 'PR-10', 'Receipt', 'RCT-HIDAR-T3-CASH', 'T3 pays 10,000 in cash, allocated FIFO to Tikimt invoice first', 'USR-SYNTH-10', 'Demo Front-Office Clerk', [
      mkLine('J09', 1, '1010', 'Cash on Hand', 10000, 0, { tenantId: 'TEN-HIDAR-T3', unitId: 'A3' }),
      mkLine('J09', 2, '1110', 'Rent Receivable', 0, 10000, { tenantId: 'TEN-HIDAR-T3', unitId: 'A3' }),
    ]),
    makeEntry('J10', 9, 'Transfer', 'BankTransfer', 'DEP-SLIP-009', 'Cash on hand banked into 1020 Bank Operating', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J10', 1, '1020', 'Bank Operating', 10000, 0),
      mkLine('J10', 2, '1010', 'Cash on Hand', 0, 10000),
    ]),
    makeEntry('J11', 10, 'PR-19', 'VendorBill', 'BILL-HIDAR-001', 'Plumbing repair bill for Unit A2 (approved by second person)', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J11', 1, '5100', 'Repairs and Maintenance', 12000, 0, { unitId: 'A2' }),
      mkLine('J11', 2, '2010', 'Accounts Payable', 0, 12000),
    ], { checkerActorId: 'USR-SYNTH-02', checkerName: 'Demo General Manager' }),
    makeEntry('J12', 12, 'PR-20', 'BillPayment', 'PAY-BILL-HIDAR-001', 'Pay plumbing bill; 3% withholding tax = ETB 360', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J12', 1, '2010', 'Accounts Payable', 12000, 0),
      mkLine('J12', 2, '1020', 'Bank Operating', 0, 11640),
      mkLine('J12', 3, '2220', 'Withholding Tax Payable', 0, 360),
    ], { checkerActorId: 'USR-SYNTH-02', checkerName: 'Demo General Manager' }),
    makeEntry('J13', 14, 'PR-11', 'Receipt', 'R-002', 'T1 pays Tahsas next-month rent early by Telebirr (Receipt R-002)', 'USR-SYNTH-04', 'Demo Collections Clerk', [
      mkLine('J13', 1, '1040', 'Mobile-Money Clearing', 18000, 0, { tenantId: 'TEN-HIDAR-T1', unitId: 'A1' }),
      mkLine('J13', 2, '2110', 'Advance Rent Received', 0, 18000, { tenantId: 'TEN-HIDAR-T1', unitId: 'A1' }),
    ]),
    makeEntry('J14', 16, 'PR-09', 'GatewaySettlement', 'TB-BATCH-002', 'Telebirr settles R-002 (gross 18,000, fee 270, net 17,730)', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J14', 1, '1020', 'Bank Operating', 17730, 0),
      mkLine('J14', 2, '5600', 'Bank and Gateway Charges', 270, 0),
      mkLine('J14', 3, '1040', 'Mobile-Money Clearing', 0, 18000),
    ], { checkerActorId: 'USR-SYNTH-02', checkerName: 'Demo General Manager' }),
    makeEntry(
      'J15',
      22,
      'Manual',
      'ManualJournal',
      'MAN-HIDAR-015',
      'Common-area utilities posted as 4,500 by mistake (reversed by J16)',
      'USR-SYNTH-03',
      'Demo Finance Officer',
      [
        mkLine('J15', 1, '5200', 'Utilities', 4500, 0),
        mkLine('J15', 2, '1020', 'Bank Operating', 0, 4500),
      ],
      {
        checkerActorId: 'USR-SYNTH-02',
        checkerName: 'Demo General Manager',
        status: 'Reversed',
        reversedByJournalId: 'JE-ALPHA-2019-03-J16',
      }
    ),
    makeEntry(
      'J16',
      23,
      'PR-25',
      'Reversal',
      'JE-ALPHA-2019-03-J15',
      'PR-25 Mirror Reversal of J15 (incorrect 4,500 utilities amount)',
      'USR-SYNTH-03',
      'Demo Finance Officer',
      [
        mkLine('J16', 1, '1020', 'Bank Operating', 4500, 0),
        mkLine('J16', 2, '5200', 'Utilities', 0, 4500),
      ],
      {
        checkerActorId: 'USR-SYNTH-02',
        checkerName: 'Demo General Manager',
        reversalOfJournalId: 'JE-ALPHA-2019-03-J15',
      }
    ),
    makeEntry('J17', 23, 'Manual', 'ManualJournal', 'MAN-HIDAR-017', 'Common-area utilities posted correctly (ETB 4,200)', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J17', 1, '5200', 'Utilities', 4200, 0),
      mkLine('J17', 2, '1020', 'Bank Operating', 0, 4200),
    ], { checkerActorId: 'USR-SYNTH-02', checkerName: 'Demo General Manager' }),
    makeEntry('J18', 30, 'PR-22', 'Depreciation', 'DEP-HIDAR-2019', 'Monthly depreciation: Building 6M/25y/12 (20,000) + Equipment 120k/5y/12 (2,000)', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J18', 1, '5900', 'Depreciation', 22000, 0),
      mkLine('J18', 2, '1220', 'Accumulated Depreciation, Buildings', 0, 20000),
      mkLine('J18', 3, '1240', 'Accumulated Depreciation, Equipment', 0, 2000),
    ], { checkerActorId: 'USR-SYNTH-02', checkerName: 'Demo General Manager' }),
    makeEntry('J19', 30, 'PR-24', 'OwnerDraw', 'DRAW-HIDAR-001', 'Owner draw approved by Owner / Director (isolated from expenses)', 'USR-SYNTH-03', 'Demo Finance Officer', [
      mkLine('J19', 1, '3200', 'Owner Drawings', 50000, 0),
      mkLine('J19', 2, '1020', 'Bank Operating', 0, 50000),
    ], { checkerActorId: 'USR-SYNTH-01', checkerName: 'Test Owner Alpha (Director Demo)' }),
  ];
}

export function buildHidarAlphaBundle(): LedgerOwnerBundle {
  const config: OwnerLedgerConfig = {
    id: 'CFG-LEDGER-ALPHA',
    ownerId: 'OWN-ALPHA',
    ledgerCode: 'LDG-OWN-ALPHA',
    entityType: 'Individual',
    vatRegistered: false,
    withholdingAgent: true,
    booksMethodSupported: true,
    basis: 'Accrual',
    framework: 'IFRS for SMEs',
    jurisdiction: 'Addis Ababa',
    depositAccountCode: '1030',
    coaVersion: 2,
    vatRateBps: 1500,
    whtRateBps: 300,
    currency: 'ETB',
    enableLiveTaxInvoicing: false,
  };

  const accounts = buildLedgerAccountsV2('OWN-ALPHA', false);
  const periods = buildOwnerFiscalPeriods2019('OWN-ALPHA');

  // Opening trial balance: 6,535,000 ETB each side (signed debit - credit cents)
  const openingBalances: Record<string, number> = {
    '1020': toCents(300000),
    '1030': toCents(100000),
    '1110': toCents(15000),
    '1210': toCents(6000000),
    '1220': -toCents(600000),
    '1230': toCents(120000),
    '1240': -toCents(36000),
    '2120': -toCents(100000),
    '3100': -toCents(5000000),
    '3300': -toCents(799000),
  };

  const entries = buildHidarAlphaEntries(config);

  const tenants: LedgerTenantSubRecord[] = [
    {
      id: 'TEN-HIDAR-T1',
      ownerId: 'OWN-ALPHA',
      tenantCode: 'T1',
      tenantName: 'T1 — Residential Tenant (Unit A1)',
      unitCode: 'A1',
      propertyUse: 'Residential',
      monthlyRentCents: toCents(18000),
      leaseTermMonths: 12,
      freeMonthsCount: 0,
      straightLineMonthlyCents: toCents(18000),
      advanceMonthsHeld: 1,
      advanceRentCents: toCents(18000),
      accruedRentCents: 0,
      deferredRentCents: 0,
      lastRentIncreaseDate: '2026-07-08',
      openInvoices: [],
    },
    {
      id: 'TEN-HIDAR-T2',
      ownerId: 'OWN-ALPHA',
      tenantCode: 'T2',
      tenantName: 'T2 — Residential Tenant (Unit A2)',
      unitCode: 'A2',
      propertyUse: 'Residential',
      monthlyRentCents: toCents(22000),
      leaseTermMonths: 12,
      freeMonthsCount: 0,
      straightLineMonthlyCents: toCents(22000),
      advanceMonthsHeld: 0,
      advanceRentCents: 0,
      accruedRentCents: 0,
      deferredRentCents: 0,
      lastRentIncreaseDate: '2026-07-08',
      openInvoices: [],
    },
    {
      id: 'TEN-HIDAR-T3',
      ownerId: 'OWN-ALPHA',
      tenantCode: 'T3',
      tenantName: 'T3 — Residential Tenant (Unit A3)',
      unitCode: 'A3',
      propertyUse: 'Residential',
      monthlyRentCents: toCents(15000),
      leaseTermMonths: 12,
      freeMonthsCount: 0,
      straightLineMonthlyCents: toCents(15000),
      advanceMonthsHeld: 0,
      advanceRentCents: 0,
      accruedRentCents: 0,
      deferredRentCents: 0,
      openInvoices: [
        {
          invoiceId: 'INV-TIKIMT-T3',
          periodCode: '2019-02',
          dueDateGc: '2026-10-11',
          daysOverdue: 59,
          billedCents: toCents(15000),
          paidCents: toCents(10000),
          openCents: toCents(5000),
        },
        {
          invoiceId: 'INV-HIDAR-T3',
          periodCode: '2019-03',
          dueDateGc: '2026-11-10',
          daysOverdue: 29,
          billedCents: toCents(15000),
          paidCents: 0,
          openCents: toCents(15000),
        },
      ],
    },
    {
      id: 'TEN-HIDAR-T4',
      ownerId: 'OWN-ALPHA',
      tenantCode: 'T4',
      tenantName: 'T4 — Commercial Tenant (Unit B1, 1m Free)',
      unitCode: 'B1',
      propertyUse: 'Commercial',
      monthlyRentCents: toCents(30000),
      leaseTermMonths: 12,
      freeMonthsCount: 1,
      straightLineMonthlyCents: toCents(27500),
      advanceMonthsHeld: 0,
      advanceRentCents: 0,
      accruedRentCents: toCents(27500),
      deferredRentCents: 0,
      openInvoices: [],
    },
  ];

  const deposits: DepositCustodyRecord[] = [
    {
      id: 'DEP-ALPHA-T1',
      ownerId: 'OWN-ALPHA',
      leaseId: 'LSE-HIDAR-T1',
      tenantId: 'TEN-HIDAR-T1',
      tenantName: 'T1 — Residential Tenant (Unit A1)',
      unitCode: 'A1',
      bankAccountCode: '1030',
      liabilityAccountCode: '2120',
      heldCents: toCents(36000),
      status: 'Held',
    },
    {
      id: 'DEP-ALPHA-T2',
      ownerId: 'OWN-ALPHA',
      leaseId: 'LSE-HIDAR-T2',
      tenantId: 'TEN-HIDAR-T2',
      tenantName: 'T2 — Residential Tenant (Unit A2)',
      unitCode: 'A2',
      bankAccountCode: '1030',
      liabilityAccountCode: '2120',
      heldCents: toCents(44000),
      status: 'Held',
    },
    {
      id: 'DEP-ALPHA-T3',
      ownerId: 'OWN-ALPHA',
      leaseId: 'LSE-HIDAR-T3',
      tenantId: 'TEN-HIDAR-T3',
      tenantName: 'T3 — Residential Tenant (Unit A3)',
      unitCode: 'A3',
      bankAccountCode: '1030',
      liabilityAccountCode: '2120',
      heldCents: toCents(20000),
      status: 'Held',
    },
    {
      id: 'DEP-ALPHA-T4',
      ownerId: 'OWN-ALPHA',
      leaseId: 'LSE-HIDAR-T4',
      tenantId: 'TEN-HIDAR-T4',
      tenantName: 'T4 — Commercial Tenant (Unit B1)',
      unitCode: 'B1',
      bankAccountCode: '1030',
      liabilityAccountCode: '2120',
      heldCents: toCents(60000),
      status: 'Held',
      journalId: 'JE-ALPHA-2019-03-J07',
    },
  ];

  const gatewayBatches: GatewaySettlementBatch[] = [
    {
      id: 'BAT-ALPHA-001',
      ownerId: 'OWN-ALPHA',
      provider: 'Telebirr',
      batchNumber: 'TB-2019-03-01',
      settlementDate: '2026-11-15',
      periodCode: '2019-03',
      receiptRefs: ['R-001'],
      grossCents: toCents(18000),
      feeCents: toCents(270),
      netSettledCents: toCents(17730),
      clearingAccountCode: '1040',
      status: 'Settled',
      settlementJournalId: 'JE-ALPHA-2019-03-J08',
    },
    {
      id: 'BAT-ALPHA-002',
      ownerId: 'OWN-ALPHA',
      provider: 'Telebirr',
      batchNumber: 'TB-2019-03-02',
      settlementDate: '2026-11-25',
      periodCode: '2019-03',
      receiptRefs: ['R-002'],
      grossCents: toCents(18000),
      feeCents: toCents(270),
      netSettledCents: toCents(17730),
      clearingAccountCode: '1040',
      status: 'Settled',
      settlementJournalId: 'JE-ALPHA-2019-03-J14',
    },
  ];

  const failedEvents: FailedGatewayEventLog[] = [
    {
      id: 'FGW-ALPHA-E1',
      ownerId: 'OWN-ALPHA',
      eventRef: 'E1',
      provider: 'Telebirr',
      tenantRef: 'T3 (Unit A3)',
      attemptedAmountCents: toCents(5000),
      occurredAt: '2026-11-24',
      periodCode: '2019-03',
      gatewayStatus: 'Failed',
      journalsCreatedCount: 0,
      reason: 'PR-08: T3 attempted ETB 5,000 via Telebirr; gateway returned Failed. Zero journal entry & zero receipt created.',
    },
  ];

  const bankLines: BankStatementLine[] = [
    { id: 'BNK-A-01', ownerId: 'OWN-ALPHA', bankAccountCode: '1020', periodCode: '2019-03', txDate: '2026-11-13', reference: 'CBE-T2-004', description: 'Bank transfer from T2 (Unit A2 rent)', amountCents: toCents(22000), direction: 'Inflow', matchedJournalId: 'JE-ALPHA-2019-03-J06', status: 'Matched' },
    { id: 'BNK-A-02', ownerId: 'OWN-ALPHA', bankAccountCode: '1020', periodCode: '2019-03', txDate: '2026-11-15', reference: 'TB-SETTLE-R001', description: 'Telebirr settlement R-001 net after ETB 270 fee', amountCents: toCents(17730), direction: 'Inflow', matchedJournalId: 'JE-ALPHA-2019-03-J08', status: 'Matched' },
    { id: 'BNK-A-03', ownerId: 'OWN-ALPHA', bankAccountCode: '1020', periodCode: '2019-03', txDate: '2026-11-18', reference: 'CASH-DEP-009', description: 'Cash banked from T3 partial payment', amountCents: toCents(10000), direction: 'Inflow', matchedJournalId: 'JE-ALPHA-2019-03-J10', status: 'Matched' },
    { id: 'BNK-A-04', ownerId: 'OWN-ALPHA', bankAccountCode: '1020', periodCode: '2019-03', txDate: '2026-11-21', reference: 'CBE-PAY-012', description: 'Plumbing contractor payout net of 3% WHT (ETB 360)', amountCents: toCents(11640), direction: 'Outflow', matchedJournalId: 'JE-ALPHA-2019-03-J12', status: 'Matched' },
    { id: 'BNK-A-05', ownerId: 'OWN-ALPHA', bankAccountCode: '1020', periodCode: '2019-03', txDate: '2026-11-25', reference: 'TB-SETTLE-R002', description: 'Telebirr settlement R-002 net after ETB 270 fee', amountCents: toCents(17730), direction: 'Inflow', matchedJournalId: 'JE-ALPHA-2019-03-J14', status: 'Matched' },
    { id: 'BNK-A-06', ownerId: 'OWN-ALPHA', bankAccountCode: '1020', periodCode: '2019-03', txDate: '2026-12-02', reference: 'UTIL-NET-017', description: 'Common-area utilities bank transfer', amountCents: toCents(4200), direction: 'Outflow', matchedJournalId: 'JE-ALPHA-2019-03-J17', status: 'Matched' },
    { id: 'BNK-A-07', ownerId: 'OWN-ALPHA', bankAccountCode: '1020', periodCode: '2019-03', txDate: '2026-12-09', reference: 'OWN-DRAW-019', description: 'Owner distribution draw', amountCents: toCents(50000), direction: 'Outflow', matchedJournalId: 'JE-ALPHA-2019-03-J19', status: 'Matched' },
  ];

  const reconciliationRuns: ReconciliationRun[] = [
    {
      id: 'RECON-ALPHA-2019-03',
      ownerId: 'OWN-ALPHA',
      periodCode: '2019-03',
      bankAccountCode: '1020',
      statementClosingCents: toCents(301620),
      ledgerClosingCents: toCents(301620),
      clearingBalanceCents: 0,
      threeWayBankCents: toCents(160000),
      threeWayLedgerCents: toCents(160000),
      threeWaySubledgerCents: toCents(160000),
      status: 'Pending Sign-Off',
      makerActorId: 'USR-SYNTH-03',
      makerName: 'Demo Finance Officer',
      note: 'Statement closing ETB 301,620 matches Bank Operating 1020; ready for General Manager sign-off.',
    },
  ];

  const vendorBills: VendorBill[] = [
    {
      id: 'BILL-ALPHA-001',
      ownerId: 'OWN-ALPHA',
      billNumber: 'VBL-2019-03-001',
      vendorName: 'Addis Master Plumbing Works (Synthetic)',
      vendorTinPlaceholder: 'TIN-VEND-SYNTH-011',
      category: 'Services',
      expenseAccountCode: '5100',
      billDate: '2026-11-19',
      dueDate: '2026-11-26',
      periodCode: '2019-03',
      grossCents: toCents(12000),
      whtApplicable: true,
      whtRateBps: 300,
      whtCents: toCents(360),
      netPayableCents: toCents(11640),
      paymentMethod: 'Bank Transfer',
      status: 'Paid',
      makerActorId: 'USR-SYNTH-03',
      makerName: 'Demo Finance Officer',
      checkerActorId: 'USR-SYNTH-02',
      billJournalId: 'JE-ALPHA-2019-03-J11',
      paymentJournalId: 'JE-ALPHA-2019-03-J12',
      evidenceRef: 'INV-PLUMB-A2-011',
      description: 'Unit A2 riser & main valve plumbing overhaul (services > ETB 10,000 triggers 3% WHT)',
    },
  ];

  const fixedAssets: FixedAssetRecord[] = [
    {
      id: 'AST-ALPHA-BLDG-01',
      ownerId: 'OWN-ALPHA',
      assetCode: 'FA-BLD-001',
      name: 'Alpha Commercial & Residential Complex',
      assetClass: 'Building',
      assetAccountCode: '1210',
      accumDepAccountCode: '1220',
      inServiceDate: '2024-05-10',
      costCents: toCents(6000000),
      salvageCents: 0,
      usefulLifeMonths: 300, // 25 years
      accumDepOpeningCents: toCents(600000),
      accumDepCurrentCents: toCents(20000),
      lastDepreciatedPeriod: '2019-03',
      taxMarketValueCents: toCents(6000000),
      municipalPropertyTaxRateBps: 20, // 0.20% reference
    },
    {
      id: 'AST-ALPHA-EQP-01',
      ownerId: 'OWN-ALPHA',
      assetCode: 'FA-EQP-001',
      name: 'Backup Generator & Elevator Control Equipment',
      assetClass: 'Equipment',
      assetAccountCode: '1230',
      accumDepAccountCode: '1240',
      inServiceDate: '2025-05-10',
      costCents: toCents(120000),
      salvageCents: 0,
      usefulLifeMonths: 60, // 5 years
      accumDepOpeningCents: toCents(36000),
      accumDepCurrentCents: toCents(2000),
      lastDepreciatedPeriod: '2019-03',
    },
  ];

  const baseBundle: LedgerOwnerBundle = {
    config,
    accounts,
    periods,
    openingBalances,
    entries,
    tenants,
    deposits,
    gatewayBatches,
    failedEvents,
    bankLines,
    reconciliationRuns,
    vendorBills,
    fixedAssets,
    closeChecklists: [],
  };

  const checklist = evaluateCloseChecklist(baseBundle, '2019-03', 'USR-SYNTH-03', 'Demo Finance Officer');
  baseBundle.closeChecklists = [checklist];
  return baseBundle;
}

export function buildBetaBaselineBundle(): LedgerOwnerBundle {
  const config: OwnerLedgerConfig = {
    id: 'CFG-LEDGER-BETA',
    ownerId: 'OWN-BETA',
    ledgerCode: 'LDG-OWN-BETA',
    entityType: 'Company',
    vatRegistered: false,
    withholdingAgent: true,
    booksMethodSupported: true,
    basis: 'Accrual',
    framework: 'IFRS for SMEs',
    jurisdiction: 'Addis Ababa',
    depositAccountCode: '1030',
    coaVersion: 2,
    vatRateBps: 1500,
    whtRateBps: 300,
    currency: 'ETB',
    enableLiveTaxInvoicing: false,
  };

  const accounts = buildLedgerAccountsV2('OWN-BETA', false);
  const periods = buildOwnerFiscalPeriods2019('OWN-BETA');
  const openingBalances: Record<string, number> = {
    '1020': toCents(240000),
    '1030': toCents(90000),
    '1110': toCents(26000),
    '1210': toCents(4500000),
    '1220': -toCents(360000),
    '2120': -toCents(90000),
    '3100': -toCents(4000000),
    '3300': -toCents(406000),
  };

  const entries: LedgerJournalEntry[] = [
    {
      id: 'JE-BETA-2019-03-J01',
      ownerId: 'OWN-BETA',
      journalNumber: 'J01',
      entryDate: '2026-11-10',
      ethiopianDateLabel: '1 Hidar 2019 E.C.',
      periodCode: '2019-03',
      ruleId: 'PR-02',
      ruleVersion: 1,
      sourceType: 'Charge',
      sourceId: 'INV-SYNTH-B-1101',
      idempotencyKey: 'HIDAR-BETA-J01',
      description: 'Commercial office rent invoice — Unit B-101 (non-VAT)',
      status: 'Posted',
      makerActorId: 'SYSTEM',
      makerName: 'AD-PRMS Billing Engine',
      lines: [
        { id: 'JL-BETA-J01-1', lineNumber: 1, accountCode: '1110', accountName: 'Rent Receivable', debitCents: toCents(38000), creditCents: 0, tenantId: 'TEN-BETA-B101', unitId: 'B-101' },
        { id: 'JL-BETA-J01-2', lineNumber: 2, accountCode: '4110', accountName: 'Rental Income, Commercial', debitCents: 0, creditCents: toCents(38000), tenantId: 'TEN-BETA-B101', unitId: 'B-101' },
      ],
      createdAt: '2026-11-10 09:00',
    },
    {
      id: 'JE-BETA-2019-03-J02',
      ownerId: 'OWN-BETA',
      journalNumber: 'J02',
      entryDate: '2026-11-14',
      ethiopianDateLabel: '5 Hidar 2019 E.C.',
      periodCode: '2019-03',
      ruleId: 'PR-06',
      ruleVersion: 1,
      sourceType: 'Receipt',
      sourceId: 'RCT-BETA-B001',
      idempotencyKey: 'HIDAR-BETA-J02',
      description: 'Commercial office partial bank payment — Unit B-101',
      status: 'Posted',
      makerActorId: 'USR-SYNTH-04',
      makerName: 'Demo Collections Clerk',
      lines: [
        { id: 'JL-BETA-J02-1', lineNumber: 1, accountCode: '1020', accountName: 'Bank Operating', debitCents: toCents(38000), creditCents: 0, tenantId: 'TEN-BETA-B101', unitId: 'B-101' },
        { id: 'JL-BETA-J02-2', lineNumber: 2, accountCode: '1110', accountName: 'Rent Receivable', debitCents: 0, creditCents: toCents(38000), tenantId: 'TEN-BETA-B101', unitId: 'B-101' },
      ],
      createdAt: '2026-11-14 10:15',
    },
    {
      id: 'JE-BETA-2019-03-J03',
      ownerId: 'OWN-BETA',
      journalNumber: 'J03',
      entryDate: '2026-12-09',
      ethiopianDateLabel: '30 Hidar 2019 E.C.',
      periodCode: '2019-03',
      ruleId: 'PR-22',
      ruleVersion: 1,
      sourceType: 'Depreciation',
      sourceId: 'DEP-BETA-2019-03',
      idempotencyKey: 'HIDAR-BETA-J03',
      description: 'Monthly corporate building depreciation (4,500,000 / 25y / 12)',
      status: 'Posted',
      makerActorId: 'USR-SYNTH-03',
      makerName: 'Demo Finance Officer',
      checkerActorId: 'USR-SYNTH-02',
      checkerName: 'Demo General Manager',
      lines: [
        { id: 'JL-BETA-J03-1', lineNumber: 1, accountCode: '5900', accountName: 'Depreciation', debitCents: toCents(15000), creditCents: 0 },
        { id: 'JL-BETA-J03-2', lineNumber: 2, accountCode: '1220', accountName: 'Accumulated Depreciation, Buildings', debitCents: 0, creditCents: toCents(15000) },
      ],
      createdAt: '2026-12-09 16:00',
    },
  ];

  const tenants: LedgerTenantSubRecord[] = [
    {
      id: 'TEN-BETA-B101',
      ownerId: 'OWN-BETA',
      tenantCode: 'B1',
      tenantName: 'SYNTH Tenant 003 (Corporate Suite B-101)',
      unitCode: 'B-101',
      propertyUse: 'Commercial',
      monthlyRentCents: toCents(38000),
      leaseTermMonths: 24,
      freeMonthsCount: 0,
      straightLineMonthlyCents: toCents(38000),
      advanceMonthsHeld: 0,
      advanceRentCents: 0,
      accruedRentCents: 0,
      deferredRentCents: 0,
      openInvoices: [
        {
          invoiceId: 'INV-BETA-PRIOR',
          periodCode: '2019-02',
          dueDateGc: '2026-10-15',
          daysOverdue: 55,
          billedCents: toCents(26000),
          paidCents: 0,
          openCents: toCents(26000),
        },
      ],
    },
  ];

  const deposits: DepositCustodyRecord[] = [
    {
      id: 'DEP-BETA-B101',
      ownerId: 'OWN-BETA',
      leaseId: 'LSE-BETA-001',
      tenantId: 'TEN-BETA-B101',
      tenantName: 'SYNTH Tenant 003 (Corporate Suite B-101)',
      unitCode: 'B-101',
      bankAccountCode: '1030',
      liabilityAccountCode: '2120',
      heldCents: toCents(90000),
      status: 'Held',
    },
  ];

  const fixedAssets: FixedAssetRecord[] = [
    {
      id: 'AST-BETA-BLDG-01',
      ownerId: 'OWN-BETA',
      assetCode: 'FA-BETA-001',
      name: 'Beta Corporate Business Center',
      assetClass: 'Building',
      assetAccountCode: '1210',
      accumDepAccountCode: '1220',
      inServiceDate: '2024-11-10',
      costCents: toCents(4500000),
      salvageCents: 0,
      usefulLifeMonths: 300,
      accumDepOpeningCents: toCents(360000),
      accumDepCurrentCents: toCents(15000),
      lastDepreciatedPeriod: '2019-03',
      taxMarketValueCents: toCents(4500000),
      municipalPropertyTaxRateBps: 25,
    },
  ];

  const bankLines: BankStatementLine[] = [
    { id: 'BNK-B-01', ownerId: 'OWN-BETA', bankAccountCode: '1020', periodCode: '2019-03', txDate: '2026-11-14', reference: 'CBE-BETA-001', description: 'Bank transfer from Corporate Suite B-101', amountCents: toCents(38000), direction: 'Inflow', matchedJournalId: 'JE-BETA-2019-03-J02', status: 'Matched' },
  ];

  const bundle: LedgerOwnerBundle = {
    config,
    accounts,
    periods,
    openingBalances,
    entries,
    tenants,
    deposits,
    gatewayBatches: [],
    failedEvents: [],
    bankLines,
    reconciliationRuns: [
      {
        id: 'RECON-BETA-2019-03',
        ownerId: 'OWN-BETA',
        periodCode: '2019-03',
        bankAccountCode: '1020',
        statementClosingCents: toCents(278000),
        ledgerClosingCents: toCents(278000),
        clearingBalanceCents: 0,
        threeWayBankCents: toCents(90000),
        threeWayLedgerCents: toCents(90000),
        threeWaySubledgerCents: toCents(90000),
        status: 'Signed Off',
        makerActorId: 'USR-SYNTH-03',
        makerName: 'Demo Finance Officer',
        checkerActorId: 'USR-SYNTH-02',
        checkerName: 'Demo General Manager',
        signedAt: '2026-12-09 17:00',
      },
    ],
    vendorBills: [],
    fixedAssets,
    closeChecklists: [],
  };

  bundle.closeChecklists = [evaluateCloseChecklist(bundle, '2019-03', 'USR-SYNTH-03', 'Demo Finance Officer')];
  return bundle;
}

export function buildCopyableHidarVatVariant(alphaBundle: LedgerOwnerBundle): {
  bundle: LedgerOwnerBundle;
  vatJournal: LedgerJournalEntry;
  workpaper: TaxWorkpaperDraft;
} {
  const cloned: LedgerOwnerBundle = {
    ...alphaBundle,
    config: {
      ...alphaBundle.config,
      vatRegistered: true,
    },
    accounts: buildLedgerAccountsV2('OWN-ALPHA', true),
    periods: alphaBundle.periods.map((p) => ({ ...p, status: p.monthIndex < 3 ? 'Closed' : 'Open' })),
    entries: [...alphaBundle.entries],
  };

  const vatResult = postLedgerEvent(cloned, {
    entryDate: '2026-11-28',
    periodCode: '2019-03',
    ruleId: 'PR-03',
    sourceType: 'Charge',
    sourceId: 'INV-HIDAR-T4-VAT-DRAFT',
    idempotencyKey: 'VAT-VARIANT-T4-HIDAR',
    description: 'VAT Practice Copy: Commercial invoice T4 (ETB 30,000 + 15% Output VAT ETB 4,500 = ETB 34,500)',
    makerActorId: 'USR-SYNTH-03',
    makerName: 'Demo Finance Officer',
    propertyUse: 'Commercial',
    vatDraftApplied: true,
    lines: [
      { accountCode: '1110', debitCents: toCents(34500), creditCents: 0, tenantId: 'TEN-HIDAR-T4', unitId: 'B1' },
      { accountCode: '4110', debitCents: 0, creditCents: toCents(30000), tenantId: 'TEN-HIDAR-T4', unitId: 'B1' },
      { accountCode: '2210', debitCents: 0, creditCents: toCents(4500), tenantId: 'TEN-HIDAR-T4', unitId: 'B1', taxCode: 'VAT-15-DRAFT' },
    ],
  });

  if (!vatResult.posted) {
    throw new Error(vatResult.error);
  }
  cloned.entries.push(vatResult.journal);
  const workpaper = computeTaxWorkpaperDraft({
    bundle: cloned,
    periodCode: '2019-03',
    generatedBy: 'VAT Draft Training Simulator',
  });

  return { bundle: cloned, vatJournal: vatResult.journal, workpaper };
}

export interface HidarVerificationCheckResult {
  id: number;
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export function runHidarVerificationSuite(alphaBundle?: LedgerOwnerBundle): HidarVerificationCheckResult[] {
  const bundle = alphaBundle ? alphaBundle : buildHidarAlphaBundle();
  const tb = computeTrialBalance(bundle.accounts, bundle.openingBalances, bundle.entries);
  const inc = computeIncomeStatement(tb);
  const clearing = computeClearingStatus(tb, bundle.gatewayBatches);
  const bank1020 = tb.rows.find((r) => r.accountCode === '1020')?.closingNetCents || 0;
  const ar1110 = tb.rows.find((r) => r.accountCode === '1110')?.closingNetCents || 0;
  const ageing = computeTenantAgeing(bundle.tenants);
  const t3Row = ageing.rows.find((r) => r.tenantCode === 'T3');
  const dep3Way = computeThreeWayDepositCheck(tb, bundle.deposits);
  const e1 = bundle.failedEvents.find((f) => f.eventRef === 'E1');
  const j15 = bundle.entries.find((e) => e.journalNumber === 'J15');
  const j16 = bundle.entries.find((e) => e.journalNumber === 'J16');

  const j15LineNet = j15
    ? j15.lines.reduce((s, l) => s + (l.accountCode === '5200' ? l.debitCents - l.creditCents : 0), 0)
    : 0;
  const j16LineNet = j16
    ? j16.lines.reduce((s, l) => s + (l.accountCode === '5200' ? l.debitCents - l.creditCents : 0), 0)
    : 0;

  // Test #8: Finance Officer cannot self-approve J11 bill
  const j11Bill = bundle.vendorBills.find((b) => b.billJournalId === 'JE-ALPHA-2019-03-J11');
  const selfApprovalBlocked = Boolean(j11Bill && j11Bill.makerActorId === 'USR-SYNTH-03' && j11Bill.checkerActorId !== 'USR-SYNTH-03');

  // Test #9: Closed month refuses new entry
  const closedSimBundle: LedgerOwnerBundle = {
    ...bundle,
    periods: bundle.periods.map((p) => (p.periodCode === '2019-03' ? { ...p, status: 'Closed' } : p)),
  };
  const closedPostProbe = postLedgerEvent(closedSimBundle, {
    entryDate: '2026-11-15',
    periodCode: '2019-03',
    ruleId: 'Manual',
    sourceType: 'ManualJournal',
    sourceId: 'PROBE-CLOSED',
    idempotencyKey: 'PROBE-CLOSED-HIDAR',
    description: 'Attempt post into closed Hidar period',
    makerActorId: 'USR-SYNTH-03',
    makerName: 'Demo Finance Officer',
    lines: [
      { accountCode: '5200', debitCents: 10000, creditCents: 0 },
      { accountCode: '1020', debitCents: 0, creditCents: 10000 },
    ],
  });

  // Test #10: 1395/2025 marginal tax on 200,000 ETB = 45,400 ETB
  const tax200kCents = computeMarginalTax1395(toCents(200000));

  return [
    {
      id: 1,
      title: 'Opening TB (6,535,000) & Closing TB (6,717,860) balanced',
      expected: 'Open 6,535,000 == 6,535,000 | Close 6,717,860 == 6,717,860',
      actual: `Open ${tb.openingDebitCents / 100} == ${tb.openingCreditCents / 100} | Close ${tb.totalDebitCents / 100} == ${tb.totalCreditCents / 100}`,
      passed:
        tb.openingDebitCents === toCents(6535000) &&
        tb.openingCreditCents === toCents(6535000) &&
        tb.totalDebitCents === toCents(6717860) &&
        tb.totalCreditCents === toCents(6717860),
    },
    {
      id: 2,
      title: 'Net Income 43,760 = Income 82,500 - Expenses 38,740',
      expected: '82,500 - 38,740 = 43,760 ETB',
      actual: `${inc.totalIncomeCents / 100} - ${inc.totalExpenseCents / 100} = ${inc.netIncomeCents / 100} ETB`,
      passed:
        inc.totalIncomeCents === toCents(82500) &&
        inc.totalExpenseCents === toCents(38740) &&
        inc.netIncomeCents === toCents(43760),
    },
    {
      id: 3,
      title: 'Mobile-money clearing (1040) = 0 & Bank Operating (1020) = 301,620',
      expected: '1040 = 0 | 1020 = 301,620 ETB',
      actual: `1040 = ${clearing.clearing1040Cents / 100} | 1020 = ${bank1020 / 100} ETB`,
      passed: clearing.clearing1040Cents === 0 && bank1020 === toCents(301620),
    },
    {
      id: 4,
      title: 'Rent Receivable = 20,000; Ageing shows 15,000 (1-30d) + 5,000 (31-60d) for T3 only',
      expected: '1110 = 20,000 | T3: 15,000 & 5,000 | Others: 0',
      actual: `1110 = ${ar1110 / 100} | T3: ${(t3Row?.days1to30Cents || 0) / 100} & ${(t3Row?.days31to60Cents || 0) / 100}`,
      passed:
        ar1110 === toCents(20000) &&
        ageing.totalReceivableCents === toCents(20000) &&
        t3Row?.days1to30Cents === toCents(15000) &&
        t3Row?.days31to60Cents === toCents(5000),
    },
    {
      id: 5,
      title: 'Deposit three-way check agrees at ETB 160,000',
      expected: '1030 (160,000) == 2120 (160,000) == Sub-ledger (160,000)',
      actual: `${dep3Way.bank1030Cents / 100} == ${dep3Way.liability2120Cents / 100} == ${dep3Way.subledgerSumCents / 100}`,
      passed: dep3Way.balanced && dep3Way.bank1030Cents === toCents(160000),
    },
    {
      id: 6,
      title: 'Failed Telebirr payment (E1) creates 0 journals; 19 journals posted',
      expected: 'E1 journals = 0 | Total journals = 19',
      actual: `E1 journals = ${e1?.journalsCreatedCount ?? -1} | Total journals = ${bundle.entries.length}`,
      passed: Boolean(e1 && e1.journalsCreatedCount === 0 && bundle.entries.length === 19),
    },
    {
      id: 7,
      title: 'J15 and J16 net to 0, J16 links to J15, J15 remains visible',
      expected: 'Net = 0 | J16.reversalOfJournalId == J15.id | J15 visible',
      actual: `Net = ${(j15LineNet + j16LineNet) / 100} | Link = ${j16?.reversalOfJournalId || 'missing'}`,
      passed: Boolean(
        j15 &&
          j16 &&
          j15LineNet + j16LineNet === 0 &&
          j16.reversalOfJournalId === j15.id &&
          j15.reversedByJournalId === j16.id
      ),
    },
    {
      id: 8,
      title: 'Finance Officer cannot self-approve own bill (J11)',
      expected: 'Self-approval blocked (checkerActorId != makerActorId)',
      actual: `J11 Maker: ${j11Bill?.makerActorId} | Checker: ${j11Bill?.checkerActorId}`,
      passed: selfApprovalBlocked,
    },
    {
      id: 9,
      title: 'Closed period refuses any new entry dated inside the closed month',
      expected: 'Posted = false on Closed period',
      actual: `Posted = ${closedPostProbe.posted}`,
      passed: !closedPostProbe.posted,
    },
    {
      id: 10,
      title: 'Amendment 1395/2025 marginal tax test returns ETB 45,400 for ETB 200,000',
      expected: 'ETB 45,400',
      actual: `ETB ${(tax200kCents / 100).toLocaleString()}`,
      passed: tax200kCents === toCents(45400),
    },
  ];
}

export const ACCOUNTING_TRAINING_EXERCISES: TrainingExercise[] = [
  {
    id: 'EX-ACCT-01',
    number: 11,
    title: 'Post Residential & Commercial Rent Schedule Charges',
    titleAm: 'የመኖሪያና የንግድ ኪራይ ክፍያዎችን (Straight-Line ጨምሮ) መመዝገብ',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    targetSection: 'finance',
    objective: 'Run Hidar 2019 E.C. residential charges (PR-01) and commercial straight-line rent accrual (PR-04) and inspect 4100/4110 and 1130 balances.',
    objectiveAm: 'የኅዳር 2019 ዓ.ም የመኖሪያ (PR-01) እና የንግድ (PR-04) ኪራይ ግቤቶችን መመዝገብና ሚዛኑን ማረጋገጥ።',
    startingCondition: 'Signed in as finance.demo in OWN-ALPHA Hidar worked month.',
    startingConditionAm: 'በ finance.demo በ OWN-ALPHA የኅዳር መዝገብ ውስጥ ሲገቡ።',
    steps: [
      { en: 'Open Finance -> Journals & Posting Rules and filter for J01–J04.', am: 'ፋይናንስ -> ጆርናሎች ገብተው J01–J04ን ይመልከቱ።' },
      { en: 'Verify T4 12-month commercial lease with 1 free month posts ETB 27,500 to 1130 Accrued Rent and 4110 Commercial Rental Income.', am: 'ለT4 የ12 ወር ውል 1 ነጻ ወር ሲቀነስ 27,500 በ 1130 እና 4110 መመዝገቡን ያረጋግጡ።' },
    ],
    expectedOutcome: '4100 totals ETB 55,000, 4110 totals ETB 27,500, and 1130 equals ETB 27,500.',
    expectedOutcomeAm: '4100 ETB 55,000፣ 4110 ETB 27,500 እና 1130 ETB 27,500 ይሆናሉ።',
    failedControlExplanation: 'Residential 4100 stays separate from Commercial 4110; VAT output 2210 stays locked.',
    failedControlExplanationAm: 'የመኖሪያና የንግድ ኪራይ ተለይተው ይመዘገባሉ፤ VAT 2210 ተቆልፎ ይቆያል።',
    auditMatchKeywords: ['Ledger Journal Posted', 'Charge'],
  },
  {
    id: 'EX-ACCT-02',
    number: 12,
    title: 'Verify Failed Gateway Webhook Creates Zero Journals (PR-08)',
    titleAm: 'ያልተሳካ የቴሌብር ክፍያ ዜሮ የጆርናል ግቤት መፍጠሩን ማረጋገጥ (PR-08)',
    recommendedUsername: 'collections.demo',
    recommendedRole: 'Collections Clerk',
    targetSection: 'finance',
    objective: 'Simulate a Failed Telebirr webhook (PR-08) and verify 0 journal entries and 0 receipts are created.',
    objectiveAm: 'ያልተሳካ የቴሌብር ክፍያ ማስመሰያ አሂዶ 0 ጆርናልና 0 ደረሰኝ መፈጠሩን ማረጋገጥ።',
    startingCondition: 'Failed event E1 logged in Hidar for T3 (ETB 5,000).',
    startingConditionAm: 'በኅዳር ውስጥ ያልተሳካ ክስተት E1 ለ T3 ሲኖር።',
    steps: [
      { en: 'Open Finance -> Journals & Posting Rules and click Simulate Failed Telebirr Event.', am: 'በፋይናንስ -> ጆርናሎች ውስጥ ያልተሳካ የቴሌብር ሙከራን ይጫኑ።' },
      { en: 'Confirm Trial Balance total and journal count remain unchanged while audit log records the failed attempt.', am: 'የጆርናል ብዛትና ሚዛን አለመቀየሩን ያረጋግጡ።' },
    ],
    expectedOutcome: 'Failed gateway events create 0 journals and 0 receipts.',
    expectedOutcomeAm: 'ያልተሳኩ ክስተቶች 0 ጆርናልና 0 ደረሰኝ ይፈጥራሉ።',
    failedControlExplanation: 'PR-08 blocks all ledger writes unless gateway status == Success.',
    failedControlExplanationAm: 'PR-08 ሁኔታው Success ካልሆነ ማንኛውንም የመዝገብ ግቤት ይከለክላል።',
    auditMatchKeywords: ['PR-08', 'Failed Gateway'],
  },
  {
    id: 'EX-ACCT-03',
    number: 13,
    title: 'Clear Mobile-Money Settled Batches to Zero (PR-09)',
    titleAm: 'የሞባይል ገንዘብ መሸጋገሪያ ሂሳብን (1040) ወደ ዜሮ ማወራረድ',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'finance',
    objective: 'Inspect how Telebirr settlement batches clear 1040 to 1020 Bank Operating and book ETB 270 gateway fees to 5600.',
    objectiveAm: 'የቴሌብር ማወራረጃ 1040ን ወደ 1020 እና 5600 በማዛወር ዜሮ ማድረጉን ማረጋገጥ።',
    startingCondition: 'Two settled Hidar Telebirr batches (R-001, R-002).',
    startingConditionAm: 'ሁለት የኅዳር ቴሌብር ስብስቦች (R-001, R-002)።',
    steps: [
      { en: 'Open Finance -> Clearing & Reconciliation and check 1040 Mobile-Money Clearing balance.', am: 'ፋይናንስ -> ማስታረቅ ገብተው 1040 ሚዛንን ይመልከቱ።' },
      { en: 'Verify 1040 closing balance equals ETB 0 and 5600 fees equal ETB 540.', am: '1040 ወደ 0 መወራረዱንና 5600 ETB 540 መሆኑን ያረጋግጡ።' },
    ],
    expectedOutcome: '1040 clearing is 0 and 1020 Bank reconciles cleanly to ETB 301,620.',
    expectedOutcomeAm: '1040 ዜሮ ይሆናል፤ 1020 ባንክ ETB 301,620 ይሆናል።',
    failedControlExplanation: 'Period close checklist step 3 blocks close whenever 1040 != 0.',
    failedControlExplanationAm: '1040 ከዜሮ ውጭ ከሆነ የወሩ መዝጊያ ይታገዳል።',
    auditMatchKeywords: ['Gateway', 'Reconciliation'],
  },
  {
    id: 'EX-ACCT-04',
    number: 14,
    title: 'Reconcile Deposit Three-Way Check (1030 == 2120 == Sub-ledger)',
    titleAm: 'የተከራይ ዋስትና ሦስትዮሽ ማስታረቅን (1030 == 2120 == ውሎች) ማረጋገጥ',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'finance',
    objective: 'Verify security deposits are segregated in 1030/2120 (ETB 160,000) and test move-out refund/deduction Maker-Checker approval.',
    objectiveAm: 'ተቀማጭ ገንዘብ 160,000 ብር በ1030 እና 2120 እኩል መሆኑንና የመመለስ ጥያቄን መፈተሽ።',
    startingCondition: 'Four held deposits: T1 36k, T2 44k, T3 20k, T4 60k.',
    startingConditionAm: 'አራት የዋስትና ተቀማጮች (160,000 ብር)።',
    steps: [
      { en: 'Open Finance -> Receivables & Deposits and verify the 3-way banner shows ETB 160,000 Balanced.', am: 'በፋይናንስ -> ተሰብሳቢና ተቀማጭ ውስጥ ሦስትዮሽ ማስታረቁ 160,000 መሆኑን ይመልከቱ።' },
      { en: 'Propose a move-out refund/deduction and verify it routes to GM approval.', am: 'የተቀማጭ መመለስ ጥያቄ አቅርበው ወደ GM ማጽደቂያ መሄዱን ያረጋግጡ።' },
    ],
    expectedOutcome: '3-way custody check remains in exact equality; deposits never leak into rental revenue.',
    expectedOutcomeAm: 'ሦስትዮሽ ማስታረቁ እኩል ይቆያል፤ ተቀማጭ እንደ ገቢ አይመዘገብም።',
    failedControlExplanation: 'Direct deposit edits without PR-14/PR-15 approval are blocked.',
    failedControlExplanationAm: 'ያለ PR-14/PR-15 ማጽደቂያ ተቀማጭን መለወጥ ታግዷል።',
    auditMatchKeywords: ['Deposit'],
  },
  {
    id: 'EX-ACCT-05',
    number: 15,
    title: 'Allocate Partial Payment FIFO & Apply Advance Rent',
    titleAm: 'ከፊል ክፍያን በቅደም ተከተል መመደብና የቅድሚያ ኪራይን መቆጣጠር',
    recommendedUsername: 'clerk.demo',
    recommendedRole: 'Clerk',
    targetSection: 'finance',
    objective: 'Inspect how T3 partial payment ETB 10,000 reduced Tikimt arrears first leaving ETB 5,000 (31-60d) + ETB 15,000 (1-30d) = ETB 20,000, and how T1 advance ETB 18,000 sits in 2110.',
    objectiveAm: 'የT3 ከፊል ክፍያ የጥቅምትን ዕዳ በቅድሚያ መቀነሱንና የT1 የቅድሚያ ኪራይ 2110 መግባቱን ማረጋገጥ።',
    startingCondition: 'Hidar Receivables & Deposits ledger open.',
    startingConditionAm: 'የኅዳር ተሰብሳቢ ኪራይ ዝርዝር ክፍት ሲሆን።',
    steps: [
      { en: 'Open Finance -> Receivables & Deposits.', am: 'ፋይናንስ -> ተሰብሳቢና ተቀማጭን ይክፈቱ።' },
      { en: 'Verify T3 Total Receivable = ETB 20,000 (15,000 + 5,000) and T1 Advance Rent = ETB 18,000.', am: 'T3 ETB 20,000 (15k + 5k) እና T1 ቅድሚያ 18,000 መሆኑን ያረጋግጡ።' },
    ],
    expectedOutcome: 'Tenant ageing equals 1110 Rent Receivable (20,000) and advance rent equals 2110 (18,000).',
    expectedOutcomeAm: 'የተከራዮች ዕድሜ ሪፖርት ከ1110 (20,000) እና ከ2110 (18,000) ጋር ይስማማል።',
    failedControlExplanation: 'Advance rent > 2 months triggers residential rent-control alert (1320/2016 E.C.).',
    failedControlExplanationAm: 'ከ2 ወር በላይ የቅድሚያ ኪራይ የኪራይ ቁጥጥር ማስጠንቀቂያ ያስነሳል።',
    auditMatchKeywords: ['Receivable', 'Payment'],
  },
  {
    id: 'EX-ACCT-06',
    number: 16,
    title: 'Record Vendor Bill with 3% WHT & Block Self-Approval (J11/J12)',
    titleAm: 'የአቅራቢ ክፍያን ከ3% ተቀናሽ ታክስ ጋር መመዝገብና የራስን ማጽደቅ መከልከል',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'finance',
    objective: 'Create a vendor bill above ETB 10,000 services threshold, confirm 3% WHT calculation, and verify Maker cannot self-approve.',
    objectiveAm: 'ከ ETB 10,000 በላይ የአገልግሎት ክፍያ አዘጋጅቶ 3% WHT መሰላቱንና ራስን ማጽደቅ መታገዱን ማረጋገጥ።',
    startingCondition: 'J11/J12 Hidar plumbing bill ETB 12,000 -> WHT 360 -> Net 11,640.',
    startingConditionAm: 'J11/J12 የቧንቧ ጥገና ክፍያ (12,000 ብር፣ WHT 360)።',
    steps: [
      { en: 'Open Finance -> Payables & Fixed Assets and inspect BILL-ALPHA-001.', am: 'ፋይናንስ -> ተከፋዮችና ቋሚ ንብረቶች ውስጥ BILL-ALPHA-001ን ይመልከቱ።' },
      { en: 'Try creating a new Services bill > ETB 10,000 and verify Cash > 50,000 payment is refused.', am: 'ከ ETB 10,000 በላይ አዲስ ክፍያ ይፍጠሩና ከ50,000 ብር በላይ በጥሬ ገንዘብ መከልከሉን ይመልከቱ።' },
    ],
    expectedOutcome: 'WHT 3% accrues automatically to 2220; Maker cannot approve own bill.',
    expectedOutcomeAm: '3% WHT በ2220 ይመዘገባል፤ አዘጋጁ በራሱ ማጽደቅ አይችልም።',
    failedControlExplanation: 'Self-approval is blocked at both action policy and Approval Centre.',
    failedControlExplanationAm: 'ራስን ማጽደቅ በRBAC እና በማጽደቂያ ማዕከል ይታገዳል።',
    auditMatchKeywords: ['Vendor Bill', 'Withholding'],
  },
  {
    id: 'EX-ACCT-07',
    number: 17,
    title: 'Verify Mirror Reversal Entry Pair (J15 / J16, PR-25)',
    titleAm: 'ተገላቢጦሽ የጆርናል ግቤትን (J15 / J16, PR-25) መፈተሽ',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'finance',
    objective: 'Inspect J15 and its linked mirror reversal J16, and submit a new PR-25 reversal request verifying original entries stay visible.',
    objectiveAm: 'J15 እና ተገላቢጦሹን J16 መመርመርና አዲስ የPR-25 ግልበጣ ጥያቄ ማቅረብ።',
    startingCondition: 'J15 (4,500 utilities) & J16 (-4,500 reversal) present in Hidar.',
    startingConditionAm: 'J15 እና J16 በኅዳር ጆርናሎች ውስጥ ሲኖሩ።',
    steps: [
      { en: 'Open Finance -> Journals & Posting Rules and expand J15 and J16.', am: 'ፋይናንስ -> ጆርናሎች ገብተው J15 እና J16ን ይክፈቱ።' },
      { en: 'Confirm J15 remains visible (status Reversed) and J15 + J16 net to ETB 0 on 5200 Utilities.', am: 'J15 ሳይጠፋ መቆየቱንና ድምራቸው 0 መሆኑን ያረጋግጡ።' },
    ],
    expectedOutcome: 'Append-only integrity maintained: zero edits or deletes on posted journals.',
    expectedOutcomeAm: 'የተመዘገቡ ጆርናሎች አይሰረዙም ወይም አይስተካከሉም።',
    failedControlExplanation: 'SQLite & Postgres triggers reject UPDATE/DELETE on journal_lines.',
    failedControlExplanationAm: 'SQLite እና Postgres ትሪገሮች የጆርናል ስረዛን ይከለክላሉ።',
    auditMatchKeywords: ['Reversal', 'PR-25'],
  },
  {
    id: 'EX-ACCT-08',
    number: 18,
    title: 'Run Monthly Straight-Line Depreciation (PR-22)',
    titleAm: 'ወርሃዊ የእርጅና ቅናሽ (PR-22) ማስላትና መመዝገብ',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    targetSection: 'finance',
    objective: 'Inspect Building (25y = ETB 20,000/mo) and Equipment (5y = ETB 2,000/mo) schedules and test running PR-22 in Tahsas (2019-04).',
    objectiveAm: 'የሕንጻ (25 ዓመት) እና የመሣሪያ (5 ዓመት) የእርጅና ቅናሽን መርምሮ በታኅሣሥ መፈተሽ።',
    startingCondition: 'Two fixed assets in OWN-ALPHA; J18 posted for Hidar.',
    startingConditionAm: 'ሁለት ቋሚ ንብረቶች እና የኅዳር J18።',
    steps: [
      { en: 'Open Finance -> Payables & Fixed Assets -> Fixed Asset Register.', am: 'ፋይናንስ -> ተከፋዮችና ቋሚ ንብረቶች ውስጥ ቋሚ ንብረቶችን ይመልከቱ።' },
      { en: 'Run PR-22 Depreciation for Tahsas (2019-04) and confirm duplicate run is blocked.', am: 'ለታኅሣሥ PR-22ን አስኬደው ድጋሚ መመዝገብ መታገዱን ያረጋግጡ።' },
    ],
    expectedOutcome: 'Debits 5900 ETB 22,000, Credits 1220 ETB 20,000 and 1240 ETB 2,000.',
    expectedOutcomeAm: '5900 ETB 22,000፣ 1220 ETB 20,000 እና 1240 ETB 2,000 ይመዘገባሉ።',
    failedControlExplanation: 'Idempotency key prevents double-posting depreciation within the same month.',
    failedControlExplanationAm: 'በአንድ ወር ውስጥ ሁለት ጊዜ የእርጅና ቅናሽ መመዝገብ ታግዷል።',
    auditMatchKeywords: ['Depreciation', 'PR-22'],
  },
  {
    id: 'EX-ACCT-09',
    number: 19,
    title: 'Complete Period Close Checklist & Enforce Closed-Period Lock',
    titleAm: 'የወር መዝጊያ ዝርዝር ማጠናቀቅና የተዘጋ ወቅትን መቆለፍ',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'finance',
    objective: 'Verify all 9 Hidar close checklist checks pass, route Period Close for GM approval, and test closed-period posting block.',
    objectiveAm: '9ኙ የመዝጊያ ፍተሻዎች ማለፋቸውን አረጋግጦ ወደ GM መላክና በተዘጋ ወቅት መጻፍ መታገዱን መፈተሽ።',
    startingCondition: 'Hidar 2019-03 open with 9/9 checklist checks passing.',
    startingConditionAm: 'ኅዳር 2019-03 ክፍት ሆኖ 9/9 ፍተሻዎች ሲያልፉ።',
    steps: [
      { en: 'Open Finance -> Period Close & Year-End and click Request Period Close.', am: 'ፋይናንስ -> የወቅት መዝጊያ ገብተው መዝጊያ ይጠይቁ።' },
      { en: 'Approve as gm.demo and test Simulate Post to Closed Period.', am: 'በ gm.demo አጽድቀው በተዘጋ ወቅት የመጻፍ ሙከራን ይፈትሹ።' },
    ],
    expectedOutcome: 'Closed period permanently refuses back-dated entries unless formally reopened.',
    expectedOutcomeAm: 'የተዘጋ ወቅት እንደገና ካልተከፈተ በስተቀር አዲስ ግቤት አይቀበልም።',
    failedControlExplanation: 'Period preparer cannot approve own close checklist.',
    failedControlExplanationAm: 'ዝርዝሩን ያዘጋጀው ሠራተኛ መዝጊያውን ማጽደቅ አይችልም።',
    auditMatchKeywords: ['Period Close', 'Closed'],
  },
  {
    id: 'EX-ACCT-10',
    number: 20,
    title: 'Compare Tax Books vs. Flat Method & Test 1395/2025 Bands',
    titleAm: 'የመዝገብ (Books) እና የ20%/35% የታክስ ዘዴን ማነጻጸር',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    targetSection: 'tax',
    objective: 'Run Workpaper Studio comparing Books vs. Flat 20%/35%, verify ETB 200,000 returns ETB 45,400 under 1395/2025, and confirm Active gate stays locked.',
    objectiveAm: 'በታክስ ረቂቅ ውስጥ Books ከ 20%/35% ጋር ማነጻጸርና ETB 200,000 -> 45,400 መሆኑን ማረጋገጥ።',
    startingCondition: 'Workpaper Studio available in Tax Configuration.',
    startingConditionAm: 'በታክስ ውቅር ውስጥ የስሌት ረቂቅ ስቱዲዮ ሲኖር።',
    steps: [
      { en: 'Open Tax Configuration -> Workpaper Studio & Calculators.', am: 'የታክስ ረቂቅ -> Workpaper Studio ይክፈቱ።' },
      { en: 'Verify marginal band verifier shows ETB 200,000 => ETB 45,400 and Active state remains Locked.', am: 'ለ ETB 200,000 የታክስ ውጤት 45,400 መሆኑንና ንቁ ደረጃ መቆለፉን ያረጋግጡ።' },
    ],
    expectedOutcome: 'Versioned rule packs run draft workpapers only while ENABLE_LIVE_TAX_INVOICING=False.',
    expectedOutcomeAm: 'ስሌቶቹ በረቂቅ ብቻ ይሰራሉ፤ ንቁ መዝገብ አይነካም።',
    failedControlExplanation: 'Tax rates cannot move to Active without adviser & owner sign-off.',
    failedControlExplanationAm: 'ያለ አማካሪና ባለቤት ፊርማ ምጣኔ አይነቃም።',
    auditMatchKeywords: ['Tax Workpaper'],
  },
  {
    id: 'EX-ACCT-11',
    number: 21,
    title: 'Reopen a Closed Period via Maker-Checker Governance',
    titleAm: 'የተዘጋ የሂሳብ ወቅትን በማጽደቂያ እንደገና መክፈት',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'finance',
    objective: 'Submit a Period Reopen request with mandatory reason for Tikimt (2019-02) and verify GM (or Owner if GM requested) authorization.',
    objectiveAm: 'ለተዘጋው ጥቅምት ወቅት የመክፈት ጥያቄ አቅርቦ በGM ማጽደቅ።',
    startingCondition: 'Tikimt (2019-02) is Closed.',
    startingConditionAm: 'ጥቅምት (2019-02) ተዘግቶ ሲገኝ።',
    steps: [
      { en: 'Open Finance -> Period Close & Year-End -> Tikimt (2019-02) and click Request Reopen.', am: 'ጥቅምት (2019-02) ላይ "እንደገና ክፈት ጠይቅ"ን ይጫኑ።' },
      { en: 'Approve via gm.demo in Approvals Centre and verify status transitions to Reopened.', am: 'በ gm.demo አጽድቀው ወደ Reopened መቀየሩን ያረጋግጡ።' },
    ],
    expectedOutcome: 'Period transitions to Reopened with immutable reason & checker recorded.',
    expectedOutcomeAm: 'ወቅቱ ከምክንያትና ከአጽዳቂ ጋር ወደ Reopened ይቀየራል።',
    failedControlExplanation: 'Direct unapproved reopening is disabled.',
    failedControlExplanationAm: 'ያለ ማጽደቂያ በቀጥታ መክፈት አይቻልም።',
    auditMatchKeywords: ['Period Reopen'],
  },
  {
    id: 'EX-ACCT-12',
    number: 22,
    title: 'Run 8-Point Restore Integrity & Hidar 10/10 Self-Check Suite',
    titleAm: '8ቱን የምትኬ ማረጋገጫዎችና 10 የኅዳር ራስ-ፍተሻዎችን ማስኬድ',
    recommendedUsername: 'auditor.demo',
    recommendedRole: 'Auditor / Read-only reviewer',
    targetSection: 'finance',
    objective: 'Execute the automated Hidar 10/10 Answer-Key verification suite, copy the VAT-enabled T4 training variant, and verify the 8-point Backup Integrity Manifest.',
    objectiveAm: '10 የኅዳር መልስ ቁልፍ ፍተሻዎችንና 8ቱን የምትኬ ማረጋገጫዎች ማስኬድ።',
    startingCondition: 'Signed in as any authorized persona (Auditor, Finance, GM).',
    startingConditionAm: 'በ Auditor, Finance ወይም GM ሲገቡ።',
    steps: [
      { en: 'Open Finance -> Hidar Lab & Migration Replay and run the 10-Point Verification Suite.', am: 'ፋይናንስ -> Hidar Lab ገብተው 10ኙን ፍተሻዎች ያስኪዱ።' },
      { en: 'Open Backup & Recovery and confirm all 8 Restore Integrity Manifest checks show Pass.', am: 'ምትኬና መልሶ ማግኛ ገብተው 8ቱም ማረጋገጫዎች Pass መሆናቸውን ይመልከቱ።' },
    ],
    expectedOutcome: '10/10 Hidar checks and 8/8 Backup Manifest checks pass deterministically.',
    expectedOutcomeAm: '10/10 የኅዳር ፍተሻዎችና 8/8 የምትኬ ፍተሻዎች በሙሉ ያልፋሉ።',
    failedControlExplanation: 'VAT variant executes strictly on an isolated copy so canonical Hidar numbers stay pristine.',
    failedControlExplanationAm: 'የVAT ሙከራ በተለየ ቅጂ ላይ ስለሚሠራ ዋናው የኅዳር ቁጥር አይበላሽም።',
    auditMatchKeywords: ['Backup', 'Hidar'],
  },
];
