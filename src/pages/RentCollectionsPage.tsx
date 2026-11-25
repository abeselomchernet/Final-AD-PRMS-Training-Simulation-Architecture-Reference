import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  Printer,
  QrCode,
  RotateCcw,
  Send,
  XCircle,
  Zap,
} from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { checkActionPermission } from '../policies/rbac';
import { runMockTelebirrFlow } from '../services/telebirrGatewayService';
import { ChargeRecord, PaymentMethod, PaymentReceipt } from '../types/prms';
import { TenantGatewayModal } from '../components/gateway/TenantGatewayModal';
import {
  EmptyState,
  ExportPreviewModal,
  GovernanceCallout,
  Modal,
  SavedFilterBar,
  SlideDrawer,
  StatusLabel,
  ValidationSummary,
} from '../components/ui/Primitives';
import { RequireAuth } from '../components/auth/RequireAuth';

export const RentCollectionsPage: React.FC = () => {
  const {
    activeOwnerId,
    activeOwner,
    currentPersona,
    ownerCharges,
    ownerReceipts,
    ownerTenants,
    ownerUnits,
    ownerGatewayPayments,
    ownerSmsLogs,
    recordPayment,
    submitGatewayPayment,
    verifyGatewayPayment,
    requestReceiptVoid,
    dispatchBatchOverdueSmsReminders,
    logSimulatedEvent,
    notify,
    locale,
    fmtDate,
    fmtDateTime,
    fmtEtb,
    trStatus,
    labels,
  } = usePrms();

  const [tab, setTab] = useState<'receivables' | 'gateway' | 'receipts' | 'compliance' | 'arrears'>(
    'receivables'
  );
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [gatewayTarget, setGatewayTarget] = useState<{ tenantId?: string; chargeId?: string }>({});
  const [previewReceipt, setPreviewReceipt] = useState<PaymentReceipt | null>(null);
  const [complianceReceiptId, setComplianceReceiptId] = useState<string>(
    ownerReceipts[0]?.id || ''
  );
  const [statementTenantId, setStatementTenantId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<PaymentReceipt | null>(null);
  const [chargeFilter, setChargeFilter] = useState<'All' | 'Open' | 'Paid'>('All');
  const [chargeSearch, setChargeSearch] = useState('');
  const [exportChargesOpen, setExportChargesOpen] = useState(false);
  const [payErrors, setPayErrors] = useState<string[]>([]);
  const [voidErrors, setVoidErrors] = useState<string[]>([]);

  const [payForm, setPayForm] = useState({
    tenantId: ownerTenants[0]?.id || '',
    amountEtb: 20000,
    method: 'Bank Transfer' as PaymentMethod,
    paymentDate: '2026-11-13',
    referencePlaceholder: 'SYNTH-BANK-REF-2026',
  });
  const [payDirty, setPayDirty] = useState(false);

  const [voidForm, setVoidForm] = useState({
    evidenceRef: 'EVD-VOID-SYNTH-001',
    reason: '',
  });

  const canRecordPayment = checkActionPermission(currentPersona.role, 'record_payment');
  const canRequestVoid = checkActionPermission(currentPersona.role, 'request_receipt_void');

  const selectedComplianceReceipt = useMemo(
    () => ownerReceipts.find((r) => r.id === complianceReceiptId) || ownerReceipts[0] || null,
    [ownerReceipts, complianceReceiptId]
  );

  const openChargesForSelectedTenant = useMemo(
    () =>
      ownerCharges.filter(
        (c) => c.tenantId === payForm.tenantId && c.billedEtb > c.paidEtb
      ),
    [ownerCharges, payForm.tenantId]
  );

  const simulatedAllocations = useMemo(() => {
    let remaining = Math.max(0, payForm.amountEtb);
    return openChargesForSelectedTenant.map((ch) => {
      const due = ch.billedEtb - ch.paidEtb;
      const alloc = Math.min(due, remaining);
      remaining -= alloc;
      return {
        chargeId: ch.id,
        invoiceNumber: ch.invoiceNumber,
        period: ch.period,
        openBefore: due,
        allocatedEtb: alloc,
        remainingAfter: due - alloc,
      };
    });
  }, [openChargesForSelectedTenant, payForm.amountEtb]);

  const overdueCharges = useMemo(
    () => ownerCharges.filter((c) => c.billedEtb > c.paidEtb),
    [ownerCharges]
  );

  const filteredCharges = useMemo(() => {
    const q = chargeSearch.trim().toLowerCase();
    return ownerCharges.filter((c) => {
      if (chargeFilter === 'Open' && c.billedEtb <= c.paidEtb) return false;
      if (chargeFilter === 'Paid' && c.billedEtb > c.paidEtb) return false;
      if (q) {
        const tenantName = ownerTenants.find((t) => t.id === c.tenantId)?.name.toLowerCase() || '';
        if (!c.invoiceNumber.toLowerCase().includes(q) && !tenantName.includes(q)) return false;
      }
      return true;
    });
  }, [ownerCharges, ownerTenants, chargeFilter, chargeSearch]);

  const handleOpenPayModal = () => {
    const defaultTenant = overdueCharges[0]?.tenantId || ownerTenants[0]?.id || '';
    setPayForm({
      tenantId: defaultTenant,
      amountEtb: 20000,
      method: 'Bank Transfer',
      paymentDate: '2026-11-13',
      referencePlaceholder: `SYNTH-REF-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setPayErrors([]);
    setPayDirty(false);
    setPayModalOpen(true);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!payForm.amountEtb || payForm.amountEtb <= 0) {
      errs.push(biText(locale, 'Payment amount must be greater than zero.', 'የክፍያ መጠን ከዜሮ በላይ መሆን አለበት።'));
    }
    if (!payForm.referencePlaceholder.trim()) {
      errs.push(biText(locale, 'Evidence / payment reference placeholder is required.', 'የማስረጃ / ክፍያ ማጣቀሻ ያስፈልጋል።'));
    }
    const validAllocs = simulatedAllocations
      .filter((a) => a.allocatedEtb > 0)
      .map((a) => ({ chargeId: a.chargeId, amountEtb: a.allocatedEtb }));
    if (validAllocs.length === 0) {
      errs.push(biText(locale, 'Selected tenant has no open balance to allocate.', 'ለተመረጠው ተከራይ ክፍት ሂሳብ የለም።'));
    }
    if (errs.length > 0) {
      setPayErrors(errs);
      return;
    }

    const receipt = recordPayment({
      tenantId: payForm.tenantId,
      amountEtb: validAllocs.reduce((s, a) => s + a.amountEtb, 0),
      method: payForm.method,
      paymentDate: payForm.paymentDate,
      referencePlaceholder: payForm.referencePlaceholder,
      allocations: validAllocs,
    });
    if (receipt) {
      setPayDirty(false);
      setPayModalOpen(false);
      setComplianceReceiptId(receipt.id);
      setPreviewReceipt(receipt);
    }
  };

  const handleVoidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!voidForm.evidenceRef.trim()) {
      errs.push(biText(locale, 'Evidence reference is required for reversal requests.', 'ለመመለስ ጥያቄ የማስረጃ ማጣቀሻ ያስፈልጋል።'));
    }
    if (!voidForm.reason.trim()) {
      errs.push(biText(locale, 'Reversal justification reason is required.', 'የመመለስ ምክንያት ያስፈልጋል።'));
    }
    if (!voidTarget || errs.length > 0) {
      setVoidErrors(errs);
      return;
    }
    setVoidErrors([]);
    if (
      requestReceiptVoid({
        receiptId: voidTarget.id,
        evidenceRef: voidForm.evidenceRef.trim(),
        reason: voidForm.reason.trim(),
      })
    ) {
      setVoidTarget(null);
      setVoidForm({ evidenceRef: 'EVD-VOID-SYNTH-001', reason: '' });
    }
  };

  const handlePrintPreviewOnly = (rct: PaymentReceipt) => {
    logSimulatedEvent(
      'Rent & Collections',
      'Compliance Receipt Print-Preview Opened',
      'PaymentReceipt',
      rct.id,
      `Opened print-preview-only layout for ${rct.receiptNumber} (not a fiscal receipt).`,
      rct.referencePlaceholder
    );
    notify({
      tone: 'info',
      title: biText(locale, 'Print-Preview Mode (Demo Only)', 'የህትመት ቅድመ-ዕይታ (ለሙከራ ብቻ)'),
      detail: biText(
        locale,
        'Layout preview only — not a legally valid or fiscal receipt.',
        'የቅጽ ቅድመ-ዕይታ ብቻ — ሕጋዊ ወይም የታክስ ደረሰኝ አይደለም።'
      ),
    });
    setPreviewReceipt(rct);
  };

  const handleQuickTelebirrMockPay = (ch: ChargeRecord) => {
    if (!canRecordPayment.allowed) {
      notify({ tone: 'error', title: 'Action Blocked', detail: canRecordPayment.reason });
      return;
    }
    const balance = Math.max(0, ch.billedEtb - ch.paidEtb);
    if (balance <= 0) return;

    const tenant = ownerTenants.find((t) => t.id === ch.tenantId);
    const msisdn =
      tenant?.phonePlaceholder?.replace(/[^\d+]/g, '') || '+251911234567';

    const simResult = runMockTelebirrFlow({
      ownerId: activeOwnerId,
      tenantId: ch.tenantId,
      tenantName: tenant?.name || ch.tenantId,
      unitId: ch.unitId,
      chargeId: ch.id,
      invoiceNumber: ch.invoiceNumber,
      amountEtb: balance,
      openBalanceEtb: balance,
      msisdn,
    });

    if (!simResult.ok) {
      notify({
        tone: 'error',
        title: biText(locale, 'Telebirr Mock Trigger Failed', 'የቴሌብር ሙከራ አልተሳካም'),
        detail: simResult.errors.join(' '),
      });
      return;
    }

    const { session } = simResult;
    const receipt = submitGatewayPayment({
      gatewayType: 'Telebirr USSD QR',
      tenantId: session.tenantId,
      unitId: session.unitId,
      chargeId: session.chargeId,
      amountEtb: session.amountEtb,
      referenceNumber: session.transactionRef,
      phoneOrAccount: session.msisdn,
      notes: `Mock Telebirr USSD QR payment (${session.ussdDialString}) · Trace ${session.traceId}`,
      ussdSessionId: session.sessionId,
      ussdDialString: session.ussdDialString,
      traceId: session.traceId,
      autoVerified: true,
    });

    if (receipt) {
      setComplianceReceiptId(receipt.id);
      setPreviewReceipt(receipt);
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549]';

  return (
    <RequireAuth section="collections">
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          'Synthetic Receivables & Non-Legal Receipt Simulation',
          'ሰው-ሠራሽ የኪራይ አሰባሰብና ሕጋዊ ያልሆነ የደረሰኝ ማስመሰያ'
        )}
        description={biText(
          locale,
          'Payments use synthetic Cash, Bank Transfer, and Cheque methods without live banking or fiscal-device integration. Receipts cannot be deleted—voids require a controlled reversal approval request.',
          'ክፍያዎች የባንክ ወይም የፊስካል ማሽን ግንኙነት የላቸውም። ደረሰኞች ሊሰረዙ አይችሉም — መሰረዝ የሚቻለው በተቆጣጠረ የመመለስ (Reversal) ማጽደቂያ ብቻ ነው።'
        )}
        controlType="Prototype Simulation"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canRecordPayment.allowed || overdueCharges.length === 0}
              title={
                !canRecordPayment.allowed
                  ? canRecordPayment.reason
                  : biText(locale, 'Dispatch automated bilingual SMS rent reminders', 'አውቶማቲክ የኪራይ SMS ማስታወሻ ላክ')
              }
              onClick={() => dispatchBatchOverdueSmsReminders()}
              className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1B2B44] text-[#0F233A] dark:text-slate-100 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
              <span>{biText(locale, 'Send Automated SMS Reminders', 'አውቶማቲክ SMS ማስታወሻ ላክ')}</span>
            </button>
            <button
              type="button"
              disabled={!canRecordPayment.allowed || overdueCharges.length === 0}
              title={
                !canRecordPayment.allowed
                  ? canRecordPayment.reason
                  : overdueCharges.length === 0
                    ? biText(locale, 'No open charges remaining', 'ክፍት ክፍያ አልቀረም')
                    : biText(locale, 'Launch Telebirr, ArifPay & CBE Simulator', 'የቴሌብር፣ አሪፍፔይ እና ንግድ ባንክ ማስመሰያ')
              }
              onClick={() => {
                setGatewayTarget({});
                setGatewayModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-[#C28A24] hover:bg-[#A6731B] text-slate-950 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{biText(locale, 'Simulate Telebirr USSD QR / Gateway', 'የቴሌብር / አሪፍፔይ ክፍያ አስመስል')}</span>
            </button>
            <button
              type="button"
              disabled={!canRecordPayment.allowed || overdueCharges.length === 0}
              title={
                !canRecordPayment.allowed
                  ? canRecordPayment.reason
                  : overdueCharges.length === 0
                    ? biText(locale, 'No open charges remaining', 'ክፍት ክፍያ አልቀረም')
                    : biText(locale, 'Record synthetic ETB payment', 'ሰው-ሠራሽ የብር ክፍያ መዝግብ')
              }
              onClick={handleOpenPayModal}
              className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>{biText(locale, 'Record Synthetic Payment', 'ሰው-ሠራሽ ክፍያ መዝግብ')}</span>
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-[#152236] rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('receivables')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            tab === 'receivables'
              ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {biText(locale, 'Monthly Charges', 'ወርሃዊ ክፍያዎች')} ({ownerCharges.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('gateway')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer inline-flex items-center gap-1.5 ${
            tab === 'gateway'
              ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>{biText(locale, 'Telebirr & Gateway Queue', 'የቴሌብር እና ጌትዌይ ዝርዝር')} ({ownerGatewayPayments.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('receipts')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            tab === 'receipts'
              ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {biText(locale, 'DEMO Receipts', 'የሙከራ (DEMO) ደረሰኞች')} ({ownerReceipts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('compliance')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer inline-flex items-center gap-1.5 ${
            tab === 'compliance'
              ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>{biText(locale, 'Compliance Preview', 'የተገዢነት ቅድመ-ዕይታ')}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('arrears')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            tab === 'arrears'
              ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {biText(locale, 'Arrears & Statements', 'ውዝፍና መግለጫዎች')} ({overdueCharges.length})
        </button>
      </div>

      {/* Receivables Ledger */}
      {tab === 'receivables' && (
        <section className="space-y-3">
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <SavedFilterBar
              presets={[
                { id: 'all', label: biText(locale, 'All Charges', 'ሁሉም'), value: 'All', count: ownerCharges.length },
                { id: 'open', label: biText(locale, 'Open / Partial', 'ክፍት / በከፊል'), value: 'Open', count: overdueCharges.length },
                { id: 'paid', label: biText(locale, 'Settled', 'የተከፈሉ'), value: 'Paid', count: ownerCharges.length - overdueCharges.length },
              ]}
              activeValue={chargeFilter}
              onSelect={setChargeFilter}
            />
            <div className="flex items-center gap-2">
              <input
                value={chargeSearch}
                onChange={(e) => setChargeSearch(e.target.value)}
                placeholder={biText(locale, 'Filter invoice / tenant...', 'ደረሰኝ / ተከራይ ፈልግ...')}
                className="px-2.5 py-1.5 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg text-xs text-[#0F1D2F] dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setExportChargesOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1B2B44] font-semibold text-[#0F233A] dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Export Preview', 'ወጪ ቅድመ-ዕይታ')}</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Invoice', 'ደረሰኝ ቁጥር')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Tenant / Unit', 'ተከራይ / ክፍል')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Period & Due', 'ወቅትና የመክፈያ ቀን')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Billed (ETB)', 'የተጠየቀ (ብር)')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Paid (ETB)', 'የተከፈለ (ብር)')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Balance (ETB)', 'ቀሪ ሂሳብ (ብር)')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Telebirr Mock Trigger', 'የቴሌብር ሙከራ')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                  {filteredCharges.map((ch) => {
                    const tenant = ownerTenants.find((t) => t.id === ch.tenantId);
                    const unit = ownerUnits.find((u) => u.id === ch.unitId);
                    const balance = Math.max(0, ch.billedEtb - ch.paidEtb);
                    return (
                      <tr key={ch.id} className="hover:bg-slate-50 dark:hover:bg-[#162438]">
                        <td className="py-3 px-4 font-mono text-slate-800 dark:text-slate-200">{ch.invoiceNumber}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#0F233A] dark:text-slate-100">{tenant?.name || ch.tenantId}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{unit?.name || ch.unitId}</p>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {ch.period} · {biText(locale, 'Due', 'መክፈያ')} {fmtDate(ch.dueDate)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums text-slate-800 dark:text-slate-200">
                          {fmtEtb(ch.billedEtb)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums text-emerald-800 dark:text-emerald-400">
                          {fmtEtb(ch.paidEtb)}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-right tabular-nums text-slate-900 dark:text-slate-100">
                          {fmtEtb(balance)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusLabel label={ch.status} />
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {balance > 0 ? (
                            <>
                              <button
                                type="button"
                                disabled={!canRecordPayment.allowed}
                                title={canRecordPayment.reason}
                                onClick={() => handleQuickTelebirrMockPay(ch)}
                                className="px-2.5 py-1 rounded-md bg-[#166549] hover:bg-[#12533B] text-white text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Zap className="w-3 h-3" />
                                <span>{biText(locale, 'Mock Telebirr Pay', 'ፈጣን ቴሌብር')}</span>
                              </button>
                              <button
                                type="button"
                                disabled={!canRecordPayment.allowed}
                                title={canRecordPayment.reason}
                                onClick={() => {
                                  setGatewayTarget({ tenantId: ch.tenantId, chargeId: ch.id });
                                  setGatewayModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-md border border-[#CBD5E1] dark:border-[#2D405B] hover:bg-slate-50 dark:hover:bg-[#1B2B44] text-[#0F233A] dark:text-slate-200 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"
                              >
                                <QrCode className="w-3 h-3" />
                                <span>{biText(locale, 'QR / USSD', 'QR / USSD')}</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              {biText(locale, 'Settled', 'ተከፍሏል')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <ExportPreviewModal
            open={exportChargesOpen}
            onClose={() => setExportChargesOpen(false)}
            title={biText(locale, 'Owner Synthetic Receivables Ledger', 'የባለቤት ሰው-ሠራሽ የኪራይ አሰባሰብ መዝገብ')}
            format="Excel"
            ownerName={activeOwner.name}
            rowCount={filteredCharges.length}
            previewColumns={['Invoice', 'Period', 'Billed ETB', 'Paid ETB', 'Balance ETB', 'Status']}
            previewRows={filteredCharges.map((c) => [
              c.invoiceNumber,
              c.period,
              fmtEtb(c.billedEtb),
              fmtEtb(c.paidEtb),
              fmtEtb(Math.max(0, c.billedEtb - c.paidEtb)),
              c.status,
            ])}
            onConfirmExport={() => {
              logSimulatedEvent(
                'Rent & Collections',
                'Receivables Export Preview Confirmed',
                'MonthlyCharge',
                activeOwner.id,
                `Confirmed simulated Excel export of ${filteredCharges.length} charges.`
              );
              notify({
                tone: 'info',
                title: biText(locale, 'Simulated Export Logged', 'የሙከራ ወጪ ተመዝግቧል'),
                detail: biText(locale, 'Receivables export recorded in audit trail.', 'በኦዲት መዝገብ ተቀምጧል።'),
              });
            }}
          />
        </section>
      )}

      {/* Telebirr USSD QR & Gateway Reconciliation Queue */}
      {tab === 'gateway' && (
        <section className="space-y-3">
          {ownerGatewayPayments.length === 0 ? (
            <EmptyState
              title={biText(locale, 'No Gateway Transactions Yet', 'ምንም የጌትዌይ ግብይት የለም')}
              description={biText(
                locale,
                'Use the Telebirr USSD QR Simulator or Monthly Charges quick mock trigger to process a synthetic tenant payment.',
                'ሰው-ሠራሽ የቴሌብር USSD QR ክፍያ ለመፈጸም የጌትዌይ ማስመሰያውን ይጠቀሙ።'
              )}
            />
          ) : (
            <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Gateway & Reference', 'ጌትዌይ እና ማጣቀሻ')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Tenant / Invoice', 'ተከራይ / ደረሰኝ')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'USSD / MSISDN Trace', 'USSD / ስልክ መለያ')}</th>
                      <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Amount', 'መጠን')}</th>
                      <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                      <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Reconciliation', 'ማረጋገጫ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                    {ownerGatewayPayments.map((gp) => {
                      const tenant = ownerTenants.find((t) => t.id === gp.tenantId);
                      const charge = ownerCharges.find((c) => c.id === gp.chargeId);
                      return (
                        <tr key={gp.id} className="hover:bg-slate-50 dark:hover:bg-[#162438]">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#0F233A] dark:text-slate-100">{gp.gatewayType}</p>
                            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {gp.referenceNumber} · {fmtDateTime(gp.submittedAt)}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-800 dark:text-slate-200">{tenant?.name || gp.tenantId}</p>
                            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {charge?.invoiceNumber || gp.chargeId}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            <p>{gp.phoneOrAccount}</p>
                            {gp.ussdDialString && (
                              <p className="text-slate-400 dark:text-slate-500">
                                {gp.ussdDialString} · {gp.ussdSessionId}
                              </p>
                            )}
                            {gp.arifpaySessionId && (
                              <p className="text-slate-400 dark:text-slate-500">
                                {gp.arifpayMethod} · {gp.arifpaySessionId}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-right tabular-nums text-slate-900 dark:text-slate-100">
                            {fmtEtb(gp.amountEtb)}
                          </td>
                          <td className="py-3 px-4">
                            <StatusLabel
                              label={gp.status}
                              tone={
                                gp.status === 'Verified'
                                  ? 'green'
                                  : gp.status === 'Rejected'
                                    ? 'red'
                                    : 'amber'
                              }
                            />
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                            {gp.status === 'Pending Verification' ? (
                              <>
                                <button
                                  type="button"
                                  disabled={!canRecordPayment.allowed}
                                  title={canRecordPayment.reason}
                                  onClick={() => verifyGatewayPayment(gp.id, 'Verified')}
                                  className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{biText(locale, 'Verify', 'አረጋግጥ')}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={!canRecordPayment.allowed}
                                  title={canRecordPayment.reason}
                                  onClick={() => verifyGatewayPayment(gp.id, 'Rejected')}
                                  className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>{biText(locale, 'Reject', 'ውድቅ አድርግ')}</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                {gp.verifiedBy || gp.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Automated SMS Notification Dispatch Log */}
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#0F233A] dark:text-slate-100">
                  {biText(locale, 'Automated SMS Alert Dispatch Log', 'አውቶማቲክ የSMS ማንቂያ መዝገብ')} ({ownerSmsLogs.length})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  SANDBOX DISPATCH — NO LIVE TELCO · Bilingual EN/AM rent & payment notifications
                </p>
              </div>
              <button
                type="button"
                disabled={!canRecordPayment.allowed || overdueCharges.length === 0}
                onClick={() => dispatchBatchOverdueSmsReminders()}
                className="px-3 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                {biText(locale, 'Dispatch Overdue Batch', 'የውዝፍ SMS ላክ')}
              </button>
            </div>
            {ownerSmsLogs.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                No automated SMS alerts dispatched yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                {ownerSmsLogs.slice(0, 10).map((sms) => {
                  const tenant = ownerTenants.find((t) => t.id === sms.tenantId);
                  return (
                    <div key={sms.id} className="px-4 py-3 text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                          {sms.triggerType} · {tenant?.name || sms.tenantId}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {sms.recipientMsisdn} · {sms.deliveryState} · {fmtDateTime(sms.dispatchedAt)}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">{sms.messageBody}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Receipts Table */}
      {tab === 'receipts' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Document #', 'ሰነድ ቁጥር')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Tenant', 'ተከራይ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Method & Ref', 'ዘዴና ማጣቀሻ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Date', 'ቀን')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Amount', 'መጠን')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Document State', 'የሰነድ ሁኔታ')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Actions', 'ተግባራት')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                {ownerReceipts.map((rct) => {
                  const tenant = ownerTenants.find((t) => t.id === rct.tenantId);
                  return (
                    <tr key={rct.id} className="hover:bg-slate-50 dark:hover:bg-[#162438]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                        {rct.receiptNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{tenant?.name || rct.tenantId}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{rct.method}</p>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {rct.referencePlaceholder}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {fmtDate(rct.paymentDate)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-right tabular-nums text-slate-900 dark:text-slate-100">
                        {fmtEtb(rct.amountEtb)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel label={rct.documentState} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setComplianceReceiptId(rct.id);
                            setTab('compliance');
                          }}
                          className="text-xs font-semibold text-[#0F233A] dark:text-[#E5B85C] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>{biText(locale, 'Compliance Preview', 'የተገዢነት ቅድመ-ዕይታ')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintPreviewOnly(rct)}
                          className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{biText(locale, 'Print Preview', 'ህትመት ዕይ')}</span>
                        </button>
                        {rct.documentState === 'Issued — Demo Only' && (
                          <button
                            type="button"
                            disabled={!canRequestVoid.allowed}
                            title={canRequestVoid.reason}
                            onClick={() => setVoidTarget(rct)}
                            className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{biText(locale, 'Request Void', 'መሰረዝ ጠይቅ')}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Receipt & Invoice Compliance Preview (High-contrast paper-white print sheet preserved in dark mode) */}
      {tab === 'compliance' && (
        <div className="space-y-4">
          <GovernanceCallout
            title={biText(
              locale,
              'This is a layout prototype only. It is not a tax invoice, fiscal receipt, electronic invoice, or government-compliant document.',
              'ይህ የቅጽ ፕሮቶታይፕ ማሳያ ብቻ ነው። የታክስ ደረሰኝ፣ የፊስካል ደረሰኝ፣ ኤሌክትሮኒክ ደረሰኝ ወይም መንግሥታዊ ተቀባይነት ያለው ሰነድ አይደለም።'
            )}
            description={biText(
              locale,
              'All sensitive taxpayer identifiers display fictional unverified placeholders. Deletion is disabled; reversals must pass maker-checker approval.',
              'ሁሉም የግብር ከፋይ መለያዎች ያልተረጋገጡ ልብ-ወለድ ምትኮች ናቸው። መሰረዝ ተዘግቷል፤ የመመለስ ጥያቄ በአዘጋጅ-አጽዳቂ ቁጥጥር ማለፍ አለበት።'
            )}
            variant="restricted"
            controlType="Production Boundary"
          />

          {!selectedComplianceReceipt ? (
            <EmptyState
              title={biText(locale, 'No Synthetic Receipts Available', 'ምንም ሰው-ሠራሽ ደረሰኝ የለም')}
              description={biText(
                locale,
                `Record a synthetic payment for ${activeOwner.name} to inspect the Compliance Preview layout.`,
                `የተገዢነት ቅድመ-ዕይታ ቅጹን ለማየት ለ ${activeOwner.name} ሰው-ሠራሽ ክፍያ ይመዝግቡ።`
              )}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Compliance Layout Sheet — always crisp white paper */}
              <div className="lg:col-span-8 bg-white text-slate-900 border-2 border-dashed border-slate-300 rounded-xl p-6 space-y-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                      {biText(locale, 'Select Synthetic Receipt', 'ሰው-ሠራሽ ደረሰኝ ይምረጡ')}
                    </label>
                    <select
                      value={selectedComplianceReceipt.id}
                      onChange={(e) => setComplianceReceiptId(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md bg-white text-slate-900"
                    >
                      {ownerReceipts.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.receiptNumber} · {fmtEtb(r.amountEtb)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusLabel label={selectedComplianceReceipt.documentState} />
                    <button
                      type="button"
                      onClick={() => handlePrintPreviewOnly(selectedComplianceReceipt)}
                      className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F233A] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{biText(locale, 'Print Preview Only', 'የህትመት ቅድመ-ዕይታ ብቻ')}</span>
                    </button>
                  </div>
                </div>

                {/* DEMO Stamp */}
                <div className="flex justify-center">
                  <span className="px-4 py-1 border-2 border-red-600 text-red-700 font-mono text-xs font-bold tracking-widest uppercase rounded text-center">
                    {biText(
                      locale,
                      'DEMO — NOT A TAX INVOICE OR FISCAL RECEIPT — SYNTHETIC DATA',
                      'DEMO — የታክስ ወይም የፊስካል ደረሰኝ አይደለም — ሰው-ሠራሽ መረጃ'
                    )}
                  </span>
                </div>

                {/* Structured Compliance Placeholder Fields */}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border border-slate-200 rounded-lg p-4 bg-slate-50/70">
                  <div>
                    <dt className="text-slate-500">
                      {biText(locale, 'Supplier Legal Name (Placeholder)', 'የአቅራቢ ሕጋዊ ስም (ምትክ)')}
                    </dt>
                    <dd className="font-semibold text-[#0F233A] mt-0.5">
                      {activeOwner.name} ({activeOwner.entityType})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {biText(locale, 'Supplier Address (Synthetic)', 'የአቅራቢ አድራሻ (ሰው-ሠራሽ)')}
                    </dt>
                    <dd className="text-slate-900 mt-0.5">{activeOwner.addressPlaceholder}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{biText(locale, 'Supplier TIN', 'የአቅራቢ TIN')}</dt>
                    <dd className="font-mono font-semibold text-red-800 mt-0.5">
                      {activeOwner.tinPlaceholder}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {biText(locale, 'VAT Registration Number', 'የVAT መመዝገቢያ ቁጥር')}
                    </dt>
                    <dd className="font-mono font-semibold text-red-800 mt-0.5">
                      {activeOwner.vatRegPlaceholder}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {biText(locale, 'Customer Details (Synthetic)', 'የደንበኛ መረጃ (ሰው-ሠራሽ)')}
                    </dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {
                        ownerTenants.find((t) => t.id === selectedComplianceReceipt.tenantId)
                          ?.name
                      }{' '}
                      ·{' '}
                      <span className="font-mono text-red-800">
                        {
                          ownerTenants.find((t) => t.id === selectedComplianceReceipt.tenantId)
                            ?.idPlaceholder
                        }
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {biText(locale, 'Sequential Document Number', 'ተከታታይ የሰነድ ቁጥር')}
                    </dt>
                    <dd className="font-mono font-bold text-[#0F233A] mt-0.5">
                      {selectedComplianceReceipt.receiptNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{biText(locale, 'Transaction Date', 'የግብይት ቀን')}</dt>
                    <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                      {fmtDate(selectedComplianceReceipt.paymentDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{biText(locale, 'Evidence Reference', 'የማስረጃ ማጣቀሻ')}</dt>
                    <dd className="font-mono text-slate-900 mt-0.5">
                      {selectedComplianceReceipt.referencePlaceholder}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">{biText(locale, 'Line Description', 'የዝርዝር መግለጫ')}</dt>
                    <dd className="text-slate-900 mt-0.5">
                      {selectedComplianceReceipt.lineDescription}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{biText(locale, 'Taxable Status', 'የታክስ ሁኔታ')}</dt>
                    <dd className="font-medium text-amber-900 mt-0.5">
                      {selectedComplianceReceipt.taxableStatusPlaceholder}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {biText(locale, 'Amount (Synthetic ETB)', 'መጠን (ሰው-ሠራሽ ብር)')}
                    </dt>
                    <dd className="font-mono font-bold text-[#0F233A] tabular-nums mt-0.5">
                      {fmtEtb(selectedComplianceReceipt.amountEtb)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{biText(locale, 'Tax Treatment', 'የታክስ አያያዝ')}</dt>
                    <dd className="text-amber-900 mt-0.5">
                      {selectedComplianceReceipt.taxTreatmentPlaceholder}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {biText(locale, 'Retention Classification', 'የመዝገብ ማቆያ ምድብ')}
                    </dt>
                    <dd className="text-slate-800 mt-0.5">
                      {selectedComplianceReceipt.retentionClassPlaceholder}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div className="text-slate-500">
                    {biText(
                      locale,
                      'Document Lifecycle Options: Draft · Issued — Demo Only · Void Requested · Reversal Pending · Reversed',
                      'የሰነድ ደረጃዎች፡ ረቂቅ · የወጣ (ለሙከራ ብቻ) · መሰረዝ የተጠየቀ · መመለስ በሂደት ላይ · የተመለሰ'
                    )}
                  </div>
                  {selectedComplianceReceipt.documentState === 'Issued — Demo Only' && (
                    <button
                      type="button"
                      disabled={!canRequestVoid.allowed}
                      title={canRequestVoid.reason}
                      onClick={() => setVoidTarget(selectedComplianceReceipt)}
                      className="px-3 py-1.5 rounded border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      {biText(locale, 'Request Void / Reversal', 'መሰረዝ / መመለስ ጠይቅ')}
                    </button>
                  )}
                </div>
              </div>

              {/* Document History Timeline */}
              <div className="lg:col-span-4 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100 border-b border-[#DFE5EE] dark:border-[#233349] pb-2.5">
                  {biText(locale, 'Document History Timeline', 'የሰነድ ታሪክ ቅደም ተከተል')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {biText(
                    locale,
                    'Deletion is permanently disabled; state transitions are recorded immutably.',
                    'መሰረዝ በቋሚነት ተዘግቷል፤ የሁኔታ ለውጦች በማይለወጥ ሁኔታ ይመዘገባሉ።'
                  )}
                </p>
                <div className="space-y-2.5">
                  {selectedComplianceReceipt.history.map((h, idx) => (
                    <div
                      key={idx}
                      className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusLabel label={h.state} />
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {fmtDateTime(h.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200">{h.event}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {biText(locale, 'Actor', 'ፈጻሚ')}: {h.actor}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Arrears & Tenant Statement */}
      {tab === 'arrears' && (
        <section className="space-y-4">
          {overdueCharges.length === 0 ? (
            <EmptyState
              title={biText(locale, 'Zero Synthetic Arrears', 'ምንም ሰው-ሠራሽ ውዝፍ የለም')}
              description={biText(
                locale,
                `All synthetic charges for ${activeOwner.name} have been fully allocated.`,
                `ለ ${activeOwner.name} ሁሉም ሰው-ሠራሽ ክፍያዎች ሙሉ በሙሉ ተሸፍነዋል።`
              )}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ownerTenants.map((tenant) => {
                const tCharges = ownerCharges.filter((c) => c.tenantId === tenant.id);
                const totalBilled = tCharges.reduce((s, c) => s + c.billedEtb, 0);
                const totalPaid = tCharges.reduce((s, c) => s + c.paidEtb, 0);
                const balance = totalBilled - totalPaid;
                return (
                  <div
                    key={tenant.id}
                    className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#0F233A] dark:text-slate-100">{tenant.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{tenant.code}</p>
                      </div>
                      <StatusLabel label={balance > 0 ? 'Balance Open' : 'Settled'} tone={balance > 0 ? 'red' : 'green'} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-[#233349]">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Billed', 'የተጠየቀ')}</p>
                        <p className="font-mono font-semibold tabular-nums">{fmtEtb(totalBilled)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Paid', 'የተከፈለ')}</p>
                        <p className="font-mono font-semibold tabular-nums text-emerald-800 dark:text-emerald-400">
                          {fmtEtb(totalPaid)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Outstanding', 'ቀሪ ሂሳብ')}</p>
                        <p className="font-mono font-semibold tabular-nums text-red-700 dark:text-red-400">
                          {fmtEtb(balance)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStatementTenantId(tenant.id)}
                      className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{biText(locale, 'Open Tenant Statement', 'የተከራይ መግለጫ ክፈት')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Payment Recording & Partial-Allocation Modal */}
      <Modal
        open={payModalOpen}
        onClose={() => {
          setPayDirty(false);
          setPayModalOpen(false);
        }}
        isDirty={payDirty}
        title={biText(
          locale,
          'Record Synthetic Payment & Simulate Partial Allocation',
          'ሰው-ሠራሽ ክፍያ መዝግብና ክፍፍሉን አስመስል'
        )}
        subtitle={biText(
          locale,
          'No live bank integration. Payment allocates across open synthetic invoices oldest-first.',
          'ቀጥተኛ የባንክ ግንኙነት የለም። ክፍያው ቀድመው በተፈጠሩ ክፍት ደረሰኞች ላይ በቅደም ተከተል ይመደባል።'
        )}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <ValidationSummary errors={payErrors} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Tenant *', 'ተከራይ *')}
              </label>
              <select
                value={payForm.tenantId}
                onChange={(e) => {
                  setPayDirty(true);
                  setPayForm({ ...payForm, tenantId: e.target.value });
                }}
                className={inputCls}
              >
                {ownerTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Payment Amount (ETB) *', 'የክፍያ መጠን (ብር) *')}
              </label>
              <input
                type="number"
                required
                min={1}
                value={payForm.amountEtb}
                onChange={(e) => {
                  setPayDirty(true);
                  setPayForm({ ...payForm, amountEtb: Number(e.target.value) });
                }}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Synthetic Payment Method *', 'ሰው-ሠራሽ የክፍያ ዘዴ *')}
              </label>
              <select
                value={payForm.method}
                onChange={(e) => {
                  setPayDirty(true);
                  setPayForm({ ...payForm, method: e.target.value as PaymentMethod });
                }}
                className={inputCls}
              >
                <option value="Bank Transfer">Bank Transfer (Synthetic)</option>
                <option value="Cash">Cash (Synthetic)</option>
                <option value="Cheque">Cheque (Synthetic)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Reference Placeholder *', 'የማጣቀሻ ምትክ *')}
              </label>
              <input
                required
                value={payForm.referencePlaceholder}
                onChange={(e) => {
                  setPayDirty(true);
                  setPayForm({ ...payForm, referencePlaceholder: e.target.value });
                }}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#152236] border-b border-[#DFE5EE] dark:border-[#233349] font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Partial-Payment Allocation Preview', 'የክፍያ ድልድል ቅድመ-ዕይታ')}
            </div>
            {simulatedAllocations.length === 0 ? (
              <p className="p-3 text-slate-500 dark:text-slate-400">
                {biText(locale, 'Selected tenant has no open invoices.', 'የተመረጠው ተከራይ ክፍት ደረሰኝ የለውም።')}
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <th className="py-2 px-3">{biText(locale, 'Invoice', 'ደረሰኝ')}</th>
                    <th className="py-2 px-3 text-right">{biText(locale, 'Open Before', 'ከመከፈሉ በፊት')}</th>
                    <th className="py-2 px-3 text-right">{biText(locale, 'Allocated', 'የተመደበ')}</th>
                    <th className="py-2 px-3 text-right">{biText(locale, 'Remaining', 'ቀሪ')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                  {simulatedAllocations.map((row) => (
                    <tr key={row.chargeId}>
                      <td className="py-2 px-3 font-mono">{row.invoiceNumber}</td>
                      <td className="py-2 px-3 font-mono text-right tabular-nums">
                        {fmtEtb(row.openBefore)}
                      </td>
                      <td className="py-2 px-3 font-mono text-right tabular-nums text-emerald-800 dark:text-emerald-400 font-semibold">
                        {fmtEtb(row.allocatedEtb)}
                      </td>
                      <td className="py-2 px-3 font-mono text-right tabular-nums">
                        {fmtEtb(row.remainingAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPayModalOpen(false)}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={simulatedAllocations.every((a) => a.allocatedEtb === 0)}
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold disabled:opacity-50"
            >
              {biText(locale, 'Confirm & Preview DEMO Receipt', 'አረጋግጥና DEMO ደረሰኝ አሳይ')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Synthetic Receipt Preview with DEMO Watermark (Crisp White Paper Even in Dark Mode) */}
      <Modal
        open={Boolean(previewReceipt)}
        onClose={() => setPreviewReceipt(null)}
        title={biText(
          locale,
          'Printable Synthetic Receipt Preview (Print-Preview Only)',
          'የሚታተም ሰው-ሠራሽ ደረሰኝ ቅድመ-ዕይታ (ለቅድመ-ዕይታ ብቻ)'
        )}
        subtitle={biText(
          locale,
          'Layout prototype only — NOT a tax invoice, fiscal receipt, or government-compliant document.',
          'የቅጽ ፕሮቶታይፕ ብቻ — የታክስ ወይም የፊስካል ደረሰኝ አይደለም።'
        )}
        maxWidth="max-w-xl"
      >
        {previewReceipt && (
          <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 bg-white text-slate-900 overflow-hidden">
            <div className="pointer-events-none select-none flex justify-center mb-3">
              <span className="px-4 py-1 border-2 border-red-600 text-red-700 font-mono text-xs font-bold tracking-widest uppercase rounded text-center">
                {biText(
                  locale,
                  'DEMO RECEIPT — NOT LEGALLY VALID — SYNTHETIC DATA',
                  'DEMO ደረሰኝ — ሕጋዊ ዋጋ የሌለው — ሰው-ሠራሽ መረጃ'
                )}
              </span>
            </div>

            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm font-bold text-[#0F233A]">{activeOwner.name}</p>
                <p className="text-xs text-slate-500">{activeOwner.addressPlaceholder}</p>
                <p className="text-[11px] font-mono text-red-800 mt-0.5">
                  TIN: {activeOwner.tinPlaceholder} · VAT: {activeOwner.vatRegPlaceholder}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono font-bold text-[#0F233A]">
                  {previewReceipt.receiptNumber}
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  {biText(locale, 'Date', 'ቀን')}: {fmtDate(previewReceipt.paymentDate)}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs my-4">
              <div>
                <dt className="text-slate-500">{biText(locale, 'Synthetic Tenant', 'ሰው-ሠራሽ ተከራይ')}</dt>
                <dd className="font-semibold text-slate-900">
                  {ownerTenants.find((t) => t.id === previewReceipt.tenantId)?.name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{biText(locale, 'Payment Method', 'የክፍያ ዘዴ')}</dt>
                <dd className="font-semibold text-slate-900">
                  {previewReceipt.method} ({previewReceipt.referencePlaceholder})
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{biText(locale, 'Taxable Status', 'የታክስ ሁኔታ')}</dt>
                <dd className="text-amber-900">{previewReceipt.taxableStatusPlaceholder}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{biText(locale, 'Document State', 'የሰነድ ሁኔታ')}</dt>
                <dd className="font-semibold text-slate-900">
                  {trStatus(previewReceipt.documentState)}
                </dd>
              </div>
            </dl>

            <table className="w-full text-left text-xs border-t border-b border-slate-200 my-4">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-2 px-2">{biText(locale, 'Allocated Invoice', 'የተመደበበት ደረሰኝ')}</th>
                  <th className="py-2 px-2 text-right">{biText(locale, 'Amount (ETB)', 'መጠን (ብር)')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewReceipt.allocations.map((a) => (
                  <tr key={a.chargeId}>
                    <td className="py-2 px-2 font-mono">{a.invoiceNumber}</td>
                    <td className="py-2 px-2 font-mono text-right tabular-nums">
                      {fmtEtb(a.allocatedEtb)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className="py-2 px-2">{biText(locale, 'Total Synthetic Payment', 'ጠቅላላ ሰው-ሠራሽ ክፍያ')}</td>
                  <td className="py-2 px-2 font-mono text-right tabular-nums">
                    {fmtEtb(previewReceipt.amountEtb)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <p className="text-[11px] text-slate-500 text-center">
              {biText(
                locale,
                'SYNTHETIC DEMO RECEIPT — PRINT PREVIEW ONLY — NO LIVE TAX OR FISCAL INTEGRATION.',
                'ሰው-ሠራሽ የሙከራ ደረሰኝ — ለህትመት ቅድመ-ዕይታ ብቻ — ቀጥተኛ የታክስ ወይም የፊስካል ግንኙነት የለውም።'
              )}
            </p>
          </div>
        )}
      </Modal>

      {/* Controlled Void / Reversal Request Modal */}
      <Modal
        open={Boolean(voidTarget)}
        onClose={() => {
          setVoidErrors([]);
          setVoidTarget(null);
        }}
        isDirty={Boolean(voidForm.reason.trim())}
        title={biText(locale, 'Controlled Receipt Void / Reversal Request', 'ቁጥጥር የሚደረግበት የደረሰኝ መሰረዝ / መመለስ ጥያቄ')}
        subtitle={biText(
          locale,
          'Receipts are never deleted. Reversals require maker-checker approval and evidence.',
          'ደረሰኞች በፍጹም አይሰረዙም። መመለስ የአዘጋጅ-አጽዳቂ ውሳኔና ማስረጃ ይጠይቃል።'
        )}
      >
        {voidTarget && (
          <form onSubmit={handleVoidSubmit} noValidate className="space-y-3 text-xs">
            <ValidationSummary errors={voidErrors} />
            <div className="p-3 rounded-lg bg-[#F4F6F9] dark:bg-[#162438] border border-[#DFE5EE] dark:border-[#233349]">
              {biText(locale, 'Target Receipt', 'የሚመለሰው ደረሰኝ')}:{' '}
              <span className="font-mono font-semibold">{voidTarget.receiptNumber}</span> (
              {fmtEtb(voidTarget.amountEtb)})
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Evidence Reference *', 'የማስረጃ ማጣቀሻ *')}
              </label>
              <input
                required
                value={voidForm.evidenceRef}
                onChange={(e) => setVoidForm({ ...voidForm, evidenceRef: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Reversal Reason *', 'የመመለስ ምክንያት *')}
              </label>
              <textarea
                required
                rows={2}
                value={voidForm.reason}
                onChange={(e) => setVoidForm({ ...voidForm, reason: e.target.value })}
                placeholder={biText(
                  locale,
                  'Explain why this synthetic receipt requires reversal...',
                  'ይህ ሰው-ሠራሽ ደረሰኝ ለምን መመለስ እንዳስፈለገው ይግለጹ...'
                )}
                className={inputCls}
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setVoidErrors([]);
                  setVoidTarget(null);
                }}
                className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
              >
                {labels.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold cursor-pointer"
              >
                {biText(locale, 'Submit Void Request', 'የመመለስ ጥያቄ አቅርብ')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Tenant Statement Drawer */}
      <SlideDrawer
        open={Boolean(statementTenantId)}
        onClose={() => setStatementTenantId(null)}
        title={biText(locale, 'Synthetic Tenant Statement', 'ሰው-ሠራሽ የተከራይ ሂሳብ መግለጫ')}
        subtitle={`${biText(locale, 'Owner-isolated ledger statement', 'በባለቤት የተለየ መግለጫ')} (${activeOwner.name})`}
      >
        {statementTenantId && (
          <div className="space-y-4 text-xs">
            <p className="font-semibold text-[#0F233A] dark:text-slate-100">
              {ownerTenants.find((t) => t.id === statementTenantId)?.name}
            </p>
            <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <th className="py-2 px-3">{biText(locale, 'Invoice', 'ደረሰኝ')}</th>
                    <th className="py-2 px-3">{biText(locale, 'Period', 'ወቅት')}</th>
                    <th className="py-2 px-3 text-right">{biText(locale, 'Billed', 'የተጠየቀ')}</th>
                    <th className="py-2 px-3 text-right">{biText(locale, 'Paid', 'የተከፈለ')}</th>
                    <th className="py-2 px-3">{biText(locale, 'Status', 'ሁኔታ')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                  {ownerCharges
                    .filter((c) => c.tenantId === statementTenantId)
                    .map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 px-3 font-mono">{c.invoiceNumber}</td>
                        <td className="py-2 px-3 font-mono">{c.period}</td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums">
                          {fmtEtb(c.billedEtb)}
                        </td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums">
                          {fmtEtb(c.paidEtb)}
                        </td>
                        <td className="py-2 px-3">
                          <StatusLabel label={c.status} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SlideDrawer>

      <TenantGatewayModal
        open={gatewayModalOpen}
        onClose={() => {
          setGatewayModalOpen(false);
          setGatewayTarget({});
        }}
        initialTenantId={gatewayTarget.tenantId}
        initialChargeId={gatewayTarget.chargeId}
        onReceiptIssued={(receipt) => {
          setComplianceReceiptId(receipt.id);
          setPreviewReceipt(receipt);
        }}
      />
    </div>
    </RequireAuth>
  );
};
