import React, { useState } from 'react';
import { CheckCircle2, HardDriveDownload, ShieldCheck } from 'lucide-react';
import { usePrms } from '../context/PrmsContext';
import { biText } from '../data/i18n';
import { checkActionPermission } from '../policies/rbac';
import { GovernanceCallout, Modal, StatusLabel } from '../components/ui/Primitives';

export const BackupRecoveryPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    locale,
    fmtDate,
    fmtEtb,
    ownerBackupPolicies,
    ownerBackupDrills,
    ownerBackupManifest,
    requestBackupDrill,
    completeApprovedBackupDrill,
  } = usePrms();

  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillForm, setDrillForm] = useState({
    drillScope: `Offline local-first snapshot verification drill (${activeOwner.code})`,
    evidenceRef: 'EVD-BKP-DRILL-SYNTH',
  });

  const canRequest = checkActionPermission(currentPersona.role, 'request_backup_drill');

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drillForm.drillScope.trim() || !drillForm.evidenceRef.trim()) return;
    if (requestBackupDrill(drillForm)) {
      setDrillModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          `Backup & Recovery Readiness (Offline / Local-First Policy Simulation) — ${activeOwner.name}`,
          `የምትኬ እና መልሶ ማግኛ ዝግጁነት (የአካባቢያዊ-ቅድሚያ ማስመሰያ) — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          'Simulated continuity and restore-drill planning only. RPO/RTO targets shown here are Draft — Unapproved and require owner architecture sign-off. No real disk backup, cloud sync, or database restore executes.',
          'ይህ የምትኬ እና የመልሶ ማግኛ ልምምድ ማስመሰያ ብቻ ነው። የቀረቡት RPO/RTO ግቦች ያልጸደቁ ረቂቆች ናቸው። ትክክለኛ የውሂብ ምትኬ ወይም ክላውድ ዝውውር አይደረግም።'
        )}
        variant="warning"
        controlType="Production Boundary"
        action={
          <button
            type="button"
            disabled={!canRequest.allowed}
            title={canRequest.reason}
            onClick={() => setDrillModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#1A314E] dark:hover:bg-[#234066] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Request Restore Drill Approval', 'የመልሶ ማግኛ ልምምድ ፍቃድ ጠይቅ')}</span>
          </button>
        }
      />

      <section className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
        <p className="font-semibold text-[#0F233A] dark:text-slate-100">
          {biText(
            locale,
            'Complete Production Recovery Set & Reconciled Restore Verification',
            'የምርት ስርዓት ሙሉ የመልሶ ማግኛ ስብስብ እና የሂሳብ ማረጋገጫ'
          )}
        </p>
        <p>
          {biText(
            locale,
            'Production disaster recovery pairs encrypted PostgreSQL snapshots with encrypted document/object-storage archives, JSON integrity manifests (recording key IDs without embedding secrets), and automated post-restore reconciliation of Trial Balance, DepositMovement subledger, GL 2120, document hashes, and SHA-256 audit chains.',
            'በምርት ስርዓቱ ውስጥ የተመሰጠሩ የPostgreSQL ምትኬዎች፣ የተመሰጠሩ የሰነድ ክምችቶች፣ ሚስጥራዊ ቁልፎችን የማይይዙ የማኒፌስት መዝገቦች እና ከመልሶ ማግኛ በኋላ የTrial Balance እና የኦዲት ሰንሰለት ማረጋገጫ በጋራ ይሰራሉ።'
          )}
        </p>
      </section>

      {/* Unapproved RPO / RTO Draft Policies */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ownerBackupPolicies.map((pol) => (
          <div
            key={pol.id}
            className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-3 shadow-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-slate-500 dark:text-[#E5B85C]">
                  {pol.policyCode}
                </p>
                <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100 mt-0.5">
                  {pol.scheduleLabel}
                </h2>
              </div>
              <StatusLabel label={pol.approvalStatus} />
            </div>
            <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 text-xs">
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Proposed RPO Target', 'የታቀደ RPO ግብ')}
                </p>
                <p className="font-mono font-semibold text-amber-900 dark:text-amber-300 mt-0.5">
                  {pol.rpoPlaceholder}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Proposed RTO Target', 'የታቀደ RTO ግብ')}
                </p>
                <p className="font-mono font-semibold text-amber-900 dark:text-amber-300 mt-0.5">
                  {pol.rtoPlaceholder}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {pol.storageNote}
            </p>
          </div>
        ))}
      </section>

      {/* 8-Point Restore Integrity Verification Manifest */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 shadow-xs space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                `8-Point Restore Integrity Verification Manifest (${ownerBackupManifest.ownerId})`,
                `ባለ 8 ነጥብ የመልሶ ማግኛ ትክክለኛነት ማረጋገጫ (${ownerBackupManifest.ownerId})`
              )}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {ownerBackupManifest.journalCount} journals · Dr {fmtEtb(ownerBackupManifest.totalDebitsCents / 100)} == Cr {fmtEtb(ownerBackupManifest.totalCreditsCents / 100)} · Last Closed {ownerBackupManifest.lastClosedPeriodCode} · Audit {ownerBackupManifest.latestAuditChainId}
            </p>
          </div>
          <StatusLabel
            label={ownerBackupManifest.allPassed ? 'Balanced' : 'Exception'}
            tone={ownerBackupManifest.allPassed ? 'green' : 'red'}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {ownerBackupManifest.checks.map((chk) => (
            <div
              key={chk.id}
              className={`rounded-lg border p-3 ${
                chk.passed
                  ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-red-200 dark:border-red-800/70 bg-red-50/40 dark:bg-red-950/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#0F233A] dark:text-slate-100">
                  {chk.id}. {chk.label}
                </span>
                <StatusLabel label={chk.passed ? 'Balanced' : 'Exception'} tone={chk.passed ? 'green' : 'red'} />
              </div>
              <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400 mt-1">{chk.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Restore Drills Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
          <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Simulated Restore-Drill Register & Checklists', 'የመልሶ ማግኛ ልምምድ መዝገብ')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {biText(
              locale,
              'Two-Step approval required (General Manager Review -> Owner / Director Authorization) before simulated drill completion.',
              'ልምምዱን ከማጠናቀቅ በፊት ባለ ሁለት ደረጃ ማጽደቂያ (GM -> ባለቤት) ያስፈልጋል።'
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Drill #', 'ልምምድ #')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Scope & Checklist', 'ወሰን እና ማረጋገጫ')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Requested', 'የተጠየቀበት ቀን')}</th>
                <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Action', 'እርምጃ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {ownerBackupDrills.map((dr) => (
                <tr
                  key={dr.id}
                  className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 align-top transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                    <p>{dr.drillNumber}</p>
                    <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      {dr.evidenceRef}
                    </p>
                  </td>
                  <td className="py-3 px-4 space-y-1.5">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {dr.drillScope}
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                      {dr.evidenceChecklist.map((chk, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <ShieldCheck
                            className={`w-3.5 h-3.5 shrink-0 ${
                              chk.checked
                                ? 'text-[#166549] dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          />
                          <span>{chk.label}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {fmtDate(dr.requestedDate)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusLabel label={dr.status} />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {dr.status === 'Approved Drill (Sim)' ? (
                      <button
                        type="button"
                        onClick={() => completeApprovedBackupDrill(dr.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{biText(locale, 'Complete Drill (Sim)', 'ልምምድ አጠናቅቅ')}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {dr.status === 'Completed (Sim)'
                          ? biText(locale, 'Evidence Logged', 'ማስረጃ ተመዝግቧል')
                          : biText(locale, 'Awaiting Two-Step Approval', 'ባለ ሁለት ደረጃ ማጽደቂያ ይጠብቃል')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        title={biText(locale, 'Request Restore-Drill Authorization', 'የመልሶ ማግኛ ልምምድ ፈቃድ ጥያቄ')}
        subtitle={biText(
          locale,
          'Simulated two-step approval workflow (GM + Owner). No live snapshot executes.',
          'ባለ ሁለት ደረጃ ማጽደቂያ (GM + ባለቤት)። ትክክለኛ የውሂብ ምትኬ አይሰራም።'
        )}
      >
        <form onSubmit={handleRequest} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Simulated Drill Scope *', 'የልምምዱ ወሰን *')}
            </label>
            <textarea
              required
              rows={2}
              value={drillForm.drillScope}
              onChange={(e) => setDrillForm({ ...drillForm, drillScope: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Checksum / Manifest Ref *', 'የማረጋገጫ ሰነድ ቁጥር *')}
            </label>
            <input
              required
              value={drillForm.evidenceRef}
              onChange={(e) => setDrillForm({ ...drillForm, evidenceRef: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDrillModalOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] cursor-pointer"
            >
              {biText(locale, 'Cancel', 'ሰርዝ')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#166549] dark:hover:bg-[#12533B] text-white font-semibold cursor-pointer transition-colors"
            >
              {biText(locale, 'Submit to Approvals Centre', 'ወደ ማጽደቂያ ማዕከል ላክ')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
