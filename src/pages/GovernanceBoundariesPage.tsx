import React from 'react';
import { CheckCircle2, FileWarning, Lock, ServerOff, ShieldCheck } from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { GovernanceCallout } from '../components/ui/Primitives';
import { RecordRetentionMatrix } from '../components/compliance/RecordRetentionMatrix';

export const GovernanceBoundariesPage: React.FC = () => {
  const { locale } = usePrms();

  const boundaryCards = [
    {
      title: biText(locale, '1. Synthetic & Illustrative Data Only', '1. ሰው-ሠራሽና ለማሳያ የቀረበ መረጃ ብቻ'),
      icon: FileWarning,
      points: [
        biText(
          locale,
          'Every owner, property, building, unit, tenant, lease, ETB amount, receipt, and ledger account in AD-PRMS is 100% synthetic.',
          'በAD-PRMS ውስጥ ያለ እያንዳንዱ ባለቤት፣ ንብረት፣ ሕንፃ፣ ክፍል፣ ተከራይ፣ ውል፣ የብር መጠን፣ ደረሰኝና የሂሳብ መደብ 100% ሰው-ሠራሽ ነው።'
        ),
        biText(
          locale,
          'Records such as Test Owner Alpha, Test Owner Beta, DEMO Property Alpha/Beta, SYNTH Unit A-101..B-101, and SYNTH Tenant 001..003 are illustrative placeholders only.',
          'እንደ Test Owner Alpha, Test Owner Beta, DEMO Property Alpha/Beta, SYNTH Unit A-101..B-101 እና SYNTH Tenant 001..003 ያሉ መዝገቦች ለማሳያ ብቻ የቀረቡ ምትኮች ናቸው።'
        ),
        biText(
          locale,
          'No real tenant, owner, financial, identity, TIN, or legal record is stored or implied.',
          'ምንም እውነተኛ የተከራይ፣ የባለቤት፣ የፋይናንስ፣ የማንነት፣ የTIN ወይም የሕግ መረጃ አልተከማቸም።'
        ),
      ],
    },
    {
      title: biText(locale, '2. Production Data Onboarding Prerequisites', '2. የምርት መረጃ ማስገቢያ ቅድመ-ሁኔታዎች'),
      icon: ShieldCheck,
      points: [
        biText(
          locale,
          'Real data cannot be imported into or migrated from this prototype.',
          'እውነተኛ መረጃ ወደዚህ ፕሮቶታይፕ መጫን ወይም ከዚህ መውሰድ አይቻልም።'
        ),
        biText(
          locale,
          'Production data loading requires separately approved documentary evidence, owner reconciliation sign-off, opening-balance verification, and formal onboarding controls.',
          'የምርት መረጃ መጫን ለብቻው የጸደቀ ሰነድ፣ የባለቤት ማረጋገጫ ፊርማ፣ የመክፈቻ ሚዛን ፍተሻና መደበኛ ቁጥጥር ይጠይቃል።'
        ),
        biText(
          locale,
          'All changes in production must pass verified maker-checker workflows backed by persistent cryptographic audit logs.',
          'በምርት ውስጥ ያሉ ለውጦች በሙሉ በማይለወጥ የኦዲት መዝገብ የተደገፈ የአዘጋጅ-አጽዳቂ ፍሰትን ማለፍ አለባቸው።'
        ),
      ],
    },
    {
      title: biText(locale, '3. Tax, Legal & Regulatory Disclaimer', '3. የታክስ፣ የሕግና የቁጥጥር ማሳሰቢያ'),
      icon: Lock,
      points: [
        biText(
          locale,
          'No tax rate in this prototype is legally approved, active, or compliant with Ethiopian tax authorities.',
          'በዚህ ፕሮቶታይፕ ውስጥ ያለ ምንም የታክስ ምጣኔ በሕግ የጸደቀ ወይም ንቁ አይደለም።'
        ),
        biText(
          locale,
          'All tax rows are marked Draft, Pending Approval, or Not Active and require qualified Ethiopian tax and legal professional approval prior to production activation.',
          'ሁሉም የታክስ መስመሮች ረቂቅ ወይም ያልጸደቁ ሲሆኑ ከምርት በፊት የኢትዮጵያ የታክስና የሕግ ባለሙያ ማረጋገጫ ያስፈልጋቸዋል።'
        ),
        biText(
          locale,
          'DEMO receipts carry an explicit watermark and have zero fiscal or legal validity.',
          'የDEMO ደረሰኞች ግልጽ የማስጠንቀቂያ ማህተም ያላቸው ሲሆን ምንም ሕጋዊ ወይም የፊስካል ዋጋ የላቸውም።'
        ),
      ],
    },
    {
      title: biText(locale, '4. Unresolved Production Governance Decisions', '4. ያልተወሰኑ የምርት አስተዳደር ውሳኔዎች'),
      icon: ServerOff,
      points: [
        biText(
          locale,
          'Real legal-entity structure, formal ownership deeds, delegation authority matrices, and audited opening balances are NOT resolved by this UI/UX prototype.',
          'እውነተኛ የሕጋዊ ተቋም መዋቅር፣ የባለቤትነት ካርታ፣ የውክልና ሥልጣን ሰንጠረዥና ኦዲት የተደረገ የመክፈቻ ሚዛን በዚህ ፕሮቶታይፕ አልተወሰኑም።'
        ),
        biText(
          locale,
          'Production infrastructure, encrypted local backups, hardware security, and deployment topology require separate architecture approval.',
          'የምርት መሠረተ-ልማት፣ የተመሰጠረ ምትኬ (Backup) እና የደህንነት መዋቅር ለብቻው የንድፍ ማጽደቅ ያስፈልጋቸዋል።'
        ),
        biText(
          locale,
          'AD-PRMS is intended as an offline / local-first office application in production; this web Studio build is strictly a browser-based interactive demonstration.',
          'AD-PRMS በምርት ላይ እንደ ከመስመር ውጭ / ሎካል-ፈርስት የቢሮ መተግበሪያ የታቀደ ነው፤ ይህ የድር ማሳያ ለሙከራ ብቻ ነው።'
        ),
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          'Governance & Prototype Boundaries — Scope & Simulation Disclosure',
          'አስተዳደርና የፕሮቶታይፕ ገደቦች — የወሰንና የማስመሰያ መግለጫ'
        )}
        description={biText(
          locale,
          'This page documents the exact boundary between UI/UX prototype simulation and enforced production controls.',
          'ይህ ገጽ በUI/UX ፕሮቶታይፕ ማስመሰያና በምርት ቁጥጥሮች መካከል ያለውን ትክክለኛ ልዩነት ያሳያል።'
        )}
        variant="warning"
        controlType="Production Boundary"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {boundaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <section
              key={card.title}
              className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-3 shadow-xs"
            >
              <div className="flex items-center gap-2.5 border-b border-[#DFE5EE] dark:border-[#233349] pb-3">
                <Icon className="w-4 h-4 text-[#166549] dark:text-[#E5B85C] shrink-0" />
                <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">{card.title}</h2>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed list-disc list-inside">
                {card.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Prototype Simulation vs Enforced Production Control Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
          <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
            {biText(
              locale,
              'Prototype Simulation vs. Production Architecture Controls',
              'የፕሮቶታይፕ ማስመሰያ እና የምርት አርክቴክቸር ቁጥጥሮች ንጽጽር'
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {biText(
              locale,
              'Clear distinction so stakeholders never mistake browser prototype simulations for live production enforcement',
              'ባለድርሻ አካላት የአሳሽ ማስመሰያዎችን እንደ እውነተኛ የምርት ቁጥጥር እንዳይቆጥሩ ግልጽ መለያ'
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Control Area', 'የቁጥጥር መስክ')}</th>
                <th className="py-2.5 px-4 font-semibold">
                  {biText(locale, 'Status in This Prototype', 'በዚህ ፕሮቶታይፕ ያለው ሁኔታ')}
                </th>
                <th className="py-2.5 px-4 font-semibold">
                  {biText(locale, 'Intended Production Enforcement', 'የታቀደው የምርት አፈጻጸም')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                <td className="py-3 px-4 font-semibold text-[#0F233A] dark:text-slate-100">
                  {biText(locale, 'Owner Data Isolation', 'የባለቤት ውሂብ መለያየት')}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {biText(
                    locale,
                    'Simulated in-memory filtering by active ownerId (Test Owner Alpha / Beta).',
                    'በማህደረ-ትውስታ (In-memory) ውስጥ በተመረጠው ባለቤት (Alpha/Beta) ማጣራት።'
                  )}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {biText(
                    locale,
                    'Database-level tenant/owner partitioning and server-verified session claims.',
                    'በዳታቤዝ ደረጃ የባለቤት ክፍፍልና በአገልጋይ የተረጋገጠ ክፍለ-ጊዜ።'
                  )}
                </td>
              </tr>
              <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                <td className="py-3 px-4 font-semibold text-[#0F233A] dark:text-slate-100">
                  {biText(locale, 'Maker-Checker & RBAC', 'አዘጋጅ-አጽዳቂና RBAC')}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {biText(
                    locale,
                    'Simulated policy checks blocking self-approval (Actor ID lock) and System Admin approvals in UI.',
                    'ራስን ማጽደቅን (በActor ID) እና የSystem Admin ማጽደቅን የሚከለክሉ የUI ማስመሰያዎች።'
                  )}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {biText(
                    locale,
                    'Enforced server/local-engine transaction guards with signed user identity.',
                    'በተፈረመ የተጠቃሚ መለያ የተጠበቀ የአገልጋይ/ሎካል-ኢንጂን ግብይት ጥበቃ።'
                  )}
                </td>
              </tr>
              <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                <td className="py-3 px-4 font-semibold text-[#0F233A] dark:text-slate-100">
                  {biText(locale, 'Immutable Audit Trail', 'የማይለወጥ የኦዲት መዝገብ')}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {biText(
                    locale,
                    'Append-only browser state array with zero edit/delete actions.',
                    'መቀየር ወይም መሰረዝ የማይቻልባቸው የአሳሽ መዝገቦች።'
                  )}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {biText(
                    locale,
                    'Append-only tamper-evident local database ledger with backup verification.',
                    'ምትኬው የተረጋገጠና መበላሸትን የሚያጋልጥ ሎካል ዳታቤዝ መዝገብ።'
                  )}
                </td>
              </tr>
              <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                <td className="py-3 px-4 font-semibold text-[#0F233A] dark:text-slate-100">
                  {biText(
                    locale,
                    'Banking, SMS, Email, E-Filing, Storage',
                    'ባንክ፣ ኤስኤምኤስ፣ ኢሜይል፣ ኢ-ፋይሊንግ'
                  )}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {biText(
                    locale,
                    'Explicitly excluded — placeholders and printable DEMO previews only.',
                    'በግልጽ ተለይተው የቀሩ — ምትኮችና የሚታተሙ DEMO ቅድመ-ዕይታዎች ብቻ።'
                  )}
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  {biText(
                    locale,
                    'Offline / local-first office architecture; external connectors out of scope unless separately authorized.',
                    'ከመስመር ውጭ / ሎካል-ፈርስት የቢሮ ሥርዓት፤ የውጭ ግንኙነቶች ለብቻው ፈቃድ ያስፈልጋቸዋል።'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-[#F8FAFC] dark:bg-[#152236] border-t border-[#DFE5EE] dark:border-[#233349] flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-[#166549] dark:text-emerald-400 shrink-0" />
          <span>
            {biText(
              locale,
              'Compliance Readiness and Record Retention controls remain strictly simulated until licensed Ethiopian tax, legal, and accounting professionals sign off on all blocking gates.',
              'የተገዢነት ዝግጁነትና የመዝገብ ማቆያ ቁጥጥሮች ፈቃድ ያላቸው የኢትዮጵያ የታክስ፣ የሕግና የሂሳብ ባለሙያዎች ሁሉንም በሮች እስኪያጸድቁ ድረስ በማስመሰያነት ይቆያሉ።'
            )}
          </span>
        </div>
      </section>

      <RecordRetentionMatrix />
    </div>
  );
};
