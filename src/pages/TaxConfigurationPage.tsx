import React, { useEffect, useMemo, useState } from 'react';
import { GitCompare, Lock, Plus, Send, ShieldAlert } from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { checkActionPermission } from '../policies/rbac';
import { TaxLifecycleStage, TaxRuleRecord } from '../types/prms';
import { DocumentUploadField, UploadedEvidenceFile } from '../components/ui/DocumentUploadField';
import { TaxAndAttachmentSamples } from '../components/tax/TaxAndAttachmentSamples';
import {
  RulesRegisterPacksTab,
  TaxCalendarEInvoiceTab,
  WorkpaperStudioTab,
} from '../components/tax/TaxWorkpaperStudio';
import { EmptyState, GovernanceCallout, Modal, StatusLabel } from '../components/ui/Primitives';
import { RequireAuth } from '../components/auth/RequireAuth';
import { ErcaGateStatus, fetchErcaGateStatus } from '../services/productionApiClient';

const LIFECYCLE_STEPS: TaxLifecycleStage[] = [
  'Draft',
  'Submitted for Review',
  'Adviser Confirmed',
  'Owner Approved',
  'Active',
];

type TaxViewTab =
  | 'drafts'
  | 'workpapers'
  | 'register-packs'
  | 'calendar-einv'
  | 'approved-empty'
  | 'sample-forms';

