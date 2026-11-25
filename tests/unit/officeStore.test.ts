// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { OfficeSqliteStore } from '../../server/officeStore';

const tempDirs: string[] = [];

function createTempStore(): { store: OfficeSqliteStore; dbPath: string; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adprms-sqlite-test-'));
  tempDirs.push(dir);
  const dbPath = path.join(dir, 'office-test.db');
  return { store: new OfficeSqliteStore(dir, dbPath), dbPath, dir };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('OfficeSqliteStore (Zero-Key Office Persistence)', () => {
  it('persists workspace state across store restarts and resets cleanly', () => {
    const { store, dbPath, dir } = createTempStore();

    expect(store.getWorkspaceState().initialized).toBe(false);

    const first = store.saveWorkspaceState({ owners: ['OWN-ALPHA'], count: 1 }, 'gm.demo', false);
    expect(first.revision).toBe(1);

    // Reopen a brand new store instance pointing to the same SQLite file
    const reopened = new OfficeSqliteStore(dir, dbPath);
    const loaded = reopened.getWorkspaceState();
    expect(loaded.initialized).toBe(true);
    expect(loaded.revision).toBe(1);
    expect(loaded.state).toEqual({ owners: ['OWN-ALPHA'], count: 1 });

    // onlyIfUninitialized should preserve existing data
    const skipped = reopened.saveWorkspaceState({ count: 999 }, 'initial-seed', true);
    expect(skipped.reusedExisting).toBe(true);
    expect(reopened.getWorkspaceState().state).toEqual({ owners: ['OWN-ALPHA'], count: 1 });

    // Trainer reset overwrites state cleanly
    const reset = reopened.resetWorkspaceState({ owners: ['OWN-ALPHA'], count: 0 }, 'trainer.demo');
    expect(reset.revision).toBe(2);
    expect(reopened.getWorkspaceState().state).toEqual({ owners: ['OWN-ALPHA'], count: 0 });
  });

  it('auto-generates and persists a local VAPID public key across restarts', () => {
    const { store, dbPath, dir } = createTempStore();
    const key1 = store.getVapidPublicKey();
    expect(key1.length).toBeGreaterThan(40);

    const reopened = new OfficeSqliteStore(dir, dbPath);
    expect(reopened.getVapidPublicKey()).toBe(key1);
  });

  it('validates magic bytes, stores local evidence files with SHA-256, and rejects spoofed MIME types', () => {
    const { store } = createTempStore();

    // Valid PDF header
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', 'ascii');
    const saved = store.saveUploadedFile({
      ownerId: 'OWN-ALPHA',
      entityType: 'CBE_SLIP',
      entityRefId: 'CHG-001',
      filename: 'cbe-slip.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBytes,
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      const loaded = store.getUploadedFile(saved.file.fileId);
      expect(loaded?.meta.filename).toBe('cbe-slip.pdf');
      expect(loaded?.buffer.equals(pdfBytes)).toBe(true);
      expect(store.getUploadsCount()).toBe(1);
    }

    // Spoofed PNG (actually plain text)
    const fakePng = store.saveUploadedFile({
      ownerId: 'OWN-ALPHA',
      entityType: 'REPAIR_PHOTO',
      entityRefId: 'MNT-001',
      filename: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-real-png-file'),
    });
    expect(fakePng.ok).toBe(false);
  });

  it('issues and verifies simulated Tenant Phone OTP via SQLite SMS outbox', () => {
    const { store } = createTempStore();

    const bad = store.requestSimulatedTenantOtp('12345', 'en');
    expect(bad.ok).toBe(false);

    const otpReq = store.requestSimulatedTenantOtp('0910000001', 'en');
    expect(otpReq.ok).toBe(true);
    expect(otpReq.msisdn).toBe('+251910000001');
    expect(otpReq.code).toMatch(/^\d{6}$/);

    const wrong = store.verifySimulatedTenantOtp('+251910000001', '000000');
    expect(wrong.ok).toBe(false);

    const verified = store.verifySimulatedTenantOtp('+251910000001', otpReq.code || '');
    expect(verified.ok).toBe(true);
    expect(verified.account?.username).toBe('tenant.a101.demo');
  });

  it('rejects unregistered phone numbers, enforces 5-attempt OTP lockout, and blocks stale revision overwrites', () => {
    const { store } = createTempStore();

    // Unregistered Ethiopian number must NOT fall back to Tenant A-101
    const unknown = store.requestSimulatedTenantOtp('+251999888777', 'en');
    expect(unknown.ok).toBe(false);
    expect(unknown.matchedAccount).toBeUndefined();

    // 5 wrong OTP guesses lock out challenge
    const req = store.requestSimulatedTenantOtp('+251910000002', 'en');
    expect(req.ok).toBe(true);
    for (let i = 0; i < 4; i++) {
      const badTry = store.verifySimulatedTenantOtp('+251910000002', '000000');
      expect(badTry.ok).toBe(false);
    }
    const lockout = store.verifySimulatedTenantOtp('+251910000002', '000000');
    expect(lockout.ok).toBe(false);
    expect(lockout.error).toMatch(/locked/i);

    // Even using the originally issued code after lockout fails
    const postLock = store.verifySimulatedTenantOtp('+251910000002', req.code || '');
    expect(postLock.ok).toBe(false);

    // Optimistic revision concurrency blocks stale updates
    const s1 = store.saveWorkspaceState({ step: 1 }, 'tab-a', false);
    expect(s1.revision).toBe(1);
    const s2 = store.saveWorkspaceState({ step: 2 }, 'tab-b', false, 1);
    expect(s2.conflict).toBe(false);
    expect(s2.revision).toBe(2);

    const stale = store.saveWorkspaceState({ step: 99 }, 'tab-a', false, 1);
    expect(stale.conflict).toBe(true);
    expect(stale.revision).toBe(2);
    expect(store.getWorkspaceState().state).toEqual({ step: 2 });
  });

  it('posts 5600/5800/5900 double-entry journals in SQLite, computes Trial Balance, enforces controls & PR-25 reversal triggers', () => {
    const { store, dbPath } = createTempStore();

    store.saveWorkspaceState(
      {
        ledgerConfigs: [
          {
            id: 'CFG-ALPHA',
            ownerId: 'OWN-ALPHA',
            ledgerCode: 'LDG-OWN-ALPHA',
            entityType: 'Individual',
            vatRegistered: false,
            basis: 'Accrual',
            framework: 'IFRS for SMEs',
          },
        ],
        accountingPeriods: [
          {
            id: 'PER-02',
            ownerId: 'OWN-ALPHA',
            fiscalYearEc: 2019,
            monthIndex: 2,
            periodCode: '2019-02',
            monthNameEn: 'Tikimt',
            startDateGc: '2026-10-11',
            endDateGc: '2026-11-09',
            status: 'Closed',
            lastTrialBalanceCents: 0,
          },
          {
            id: 'PER-03',
            ownerId: 'OWN-ALPHA',
            fiscalYearEc: 2019,
            monthIndex: 3,
            periodCode: '2019-03',
            monthNameEn: 'Hidar',
            startDateGc: '2026-11-10',
            endDateGc: '2026-12-09',
            status: 'Open',
            lastTrialBalanceCents: 0,
          },
        ],
        ledgerAccountsV2: [
          { id: 'A-1020', ownerId: 'OWN-ALPHA', code: '1020', name: 'Bank Operating (CBE)', category: 'Assets', normalBalance: 'Debit', isTaxLocked: false, status: 'Active', version: 1 },
          { id: 'A-1220', ownerId: 'OWN-ALPHA', code: '1220', name: 'Accumulated Depreciation, Buildings', category: 'Assets', normalBalance: 'Credit', isTaxLocked: false, status: 'Active', version: 1 },
          { id: 'A-1240', ownerId: 'OWN-ALPHA', code: '1240', name: 'Accumulated Depreciation, Equipment', category: 'Assets', normalBalance: 'Credit', isTaxLocked: false, status: 'Active', version: 1 },
          { id: 'A-2210', ownerId: 'OWN-ALPHA', code: '2210', name: 'Output VAT Payable', category: 'Liabilities', normalBalance: 'Credit', isTaxLocked: true, status: 'Active', version: 1 },
          { id: 'A-5600', ownerId: 'OWN-ALPHA', code: '5600', name: 'Bank and Gateway Charges', category: 'Expenses', normalBalance: 'Debit', isTaxLocked: false, status: 'Active', version: 1 },
          { id: 'A-5800', ownerId: 'OWN-ALPHA', code: '5800', name: 'Interest Expense', category: 'Expenses', normalBalance: 'Debit', isTaxLocked: false, status: 'Active', version: 1 },
          { id: 'A-5900', ownerId: 'OWN-ALPHA', code: '5900', name: 'Depreciation', category: 'Expenses', normalBalance: 'Debit', isTaxLocked: false, status: 'Active', version: 1 },
        ],
      },
      'seed-init',
      false
    );

    const accounts = store.listLedgerAccountsSql('OWN-ALPHA');
    expect(accounts.map((a) => a.code)).toEqual(['1020', '1220', '1240', '2210', '5600', '5800', '5900']);

    // 1. Post 5600 Bank Charges
    const j5600 = store.postLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      entryDate: '2026-12-08',
      periodCode: '2019-03',
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'EVD-MJE-5600',
      idempotencyKey: 'KEY-5600-01',
      description: 'Telebirr/CBE bank charges',
      makerActorId: 'USR-SYNTH-03',
      checkerActorId: 'USR-SYNTH-02',
      lines: [
        { accountCode: '5600', debitCents: 125000, creditCents: 0 },
        { accountCode: '1020', debitCents: 0, creditCents: 125000 },
      ],
    });
    expect(j5600.ok).toBe(true);
    expect(j5600.debitCents).toBe(125000);

    // Idempotency key reuse does not duplicate
    const reused = store.postLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      entryDate: '2026-12-08',
      periodCode: '2019-03',
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'EVD-MJE-5600',
      idempotencyKey: 'KEY-5600-01',
      description: 'Telebirr/CBE bank charges',
      makerActorId: 'USR-SYNTH-03',
      checkerActorId: 'USR-SYNTH-02',
      lines: [
        { accountCode: '5600', debitCents: 125000, creditCents: 0 },
        { accountCode: '1020', debitCents: 0, creditCents: 125000 },
      ],
    });
    expect(reused.ok).toBe(true);
    expect(reused.reused).toBe(true);

    // 2. Post 5800 Interest Expense
    const j5800 = store.postLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      entryDate: '2026-12-08',
      periodCode: '2019-03',
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'EVD-MJE-5800',
      idempotencyKey: 'KEY-5800-01',
      description: 'Overdraft interest accrual',
      makerActorId: 'USR-SYNTH-03',
      checkerActorId: 'USR-SYNTH-02',
      lines: [
        { accountCode: '5800', debitCents: 450000, creditCents: 0 },
        { accountCode: '1020', debitCents: 0, creditCents: 450000 },
      ],
    });
    expect(j5800.ok).toBe(true);

    // 3. Post 5900 Depreciation (3-line split to 1220 & 1240)
    const j5900 = store.postLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      entryDate: '2026-12-08',
      periodCode: '2019-03',
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'EVD-MJE-5900',
      idempotencyKey: 'KEY-5900-01',
      description: 'Straight-line monthly depreciation',
      makerActorId: 'USR-SYNTH-03',
      checkerActorId: 'USR-SYNTH-02',
      lines: [
        { accountCode: '5900', debitCents: 1200000, creditCents: 0 },
        { accountCode: '1220', debitCents: 0, creditCents: 1000000 },
        { accountCode: '1240', debitCents: 0, creditCents: 200000 },
      ],
    });
    expect(j5900.ok).toBe(true);

    // Controls: Closed period, Tax-Locked account, Unbalanced entry
    const closedErr = store.postLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      entryDate: '2026-10-15',
      periodCode: '2019-02',
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'EVD-CLOSED',
      idempotencyKey: 'KEY-CLOSED',
      description: 'Backdated attempt',
      makerActorId: 'USR-SYNTH-03',
      lines: [
        { accountCode: '5600', debitCents: 1000, creditCents: 0 },
        { accountCode: '1020', debitCents: 0, creditCents: 1000 },
      ],
    });
    expect(closedErr.ok).toBe(false);
    expect(closedErr.error).toMatch(/Closed/i);

    const taxErr = store.postLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      entryDate: '2026-12-08',
      periodCode: '2019-03',
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'EVD-VAT',
      idempotencyKey: 'KEY-VAT',
      description: 'Tax locked block',
      makerActorId: 'USR-SYNTH-03',
      lines: [
        { accountCode: '1020', debitCents: 1000, creditCents: 0 },
        { accountCode: '2210', debitCents: 0, creditCents: 1000 },
      ],
    });
    expect(taxErr.ok).toBe(false);
    expect(taxErr.error).toMatch(/Tax-Locked/i);

    const unbalancedErr = store.postLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      entryDate: '2026-12-08',
      periodCode: '2019-03',
      ruleId: 'Manual',
      sourceType: 'ManualJournal',
      sourceId: 'EVD-UNBAL',
      idempotencyKey: 'KEY-UNBAL',
      description: 'Unbalanced attempt',
      makerActorId: 'USR-SYNTH-03',
      lines: [
        { accountCode: '5600', debitCents: 2000, creditCents: 0 },
        { accountCode: '1020', debitCents: 0, creditCents: 1000 },
      ],
    });
    expect(unbalancedErr.ok).toBe(false);
    expect(unbalancedErr.error).toMatch(/Unbalanced/i);

    // Filter 5xxx journals and verify SQLite Trial Balance
    const fiveXxxJournals = store.listLedgerJournalsSql('OWN-ALPHA', { accountCodePrefix: '5', periodCode: '2019-03' });
    expect(fiveXxxJournals).toHaveLength(3);

    const tb = store.getLedgerTrialBalanceSql('OWN-ALPHA', '2019-03') as {
      balanced: boolean;
      totalDebitCents: number;
      totalCreditCents: number;
      rows: Array<{ accountCode: string; totalDebitCents: number; totalCreditCents: number }>;
    };
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebitCents).toBe(1775000);
    expect(tb.totalCreditCents).toBe(1775000);
    expect(tb.rows.find((r) => r.accountCode === '5600')?.totalDebitCents).toBe(125000);
    expect(tb.rows.find((r) => r.accountCode === '5800')?.totalDebitCents).toBe(450000);
    expect(tb.rows.find((r) => r.accountCode === '5900')?.totalDebitCents).toBe(1200000);

    // Maker-Checker SoD blocks self-reversal; valid Checker reverses cleanly
    const badRev = store.reverseLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      journalId: j5600.journalId!,
      entryDate: '2026-12-08',
      periodCode: '2019-03',
      reason: 'Self reversal attempt',
      makerActorId: 'USR-SYNTH-03',
      checkerActorId: 'USR-SYNTH-03',
    });
    expect(badRev.ok).toBe(false);

    const revOk = store.reverseLedgerJournalSql({
      ownerId: 'OWN-ALPHA',
      journalId: j5600.journalId!,
      entryDate: '2026-12-08',
      periodCode: '2019-03',
      reason: 'Duplicate bank charge fee correction',
      makerActorId: 'USR-SYNTH-03',
      checkerActorId: 'USR-SYNTH-02',
    });
    expect(revOk.ok).toBe(true);

    // Append-only SQLite triggers forbid mutating or deleting posted journal_lines
    const rawDb = new DatabaseSync(dbPath);
    expect(() => rawDb.exec('UPDATE journal_lines SET debit_cents = 999 WHERE line_number = 1;')).toThrow(/Append-only violation/i);
    expect(() => rawDb.exec('DELETE FROM journal_lines WHERE line_number = 1;')).toThrow(/Append-only violation/i);
    rawDb.close();
  });
});
