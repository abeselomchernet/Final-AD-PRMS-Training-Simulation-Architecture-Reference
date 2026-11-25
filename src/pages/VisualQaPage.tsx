import React, { useRef, useState } from 'react';
import { Calendar, CheckCircle2, Globe, Languages, Printer, ShieldAlert } from 'lucide-react';
import { biText, formatDateDisplay, formatDateTimeDisplay } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import {
  GovernanceCallout,
  StatusLabel,
  ValidationSummary,
} from '../components/ui/Primitives';

const SAMPLE_DATES = [
  { label: 'Lease Commencement', raw: '2026-01-01' },
  { label: 'Ethiopian New Year Transition (Meskerem 1)', raw: '2026-09-11' },
  { label: 'Current Billing Period Due Date', raw: '2026-11-05' },
  { label: 'Draft Approval Deadline', raw: '2026-11-28' },
];

const LONG_AMHARIC_STRINGS = [
  {
    context: 'Primary Action Button',
    en: 'Submit Non-Active Tax Draft for Review',
    am: 'ንቁ ያልሆነ የታክስ ረቂቅ ለግምገማ እና ለአማካሪ ማረጋገጫ አስገባ',
  },
  {
    context: 'Compliance Status Badge',
    en: 'Unverified — Ethiopian licensed adviser confirmation required.',
    am: 'ያልተረጋገጠ — የኢትዮጵያ ፈቃድ ያለው የታክስ አማካሪ ማረጋገጫ ያስፈልጋል',
  },
  {
    context: 'Audit Immutability Notice',
    en: 'Immutable append-only audit trail across Owner Alpha',
    am: 'ለባለቤት Alpha ብቻ የተለየ የማይፋቅ እና የማይቀየር ተከታታይ የኦዲት መዝገብ',
  },
];

