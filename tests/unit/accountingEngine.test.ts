import { describe, expect, it } from 'vitest';
import {
  CANONICAL_COA_V2_TEMPLATE,
  ENABLE_LIVE_TAX_INVOICING,
  POSTING_RULES_CATALOG,
} from '../../src/data/accountingRulePack';
import {
  buildBetaBaselineBundle,
  buildCopyableHidarVatVariant,
  buildHidarAlphaBundle,
  runHidarVerificationSuite,
} from '../../src/data/hidarWorkedMonth';
import { ACCOUNTING_GLOSSARY_AM } from '../../src/data/i18n';
import { createInitialSeedState } from '../../src/data/seedData';
import {
  buildMirrorReversal,
  computeIncomeStatement,
  computeTaxWorkpaperDraft,
  computeTrialBalance,
  postLedgerEvent,
  runMonthlyDepreciation,
  runPrototypeMigrationReplay,
  safeDivide,
  sumCentsBigInt,
  toCents,
  verifyBackupIntegrityManifest,
} from '../../src/services/accountingEngine';

describe('AD-PRMS Accounting Engine & Ethiopian Tax Rules (Steps 1–7)', () => {
  it('passes all 10 Proposal §12.9 Hidar worked-month acceptance checks', () => {
    const bundle = buildHidarAlphaBundle();
    const results = runHidarVerificationSuite(bundle);

    expect(results).toHaveLength(10);
    for (const check of results) {
      expect(check.passed, `Check #${check.id} (${check.title}) failed: ${check.actual}`).toBe(true);
    }
  });

  it('produces exact Hidar Trial Balance (6,717,860), Income Statement (43,760), and Balance Sheet identity', () => {
    const bundle = buildHidarAlphaBundle();
    const tb = computeTrialBalance(bundle.accounts, bundle.openingBalances, bundle.entries);
    const inc = computeIncomeStatement(tb);

    expect(tb.balanced).toBe(true);
    expect(tb.openingDebitCents).toBe(toCents(6535000));
    expect(tb.totalDebitCents).toBe(toCents(6717860));
    expect(tb.totalCreditCents).toBe(toCents(6717860));

    expect(inc.totalIncomeCents).toBe(toCents(82500));
    expect(inc.totalExpenseCents).toBe(toCents(38740));
    expect(inc.netIncomeCents).toBe(toCents(43760));
  });

  it('builds copyable VAT-enabled Hidar variant for Commercial T4 (30,000 + 4,500 VAT = 34,500)', () => {
    const alpha = buildHidarAlphaBundle();
    const { vatJournal, workpaper } = buildCopyableHidarVatVariant(alpha);

    const vatLine = vatJournal.lines.find((l) => l.accountCode === '2210');
    const arLine = vatJournal.lines.find((l) => l.accountCode === '1110');
    expect(arLine?.debitCents).toBe(toCents(34500));
    expect(vatLine?.creditCents).toBe(toCents(4500));
    expect(workpaper.vatOutputDraftCents).toBe(toCents(4500));
    expect(workpaper.workpaperStatus).toMatch(/Workpaper Draft/i);
  });

  it('computes dual Books vs Flat 20%/35%, Corporate 30%, Property Tax 1365/2025, and keeps live invoicing locked', () => {
    expect(ENABLE_LIVE_TAX_INVOICING).toBe(false);

    const alpha = buildHidarAlphaBundle();
    const indDraft = computeTaxWorkpaperDraft({
      bundle: alpha,
      periodCode: '2019-03',
      generatedBy: 'Unit Test',
    });
    expect(indDraft.grossAnnualizedRentCents).toBe(toCents(82500 * 12));
    expect(indDraft.taxBooksCents).toBeGreaterThan(0);
    expect(indDraft.taxFlat20Cents).toBeGreaterThan(0);
    expect(indDraft.taxFlat35Cents).toBeGreaterThan(0);
    expect(indDraft.whtPayableCents).toBe(toCents(360));
    expect(indDraft.quarterlyAdvanceTaxCents).toBe(Math.round(indDraft.taxBooksCents * 0.25));
    expect(indDraft.propertyTaxEstimateCents).toBe(toCents(3000));

    const beta = buildBetaBaselineBundle();
    const corpDraft = computeTaxWorkpaperDraft({
      bundle: beta,
      periodCode: '2019-03',
      generatedBy: 'Unit Test',
    });
    expect(corpDraft.taxBooksCents).toBe(Math.round(corpDraft.taxableBooksCents * 0.3));
  });

  it('enforces ETB 50,000 daily cash cap and Maker-Checker SoD on PR-25 mirror reversals', () => {
    const bundle = buildHidarAlphaBundle();
    const cashBlock = postLedgerEvent(bundle, {
      entryDate: '2026-11-20',
      periodCode: '2019-03',
      ruleId: 'PR-10',
      sourceType: 'Receipt',
      sourceId: 'RCT-CASH-OVER-50K',
      idempotencyKey: 'UNIT-CASH-OVER-50K',
      description: 'Cash payment exceeding ETB 50,000 cap',
      makerActorId: 'USR-SYNTH-04',
      makerName: 'Demo Collections Clerk',
      cashChannelAmountCents: toCents(60000),
      lines: [
        { accountCode: '1010', debitCents: toCents(60000), creditCents: 0 },
        { accountCode: '1110', debitCents: 0, creditCents: toCents(60000) },
      ],
    });
    expect(cashBlock.posted).toBe(false);

    const j17 = bundle.entries.find((e) => e.journalNumber === 'J17')!;
    const sodBlock = buildMirrorReversal({
      bundle,
      originalJournalId: j17.id,
      entryDate: '2026-12-03',
      reason: 'Self reversal check',
      makerActorId: j17.makerActorId,
      makerName: j17.makerName,
      checkerActorId: j17.makerActorId,
      checkerName: j17.makerName,
    });
    expect(sodBlock.ok).toBe(false);
  });

  it('verifies 8-point Backup Restore Integrity Manifest and prototype migration replay', () => {
    const seed = createInitialSeedState();
    const alpha = buildHidarAlphaBundle();
    const manifest = verifyBackupIntegrityManifest(alpha, seed.auditEvents);

    expect(manifest.checks).toHaveLength(8);
    expect(manifest.allPassed).toBe(true);

    const replayAlpha = runPrototypeMigrationReplay({
      ownerId: 'OWN-ALPHA',
      v1Accounts: seed.accounts,
      charges: seed.charges,
      receipts: seed.receipts,
      leases: seed.leases,
    });
    expect(replayAlpha.trialBalanceBalanced).toBe(true);
    expect(replayAlpha.replayedChargesCount).toBeGreaterThan(0);
  });

  it('includes §15 Amharic glossary terms and omits all Step 8 payroll accounts/rules', () => {
    expect(ACCOUNTING_GLOSSARY_AM.Invoice).toBe('የክፍያ መጠየቂያ');
    expect(ACCOUNTING_GLOSSARY_AM.Receipt).toBe('ደረሰኝ');
    expect(ACCOUNTING_GLOSSARY_AM.Reconciliation).toBe('ሂሳብ ማስታረቅ');

    const payrollCodes = new Set(['6100', '6110', '6120', '6130', '6140', '2260', '2270', '2280', '2285', '1150']);
    for (const acct of CANONICAL_COA_V2_TEMPLATE) {
      expect(payrollCodes.has(acct.code)).toBe(false);
    }
    for (const rule of POSTING_RULES_CATALOG) {
      expect(['PR-28', 'PR-29', 'PR-30', 'PR-31', 'PR-32', 'PR-33', 'PR-34']).not.toContain(rule.ruleId);
    }
  });

  it('guards against divide-by-zero, negative cents, non-finite inputs, and closed period postings', () => {
    expect(safeDivide(1000, 0, -1)).toBe(-1);
    expect(safeDivide(Number.NaN, 12, 0)).toBe(0);
    expect(sumCentsBigInt([1_000_000_00, 2_000_000_00, -500_000_00])).toBe(2_500_000_00);

    const bundle = buildHidarAlphaBundle();
    const closedPeriod = bundle.periods.find((p) => p.status === 'Closed')!;
    const closedRes = postLedgerEvent(bundle, {
      entryDate: closedPeriod.startDateGc,
      periodCode: closedPeriod.periodCode,
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'UNIT-CLOSED',
      idempotencyKey: 'UNIT-CLOSED-1',
      description: 'Should be refused',
      makerActorId: 'USR-SYNTH-06',
      makerName: 'Tester',
      lines: [
        { accountCode: '5200', debitCents: toCents(100), creditCents: 0 },
        { accountCode: '1020', debitCents: 0, creditCents: toCents(100) },
      ],
    });
    expect(closedRes.posted).toBe(false);

    const negRes = postLedgerEvent(bundle, {
      entryDate: '2026-11-20',
      periodCode: '2019-03',
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'UNIT-NEG',
      idempotencyKey: 'UNIT-NEG-1',
      description: 'Negative debit rejected',
      makerActorId: 'USR-SYNTH-06',
      makerName: 'Tester',
      lines: [
        { accountCode: '5200', debitCents: -100, creditCents: 0 },
        { accountCode: '1020', debitCents: 0, creditCents: 100 },
      ],
    });
    expect(negRes.posted).toBe(false);

    const depZeroLifeBundle = {
      ...bundle,
      entries: bundle.entries.filter((e) => e.ruleId !== 'PR-22'),
      fixedAssets: bundle.fixedAssets.map((a) => ({ ...a, usefulLifeMonths: 0 })),
    };
    const depZeroRes = runMonthlyDepreciation(depZeroLifeBundle, '2019-03', 'USR-SYNTH-06', 'Tester');
    expect(depZeroRes.ok).toBe(false);
  });
});
