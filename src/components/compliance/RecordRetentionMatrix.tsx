import React from 'react';
import { Archive, Lock } from 'lucide-react';
import { biText } from '../../data/i18n';
import { usePrms } from '../../context/PrmsContext';
import { checkActionPermission } from '../../policies/rbac';
import { GovernanceCallout, StatusLabel } from '../ui/Primitives';

export const RecordRetentionMatrix: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    ownerRetentionClasses,
    toggleRetentionLegalHold,
    locale,
  } = usePrms();

  const canToggleHold = checkActionPermission(
    currentPersona.role,
    'toggle_legal_hold_placeholder'
  );

  return (
    <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
      <div className="px-5 py-4 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Archive className="w-4 h-4 text-[#0F233A] dark:text-[#E5B85C] mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Records & Retention Class Matrix', 'የመዝገቦችና የማቆያ ጊዜ ሰንጠረዥ')} (
              {activeOwner.name})
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {biText(
                locale,
                'Proposed retention classification and legal-hold placeholder only. No automated deletion, purge, or archive job exists in this prototype.',
                'የታቀደ የመዝገብ ማቆያ ምደባና የሕግ እገዳ ምትክ ብቻ። በዚህ ፕሮቶታይፕ ምንም አውቶማቲክ የማጥፋት ወይም የማስወገድ ሥራ የለም።'
              )}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 dark:text-slate-300">
          <Lock className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
          {biText(locale, 'No Purge / Delete Jobs', 'ማጥፋት / ማስወገድ የለም')}
        </span>
      </div>

      <div className="p-4 border-b border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C]">
        <GovernanceCallout
          title={biText(
            locale,
            'Retention Duration Pending Professional Confirmation',
            'የመዝገብ ማቆያ ጊዜ የባለሙያ ማረጋገጫ የሚጠብቅ'
          )}
          description={biText(
            locale,
            'The 10-year period appears strictly as an unverified research reference (Commercial Code — adviser verification required), never as an active or legally confirmed retention schedule.',
            'የ10 ዓመቱ ጊዜ በጥናት ውስጥ እንደ ያልተረጋገጠ ማጣቀሻ (የንግድ ሕግ — የአማካሪ ማረጋገጫ የሚፈልግ) ብቻ ይታያል እንጂ እንደ ጸደቀ የመዝገብ ማቆያ መርሐ-ግብር አይቆጠርም።'
          )}
          variant="warning"
          controlType="Production Boundary"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
            <tr>
              <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Class', 'ምድብ')}</th>
              <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Record Category', 'የመዝገብ ዓይነት')}</th>
              <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Configured Duration', 'የተቀመጠ ጊዜ')}</th>
              <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Research Reference (Not Active)', 'የጥናት ማጣቀሻ (ንቁ ያልሆነ)')}</th>
              <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Legal-Hold Placeholder', 'የሕግ እገዳ ምትክ')}</th>
              <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Simulation Action', 'የማስመሰያ ተግባር')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
            {ownerRetentionClasses.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
              >
                <td className="py-3 px-4 font-mono text-slate-700 dark:text-[#E5B85C]">
                  {item.recordClassCode}
                </td>
                <td className="py-3 px-4 font-semibold text-[#0F233A] dark:text-slate-100">
                  {item.recordType}
                </td>
                <td className="py-3 px-4 text-amber-900 dark:text-amber-300 font-medium">
                  {item.configuredDuration}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                  {item.researchReferenceNote}
                </td>
                <td className="py-3 px-4">
                  <StatusLabel
                    label={item.legalHoldState}
                    tone={item.legalHoldState.includes('Active') ? 'amber' : 'slate'}
                  />
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    disabled={!canToggleHold.allowed}
                    title={canToggleHold.reason}
                    onClick={() =>
                      toggleRetentionLegalHold(
                        item.id,
                        `Simulated legal-hold placeholder toggle on ${item.recordType}`
                      )
                    }
                    className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {item.legalHoldState.includes('Active')
                      ? biText(locale, 'Clear Hold Placeholder', 'የእገዳ ምትክ አጽዳ')
                      : biText(locale, 'Simulate Legal Hold', 'የሕግ እገዳ አስመስል')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
