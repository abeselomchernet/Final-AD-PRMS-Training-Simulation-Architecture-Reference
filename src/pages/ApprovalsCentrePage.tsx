import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  BellRing,
  Check,
  CopyPlus,
  Download,
  Lock,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { usePrms } from '../context/PrmsContext';
import { biText } from '../data/i18n';
import { checkApprovalAuthority } from '../policies/rbac';
import { ApprovalRequest, ApprovalStatus } from '../types/prms';
import {
  ConfirmDialog,
  EmptyState,
  ExportPreviewModal,
  GovernanceCallout,
  PaginationBar,
  SavedFilterBar,
  SlideDrawer,
  SortableTh,
  StatusLabel,
} from '../components/ui/Primitives';

const INBOX_TABS: ApprovalStatus[] = [
  'Pending My Review',
  'Submitted by Me',
  'In Review',
  'Approved',
  'Rejected',
  'Returned',
  'Cancelled',
  'Superseded',
  'Expired',
];

export const ApprovalsCentrePage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    session,
    locale,
    fmtDate,
    fmtDateTime,
    ownerApprovals,
    ownerDelegations,
    decideApproval,
    cancelApproval,
    supersedeApproval,
    triggerApprovalReminderOrEscalate,
    toggleApprovalChecklistItem,
    attemptSelfApprovalAudit,
    logReportExport,
  } = usePrms();

  const [activeTab, setActiveTab] = useState<ApprovalStatus>('Pending My Review');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'requestNumber' | 'dueDate' | 'status'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [supersedeNote, setSupersedeNote] = useState('');
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);

  const handleSort = (col: string) => {
    const k = col as typeof sortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = ownerApprovals.filter((req) => {
      const sameActorOrPersona =
        req.makerActorId === session.actorId || req.makerPersona === currentPersona.role;
      let tabMatch: boolean;
      if (activeTab === 'Pending My Review') {
        tabMatch = (req.status === 'Pending' || req.status === 'In Review') && !sameActorOrPersona;
      } else if (activeTab === 'Submitted by Me') {
        tabMatch = sameActorOrPersona;
      } else {
        tabMatch = req.status === activeTab;
      }
      if (!tabMatch) return false;
      if (q) {
        return (
          req.requestNumber.toLowerCase().includes(q) ||
          req.title.toLowerCase().includes(q) ||
          req.category.toLowerCase().includes(q) ||
          req.makerPersona.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const av = String(a[sortKey] || '');
      const bv = String(b[sortKey] || '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [ownerApprovals, activeTab, currentPersona.role, session.actorId, searchQuery, sortKey, sortDir]);

  const pagedRequests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page]);

  const tabCounts = useMemo(() => {
    const isMine = (r: ApprovalRequest) =>
      r.makerActorId === session.actorId || r.makerPersona === currentPersona.role;
    return {
      'Pending My Review': ownerApprovals.filter(
        (r) => (r.status === 'Pending' || r.status === 'In Review') && !isMine(r)
      ).length,
      'Submitted by Me': ownerApprovals.filter((r) => isMine(r)).length,
      'In Review': ownerApprovals.filter((r) => r.status === 'In Review').length,
      Approved: ownerApprovals.filter((r) => r.status === 'Approved').length,
      Rejected: ownerApprovals.filter((r) => r.status === 'Rejected').length,
      Returned: ownerApprovals.filter((r) => r.status === 'Returned').length,
      Cancelled: ownerApprovals.filter((r) => r.status === 'Cancelled').length,
      Superseded: ownerApprovals.filter((r) => r.status === 'Superseded').length,
      Expired: ownerApprovals.filter((r) => r.status === 'Expired').length,
    };
  }, [ownerApprovals, currentPersona.role, session.actorId]);

  const selectedRequest: ApprovalRequest | null = useMemo(
    () => ownerApprovals.find((r) => r.id === selectedId) || null,
    [ownerApprovals, selectedId]
  );

  const authCheck = useMemo(
    () =>
      selectedRequest
        ? checkApprovalAuthority(
            currentPersona.role,
            selectedRequest,
            session.actorId,
            ownerDelegations
          )
        : null,
    [selectedRequest, currentPersona.role, session.actorId, ownerDelegations]
  );

  const isSelectedSelfMaker = Boolean(
    selectedRequest &&
      (selectedRequest.makerActorId === session.actorId ||
        selectedRequest.makerPersona === currentPersona.role)
  );

  const handleDecision = (decision: 'Approved' | 'Rejected' | 'Returned') => {
    if (!selectedRequest) return;
    if (decideApproval(selectedRequest.id, decision, decisionComment.trim())) {
      setDecisionComment('');
      setSelectedId(null);
    }
  };

  return (
    <div className="space-y-5">
      <GovernanceCallout
        title={biText(
          locale,
          `Maker-Checker & Multi-Step Approvals Centre — ${activeOwner.name}`,
          `የአዘጋጅ-አጽዳቂ እና ባለ ብዙ ደረጃ ማጽደቂያ ማዕከል — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          `Active Actor ID: ${session.actorId} (${session.username}). Self-approval is prohibited by Actor ID. To test Checker review, sign out and sign in as an independent training account.`,
          `ንቁ Actor ID: ${session.actorId} (${session.username})። የራስን ጥያቄ ማጽደቅ በActor-ID ታግዷል። አጽዳቂ ለመሞከር በሌላ የስልጠና መለያ ይግቡ።`
        )}
        controlType="Prototype Simulation"
      />

      {/* Saved Filters & Search Bar */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={biText(
                locale,
                'Search request #, category, maker role, or title...',
                'በጥያቄ ቁጥር፣ ምድብ ወይም አዘጋጅ ሚና ይፈልጉ...'
              )}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={() => setExportPreviewOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-[#0F233A] dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Export Queue Preview', 'የወጪ ቅድመ-ዕይታ')}</span>
          </button>
        </div>

        <SavedFilterBar
          presets={[
            {
              id: 'pending',
              label: biText(locale, 'Pending My Review', 'የእኔን ግምገማ የሚጠብቁ'),
              value: 'Pending My Review',
              count: tabCounts['Pending My Review'],
            },
            {
              id: 'mine',
              label: biText(locale, 'Submitted by Me (Self-Approval Blocked)', 'በእኔ የቀረቡ'),
              value: 'Submitted by Me',
              count: tabCounts['Submitted by Me'],
            },
            {
              id: 'approved',
              label: biText(locale, 'Approved', 'የጸደቁ'),
              value: 'Approved',
              count: tabCounts.Approved,
            },
            {
              id: 'rejected',
              label: biText(locale, 'Rejected', 'ውድቅ የተደረጉ'),
              value: 'Rejected',
              count: tabCounts.Rejected,
            },
          ]}
          activeValue={activeTab}
          onSelect={(v) => {
            setActiveTab(v);
            setPage(1);
          }}
        />
      </section>

      {/* 9 Workflow Inbox Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFF5] dark:bg-[#152236] rounded-xl">
        {INBOX_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === tab
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{tab}</span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              ({tabCounts[tab]})
            </span>
          </button>
        ))}
      </div>

      {/* Request Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        {pagedRequests.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={biText(
                locale,
                `No Requests in "${activeTab}"`,
                `በ "${activeTab}" ውስጥ ምንም ጥያቄ የለም`
              )}
              description={biText(
                locale,
                `Switch tabs, clear search, or sign in as another training account to review Maker-Checker flows for ${activeOwner.name}.`,
                `ለ ${activeOwner.name} የማጽደቅ ሂደቶችን ለመሞከር ትር ይቀይሩ ወይም በሌላ የስልጠና መለያ ይግቡ።`
              )}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <SortableTh
                      label={biText(locale, 'Request # & Step', 'ጥያቄ # እና ደረጃ')}
                      columnKey="requestNumber"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Category & Title', 'ምድብ እና ርዕስ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Maker (Actor ID)', 'አዘጋጅ (Actor ID)')}</th>
                    <SortableTh
                      label={biText(locale, 'Due / Effective', 'መጨረሻ / ተፈጻሚ ቀን')}
                      columnKey="dueDate"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableTh
                      label={biText(locale, 'Status', 'ሁኔታ')}
                      columnKey="status"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Review', 'ግምገማ')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {pagedRequests.map((req) => {
                    const isSelfActor =
                      req.makerActorId === session.actorId || req.makerPersona === currentPersona.role;
                    return (
                      <tr
                        key={req.id}
                        className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono">
                          <p className="font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                            {req.requestNumber}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {req.workflowMode} · Step {req.currentStep}/{req.totalSteps}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {req.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {req.category} · {req.amountThresholdPlaceholder}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-slate-800 dark:text-slate-200">{req.makerPersona}</p>
                          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {req.makerActorId}
                          </p>
                          {isSelfActor && (
                            <p className="text-[11px] font-semibold text-red-700 dark:text-red-400">
                              {biText(locale, 'Self-approval blocked', 'የራስን ማጽደቅ ታግዷል')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          <p>{biText(locale, 'Due', 'ገደብ')}: {fmtDate(req.dueDate)}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            {biText(locale, 'Eff', 'ተፈጻሚ')}: {fmtDate(req.effectiveDate)}
                          </p>
                        </td>
                        <td className="py-3 px-4 space-y-1">
                          <StatusLabel label={req.status} />
                          {req.escalated && (
                            <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                              Escalated (Sim)
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(req.id);
                              setDecisionComment('');
                              setSupersedeNote('');
                            }}
                            className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            {biText(locale, 'Open Detail', 'ዝርዝር ክፈት')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalItems={filteredRequests.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* Approval Detail Drawer */}
      <SlideDrawer
        open={Boolean(selectedRequest)}
        onClose={() => setSelectedId(null)}
        title={selectedRequest ? `${selectedRequest.requestNumber} — ${selectedRequest.category}` : ''}
        subtitle={selectedRequest?.title}
      >
        {selectedRequest && (
          <div className="space-y-5 text-xs">
            {/* Step Progress & Escalation Banner */}
            <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3.5 bg-[#F8FAFC] dark:bg-[#152236] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#0F233A] dark:text-slate-100">
                  {selectedRequest.workflowMode} · Step {selectedRequest.currentStep} of{' '}
                  {selectedRequest.totalSteps}
                </span>
                <div className="flex items-center gap-2">
                  <StatusLabel label={selectedRequest.status} />
                  {selectedRequest.finalized && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 dark:bg-[#1E2E44] text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                      <Lock className="w-3 h-3" />
                      {biText(locale, 'Finalized (Immutable)', 'የተዘጋ (የማይቀየር)')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedRequest.stepLabels.map((lbl, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-1 rounded text-[11px] border ${
                      idx + 1 < selectedRequest.currentStep || selectedRequest.status === 'Approved'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 font-semibold'
                        : idx + 1 === selectedRequest.currentStep && !selectedRequest.finalized
                          ? 'bg-[#FDF8EC] dark:bg-amber-950/40 border-[#E5C983] dark:border-amber-700/60 text-amber-950 dark:text-amber-200 font-semibold'
                          : 'bg-white dark:bg-[#111C2C] border-[#DFE5EE] dark:border-[#233349] text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {lbl}
                  </span>
                ))}
              </div>
            </div>

            {/* Metadata Grid */}
            <dl className="grid grid-cols-2 gap-3 border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-white dark:bg-[#152236]">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Maker & Actor ID', 'አዘጋጅ እና መታወቂያ')}
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedRequest.makerName} ({selectedRequest.makerPersona}) ·{' '}
                  <span className="font-mono text-[#0F233A] dark:text-[#E5B85C]">
                    {selectedRequest.makerActorId}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Threshold Rule', 'የመጠን/ተጽዕኖ ገደብ')}
                </dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedRequest.amountThresholdPlaceholder}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Required Checker / Escalator', 'የሚፈለግ አጽዳቂ')}
                </dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedRequest.requiredCheckerRoles.join(', ')}
                  {selectedRequest.escalatorRoles?.length
                    ? ` -> Step 2+: ${selectedRequest.escalatorRoles.join(', ')}`
                    : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Due & Expiry Dates', 'የመጨረሻ እና የማብቂያ ቀናት')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {fmtDate(selectedRequest.dueDate)} / Exp: {fmtDate(selectedRequest.expiryDate)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Evidence Reference', 'የማስረጃ ቁጥር')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedRequest.evidenceRef}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Effective Date', 'ተፈጻሚ ቀን')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {fmtDate(selectedRequest.effectiveDate)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Justification', 'ምክንያት')}
                </dt>
                <dd className="text-slate-900 dark:text-slate-200 mt-0.5">
                  {selectedRequest.reason}
                </dd>
              </div>
              {(selectedRequest.supersedesRequestId || selectedRequest.supersededByRequestId) && (
                <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-[#233349] flex flex-wrap gap-3 text-emerald-900 dark:text-emerald-300 font-mono">
                  {selectedRequest.supersedesRequestId && (
                    <button
                      type="button"
                      onClick={() => setSelectedId(selectedRequest.supersedesRequestId!)}
                      className="underline cursor-pointer"
                    >
                      Supersedes: {selectedRequest.supersedesRequestId}
                    </button>
                  )}
                  {selectedRequest.supersededByRequestId && (
                    <button
                      type="button"
                      onClick={() => setSelectedId(selectedRequest.supersededByRequestId!)}
                      className="underline cursor-pointer text-amber-800 dark:text-amber-300"
                    >
                      Superseded By: {selectedRequest.supersededByRequestId}
                    </button>
                  )}
                </div>
              )}
            </dl>

            {/* Required Evidence Checklist */}
            <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-2 bg-white dark:bg-[#152236]">
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100">
                {biText(locale, 'Required Documentary Evidence Checklist', 'የሚያስፈልግ የሰነድ ማስረጃ ዝርዝር')}
              </h3>
              {selectedRequest.evidenceChecklist.map((chk) => (
                <label
                  key={chk.id}
                  className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    disabled={
                      selectedRequest.finalized ||
                      currentPersona.role === 'Auditor / Read-only reviewer'
                    }
                    checked={chk.verifiedPlaceholder}
                    onChange={() => toggleApprovalChecklistItem(selectedRequest.id, chk.id)}
                  />
                  <span>{chk.label}</span>
                </label>
              ))}
            </div>

            {/* Before / After Comparison */}
            <div>
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 mb-2">
                {biText(locale, 'Before / After State Comparison', 'የበፊት እና የኋላ ሁኔታ ንጽጽር')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236]">
                  <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    {biText(locale, 'Before State', 'የበፊት ሁኔታ')}
                  </p>
                  <dl className="space-y-1 font-mono text-[11px]">
                    {Object.entries(selectedRequest.beforeValues).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-slate-500 dark:text-slate-400">{k}:</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-3 bg-emerald-50/40 dark:bg-emerald-950/30">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1.5">
                    {biText(locale, 'Proposed After State', 'የታቀደ አዲስ ሁኔታ')}
                  </p>
                  <dl className="space-y-1 font-mono text-[11px]">
                    {Object.entries(selectedRequest.afterValues).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-slate-500 dark:text-slate-400">{k}:</dt>
                        <dd className="text-emerald-950 dark:text-emerald-200 font-semibold">
                          {String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>

            {/* Checker Decision & Escalation Box */}
            <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3 bg-white dark:bg-[#152236]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-[#0F233A] dark:text-slate-100">
                  {biText(locale, 'Checker Decision & Escalation', 'የአጽዳቂ ውሳኔ እና ማሳሰቢያ')}
                </h3>
                {!selectedRequest.finalized && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => triggerApprovalReminderOrEscalate(selectedRequest.id, 'reminder')}
                      className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-[#1D2E48] inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <BellRing className="w-3 h-3" />
                      <span>{biText(locale, 'Reminder (Sim)', 'ማሳሰቢያ')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerApprovalReminderOrEscalate(selectedRequest.id, 'escalate')}
                      className="px-2.5 py-1 rounded-lg border border-[#E5C983] dark:border-amber-700/60 bg-[#FDF8EC] dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-[11px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-950/60 inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>{biText(locale, 'Escalate', 'ወደ ላይ አሳልፍ')}</span>
                    </button>
                  </div>
                )}
              </div>

              {authCheck && !authCheck.allowed && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-700 dark:text-red-400" />
                    <div>
                      <p className="font-semibold">{authCheck.reason}</p>
                      <p className="text-[11px] mt-0.5 opacity-90">
                        {biText(
                          locale,
                          'Sign out and enter as a separate Checker training account from Login to approve this step.',
                          'ይህንን ደረጃ ለማጽደቅ ወጥተው በሌላ የአጽዳቂ ስልጠና መለያ ይግቡ።'
                        )}
                      </p>
                    </div>
                  </div>
                  {isSelectedSelfMaker && !selectedRequest.finalized && (
                    <button
                      type="button"
                      onClick={() => attemptSelfApprovalAudit(selectedRequest.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      {biText(
                        locale,
                        'Simulate Self-Approval Attempt (Audit Control Test)',
                        'የራስን የማጽደቅ ሙከራ ፈትሽ (በኦዲት ይመዘገባል)'
                      )}
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="font-medium text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Decision Comment (logged immutably)', 'የውሳኔ አስተያየት (በቋሚነት ይመዘገባል)')}
                </label>
                <textarea
                  rows={2}
                  disabled={!authCheck?.allowed}
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder={biText(locale, 'Enter checker review comment...', 'የአጽዳቂ አስተያየት ያስገቡ...')}
                  className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-slate-900 dark:text-slate-100 rounded-lg disabled:bg-slate-100 dark:disabled:bg-[#0D1724] disabled:opacity-60"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!authCheck?.allowed}
                  onClick={() => handleDecision('Approved')}
                  className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {selectedRequest.currentStep < selectedRequest.totalSteps
                      ? biText(
                          locale,
                          `Verify Step ${selectedRequest.currentStep} & Route Next`,
                          `ደረጃ ${selectedRequest.currentStep} አረጋግጥ`
                        )
                      : biText(locale, 'Approve', 'አጽድቅ')}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!authCheck?.allowed}
                  onClick={() => handleDecision('Returned')}
                  className="px-3.5 py-2 rounded-lg border border-[#E5C983] dark:border-amber-700/60 bg-[#FDF8EC] dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{biText(locale, 'Return for Revision', 'ለማስተካከያ መልስ')}</span>
                </button>
                <button
                  type="button"
                  disabled={!authCheck?.allowed}
                  onClick={() => setConfirmRejectOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{biText(locale, 'Reject', 'ውድቅ አድርግ')}</span>
                </button>
                {!selectedRequest.finalized && (
                  <button
                    type="button"
                    disabled={currentPersona.role === 'Auditor / Read-only reviewer'}
                    onClick={() => setConfirmCancelOpen(true)}
                    className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{biText(locale, 'Cancel Request', 'ጥያቄ ሰርዝ')}</span>
                  </button>
                )}
              </div>

              {/* Superseding Request Creation (For Finalized or Returned Items) */}
              {(selectedRequest.finalized || selectedRequest.status === 'Returned') &&
                !selectedRequest.supersededByRequestId && (
                  <div className="pt-3 border-t border-slate-200 dark:border-[#233349] space-y-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {biText(
                        locale,
                        'Need to Correct This Decision Non-Destructively?',
                        'ይህን ውሳኔ ሳያጠፉ ማስተካከል ይፈልጋሉ?'
                      )}
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={supersedeNote}
                        onChange={(e) => setSupersedeNote(e.target.value)}
                        placeholder={biText(
                          locale,
                          'Reason for linked superseding request...',
                          'የተተኪ ጥያቄ ምክንያት...'
                        )}
                        className="flex-1 px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-slate-900 dark:text-slate-100 rounded-lg"
                      />
                      <button
                        type="button"
                        disabled={currentPersona.role === 'Auditor / Read-only reviewer'}
                        onClick={() => {
                          if (
                            supersedeApproval(
                              selectedRequest.id,
                              supersedeNote,
                              selectedRequest.evidenceRef
                            )
                          ) {
                            setSelectedId(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#1A314E] dark:hover:bg-[#234066] text-white font-semibold disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                      >
                        <CopyPlus className="w-3.5 h-3.5" />
                        <span>{biText(locale, 'Create Superseding Request', 'ተተኪ ጥያቄ ፍጠር')}</span>
                      </button>
                    </div>
                  </div>
                )}
            </div>

            {/* Decision Log */}
            <div>
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 mb-2">
                {biText(locale, 'Immutable Decision Timeline', 'የማይፋቅ የውሳኔ ታሪክ')}
              </h3>
              <div className="space-y-2">
                {selectedRequest.decisionLog.map((log, i) => (
                  <div
                    key={i}
                    className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {log.action} · {log.actor} ({log.persona})
                        {log.actorId ? ` · ${log.actorId}` : ''}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {fmtDateTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 mt-1">{log.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      <ConfirmDialog
        open={confirmRejectOpen}
        onClose={() => setConfirmRejectOpen(false)}
        onConfirm={() => handleDecision('Rejected')}
        title={biText(locale, 'Confirm Immutable Rejection', 'ውድቅ ማድረግን ያረጋግጡ')}
        description={biText(
          locale,
          'Rejecting finalizes this approval request immutably in the training simulation. Any correction later requires a linked superseding request.',
          'ውድቅ ማድረግ ይህን ጥያቄ በማይቀየር ሁኔታ ይዘጋዋል። ማስተካከያ አዲስ ተተኪ ጥያቄ ይፈልጋል።'
        )}
        confirmLabel={biText(locale, 'Confirm Reject', 'ውድቅ አድርግ')}
        tone="red"
      />

      <ConfirmDialog
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={() => {
          if (selectedRequest && cancelApproval(selectedRequest.id, decisionComment)) {
            setSelectedId(null);
          }
        }}
        title={biText(locale, 'Confirm Request Cancellation', 'የጥያቄ መሰረዝን ያረጋግጡ')}
        description={biText(
          locale,
          'Cancelling closes the pending request immutably before checker decision and records an audit event.',
          'መሰረዝ ጥያቄውን ከውሳኔ በፊት ይዘጋዋል እንዲሁም በኦዲት መዝገብ ውስጥ ይጻፋል።'
        )}
        confirmLabel={biText(locale, 'Confirm Cancel', 'ጥያቄ ሰርዝ')}
        tone="red"
      />

      <ExportPreviewModal
        open={exportPreviewOpen}
        onClose={() => setExportPreviewOpen(false)}
        title={`Approvals Queue (${activeTab})`}
        format="Excel"
        ownerName={activeOwner.name}
        rowCount={filteredRequests.length}
        previewColumns={['Request #', 'Category', 'Maker', 'Due Date', 'Status']}
        previewRows={filteredRequests.map((r) => [
          r.requestNumber,
          r.category,
          `${r.makerPersona} (${r.makerActorId})`,
          fmtDate(r.dueDate),
          r.status,
        ])}
        onConfirmExport={() => logReportExport(`Approvals Queue — ${activeTab}`, 'Excel')}
      />
    </div>
  );
};