export const VisualQaPage: React.FC = () => {
  const { locale, setLocale, dateMode, setDateMode, activeOwner, fmtEtb } = usePrms();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [overflowIssues, setOverflowIssues] = useState<string[] | null>(null);

  const runLayoutQaCheck = () => {
    const root = containerRef.current;
    if (!root) return;
    const found: string[] = [];
    const buttons = root.querySelectorAll('button');
    buttons.forEach((btn, idx) => {
      if (btn.scrollWidth > btn.clientWidth + 2) {
        found.push(`Button #${idx + 1} horizontal overflow (${btn.textContent?.slice(0, 32) || 'button'})`);
      }
    });
    const badges = root.querySelectorAll('span');
    badges.forEach((sp) => {
      if (sp.scrollWidth > sp.clientWidth + 4 && sp.className.includes('whitespace-nowrap')) {
        found.push(`Badge overflow: ${sp.textContent?.slice(0, 32)}`);
      }
    });
    setOverflowIssues(found);
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          'Amharic UI, Dual Calendar & Layout Visual QA Verification',
          'የአማርኛ ገጽታ፣ የሁለት ቀን መቁጠሪያ እና የአቀማመጥ ጥራት መመርመሪያ'
        )}
        description={biText(
          locale,
          'Use this screen to inspect Ethiopic script (አማርኛ) wrapping, button line-heights, Gregorian/Ethiopian/Dual dates (Africa/Addis_Ababa), form validation errors, and DEMO receipt previews.',
          'ይህ ገጽ የአማርኛ ፊደላትን አቀማመጥ፣ የቁልፍ እርዝማኔን፣ የግሪጎሪያንና የኢትዮጵያ (ዓ.ም) ቀን መቁጠሪያዎችን እና የDEMO ደረሰኝ ቅድመ-ዕይታን ለመፈተሽ ያገለግላል።'
        )}
        controlType="Prototype Simulation"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === 'en' ? 'am' : 'en')}
              className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173454] dark:bg-[#152236] dark:border dark:border-[#2D405B] dark:hover:bg-[#1D2E48] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{locale === 'en' ? 'Test Amharic (አማርኛ)' : 'Switch to English'}</span>
            </button>
            <button
              type="button"
              onClick={runLayoutQaCheck}
              className="px-3 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              {biText(locale, 'Run DOM Overflow Check', 'የአቀማመጥ መጨናነቅ ፈትሽ')}
            </button>
          </div>
        }
      />

      {overflowIssues !== null && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs flex items-center gap-2 ${
            overflowIssues.length === 0
              ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-100'
              : 'bg-amber-50 dark:bg-amber-950/35 border-[#D9A441]/60 dark:border-amber-700/70 text-amber-950 dark:text-amber-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {overflowIssues.length === 0 ? (
            <span>
              {biText(
                locale,
                'Zero button or badge horizontal clipping detected on the Visual QA viewport.',
                'በገጹ ቁልፎችና ምልክቶች ላይ ምንም የመጨናነቅ ወይም የመቆረጥ ችግር አልተገኘም።'
              )}
            </span>
          ) : (
            <span>{overflowIssues.join(' · ')}</span>
          )}
        </div>
      )}

      {/* 1. Ethiopian / Gregorian / Dual Calendar Matrix */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                'Ethiopian (ዓ.ም), Gregorian & Dual Calendar Matrix (Africa/Addis_Ababa)',
                'የኢትዮጵያ (ዓ.ም)፣ ግሪጎሪያን እና ጥምር ቀን መቁጠሪያ ንጽጽር'
              )}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {(['gregorian', 'ethiopic', 'dual'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDateMode(m)}
                className={`px-2.5 py-1 rounded-lg border font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  dateMode === m
                    ? 'bg-[#0F233A] text-white border-[#0F233A] dark:bg-[#248F64] dark:text-white dark:border-[#248F64]'
                    : 'bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-200 border-[#DFE5EE] dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#1D2E48]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Event Context', 'የክስተት ዓይነት')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Gregorian', 'ግሪጎሪያን')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Ethiopian (ዓ.ም)', 'ኢትዮጵያዊ (ዓ.ም)')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Dual Output (Amharic)', 'ጥምር (በአማርኛ)')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {SAMPLE_DATES.map((d) => (
                <tr key={d.raw} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                  <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">{d.label}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatDateDisplay(d.raw, 'en', 'gregorian')}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-[#166549] dark:text-emerald-400 font-semibold">
                    {formatDateDisplay(d.raw, 'am', 'ethiopic')}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-[#0F233A] dark:text-[#E5B85C]">
                    {formatDateDisplay(d.raw, 'am', 'dual')}
                  </td>
                </tr>
              ))}
              <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                  Audit Timestamp Sample (2026-11-12 09:42)
                </td>
                <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatDateTimeDisplay('2026-11-12 09:42:00', 'en', 'gregorian')}
                </td>
                <td className="py-2.5 px-4 font-mono tabular-nums text-[#166549] dark:text-emerald-400 font-semibold">
                  {formatDateTimeDisplay('2026-11-12 09:42:00', 'am', 'ethiopic')}
                </td>
                <td className="py-2.5 px-4 font-mono tabular-nums text-[#0F233A] dark:text-[#E5B85C]">
                  {formatDateTimeDisplay('2026-11-12 09:42:00', 'am', 'dual')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Long Amharic Wrapping & Status Stress Test */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-4 text-xs shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#DFE5EE] dark:border-[#233349]">
            <Languages className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Long Amharic String & Control Wrapping Test', 'ረጅም የአማርኛ ጽሑፍ እና ቁልፎች መፈተሻ')}
            </h2>
          </div>

          <div className="space-y-3">
            {LONG_AMHARIC_STRINGS.map((item) => (
              <div
                key={item.context}
                className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236] space-y-2"
              >
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.context}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white font-semibold text-left leading-snug transition-colors cursor-pointer"
                  >
                    {locale === 'am' ? item.am : item.en}
                  </button>
                  <StatusLabel label={item.en} />
                </div>
              </div>
            ))}
          </div>

          <ValidationSummary
            errors={[
              biText(
                locale,
                'Sample Validation Error: Lease end date must be after lease commencement date.',
                'የናሙና ስህተት፡ የውል መጨረሻ ቀን ከመጀመሪያ ቀን በኋላ መሆን አለበት።'
              ),
              biText(
                locale,
                'Sample Tax Gate Block: Active tax lifecycle cannot be enabled in prototype.',
                'የታክስ ገደብ፡ በፕሮቶታይፕ ውስጥ ንቁ (Active) የታክስ ደረጃ አይፈቀድም።'
              ),
            ]}
          />
        </div>

        {/* 3. DEMO Printable Receipt Layout Verification (intentionally crisp light paper) */}
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-4 text-xs shadow-xs">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DFE5EE] dark:border-[#233349]">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-[#0F233A] dark:text-slate-100" />
              <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                {biText(locale, 'Printable DEMO Receipt Bilingual Check', 'የሚታተም DEMO ደረሰኝ ቅድመ-ዕይታ ፍተሻ')}
              </h2>
            </div>
            <StatusLabel label="Issued — Demo Only" />
          </div>

          <div className="border-2 border-dashed border-amber-400 rounded-lg p-4 bg-white text-slate-900 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-200">
              <span className="font-bold text-red-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                SYNTHETIC DEMO RECEIPT — NOT LEGALLY VALID
              </span>
              <span className="font-mono text-[11px] text-slate-600">RCT-SYNTH-QA-001</span>
            </div>
            <dl className="grid grid-cols-2 gap-2.5">
              <div>
                <dt className="text-slate-500">{biText(locale, 'Owner Scope', 'ባለቤት')}</dt>
                <dd className="font-semibold text-[#0F233A]">{activeOwner.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{biText(locale, 'Receipt Date', 'የደረሰኝ ቀን')}</dt>
                <dd className="font-mono text-slate-900">
                  {formatDateDisplay('2026-11-12', locale, dateMode)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{biText(locale, 'Amount (Synthetic)', 'መጠን (ሰው-ሠራሽ)')}</dt>
                <dd className="font-mono font-bold text-[#166549] tabular-nums">
                  {fmtEtb(35000)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{biText(locale, 'Fiscal Device Status', 'የፊስካል መሣሪያ ሁኔታ')}</dt>
                <dd className="text-red-800 font-semibold">
                  {biText(locale, 'Not Connected / Disabled', 'አልተገናኘም / ታግዷል')}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
};
