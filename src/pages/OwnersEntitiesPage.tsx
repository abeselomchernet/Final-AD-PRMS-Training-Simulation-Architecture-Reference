import React from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { canSwitchOwnerForRole } from '../policies/rbac';
import { GovernanceCallout, StatusLabel } from '../components/ui/Primitives';

export const OwnersEntitiesPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    ownerProperties,
    ownerUnits,
    ownerAccounts,
    logCrossOwnerDeniedAttempt,
    locale,
    fmtDate,
  } = usePrms();

  const ownerScope = canSwitchOwnerForRole(currentPersona.role);

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          'Strict Owner & Legal-Entity Isolation Boundary',
          'ጥብቅ የባለቤትነትና የሕጋዊ ተቋም መለያ ገደብ (Owner Isolation)'
        )}
        description={biText(
          locale,
          `Only the currently selected Owner Context (${activeOwner.name}) is loaded in this view. Records for any other owner are structurally hidden to prevent cross-owner data mixing.`,
          `በዚህ ገጽ ውስጥ የአሁኑ የተመረጠው ባለቤት (${activeOwner.name}) መረጃ ብቻ ቀርቧል። የሌሎች ባለቤቶች መረጃ እንዳይቀላቀል ሙሉ በሙሉ ተለይቶ ተደብቋል።`
        )}
        controlType="Prototype Simulation"
        action={
          !ownerScope.canSwitch ? (
            <button
              type="button"
              onClick={() => logCrossOwnerDeniedAttempt('OWN-BETA')}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>
                {biText(
                  locale,
                  'Simulate Cross-Owner Access Test (Attempt OWN-BETA)',
                  'የሌላ ባለቤት መዳረሻ ሙከራ (OWN-BETA)'
                )}
              </span>
            </button>
          ) : null
        }
      />

      <div className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
        <p className="font-semibold text-[#0F233A] dark:text-slate-100">
          {biText(
            locale,
            'Training Multi-Owner Fixtures vs. Authoritative Production Portfolio Topology',
            'የልምምድ ባለብዙ-ባለቤት መረጃ እና የምርት ስሪት ትክክለኛ የባለቤትነት መዋቅር'
          )}
        </p>
        <p>
          {biText(
            locale,
            'OWN-ALPHA / OWN-BETA in this simulator exist strictly to demonstrate RLS owner isolation. In the authoritative Django production portfolio, Registered Title-Holder Abdulwehab Dekebo holds all 5 buildings (~20 units each, Provisional unit count until deed verification), while Abdulwehab Dekebo Trading is modeled separately as a Pending Documentary Confirmation PartyIdentity with inter-entity postings disabled.',
            'በዚህ ማስመሰያ ውስጥ ያሉት OWN-ALPHA እና OWN-BETA የRLS መለያ ገደብን ለማሳየት የተዘጋጁ ሰው-ሠራሽ መረጃዎች ናቸው። በምርት ስርዓቱ ውስጥ አብዱልወሃብ ደከቦ አምስቱንም ሕንፃዎች (እያንዳንዳቸው ~20 ክፍሎች፣ በሰነድ እስኪረጋገጥ ጊዜያዊ) በባለቤትነት የያዘ ሲሆን፣ አብዱልወሃብ ደከቦ ትሬዲንግ ሰነድ እስኪረጋገጥ በተናጠል ተመዝግቦ የተቋማት መሃል የሂሳብ ዝውውር ታግዷል።'
          )}
        </p>
      </div>

      {/* Active Owner Record Table (Single-owner isolated list) */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Active Owner Entity Register', 'የንቁ ባለቤት ተቋም መዝገብ')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {biText(
                locale,
                'Synthetic entity metadata and effective-dated status',
                'ሰው-ሠራሽ የተቋም መገለጫና በቀን የተወሰነ ሁኔታ'
              )}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
            <Lock className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
            {biText(locale, `Isolated to ${activeOwner.code}`, `በ ${activeOwner.code} ብቻ የተገደበ`)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Owner Code', 'የባለቤት ኮድ')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Entity Name', 'የተቋም ስም')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Type (Synthetic)', 'ዓይነት (ሰው-ሠራሽ)')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Effective Date', 'ተፈጻሚ የሚሆንበት ቀን')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Version', 'እትም')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Evidence Reference', 'የማስረጃ ማጣቀሻ')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white dark:bg-[#111C2C]">
                <td className="py-3 px-4 font-mono text-slate-800 dark:text-slate-200">{activeOwner.code}</td>
                <td className="py-3 px-4 font-semibold text-[#0F233A] dark:text-slate-100">{activeOwner.name}</td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{activeOwner.entityType}</td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {fmtDate(activeOwner.effectiveDate)}
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  v{activeOwner.version}
                </td>
                <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{activeOwner.evidenceRef}</td>
                <td className="py-3 px-4">
                  <StatusLabel label={activeOwner.status} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Owner Detail Profile + Scope Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#DFE5EE] dark:border-[#233349] pb-3">
            <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Synthetic Profile & Contact Placeholders', 'ሰው-ሠራሽ መገለጫና የመገኛ ምትክ መረጃዎች')}
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {biText(locale, 'Illustrative Only', 'ለማሳያነት ብቻ')}
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Synthetic Legal Name', 'ሰው-ሠራሽ ሕጋዊ ስም')}</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{activeOwner.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">
                {biText(locale, 'TIN Placeholder (Non-Production)', 'የTIN ምትክ (ለምርት ያልሆነ)')}
              </dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">{activeOwner.tinPlaceholder}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Synthetic Office Address', 'ሰው-ሠራሽ የቢሮ አድራሻ')}</dt>
              <dd className="text-slate-900 dark:text-slate-200 mt-0.5">{activeOwner.addressPlaceholder}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Synthetic Contact Phone', 'ሰው-ሠራሽ ስልክ ቁጥር')}</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-200 mt-0.5">{activeOwner.contactPlaceholder}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Synthetic Email Placeholder', 'ሰው-ሠራሽ ኢሜይል ምትክ')}</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-200 mt-0.5">{activeOwner.emailPlaceholder}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Onboarding Evidence Reference', 'የመመዝገቢያ ማስረጃ ማጣቀሻ')}</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-200 mt-0.5">{activeOwner.evidenceRef}</dd>
            </div>
          </dl>

          <div className="pt-4 border-t border-[#DFE5EE] dark:border-[#233349] grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-[#F4F6F9] dark:bg-[#162438] border border-[#DFE5EE] dark:border-[#233349]">
              <p className="text-lg font-bold font-mono text-[#0F233A] dark:text-slate-100 tabular-nums">
                {ownerProperties.length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{biText(locale, 'Properties', 'ንብረቶች')}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#F4F6F9] dark:bg-[#162438] border border-[#DFE5EE] dark:border-[#233349]">
              <p className="text-lg font-bold font-mono text-[#0F233A] dark:text-slate-100 tabular-nums">
                {ownerUnits.length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{biText(locale, 'Units', 'ክፍሎች')}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#F4F6F9] dark:bg-[#162438] border border-[#DFE5EE] dark:border-[#233349]">
              <p className="text-lg font-bold font-mono text-[#0F233A] dark:text-slate-100 tabular-nums">
                {ownerAccounts.length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {biText(locale, 'Scoped Ledger Accounts', 'የተለዩ የሂሳብ መደቦች')}
              </p>
            </div>
          </div>
        </div>

        {/* Version History Timeline */}
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100 pb-3 border-b border-[#DFE5EE] dark:border-[#233349]">
            {biText(locale, 'Non-Destructive Version History', 'ያለፉ መዝገቦችን የማያጠፋ የእትም ታሪክ')}
          </h2>
          <div className="mt-4 space-y-4">
            {activeOwner.versions.map((ver) => (
              <div
                key={ver.version}
                className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F4F6F9] dark:bg-[#162438] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold text-[#0F233A] dark:text-slate-100">
                    {biText(locale, 'Version', 'እትም')} {ver.version}
                  </span>
                  <StatusLabel label={ver.status} />
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">{ver.summary}</p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {biText(locale, 'Effective', 'ተፈጻሚ')} {fmtDate(ver.effectiveDate)} · {ver.evidenceRef}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Actor', 'ፈጻሚ')}: {ver.changedBy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