export const TaxConfigurationPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    ownerTaxRules,
    createTaxDraft,
    submitTaxForApproval,
    logSimulatedEvent,
    locale,
    trStatus,
    labels,
  } = usePrms();

  const [viewTab, setViewTab] = useState<TaxViewTab>('drafts');
  const [draftOpen, setDraftOpen] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<TaxRuleRecord | null>(null);
  const [compareTarget, setCompareTarget] = useState<TaxRuleRecord | null>(null);
  const [ercaTinFile, setErcaTinFile] = useState<UploadedEvidenceFile | null>(null);
  const [vatCertFile, setVatCertFile] = useState<UploadedEvidenceFile | null>(null);
  const [ercaGate, setErcaGate] = useState<ErcaGateStatus | null>(null);

  useEffect(() => {
    let active = true;
    void fetchErcaGateStatus(activeOwner.id).then((status) => {
      if (active) setErcaGate(status);
    });
    return () => {
      active = false;
    };
  }, [activeOwner.id]);

  const [draftForm, setDraftForm] = useState({
    code: 'SYNTH-TAX-PLACEHOLDER-NEW',
    taxCategory: 'Synthetic Rental Tax Placeholder',
    propertyUseClassification: 'Mixed-Use (Unclassified)' as TaxRuleRecord['propertyUseClassification'],
    ownerEntityCategory: activeOwner.entityType,
    taxableStatus: 'Undetermined' as TaxRuleRecord['taxableStatus'],
    effectiveDateFrom: 'Pending Adviser',
    effectiveDateTo: 'Undetermined',
    sourceReference: 'Income Tax Amendment Proclamation No. 1395/2025 (Unverified)',
    adviserEvidence: 'Unverified — Ethiopian licensed adviser confirmation required.',
    notes: 'Rate pending adviser confirmation. Active state disabled in prototype.',
  });

  const [submitForm, setSubmitForm] = useState({
    evidenceRef: 'EVD-TAX-REVIEW-SIM',
    reason: 'Submit synthetic tax draft for maker-checker review simulation (will not activate rule).',
  });

  const canDraft = checkActionPermission(currentPersona.role, 'draft_tax_rule');
  const canRequest = checkActionPermission(currentPersona.role, 'request_tax_review');

  const handleCreateDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftForm.code.trim() || !draftForm.taxCategory.trim()) return;
    if (createTaxDraft(draftForm)) {
      setDraftOpen(false);
    }
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTarget || !submitForm.evidenceRef.trim()) return;
    if (submitTaxForApproval(submitTarget.id, submitForm.evidenceRef.trim(), submitForm.reason)) {
      setSubmitTarget(null);
    }
  };

  const compareVersions = useMemo(() => {
    if (!compareTarget) return null;
    const latest = compareTarget.versions[0];
    const prev = compareTarget.versions[1] || compareTarget.versions[0];
    return { latest, prev };
  }, [compareTarget]);

  return (
    <RequireAuth section="tax">
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          'No Active Ethiopian Tax Rules — External Professional Evidence & Owner Approval Required',
          'ንቁ የኢትዮጵያ የታክስ ሕግ የለም — የውጭ ባለሙያ ማስረጃና የባለቤት ፈቃድ ያስፈልጋል'
        )}
        description={biText(
          locale,
          "Tax configuration lifecycle is Draft → Submitted for Review → Adviser Confirmed → Owner Approved → Active. In this prototype, 'Active' is permanently disabled and unavailable. Workpaper comparisons below are draft calculators only; no live tax filing exists.",
          "የታክስ ደንብ ዑደት፡ ረቂቅ → ለግምገማ የቀረበ → በአማካሪ የተረጋገጠ → በባለቤት የጸደቀ → ንቁ (Active) ነው። በዚህ ፕሮቶታይፕ ውስጥ 'ንቁ (Active)' በቋሚነት ተዘግቷል።"
        )}
        variant="restricted"
        controlType="Production Boundary"
        action={
          <button
            type="button"
            disabled={!canDraft.allowed}
            title={canDraft.reason}
            onClick={() => setDraftOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#1A314E] dark:hover:bg-[#234066] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{biText(locale, 'New Tax Research Draft', 'አዲስ የታክስ ጥናት ረቂቅ')}</span>
          </button>
        }
      />

      {/* Lifecycle Diagram Strip */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs font-semibold text-[#0F233A] dark:text-slate-100">
            {biText(
              locale,
              'Required Tax Configuration Lifecycle (Active State Disabled in Prototype)',
              'የሚፈለገው የታክስ ደንብ የሕይወት ዑደት (ንቁ ደረጃ በፕሮቶታይፕ ውስጥ ተዘግቷል)'
            )}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {biText(
              locale,
              'External professional evidence + owner approval required before activation',
              'ከመንቃቱ በፊት የውጭ ባለሙያ ማስረጃ + የባለቤት ማጽደቅ ያስፈልጋል'
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const isLocked = step === 'Active';
            return (
              <div
                key={step}
                className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2 ${
                  isLocked
                    ? 'border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200 opacity-90'
                    : 'border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] text-slate-800 dark:text-slate-200'
                }`}
              >
                <span className="font-medium truncate">
                  {idx + 1}. {trStatus(step)}
                </span>
                {isLocked && (
                  <Lock className="w-3.5 h-3.5 shrink-0 text-red-700 dark:text-red-400" />
                )}
              </div>
            );
          })}
        </div>

        {/* ERCA Production Activation Gate Checklist */}
        <div className="mt-4 pt-4 border-t border-[#DFE5EE] dark:border-[#233349] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                'ERCA & Licensed Adviser Production Activation Gate (Locked Until Verified)',
                'የERCA እና ፈቃድ ያለው የታክስ አማካሪ የማንቂያ መስፈርት (እስኪረጋገጥ ተዘግቷል)'
              )}
            </p>
            <span className="text-[11px] font-mono text-red-700 dark:text-red-300">
              {ercaGate?.live_tax_enabled ? 'ENABLE_LIVE_TAX_INVOICING=True' : 'ENABLE_LIVE_TAX_INVOICING=False'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DocumentUploadField
              entityType="ERCA_CERT"
              entityRefId={`${activeOwner.id}-TIN`}
              ownerId={activeOwner.id}
              label={biText(locale, '1. ERCA TIN Registration Certificate', '1. የERCA TIN ምዝገባ የምስክር ወረቀት')}
              value={ercaTinFile}
              onChange={setErcaTinFile}
            />
            <DocumentUploadField
              entityType="ERCA_CERT"
              entityRefId={`${activeOwner.id}-VAT`}
              ownerId={activeOwner.id}
              label={biText(locale, '2. VAT Registration & Tax Adviser Sign-Off Pack', '2. የVAT ምዝገባ እና የታክስ አማካሪ ማረጋገጫ')}
              value={vatCertFile}
              onChange={setVatCertFile}
            />
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFF5] dark:bg-[#152236] rounded-xl">
          <button
            type="button"
            onClick={() => setViewTab('drafts')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              viewTab === 'drafts'
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
            }`}
          >
            {biText(locale, 'Draft & Review Placeholders', 'ረቂቅና የግምገማ ምትኮች')} ({ownerTaxRules.length})
          </button>
          <button
            type="button"
            onClick={() => setViewTab('workpapers')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              viewTab === 'workpapers'
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
            }`}
          >
            {biText(locale, 'Workpaper Studio (Books vs Flat)', 'የታክስ የስራ ወረቀት')}
          </button>
          <button
            type="button"
            onClick={() => setViewTab('register-packs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              viewTab === 'register-packs'
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
            }`}
          >
            {biText(locale, 'Rules Register (21) & Packs', 'የታክስ ሕጎች (21)')}
          </button>
          <button
            type="button"
            onClick={() => setViewTab('calendar-einv')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              viewTab === 'calendar-einv'
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
            }`}
          >
            {biText(locale, 'Tax Calendar & 1142 E-Invoice', 'የታክስ ቀን መቁጠሪያ')}
          </button>
          <button
            type="button"
            onClick={() => setViewTab('approved-empty')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              viewTab === 'approved-empty'
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
            }`}
          >
            {biText(locale, 'Active Production Tax Rules (0)', 'ንቁ የምርት ታክስ ሕጎች (0)')}
          </button>
          <button
            type="button"
            data-testid="tab-tax-sample-forms"
            onClick={() => setViewTab('sample-forms')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              viewTab === 'sample-forms'
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
            }`}
          >
            {biText(
              locale,
              'Tax Form (OBR 1301) & Cash Attachment',
              'የግብር ቅጽ (OBR 1301) እና የCASH አባሪ'
            )}
          </button>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          {biText(
            locale,
            'Research conflict flagged on withholding applicability & filing deadlines',
            'በተቀናሽ ታክስ (Withholding) እና በማሳወቂያ ቀነ-ገደብ ላይ የጥናት ግጭት ተመዝግቧል'
          )}
        </span>
      </div>

      {viewTab === 'workpapers' && <WorkpaperStudioTab />}
      {viewTab === 'register-packs' && <RulesRegisterPacksTab />}
      {viewTab === 'calendar-einv' && <TaxCalendarEInvoiceTab />}

      {/* Empty State for Zero Approved / Active Tax Rules */}
      {viewTab === 'approved-empty' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-6 shadow-xs">
          <EmptyState
            title={biText(
              locale,
              `No Approved or Active Tax Configuration for ${activeOwner.name}`,
              `ለ ${activeOwner.name} የጸደቀ ወይም ንቁ የታክስ ውቅር የለም`
            )}
            description={biText(
              locale,
              'Active tax configuration is disabled in this prototype. Production activation requires verified Ethiopian primary tax evidence, licensed adviser sign-off, and formal owner approval.',
              'በዚህ ፕሮቶታይፕ ውስጥ ንቁ የታክስ ውቅር ተዘግቷል። ወደ ምርት ለማስገባት የተረጋገጠ የኢትዮጵያ የታክስ ሕግ ማስረጃ፣ የባለሙያ ፊርማና የባለቤት ማጽደቅ ያስፈልጋል።'
            )}
            action={
              <button
                type="button"
                onClick={() => setViewTab('drafts')}
                className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-[#0F233A] dark:text-slate-100 cursor-pointer"
              >
                {biText(locale, 'Return to Non-Active Drafts', 'ወደ ንቁ ያልሆኑ ረቂቆች ተመለስ')}
              </button>
            }
          />
        </section>
      )}

      {/* Tax Form (OBR 1301) & CASH Sales Attachment Samples */}
      {viewTab === 'sample-forms' && <TaxAndAttachmentSamples />}

      {/* Configured Placeholders Table */}
      {viewTab === 'drafts' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Code & Category', 'ኮድና ምድብ')}</th>
                  <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Property Use & Entity', 'የንብረት አጠቃቀምና ተቋም')}</th>
                  <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Taxable Status', 'የታክስ ሁኔታ')}</th>
                  <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Rate Field', 'የምጣኔ መስክ')}</th>
                  <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Effective Range', 'ተፈጻሚ ጊዜ')}</th>
                  <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Source & Evidence', 'ምንጭና ማስረጃ')}</th>
                  <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Owner Approval Ref', 'የባለቤት ማጽደቂያ')}</th>
                  <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Lifecycle', 'ደረጃ')}</th>
                  <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Actions', 'ተግባራት')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {ownerTaxRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 align-top transition-colors"
                  >
                    <td className="py-3 px-3 min-w-[190px]">
                      <p className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">
                        {rule.code} (v{rule.version})
                      </p>
                      <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {rule.taxCategory}
                      </p>
                      {rule.hasResearchConflict && (
                        <div className="mt-1.5">
                          <StatusLabel label="Research conflict" tone="red" />
                          <p className="text-[11px] text-red-800 dark:text-red-300 mt-1">
                            {rule.conflictNotice}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 min-w-[160px]">
                      <p className="text-slate-900 dark:text-slate-100 font-medium">
                        {rule.propertyUseClassification}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {rule.ownerEntityCategory}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <StatusLabel label={rule.taxableStatus} tone="amber" />
                    </td>
                    <td className="py-3 px-3 font-medium text-amber-900 dark:text-amber-300 min-w-[150px]">
                      {rule.ratePlaceholder}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {rule.effectiveDateFrom} → {rule.effectiveDateTo}
                    </td>
                    <td className="py-3 px-3 min-w-[210px]">
                      <p className="text-slate-800 dark:text-slate-200">{rule.sourceReference}</p>
                      <p className="text-[11px] text-amber-900 dark:text-amber-300 font-medium mt-0.5">
                        {biText(locale, 'Adviser:', 'አማካሪ:')} {rule.adviserEvidence}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {rule.ownerApprovalReference}
                    </td>
                    <td className="py-3 px-3">
                      <StatusLabel label={rule.lifecycleStage} />
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap space-y-1.5">
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setCompareTarget(rule);
                            logSimulatedEvent(
                              'Tax Configuration',
                              'Compared Tax Draft Versions',
                              'TaxRule',
                              rule.id,
                              `Inspected version comparison for ${rule.code}.`
                            );
                          }}
                          className="text-xs font-semibold text-[#0F233A] dark:text-slate-200 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          <span>{biText(locale, 'Compare versions', 'እትሞችን አነጻጽር')}</span>
                        </button>
                      </div>
                      {rule.lifecycleStage === 'Draft' && (
                        <div>
                          <button
                            type="button"
                            disabled={!canRequest.allowed}
                            title={canRequest.reason}
                            onClick={() => setSubmitTarget(rule)}
                            className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{biText(locale, 'Submit for Review', 'ለግምገማ አቅርብ')}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Clearly Separated Research Reference Panel */}
      <section className="bg-[#F8FAFC] dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, 'Research reference — not configured', 'የጥናት ማጣቀሻ — አልተዋቀረም')}
          </h2>
          <span className="text-xs font-semibold text-amber-900 dark:text-amber-300">
            Unverified — Ethiopian licensed adviser confirmation required.
          </span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {biText(
            locale,
            'Any statutory rates, thresholds, withholding rules, or filing calendars discussed in Ethiopian tax research (such as Income Tax Amendment Proclamation No. 1395/2025, VAT Proclamation No. 1341/2024, VAT Regulation No. 570/2025, or Directive 1142/2026 e-invoice notes) are tracked outside active billing logic until formally activated.',
            'በኢትዮጵያ የታክስ ጥናት ውስጥ የተጠቀሱ ምጣኔዎች፣ ገደቦች፣ የተቀናሽ ታክስ (Withholding) ደንቦች ወይም የማሳወቂያ ቀነ-ገደቦች ከንቁ የክፍያ ሥርዓት ውጭ ይከታተላሉ።'
          )}
        </p>
      </section>

      {/* Compare Versions Modal */}
      <Modal
        open={Boolean(compareTarget)}
        onClose={() => setCompareTarget(null)}
        title={compareTarget ? `${biText(locale, 'Compare Versions', 'እትሞችን አነጻጽር')} — ${compareTarget.code}` : ''}
        subtitle={biText(
          locale,
          'Read-only before/after version comparison. Activation is disabled in this prototype.',
          'ለንባብ ብቻ የሆነ የበፊት/የኋላ እትም ንጽጽር። ማንቃት በዚህ ፕሮቶታይፕ ተዘግቷል።'
        )}
        maxWidth="max-w-2xl"
      >
        {compareTarget && compareVersions && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-[#FDF8EC] dark:bg-amber-950/40 border border-[#E5C983] dark:border-amber-700/60 text-amber-950 dark:text-amber-200">
              {biText(
                locale,
                'No activation control is present here. Moving to Active requires external professional evidence and formal owner approval outside this prototype.',
                'እዚህ ምንም የማንቂያ ቁልፍ የለም። ወደ ንቁ (Active) ደረጃ ለማሸጋገር ከዚህ ፕሮቶታይፕ ውጭ የባለሙያ ማስረጃና የባለቤት ፈቃድ ያስፈልጋል።'
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3.5 bg-[#F8FAFC] dark:bg-[#152236] space-y-1.5 text-slate-800 dark:text-slate-200">
                <p className="font-bold">Before (v{compareVersions.prev.version})</p>
                <p>Lifecycle: {trStatus(compareVersions.prev.lifecycleStage)}</p>
                <p>Rate Field: {compareVersions.prev.ratePlaceholder}</p>
                <p className="text-slate-600 dark:text-slate-400">{compareVersions.prev.note}</p>
              </div>
              <div className="border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg p-3.5 bg-white dark:bg-[#111C2C] space-y-1.5 text-slate-800 dark:text-slate-200">
                <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">Current (v{compareVersions.latest.version})</p>
                <p>Lifecycle: {trStatus(compareVersions.latest.lifecycleStage)}</p>
                <p>Rate Field: {compareVersions.latest.ratePlaceholder}</p>
                <p className="text-slate-600 dark:text-slate-400">{compareVersions.latest.note}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* New Draft Modal */}
      <Modal
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        title={biText(locale, 'Create Tax Research Draft (Non-Active)', 'ንቁ ያልሆነ የታክስ ጥናት ረቂቅ ፍጠር')}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateDraft} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Rule Code *</label>
              <input
                required
                value={draftForm.code}
                onChange={(e) => setDraftForm({ ...draftForm, code: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Tax Category *</label>
              <input
                required
                value={draftForm.taxCategory}
                onChange={(e) => setDraftForm({ ...draftForm, taxCategory: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDraftOpen(false)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
              {labels.cancel}
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0F233A] text-white font-semibold cursor-pointer">
              Save Non-Active Draft
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Review Modal */}
      <Modal
        open={Boolean(submitTarget)}
        onClose={() => setSubmitTarget(null)}
        title={biText(locale, 'Submit Tax Draft for Review Simulation', 'የታክስ ረቂቁን ለግምገማ ማስመሰያ አቅርብ')}
      >
        {submitTarget && (
          <form onSubmit={handleSubmitReview} className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349]">
              <p className="font-mono font-semibold">{submitTarget.code}</p>
            </div>
            <div>
              <label className="font-semibold block mb-1">Evidence Reference *</label>
              <input
                required
                value={submitForm.evidenceRef}
                onChange={(e) => setSubmitForm({ ...submitForm, evidenceRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setSubmitTarget(null)} className="px-3.5 py-2 rounded-lg border cursor-pointer">
                {labels.cancel}
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#166549] text-white font-semibold cursor-pointer">
                Submit for Review Simulation
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
    </RequireAuth>
  );
};
