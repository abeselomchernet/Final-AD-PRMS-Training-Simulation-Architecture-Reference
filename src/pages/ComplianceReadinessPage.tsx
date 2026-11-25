import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  FileCheck2,
  Lock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { checkActionPermission } from '../policies/rbac';
import {
  AdviserReviewQuestion,
  EvidenceStatusType,
  ProductionGateItem,
  ResearchRequirementRecord,
  SourceRecordCard,
} from '../types/prms';
import { RecordRetentionMatrix } from '../components/compliance/RecordRetentionMatrix';
import {
  EmptyState,
  GovernanceCallout,
  Modal,
  SlideDrawer,
  StatusLabel,
} from '../components/ui/Primitives';

type ComplianceTab = 'register' | 'sources' | 'adviser' | 'gates';

const EVIDENCE_FILTERS: ('All' | EvidenceStatusType)[] = [
  'All',
  'Primary source identified',
  'Secondary source only',
  'Conflicting research',
  'Adviser confirmation required',
  'Owner decision required',
];

export const ComplianceReadinessPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    ownerResearchRequirements,
    ownerSourceRecords,
    ownerAdviserQuestions,
    ownerProductionGates,
    prepareAdviserPack,
    submitAdviserForOwnerDecision,
    logSimulatedEvent,
    notify,
    locale,
    trStatus,
    labels,
  } = usePrms();

  const [tab, setTab] = useState<ComplianceTab>('register');
  const [evidenceFilter, setEvidenceFilter] = useState<'All' | EvidenceStatusType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshingScan, setIsRefreshingScan] = useState(false);

  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);

  const selectedReq: ResearchRequirementRecord | null = useMemo(
    () => ownerResearchRequirements.find((r) => r.id === selectedReqId) || null,
    [ownerResearchRequirements, selectedReqId]
  );
  const selectedSource: SourceRecordCard | null = useMemo(
    () => ownerSourceRecords.find((s) => s.id === selectedSourceId) || null,
    [ownerSourceRecords, selectedSourceId]
  );
  const selectedGate: ProductionGateItem | null = useMemo(
    () => ownerProductionGates.find((g) => g.id === selectedGateId) || null,
    [ownerProductionGates, selectedGateId]
  );

  const [actionModal, setActionModal] = useState<{
    mode: 'pack' | 'owner';
    question: AdviserReviewQuestion;
  } | null>(null);
  const [actionForm, setActionForm] = useState({
    evidenceRef: 'EVD-ADV-SIM-2026',
    notes: '',
  });

  const canPreparePack = checkActionPermission(currentPersona.role, 'prepare_adviser_pack');
  const canSubmitOwner = checkActionPermission(currentPersona.role, 'submit_owner_decision');

  const filteredRequirements = useMemo(() => {
    return ownerResearchRequirements.filter((r) => {
      if (evidenceFilter !== 'All' && r.evidenceStatus !== evidenceFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (
        q &&
        !r.requirementId.toLowerCase().includes(q) &&
        !r.topic.toLowerCase().includes(q) &&
        !r.proposedProductControl.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [ownerResearchRequirements, evidenceFilter, searchQuery]);

  const handleSimulatedGateCheck = () => {
    setIsRefreshingScan(true);
    setTimeout(() => {
      setIsRefreshingScan(false);
      logSimulatedEvent(
        'Compliance Readiness',
        'Production Gate Readiness Check (Simulated)',
        'ProductionGate',
        activeOwner.id,
        `Verified all ${ownerProductionGates.length} production readiness gates remain Blocked/Pending/Not Started.`
      );
      notify({
        tone: 'warning',
        title: biText(locale, 'Production Gate Status: Blocked', 'የምርት በር (Gate) ሁኔታ፡ የታገደ'),
        detail: biText(
          locale,
          `${ownerProductionGates.length} of ${ownerProductionGates.length} gates require external evidence and owner approval.`,
          `${ownerProductionGates.length} ከ ${ownerProductionGates.length} በሮች የውጭ ማስረጃና የባለቤት ፈቃድ ይጠይቃሉ።`
        ),
      });
    }, 350);
  };

  const handleAdviserModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal || !actionForm.evidenceRef.trim()) return;
    const ok =
      actionModal.mode === 'pack'
        ? prepareAdviserPack(
            actionModal.question.id,
            actionForm.evidenceRef.trim(),
            actionForm.notes.trim()
          )
        : submitAdviserForOwnerDecision(
            actionModal.question.id,
            actionForm.evidenceRef.trim(),
            actionForm.notes.trim()
          );
    if (ok) {
      setActionModal(null);
      setActionForm({ evidenceRef: 'EVD-ADV-SIM-2026', notes: '' });
    }
  };

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          'Compliance Readiness Workbench — Research & Gate Tracking Only',
          'የተገዢነት ዝግጁነት መድረክ — የጥናትና የምርት-በር መከታተያ ብቻ'
        )}
        description={biText(
          locale,
          'Research records, source summaries, and adviser questions track readiness for Ethiopian tax, accounting, invoicing, and retention controls. Nothing on this page activates legal, tax, or production rules.',
          'የጥናት መዝገቦች፣ የምንጭ ማጠቃለያዎችና የአማካሪ ጥያቄዎች ለኢትዮጵያ የታክስ፣ የሂሳብና የመዝገብ አያያዝ ዝግጁነትን ይከታተላሉ። በዚህ ገጽ ምንም ሕጋዊ ወይም የታክስ ደንብ ንቁ አይሆንም።'
        )}
        variant="restricted"
        controlType="Production Boundary"
        action={
          <button
            type="button"
            onClick={handleSimulatedGateCheck}
            disabled={isRefreshingScan}
            className="px-3.5 py-2 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#1A314E] dark:hover:bg-[#234066] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingScan ? 'animate-spin' : ''}`} />
            <span>
              {isRefreshingScan
                ? biText(locale, 'Checking Gates...', 'በመፈተሽ ላይ...')
                : biText(locale, 'Re-check Readiness Gates', 'የዝግጁነት በሮችን ፈትሽ')}
            </span>
          </button>
        }
      />

      {/* 4 Workbench Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFF5] dark:bg-[#152236] rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('register')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            tab === 'register'
              ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>
            {biText(locale, '1. Research Register', '1. የጥናት መዝገብ')} ({ownerResearchRequirements.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('sources')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            tab === 'sources'
              ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>
            {biText(locale, '2. Source & Evidence Review', '2. የምንጭና ማስረጃ ግምገማ')} ({ownerSourceRecords.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('adviser')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            tab === 'adviser'
              ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>
            {biText(locale, '3. Adviser Review Queue', '3. የአማካሪ ግምገማ ወረፋ')} ({ownerAdviserQuestions.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('gates')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            tab === 'gates'
              ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>
            {biText(locale, '4. Production Gate Checklist', '4. የምርት በር ማረጋገጫ ዝርዝር')} ({ownerProductionGates.length})
          </span>
        </button>
      </div>

      {/* Tab 1: Research Register */}
      {tab === 'register' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1F5F9] dark:bg-[#152236] rounded-xl">
              {EVIDENCE_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setEvidenceFilter(f)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    evidenceFilter === f
                      ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f === 'All' ? biText(locale, 'All', 'ሁሉም') : trStatus(f)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={biText(locale, 'Filter requirement ID or topic...', 'በመለያ ወይም በርዕስ ይፈልጉ...')}
              className="px-3 py-1.5 text-xs border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg w-full lg:w-64"
            />
          </div>

          <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
            {isRefreshingScan ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="h-10 bg-slate-100 dark:bg-[#162438] border border-[#DFE5EE] dark:border-[#233349] rounded-lg"
                  />
                ))}
              </div>
            ) : filteredRequirements.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={biText(locale, 'No Research Requirements Match Filter', 'ከተመረጠው ማጣሪያ ጋር የሚዛመድ መዝገብ የለም')}
                  description={biText(
                    locale,
                    'Reset the evidence status filter or search keyword to view all readiness requirements.',
                    'ሁሉንም የዝግጁነት መስፈርቶች ለማየት ማጣሪያውን ወይም የፍለጋ ቃሉን ያጽዱ።'
                  )}
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setEvidenceFilter('All');
                        setSearchQuery('');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      {labels.resetFilters}
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Requirement ID', 'የመስፈርት መለያ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Topic', 'ርዕስ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Proposed Product Control', 'የታቀደ የሥርዓት ቁጥጥር')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Evidence Status', 'የማስረጃ ሁኔታ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Source Type', 'የምንጭ ዓይነት')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Effective-Date Field', 'ተፈጻሚ ቀን መስክ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Adviser-Review Status', 'የአማካሪ ግምገማ ሁኔታ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Owner-Approval Status', 'የባለቤት ፈቃድ ሁኔታ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Production Activation', 'ወደ ምርት ማስገባት')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                    {filteredRequirements.map((req) => (
                      <tr
                        key={req.id}
                        onClick={() => setSelectedReqId(req.id)}
                        className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-[#0F233A] dark:text-[#E5B85C] whitespace-nowrap">
                          {req.requirementId}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 min-w-[150px]">
                          {req.topic}
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 min-w-[200px]">
                          {req.proposedProductControl}
                        </td>
                        <td className="py-3 px-3">
                          <StatusLabel label={req.evidenceStatus} />
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 min-w-[170px]">
                          {req.sourceType}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {req.effectiveDateField}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] font-medium text-amber-900 dark:text-amber-300">
                            {req.adviserReviewStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusLabel label={req.ownerApprovalStatus} />
                        </td>
                        <td className="py-3 px-3">
                          <StatusLabel label={req.productionActivationStatus} tone="red" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 2: Source & Evidence Review */}
      {tab === 'sources' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs">
            <div className="flex items-center gap-2 font-semibold text-[#0F233A] dark:text-slate-100">
              <Lock className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400 shrink-0" />
              <span>
                {biText(
                  locale,
                  `Showing research references for: ${activeOwner.name}`,
                  `የጥናት ማጣቀሻዎች የቀረቡት ለ፡ ${activeOwner.name}`
                )}
              </span>
            </div>
            <span className="font-mono text-slate-500 dark:text-slate-400">
              {ownerSourceRecords.length}{' '}
              {biText(
                locale,
                'owner-isolated source records · Research summaries only, not legal/tax approval',
                'በባለቤት የተለዩ የምንጭ መዝገቦች · የጥናት ማጠቃለያ ብቻ እንጂ ሕጋዊ/ታክስ ፈቃድ አይደለም'
              )}
            </span>
          </div>

          <GovernanceCallout
            title={biText(
              locale,
              'A source record supports research. It does not approve production configuration.',
              'የምንጭ መዝገብ ጥናትን ይደግፋል እንጂ የምርት ውቅርን አያጸድቅም።'
            )}
            description={biText(
              locale,
              'Source cards below are research summaries only, not legal or tax approval. Unverified items require formal confirmation from a licensed Ethiopian tax or legal adviser.',
              'ከታች ያሉት ካርዶች የጥናት ማጠቃለያዎች ብቻ ናቸው። ያልተረጋገጡ ነጥቦች በኢትዮጵያ ፈቃድ ባለው የታክስ ወይም የሕግ አማካሪ መረጋገጥ አለባቸው።'
            )}
            variant="warning"
            controlType="Production Boundary"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ownerSourceRecords.map((src) => (
              <div
                key={src.id}
                className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xs"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-[#E5B85C] block mb-0.5">
                        {src.id} · {activeOwner.name}
                      </span>
                      <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                        {src.title}
                      </h3>
                    </div>
                    <StatusLabel label={src.confidence} />
                  </div>
                  {src.unverifiedLabel && (
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 bg-[#FDF8EC] dark:bg-amber-950/40 border border-[#E5C983] dark:border-amber-700/60 rounded-lg px-2.5 py-1.5">
                      {src.unverifiedLabel}
                    </p>
                  )}
                  <dl className="grid grid-cols-2 gap-2.5 text-xs pt-1">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {biText(locale, 'Source Type', 'የምንጭ ዓይነት')}
                      </dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">
                        {src.sourceType}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {biText(locale, 'Publication Date Field', 'የታተመበት ቀን መስክ')}
                      </dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-100">
                        {src.publicationDateField}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {biText(locale, 'Verification Date Field', 'የተረጋገጠበት ቀን መስክ')}
                      </dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-100">
                        {src.verificationDateField}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {biText(locale, 'Reviewer', 'ገምጋሚ')}
                      </dt>
                      <dd className="text-slate-900 dark:text-slate-100">{src.reviewer}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {src.notes}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#1D2D42] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {biText(
                      locale,
                      'Research summary only · Not legal/tax approval',
                      'የጥናት ማጠቃለያ ብቻ · ሕጋዊ/ታክስ ፈቃድ አይደለም'
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSourceId(src.id);
                      logSimulatedEvent(
                        'Compliance Readiness',
                        'Viewed Source & Evidence Record (Simulated)',
                        'SourceRecordCard',
                        src.id,
                        `Inspected research summary "${src.title}" scoped to ${activeOwner.name} (${src.ownerId}).`
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-[#0F233A] dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    {biText(locale, 'View source record', 'የምንጭ መዝገብ ዕይ')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Adviser Review Queue */}
      {tab === 'adviser' && (
        <div className="space-y-4">
          <GovernanceCallout
            title={biText(
              locale,
              'Unresolved Ethiopian Tax, Legal & Accounting Questions',
              'ያልተፈቱ የኢትዮጵያ የታክስ፣ የሕግና የሂሳብ ጥያቄዎች'
            )}
            description={biText(
              locale,
              'Preparing an adviser pack or submitting for owner decision creates simulated approval requests and immutable audit events. It does NOT verify or activate any legal rule.',
              'የአማካሪ ሰነድ ማዘጋጀት ወይም ለባለቤት ውሳኔ ማቅረብ የማጽደቂያ ጥያቄና የኦዲት መዝገብ ይፈጥራል፤ ምንም ሕግ ግን አያጸድቅም።'
            )}
            controlType="Prototype Simulation"
          />

          <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold min-w-[230px]">{biText(locale, 'Unresolved Question', 'ያልተፈታ ጥያቄ')}</th>
                    <th className="py-2.5 px-4 font-semibold min-w-[180px]">{biText(locale, 'Impact', 'ተጽዕኖ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Risk', 'ስጋት')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Assigned Reviewer Placeholder', 'የተመደበ ገምጋሚ ምትክ')}</th>
                    <th className="py-2.5 px-4 font-semibold min-w-[180px]">{biText(locale, 'Evidence Required', 'የሚያስፈልግ ማስረጃ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Decision Due Placeholder', 'የውሳኔ ቀነ-ገደብ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Simulated Actions', 'የማስመሰያ ተግባራት')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {ownerAdviserQuestions.map((q) => (
                    <tr
                      key={q.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                          {q.question}
                        </p>
                        <p className="text-[11px] text-amber-900 dark:text-amber-300 mt-1">
                          {q.unverifiedNotice}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{q.impact}</td>
                      <td className="py-3 px-4">
                        <StatusLabel label={q.risk} />
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {q.assignedReviewerPlaceholder}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {q.evidenceRequired}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {q.decisionDueDatePlaceholder}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel label={q.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-y-1.5">
                        <div>
                          <button
                            type="button"
                            disabled={!canPreparePack.allowed}
                            title={canPreparePack.reason}
                            onClick={() => {
                              setActionModal({ mode: 'pack', question: q });
                              setActionForm({
                                evidenceRef: 'EVD-ADV-PACK-SIM',
                                notes: `Prepared briefing pack for: ${q.question}`,
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-[#0F233A] dark:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            {biText(locale, 'Prepare adviser pack', 'የአማካሪ ሰነድ አዘጋጅ')}
                          </button>
                        </div>
                        <div>
                          <button
                            type="button"
                            disabled={!canSubmitOwner.allowed}
                            title={canSubmitOwner.reason}
                            onClick={() => {
                              setActionModal({ mode: 'owner', question: q });
                              setActionForm({
                                evidenceRef: 'EVD-OWN-DEC-SIM',
                                notes: `Submitted for owner decision simulation: ${q.question}`,
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            {biText(locale, 'Submit for owner decision', 'ለባለቤት ውሳኔ አቅርብ')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Tab 4: Production Gate Checklist */}
      {tab === 'gates' && (
        <div className="space-y-6">
          <div className="bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-xl p-4 flex items-start gap-3 text-red-950 dark:text-red-200">
            <Lock className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold">
                {biText(
                  locale,
                  `Production Deployment Gate: BLOCKED (0 of ${ownerProductionGates.length} Passed)`,
                  `የምርት ማስጀመሪያ በር፡ የታገደ (0 ከ ${ownerProductionGates.length} አልፈዋል)`
                )}
              </h2>
              <p className="text-xs mt-0.5 leading-relaxed opacity-90">
                {biText(
                  locale,
                  'Every onboarding, legal, tax, accounting, balance, and infrastructure gate starts as Blocked, Pending, or Not Started. No simulated workflow in this prototype can pass a production gate.',
                  'ሁሉም የምዝገባ፣ የሕግ፣ የታክስ፣ የሂሳብ፣ የመክፈቻ ሚዛንና የመሠረተ-ልማት በሮች እንደ Blocked/Pending ይጀምራሉ። የፕሮቶታይፕ ማስመሰያ የምርት በርን ማለፍ አይችልም።'
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ownerProductionGates.map((gate) => (
              <div
                key={gate.id}
                className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {gate.group}
                    </span>
                    <StatusLabel label={gate.status} />
                  </div>
                  <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                    {gate.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{gate.blockingReason}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-[#1D2D42] flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {biText(locale, 'Gate Locked', 'በሩ ተቆልፏል')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedGateId(gate.id)}
                    className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {biText(locale, 'Why this is blocked', 'ለምን እንደታገደ ዕይ')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Record Retention Matrix directly accessible in Readiness */}
          <RecordRetentionMatrix />
        </div>
      )}

      {/* Requirement Detail Drawer */}
      <SlideDrawer
        open={Boolean(selectedReq)}
        onClose={() => setSelectedReqId(null)}
        title={selectedReq ? `${selectedReq.requirementId} — ${selectedReq.topic}` : ''}
        subtitle={biText(
          locale,
          'Compliance research requirement detail (Production activation permanently Blocked in prototype)',
          'የተገዢነት ጥናት መስፈርት ዝርዝር (ወደ ምርት ማስገባት በቋሚነት ታግዷል)'
        )}
      >
        {selectedReq && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-200 font-semibold">
              {biText(locale, 'Production Activation Status:', 'የምርት ማስጀመሪያ ሁኔታ:')}{' '}
              {trStatus(selectedReq.productionActivationStatus)}
            </div>
            <dl className="space-y-3 border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236]">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Proposed Product Control', 'የታቀደ የሥርዓት ቁጥጥር')}
                </dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedReq.proposedProductControl}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Evidence Status', 'የማስረጃ ሁኔታ')}
                </dt>
                <dd className="mt-1">
                  <StatusLabel label={selectedReq.evidenceStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Source Type', 'የምንጭ ዓይነት')}
                </dt>
                <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedReq.sourceType}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Adviser-Review Status', 'የአማካሪ ግምገማ ሁኔታ')}
                </dt>
                <dd className="font-semibold text-amber-900 dark:text-amber-300 mt-0.5">
                  {selectedReq.adviserReviewStatus}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Owner-Approval Status', 'የባለቤት ፈቃድ ሁኔታ')}
                </dt>
                <dd className="mt-1">
                  <StatusLabel label={selectedReq.ownerApprovalStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Research Notes', 'የጥናት ማስታወሻ')}
                </dt>
                <dd className="text-slate-700 dark:text-slate-300 mt-0.5">{selectedReq.notes}</dd>
              </div>
            </dl>
          </div>
        )}
      </SlideDrawer>

      {/* Source Record Drawer */}
      <SlideDrawer
        open={Boolean(selectedSource)}
        onClose={() => setSelectedSourceId(null)}
        title={selectedSource?.title || ''}
        subtitle={
          selectedSource
            ? `${biText(locale, 'Source & Evidence Review Record', 'የምንጭና ማስረጃ ግምገማ መዝገብ')} (${selectedSource.id}) — ${biText(locale, 'Research summary only, not legal/tax approval', 'የጥናት ማጠቃለያ ብቻ፣ ሕጋዊ/ታክስ ፈቃድ አይደለም')}`
            : ''
        }
      >
        {selectedSource && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-[#FDF8EC] dark:bg-amber-950/40 border border-[#E5C983] dark:border-amber-700/60 text-amber-950 dark:text-amber-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {biText(
                  locale,
                  'A source record supports research. It does not approve production configuration or grant legal/tax approval.',
                  'የምንጭ መዝገብ ጥናትን ይደግፋል እንጂ የምርት ውቅርን ወይም ሕጋዊ/ታክስ ፈቃድን አይሰጥም።'
                )}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236]">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Source Record ID', 'የምንጭ መዝገብ መለያ')}
                </dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-[#E5B85C] mt-0.5">
                  {selectedSource.id}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Owner Scope', 'የባለቤት ክልል')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {activeOwner.name} ({selectedSource.ownerId})
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Source Type', 'የምንጭ ዓይነት')}
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedSource.sourceType}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Confidence', 'አስተማማኝነት')}
                </dt>
                <dd className="mt-0.5">
                  <StatusLabel label={selectedSource.confidence} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Publication Date Field', 'የታተመበት ቀን መስክ')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedSource.publicationDateField}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Verification Date Field', 'የተረጋገጠበት ቀን መስክ')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedSource.verificationDateField}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Reviewer', 'ገምጋሚ')}
                </dt>
                <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedSource.reviewer}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Scope Summary', 'የክልል ማጠቃለያ')}
                </dt>
                <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedSource.scopeSummary}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Verification Notes', 'የማረጋገጫ ማስታወሻ')}
                </dt>
                <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedSource.notes}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </SlideDrawer>

      {/* Why This Is Blocked Drawer */}
      <SlideDrawer
        open={Boolean(selectedGate)}
        onClose={() => setSelectedGateId(null)}
        title={selectedGate ? `${biText(locale, 'Why Blocked:', 'ለምን ታገደ:') } ${selectedGate.group}` : ''}
        subtitle={selectedGate?.title}
      >
        {selectedGate && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-200 space-y-1">
              <p className="font-bold">
                {biText(locale, 'Current Gate State:', 'አሁናዊ የበር ሁኔታ:')} {trStatus(selectedGate.status)}
              </p>
              <p>{selectedGate.blockingReason}</p>
            </div>
            <div className="border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] rounded-xl p-4 space-y-3">
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Mandatory Documentary Evidence', 'አስገዳጅ የሰነድ ማስረጃ')}
                </p>
                <p className="font-semibold text-[#0F233A] dark:text-slate-100 mt-0.5">
                  {selectedGate.requiredEvidence}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Mandatory Approval Sign-Off', 'አስገዳጅ የማጽደቂያ ፊርማ')}
                </p>
                <p className="font-semibold text-[#0F233A] dark:text-slate-100 mt-0.5">
                  {selectedGate.requiredApproval}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-[#233349] text-slate-600 dark:text-slate-300">
                {biText(locale, 'Owner Context:', 'የባለቤት ክልል:')}{' '}
                <span className="font-mono text-[#0F233A] dark:text-[#E5B85C]">
                  {activeOwner.name}
                </span>
                .{' '}
                {biText(
                  locale,
                  'Production data import and activation remain disabled in this UI/UX prototype.',
                  'በዚህ ፕሮቶታይፕ የምርት መረጃ ማስገባትና ማንቃት ተዘግቷል።'
                )}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Adviser Pack / Owner Decision Simulation Modal */}
      <Modal
        open={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={
          actionModal?.mode === 'pack'
            ? biText(locale, 'Prepare Adviser Pack (Simulation)', 'የአማካሪ ሰነድ አዘጋጅ (ማስመሰያ)')
            : biText(locale, 'Submit for Owner Decision (Simulation)', 'ለባለቤት ውሳኔ አቅርብ (ማስመሰያ)')
        }
        subtitle={biText(
          locale,
          'Creates a simulated approval request and immutable Simulation audit event.',
          'የማስመሰያ ማጽደቂያ ጥያቄና የማይለወጥ የኦዲት መዝገብ ይፈጥራል።'
        )}
      >
        {actionModal && (
          <form onSubmit={handleAdviserModalSubmit} className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349]">
              <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                {actionModal.question.question}
              </p>
              <p className="text-amber-900 dark:text-amber-300 mt-1">
                {actionModal.question.unverifiedNotice}
              </p>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Evidence Reference Placeholder *', 'የማስረጃ ማጣቀሻ ምትክ *')}
              </label>
              <input
                required
                value={actionForm.evidenceRef}
                onChange={(e) => setActionForm({ ...actionForm, evidenceRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Notes', 'ማስታወሻ')}
              </label>
              <textarea
                rows={2}
                value={actionForm.notes}
                onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] cursor-pointer"
              >
                {labels.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer transition-colors"
              >
                {biText(locale, 'Create Simulated Request & Audit Log', 'የማስመሰያ ጥያቄና የኦዲት መዝገብ ፍጠር')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
