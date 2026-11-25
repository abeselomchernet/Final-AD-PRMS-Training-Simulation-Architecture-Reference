import React, { useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  Download,
  FlaskConical,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Unlock,
  Wallet,
} from 'lucide-react';
import { usePrms } from '../../context/PrmsContext';
import { biText } from '../../data/i18n';
import { buildCopyableHidarVatVariant, HidarVerificationCheckResult, runHidarVerificationSuite } from '../../data/hidarWorkedMonth';
import { runPrototypeMigrationReplay } from '../../services/accountingEngine';
import { checkActionPermission } from '../../policies/rbac';
import { Modal, StatusLabel } from '../ui/Primitives';

// Tab 3: Receivables, Advance Rent & Security Deposits
export const ReceivablesDepositsTab: React.FC = () => {
  const {
    locale,
    fmtEtb,
    currentPersona,
    ownerLedgerTenants,
    ownerTenantAgeing,
    ownerDeposits,
    ownerThreeWayDeposit,
    requestDepositSettlement,
    postRentChargeEvent,
    ownerAccountingPeriods,
  } = usePrms();

  const [settleTargetId, setSettleTargetId] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState({
    mode: 'Refund' as 'Refund' | 'Deduction',
    amountEtb: 10000,
    evidenceRef: 'EVD-MOVEOUT-001',
    reason: 'End-of-lease move-out settlement after joint inspection.',
    moveOutChecklistDone: true,
  });

  const canRefund = checkActionPermission(currentPersona.role, 'settle_deposit_refund');
  const openPeriodCode =
    ownerAccountingPeriods.find((p) => p.periodCode === '2019-03')?.periodCode ||
    ownerAccountingPeriods.find((p) => p.status === 'Open')?.periodCode ||
    '2019-03';

  const settleTarget = ownerDeposits.find((d) => d.id === settleTargetId) || null;

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    const res = requestDepositSettlement({
      depositId: settleTarget.id,
      mode: settleForm.mode,
      amountEtb: Number(settleForm.amountEtb),
      evidenceRef: settleForm.evidenceRef.trim(),
      reason: settleForm.reason.trim(),
      moveOutChecklistDone: settleForm.moveOutChecklistDone,
    });
    if (res.ok) setSettleTargetId(null);
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Three-Way Deposit Check Card */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
              <span>
                {biText(
                  locale,
                  'Security Deposit Three-Way Custody Check (1030 == 2120 == Lease Sub-Ledger)',
                  'የተከራይ ዋስትና ሦስትዮሽ ማስታረቅ (1030 == 2120 == ውሎች)'
                )}
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              {biText(
                locale,
                'Tenant security deposits remain liabilities in segregated custody and never enter Rental Income until forfeited for verified move-out damage.',
                'የተከራይ ዋስትና ገንዘብ የባለቤት ገቢ ሳይሆን የተለየ የእዳ ሂሳብ (Liability) ሆኖ ይቀመጣል።'
              )}
            </p>
          </div>
          <StatusLabel
            label={ownerThreeWayDeposit.balanced ? 'Balanced' : 'Exception'}
            tone={ownerThreeWayDeposit.balanced ? 'green' : 'red'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3.5">
            <p className="text-slate-500 dark:text-slate-400">
              {biText(locale, '1030 Deposit Bank Account', '1030 የዋስትና ባንክ ሂሳብ')}
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#0F233A] dark:text-[#E5B85C] mt-1">
              {fmtEtb(ownerThreeWayDeposit.bank1030Cents / 100)}
            </p>
          </div>
          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3.5">
            <p className="text-slate-500 dark:text-slate-400">
              {biText(locale, '2120 Security Deposits Liability', '2120 የተከራይ ዋስትና እዳ')}
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#0F233A] dark:text-[#E5B85C] mt-1">
              {fmtEtb(ownerThreeWayDeposit.liability2120Cents / 100)}
            </p>
          </div>
          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3.5">
            <p className="text-slate-500 dark:text-slate-400">
              {biText(locale, 'Active Lease Sub-Ledger Total', 'የውል ዝርዝር ድምር')}
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#166549] dark:text-emerald-400 mt-1">
              {fmtEtb(ownerThreeWayDeposit.subledgerSumCents / 100)}
            </p>
          </div>
        </div>

        {/* Deposit Custody Sub-Ledger Table */}
        <div className="overflow-x-auto border border-[#DFE5EE] dark:border-[#233349] rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Tenant / Unit', 'ተከራይ / ክፍል')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Custody Pair', 'የሂሳብ ጥንድ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Held Deposit', 'የተያዘ ዋስትና')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Move-Out Action', 'የመውጫ እርምጃ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerDeposits.map((dep) => (
                <tr key={dep.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{dep.tenantName}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {dep.unitCode} · {dep.leaseId}
                    </p>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                    {dep.bankAccountCode} / {dep.liabilityAccountCode}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-[#0F233A] dark:text-[#E5B85C]">
                    {fmtEtb(dep.heldCents / 100)}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusLabel label={dep.status} />
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {dep.status === 'Held' && (
                      <button
                        type="button"
                        disabled={!canRefund.allowed}
                        title={canRefund.reason}
                        onClick={() => {
                          setSettleTargetId(dep.id);
                          setSettleForm({
                            mode: 'Refund',
                            amountEtb: dep.heldCents / 100,
                            evidenceRef: `EVD-MOVEOUT-${dep.unitCode}`,
                            reason: `Move-out settlement for ${dep.unitCode}.`,
                            moveOutChecklistDone: true,
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] font-semibold text-[#0F233A] dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                      >
                        {biText(locale, 'Refund / Deduct', 'መልስ / ቀንስ')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tenant Ageing, Advance Rent & Straight-Line Accrual Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                'Tenant Receivable Ageing (1110), Advance Rent (2110) & Straight-Line Accrued Rent (1130)',
                'የተከራይ ተሰብሳቢ ዕድሜ (1110)፣ ቅድሚያ ኪራይ (2110) እና Straight-Line (1130)'
              )}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              {biText(
                locale,
                'Receivable ageing sub-ledger agrees to control account 1110. Residential advance rent > 2 months flags Proclamation 1320/2024 warning.',
                'ተሰብሳቢ ዝርዝሩ ከ 1110 ጋር ይስማማል። ከ2 ወር በላይ የመኖሪያ ቅድሚያ ክፍያ የአዋጅ 1320/2024 ማስጠንቀቂያ ያሳያል።'
              )}
            </p>
          </div>
          <span className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">
            1110 = {fmtEtb(ownerTenantAgeing.totalReceivableCents / 100)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Tenant', 'ተከራይ')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Use / Term', 'ዓይነት')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">1–30d</th>
                <th className="py-2.5 px-3 font-semibold text-right">31–60d</th>
                <th className="py-2.5 px-3 font-semibold text-right">61–90d / 90+</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Total 1110', 'ድምር 1110')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Advance (2110)', 'ቅድሚያ (2110)')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Accrued (1130)', 'የተጠራቀመ (1130)')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Control / Action', 'ቁጥጥር')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerTenantAgeing.rows.map((row) => {
                const sub = ownerLedgerTenants.find((t) => t.id === row.tenantId);
                const over2MonthsRes =
                  sub?.propertyUse === 'Residential' && (sub.advanceMonthsHeld || 0) > 2;
                return (
                  <tr key={row.tenantId} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.tenantCode} · {row.tenantName}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {row.unitCode}
                      </p>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-slate-700 dark:text-slate-300">{sub?.propertyUse || 'Commercial'}</span>
                      {sub && sub.freeMonthsCount > 0 && (
                        <p className="text-[11px] text-[#166549] dark:text-emerald-400 font-mono">
                          SL: {sub.leaseTermMonths}m / {sub.freeMonthsCount} free
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {fmtEtb(row.days1to30Cents / 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {fmtEtb(row.days31to60Cents / 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {fmtEtb((row.days61to90Cents + row.days90PlusCents) / 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#0F233A] dark:text-[#E5B85C]">
                      {fmtEtb(row.totalReceivableCents / 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {fmtEtb(row.advanceRentCents / 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {fmtEtb(row.accruedRentCents / 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {over2MonthsRes && (
                        <span className="text-[11px] font-semibold text-red-700 dark:text-red-300 mr-2">
                          1320/2024 &gt;2m
                        </span>
                      )}
                      {sub && (
                        <button
                          type="button"
                          onClick={() =>
                            postRentChargeEvent({
                              tenantId: sub.id,
                              amountEtb: sub.monthlyRentCents / 100,
                              entryDate: '2026-12-08',
                              periodCode: openPeriodCode,
                              propertyUse: sub.propertyUse,
                              description: `Extra monthly rent accrual simulation (${sub.tenantCode})`,
                            })
                          }
                          className="text-[#166549] dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                        >
                          {biText(locale, '+ Bill Month', '+ ክፍያ ጻፍ')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#F8FAFC] dark:bg-[#152236] font-bold text-[#0F233A] dark:text-slate-100">
                <td colSpan={2} className="py-2.5 px-3">
                  {biText(locale, 'Control Totals', 'የቁጥጥር ድምሮች')}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {fmtEtb(ownerTenantAgeing.total1to30Cents / 100)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {fmtEtb(ownerTenantAgeing.total31to60Cents / 100)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {fmtEtb((ownerTenantAgeing.total61to90Cents + ownerTenantAgeing.total90PlusCents) / 100)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {fmtEtb(ownerTenantAgeing.totalReceivableCents / 100)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {fmtEtb(ownerTenantAgeing.totalAdvanceRentCents / 100)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {fmtEtb(ownerTenantAgeing.totalAccruedRentCents / 100)}
                </td>
                <td className="py-2.5 px-3" />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(settleTarget)}
        onClose={() => setSettleTargetId(null)}
        title={biText(locale, 'Deposit Refund / Damage Deduction (PR-14 / PR-15)', 'የዋስትና መመለሻ / የጉዳት ተቀናሽ (PR-14 / PR-15)')}
        subtitle={biText(
          locale,
          'Requires Maker-Checker approval and move-out inspection checklist before posting to 2120 / 1030 or 4200.',
          'ወደ መዝገብ ከመግባቱ በፊት የአዘጋጅ-አጽዳቂ ፈቃድ እና የመውጫ ማረጋገጫ ይፈልጋል።'
        )}
      >
        {settleTarget && (
          <form onSubmit={handleSettleSubmit} className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349]">
              <p className="font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                {settleTarget.tenantName} ({settleTarget.unitCode})
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                Held Deposit: {fmtEtb(settleTarget.heldCents / 100)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">{biText(locale, 'Settlement Type', 'የእርምጃ ዓይነት')}</label>
                <select
                  value={settleForm.mode}
                  onChange={(e) => setSettleForm({ ...settleForm, mode: e.target.value as 'Refund' | 'Deduction' })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
                >
                  <option value="Refund">Refund Deposit (PR-14: Dr 2120 / Cr 1030)</option>
                  <option value="Deduction">Damage Forfeiture (PR-15: Dr 2120 / Cr 4200)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">{biText(locale, 'Amount (ETB)', 'መጠን (ብር)')}</label>
                <input
                  type="number"
                  min={1}
                  max={settleTarget.heldCents / 100}
                  required
                  value={settleForm.amountEtb}
                  onChange={(e) => setSettleForm({ ...settleForm, amountEtb: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={settleForm.moveOutChecklistDone}
                onChange={(e) => setSettleForm({ ...settleForm, moveOutChecklistDone: e.target.checked })}
                className="accent-[#166549]"
              />
              <span>
                {biText(
                  locale,
                  'Move-out physical handover & damage inspection checklist signed off',
                  'የመውጫ ርክክብ እና የጉዳት ፍተሻ ማረጋገጫ ተፈርሟል'
                )}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">{biText(locale, 'Evidence Ref *', 'የማስረጃ ቁጥር *')}</label>
                <input
                  required
                  value={settleForm.evidenceRef}
                  onChange={(e) => setSettleForm({ ...settleForm, evidenceRef: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">{biText(locale, 'Reason *', 'ምክንያት *')}</label>
                <input
                  required
                  value={settleForm.reason}
                  onChange={(e) => setSettleForm({ ...settleForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettleTargetId(null)}
                className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] cursor-pointer"
              >
                {biText(locale, 'Cancel', 'ሰርዝ')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer"
              >
                {biText(locale, 'Submit to Approvals Centre', 'ወደ ማጽደቂያ ላክ')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

// Tab 4: Clearing & Bank Reconciliation
export const ClearingReconTab: React.FC = () => {
  const {
    locale,
    fmtEtb,
    fmtDate,
    ownerGatewayBatches,
    ownerClearingStatus,
    ownerBankStatementLines,
    ownerReconRuns,
    ownerLedgerJournals,
    settleGatewayBatch,
    matchBankStatementLine,
    signOffBankRecon,
  } = usePrms();

  const [feeInputs, setFeeInputs] = useState<Record<string, number>>({});

  return (
    <div className="space-y-5 text-xs">
      {/* Clearing 1040 Status Banner */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs">
          <p className="text-slate-500 dark:text-slate-400">
            {biText(locale, '1040 Mobile-Money Clearing Balance', '1040 የሞባይል ገንዘብ መሸጋገሪያ ሚዛን')}
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#166549] dark:text-emerald-400 mt-1">
            {fmtEtb(ownerClearingStatus.clearing1040Cents / 100)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {ownerClearingStatus.zeroed
              ? biText(locale, 'Zeroed — all gateway batches cleared', 'ዜሮ ሆኗል — ሁሉም ክፍያዎች ተወራርደዋል')
              : biText(locale, 'Pending batches waiting bank payout', 'ባንክ ገቢ እየተጠበቀ ነው')}
          </p>
        </div>
        {ownerReconRuns.map((run) => (
          <div
            key={run.id}
            className="md:col-span-2 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">
                  {run.periodCode} · Bank {run.bankAccountCode}
                </span>
                <StatusLabel label={run.status} />
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-mono">
                Statement: {fmtEtb(run.statementClosingCents / 100)} == Ledger: {fmtEtb(run.ledgerClosingCents / 100)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Maker: {run.makerName} · Checker: {run.checkerName || 'Pending Sign-Off'}
              </p>
            </div>
            {run.status !== 'Signed Off' && (
              <button
                type="button"
                onClick={() => signOffBankRecon(run.id)}
                className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer whitespace-nowrap"
              >
                {biText(locale, 'Sign Off Bank Recon (Checker)', 'የባንክ ማስታረቅ አጽድቅ')}
              </button>
            )}
          </div>
        ))}
      </section>

      {/* Gateway Settlement Batches (PR-09) */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
          <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Telebirr / ArifPay Settlement Batches (PR-09)', 'የቴሌብር / አሪፍፔይ ማወራረጃ ጥቅሎች (PR-09)')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Batch', 'ጥቅል')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Provider & Receipts', 'አቅራቢና ደረሰኞች')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Gross (1040)', 'ጠቅላላ (1040)')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Fee (5600)', 'ክፍያ (5600)')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Net Bank (1020)', 'የተጣራ (1020)')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Action', 'እርምጃ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerGatewayBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                  <td className="py-2.5 px-3 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                    {batch.batchNumber}
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{batch.provider}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {batch.receiptRefs.join(', ')}
                    </p>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {fmtEtb(batch.grossCents / 100)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {batch.status === 'Pending Settlement' ? (
                      <input
                        type="number"
                        min={0}
                        value={feeInputs[batch.id] ?? batch.feeCents / 100}
                        onChange={(e) =>
                          setFeeInputs({ ...feeInputs, [batch.id]: Number(e.target.value) })
                        }
                        className="w-20 px-2 py-1 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded text-right font-mono"
                      />
                    ) : (
                      fmtEtb(batch.feeCents / 100)
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                    {fmtEtb(batch.netSettledCents / 100)}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusLabel label={batch.status} />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {batch.status === 'Pending Settlement' ? (
                      <button
                        type="button"
                        onClick={() =>
                          settleGatewayBatch({
                            batchId: batch.id,
                            feeEtb: feeInputs[batch.id] ?? batch.feeCents / 100,
                            settlementDate: batch.settlementDate,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer"
                      >
                        {biText(locale, 'Settle Batch', 'ጥቅል አወራርድ')}
                      </button>
                    ) : (
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {batch.settlementJournalId}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Operating Bank Statement Lines */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
          <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Bank Statement Line Matching (1020 Operating)', 'የባንክ መግለጫ መስመር ማዛመጃ (1020)')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Date / Ref', 'ቀን / ማጣቀሻ')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Statement Description', 'መግለጫ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Inflow / Outflow', 'ገቢ / ወጪ')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Matched Journal', 'የተዛመደ ጆርናል')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerBankStatementLines.map((line) => (
                <tr key={line.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                  <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                    <p>{fmtDate(line.txDate)}</p>
                    <p className="text-[11px] text-slate-500">{line.reference}</p>
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">{line.description}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-semibold tabular-nums ${
                      line.direction === 'Inflow'
                        ? 'text-[#166549] dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {line.direction === 'Inflow' ? '+' : '-'}
                    {fmtEtb(line.amountCents / 100)}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    {line.matchedJournalId ? (
                      line.matchedJournalId
                    ) : (
                      <select
                        defaultValue=""
                        onChange={(e) => e.target.value && matchBankStatementLine(line.id, e.target.value)}
                        className="px-2 py-1 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded text-xs"
                      >
                        <option value="">Match journal...</option>
                        {ownerLedgerJournals.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.journalNumber} — {j.description.slice(0, 28)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusLabel label={line.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

// Tab 5: Payables (with 3% WHT), Fixed Assets (PR-22) & Owner Draw (PR-24)
export const PayablesAssetsTab: React.FC = () => {
  const {
    locale,
    fmtEtb,
    fmtDate,
    currentPersona,
    ownerVendorBills,
    ownerFixedAssets,
    ownerAccountingPeriods,
    createVendorBill,
    payVendorBill,
    registerFixedAsset,
    runPeriodDepreciation,
    requestOwnerDraw,
  } = usePrms();

  const [billModalOpen, setBillModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [drawModalOpen, setDrawModalOpen] = useState(false);

  const openPeriodCode =
    ownerAccountingPeriods.find((p) => p.periodCode === '2019-03')?.periodCode ||
    ownerAccountingPeriods.find((p) => p.status === 'Open')?.periodCode ||
    '2019-03';

  const [billForm, setBillForm] = useState({
    vendorName: 'SYNTH Commercial Maintenance PLC',
    vendorTinPlaceholder: 'TIN-SYNTH-9988',
    category: 'Services' as 'Goods' | 'Services' | 'Capital',
    expenseAccountCode: '5100',
    amountEtb: 15000,
    billDate: '2026-12-03',
    dueDate: '2026-12-10',
    periodCode: openPeriodCode,
    evidenceRef: 'INV-VND-2019-09',
    description: 'Roof waterproofing & electrical inspection',
  });

  const [assetForm, setAssetForm] = useState({
    name: 'Commercial Standby Generator',
    assetClass: 'Equipment' as 'Building' | 'Equipment',
    costEtb: 240000,
    usefulLifeMonths: 60,
    inServiceDate: '2026-11-15',
  });

  const [drawForm, setDrawForm] = useState({
    amountEtb: 25000,
    drawDate: '2026-12-07',
    periodCode: openPeriodCode,
    evidenceRef: 'EVD-DRAW-2019-03',
    reason: 'Monthly owner distribution request (requires Owner Approval).',
  });

  const canPay = checkActionPermission(currentPersona.role, 'record_vendor_bill');
  const whtPreviewApplies =
    (billForm.category === 'Goods' && billForm.amountEtb > 20000) ||
    (billForm.category === 'Services' && billForm.amountEtb > 10000);
  const whtPreviewEtb = whtPreviewApplies ? Math.round(billForm.amountEtb * 0.03 * 100) / 100 : 0;

  return (
    <div className="space-y-5 text-xs">
      {/* Action Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Vendor Bills (3% WHT), Fixed Assets (PR-22) & Owner Draws (PR-24)', 'የአቅራቢ ክፍያዎች (3% WHT)፣ ቋሚ ንብረቶች እና የባለቤት ወጪ')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            {biText(
              locale,
              'Auto-computes 3% WHT (2220) on Goods > ETB 20,000 or Services > ETB 10,000; enforces ETB 50,000 single-payment cash cap.',
              'ለዕቃዎች > ETB 20,000 ወይም ለአገልግሎቶች > ETB 10,000 3% WHT ያሰላል፤ ከ ETB 50,000 በላይ የጥሬ ገንዘብ ክፍያን ይከለክላል።'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBillModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] text-white font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{biText(locale, 'New Vendor Bill', 'አዲስ የአቅራቢ ደረሰኝ')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAssetModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-[#0F233A] dark:text-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Register Fixed Asset', 'ቋሚ ንብረት መዝግብ')}</span>
          </button>
          <button
            type="button"
            onClick={() => runPeriodDepreciation(openPeriodCode)}
            className="px-3 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Run Depreciation (PR-22)', 'የእርጅና ቅናሽ አስላ (PR-22)')}</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Request Owner Draw (PR-24)', 'የባለቤት ወጪ ጠይቅ')}</span>
          </button>
        </div>
      </div>

      {/* Vendor Bills Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
          <h3 className="font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Accounts Payable & 3% Withholding Register (2130 / 2220)', 'የአቅራቢ ሂሳብ እና 3% ተቀናሽ መዝገብ')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Bill # / Vendor', 'ቁጥር / አቅራቢ')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Category / Acct', 'ምድብ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Gross', 'ጠቅላላ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, '3% WHT (2220)', '3% ተቀናሽ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Net Payable', 'የተጣራ ክፍያ')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Action', 'እርምጃ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerVendorBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                  <td className="py-2.5 px-3">
                    <p className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">{bill.billNumber}</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{bill.vendorName}</p>
                    <p className="text-[11px] text-slate-500">{bill.description}</p>
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    {bill.category} · {bill.expenseAccountCode}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {fmtEtb(bill.grossCents / 100)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-900 dark:text-amber-300">
                    {fmtEtb(bill.whtCents / 100)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                    {fmtEtb(bill.netPayableCents / 100)}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusLabel label={bill.status} />
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                    {bill.status === 'Approved' && (
                      <>
                        <button
                          type="button"
                          disabled={!canPay.allowed}
                          onClick={() =>
                            payVendorBill({
                              billId: bill.id,
                              paymentDate: '2026-12-08',
                              method: 'Bank Transfer',
                            })
                          }
                          className="px-2.5 py-1 rounded bg-[#166549] hover:bg-[#12533B] text-white font-semibold disabled:opacity-40 cursor-pointer"
                        >
                          {biText(locale, 'Pay Bank', 'በባንክ ክፈል')}
                        </button>
                        <button
                          type="button"
                          disabled={!canPay.allowed}
                          onClick={() =>
                            payVendorBill({
                              billId: bill.id,
                              paymentDate: '2026-12-08',
                              method: 'Cash',
                            })
                          }
                          className="px-2.5 py-1 rounded border border-[#CBD5E1] dark:border-[#2D405B] font-semibold cursor-pointer"
                        >
                          {biText(locale, 'Pay Cash', 'በጥሬ ገንዘብ')}
                        </button>
                      </>
                    )}
                    {bill.status === 'Paid' && (
                      <span className="font-mono text-[11px] text-slate-500">
                        {bill.paymentJournalId}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {ownerVendorBills.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    {biText(locale, 'No vendor bills recorded yet.', 'እስካሁን የአቅራቢ ደረሰኝ የለም።')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fixed Assets Register */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
          <h3 className="font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Fixed Assets & Accumulated Depreciation Schedule (1210–1240)', 'ቋሚ ንብረቶችና የእርጅና ቅናሽ ሰንጠረዥ')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Asset', 'ንብረት')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Accounts / Life', 'ሂሳቦች / ዕድሜ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Cost', 'ዋጋ')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Accum Dep', 'የተጠራቀመ እርጅና')}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Net Book Value', 'የተጣራ ዋጋ')}</th>
                <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Last Run', 'የመጨረሻ ወር')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerFixedAssets.map((ast) => {
                const totalAccum = ast.accumDepOpeningCents + ast.accumDepCurrentCents;
                const nbv = ast.costCents - totalAccum;
                return (
                  <tr key={ast.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{ast.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {ast.assetCode} · {ast.assetClass} · {fmtDate(ast.inServiceDate)}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {ast.assetAccountCode} / {ast.accumDepAccountCode} · {ast.usefulLifeMonths}m
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {fmtEtb(ast.costCents / 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-900 dark:text-amber-300">
                      -{fmtEtb(totalAccum / 100)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#0F233A] dark:text-[#E5B85C]">
                      {fmtEtb(nbv / 100)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {ast.lastDepreciatedPeriod || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      <Modal
        open={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title={biText(locale, 'Record Vendor Bill (PR-17 / PR-18 with 3% WHT)', 'የአቅራቢ ደረሰኝ መዝግብ (ከ 3% WHT ጋር)')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const res = createVendorBill(billForm);
            if (res.ok) setBillModalOpen(false);
          }}
          className="space-y-3 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Vendor Name *</label>
              <input
                required
                value={billForm.vendorName}
                onChange={(e) => setBillForm({ ...billForm, vendorName: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Category (WHT Rule)</label>
              <select
                value={billForm.category}
                onChange={(e) =>
                  setBillForm({ ...billForm, category: e.target.value as 'Goods' | 'Services' | 'Capital' })
                }
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
              >
                <option value="Services">Services (3% WHT if &gt; 10,000 ETB)</option>
                <option value="Goods">Goods (3% WHT if &gt; 20,000 ETB)</option>
                <option value="Capital">Capital Equipment (1230)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold block mb-1">Expense Account</label>
              <select
                value={billForm.expenseAccountCode}
                onChange={(e) => setBillForm({ ...billForm, expenseAccountCode: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              >
                <option value="5100">5100 Repairs &amp; Maint</option>
                <option value="5200">5200 Utilities</option>
                <option value="5300">5300 Insurance</option>
                <option value="5400">5400 Cleaning &amp; Sec</option>
                <option value="5500">5500 Property Mgmt</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Gross Amount (ETB) *</label>
              <input
                type="number"
                min={1}
                required
                value={billForm.amountEtb}
                onChange={(e) => setBillForm({ ...billForm, amountEtb: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Evidence Ref *</label>
              <input
                required
                value={billForm.evidenceRef}
                onChange={(e) => setBillForm({ ...billForm, evidenceRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] font-mono">
            Auto-WHT Preview: 3% = {fmtEtb(whtPreviewEtb)} → Net Payable to Vendor ={' '}
            {fmtEtb(billForm.amountEtb - whtPreviewEtb)}
          </div>
          <div>
            <label className="font-semibold block mb-1">Description *</label>
            <input
              required
              value={billForm.description}
              onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setBillModalOpen(false)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#166549] text-white font-semibold cursor-pointer">
              Submit Bill (Maker-Checker)
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        title={biText(locale, 'Register Fixed Asset (PR-21)', 'ቋሚ ንብረት መዝግብ (PR-21)')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const res = registerFixedAsset(assetForm);
            if (res.ok) setAssetModalOpen(false);
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="font-semibold block mb-1">Asset Name *</label>
            <input
              required
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold block mb-1">Class</label>
              <select
                value={assetForm.assetClass}
                onChange={(e) =>
                  setAssetForm({ ...assetForm, assetClass: e.target.value as 'Building' | 'Equipment' })
                }
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
              >
                <option value="Equipment">Equipment (1230/1240)</option>
                <option value="Building">Building (1210/1220)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Cost (ETB)</label>
              <input
                type="number"
                min={1000}
                required
                value={assetForm.costEtb}
                onChange={(e) => setAssetForm({ ...assetForm, costEtb: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Useful Life (Months)</label>
              <input
                type="number"
                min={12}
                required
                value={assetForm.usefulLifeMonths}
                onChange={(e) =>
                  setAssetForm({ ...assetForm, usefulLifeMonths: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAssetModalOpen(false)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0F233A] text-white font-semibold cursor-pointer">
              Register Asset
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={drawModalOpen}
        onClose={() => setDrawModalOpen(false)}
        title={biText(locale, 'Request Owner Draw (PR-24: Dr 3200 / Cr 1020)', 'የባለቤት ወጪ ጠይቅ (PR-24)')}
        subtitle={biText(
          locale,
          'Requires Owner / Director approval. Never recorded as an operating expense.',
          'የባለቤት ፈቃድ ያስፈልገዋል። እንደ ሥራ ማስኬጃ ወጪ አይመዘገብም።'
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const res = requestOwnerDraw(drawForm);
            if (res.ok) setDrawModalOpen(false);
          }}
          className="space-y-3 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Draw Amount (ETB)</label>
              <input
                type="number"
                min={100}
                required
                value={drawForm.amountEtb}
                onChange={(e) => setDrawForm({ ...drawForm, amountEtb: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Evidence Ref</label>
              <input
                required
                value={drawForm.evidenceRef}
                onChange={(e) => setDrawForm({ ...drawForm, evidenceRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Justification</label>
            <input
              required
              value={drawForm.reason}
              onChange={(e) => setDrawForm({ ...drawForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDrawModalOpen(false)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#166549] text-white font-semibold cursor-pointer">
              Submit Owner Draw Approval
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// Tab 6: 13 Ethiopian Fiscal Periods, 9-Step Close Checklist, Period Reopen & Year-End Close
export const PeriodCloseTab: React.FC = () => {
  const {
    locale,
    fmtEtb,
    currentPersona,
    ownerAccountingPeriods,
    ownerCloseChecklist,
    requestPeriodClose,
    requestPeriodReopen,
    executeYearEndCloseAction,
    simulateClosedPeriodPost,
  } = usePrms();

  const [reopenTargetCode, setReopenTargetCode] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('Late supplier invoice correction for closed month.');
  const [reopenEvidence, setReopenEvidence] = useState('EVD-REOPEN-2019');
  const [closedProbeMsg, setClosedProbeMsg] = useState<string | null>(null);

  const canClose = checkActionPermission(currentPersona.role, 'run_period_close');
  const canReopen = checkActionPermission(currentPersona.role, 'reopen_period');
  const passedCount = ownerCloseChecklist.tasks.filter((t) => t.passed).length;

  return (
    <div className="space-y-5 text-xs">
      {/* 9-Step Close Checklist */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
              <span>
                {biText(
                  locale,
                  `Hidar (${ownerCloseChecklist.periodCode}) Month-End Close Checklist (${passedCount}/${ownerCloseChecklist.tasks.length})`,
                  `የወር መዝጊያ ማረጋገጫ ዝርዝር (${passedCount}/${ownerCloseChecklist.tasks.length})`
                )}
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              {biText(
                locale,
                'Maker submits Close Request after all 9 controls pass; Checker approves Period Close and snapshots Trial Balance.',
                'ሁሉም 9 ቁጥጥሮች ሲያልፉ አዘጋጅ መዝጊያ ይጠይቃል፤ አጽዳቂ ሲፈቅድ ወሩ ይዘጋል።'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusLabel label={ownerCloseChecklist.status} />
            <button
              type="button"
              disabled={!canClose.allowed || passedCount < ownerCloseChecklist.tasks.length}
              title={canClose.reason}
              onClick={() =>
                requestPeriodClose(
                  ownerCloseChecklist.periodCode,
                  `All ${passedCount} close controls passed; submit for GM/Owner close approval.`
                )
              }
              className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              {biText(locale, 'Request Period Close', 'ወር መዝጋት ጠይቅ')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {ownerCloseChecklist.tasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-lg border p-3 ${
                task.passed
                  ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-amber-200 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">
                  #{task.stepNumber} {task.id}
                </span>
                <StatusLabel label={task.passed ? 'Balanced' : 'Exception'} tone={task.passed ? 'green' : 'amber'} />
              </div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {biText(locale, task.titleEn, task.titleAm)}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-mono">{task.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closed Period Lock Probe & Year-End Close Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4">
        <div>
          <p className="font-bold text-[#0F233A] dark:text-slate-100">
            {biText(
              locale,
              'Closed-Period Lock & PR-27 Year-End Close (Pagume 2019-13)',
              'የተዘጋ ወር መቆለፊያ እና የዓመት መዝጊያ (PR-27)'
            )}
          </p>
          {closedProbeMsg && (
            <p className="text-red-700 dark:text-red-300 font-medium mt-1">{closedProbeMsg}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const res = simulateClosedPeriodPost('2019-02');
              setClosedProbeMsg(res.error);
            }}
            className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 font-semibold cursor-pointer"
          >
            {biText(locale, 'Test Closed-Period Lock (Tikimt 2019-02)', 'የተዘጋ ወር ሙከራ (ጥቅምት)')}
          </button>
          <button
            type="button"
            onClick={() => executeYearEndCloseAction('2019-13')}
            className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] text-white font-semibold cursor-pointer"
          >
            {biText(locale, 'Execute Year-End Close (PR-27)', 'የዓመት መዝጊያ አሂድ (PR-27)')}
          </button>
        </div>
      </div>

      {/* 13 Ethiopian Fiscal Periods Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
          <h3 className="font-bold text-[#0F233A] dark:text-slate-100">
            {biText(
              locale,
              'Ethiopian Fiscal Year 2019 E.C. (13 Months: Meskerem – Pagume)',
              'የ2019 ዓ.ም የኢትዮጵያ የሂሳብ ዓመት (13 ወራት፡ መስከረም – ጳጉሜን)'
            )}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2 px-3 font-semibold">{biText(locale, 'Period Code', 'የወር ኮድ')}</th>
                <th className="py-2 px-3 font-semibold">{biText(locale, 'Ethiopian Month', 'የኢትዮጵያ ወር')}</th>
                <th className="py-2 px-3 font-semibold">{biText(locale, 'Gregorian Window', 'የግሪጎሪያን ቀናት')}</th>
                <th className="py-2 px-3 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                <th className="py-2 px-3 font-semibold text-right">{biText(locale, 'Snapshot TB', 'የተዘጋ ሚዛን')}</th>
                <th className="py-2 px-3 font-semibold text-right">{biText(locale, 'Control', 'ቁጥጥር')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerAccountingPeriods.map((per) => (
                <tr key={per.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                  <td className="py-2 px-3 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                    {per.periodCode}
                  </td>
                  <td className="py-2 px-3 font-medium">
                    {per.monthNameEn} ({per.monthNameAm})
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">
                    {per.startDateGc} → {per.endDateGc}
                  </td>
                  <td className="py-2 px-3">
                    <StatusLabel label={per.status} />
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {per.lastTrialBalanceCents ? fmtEtb(per.lastTrialBalanceCents / 100) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {per.status === 'Closed' ? (
                      <button
                        type="button"
                        disabled={!canReopen.allowed}
                        onClick={() => setReopenTargetCode(per.periodCode)}
                        className="text-[#0F233A] dark:text-[#E5B85C] font-semibold hover:underline inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                      >
                        <Unlock className="w-3 h-3" />
                        <span>{biText(locale, 'Request Reopen', 'እንደገና ክፈት')}</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 font-mono">Open</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(reopenTargetCode)}
        onClose={() => setReopenTargetCode(null)}
        title={biText(locale, `Request Period Reopen — ${reopenTargetCode}`, `ወሩን እንደገና ለመክፈት ጠይቅ — ${reopenTargetCode}`)}
        subtitle={biText(
          locale,
          'Requires formal reason and Owner / Director approval.',
          'ግልጽ ምክንያት እና የባለቤት ማጽደቅ ያስፈልጋል።'
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!reopenTargetCode) return;
            const res = requestPeriodReopen(reopenTargetCode, reopenReason, reopenEvidence);
            if (res.ok) setReopenTargetCode(null);
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="font-semibold block mb-1">Evidence Reference *</label>
            <input
              required
              value={reopenEvidence}
              onChange={(e) => setReopenEvidence(e.target.value)}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Reopen Reason *</label>
            <textarea
              required
              rows={2}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setReopenTargetCode(null)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0F233A] text-white font-semibold cursor-pointer">
              Submit Reopen Approval
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// Tab 7: Live Trial Balance, Income Statement, Balance Sheet & Owner Statement (§12.8)
export const OwnerReportsTab: React.FC = () => {
  const {
    locale,
    fmtEtb,
    activeOwner,
    ownerTrialBalance,
    ownerIncomeStatement,
    ownerBalanceSheet,
    ownerStatementSummary,
    logReportExport,
  } = usePrms();

  const handleDownloadCsv = () => {
    const header = 'AccountCode,AccountName,Category,OpeningNetETB,PeriodDebitETB,PeriodCreditETB,ClosingNetETB\n';
    const body = ownerTrialBalance.rows
      .map(
        (r) =>
          `${r.accountCode},"${r.accountName}",${r.category},${r.openingNetCents / 100},${r.periodDebitCents / 100},${r.periodCreditCents / 100},${r.closingNetCents / 100}`
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trial-balance-${activeOwner.id}-2019-03.csv`;
    link.click();
    URL.revokeObjectURL(url);
    logReportExport(`Trial Balance & Owner Statement (${activeOwner.id})`, 'Excel');
  };

  return (
    <div className="space-y-5 text-xs">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs">
          <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Trial Balance Total', 'የሙከራ ሚዛን ድምር')}</p>
          <p className="text-lg font-bold font-mono tabular-nums text-[#0F233A] dark:text-[#E5B85C] mt-1">
            {fmtEtb(ownerTrialBalance.totalDebitCents / 100)}
          </p>
          <p className="text-[11px] text-[#166549] dark:text-emerald-400 font-mono">
            {ownerTrialBalance.balanced ? 'Dr == Cr Balanced' : 'Out of balance'}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs">
          <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Net Rental Income', 'የተጣራ ገቢ')}</p>
          <p className="text-lg font-bold font-mono tabular-nums text-[#166549] dark:text-emerald-400 mt-1">
            {fmtEtb(ownerIncomeStatement.netIncomeCents / 100)}
          </p>
          <p className="text-[11px] font-mono text-slate-500">
            {fmtEtb(ownerIncomeStatement.totalIncomeCents / 100)} − {fmtEtb(ownerIncomeStatement.totalExpenseCents / 100)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs">
          <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Total Assets (BS)', 'ጠቅላላ ንብረት')}</p>
          <p className="text-lg font-bold font-mono tabular-nums text-[#0F233A] dark:text-slate-100 mt-1">
            {fmtEtb(ownerBalanceSheet.totalAssetsCents / 100)}
          </p>
          <p className="text-[11px] font-mono text-slate-500">
            L+E = {fmtEtb((ownerBalanceSheet.totalLiabilitiesCents + ownerBalanceSheet.totalEquityCents) / 100)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Export Statements', 'መግለጫ አውርድ')}</p>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="mt-2 px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Export Trial Balance CSV', 'CSV አውርድ')}</span>
          </button>
        </div>
      </div>

      {/* §12.8 Monthly Owner Statement */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFE5EE] dark:border-[#233349] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                `Monthly Owner Statement — ${activeOwner.name} (${ownerStatementSummary.periodLabel})`,
                `ወርሃዊ የባለቤት መግለጫ — ${activeOwner.name}`
              )}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {biText(
                locale,
                'Separates earned rental profit from cash bank movement, held liabilities (deposits/advance/WHT), and receivables.',
                'የተገኘውን ትርፍ ከባንክ ገንዘብ እንቅስቃሴ፣ ከተያዘ የሌሎች ገንዘብና ከሚጠበቅ ክፍያ ለይቶ ያሳያል።'
              )}
            </p>
          </div>
          <StatusLabel label="Balanced" tone="green" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3.5 space-y-1.5">
            <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
              1. {biText(locale, 'What You Earned', 'የተገኘ ትርፍ')}
            </p>
            {ownerStatementSummary.incomeLines.map((l) => (
              <div key={l.label} className="flex justify-between font-mono">
                <span className="truncate pr-2 text-slate-600 dark:text-slate-300">{l.label}</span>
                <span className="tabular-nums">{fmtEtb(l.amountCents / 100)}</span>
              </div>
            ))}
            <div className="flex justify-between font-mono text-red-700 dark:text-red-300">
              <span>Total Expenses</span>
              <span className="tabular-nums">-{fmtEtb(ownerStatementSummary.totalExpenseCents / 100)}</span>
            </div>
            <div className="flex justify-between font-mono font-bold pt-1 border-t border-[#DFE5EE] dark:border-[#233349]">
              <span>Net Profit</span>
              <span className="tabular-nums text-[#166549] dark:text-emerald-400">
                {fmtEtb(ownerStatementSummary.netIncomeCents / 100)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3.5 space-y-1.5">
            <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
              2. {biText(locale, 'Operating Bank (1020)', 'የባንክ እንቅስቃሴ (1020)')}
            </p>
            <div className="flex justify-between font-mono">
              <span>Opening Bank</span>
              <span>{fmtEtb(ownerStatementSummary.bankMovements.openingCents / 100)}</span>
            </div>
            <div className="flex justify-between font-mono text-[#166549] dark:text-emerald-400">
              <span>Rent After Fees</span>
              <span>+{fmtEtb(ownerStatementSummary.bankMovements.rentReceivedAfterFeesCents / 100)}</span>
            </div>
            <div className="flex justify-between font-mono text-red-700 dark:text-red-300">
              <span>Outflows &amp; Bills</span>
              <span>
                {fmtEtb(
                  (ownerStatementSummary.bankMovements.repairPaidAfterWhtCents +
                    ownerStatementSummary.bankMovements.utilitiesPaidCents +
                    ownerStatementSummary.bankMovements.otherOperatingOutflowsCents) /
                    100
                )}
              </span>
            </div>
            <div className="flex justify-between font-mono font-bold pt-1 border-t border-[#DFE5EE] dark:border-[#233349]">
              <span>Closing Bank</span>
              <span>{fmtEtb(ownerStatementSummary.bankMovements.closingCents / 100)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3.5 space-y-1.5">
            <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
              3. {biText(locale, 'Held for Others', 'ለሌሎች የተያዘ ገንዘብ')}
            </p>
            <div className="flex justify-between font-mono">
              <span>Tenant Deposits (2120)</span>
              <span>{fmtEtb(ownerStatementSummary.heldForOthers.tenantDepositsCents / 100)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Advance Rent (2110)</span>
              <span>{fmtEtb(ownerStatementSummary.heldForOthers.advanceRentCents / 100)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>WHT Payable (2220)</span>
              <span>{fmtEtb(ownerStatementSummary.heldForOthers.withholdingPayableCents / 100)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3.5 space-y-1.5">
            <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
              4. {biText(locale, 'Earned, Not Yet Cash', 'ያልተሰበሰበ ገቢ')}
            </p>
            <div className="flex justify-between font-mono">
              <span>Rent Receivable (1110)</span>
              <span>{fmtEtb(ownerStatementSummary.notYetReceived.rentReceivableCents / 100)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Accrued Rent (1130)</span>
              <span>{fmtEtb(ownerStatementSummary.notYetReceived.accruedRentCents / 100)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Full Live Trial Balance Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex justify-between items-center">
          <h3 className="font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Live Double-Entry Trial Balance', 'ቀጥታ የሙከራ ሚዛን (Trial Balance)')}
          </h3>
          <span className="font-mono font-bold">
            Dr {fmtEtb(ownerTrialBalance.totalDebitCents / 100)} == Cr {fmtEtb(ownerTrialBalance.totalCreditCents / 100)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2 px-3 font-semibold">Code</th>
                <th className="py-2 px-3 font-semibold">Account Name</th>
                <th className="py-2 px-3 font-semibold">Category</th>
                <th className="py-2 px-3 font-semibold text-right">Opening Net</th>
                <th className="py-2 px-3 font-semibold text-right">Period Dr</th>
                <th className="py-2 px-3 font-semibold text-right">Period Cr</th>
                <th className="py-2 px-3 font-semibold text-right">Closing Dr</th>
                <th className="py-2 px-3 font-semibold text-right">Closing Cr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerTrialBalance.rows.map((r) => (
                <tr key={r.accountCode} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70">
                  <td className="py-2 px-3 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                    {r.accountCode}
                  </td>
                  <td className="py-2 px-3 font-medium">{r.accountName}</td>
                  <td className="py-2 px-3 text-slate-500">{r.category}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtEtb(r.openingNetCents / 100)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtEtb(r.periodDebitCents / 100)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtEtb(r.periodCreditCents / 100)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                    {r.tbDebitCents > 0 ? fmtEtb(r.tbDebitCents / 100) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                    {r.tbCreditCents > 0 ? fmtEtb(r.tbCreditCents / 100) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

// Tab 8: Hidar Verification Lab, VAT Copy Simulator & Prototype Migration Replay
export const HidarLabTab: React.FC = () => {
  const {
    locale,
    fmtEtb,
    activeOwnerId,
    ownerLedgerBundle,
    ownerAccounts,
    ownerCharges,
    ownerReceipts,
    ownerLeases,
    resetToHidarWorkedMonth,
  } = usePrms();

  const [suiteResults, setSuiteResults] = useState<HidarVerificationCheckResult[] | null>(() =>
    activeOwnerId === 'OWN-ALPHA' ? runHidarVerificationSuite(ownerLedgerBundle) : null
  );
  const [vatPreview, setVatPreview] = useState<ReturnType<typeof buildCopyableHidarVatVariant> | null>(null);

  const migrationReplay = runPrototypeMigrationReplay({
    ownerId: activeOwnerId,
    v1Accounts: ownerAccounts,
    charges: ownerCharges,
    receipts: ownerReceipts,
    leases: ownerLeases,
  });

  return (
    <div className="space-y-5 text-xs">
      {/* Hidar 10-Point Verification Suite */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
              <span>
                {biText(
                  locale,
                  'Hidar 2019 E.C. Answer-Key Verification Lab (10 Controls)',
                  'የኅዳር 2019 ዓ.ም የማረጋገጫ ላብራቶሪ (10 ቁጥጥሮች)'
                )}
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              {biText(
                locale,
                'Re-runs all 10 worked-month mathematical and governance invariants against OWN-ALPHA live state.',
                'ሁሉንም 10 የኅዳር ሂሳብና የቁጥጥር ሕጎች በ OWN-ALPHA ላይ ያረጋግጣል።'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSuiteResults(runHidarVerificationSuite(ownerLedgerBundle))}
              className="px-3.5 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer"
            >
              {biText(locale, 'Verify Current Ledger', 'መዝገቡን አረጋግጥ')}
            </button>
            <button
              type="button"
              onClick={() => {
                resetToHidarWorkedMonth();
                setSuiteResults(runHidarVerificationSuite());
              }}
              className="px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{biText(locale, 'Reset to Clean Hidar Baseline', 'ወደ ኅዳር መነሻ መልስ')}</span>
            </button>
          </div>
        </div>

        {suiteResults && (
          <div className="overflow-x-auto border border-[#DFE5EE] dark:border-[#233349] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2 px-3 font-semibold">#</th>
                  <th className="py-2 px-3 font-semibold">Verification Check</th>
                  <th className="py-2 px-3 font-semibold">Expected</th>
                  <th className="py-2 px-3 font-semibold">Actual</th>
                  <th className="py-2 px-3 font-semibold text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {suiteResults.map((chk) => (
                  <tr key={chk.id}>
                    <td className="py-2 px-3 font-mono font-bold">{chk.id}</td>
                    <td className="py-2 px-3 font-medium">{chk.title}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {chk.expected}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px]">{chk.actual}</td>
                    <td className="py-2 px-3 text-right">
                      <StatusLabel label={chk.passed ? 'Balanced' : 'Exception'} tone={chk.passed ? 'green' : 'red'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Copyable VAT-Enabled Hidar Variant & Migration Replay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Copyable VAT-Enabled T4 Training Scenario', 'የተ.እ.ታ (VAT 15%) T4 መለማመጃ ቅጂ')}
            </h3>
            <button
              type="button"
              onClick={() => setVatPreview(buildCopyableHidarVatVariant(ownerLedgerBundle))}
              className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] text-white font-semibold cursor-pointer"
            >
              {biText(locale, 'Simulate VAT T4 Copy', 'የVAT T4 ቅጂ ሞክር')}
            </button>
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            {biText(
              locale,
              'Clones the Hidar ledger with vatRegistered=true and posts commercial tenant T4 at ETB 30,000 + 15% VAT (ETB 4,500 -> 2210) while keeping live filing locked.',
              'በቀድሞው የኅዳር መዝገብ ላይ ሳይነካ ለT4 የንግድ ኪራይ 30,000 + 15% VAT (4,500 ወደ 2210) በረቂቅ ያሰላል።'
            )}
          </p>
          {vatPreview && (
            <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] font-mono space-y-1">
              <p className="font-bold text-[#166549] dark:text-emerald-400">
                {vatPreview.vatJournal.journalNumber}: {vatPreview.vatJournal.description}
              </p>
              <p>Draft VAT Output (2210): {fmtEtb(vatPreview.workpaper.vatOutputDraftCents / 100)}</p>
              <p>Status: {vatPreview.workpaper.workpaperStatus}</p>
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Prototype v1 -> Canonical v2 Migration Replay', 'ከ v1 ወደ v2 የውሂብ ሽግግር ማረጋገጫ')}
          </h3>
          <dl className="grid grid-cols-2 gap-2 font-mono bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3">
            <div>
              <dt className="text-slate-500">v1 Mapped Accounts</dt>
              <dd className="font-bold">{migrationReplay.mappedAccountsCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Charges / Receipts</dt>
              <dd className="font-bold">
                {migrationReplay.replayedChargesCount} / {migrationReplay.replayedReceiptsCount}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Charged / Received</dt>
              <dd className="font-bold">
                {fmtEtb(migrationReplay.totalChargedEtb)} / {fmtEtb(migrationReplay.totalReceivedEtb)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Closing AR / Deposits</dt>
              <dd className="font-bold">
                {fmtEtb(migrationReplay.closingReceivableEtb)} / {fmtEtb(migrationReplay.openingCapitalBalancingEtb)}
              </dd>
            </div>
          </dl>
          <p className="text-slate-600 dark:text-slate-300">{migrationReplay.summaryNote}</p>
        </section>
      </div>
    </div>
  );
};
