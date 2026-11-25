import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  GitPullRequest,
  Lock,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { biText } from '../data/i18n';
import { POSTING_RULES_CATALOG } from '../data/accountingRulePack';
import { usePrms } from '../context/PrmsContext';
import { checkActionPermission } from '../policies/rbac';
import { ChartOfAccount, LedgerJournalEntry } from '../types/prms';
import {
  ClearingReconTab,
  HidarLabTab,
  OwnerReportsTab,
  PayablesAssetsTab,
  PeriodCloseTab,
  ReceivablesDepositsTab,
} from '../components/finance/FinanceLedgerTabs';
import {
  GovernanceCallout,
  Modal,
  SlideDrawer,
  StatusLabel,
} from '../components/ui/Primitives';
import { RequireAuth } from '../components/auth/RequireAuth';

const ACCOUNT_GROUPS: ('All' | ChartOfAccount['category'])[] = [
  'All',
  'Assets',
  'Liabilities',
  'Equity',
  'Income',
  'Expenses',
];

type FinanceTab =
  | 'design'
  | 'journals'
  | 'receivables'
  | 'clearing'
  | 'payables'
  | 'close'
  | 'reports'
  | 'lab';

export const FinancePage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    ownerAccounts,
    ownerAccountingPolicies,
    ownerLedgerAccountsV2,
    ownerLedgerJournals,
    ownerFailedGatewayEvents,
    ownerAccountingPeriods,
    ownerLedgerTenants,
    ownerTrialBalance,
    proposeAccountChange,
    submitManualJournal,
    reverseLedgerJournal,
    postRentChargeEvent,
    simulateFailedGatewayEvent,
    locale,
    fmtDate,
    fmtEtb,
    labels,
  } = usePrms();

  const [tab, setTab] = useState<FinanceTab>('design');
  const [coaSubView, setCoaSubView] = useState<'v2' | 'v1' | 'policies'>('v1');
  const [groupFilter, setGroupFilter] = useState<'All' | ChartOfAccount['category']>('All');
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [proposeTarget, setProposeTarget] = useState<ChartOfAccount | null>(null);
  const [rulesDrawerOpen, setRulesDrawerOpen] = useState(false);

  const [journalFilter, setJournalFilter] = useState<'all' | '5xxx' | '5600' | '5800' | '5900'>('all');
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<LedgerJournalEntry | null>(null);
  const [reverseReason, setReverseReason] = useState('Duplicate or misclassified entry correction (PR-25).');

  const openPeriodCode =
    ownerAccountingPeriods.find((p) => p.periodCode === '2019-03')?.periodCode ||
    ownerAccountingPeriods.find((p) => p.status === 'Open')?.periodCode ||
    '2019-03';

  const [proposalForm, setProposalForm] = useState({
    proposedName: '',
    effectiveDate: '2026-12-01',
    evidenceRef: 'EVD-COA-SYNTH-001',
    reason: '',
  });

  type ManualLineDraft = {
    id: string;
    accountCode: string;
    debitEtb: number;
    creditEtb: number;
    description: string;
  };

  const buildPresetLines = (preset: '5600' | '5800' | '5900'): {
    description: string;
    evidenceRef: string;
    lines: ManualLineDraft[];
  } => {
    if (preset === '5600') {
      return {
        description: 'Bank service & Telebirr/ArifPay gateway settlement charges (5600)',
        evidenceRef: 'EVD-MJE-5600',
        lines: [
          { id: 'ln-1', accountCode: '5600', debitEtb: 1250, creditEtb: 0, description: 'Bank & gateway service fee' },
          { id: 'ln-2', accountCode: '1020', debitEtb: 0, creditEtb: 1250, description: 'CBE Operating Bank outflow' },
        ],
      };
    }
    if (preset === '5800') {
      return {
        description: 'Credit facility & overdraft interest expense accrual (5800)',
        evidenceRef: 'EVD-MJE-5800',
        lines: [
          { id: 'ln-1', accountCode: '5800', debitEtb: 4500, creditEtb: 0, description: 'Monthly interest expense' },
          { id: 'ln-2', accountCode: '1020', debitEtb: 0, creditEtb: 4500, description: 'CBE Operating Bank interest debit' },
        ],
      };
    }
    return {
      description: 'Monthly straight-line depreciation charge — buildings & equipment (5900)',
      evidenceRef: 'EVD-MJE-5900',
      lines: [
        { id: 'ln-1', accountCode: '5900', debitEtb: 12000, creditEtb: 0, description: 'Depreciation expense (Buildings + Equipment)' },
        { id: 'ln-2', accountCode: '1220', debitEtb: 0, creditEtb: 10000, description: 'Accumulated Depreciation — Buildings' },
        { id: 'ln-3', accountCode: '1240', debitEtb: 0, creditEtb: 2000, description: 'Accumulated Depreciation — Equipment' },
      ],
    };
  };

  const [manualForm, setManualForm] = useState<{
    entryDate: string;
    periodCode: string;
    description: string;
    evidenceRef: string;
    lines: ManualLineDraft[];
  }>(() => {
    const initial = buildPresetLines('5600');
    return {
      entryDate: '2026-12-08',
      periodCode: openPeriodCode,
      description: initial.description,
      evidenceRef: initial.evidenceRef,
      lines: initial.lines,
    };
  });

  const applyManualPreset = (preset: '5600' | '5800' | '5900') => {
    const next = buildPresetLines(preset);
    setManualForm((prev) => ({
      ...prev,
      periodCode: prev.periodCode || openPeriodCode,
      description: next.description,
      evidenceRef: next.evidenceRef,
      lines: next.lines,
    }));
  };

  const openManualModalFor = (preset?: '5600' | '5800' | '5900') => {
    if (preset) applyManualPreset(preset);
    setManualModalOpen(true);
  };

  const [chargeForm, setChargeForm] = useState({
    tenantId: ownerLedgerTenants[0]?.id || '',
    amountEtb: (ownerLedgerTenants[0]?.monthlyRentCents || 1800000) / 100,
    entryDate: '2026-12-08',
    periodCode: openPeriodCode,
    propertyUse: (ownerLedgerTenants[0]?.propertyUse || 'Residential') as 'Residential' | 'Commercial',
    applyVatDraft: false,
    description: 'Monthly rent billing cycle posting',
  });

  const canPropose = checkActionPermission(currentPersona.role, 'propose_account_change');
  const canPostManual = checkActionPermission(currentPersona.role, 'post_manual_journal');
  const canReverse = checkActionPermission(currentPersona.role, 'reverse_journal');

  const filteredV1Accounts = useMemo(
    () =>
      groupFilter === 'All'
        ? ownerAccounts
        : ownerAccounts.filter((a) => a.category === groupFilter),
    [ownerAccounts, groupFilter]
  );

  const filteredV2Accounts = useMemo(
    () =>
      groupFilter === 'All'
        ? ownerLedgerAccountsV2
        : ownerLedgerAccountsV2.filter((a) => a.category === groupFilter),
    [ownerLedgerAccountsV2, groupFilter]
  );

  const filteredJournals = useMemo(() => {
    if (journalFilter === 'all') return ownerLedgerJournals;
    if (journalFilter === '5xxx') {
      return ownerLedgerJournals.filter((je) =>
        je.lines.some((l) => l.accountCode.startsWith('5'))
      );
    }
    return ownerLedgerJournals.filter((je) =>
      je.lines.some((l) => l.accountCode === journalFilter)
    );
  }, [ownerLedgerJournals, journalFilter]);

  const filtered5xxxTotalCents = useMemo(() => {
    return filteredJournals.reduce((sum, je) => {
      if (je.status === 'Reversed') return sum;
      const lineSum = je.lines.reduce((acc, l) => {
        if (journalFilter === '5xxx' || journalFilter === 'all') {
          return l.accountCode.startsWith('5') ? acc + l.debitCents - l.creditCents : acc;
        }
        return l.accountCode === journalFilter ? acc + l.debitCents - l.creditCents : acc;
      }, 0);
      return sum + lineSum;
    }, 0);
  }, [filteredJournals, journalFilter]);

  const manualTotals = useMemo(() => {
    const debitCents = manualForm.lines.reduce(
      (s, l) => s + Math.round((Number(l.debitEtb) || 0) * 100),
      0
    );
    const creditCents = manualForm.lines.reduce(
      (s, l) => s + Math.round((Number(l.creditEtb) || 0) * 100),
      0
    );
    const hasInvalidLine = manualForm.lines.some((l) => {
      const dr = Math.round((Number(l.debitEtb) || 0) * 100);
      const cr = Math.round((Number(l.creditEtb) || 0) * 100);
      return dr < 0 || cr < 0 || (dr > 0 && cr > 0) || (dr === 0 && cr === 0);
    });
    const balanced = debitCents > 0 && debitCents === creditCents && !hasInvalidLine && manualForm.lines.length >= 2;
    return { debitCents, creditCents, diffCents: debitCents - creditCents, balanced, hasInvalidLine };
  }, [manualForm.lines]);

  const selectedManualPeriod = useMemo(
    () => ownerAccountingPeriods.find((p) => p.periodCode === manualForm.periodCode),
    [ownerAccountingPeriods, manualForm.periodCode]
  );

  const groupedManualAccounts = useMemo(() => {
    const fiveXxx = ownerLedgerAccountsV2.filter((a) => a.code.startsWith('5'));
    const others = ownerLedgerAccountsV2.filter((a) => !a.code.startsWith('5'));
    return { fiveXxx, others };
  }, [ownerLedgerAccountsV2]);

  const handleProposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposeTarget || !proposalForm.proposedName.trim() || !proposalForm.evidenceRef.trim())
      return;
    if (
      proposeAccountChange({
        accountId: proposeTarget.id,
        proposedName: proposalForm.proposedName.trim(),
        effectiveDate: proposalForm.effectiveDate,
        evidenceRef: proposalForm.evidenceRef.trim(),
        reason: proposalForm.reason.trim() || 'Proposed Draft Accounting Design update.',
      })
    ) {
      setProposeTarget(null);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = submitManualJournal({
      entryDate: manualForm.entryDate,
      periodCode: manualForm.periodCode,
      description: manualForm.description,
      evidenceRef: manualForm.evidenceRef,
      lines: manualForm.lines.map((l) => ({
        accountCode: l.accountCode,
        debitEtb: Number(l.debitEtb) || 0,
        creditEtb: Number(l.creditEtb) || 0,
        description: l.description,
      })),
    });
    if (res.ok) setManualModalOpen(false);
  };

  const handleChargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = postRentChargeEvent(chargeForm);
    if (res.ok) setChargeModalOpen(false);
  };

  return (
    <RequireAuth section="finance">
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          `Double-Entry Accounting, Sub-Ledgers & Period Close — ${activeOwner.name}`,
          `ድርብ-መዝገብ ሂሳብ፣ ዝርዝር መዝገቦችና የወር መዝጊያ — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          `Live Trial Balance Dr/Cr ${fmtEtb(ownerTrialBalance.totalDebitCents / 100)} (${ownerLedgerJournals.length} journals). Owner dimension ${activeOwner.id} is mandatory; posted journals are append-only (PR-25 mirror reversals only); closed periods refuse back-dated entries.`,
          `ቀጥታ የሙከራ ሚዛን ${fmtEtb(ownerTrialBalance.totalDebitCents / 100)} (${ownerLedgerJournals.length} ጆርናሎች)። የባለቤት መለያ ${activeOwner.id} ግዴታ ነው፤ የገባ ጆርናል አይሰረዝም።`
        )}
        variant="warning"
        controlType="Prototype Simulation"
      />

      {/* Top 8-Tab Navigation + Owner Dimension */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFF5] dark:bg-[#152236] rounded-xl">
          {(
            [
              ['design', biText(locale, `CoA & Policies (${ownerLedgerAccountsV2.length})`, `የሂሳብ መደብ (${ownerLedgerAccountsV2.length})`)],
              ['journals', biText(locale, `Journals & Rules (${ownerLedgerJournals.length})`, `ጆርናሎች (${ownerLedgerJournals.length})`)],
              ['receivables', biText(locale, 'Receivables & Deposits', 'ተሰብሳቢ እና ዋስትና')],
              ['clearing', biText(locale, 'Clearing & Recon', 'ማወራረጃ እና ባንክ')],
              ['payables', biText(locale, 'Payables & Assets', 'ክፍያዎች እና ንብረቶች')],
              ['close', biText(locale, 'Period Close (13m)', 'የወር መዝጊያ (13 ወር)')],
              ['reports', biText(locale, 'Owner Statement & TB', 'የባለቤት መግለጫ')],
              ['lab', biText(locale, 'Hidar Lab & Replay', 'የኅዳር ላብራቶሪ')],
            ] as [FinanceTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                tab === id
                  ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
          <Lock className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
          {biText(locale, 'Mandatory Owner Dimension:', 'አስገዳጅ የባለቤት ልኬት:')} {activeOwner.id}
        </span>
      </div>

      {/* Tab 1: Canonical v2 CoA + Draft Accounting Design v1 + Policies */}
      {tab === 'design' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1F5F9] dark:bg-[#152236] rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setCoaSubView('v1')}
                className={`px-3 py-1.5 font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                  coaSubView === 'v1'
                    ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {biText(locale, `Draft Accounting Design (${ownerAccounts.length})`, `ረቂቅ የሂሳብ ንድፍ (${ownerAccounts.length})`)}
              </button>
              <button
                type="button"
                onClick={() => setCoaSubView('v2')}
                className={`px-3 py-1.5 font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                  coaSubView === 'v2'
                    ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {biText(locale, `Canonical Ledger CoA 1010–5950 (${ownerLedgerAccountsV2.length})`, `ዋና የሂሳብ መደብ v2 (${ownerLedgerAccountsV2.length})`)}
              </button>
              <button
                type="button"
                onClick={() => setCoaSubView('policies')}
                className={`px-3 py-1.5 font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                  coaSubView === 'policies'
                    ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {biText(locale, `Accounting Policies (${ownerAccountingPolicies.length})`, `የሂሳብ ፖሊሲ (${ownerAccountingPolicies.length})`)}
              </button>
            </div>

            {coaSubView !== 'policies' && (
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1F5F9] dark:bg-[#152236] rounded-xl">
                {ACCOUNT_GROUPS.map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setGroupFilter(grp)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                      groupFilter === grp
                        ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {grp === 'All' ? biText(locale, 'All', 'ሁሉም') : grp}
                  </button>
                ))}
              </div>
            )}
          </div>

          {coaSubView === 'v1' && (
            <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#0F233A] dark:text-slate-100">
                  {biText(locale, 'Governance Draft CoA Change Control (Maker-Checker Protected)', 'በማጽደቂያ ቁጥጥር ሥር ያለ ረቂቅ CoA')}
                </span>
                <button
                  type="button"
                  onClick={() => setCoaSubView('v2')}
                  className="font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {biText(locale, 'Switch to Canonical 1010–5950 Ledger CoA →', 'ወደ 1010–5950 ዋና CoA ቀይር →')}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Account Code', 'የሂሳብ ኮድ')}</th>
                      <th className="py-2.5 px-4 font-semibold">
                        {biText(locale, 'Provisional Account & Review Tag', 'ጊዜያዊ ሂሳብና የግምገማ መለያ')}
                      </th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Group', 'ምድብ')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Owner Dimension', 'የባለቤት መለያ')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Effective Date', 'ተፈጻሚ ቀን')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Lifecycle', 'ሁኔታ')}</th>
                      <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Actions', 'ተግባራት')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                    {filteredV1Accounts.map((acct) => (
                      <tr
                        key={acct.id}
                        className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                          {acct.code}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{acct.name}</p>
                          <p className="text-[11px] text-amber-900 dark:text-amber-300 font-medium mt-0.5">
                            {acct.designTag}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            v{acct.version} · {acct.description}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {acct.category}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {biText(locale, 'Required', 'ግዴታ')} ({acct.ownerId})
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {fmtDate(acct.effectiveDate)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusLabel label={acct.status} />
                        </td>
                        <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedAccount(acct)}
                            className="text-xs font-semibold text-[#0F233A] dark:text-slate-200 hover:underline cursor-pointer"
                          >
                            {biText(locale, 'Version History', 'የእትም ታሪክ')}
                          </button>
                          <button
                            type="button"
                            disabled={!canPropose.allowed}
                            title={canPropose.reason}
                            onClick={() => {
                              setProposeTarget(acct);
                              setProposalForm({
                                proposedName: acct.name,
                                effectiveDate: '2026-12-01',
                                evidenceRef: 'EVD-COA-CHANGE-01',
                                reason: '',
                              });
                            }}
                            className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <GitPullRequest className="w-3.5 h-3.5" />
                            <span>{biText(locale, 'Propose Change', 'ለውጥ አቅርብ')}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {coaSubView === 'v2' && (
            <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex justify-between items-center text-xs">
                <span className="font-semibold text-[#0F233A] dark:text-slate-100">
                  {biText(locale, 'Canonical Double-Entry Chart of Accounts (1010–5950, Steps 1–7)', 'ዋና የድርብ-መዝገብ ሂሳብ መደብ (1010–5950)')}
                </span>
                <span className="font-mono text-slate-500">Tax-Locked Accounts: 1190, 2210</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Code</th>
                      <th className="py-2.5 px-3 font-semibold">Account Name</th>
                      <th className="py-2.5 px-3 font-semibold">Category / Normal</th>
                      <th className="py-2.5 px-3 font-semibold">Tax Class</th>
                      <th className="py-2.5 px-3 font-semibold">Control Guard</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                    {filteredV2Accounts.map((a) => (
                      <tr key={a.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">{a.code}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{a.name}</p>
                          {a.nameAm && <p className="text-[11px] text-slate-500">{a.nameAm}</p>}
                        </td>
                        <td className="py-2.5 px-3">
                          {a.category} · <span className="font-mono">{a.normalBalance}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{a.taxDeductibleClass}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {a.isTaxLocked ? (
                            <span className="text-red-700 dark:text-red-300 font-semibold">Tax-Locked</span>
                          ) : a.isSystemControlled ? (
                            <span className="text-[#0F233A] dark:text-slate-300">System Posting</span>
                          ) : (
                            'Manual Allowed'
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusLabel label={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {coaSubView === 'policies' && (
            <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Policy Topic', 'የፖሊሲ ርዕስ')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Proposed Treatment', 'የቀረበ አያያዝ')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Review Gate', 'የግምገማ ደረጃ')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Posting Availability', 'የምዝገባ ዝግጁነት')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                    {ownerAccountingPolicies.map((pol) => (
                      <tr key={pol.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 align-top">
                        <td className="py-3 px-4 font-semibold text-[#0F233A] dark:text-slate-100 whitespace-nowrap">
                          {pol.topic}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-slate-800 dark:text-slate-200">{pol.proposedTreatment}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{pol.notes}</p>
                        </td>
                        <td className="py-3 px-4">
                          <StatusLabel label={pol.reviewStatus} tone="amber" />
                        </td>
                        <td className="py-3 px-4">
                          <StatusLabel label={pol.postingAvailability} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Tab 2: Live Journals (J01–J19+), PR-08 Failed Events & 27 Posting Rules Catalog */}
      {tab === 'journals' && (
        <section className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                {biText(locale, `Append-Only Double-Entry Ledger (${ownerLedgerJournals.length} Journals)`, `የማይፋቅ ድርብ-መዝገብ ጆርናል (${ownerLedgerJournals.length})`)}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                {biText(
                  locale,
                  'Balanced integer-cent postings with posting rule tags, Directive 1142/2026 e-invoice metadata, and PR-25 mirror reversals.',
                  'ሁሉም ግቤቶች የተመጣጠኑ ናቸው፤ መሰረዝ አይቻልም፣ በ PR-25 መገልበጫ ብቻ ይስተካከላሉ።'
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRulesDrawerOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{biText(locale, '27 Posting Rules', '27 የምዝገባ ደንቦች')}</span>
              </button>
              <button
                type="button"
                onClick={() => setChargeModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Post Rent Charge', 'የኪራይ ክፍያ ጻፍ')}</span>
              </button>
              <button
                type="button"
                onClick={() => openManualModalFor()}
                className="px-3 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Manual Journal (5xxx)', 'በእጅ ጆርናል (5xxx)')}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  simulateFailedGatewayEvent({
                    tenantRef: 'TEN-HIDAR-T3',
                    provider: 'Telebirr',
                    amountEtb: 5000,
                    periodCode: openPeriodCode,
                  })
                }
                className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Simulate Failed Telebirr (PR-08)', 'ያልተሳካ ቴሌብር (PR-08)')}</span>
              </button>
            </div>
          </div>

          {/* 5xxx Expense Sub-Ledger Filter & Quick Launch Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] rounded-xl px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', biText(locale, 'All Journals', 'ሁሉም ጆርናሎች')],
                  ['5xxx', biText(locale, 'All 5xxx Expenses', 'ሁሉም 5xxx ወጪዎች')],
                  ['5600', biText(locale, '5600 · Bank Charges', '5600 · የባንክ ክፍያ')],
                  ['5800', biText(locale, '5800 · Interest Expense', '5800 · የወለድ ወጪ')],
                  ['5900', biText(locale, '5900 · Depreciation', '5900 · የንብረት እርጅና')],
                ] as const
              ).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setJournalFilter(code)}
                  className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] cursor-pointer transition-colors ${
                    journalFilter === code
                      ? 'bg-[#0F233A] text-white dark:bg-[#E5B85C] dark:text-[#0F233A]'
                      : 'bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-300 border border-[#DFE5EE] dark:border-[#233349] hover:border-[#0F233A]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              <span className="text-slate-600 dark:text-slate-300">
                {journalFilter === 'all'
                  ? biText(locale, `Net 5xxx Expenses: ${fmtEtb(filtered5xxxTotalCents / 100)}`, `ጠቅላላ 5xxx ወጪ: ${fmtEtb(filtered5xxxTotalCents / 100)}`)
                  : biText(locale, `Net ${journalFilter}: ${fmtEtb(filtered5xxxTotalCents / 100)} (${filteredJournals.length})`, `የ ${journalFilter} ድምር: ${fmtEtb(filtered5xxxTotalCents / 100)} (${filteredJournals.length})`)}
              </span>
              {(journalFilter === '5600' || journalFilter === '5800' || journalFilter === '5900') && (
                <button
                  type="button"
                  onClick={() => openManualModalFor(journalFilter)}
                  className="px-2.5 py-1 rounded-lg bg-[#166549] text-white font-semibold cursor-pointer"
                >
                  + New {journalFilter} Entry
                </button>
              )}
            </div>
          </div>

          {/* Failed Gateway Events Table (PR-08: 0 Journals) */}
          {ownerFailedGatewayEvents.length > 0 && (
            <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/70 rounded-xl p-4 space-y-2">
              <p className="font-bold text-red-900 dark:text-red-200">
                {biText(locale, `PR-08 Failed Gateway Exception Log (${ownerFailedGatewayEvents.length}) — Zero Journals Created`, `PR-08 ያልተሳኩ የክፍያ ሙከራዎች (${ownerFailedGatewayEvents.length})`)}
              </p>
              <div className="space-y-1.5">
                {ownerFailedGatewayEvents.map((fg) => (
                  <div
                    key={fg.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#111C2C] border border-red-200/70 dark:border-red-800/50 rounded-lg px-3 py-2 font-mono"
                  >
                    <span>
                      <strong>{fg.eventRef}</strong> · {fg.provider} · {fg.tenantRef} ·{' '}
                      {fmtEtb(fg.attemptedAmountCents / 100)} ({fg.gatewayStatus})
                    </span>
                    <span className="text-red-700 dark:text-red-300 font-bold">
                      journalsCreatedCount = {fg.journalsCreatedCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Journals List */}
          {filteredJournals.length === 0 && (
            <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-6 text-center text-slate-500 dark:text-slate-400">
              {biText(locale, `No posted journals match filter "${journalFilter}" for ${activeOwner.name}.`, `ለ ${journalFilter} የተመዘገበ ጆርናል አልተገኘም።`)}
            </div>
          )}
          {filteredJournals.map((je) => (
            <div
              key={je.id}
              className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs"
            >
              <div className="px-5 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">
                    {je.journalNumber}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 ml-2">[{je.ruleId}]</span>
                  <span className="text-slate-700 dark:text-slate-200 ml-2">
                    · {fmtDate(je.entryDate)} ({je.ethiopianDateLabel}) · {je.description}
                  </span>
                  {je.eInvoiceMetadata && (
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {je.eInvoiceMetadata.directiveRef}: {je.eInvoiceMetadata.irnPlaceholder} ·{' '}
                      {je.eInvoiceMetadata.vatSupplyType} · {je.eInvoiceMetadata.submissionStatus}
                    </p>
                  )}
                  {je.reversedByJournalId && (
                    <p className="text-[11px] font-mono text-red-700 dark:text-red-300 mt-0.5">
                      Reversed by {je.reversedByJournalId} (retained visibly; nets to 0)
                    </p>
                  )}
                  {je.reversalOfJournalId && (
                    <p className="text-[11px] font-mono text-amber-900 dark:text-amber-300 mt-0.5">
                      PR-25 Mirror Reversal of {je.reversalOfJournalId}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusLabel label={je.status} />
                  {je.status === 'Posted' && !je.reversedByJournalId && !je.reversalOfJournalId && (
                    <button
                      type="button"
                      disabled={!canReverse.allowed}
                      onClick={() => setReverseTarget(je)}
                      className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{biText(locale, 'Reverse (PR-25)', 'ገልብጥ (PR-25)')}</span>
                    </button>
                  )}
                </div>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-white dark:bg-[#111C2C] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1D2D42]">
                  <tr>
                    <th className="py-2 px-4">{biText(locale, 'Account', 'የሂሳብ መደብ')}</th>
                    <th className="py-2 px-4">{biText(locale, 'Owner / Sub-Ledger', 'ባለቤት / ንዑስ')}</th>
                    <th className="py-2 px-4 text-right">{biText(locale, 'Debit (ETB)', 'ዴቢት (ብር)')}</th>
                    <th className="py-2 px-4 text-right">{biText(locale, 'Credit (ETB)', 'ክሬዲት (ብር)')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {je.lines.map((line) => (
                    <tr key={line.id} className="text-slate-800 dark:text-slate-200">
                      <td className="py-2 px-4">
                        <span className="font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                          {line.accountCode}
                        </span>{' '}
                        — {line.accountName}
                      </td>
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {je.ownerId}
                        {line.tenantId ? ` · ${line.tenantId}` : ''}
                        {line.unitId ? ` · ${line.unitId}` : ''}
                      </td>
                      <td className="py-2 px-4 font-mono text-right tabular-nums">
                        {line.debitCents ? fmtEtb(line.debitCents / 100) : '—'}
                      </td>
                      <td className="py-2 px-4 font-mono text-right tabular-nums">
                        {line.creditCents ? fmtEtb(line.creditCents / 100) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {tab === 'receivables' && <ReceivablesDepositsTab />}
      {tab === 'clearing' && <ClearingReconTab />}
      {tab === 'payables' && <PayablesAssetsTab />}
      {tab === 'close' && <PeriodCloseTab />}
      {tab === 'reports' && <OwnerReportsTab />}
      {tab === 'lab' && <HidarLabTab />}

      {/* Account Version History Drawer (v1) */}
      <SlideDrawer
        open={Boolean(selectedAccount)}
        onClose={() => setSelectedAccount(null)}
        title={selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name}` : ''}
        subtitle={biText(
          locale,
          'Draft accounting design version history (no edit/delete)',
          'የረቂቅ የሂሳብ ንድፍ እትም ታሪክ (መሰረዝ ወይም መቀየር አይቻልም)'
        )}
      >
        {selectedAccount && (
          <div className="space-y-4 text-xs">
            <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                  {biText(locale, 'Version', 'እትም')} v{selectedAccount.version}
                </span>
                <StatusLabel label={selectedAccount.status} />
              </div>
              <p className="text-amber-900 dark:text-amber-300 font-semibold">
                {selectedAccount.designTag}
              </p>
              <p className="text-slate-600 dark:text-slate-300">{selectedAccount.description}</p>
            </div>
            <div className="space-y-2.5">
              {selectedAccount.versions.map((ver) => (
                <div
                  key={ver.version}
                  className="border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#152236] rounded-lg p-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold">v{ver.version} · {ver.name}</span>
                    <StatusLabel label={ver.status} />
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{ver.note}</p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Effective {fmtDate(ver.effectiveDate)} · {ver.evidenceRef} · {ver.changedBy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* 27 Posting Rules Catalog Drawer */}
      <SlideDrawer
        open={rulesDrawerOpen}
        onClose={() => setRulesDrawerOpen(false)}
        title={biText(locale, 'Posting Rules Catalog (PR-01 to PR-27)', 'የምዝገባ ደንቦች ዝርዝር (PR-01 እስከ PR-27)')}
        subtitle={biText(
          locale,
          'Deterministic double-entry mappings (Steps 1–7; payroll excluded).',
          'የተረጋገጡ የድርብ-መዝገብ የሂሳብ ሕጎች።'
        )}
      >
        <div className="space-y-2.5 text-xs">
          {POSTING_RULES_CATALOG.map((r) => (
            <div
              key={r.ruleId}
              className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236] space-y-1"
            >
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">
                  {r.ruleId} (v{r.version})
                </span>
                <span className="text-[11px] text-slate-500">{r.approvalControl}</span>
              </div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{r.title}</p>
              <p className="text-slate-600 dark:text-slate-300">{r.eventSummary}</p>
              <p className="font-mono text-[11px]">
                Dr: {r.debitAccounts.join(', ') || '—'} | Cr: {r.creditAccounts.join(', ') || '—'}
              </p>
            </div>
          ))}
        </div>
      </SlideDrawer>

      {/* Propose Account Change Modal (v1) */}
      <Modal
        open={Boolean(proposeTarget)}
        onClose={() => setProposeTarget(null)}
        title={biText(locale, 'Propose Draft Account Design Change', 'በረቂቅ የሂሳብ ንድፍ ላይ ለውጥ አቅርብ')}
        subtitle={biText(
          locale,
          'Creates a maker-checker approval request. Direct destructive edits are prohibited.',
          'የአዘጋጅ-አጽዳቂ የማጽደቂያ ጥያቄ ይፈጥራል። ቀጥተኛ ማስተካከያ ወይም መሰረዝ የተከለከለ ነው።'
        )}
      >
        {proposeTarget && (
          <form onSubmit={handleProposeSubmit} className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349]">
              Account: <span className="font-mono font-semibold">{proposeTarget.code}</span> · v{proposeTarget.version}
            </div>
            <div>
              <label className="font-semibold block mb-1">Proposed Account Name (v{proposeTarget.version + 1}) *</label>
              <input
                required
                value={proposalForm.proposedName}
                onChange={(e) => setProposalForm({ ...proposalForm, proposedName: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={proposalForm.effectiveDate}
                  onChange={(e) => setProposalForm({ ...proposalForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Evidence Reference *</label>
                <input
                  required
                  value={proposalForm.evidenceRef}
                  onChange={(e) => setProposalForm({ ...proposalForm, evidenceRef: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold block mb-1">Change Reason *</label>
              <textarea
                required
                rows={2}
                value={proposalForm.reason}
                onChange={(e) => setProposalForm({ ...proposalForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setProposeTarget(null)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
                {labels.cancel}
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#166549] text-white font-semibold cursor-pointer">
                {biText(locale, 'Submit Proposal to Approvals Centre', 'ሃሳቡን ወደ ማጽደቂያ ማዕከል ላክ')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Multi-Line Double-Entry Manual Journal Modal (5xxx Bank Charges / Interest / Depreciation & General) */}
      <Modal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        maxWidth="max-w-3xl"
        title={biText(locale, 'Manual Double-Entry Journal Workbench (5xxx & General)', 'በእጅ የሚገባ ድርብ-መዝገብ ጆርናል (5xxx)')}
        subtitle={biText(
          locale,
          'Balanced multi-line journal mapped to canonical 5xxx expense & general accounts. Queued for Maker-Checker SoD approval before posting.',
          'ከ5xxx ወጪዎች ጋር የተሳሰረ የተመጣጠነ ድርብ-መዝገብ ጆርናል። ከመመዝገቡ በፊት በአጽዳቂ ይረጋገጣል።'
        )}
      >
        <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
          {!canPostManual.allowed && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200">
              <strong>Maker-Checker RBAC:</strong> {canPostManual.reason} Switch to{' '}
              <span className="font-mono font-semibold">Finance Officer</span> to prepare manual journals, then approve as{' '}
              <span className="font-mono font-semibold">General Manager</span> / <span className="font-mono font-semibold">Owner</span>.
            </div>
          )}

          {/* 5xxx One-Click Mapping Templates */}
          <div className="space-y-1.5">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {biText(locale, '5xxx Quick Mapping Presets (Proposal Appendix A)', 'የ 5xxx ፈጣን አብነቶች')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyManualPreset('5600')}
                className="px-3 py-2 text-left rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236] hover:border-[#166549] cursor-pointer"
              >
                <div className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">5600 · Bank Charges</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Dr 5600 / Cr 1020 Operating Bank</div>
              </button>
              <button
                type="button"
                onClick={() => applyManualPreset('5800')}
                className="px-3 py-2 text-left rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236] hover:border-[#166549] cursor-pointer"
              >
                <div className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">5800 · Interest Expense</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Dr 5800 / Cr 1020 Operating Bank</div>
              </button>
              <button
                type="button"
                onClick={() => applyManualPreset('5900')}
                className="px-3 py-2 text-left rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236] hover:border-[#166549] cursor-pointer"
              >
                <div className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">5900 · Depreciation</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Dr 5900 / Cr 1220 &amp; 1240 Accum. Dep.</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="manual-journal-period" className="font-semibold block mb-1">Fiscal Period (13-Month)</label>
              <select
                id="manual-journal-period"
                value={manualForm.periodCode}
                onChange={(e) => setManualForm({ ...manualForm, periodCode: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              >
                {ownerAccountingPeriods.map((p) => (
                  <option key={p.id} value={p.periodCode}>
                    {p.periodCode} · {p.monthNameEn} ({p.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="manual-journal-date" className="font-semibold block mb-1">Entry Date</label>
              <input
                id="manual-journal-date"
                type="date"
                required
                value={manualForm.entryDate}
                onChange={(e) => setManualForm({ ...manualForm, entryDate: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="manual-journal-evidence" className="font-semibold block mb-1">Evidence Ref</label>
              <input
                id="manual-journal-evidence"
                required
                value={manualForm.evidenceRef}
                onChange={(e) => setManualForm({ ...manualForm, evidenceRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
          </div>

          {selectedManualPeriod && (selectedManualPeriod.status === 'Closed' || selectedManualPeriod.status === 'Closing') && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 text-red-900 dark:text-red-200 font-semibold">
              Period {selectedManualPeriod.periodCode} ({selectedManualPeriod.monthNameEn}) is {selectedManualPeriod.status}. Select an Open or Reopened period to post.
            </div>
          )}

          <div>
            <label htmlFor="manual-journal-description" className="font-semibold block mb-1">Journal Narration / Description</label>
            <input
              id="manual-journal-description"
              required
              value={manualForm.description}
              onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
            />
          </div>

          {/* Multi-line Journal Grid */}
          <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#152236] border-b border-[#DFE5EE] dark:border-[#233349] flex items-center justify-between">
              <span className="font-semibold text-[#0F233A] dark:text-slate-100">
                Journal Lines ({manualForm.lines.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setManualForm((prev) => ({
                    ...prev,
                    lines: [
                      ...prev.lines,
                      {
                        id: `ln-${Date.now()}-${prev.lines.length + 1}`,
                        accountCode: '1020',
                        debitEtb: 0,
                        creditEtb: 0,
                        description: '',
                      },
                    ],
                  }))
                }
                className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Line</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white dark:bg-[#111C2C] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1D2D42]">
                  <tr>
                    <th className="py-2 px-3">Account (5xxx / CoA v2)</th>
                    <th className="py-2 px-3">Line Memo</th>
                    <th className="py-2 px-3 text-right w-32">Debit (ETB)</th>
                    <th className="py-2 px-3 text-right w-32">Credit (ETB)</th>
                    <th className="py-2 px-2 w-10" aria-label="Remove line" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {manualForm.lines.map((line, idx) => (
                    <tr key={line.id}>
                      <td className="py-2 px-3">
                        <select
                          aria-label={`Line ${idx + 1} Account`}
                          value={line.accountCode}
                          onChange={(e) => {
                            const code = e.target.value;
                            setManualForm((prev) => ({
                              ...prev,
                              lines: prev.lines.map((l) => (l.id === line.id ? { ...l, accountCode: code } : l)),
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono text-[11px]"
                        >
                          <optgroup label="Expenses — 5xxx (Bank Charges, Interest, Depreciation)">
                            {groupedManualAccounts.fiveXxx.map((a) => (
                              <option key={a.code} value={a.code} disabled={a.isTaxLocked}>
                                {a.code} — {a.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Assets, Liabilities, Equity &amp; Revenue">
                            {groupedManualAccounts.others.map((a) => (
                              <option key={a.code} value={a.code} disabled={a.isTaxLocked}>
                                {a.code} — {a.name}{a.isTaxLocked ? ' [Tax-Locked]' : ''}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          aria-label={`Line ${idx + 1} Memo`}
                          value={line.description}
                          placeholder="Line detail"
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualForm((prev) => ({
                              ...prev,
                              lines: prev.lines.map((l) => (l.id === line.id ? { ...l, description: val } : l)),
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label={`Line ${idx + 1} Debit`}
                          value={line.debitEtb}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setManualForm((prev) => ({
                              ...prev,
                              lines: prev.lines.map((l) =>
                                l.id === line.id
                                  ? { ...l, debitEtb: val, creditEtb: val > 0 ? 0 : l.creditEtb }
                                  : l
                              ),
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label={`Line ${idx + 1} Credit`}
                          value={line.creditEtb}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setManualForm((prev) => ({
                              ...prev,
                              lines: prev.lines.map((l) =>
                                l.id === line.id
                                  ? { ...l, creditEtb: val, debitEtb: val > 0 ? 0 : l.debitEtb }
                                  : l
                              ),
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          disabled={manualForm.lines.length <= 2}
                          onClick={() =>
                            setManualForm((prev) => ({
                              ...prev,
                              lines: prev.lines.filter((l) => l.id !== line.id),
                            }))
                          }
                          aria-label={`Remove line ${idx + 1}`}
                          className="p-1 rounded text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg font-mono flex flex-wrap items-center justify-between gap-2 ${
              manualTotals.balanced
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
            }`}
          >
            <span>
              Dr {fmtEtb(manualTotals.debitCents / 100)} · Cr {fmtEtb(manualTotals.creditCents / 100)}
            </span>
            <span className="font-bold">
              {manualTotals.balanced
                ? `Balanced (Dr == Cr)${manualTotals.debitCents > 2500000 ? ' · Two-Step Escalation (> ETB 25,000)' : ' · One-Step Checker'}`
                : `Out of balance by ${fmtEtb(Math.abs(manualTotals.diffCents) / 100)}`}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setManualModalOpen(false)}
              className="px-3.5 py-2 rounded-lg border cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !canPostManual.allowed ||
                !manualTotals.balanced ||
                Boolean(
                  selectedManualPeriod &&
                    (selectedManualPeriod.status === 'Closed' || selectedManualPeriod.status === 'Closing')
                )
              }
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] disabled:opacity-45 text-white font-semibold cursor-pointer"
            >
              Submit Manual Journal
            </button>
          </div>
        </form>
      </Modal>

      {/* Post Rent Charge Modal */}
      <Modal
        open={chargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
        title={biText(locale, 'Post Rent Charge Event (PR-01 / PR-02 / PR-03)', 'የኪራይ ክፍያ መዝግብ')}
      >
        <form onSubmit={handleChargeSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Tenant</label>
            <select
              value={chargeForm.tenantId}
              onChange={(e) => {
                const sub = ownerLedgerTenants.find((t) => t.id === e.target.value);
                setChargeForm({
                  ...chargeForm,
                  tenantId: e.target.value,
                  amountEtb: sub ? sub.monthlyRentCents / 100 : chargeForm.amountEtb,
                  propertyUse: sub ? sub.propertyUse : chargeForm.propertyUse,
                });
              }}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
            >
              {ownerLedgerTenants.map((t) => (
                <option key={t.id} value={t.id}>{t.tenantCode} — {t.tenantName} ({t.propertyUse})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Rent Amount (ETB)</label>
              <input
                type="number"
                min={1}
                required
                value={chargeForm.amountEtb}
                onChange={(e) => setChargeForm({ ...chargeForm, amountEtb: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Property Use</label>
              <select
                value={chargeForm.propertyUse}
                onChange={(e) =>
                  setChargeForm({ ...chargeForm, propertyUse: e.target.value as 'Residential' | 'Commercial' })
                }
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
              >
                <option value="Residential">Residential (4100, VAT Exempt)</option>
                <option value="Commercial">Commercial (4110)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setChargeModalOpen(false)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0F233A] text-white font-semibold cursor-pointer">
              Post Charge Journal
            </button>
          </div>
        </form>
      </Modal>

      {/* PR-25 Mirror Reversal Modal */}
      <Modal
        open={Boolean(reverseTarget)}
        onClose={() => setReverseTarget(null)}
        title={biText(locale, `PR-25 Mirror Reversal — ${reverseTarget?.journalNumber}`, `የ PR-25 መገልበጫ — ${reverseTarget?.journalNumber}`)}
        subtitle={biText(
          locale,
          'Creates a mirror opposite entry linked cleanly via reversalOfJournalId. Original journal stays visible.',
          'ተቃራኒ መገልበጫ ግቤት ይፈጥራል፤ የመጀመሪያው ጆርናል ሳይፋቅ ይቆያል።'
        )}
      >
        {reverseTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = reverseLedgerJournal({
                journalId: reverseTarget.id,
                entryDate: reverseTarget.entryDate,
                reason: reverseReason,
              });
              if (res.ok) setReverseTarget(null);
            }}
            className="space-y-3 text-xs"
          >
            <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] font-mono">
              {reverseTarget.journalNumber}: {reverseTarget.description}
            </div>
            <div>
              <label className="font-semibold block mb-1">Reversal Reason *</label>
              <textarea
                required
                rows={2}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setReverseTarget(null)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold cursor-pointer">
                Post Mirror Reversal
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
    </RequireAuth>
  );
};
