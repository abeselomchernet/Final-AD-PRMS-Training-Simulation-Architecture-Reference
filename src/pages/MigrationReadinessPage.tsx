import React, { useState } from 'react';
import { AlertTriangle, FileInput } from 'lucide-react';
import { usePrms } from '../context/PrmsContext';
import { biText } from '../data/i18n';
import { checkActionPermission } from '../policies/rbac';
import { GovernanceCallout, Modal, StatusLabel } from '../components/ui/Primitives';

export const MigrationReadinessPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    locale,
    fmtEtb,
    ownerMigrationBatches,
    ownerMigrationMappings,
    requestMigrationExceptionApproval,
  } = usePrms();

  const [exceptionBatchId, setExceptionBatchId] = useState<string | null>(null);
  const [comment, setComment] = useState(
    'Submitting synthetic migration exception for maker-checker review (no real production import).'
  );

  const canSubmit = checkActionPermission(currentPersona.role, 'request_migration_exception');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionBatchId) return;
    if (requestMigrationExceptionApproval(exceptionBatchId, comment)) {
      setExceptionBatchId(null);
    }
  };

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          `Migration & Opening-Balance Staging Readiness — ${activeOwner.name}`,
          `የውሂብ ሽግግር እና የመነሻ ሚዛን ዝግጁነት — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          'Synthetic staging register, field mapping rules, control-total placeholders, and exception approval queue only. Real historical data import and opening-balance posting remain strictly disabled pending signed owner/adviser cutover gates.',
          'ይህ የሙከራ የውሂብ ሽግግር መዝገብ፣ የመስክ ማዛመጃ እና የስህተት ማጽደቂያ ማስመሰያ ብቻ ነው። ትክክለኛ የቀድሞ ውሂብ ማስገባት ታግዷል።'
        )}
        variant="restricted"
        controlType="Production Boundary"
      />

      {/* Staging Batches & Control Totals */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Synthetic Staging Batches & Control-Total Placeholders', 'የሙከራ የውሂብ ሽግግር ስብስቦች')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {biText(
                locale,
                'No live CSV ingestion or production ledger import occurs.',
                'ትክክለኛ የፋይል መጫን ወይም የሂሳብ መዝገብ ማስገባት አይሰራም።'
              )}
            </p>
          </div>
          <FileInput className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Batch Code', 'የስብስብ ኮድ')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Source Entity', 'ምንጭ አካል')}</th>
                <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Records (Sim)', 'የመዝገብ ብዛት')}</th>
                <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Control Total', 'ጠቅላላ መቆጣጠሪያ')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Validation & Exception', 'ማረጋገጫ እና ስህተት')}</th>
                <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Action', 'እርምጃ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerMigrationBatches.map((b) => (
                <tr
                  key={b.id}
                  className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 align-top transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                    <p>{b.batchCode}</p>
                    <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      {b.evidenceRef}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{b.sourceEntity}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">
                    {b.recordCountPlaceholder}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-900 dark:text-slate-100">
                    {fmtEtb(b.controlTotalEtbPlaceholder)}
                  </td>
                  <td className="py-3 px-4 space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusLabel label={b.validationState} />
                      <StatusLabel label={b.approvalStatus} />
                    </div>
                    {b.exceptionDetail && (
                      <p className="text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                        <span>{b.exceptionDetail}</span>
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {b.approvalStatus === 'Not Approved' ? (
                      <button
                        type="button"
                        disabled={!canSubmit.allowed}
                        title={canSubmit.reason}
                        onClick={() => setExceptionBatchId(b.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#166549] dark:hover:bg-[#12533B] text-white font-semibold disabled:opacity-40 cursor-pointer transition-colors"
                      >
                        {biText(locale, 'Submit Exception', 'ልዩነት አስገባ')}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {b.approvalStatus}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mapping & Validation Rules */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
          <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Source-to-Target Field Mapping & Validation Rules', 'የመስክ ማዛመጃ እና የማረጋገጫ ህጎች')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Legacy Source Field', 'የቀድሞ መስክ')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'AD-PRMS Target', 'የAD-PRMS መድረሻ')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Validation Rule', 'የማረጋገጫ ህግ')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Mapping Status', 'ሁኔታ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerMigrationMappings.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                    {m.sourceField}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                    {m.targetEntity}.{m.targetField}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {m.validationRule}
                  </td>
                  <td className="py-3 px-4">
                    <StatusLabel label={m.mappingStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(exceptionBatchId)}
        onClose={() => setExceptionBatchId(null)}
        title={biText(locale, 'Submit Migration Exception for Approval', 'የሽግግር ልዩነት ለማጽደቅ አስገባ')}
        subtitle={biText(
          locale,
          'Simulated approval workflow only — zero production data import.',
          'የማጽደቂያ ማስመሰያ ብቻ — ምንም ትክክለኛ ውሂብ አይጫንም።'
        )}
      >
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Exception Justification *', 'የልዩነቱ ማብራሪያ *')}
            </label>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setExceptionBatchId(null)}
              className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] cursor-pointer"
            >
              {biText(locale, 'Cancel', 'ሰርዝ')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#166549] dark:hover:bg-[#12533B] text-white font-semibold cursor-pointer transition-colors"
            >
              {biText(locale, 'Submit Exception Request', 'ጥያቄ አስገባ')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
