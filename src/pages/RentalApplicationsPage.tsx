import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, Plus, Send, XCircle } from 'lucide-react';
import { usePrms } from '../context/PrmsContext';
import { biText } from '../data/i18n';
import { checkActionPermission } from '../policies/rbac';
import { RentalApplicationRecord } from '../types/prms';
import {
  EmptyState,
  GovernanceCallout,
  Modal,
  SlideDrawer,
  StatusLabel,
} from '../components/ui/Primitives';

export const RentalApplicationsPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    locale,
    fmtDate,
    fmtEtb,
    ownerRentalApplications,
    ownerUnits,
    createRentalApplication,
    submitRentalApplication,
    decideRentalApplication,
    convertApplicationToLease,
  } = usePrms();

  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState({
    applicantName: '',
    businessType: '',
    requestedUnitId: ownerUnits[0]?.id || '',
    proposedRentEtb: 45000,
    evidenceRef: 'EVD-APP-SYNTH-NEW',
    notes: 'Synthetic applicant screening dossier — not real KYC/identity data.',
  });

  const canCreate = checkActionPermission(currentPersona.role, 'create_rental_application');
  const canDecide = checkActionPermission(currentPersona.role, 'decide_rental_application');
  const canConvert = checkActionPermission(currentPersona.role, 'create_lease');

  const filtered = useMemo(
    () =>
      ownerRentalApplications.filter((a) =>
        statusFilter === 'All' ? true : a.status === statusFilter
      ),
    [ownerRentalApplications, statusFilter]
  );

  const selectedApp: RentalApplicationRecord | null = useMemo(
    () => ownerRentalApplications.find((a) => a.id === selectedId) || null,
    [ownerRentalApplications, selectedId]
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.applicantName.trim() || !form.requestedUnitId) return;
    if (createRentalApplication(form)) {
      setCreateOpen(false);
      setForm({
        applicantName: '',
        businessType: '',
        requestedUnitId: ownerUnits[0]?.id || '',
        proposedRentEtb: 45000,
        evidenceRef: 'EVD-APP-SYNTH-NEW',
        notes: 'Synthetic applicant screening dossier — not real KYC/identity data.',
      });
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549]';

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          `Rental Applications & Screening Intake — ${activeOwner.name}`,
          `የኪራይ ማመልከቻዎች እና የማጣሪያ ሂደት — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          'Applications store synthetic placeholder documents and screening checklists only. Conversion into a Draft Lease and synthetic tenant is strictly blocked until Owner / GM approval.',
          'ማመልከቻዎች የሙከራ ሰነድ ምልክቶችን ብቻ ይይዛሉ። ማመልከቻው በባለቤት ወይም በዋና ሥራ አስኪያጅ ሳይጸድቅ ወደ ረቂቅ ውል መቀየር አይቻልም።'
        )}
        controlType="Prototype Simulation"
        action={
          <button
            type="button"
            disabled={!canCreate.allowed}
            title={canCreate.reason}
            onClick={() => setCreateOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {biText(locale, 'New Synthetic Application', 'አዲስ የኪራይ ማመልከቻ')}
            </span>
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3">
        {['All', 'Draft', 'Submitted', 'Approved', 'Rejected', 'Converted to Lease (Draft)'].map(
          (st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#0F233A] dark:bg-[#166549] text-white'
                  : 'bg-[#F4F6F9] dark:bg-[#162438] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1B2B44]'
              }`}
            >
              {st === 'All' ? biText(locale, 'All Applications', 'ሁሉም ማመልከቻዎች') : st}
            </button>
          )
        )}
      </div>

      {/* Applications Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={biText(locale, 'No Matching Applications', 'የሚዛመድ ማመልከቻ የለም')}
              description={biText(
                locale,
                'No rental applications match the selected filter inside this owner context.',
                'በተመረጠው ባለቤት ውስጥ ከማጣሪያው ጋር የሚዛመድ ማመልከቻ የለም።'
              )}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Application #', 'የማመልከቻ ቁጥር')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Synthetic Applicant', 'አመልካች (ሰው-ሠራሽ)')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Requested Unit', 'የተጠየቀ ክፍል')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Applied Date', 'የቀረበበት ቀን')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    {biText(locale, 'Proposed Rent', 'የቀረበ ኪራይ')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Status', 'ሁኔታ')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    {biText(locale, 'Actions', 'እርምጃዎች')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                {filtered.map((app) => {
                  const unit = ownerUnits.find((u) => u.id === app.requestedUnitId);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-[#162438]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                        {app.applicationNumber}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{app.applicantName}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{app.businessType}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {unit ? `${unit.code} — ${unit.name}` : app.requestedUnitId}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {fmtDate(app.appliedDate)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-900 dark:text-slate-100">
                        {fmtEtb(app.proposedRentEtb)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel label={app.status} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedId(app.id)}
                          className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          {biText(locale, 'Dossier', 'ማህደር')}
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

      {/* Application Dossier & Workflow Drawer */}
      <SlideDrawer
        open={Boolean(selectedApp)}
        onClose={() => setSelectedId(null)}
        title={selectedApp ? `${selectedApp.applicationNumber} — ${selectedApp.applicantName}` : ''}
        subtitle={selectedApp?.businessType}
      >
        {selectedApp && (
          <div className="space-y-5 text-xs">
            <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236] grid grid-cols-2 gap-3">
              <div>
                <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Status', 'ሁኔታ')}</p>
                <div className="mt-1">
                  <StatusLabel label={selectedApp.status} />
                </div>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Proposed Monthly Rent', 'የቀረበ ወርሃዊ ኪራይ')}</p>
                <p className="font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C] mt-1">
                  {fmtEtb(selectedApp.proposedRentEtb)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Applied Date', 'የቀረበበት ቀን')}</p>
                <p className="font-mono mt-1">{fmtDate(selectedApp.appliedDate)}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Evidence Ref', 'የማስረጃ ቁጥር')}</p>
                <p className="font-mono mt-1">{selectedApp.evidenceRef}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Notes', 'ማስታወሻ')}</p>
                <p className="text-slate-800 dark:text-slate-200 mt-1">{selectedApp.notes}</p>
              </div>
            </div>

            {/* Synthetic Document Placeholders */}
            <div>
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 mb-2">
                {biText(locale, 'Document Placeholders (Synthetic Only)', 'የሰነድ ምልክቶች (ሰው-ሠራሽ ብቻ)')}
              </h3>
              <div className="space-y-1.5">
                {selectedApp.documentPlaceholders.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#162438]"
                  >
                    <span className="text-slate-800 dark:text-slate-200">{d.label}</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">{d.refCode}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Screening Checklist */}
            <div>
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 mb-2 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
                <span>{biText(locale, 'Screening Checklist', 'የማጣሪያ ዝርዝር (Checklist)')}</span>
              </h3>
              <div className="space-y-1.5">
                {selectedApp.screeningChecklist.map((chk) => (
                  <div
                    key={chk.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]"
                  >
                    <span className="text-slate-800 dark:text-slate-200">{chk.item}</span>
                    <StatusLabel label={chk.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Actions */}
            <div className="border-t border-[#DFE5EE] dark:border-[#233349] pt-4 space-y-3">
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100">
                {biText(locale, 'Application Decision & Lease Conversion', 'የማመልከቻ ውሳኔ እና ወደ ውል መቀየሪያ')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedApp.status === 'Draft' && (
                  <button
                    type="button"
                    disabled={!canCreate.allowed}
                    title={canCreate.reason}
                    onClick={() => submitRentalApplication(selectedApp.id)}
                    className="px-3.5 py-2 rounded-lg bg-[#0F233A] dark:bg-[#166549] text-white font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{biText(locale, 'Submit for Screening Decision', 'ለውሳኔ አስገባ')}</span>
                  </button>
                )}

                {selectedApp.status === 'Submitted' && (
                  <>
                    <button
                      type="button"
                      disabled={!canDecide.allowed}
                      title={canDecide.reason}
                      onClick={() => decideRentalApplication(selectedApp.id, 'Approved')}
                      className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{biText(locale, 'Approve Application', 'ማመልከቻ አጽድቅ')}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!canDecide.allowed}
                      title={canDecide.reason}
                      onClick={() => decideRentalApplication(selectedApp.id, 'Rejected')}
                      className="px-3.5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{biText(locale, 'Reject Application', 'ውድቅ አድርግ')}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  disabled={selectedApp.status !== 'Approved' || !canConvert.allowed}
                  title={
                    selectedApp.status !== 'Approved'
                      ? biText(
                          locale,
                          'Conversion strictly blocked until application status is Approved.',
                          'ማመልከቻው ሳይጸድቅ ወደ ረቂቅ ውል መቀየር አይቻልም።'
                        )
                      : canConvert.reason
                  }
                  onClick={() => convertApplicationToLease(selectedApp.id)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>
                    {biText(
                      locale,
                      'Convert Approved Application to Draft Lease',
                      'የጸደቀውን ማመልከቻ ወደ ረቂቅ ውል ቀይር'
                    )}
                  </span>
                </button>
              </div>
              {selectedApp.status !== 'Approved' && (
                <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-2">
                  {biText(
                    locale,
                    'Lease Conversion Gate: Only Approved applications can create a synthetic tenant & Draft lease.',
                    'የውል መቀየሪያ ገደብ፦ የጸደቁ ማመልከቻዎች ብቻ ወደ ረቂቅ ውልና ሰው-ሠራሽ ተከራይ ሊቀየሩ ይችላሉ።'
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* New Application Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={biText(locale, 'New Synthetic Rental Application', 'አዲስ የሙከራ ኪራይ ማመልከቻ')}
        subtitle={biText(
          locale,
          `Isolated to ${activeOwner.name}. Use clearly fake applicant names only.`,
          `ለ ${activeOwner.name} ብቻ የተገደበ። ሰው-ሠራሽ ስም ብቻ ይጠቀሙ።`
        )}
      >
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Synthetic Applicant Name *', 'የአመልካች ሰው-ሠራሽ ስም *')}
            </label>
            <input
              required
              value={form.applicantName}
              onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
              placeholder="e.g. SYNTH Applicant 109"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Business Type Placeholder', 'የሥራ ዘርፍ (ምሳሌ)')}
              </label>
              <input
                required
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                placeholder="e.g. Retail Electronics Placeholder"
                className={inputCls}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Requested Unit *', 'የተጠየቀ ክፍል *')}
              </label>
              <select
                value={form.requestedUnitId}
                onChange={(e) => setForm({ ...form, requestedUnitId: e.target.value })}
                className={inputCls}
              >
                {ownerUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name} ({u.status})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Proposed Monthly Rent (ETB)', 'የቀረበ ወርሃዊ ኪራይ (ETB)')}
              </label>
              <input
                type="number"
                required
                min={1000}
                value={form.proposedRentEtb}
                onChange={(e) => setForm({ ...form, proposedRentEtb: Number(e.target.value) })}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Document Evidence Ref *', 'የሰነድ ማስረጃ ቁጥር *')}
              </label>
              <input
                required
                value={form.evidenceRef}
                onChange={(e) => setForm({ ...form, evidenceRef: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Screening Notes', 'የማጣሪያ ማስታወሻ')}
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
            >
              {biText(locale, 'Cancel', 'ሰርዝ')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer"
            >
              {biText(locale, 'Save Draft Application', 'ረቂቅ አስቀምጥ')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
