import React, { useState } from 'react';
import { Calculator, CalendarClock, Lock, QrCode, Scale } from 'lucide-react';
import { usePrms } from '../../context/PrmsContext';
import { biText } from '../../data/i18n';
import { ENABLE_LIVE_TAX_INVOICING } from '../../data/accountingRulePack';
import { computeMarginalTax1395, toCents } from '../../services/accountingEngine';
import { TaxRuleRegisterItem } from '../../types/prms';
import { GovernanceCallout, StatusLabel } from '../ui/Primitives';

export const WorkpaperStudioTab: React.FC = () => {
  const {
    locale,
    fmtEtb,
    activeOwner,
    ownerLedgerConfig,
    ownerTaxWorkpapers,
    runAndSaveTaxWorkpaper,
    toggleOwnerVatDraftMode,
  } = usePrms();

  const latestWp = ownerTaxWorkpapers[0];
  const [combinedMode, setCombinedMode] = useState(latestWp?.combinedIndividualIncomeMode || false);
  const [otherIncomeEtb, setOtherIncomeEtb] = useState((latestWp?.otherIndividualIncomeCents || 0) / 100);
  const [priorTaxEtb, setPriorTaxEtb] = useState(120000);
  const [bandProbeEtb, setBandProbeEtb] = useState(200000);

  const bandProbeTaxEtb = computeMarginalTax1395(toCents(bandProbeEtb)) / 100;

  return (
    <div className="space-y-5 text-xs">
      <GovernanceCallout
        title={biText(
          locale,
          `Tax Workpaper Draft Studio — ${activeOwner.name} (${ownerLedgerConfig.entityType})`,
          `የታክስ የስራ ወረቀት ረቂቅ — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          `Side-by-side comparison of Books Method vs. Flat Presumptive Deduction (20% / 35%), Amendment 1395/2025 marginal bands, Corporate 30%, Draft 15% VAT, 3% WHT, and Proclamation 1365/2025 Property Tax. Production activation stays locked (ENABLE_LIVE_TAX_INVOICING=${String(ENABLE_LIVE_TAX_INVOICING)}).`,
          'የመዝገብ ዘዴን ከ20% እና 35% ጠቅላላ ተቀናሽ፣ ከአዋጅ 1395/2025 ደረጃዎች፣ 30% ድርጅት፣ 15% VAT፣ 3% WHT እና ከአዋጅ 1365/2025 ንብረት ግብር ጋር ያነጻጽራል።'
        )}
        variant="warning"
        controlType="Prototype Simulation"
      />

      {/* Interactive Parameters + Marginal Band Verifier */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
              <span>{biText(locale, 'Workpaper Calculation Inputs (Draft Only)', 'የስራ ወረቀት ግቤቶች (ረቂቅ ብቻ)')}</span>
            </h2>
            <StatusLabel label="Workpaper Draft" tone="amber" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] cursor-pointer">
              <input
                type="checkbox"
                checked={ownerLedgerConfig.vatRegistered}
                onChange={(e) => toggleOwnerVatDraftMode(e.target.checked)}
                className="accent-[#166549]"
              />
              <span className="font-semibold">
                {biText(locale, '15% VAT Draft Registered', '15% VAT ረቂቅ')}
              </span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] cursor-pointer">
              <input
                type="checkbox"
                checked={combinedMode}
                onChange={(e) => setCombinedMode(e.target.checked)}
                className="accent-[#166549]"
              />
              <span className="font-semibold">
                {biText(locale, 'Combined Individual Income', 'የተጣመረ የግል ገቢ')}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 shrink-0">Prior Tax (ETB):</span>
              <input
                type="number"
                min={0}
                value={priorTaxEtb}
                onChange={(e) => setPriorTaxEtb(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
          </div>

          {combinedMode && (
            <div className="flex items-center gap-3">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {biText(locale, 'Other Taxable Individual Income (ETB/yr):', 'ሌላ ዓመታዊ የግል ገቢ (ብር):')}
              </label>
              <input
                type="number"
                min={0}
                value={otherIncomeEtb}
                onChange={(e) => setOtherIncomeEtb(Number(e.target.value))}
                className="w-40 px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                runAndSaveTaxWorkpaper({
                  periodCode: '2019-03',
                  combinedIndividualIncomeMode: combinedMode,
                  otherIndividualIncomeEtb: otherIncomeEtb,
                  priorYearIncomeTaxEtb: priorTaxEtb,
                })
              }
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer"
            >
              {biText(locale, 'Recompute & Save Tax Workpaper Draft', 'የታክስ የስራ ወረቀት አስላና አስቀምጥ')}
            </button>
          </div>
        </div>

        {/* 1395/2025 Schedule B Marginal Band Verifier */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-[#0F233A] dark:text-[#E5B85C]" />
              <span>{biText(locale, 'Proc. 1395/2025 Marginal Band Tester', 'አዋጅ 1395/2025 የደረጃ መሞከሪያ')}</span>
            </h3>
            <span className="font-mono text-[11px] text-[#166549] dark:text-emerald-400">
              200k → 45,400 ETB
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              value={bandProbeEtb}
              onChange={(e) => setBandProbeEtb(Number(e.target.value))}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono font-bold"
            />
            <button
              type="button"
              onClick={() => setBandProbeEtb(200000)}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] font-mono whitespace-nowrap cursor-pointer"
            >
              200,000 Ref
            </button>
          </div>
          <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] flex justify-between items-center font-mono">
            <span className="text-slate-600 dark:text-slate-300">Individual Annual Tax:</span>
            <span className="text-base font-bold text-[#0F233A] dark:text-[#E5B85C]">
              {fmtEtb(bandProbeTaxEtb)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            0–24k: 0% · 24–48k: 15% · 48–84k: 20% · 84–120k: 25% · 120–168k: 30% · &gt;168k: 35%
          </p>
        </div>
      </section>

      {/* Dual Comparison Cards */}
      {latestWp && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs space-y-1">
            <p className="text-slate-500 dark:text-slate-400">
              {biText(locale, 'Books Method (Annualized)', 'በመዝገብ ዘዴ (ዓመታዊ)')}
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#0F233A] dark:text-[#E5B85C]">
              {fmtEtb(latestWp.taxBooksCents / 100)}
            </p>
            <p className="text-[11px] font-mono text-slate-500">
              Gross {fmtEtb(latestWp.grossAnnualizedRentCents / 100)} − Deductible{' '}
              {fmtEtb(latestWp.deductibleExpensesBooksCents / 100)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs space-y-1">
            <p className="text-slate-500 dark:text-slate-400">
              {biText(locale, 'Flat Presumptive (20% / 35%)', 'ጠቅላላ ተቀናሽ (20% / 35%)')}
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#0F233A] dark:text-slate-100">
              {fmtEtb(latestWp.taxFlat20Cents / 100)} / {fmtEtb(latestWp.taxFlat35Cents / 100)}
            </p>
            <p className="text-[11px] font-mono text-slate-500">
              20% deduction (new) vs 35% deduction
            </p>
          </div>
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs space-y-1">
            <p className="text-slate-500 dark:text-slate-400">
              {biText(locale, '3% WHT & Draft 15% VAT Net', '3% ተቀናሽ እና 15% VAT')}
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#166549] dark:text-emerald-400">
              {fmtEtb(latestWp.whtPayableCents / 100)} WHT
            </p>
            <p className="text-[11px] font-mono text-slate-500">
              VAT Net Draft: {fmtEtb(latestWp.vatNetDraftCents / 100)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs space-y-1">
            <p className="text-slate-500 dark:text-slate-400">
              {biText(locale, 'Quarterly Advance (25%) & Prop Tax (1365)', 'የሩብ ዓመት ቅድሚያ (25%) እና ንብረት ግብር')}
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#0F233A] dark:text-slate-100">
              {fmtEtb(latestWp.quarterlyAdvanceTaxCents / 100)} / qtr
            </p>
            <p className="text-[11px] font-mono text-slate-500">
              Prop Tax Est (25% base): {fmtEtb(latestWp.propertyTaxEstimateCents / 100)}
            </p>
          </div>
        </section>
      )}
    </div>
  );
};

export const RulesRegisterPacksTab: React.FC = () => {
  const { locale, taxRuleRegister, taxRulePacks, toggleRulesRegisterSignOff } = usePrms();

  return (
    <div className="space-y-5 text-xs">
      {/* Versioned Tax Rule Packs */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {taxRulePacks.map((pack) => (
          <div
            key={pack.id}
            className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">{pack.packCode}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-300">
                <Lock className="w-3 h-3" />
                <span>{pack.lifecycleStage} (Active Gate Locked)</span>
              </span>
            </div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {pack.jurisdiction} · {pack.entityType}
            </p>
            <p className="text-slate-600 dark:text-slate-300">{pack.taxLawRef}</p>
            <p className="font-mono text-[11px] text-slate-500">
              Effective: {pack.effectiveFrom}
              {pack.flatCompanyRatePercent ? ` · Corporate Rate: ${pack.flatCompanyRatePercent}%` : ''}
              {pack.vatRatePercent ? ` · VAT: ${pack.vatRatePercent}% (Threshold ${pack.vatRegistrationThresholdEtb?.toLocaleString()} ETB)` : ''}
              {pack.whtRatePercent ? ` · WHT: ${pack.whtRatePercent}% (Cash cap ${pack.cashTransactionLimitEtb?.toLocaleString()} ETB)` : ''}
            </p>
          </div>
        ))}
      </section>

      {/* 21-Row Tax Rules Register */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(locale, `Ethiopian Tax & Lease Rules Register (${taxRuleRegister.length} Rules)`, `የኢትዮጵያ የታክስና የኪራይ ሕጎች መዝገብ (${taxRuleRegister.length})`)}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {biText(
                locale,
                'Tracks each verified rule assumption, source proclamation, conflict notice, and licensed adviser sign-off state.',
                'እያንዳንዱን የታክስ ደንብ ምንጭ፣ ግጭትና የባለሙያ ፊርማ ሁኔታ ይከታተላል።'
              )}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2 px-3 font-semibold">#</th>
                <th className="py-2 px-3 font-semibold">{biText(locale, 'Rule & Module Assumption', 'ሕግና የሥርዓት አሠራር')}</th>
                <th className="py-2 px-3 font-semibold">{biText(locale, 'Primary Source & Notice', 'ዋና ምንጭ')}</th>
                <th className="py-2 px-3 font-semibold">{biText(locale, 'Adviser Sign-Off', 'የአማካሪ ፊርማ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {taxRuleRegister.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/70 align-top">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">{item.id}</td>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.ruleTitle}</p>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">{item.moduleAssumption}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="text-slate-700 dark:text-slate-300">{item.sourceSummary}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                      Checked {item.checkedDate} {item.hasConflict ? '· Conflict Flagged' : ''}
                    </p>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <select
                      value={item.signOffStatus}
                      onChange={(e) =>
                        toggleRulesRegisterSignOff(
                          item.id,
                          e.target.value as TaxRuleRegisterItem['signOffStatus']
                        )
                      }
                      className="px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg text-xs"
                    >
                      <option value="Not reviewed">Not reviewed</option>
                      <option value="Owner Decision Pending">Owner Decision Pending</option>
                      <option value="Adviser Confirmed">Adviser Confirmed</option>
                    </select>
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

export const TaxCalendarEInvoiceTab: React.FC = () => {
  const { locale, fmtEtb, ownerTaxCalendar, ownerLedgerJournals } = usePrms();
  const sampleEInv = ownerLedgerJournals.find((j) => j.eInvoiceMetadata);

  return (
    <div className="space-y-5 text-xs">
      {/* Directive 1142/2026 E-Invoice Adapter Readiness */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#0F233A] dark:text-[#E5B85C]" />
            <span>
              {biText(
                locale,
                'Directive 1142/2026 E-Invoice & QR Adapter Readiness (Locked)',
                'መመሪያ 1142/2026 የኤሌክትሮኒክ ደረሰኝ እና QR ዝግጁነት (የተቆለፈ)'
              )}
            </span>
          </h2>
          <span className="font-mono font-bold text-red-700 dark:text-red-300">
            ENABLE_LIVE_TAX_INVOICING=False
          </span>
        </div>
        <p className="text-slate-600 dark:text-slate-300">
          {biText(
            locale,
            'Every Rent Charge & Payment Receipt stores IRN placeholder, QR payload string, property-use VAT classification, and submission status cleanly for future ERCA activation.',
            'እያንዳንዱ ክፍያና ደረሰኝ የወደፊት IRN እና QR ውሂብ በጥንቃቄ ይይዛል፤ የERCA ቀጥታ ግንኙነት በቋሚነት ተቆልፏል።'
          )}
        </p>
        {sampleEInv?.eInvoiceMetadata && (
          <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] font-mono space-y-1">
            <p>Sample Journal: {sampleEInv.journalNumber} ({sampleEInv.sourceId})</p>
            <p>IRN: {sampleEInv.eInvoiceMetadata.irnPlaceholder}</p>
            <p>QR Payload: {sampleEInv.eInvoiceMetadata.qrPayloadPlaceholder}</p>
            <p>
              Use / VAT Type: {sampleEInv.eInvoiceMetadata.propertyUse} ·{' '}
              {sampleEInv.eInvoiceMetadata.vatSupplyType} · {sampleEInv.eInvoiceMetadata.submissionStatus}
            </p>
          </div>
        )}
      </section>

      {/* Owner Tax Filing Calendar */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ownerTaxCalendar.map((cal) => (
          <div
            key={cal.id}
            className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C] flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                <span>{cal.obligationCode}</span>
              </span>
              <StatusLabel label={cal.frequency} tone="amber" />
            </div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {biText(locale, cal.titleEn, cal.titleAm)}
            </p>
            <p className="text-slate-600 dark:text-slate-300">{cal.ecScheduleLabel}</p>
            <div className="flex items-center justify-between font-mono pt-1 border-t border-slate-100 dark:border-[#1D2D42]">
              <span className="text-slate-500">GC Target: {cal.gcDueDate}</span>
              <span className="font-bold text-[#0F233A] dark:text-slate-100">
                Draft: {fmtEtb(cal.draftEstimateCents / 100)}
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
