import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Download, ExternalLink, RotateCcw, ShieldAlert } from 'lucide-react';
import { usePrms } from '../context/PrmsContext';
import { biText } from '../data/i18n';
import { checkActionPermission } from '../policies/rbac';
import { RequirementCoverageStatus, RequirementDomain, RequirementTraceabilityItem } from '../types/prms';
import {
  EmptyState,
  ExportPreviewModal,
  GovernanceCallout,
  KpiCard,
  PaginationBar,
  SavedFilterBar,
  SlideDrawer,
  SortableTh,
  StatusLabel,
} from '../components/ui/Primitives';

const ALL_DOMAINS: RequirementDomain[] = [
  'Owner Model',
  'Buildings / Floors / Units',
  'Tenants / CRM',
  'Rental Applications',
  'Lease Management',
  'Rent Billing',
  'Payments / Receipts',
  'Deposits / Refunds',
  'Double-Entry Accounting',
  'Owner Separation',
  'Expenses / Payables',
  'Tax Workspace',
  'Maintenance / Complaints',
  'Roles / Permissions',
  'Approvals',
  'Audit Trail',
  'Reports',
  'Backup / Recovery',
  'Local-First Architecture',
  'Migration',
  'Testing / Acceptance',
];

export const RequirementsAcceptancePage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    locale,
    fmtDateTime,
    ownerRequirementsTraceability,
    setActiveSection,
    runAcceptanceScenario,
    logSimulatedEvent,
    notify,
    labels,
  } = usePrms();

  const [domainFilter, setDomainFilter] = useState<'All' | RequirementDomain>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | RequirementCoverageStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [testNote, setTestNote] = useState('');
  const [sortKey, setSortKey] = useState<'requirementId' | 'domain' | 'prototypeStatus'>('requirementId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);

  const pageSize = 8;
  const canRunTest = checkActionPermission(currentPersona.role, 'run_acceptance_test');

  const handleSort = (col: string) => {
    const key = col as 'requirementId' | 'domain' | 'prototypeStatus';
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  // Truthful summary — never rounded to 100% complete and separates simulated tests from production sign-off
  const summary = useMemo(() => {
    const total = ownerRequirementsTraceability.length;
    const demonstrated = ownerRequirementsTraceability.filter(
      (r) => r.prototypeStatus === 'Demonstrated in prototype'
    ).length;
    const partial = ownerRequirementsTraceability.filter(
      (r) => r.prototypeStatus === 'Partially demonstrated'
    ).length;
    const blocked = ownerRequirementsTraceability.filter(
      (r) => r.prototypeStatus === 'Blocked by decision/evidence'
    ).length;
    const planned = ownerRequirementsTraceability.filter(
      (r) => r.prototypeStatus === 'Planned only' || r.prototypeStatus === 'Not yet designed'
    ).length;
    const formallyAccepted = ownerRequirementsTraceability.filter(
      (r) => r.productionReadinessStatus !== 'Blocked' && r.productionReadinessStatus !== 'Not Ready'
    ).length;
    return { total, demonstrated, partial, blocked, planned, formallyAccepted };
  }, [ownerRequirementsTraceability]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = ownerRequirementsTraceability.filter((r) => {
      if (domainFilter !== 'All' && r.domain !== domainFilter) return false;
      if (statusFilter !== 'All' && r.prototypeStatus !== statusFilter) return false;
      if (
        q &&
        !r.requirementId.toLowerCase().includes(q) &&
        !r.title.toLowerCase().includes(q) &&
        !r.domain.toLowerCase().includes(q) &&
        !r.relatedModule.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      const cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [ownerRequirementsTraceability, domainFilter, statusFilter, searchQuery, sortKey, sortDir]);

  const pagedRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page]
  );

  const selectedReq: RequirementTraceabilityItem | null = useMemo(
    () => ownerRequirementsTraceability.find((r) => r.id === selectedReqId) || null,
    [ownerRequirementsTraceability, selectedReqId]
  );

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          `Requirements Traceability & UAT Acceptance Centre — ${activeOwner.name}`,
          `የመስፈርቶች ክትትል እና የሙከራ ተቀባይነት ማዕከል — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          'Truthful traceability register covering all 21 documented capability domains (mapped to source specification scope, not claiming full 153-requirement production completion). Simulated UAT passes log evidence only — formal owner acceptance and Ethiopian licensed adviser sign-offs remain blocked prior to production.',
          'ይህ መዝገብ 21 የስርዓቱን ዋና ዋና ክፍሎች በታማኝነት ይከታተላል (ሁሉም 153 መስፈርቶች ለምርት ዝግጁ ናቸው አይልም)። የማስመሰያ ፍተሻ ማለፍ ማለት የምርት ፈቃድ አግኝቷል ማለት አይደለም።'
        )}
        variant="warning"
        controlType="Production Boundary"
      />

      {/* Truthful Summary Strip (NEVER displays 100% Complete) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label={biText(locale, 'Traced Requirements', 'የተለዩ መስፈርቶች')}
          value={`${summary.total}`}
          subtext={biText(locale, '21 capability domains mapped', '21 የሥራ ዘርፎች የተመዘገቡ')}
        />
        <KpiCard
          label={biText(locale, 'Demonstrated (Sim)', 'በፕሮቶታይፕ የታዩ')}
          value={`${summary.demonstrated}`}
          subtext={biText(locale, 'Interactive prototype UI/UX', 'በማስመሰያ የታዩ (ምርት ያልሆኑ)')}
          accent="emerald"
        />
        <KpiCard
          label={biText(locale, 'Partially Demonstrated', 'በከፊል የታዩ')}
          value={`${summary.partial}`}
          subtext={biText(locale, 'Requires final rules / build-out', 'ተጨማሪ ውሳኔ የሚፈልጉ')}
          accent="gold"
        />
        <KpiCard
          label={biText(locale, 'Blocked by Evidence', 'በማስረጃ የታገዱ')}
          value={`${summary.blocked}`}
          subtext={biText(locale, 'Owner / Ethiopian adviser gated', 'በአማካሪ/ባለቤት ውሳኔ የታገዱ')}
        />
        <KpiCard
          label={biText(locale, 'Production Sign-Off', 'ለምርት የጸደቁ')}
          value={`${summary.formallyAccepted} / ${summary.total}`}
          subtext={biText(locale, '0% Production Ready (Prototype)', '0% ለምርት ዝግጁ (ፕሮቶታይፕ)')}
        />
      </section>

      {/* Filter Controls */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SavedFilterBar
            presets={[
              { id: 'all', label: biText(locale, 'All Traced', 'ሁሉም'), value: 'All', count: summary.total },
              {
                id: 'demo',
                label: biText(locale, 'Demonstrated (Sim)', 'በፕሮቶታይፕ የታዩ'),
                value: 'Demonstrated in prototype',
                count: summary.demonstrated,
              },
              {
                id: 'partial',
                label: biText(locale, 'Partial', 'በከፊል'),
                value: 'Partially demonstrated',
                count: summary.partial,
              },
              {
                id: 'blocked',
                label: biText(locale, 'Blocked by Evidence', 'በማስረጃ የታገዱ'),
                value: 'Blocked by decision/evidence',
                count: summary.blocked,
              },
            ]}
            activeValue={statusFilter}
            onSelect={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          />
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] font-semibold text-[#0F233A] dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Export Preview', 'ወጪ ቅድመ-ዕይታ')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-[#1D2D42]">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'Capability Domain (21 Domains)', 'የመስፈርት ዘርፍ (21 ዘርፎች)')}
            </label>
            <select
              value={domainFilter}
              onChange={(e) => {
                setDomainFilter(e.target.value as 'All' | RequirementDomain);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            >
              <option value="All">{biText(locale, 'All 21 Domains', 'ሁሉም 21 ዘርፎች')}</option>
              {ALL_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'Prototype Coverage Status', 'የፕሮቶታይፕ ሽፋን ሁኔታ')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'All' | RequirementCoverageStatus);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            >
              <option value="All">{biText(locale, 'All Statuses', 'ሁሉም ሁኔታዎች')}</option>
              <option value="Demonstrated in prototype">Demonstrated in prototype</option>
              <option value="Partially demonstrated">Partially demonstrated</option>
              <option value="Planned only">Planned only</option>
              <option value="Blocked by decision/evidence">Blocked by decision/evidence</option>
              <option value="Not yet designed">Not yet designed</option>
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'Search ID / Title / Module', 'በመለያ ወይም ርዕስ ይፈልጉ')}
            </label>
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. REQ-TAX, Audit, Backup..."
              className="w-full px-2.5 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setDomainFilter('All');
                setStatusFilter('All');
                setSearchQuery('');
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{labels.resetFilters}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Traceability Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={biText(locale, 'No Requirements Match Filter', 'ከማጣሪያው ጋር የሚዛመድ መስፈርት የለም')}
              description={biText(
                locale,
                'Reset filters to inspect all 21 capability traceability entries.',
                'ሁሉንም 21 መስፈርቶች ለማየት ማጣሪያውን ያጽዱ።'
              )}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setDomainFilter('All');
                    setStatusFilter('All');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] cursor-pointer"
                >
                  {labels.resetFilters}
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <SortableTh
                      label={biText(locale, 'Req ID & Domain', 'መለያ እና ዘርፍ')}
                      columnKey="requirementId"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="py-2.5 px-4 font-semibold">
                      {biText(locale, 'Title & Source Section', 'ርዕስ እና ምንጭ')}
                    </th>
                    <SortableTh
                      label={biText(locale, 'Related Module', 'ተዛማጅ ክፍል')}
                      columnKey="domain"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableTh
                      label={biText(locale, 'Prototype Status', 'የፕሮቶታይፕ ሁኔታ')}
                      columnKey="prototypeStatus"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="py-2.5 px-4 font-semibold">
                      {biText(locale, 'Owner / Prod Gate', 'የባለቤት / የምርት ገደብ')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      {biText(locale, 'Acceptance Test', 'የሙከራ ፍተሻ')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {pagedRows.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 align-top transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                          {req.requirementId}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{req.domain}</p>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{req.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {req.sourceDocumentSection} · {req.workPackageStatus}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setActiveSection(req.targetSection)}
                          className="inline-flex items-center gap-1 text-[#166549] dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                        >
                          <span>{req.relatedModule}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel label={req.prototypeStatus} />
                        {req.lastTestOutcome && (
                          <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 mt-1">
                            UAT: {req.lastTestOutcome}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <StatusLabel label={req.ownerAcceptanceStatus} />
                        <div>
                          <StatusLabel label={req.productionReadinessStatus} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReqId(req.id);
                            setTestNote('');
                          }}
                          className="text-xs font-semibold text-[#0F233A] dark:text-emerald-400 hover:text-[#166549] hover:underline cursor-pointer"
                        >
                          {biText(locale, 'Run / Inspect UAT', 'ፍተሻ ይመልከቱ')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalItems={filtered.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <ExportPreviewModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={biText(locale, 'Requirements Traceability Matrix', 'የመስፈርቶች ክትትል ዝርዝር')}
        format="Excel"
        ownerName={activeOwner.name}
        rowCount={filtered.length}
        previewColumns={['Req ID', 'Domain', 'Prototype Status', 'Owner Gate', 'Prod Status']}
        previewRows={filtered.map((r) => [
          r.requirementId,
          r.domain,
          r.prototypeStatus,
          r.ownerAcceptanceStatus,
          r.productionReadinessStatus,
        ])}
        onConfirmExport={() => {
          logSimulatedEvent(
            'Requirements & Acceptance',
            'Requirements Traceability Export Simulated',
            'RequirementTraceabilityItem',
            activeOwner.id,
            `Previewed and simulated Excel export of ${filtered.length} traced requirement entries.`
          );
          notify({
            tone: 'info',
            title: biText(locale, 'Traceability Export Simulated', 'የመስፈርት ዝርዝር ወጪ ተመስሏል'),
            detail: biText(locale, 'Logged to simulated audit trail.', 'በኦዲት መዝገብ ተመዝግቧል።'),
          });
        }}
      />

      {/* Requirement Acceptance Drawer */}
      <SlideDrawer
        open={Boolean(selectedReq)}
        onClose={() => setSelectedReqId(null)}
        title={selectedReq ? `${selectedReq.requirementId} — ${selectedReq.domain}` : ''}
        subtitle={selectedReq?.title}
      >
        {selectedReq && (
          <div className="space-y-5 text-xs">
            <dl className="grid grid-cols-2 gap-3 border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236]">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Source Section', 'የምንጭ ክፍል')}
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedReq.sourceDocumentSection}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Work Package Status', 'የሥራ ጥቅል ሁኔታ')}
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedReq.workPackageStatus}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Test Persona', 'የሙከራ ሚና')}
                </dt>
                <dd className="font-semibold text-[#0F233A] dark:text-slate-100 mt-0.5">
                  {selectedReq.testPersona}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Evidence Ref', 'የማስረጃ ቁጥር')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-[#E5B85C] mt-0.5">
                  {selectedReq.evidenceRef}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Owner Acceptance', 'የባለቤት ተቀባይነት')}
                </dt>
                <dd className="mt-1">
                  <StatusLabel label={selectedReq.ownerAcceptanceStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Production Readiness', 'የምርት ዝግጁነት')}
                </dt>
                <dd className="mt-1">
                  <StatusLabel label={selectedReq.productionReadinessStatus} />
                </dd>
              </div>
            </dl>

            <div className="space-y-3">
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-white dark:bg-[#111C2C]">
                <p className="font-semibold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
                  <span>{biText(locale, 'Acceptance-Test Scenario', 'የተቀባይነት ሙከራ ሁኔታ')}</span>
                </p>
                <p className="text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed">
                  {selectedReq.acceptanceScenario}
                </p>
              </div>

              <div className="border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-xl p-4">
                <p className="font-semibold text-emerald-950 dark:text-emerald-200">
                  {biText(locale, 'Expected Verification Result', 'የሚጠበቅ ውጤት')}
                </p>
                <p className="text-emerald-900 dark:text-emerald-100 mt-1 leading-relaxed">
                  {selectedReq.expectedResult}
                </p>
              </div>
            </div>

            {selectedReq.lastTestedAt && (
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236]">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {biText(locale, 'Latest Simulated Run', 'የቅርብ ጊዜ የሙከራ ፍተሻ')}:{' '}
                  {selectedReq.lastTestOutcome}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  {selectedReq.lastTestedBy} · {fmtDateTime(selectedReq.lastTestedAt)}
                </p>
              </div>
            )}

            {/* Interactive Simulation Acceptance Runner */}
            <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3 bg-white dark:bg-[#111C2C]">
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100">
                {biText(
                  locale,
                  'Log Simulated Acceptance Test Result (Does NOT Authorize Production)',
                  'የሙከራ ፍተሻ ውጤት መዝግብ (ለምርት ፈቃድ አይሰጥም)'
                )}
              </h3>
              <textarea
                rows={2}
                value={testNote}
                onChange={(e) => setTestNote(e.target.value)}
                placeholder={biText(
                  locale,
                  'Enter reviewer observation note...',
                  'የገምጋሚ አስተያየት ያስገቡ...'
                )}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canRunTest.allowed}
                  onClick={() => runAcceptanceScenario(selectedReq.id, 'Pass (Sim)', testNote)}
                  className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{biText(locale, 'Record Pass (Sim)', 'ማለፉን መዝግብ (Sim)')}</span>
                </button>
                <button
                  type="button"
                  disabled={!canRunTest.allowed}
                  onClick={() =>
                    runAcceptanceScenario(selectedReq.id, 'Blocked (Expected)', testNote)
                  }
                  className="px-3.5 py-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-[#D9A441]/60 dark:border-amber-700/70 hover:bg-amber-200/80 dark:hover:bg-amber-900/50 text-amber-950 dark:text-amber-200 font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>
                    {biText(locale, 'Record Blocked (Expected Gate)', 'በገደብ መታገዱን መዝግብ')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
};
