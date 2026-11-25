import React, { useMemo, useState } from 'react';
import { MessageSquare, Plus, Send, Wrench } from 'lucide-react';
import { usePrms } from '../context/PrmsContext';
import { biText } from '../data/i18n';
import { checkActionPermission } from '../policies/rbac';
import { MaintenanceTicketRecord } from '../types/prms';
import {
  EmptyState,
  GovernanceCallout,
  Modal,
  SlideDrawer,
  StatusLabel,
} from '../components/ui/Primitives';
import {
  DocumentUploadField,
  UploadedEvidenceFile,
} from '../components/ui/DocumentUploadField';

export const MaintenanceComplaintsPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    locale,
    fmtDate,
    fmtDateTime,
    fmtEtb,
    ownerMaintenanceTickets,
    ownerMaintenanceMessages,
    ownerUnits,
    createMaintenanceTicket,
    advanceMaintenanceWorkOrder,
    sendMaintenanceMessage,
  } = usePrms();

  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Maintenance' | 'Complaint'>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyVisibility, setReplyVisibility] = useState<'Shared with Tenant' | 'Internal Staff Note'>(
    'Shared with Tenant'
  );

  const [evidenceFile, setEvidenceFile] = useState<UploadedEvidenceFile | null>(null);
  const [form, setForm] = useState({
    unitId: ownerUnits[0]?.id || '',
    category: 'Maintenance' as 'Maintenance' | 'Complaint',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    title: '',
    description: '',
    estimatedCostEtb: 4500,
    evidenceRef: 'EVD-MNT-SYNTH',
    applyUnitStatus: false,
  });

  const canCreate = checkActionPermission(currentPersona.role, 'create_maintenance_ticket');

  const filtered = useMemo(
    () =>
      ownerMaintenanceTickets.filter((m) =>
        categoryFilter === 'All' ? true : m.category === categoryFilter
      ),
    [ownerMaintenanceTickets, categoryFilter]
  );

  const selectedTicket: MaintenanceTicketRecord | null = useMemo(
    () => ownerMaintenanceTickets.find((m) => m.id === selectedId) || null,
    [ownerMaintenanceTickets, selectedId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.unitId) return;
    if (createMaintenanceTicket(form)) {
      setCreateOpen(false);
      setEvidenceFile(null);
      setForm({
        unitId: ownerUnits[0]?.id || '',
        category: 'Maintenance',
        priority: 'Medium',
        title: '',
        description: '',
        estimatedCostEtb: 4500,
        evidenceRef: 'EVD-MNT-SYNTH',
        applyUnitStatus: false,
      });
    }
  };

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          `Maintenance & Tenant Complaints — ${activeOwner.name}`,
          `የጥገና እና የተከራይ ቅሬታ መዝገብ — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          'Work orders estimated >= ETB 10,000 route automatically to Approvals Centre. Tickets can temporarily place a unit into Maintenance status with full non-destructive timeline logging.',
          'ከ ETB 10,000 በላይ ግምት ያላቸው የጥገና ሥራዎች ወደ ማጽደቂያ ማዕከል ይላካሉ። ክፍሎችን በጥገና ሁኔታ ላይ ማስቀመጥ እና ታሪኩን መመዝገብ ይቻላል።'
        )}
        controlType="Prototype Simulation"
        action={
          <button
            type="button"
            disabled={!canCreate.allowed}
            title={canCreate.reason}
            onClick={() => setCreateOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Log Ticket / Complaint', 'አዲስ ጥገና / ቅሬታ መዝግብ')}</span>
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-2.5 shadow-xs">
        {(['All', 'Maintenance', 'Complaint'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              categoryFilter === cat
                ? 'bg-[#0F233A] text-white dark:bg-[#166549]'
                : 'bg-[#F4F6F9] dark:bg-[#152236] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#1D2E48]'
            }`}
          >
            {cat === 'All' ? biText(locale, 'All Tickets', 'ሁሉም መዝገቦች') : cat}
          </button>
        ))}
      </div>

      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={biText(locale, 'No Maintenance Tickets', 'ምንም የጥገና መዝገብ የለም')}
              description={biText(
                locale,
                'No maintenance or complaint tickets exist for the selected filter.',
                'ከተመረጠው ማጣሪያ ጋር የሚዛመድ የጥገና ወይም የቅሬታ መዝገብ የለም።'
              )}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Ticket #', 'መለያ #')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Unit & Issue', 'ክፍል እና ጉዳይ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Priority', 'ቅድሚያ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Reported', 'ሪፖርት ቀን')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    {biText(locale, 'Est. Cost', 'ግምታዊ ወጪ')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Work Order', 'የሥራ ሁኔታ')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Detail', 'ዝርዝር')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {filtered.map((t) => {
                  const unit = ownerUnits.find((u) => u.id === t.unitId);
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                        <p>{t.ticketNumber}</p>
                        <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          {t.category}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {unit ? `${unit.code} (${unit.status})` : t.unitId}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel label={t.priority} />
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {fmtDate(t.reportedDate)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-900 dark:text-slate-100">
                        {fmtEtb(t.estimatedCostEtb)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel label={t.workOrderState} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          {biText(locale, 'Inspect', 'መርምር')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SlideDrawer
        open={Boolean(selectedTicket)}
        onClose={() => setSelectedId(null)}
        title={selectedTicket ? `${selectedTicket.ticketNumber} — ${selectedTicket.title}` : ''}
        subtitle={selectedTicket?.category}
      >
        {selectedTicket && (
          <div className="space-y-5 text-xs">
            <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236] grid grid-cols-2 gap-3">
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Work Order State', 'የሥራ ትዕዛዝ ሁኔታ')}
                </p>
                <div className="mt-1">
                  <StatusLabel label={selectedTicket.workOrderState} />
                </div>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Estimated Cost (ETB)', 'ግምታዊ ወጪ')}
                </p>
                <p className="font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C] mt-1">
                  {fmtEtb(selectedTicket.estimatedCostEtb)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Reported Date', 'ሪፖርት የተደረገበት ቀን')}
                </p>
                <p className="font-mono text-slate-800 dark:text-slate-200 mt-1">
                  {fmtDate(selectedTicket.reportedDate)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Evidence Ref', 'የማስረጃ ቁጥር')}
                </p>
                <p className="font-mono text-slate-800 dark:text-slate-200 mt-1">
                  {selectedTicket.evidenceRef}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Description', 'ዝርዝር መግለጫ')}
                </p>
                <p className="text-slate-800 dark:text-slate-200 mt-1">
                  {selectedTicket.description}
                </p>
              </div>
            </div>

            {/* Lifecycle Transitions */}
            <div className="space-y-2">
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
                <span>{biText(locale, 'Work-Order Simulation Controls', 'የሥራ ቅደም-ተከተል መቆጣጠሪያ')}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {(['Assessed', 'Scheduled', 'Completed (Sim)', 'Closed'] as const).map((next) => (
                  <button
                    key={next}
                    type="button"
                    disabled={
                      !canCreate.allowed ||
                      selectedTicket.workOrderState === 'Cost Approval Pending'
                    }
                    title={
                      selectedTicket.workOrderState === 'Cost Approval Pending'
                        ? biText(
                            locale,
                            'Blocked until >= ETB 10,000 cost request is approved in Approvals Centre.',
                            'ከ ETB 10,000 በላይ የሆነው ወጪ በማጽደቂያ ማዕከል እስኪጸድቅ ታግዷል።'
                          )
                        : canCreate.reason
                    }
                    onClick={() => advanceMaintenanceWorkOrder(selectedTicket.id, next)}
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#1D2E48] font-semibold disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    {next}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!canCreate.allowed}
                  onClick={() =>
                    advanceMaintenanceWorkOrder(
                      selectedTicket.id,
                      selectedTicket.workOrderState,
                      !selectedTicket.unitMaintenanceStatusApplied
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#FDF8EC] dark:bg-amber-950/50 border border-[#E5C983] dark:border-amber-700/60 text-amber-950 dark:text-amber-200 font-semibold disabled:opacity-40 cursor-pointer transition-colors"
                >
                  {selectedTicket.unitMaintenanceStatusApplied
                    ? biText(locale, 'Release Unit Maintenance Status', 'የክፍሉን የጥገና ሁኔታ አንሳ')
                    : biText(locale, 'Mark Unit as Maintenance', 'ክፍሉን በጥገና ሁኔታ ላይ አድርግ')}
                </button>
              </div>
            </div>

            {/* Live Two-Way Communication Thread */}
            <div className="space-y-2.5">
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
                <span>
                  {biText(locale, 'Two-Way Tenant & Staff Communication', 'የተከራይና የቢሮ ሁለት-አቅጣጫ ውይይት')}
                </span>
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {ownerMaintenanceMessages
                  .filter((m) => m.ticketId === selectedTicket.id)
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg p-3 border ${
                        msg.visibility === 'Internal Staff Note'
                          ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800'
                          : 'bg-[#F8FAFC] dark:bg-[#152236] border-[#DFE5EE] dark:border-[#233349]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                        <span className="font-semibold text-[#0F233A] dark:text-slate-100">
                          {msg.senderName}{' '}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            · {msg.visibility}
                          </span>
                        </span>
                        <span className="font-mono text-slate-400">{fmtDateTime(msg.timestamp)}</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200">{msg.body}</p>
                    </div>
                  ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!replyBody.trim()) return;
                  if (
                    sendMaintenanceMessage({
                      ticketId: selectedTicket.id,
                      body: replyBody.trim(),
                      visibility: replyVisibility,
                      asTenant: false,
                    })
                  ) {
                    setReplyBody('');
                  }
                }}
                className="space-y-2 pt-2 border-t border-[#DFE5EE] dark:border-[#233349]"
              >
                <div className="flex items-center gap-2">
                  {(['Shared with Tenant', 'Internal Staff Note'] as const).map((vis) => (
                    <button
                      key={vis}
                      type="button"
                      onClick={() => setReplyVisibility(vis)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer ${
                        replyVisibility === vis
                          ? 'border-[#166549] bg-emerald-50/70 dark:bg-emerald-950/30 text-[#166549] dark:text-emerald-300'
                          : 'border-[#CBD5E1] dark:border-[#2D405B] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {vis}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={biText(locale, 'Type reply or internal note…', 'መልስ ወይም የውስጥ ማስታወሻ ይጻፉ…')}
                    className="flex-1 px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{biText(locale, 'Send', 'ላክ')}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 mb-2">
                {biText(locale, 'Ticket Audit Timeline', 'የቲኬት ታሪክ መዝገብ')}
              </h3>
              <div className="space-y-2">
                {selectedTicket.timeline.map((t, i) => (
                  <div
                    key={i}
                    className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {t.event}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {fmtDateTime(t.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{t.actor}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={biText(locale, 'Log Maintenance / Complaint Ticket', 'የጥገና ወይም የቅሬታ መዝግብ ክፈት')}
        subtitle={biText(
          locale,
          'Estimates >= ETB 10,000 require maker-checker cost approval.',
          'ከ ETB 10,000 በላይ ግምት ያላቸው ጥገናዎች ማጽደቂያ ይፈልጋሉ።'
        )}
      >
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Unit *', 'ክፍል *')}
              </label>
              <select
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
              >
                {ownerUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Category & Priority', 'ምድብ እና ቅድሚያ')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as 'Maintenance' | 'Complaint' })
                  }
                  className="px-2 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
                >
                  <option value="Maintenance">Maintenance</option>
                  <option value="Complaint">Complaint</option>
                </select>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value as 'Low' | 'Medium' | 'High' | 'Urgent',
                    })
                  }
                  className="px-2 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Ticket Title *', 'የጉዳዩ ርዕስ *')}
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Ceiling water stain inspection"
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Description', 'ዝርዝር መግለጫ')}
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Estimated Cost (ETB)', 'ግምታዊ ወጪ (ETB)')}
              </label>
              <input
                type="number"
                min={0}
                value={form.estimatedCostEtb}
                onChange={(e) => setForm({ ...form, estimatedCostEtb: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Evidence Ref *', 'የማስረጃ ቁጥር *')}
              </label>
              <input
                required
                value={form.evidenceRef}
                onChange={(e) => setForm({ ...form, evidenceRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
          </div>
          <DocumentUploadField
            entityType="REPAIR_PHOTO"
            entityRefId={form.unitId}
            label={biText(locale, 'Repair Photo / Attachment (Object Storage)', 'የጥገና ፎቶ / ማስረጃ')}
            helperText={biText(locale, 'Attach Photo or PDF (JPEG/PNG/WEBP/PDF <= 10 MB)', 'ፎቶ ወይም PDF ያያይዙ (<= 10 MB)')}
            value={evidenceFile}
            onChange={(file) => {
              setEvidenceFile(file);
              if (file) {
                setForm((prev) => ({
                  ...prev,
                  evidenceRef: `${file.objectKey.split('/').pop() || file.filename} · ${file.sha256.slice(0, 8)}`,
                }));
              }
            }}
          />
          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200 pt-1">
            <input
              type="checkbox"
              checked={form.applyUnitStatus}
              onChange={(e) => setForm({ ...form, applyUnitStatus: e.target.checked })}
              className="rounded border-[#CBD5E1] dark:border-[#2D405B]"
            />
            <span>
              {biText(
                locale,
                'Set unit status to Maintenance immediately',
                'የክፍሉን ሁኔታ ወዲያውኑ ወደ ጥገና ቀይር'
              )}
            </span>
          </label>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] cursor-pointer"
            >
              {biText(locale, 'Cancel', 'ሰርዝ')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer transition-colors"
            >
              {biText(locale, 'Log Ticket', 'መዝግብ')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
