import React, { useMemo, useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { usePrms } from '../context/PrmsContext';
import { biText } from '../data/i18n';
import { AuditEvent } from '../types/prms';
import {
  EmptyState,
  ExportPreviewModal,
  GovernanceCallout,
  PaginationBar,
  SavedFilterBar,
  SlideDrawer,
  SortableTh,
  StatusLabel,
} from '../components/ui/Primitives';

type AuditQuickPreset = 'all' | 'denied' | 'approvals' | 'session';

export const AuditTrailPage: React.FC = () => {
  const { activeOwner, ownerAuditEvents, locale, fmtDateTime, logReportExport } = usePrms();

  const [preset, setPreset] = useState<AuditQuickPreset>('all');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actorFilter, setActorFilter] = useState('All');
  const [actionQuery, setActionQuery] = useState('');
  const [recordQuery, setRecordQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [sortKey, setSortKey] = useState<'timestamp' | 'module' | 'action'>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);

  const uniqueModules = useMemo(
    () => ['All', ...Array.from(new Set(ownerAuditEvents.map((e) => e.module)))],
    [ownerAuditEvents]
  );
  const uniqueActors = useMemo(
    () => ['All', ...Array.from(new Set(ownerAuditEvents.map((e) => e.actor)))],
    [ownerAuditEvents]
  );

  const handleSort = (col: string) => {
    const k = col as typeof sortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir(k === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const filteredEvents = useMemo(() => {
    const list = ownerAuditEvents.filter((evt) => {
      if (preset === 'denied' && !evt.action.toLowerCase().includes('denied')) return false;
      if (preset === 'approvals' && evt.module !== 'Approvals Centre') return false;
      if (
        preset === 'session' &&
        evt.module !== 'Security & Access' &&
        !evt.action.toLowerCase().includes('session')
      ) {
        return false;
      }
      if (moduleFilter !== 'All' && evt.module !== moduleFilter) return false;
      if (actorFilter !== 'All' && evt.actor !== actorFilter) return false;
      if (
        actionQuery.trim() &&
        !evt.action.toLowerCase().includes(actionQuery.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        recordQuery.trim() &&
        !evt.recordId.toLowerCase().includes(recordQuery.trim().toLowerCase()) &&
        !evt.recordType.toLowerCase().includes(recordQuery.trim().toLowerCase())
      ) {
        return false;
      }
      if (dateFrom && evt.timestamp.slice(0, 10) < dateFrom) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      const av = String(a[sortKey] || '');
      const bv = String(b[sortKey] || '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [
    ownerAuditEvents,
    preset,
    moduleFilter,
    actorFilter,
    actionQuery,
    recordQuery,
    dateFrom,
    sortKey,
    sortDir,
  ]);

  const pagedEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, page]);

  return (
    <div className="space-y-5">
      <GovernanceCallout
        title={biText(
          locale,
          'Immutable Append-Only Audit Trail — View Only',
          'የማይፋቅ የኦዲት መዝገብ — ለንባብ ብቻ'
        )}
        description={biText(
          locale,
          `Audit events can be inspected and preview-exported, but NEVER edited or deleted—even by a System Administrator. Events shown are strictly scoped to ${activeOwner.name} with Actor ID and Africa/Addis_Ababa timestamps.`,
          `የኦዲት መዝገቦች በሲስተም አስተዳዳሪ እንኳን አይስተካከሉም ወይም አይሰረዙም። የሚታዩት መዝገቦች ለ ${activeOwner.name} ብቻ የተገደቡ ናቸው።`
        )}
        controlType="Prototype Simulation"
        action={
          <button
            type="button"
            onClick={() => setExportPreviewOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-[#0F233A] dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Export Audit Preview', 'የኦዲት ወጪ ቅድመ-ዕይታ')}</span>
          </button>
        }
      />

      {/* Saved Filters + Multi-Dimensional Filter Bar */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3 text-xs shadow-xs">
        <SavedFilterBar
          presets={[
            {
              id: 'all',
              label: biText(locale, 'All Events', 'ሁሉም'),
              value: 'all' as AuditQuickPreset,
              count: ownerAuditEvents.length,
            },
            {
              id: 'denied',
              label: biText(locale, 'Denied / Policy Blocks', 'የታገዱ ሙከራዎች'),
              value: 'denied' as AuditQuickPreset,
              count: ownerAuditEvents.filter((e) => e.action.toLowerCase().includes('denied')).length,
            },
            {
              id: 'approvals',
              label: biText(locale, 'Approvals Decisions', 'የማጽደቂያ ውሳኔዎች'),
              value: 'approvals' as AuditQuickPreset,
              count: ownerAuditEvents.filter((e) => e.module === 'Approvals Centre').length,
            },
            {
              id: 'session',
              label: biText(locale, 'Security & Sessions', 'ደህንነት እና ክፍለ-ጊዜ'),
              value: 'session' as AuditQuickPreset,
              count: ownerAuditEvents.filter((e) => e.module === 'Security & Access').length,
            },
          ]}
          activeValue={preset}
          onSelect={(v) => {
            setPreset(v);
            setPage(1);
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100 dark:border-[#1D2D42]">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'Owner Scope (Locked)', 'የባለቤት ክልል (የተቆለፈ)')}
            </label>
            <div className="px-3 py-2 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F1F5F9] dark:bg-[#152236] text-slate-700 dark:text-[#E5B85C] font-mono flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" />
              <span className="truncate">{activeOwner.name}</span>
            </div>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'Module', 'ክፍል')}
            </label>
            <select
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            >
              {uniqueModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'Actor', 'ተጠቃሚ')}
            </label>
            <select
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            >
              {uniqueActors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'Action Keyword', 'የእርምጃ ቁልፍ ቃል')}
            </label>
            <input
              value={actionQuery}
              onChange={(e) => {
                setActionQuery(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. Approved, Denied..."
              className="w-full px-2.5 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'Record / ID', 'መዝገብ / መለያ')}
            </label>
            <input
              value={recordQuery}
              onChange={(e) => {
                setRecordQuery(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. UNIT-A201"
              className="w-full px-2.5 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {biText(locale, 'From Date', 'ከቀን ጀምሮ')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
            />
          </div>
        </div>
      </section>

      {/* Immutable Audit Table (Strictly zero edit/delete actions) */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        {pagedEvents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={biText(locale, 'No Audit Events Match Filters', 'ከማጣሪያው ጋር የሚዛመድ የኦዲት መዝገብ የለም')}
              description={biText(
                locale,
                'Clear one or more filter fields to view the full immutable timeline for the active owner.',
                'ሙሉውን የኦዲት ታሪክ ለማየት ማጣሪያዎቹን ያጽዱ።'
              )}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setPreset('all');
                    setModuleFilter('All');
                    setActorFilter('All');
                    setActionQuery('');
                    setRecordQuery('');
                    setDateFrom('');
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  {biText(locale, 'Reset Filters', 'ማጣሪያ አጽዳ')}
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
                      label={biText(locale, 'Timestamp (Addis Ababa)', 'ቀንና ሰዓት')}
                      columnKey="timestamp"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Event ID', 'የመዝገብ መለያ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Actor & Actor ID', 'ተጠቃሚ እና ሚና')}</th>
                    <SortableTh
                      label={biText(locale, 'Module', 'ክፍል')}
                      columnKey="module"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableTh
                      label={biText(locale, 'Action', 'እርምጃ')}
                      columnKey="action"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Record', 'መዝገብ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Mode', 'ሁኔታ')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Inspect', 'መርምር')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {pagedEvents.map((evt) => (
                    <tr
                      key={evt.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {fmtDateTime(evt.timestamp)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-[#E5B85C]">
                        {evt.id}
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{evt.actor}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {evt.persona} {evt.actorId ? `· ${evt.actorId}` : ''}
                        </p>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        {evt.module}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#0F233A] dark:text-slate-100">
                        {evt.action}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {evt.recordType} · {evt.recordId}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusLabel label={evt.executionMode || 'Simulation'} tone="slate" />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(evt)}
                          className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          {biText(locale, 'Detail', 'ዝርዝር')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalItems={filteredEvents.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* Immutable Event Detail Drawer */}
      <SlideDrawer
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? `Audit Event ${selectedEvent.id}` : ''}
        subtitle={biText(
          locale,
          'Immutable record — no edit or delete capabilities exist',
          'የማይፋቅ መዝገብ — ማረም ወይም መሰረዝ አይቻልም'
        )}
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <dl className="grid grid-cols-2 gap-3 border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236]">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Timestamp', 'ቀንና ሰዓት')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {fmtDateTime(selectedEvent.timestamp)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Owner Scope', 'የባለቤት ክልል')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-[#E5B85C] mt-0.5">
                  {selectedEvent.ownerId}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Actor & Actor ID', 'ተጠቃሚ እና መታወቂያ')}
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedEvent.actor} ({selectedEvent.persona})
                  {selectedEvent.actorId ? ` · ${selectedEvent.actorId}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Module / Action', 'ክፍል / እርምጃ')}
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedEvent.module} · {selectedEvent.action}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Evidence Reference', 'የማስረጃ ቁጥር')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedEvent.evidenceRef || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Linked Approval', 'ተዛማጅ ማጽደቂያ')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedEvent.linkedApprovalId || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Execution Mode', 'ሁኔታ')}
                </dt>
                <dd className="mt-0.5">
                  <StatusLabel label={selectedEvent.executionMode || 'Simulation'} tone="slate" />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Record Target', 'ዒላማ መዝገብ')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedEvent.recordType} · {selectedEvent.recordId}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Reason', 'ምክንያት')}
                </dt>
                <dd className="text-slate-900 dark:text-slate-200 mt-0.5">
                  {selectedEvent.reason}
                </dd>
              </div>
            </dl>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236]">
                <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  {biText(locale, 'Before Values', 'የበፊት እሴቶች')}
                </p>
                {selectedEvent.beforeValues ? (
                  <pre className="font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {JSON.stringify(selectedEvent.beforeValues, null, 2)}
                  </pre>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">
                    None (new creation or read event)
                  </p>
                )}
              </div>
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236]">
                <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  {biText(locale, 'After Values', 'የኋላ እሴቶች')}
                </p>
                {selectedEvent.afterValues ? (
                  <pre className="font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {JSON.stringify(selectedEvent.afterValues, null, 2)}
                  </pre>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">None</p>
                )}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      <ExportPreviewModal
        open={exportPreviewOpen}
        onClose={() => setExportPreviewOpen(false)}
        title="Immutable Audit Log Export"
        format="Excel"
        ownerName={activeOwner.name}
        rowCount={filteredEvents.length}
        previewColumns={['Timestamp', 'Event ID', 'Actor', 'Module', 'Action']}
        previewRows={filteredEvents.map((e) => [
          fmtDateTime(e.timestamp),
          e.id,
          `${e.actor} (${e.actorId})`,
          e.module,
          e.action,
        ])}
        onConfirmExport={() => logReportExport('Immutable Audit Trail Export', 'Excel')}
      />
    </div>
  );
};
