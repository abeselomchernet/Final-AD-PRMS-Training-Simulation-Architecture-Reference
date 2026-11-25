import React, { useMemo, useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { usePrms } from '../context/PrmsContext';
import { biText } from '../data/i18n';
import { checkActionPermission } from '../policies/rbac';
import { EmptyState, GovernanceCallout, Modal, StatusLabel } from '../components/ui/Primitives';

export const ExpensesPayablesPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    locale,
    fmtDate,
    fmtEtb,
    ownerExpenses,
    ownerAccounts,
    createExpenseRequest,
    submitExpenseForApproval,
  } = usePrms();

  const [createOpen, setCreateOpen] = useState(false);
  const expenseAccounts = useMemo(
    () => ownerAccounts.filter((a) => a.category === 'Expenses'),
    [ownerAccounts]
  );

  const [form, setForm] = useState({
    supplierPlaceholder: '',
    description: '',
    accountCode: expenseAccounts[0]?.code || '5100-ALPHA',
    amountEtb: 14500,
    dueDate: '2026-12-05',
    invoiceEvidenceRef: 'EVD-SUP-INV-SYNTH',
    notes: 'Payment proposal only — no live bank transfer or production accounting posting.',
  });

  const canCreate = checkActionPermission(currentPersona.role, 'create_expense_request');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierPlaceholder.trim() || !form.description.trim()) return;
    if (createExpenseRequest(form)) {
      setCreateOpen(false);
      setForm({
        supplierPlaceholder: '',
        description: '',
        accountCode: expenseAccounts[0]?.code || '5100-ALPHA',
        amountEtb: 14500,
        dueDate: '2026-12-05',
        invoiceEvidenceRef: 'EVD-SUP-INV-SYNTH',
        notes: 'Payment proposal only — no live bank transfer or production accounting posting.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          `Expenses & Payables (Payment Proposal Simulation Only) — ${activeOwner.name}`,
          `ወጪዎች እና ተከፋይ ሂሳቦች (የክፍያ ሀሳብ ማስመሰያ ብቻ) — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          'Coded to unapproved draft Chart of Accounts codes. Requests > ETB 25,000 require Two-Step approval (GM + Owner). Approved items remain Payment Proposals Only — no bank transfer, cheque printing, or production ledger posting exists.',
          'ወጪዎች ወደ ረቂቅ የሂሳብ መደቦች ይመደባሉ። ከ ETB 25,000 በላይ የሆኑ ጥያቄዎች ባለ ሁለት ደረጃ ማጽደቂያ ይፈልጋሉ። የጸደቁት የክፍያ ሀሳብ ብቻ ናቸው — የባንክ ዝውውር አይፈጸምም።'
        )}
        variant="warning"
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
            <span>{biText(locale, 'New Expense Draft', 'አዲስ የወጪ ረቂቅ')}</span>
          </button>
        }
      />

      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
        {ownerExpenses.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={biText(locale, 'No Expense Requests', 'ምንም የወጪ ጥያቄ የለም')}
              description={biText(
                locale,
                'No synthetic expense proposals recorded in the active owner context.',
                'በንቁው ባለቤት ክልል ውስጥ የወጪ ሀሳብ አልተመዘገበም።'
              )}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Request #', 'ጥያቄ #')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Synthetic Supplier & Description', 'አቅራቢ እና መግለጫ')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Draft CoA Code', 'ረቂቅ የሂሳብ ኮድ')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Due Date', 'የመክፈያ ቀን')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    {biText(locale, 'Amount (ETB)', 'መጠን (ETB)')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold">
                    {biText(locale, 'Status', 'ሁኔታ')}
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    {biText(locale, 'Action', 'እርምጃ')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {ownerExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                      <p>{exp.requestNumber}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                        {exp.invoiceEvidenceRef}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {exp.supplierPlaceholder}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {exp.description}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono text-[#0F233A] dark:text-slate-200 font-semibold">
                        {exp.accountCode}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {exp.accountName}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {fmtDate(exp.dueDate)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold text-slate-900 dark:text-slate-100">
                      {fmtEtb(exp.amountEtb)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={exp.status} />
                      {exp.paymentProposalRef && (
                        <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                          {exp.paymentProposalRef}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {exp.status === 'Draft' ? (
                        <button
                          type="button"
                          disabled={!canCreate.allowed}
                          title={canCreate.reason}
                          onClick={() => submitExpenseForApproval(exp.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#1A314E] dark:hover:bg-[#234066] text-white font-semibold disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          <Send className="w-3 h-3" />
                          <span>{biText(locale, 'Submit Proposal', 'ሀሳብ አስገባ')}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {biText(locale, 'No live transfer', 'የባንክ ክፍያ የለም')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={biText(locale, 'Create Draft Expense Request', 'አዲስ የወጪ ረቂቅ ፍጠር')}
        subtitle={biText(
          locale,
          `Payment proposal only — coded to ${activeOwner.name} draft CoA.`,
          `የክፍያ ሀሳብ ብቻ — ለ ${activeOwner.name} ረቂቅ የሂሳብ መደብ።`
        )}
      >
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Synthetic Supplier Placeholder *', 'የአቅራቢ ሰው-ሠራሽ ስም *')}
            </label>
            <input
              required
              value={form.supplierPlaceholder}
              onChange={(e) => setForm({ ...form, supplierPlaceholder: e.target.value })}
              placeholder="e.g. SYNTH Supplier Maintenance Crew"
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Expense Description *', 'የወጪ መግለጫ *')}
            </label>
            <input
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Plumbing pipe inspection & seal check"
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Draft Expense Account *', 'ረቂቅ የወጪ ሂሳብ *')}
              </label>
              <select
                value={form.accountCode}
                onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
              >
                {expenseAccounts.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Amount (ETB, Synthetic) *', 'መጠን (ETB, ሰው-ሠራሽ) *')}
              </label>
              <input
                type="number"
                required
                min={100}
                value={form.amountEtb}
                onChange={(e) => setForm({ ...form, amountEtb: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Due Date *', 'የመክፈያ ቀን *')}
              </label>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Invoice Evidence Placeholder *', 'የደረሰኝ ማስረጃ ቁጥር *')}
              </label>
              <input
                required
                value={form.invoiceEvidenceRef}
                onChange={(e) => setForm({ ...form, invoiceEvidenceRef: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
          </div>
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
              {biText(locale, 'Save Draft Expense', 'ረቂቅ ወጪ አስቀምጥ')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
