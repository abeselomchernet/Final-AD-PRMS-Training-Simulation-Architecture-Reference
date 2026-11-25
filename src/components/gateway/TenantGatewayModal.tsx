import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  KeyRound,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
  Upload,
  Zap,
} from 'lucide-react';
import { usePrms } from '../../context/PrmsContext';
import { biText } from '../../data/i18n';
import {
  confirmTelebirrCustomerPin,
  createTelebirrUssdQrSession,
  finalizeTelebirrSettlement,
  runMockTelebirrFlow,
  sendTelebirrUssdPush,
  TELEBIRR_SANDBOX_CONFIG,
  TelebirrSettlementOutcome,
  TelebirrUssdQrSession,
} from '../../services/telebirrGatewayService';
import {
  ARIFPAY_SANDBOX_CONFIG,
  ArifPayOutcome,
  ArifPaySelectedMethod,
  ArifPaySession,
  createArifPayCheckoutSession,
  simulateArifPayHostedPayment,
  verifyArifPaySessionFallback,
} from '../../services/arifpayGatewayService';
import { PaymentReceipt } from '../../types/prms';
import { DocumentUploadField, UploadedEvidenceFile } from '../ui/DocumentUploadField';
import { Modal, ValidationSummary } from '../ui/Primitives';

const TelebirrQrSvg: React.FC<{ matrix: boolean[][]; sessionId: string }> = ({
  matrix,
  sessionId,
}) => {
  const size = matrix.length || 21;
  return (
    <div className="bg-white p-2.5 rounded-lg border border-slate-300 inline-block shrink-0">
      <svg
        width={126}
        height={126}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Synthetic Telebirr QR code for ${sessionId}`}
        className="block"
      >
        <rect width={size} height={size} fill="#FFFFFF" />
        {matrix.map((row, rIdx) =>
          row.map((filled, cIdx) =>
            filled ? (
              <rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx}
                y={rIdx}
                width={1}
                height={1}
                fill="#0F233A"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};

export const TenantGatewayModal: React.FC<{
  open: boolean;
  onClose: () => void;
  initialTenantId?: string;
  initialChargeId?: string;
  onReceiptIssued?: (receipt: PaymentReceipt) => void;
}> = ({ open, onClose, initialTenantId, initialChargeId, onReceiptIssued }) => {
  const {
    activeOwnerId,
    ownerTenants,
    ownerCharges,
    ownerUnits,
    submitGatewayPayment,
    logSimulatedEvent,
    notify,
    locale,
    fmtEtb,
  } = usePrms();

  const [selectedTenantId, setSelectedTenantId] = useState(ownerTenants[0]?.id || '');
  const [selectedChargeId, setSelectedChargeId] = useState('');
  const [gatewayType, setGatewayType] = useState<
    'Telebirr USSD QR' | 'ArifPay Checkout' | 'CBE Transfer Slip'
  >('Telebirr USSD QR');
  const [amountEtb, setAmountEtb] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [phoneOrAccount, setPhoneOrAccount] = useState('+251911234567');
  const [notes, setNotes] = useState('');
  const [syntheticPin, setSyntheticPin] = useState('1234');
  const [simOutcome, setSimOutcome] = useState<TelebirrSettlementOutcome>('SETTLED');
  const [session, setSession] = useState<TelebirrUssdQrSession | null>(null);
  const [arifpayMethod, setArifpayMethod] = useState<ArifPaySelectedMethod>('TELEBIRR');
  const [arifpayOutcome, setArifpayOutcome] = useState<ArifPayOutcome>('COMPLETED');
  const [arifpaySession, setArifpaySession] = useState<ArifPaySession | null>(null);
  const [arifpayBusy, setArifpayBusy] = useState(false);
  const [cbeSlipFile, setCbeSlipFile] = useState<UploadedEvidenceFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const wasOpenRef = React.useRef(false);
  const lastContextKeyRef = React.useRef('');

  // Initialize form state ONLY on open or explicit caller context switch (never wipe in-progress edits on background sync or gateway tab toggle)
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const contextKey = `${activeOwnerId}|${initialTenantId || ''}|${initialChargeId || ''}`;
    if (wasOpenRef.current && lastContextKeyRef.current === contextKey) {
      return;
    }
    wasOpenRef.current = true;
    lastContextKeyRef.current = contextKey;

    const defaultCharge =
      (initialChargeId && ownerCharges.find((c) => c.id === initialChargeId)) ||
      ownerCharges.find((c) => c.billedEtb > c.paidEtb) ||
      null;
    const tenantId =
      initialTenantId || defaultCharge?.tenantId || ownerTenants[0]?.id || '';
    const tenantObj = ownerTenants.find((t) => t.id === tenantId);

    setSelectedTenantId(tenantId);
    setSelectedChargeId(defaultCharge?.id || '');
    setAmountEtb(
      defaultCharge ? Math.max(0, defaultCharge.billedEtb - defaultCharge.paidEtb) : 0
    );
    setPhoneOrAccount(
      gatewayType === 'CBE Transfer Slip'
        ? '1000284910293 (CBE)'
        : tenantObj?.phonePlaceholder?.replace(/[^\d+]/g, '') || '+251911234567'
    );
    setReferenceNumber('');
    setNotes('');
    setSyntheticPin('1234');
    setSimOutcome('SETTLED');
    setSession(null);
    setArifpaySession(null);
    setCbeSlipFile(null);
    setErrors([]);
  }, [open, activeOwnerId, initialTenantId, initialChargeId, ownerCharges, ownerTenants, gatewayType]);

  const tenantCharges = ownerCharges.filter(
    (c) => c.tenantId === selectedTenantId && c.billedEtb > c.paidEtb
  );
  const selectedTenant = ownerTenants.find((t) => t.id === selectedTenantId);
  const selectedCharge = ownerCharges.find((c) => c.id === selectedChargeId);
  const selectedUnit =
    ownerUnits.find((u) => u.id === selectedCharge?.unitId) ||
    ownerUnits.find((u) => u.currentTenantId === selectedTenantId);

  const handleChargeSelect = (chargeId: string) => {
    setSelectedChargeId(chargeId);
    setSession(null);
    setErrors([]);
    const ch = ownerCharges.find((c) => c.id === chargeId);
    if (ch) {
      setAmountEtb(Math.max(0, ch.billedEtb - ch.paidEtb));
    }
  };

  const buildInitiationInput = () => {
    const openBalance = selectedCharge
      ? Math.max(0, selectedCharge.billedEtb - selectedCharge.paidEtb)
      : 0;
    return {
      ownerId: activeOwnerId,
      tenantId: selectedTenantId,
      tenantName: selectedTenant?.name || selectedTenantId,
      unitId: selectedUnit?.id || ownerUnits[0]?.id || '',
      chargeId: selectedChargeId,
      invoiceNumber: selectedCharge?.invoiceNumber || selectedChargeId,
      amountEtb,
      openBalanceEtb: openBalance,
      msisdn: phoneOrAccount,
    };
  };

  const commitSettledTelebirrSession = (settled: TelebirrUssdQrSession) => {
    if (settled.step === 'SETTLED') {
      const receipt = submitGatewayPayment({
        gatewayType: 'Telebirr USSD QR',
        tenantId: settled.tenantId,
        unitId: settled.unitId,
        chargeId: settled.chargeId,
        amountEtb: settled.amountEtb,
        referenceNumber: settled.transactionRef,
        phoneOrAccount: settled.msisdn,
        notes:
          notes.trim() ||
          `Telebirr USSD QR settled (${settled.ussdDialString}) · Trace ${settled.traceId}`,
        ussdSessionId: settled.sessionId,
        ussdDialString: settled.ussdDialString,
        traceId: settled.traceId,
        autoVerified: true,
      });
      if (receipt) {
        if (onReceiptIssued) onReceiptIssued(receipt);
        onClose();
      }
      return;
    }

    logSimulatedEvent(
      'Rent & Collections',
      'Telebirr USSD QR Simulation Declined',
      'GatewayPayment',
      settled.sessionId,
      settled.failureReason || `Simulated Telebirr outcome: ${settled.step}`,
      settled.transactionRef
    );
    notify({
      tone: 'warning',
      title: biText(locale, 'Telebirr Sandbox Declined', 'የቴሌብር ሙከራ አልተሳካም'),
      detail: settled.failureReason,
    });
  };

  const handleGenerateTelebirrSession = () => {
    setErrors([]);
    const res = createTelebirrUssdQrSession(buildInitiationInput());
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setSession(res.session);
  };

  const handleSendUssdPush = () => {
    if (!session) return;
    setErrors([]);
    setSession(sendTelebirrUssdPush(session));
  };

  const handleConfirmPinAndSettle = () => {
    if (!session) return;
    setErrors([]);
    const pinRes = confirmTelebirrCustomerPin(session, syntheticPin);
    if (!pinRes.ok) {
      setErrors([pinRes.error]);
      return;
    }
    const finalized = finalizeTelebirrSettlement(pinRes.session, simOutcome);
    setSession(finalized);
    commitSettledTelebirrSession(finalized);
  };

  const handleQuickMockTrigger = () => {
    setErrors([]);
    const res = runMockTelebirrFlow(buildInitiationInput(), {
      syntheticPin: syntheticPin || '1234',
      outcome: simOutcome,
    });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setSession(res.session);
    commitSettledTelebirrSession(res.session);
  };

  const handleCreateArifPaySession = async () => {
    setErrors([]);
    setArifpayBusy(true);
    try {
      const created = await createArifPayCheckoutSession({
        ...buildInitiationInput(),
        selectedMethod: arifpayMethod,
      });
      if (!created.ok) {
        setErrors(created.errors);
        return;
      }
      setArifpaySession(created.session);
    } finally {
      setArifpayBusy(false);
    }
  };

  const handleCompleteArifPay = async () => {
    if (!arifpaySession) return;
    setErrors([]);
    setArifpayBusy(true);
    try {
      const result = await simulateArifPayHostedPayment(
        arifpaySession,
        arifpayMethod,
        arifpayOutcome
      );
      setArifpaySession(result);
      if (result.status !== 'COMPLETED') {
        logSimulatedEvent(
          'Rent & Collections',
          'ArifPay Sandbox Checkout Declined',
          'GatewayPayment',
          result.sessionId,
          result.failureReason || `Simulated ArifPay status: ${result.status}`,
          result.transactionId
        );
        setErrors([result.failureReason || `ArifPay checkout status: ${result.status}`]);
        return;
      }
      const receipt = submitGatewayPayment({
        gatewayType: 'ArifPay Checkout',
        tenantId: result.tenantId,
        unitId: result.unitId,
        chargeId: result.chargeId,
        amountEtb: result.amountEtb,
        referenceNumber: result.transactionId,
        phoneOrAccount: `${result.msisdn} (${arifpayMethod})`,
        notes:
          notes.trim() ||
          `ArifPay Sandbox Checkout (${arifpayMethod}) · Session ${result.sessionId}`,
        arifpaySessionId: result.sessionId,
        arifpayNonce: result.nonce,
        arifpayMethod,
        autoVerified: true,
      });
      if (receipt) {
        if (onReceiptIssued) onReceiptIssued(receipt);
        onClose();
      }
    } finally {
      setArifpayBusy(false);
    }
  };

  const handleVerifyArifPayFallback = async () => {
    if (!arifpaySession) return;
    setErrors([]);
    setArifpayBusy(true);
    try {
      const verified = await verifyArifPaySessionFallback(arifpaySession);
      setArifpaySession(verified);
      if (verified.status !== 'COMPLETED') {
        setErrors([verified.failureReason || `ArifPay verification status: ${verified.status}`]);
        return;
      }
      const receipt = submitGatewayPayment({
        gatewayType: 'ArifPay Checkout',
        tenantId: verified.tenantId,
        unitId: verified.unitId,
        chargeId: verified.chargeId,
        amountEtb: verified.amountEtb,
        referenceNumber: verified.transactionId,
        phoneOrAccount: `${verified.msisdn} (${verified.selectedMethod})`,
        notes: `ArifPay Verify-by-Session Fallback · ${verified.sessionId}`,
        arifpaySessionId: verified.sessionId,
        arifpayNonce: verified.nonce,
        arifpayMethod: verified.selectedMethod,
        autoVerified: true,
      });
      if (receipt) {
        if (onReceiptIssued) onReceiptIssued(receipt);
        onClose();
      }
    } finally {
      setArifpayBusy(false);
    }
  };

  const handleCbeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    const errs: string[] = [];
    if (!selectedTenantId) errs.push('Select a tenant.');
    if (!selectedChargeId) errs.push('Select an open invoice.');
    if (!amountEtb || amountEtb <= 0) errs.push('Payment amount must be greater than ETB 0.');
    if (!referenceNumber.trim()) errs.push('CBE deposit slip reference is required.');
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    const receipt = submitGatewayPayment({
      gatewayType: 'CBE Transfer Slip',
      tenantId: selectedTenantId,
      unitId: selectedUnit?.id || ownerUnits[0]?.id || '',
      chargeId: selectedChargeId,
      amountEtb,
      referenceNumber: referenceNumber.trim(),
      phoneOrAccount: phoneOrAccount.trim() || '1000284910293 (CBE)',
      notes: notes.trim() || 'Synthetic payment via CBE Transfer Slip',
      autoVerified: false,
    });
    if (receipt) {
      if (onReceiptIssued) onReceiptIssued(receipt);
      onClose();
    }
  };

  const inputCls =
    'w-full text-xs font-medium bg-[#F4F6F9] dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549]';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={biText(
        locale,
        'Telebirr USSD QR & CBE Gateway Simulator',
        'የቴሌብር USSD QR እና የንግድ ባንክ ክፍያ ማስመሰያ'
      )}
      subtitle={biText(
        locale,
        `${TELEBIRR_SANDBOX_CONFIG.modeLabel}. Simulated receipts are stamped DEMO only.`,
        'ይህ የናሙና የክፍያ ስርዓት ማስመሰያ ነው። የሚወጡት ደረሰኞች ለሙከራ (DEMO) ብቻ ናቸው።'
      )}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-1 text-xs">
        <ValidationSummary errors={errors} />

        {/* Gateway Mode Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              setGatewayType('Telebirr USSD QR');
              setArifpaySession(null);
              setErrors([]);
            }}
            className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3 ${
              gatewayType === 'Telebirr USSD QR'
                ? 'border-[#166549] bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200'
                : 'border-slate-200 dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#162438] text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-[#166549]/15 flex items-center justify-center shrink-0 text-[#166549] dark:text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">Telebirr USSD / QR</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {TELEBIRR_SANDBOX_CONFIG.ussdShortCode} Push · Dynamic QR
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setGatewayType('ArifPay Checkout');
              setSession(null);
              setErrors([]);
            }}
            className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3 ${
              gatewayType === 'ArifPay Checkout'
                ? 'border-[#0F233A] dark:border-emerald-400 bg-slate-100 dark:bg-[#182B44] text-[#0F233A] dark:text-slate-100'
                : 'border-slate-200 dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#162438] text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-[#0F233A]/15 dark:bg-white/10 flex items-center justify-center shrink-0 text-[#0F233A] dark:text-[#E5B85C]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">ArifPay Checkout</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Hosted Telebirr / CBE Webhook
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setGatewayType('CBE Transfer Slip');
              setSession(null);
              setArifpaySession(null);
              setErrors([]);
            }}
            className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3 ${
              gatewayType === 'CBE Transfer Slip'
                ? 'border-[#C28A24] bg-amber-50/60 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200'
                : 'border-slate-200 dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#162438] text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-[#C28A24]/15 flex items-center justify-center shrink-0 text-[#C28A24]">
              <Upload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">CBE Transfer Slip</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Bank deposit voucher verification
              </p>
            </div>
          </button>
        </div>

        {/* Common Tenant, Charge & Amount Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {biText(locale, 'Tenant *', 'ተከራይ *')}
            </label>
            <select
              aria-label="Gateway Tenant"
              value={selectedTenantId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedTenantId(nextId);
                setSelectedChargeId('');
                setAmountEtb(0);
                setSession(null);
                setErrors([]);
              }}
              className={inputCls}
            >
              {ownerTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.businessType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {biText(locale, 'Open Invoice / Charge *', 'ክፍት ደረሰኝ *')}
            </label>
            <select
              aria-label="Gateway Open Invoice"
              value={selectedChargeId}
              onChange={(e) => handleChargeSelect(e.target.value)}
              className={inputCls}
            >
              <option value="">-- {biText(locale, 'Select Charge', 'ክፍያ ይምረጡ')} --</option>
              {tenantCharges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.invoiceNumber} · {c.period} · {fmtEtb(c.billedEtb - c.paidEtb)} Due
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {biText(locale, 'Amount (ETB) *', 'የክፍያ መጠን (ብር) *')}
            </label>
            <input
              type="number"
              aria-label="Gateway Amount ETB"
              value={amountEtb || ''}
              onChange={(e) => {
                setAmountEtb(Number(e.target.value));
                setSession(null);
              }}
              min={1}
              className={`${inputCls} font-mono tabular-nums`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {gatewayType === 'Telebirr USSD QR'
                ? biText(locale, 'Tenant Telebirr MSISDN *', 'የተከራይ ቴሌብር ስልክ ቁጥር *')
                : biText(locale, 'CBE Account / Branch', 'የንግድ ባንክ ሂሳብ / ቅርንጫፍ')}
            </label>
            <input
              type="text"
              value={phoneOrAccount}
              onChange={(e) => {
                setPhoneOrAccount(e.target.value);
                setSession(null);
              }}
              placeholder={
                gatewayType === 'Telebirr USSD QR'
                  ? '+251911234567'
                  : '1000284910293 (Bole Branch)'
              }
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>

        {/* TELEBIRR USSD QR INTERACTIVE SERVICE FLOW */}
        {gatewayType === 'Telebirr USSD QR' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <span>Merchant {TELEBIRR_SANDBOX_CONFIG.merchantCode}</span>
                <span aria-hidden="true">·</span>
                <span>Short Code {TELEBIRR_SANDBOX_CONFIG.ussdShortCode}</span>
                <span aria-hidden="true">·</span>
                <span>Fee ETB 0.00</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateTelebirrSession}
                  className="px-3.5 py-2 rounded-lg border border-[#166549] text-[#166549] dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{biText(locale, 'Generate USSD & QR Session', 'USSD እና QR ክፍለ-ጊዜ ፍጠር')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickMockTrigger}
                  className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{biText(locale, 'Run 1-Click Mock Telebirr Pay', 'በአንድ ጠቅታ ቴሌብር ክፍያ አስመስል')}</span>
                </button>
              </div>
            </div>

            {session && (
              <div className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-4 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <TelebirrQrSvg matrix={session.qrMatrix} sessionId={session.sessionId} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono font-bold text-sm text-[#0F233A] dark:text-slate-100">
                        {session.sessionId}
                      </p>
                      <span className="font-mono text-[11px] font-semibold text-[#166549] dark:text-emerald-400">
                        {session.step}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      <p className="text-slate-600 dark:text-slate-300">
                        USSD Dial:{' '}
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {session.ussdDialString}
                        </span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        Trace ID:{' '}
                        <span className="font-mono text-slate-900 dark:text-white">
                          {session.traceId}
                        </span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        MSISDN:{' '}
                        <span className="font-mono text-slate-900 dark:text-white">
                          {session.msisdn}
                        </span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        Amount:{' '}
                        <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                          {fmtEtb(session.amountEtb)}
                        </span>
                      </p>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-all">
                      {session.qrPayload}
                    </p>
                  </div>
                </div>

                {/* Step Controls */}
                {session.step !== 'SETTLED' &&
                  session.step !== 'FAILED_TIMEOUT' &&
                  session.step !== 'FAILED_INSUFFICIENT_FUNDS' && (
                    <div className="pt-3 border-t border-[#DFE5EE] dark:border-[#233349] space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            <KeyRound className="w-3 h-3 inline mr-1" />
                            Synthetic Demo PIN (4 digits)
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={syntheticPin}
                            onChange={(e) => setSyntheticPin(e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Sandbox Settlement Outcome
                          </label>
                          <select
                            value={simOutcome}
                            onChange={(e) =>
                              setSimOutcome(e.target.value as TelebirrSettlementOutcome)
                            }
                            className={inputCls}
                          >
                            <option value="SETTLED">Completed (Settled)</option>
                            <option value="FAILED_TIMEOUT">Simulate 180s Timeout</option>
                            <option value="FAILED_INSUFFICIENT_FUNDS">
                              Simulate Insufficient Balance
                            </option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.step === 'QR_GENERATED' && (
                            <button
                              type="button"
                              onClick={handleSendUssdPush}
                              className="w-full px-3 py-2.5 rounded-lg bg-[#0F233A] hover:bg-[#1A3554] text-white font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Push *127# USSD</span>
                            </button>
                          )}
                          {(session.step === 'USSD_PUSH_SENT' ||
                            session.step === 'QR_GENERATED') && (
                            <button
                              type="button"
                              onClick={handleConfirmPinAndSettle}
                              className="w-full px-3 py-2.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Confirm & Settle</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Event Stream Log */}
                <div className="pt-2 border-t border-[#DFE5EE] dark:border-[#233349] space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Telebirr Service Event Log
                  </p>
                  <div className="space-y-1">
                    {session.events.map((ev, i) => (
                      <div
                        key={`${ev.step}-${i}`}
                        className="flex items-start justify-between gap-2 text-[11px] text-slate-700 dark:text-slate-300"
                      >
                        <span>
                          <span className="font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                            [{ev.channel}]
                          </span>{' '}
                          {ev.label}
                        </span>
                        <span className="font-mono text-slate-400 shrink-0">
                          {ev.timestamp.slice(11)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {session.failureReason && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2.5 text-[11px] text-red-900 dark:text-red-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Simulated Settlement Declined</p>
                      <p>{session.failureReason}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
              <p>
                {biText(
                  locale,
                  'Simulated Telebirr USSD/QR sandbox. No real Ethio Telecom wallet or live bank account is debited; settled amounts allocate open synthetic invoices and generate a DEMO receipt.',
                  'ይህ የሙከራ ቴሌብር USSD/QR አገልግሎት ነው። እውነተኛ ክፍያ አይፈጸምም፤ የሙከራ (DEMO) ደረሰኝ ብቻ ይወጣል።'
                )}
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-[#233349]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#2D405B] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162438] cursor-pointer"
              >
                {biText(locale, 'Close', 'ዝጋ')}
              </button>
            </div>
          </div>
        )}

        {/* ARIFPAY HOSTED CHECKOUT SANDBOX FLOW */}
        {gatewayType === 'ArifPay Checkout' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ArifPay Payment Rail
                </label>
                <select
                  value={arifpayMethod}
                  onChange={(e) => setArifpayMethod(e.target.value as ArifPaySelectedMethod)}
                  className={inputCls}
                >
                  <option value="TELEBIRR">TELEBIRR Wallet</option>
                  <option value="CBE">CBE Direct Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hosted Checkout Simulation Outcome
                </label>
                <select
                  value={arifpayOutcome}
                  onChange={(e) => setArifpayOutcome(e.target.value as ArifPayOutcome)}
                  className={inputCls}
                >
                  <option value="COMPLETED">COMPLETED (Webhook Verified)</option>
                  <option value="CANCELLED">CANCELLED by Customer</option>
                  <option value="FAILED">FAILED Authorization</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {ARIFPAY_SANDBOX_CONFIG.modeLabel}
              </p>
              <button
                type="button"
                disabled={arifpayBusy}
                onClick={handleCreateArifPaySession}
                className="px-4 py-2 rounded-lg bg-[#0F233A] dark:bg-[#166549] text-white font-semibold cursor-pointer"
              >
                {arifpayBusy ? 'Creating Session…' : 'Create ArifPay Checkout Session'}
              </button>
            </div>

            {arifpaySession && (
              <div className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">
                    {arifpaySession.sessionId}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#166549] dark:text-emerald-400">
                    {arifpaySession.status}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-slate-500 break-all">
                  Nonce: {arifpaySession.nonce} · URL: {arifpaySession.checkoutUrl}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={arifpayBusy}
                    onClick={handleCompleteArifPay}
                    className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer"
                  >
                    Simulate Hosted Checkout & Webhook
                  </button>
                  <button
                    type="button"
                    disabled={arifpayBusy}
                    onClick={handleVerifyArifPayFallback}
                    className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] font-semibold cursor-pointer"
                  >
                    Verify-by-Session Fallback
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-[#233349]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#2D405B] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162438] cursor-pointer"
              >
                {biText(locale, 'Close', 'ዝጋ')}
              </button>
            </div>
          </div>
        )}

        {/* CBE TRANSFER SLIP FORM */}
        {gatewayType === 'CBE Transfer Slip' && (
          <form onSubmit={handleCbeSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  CBE Deposit Slip Reference *
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required
                  placeholder="e.g. CBE-TRF-99281"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Note (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Branch / deposit slip remark"
                  className={inputCls}
                />
              </div>
            </div>

            <DocumentUploadField
              entityType="CBE_SLIP"
              entityRefId={selectedChargeId}
              ownerId={activeOwnerId}
              label={biText(locale, 'Upload CBE Deposit Slip (Image / PDF)', 'የCBE የክፍያ ደረሰኝ ፋይል ይጫኑ')}
              helperText={biText(locale, 'Attach CBE receipt photo or PDF (S3/GCS ready, max 10 MB)', 'የCBE ደረሰኝ ፎቶ ወይም PDF ያያይዙ')}
              value={cbeSlipFile}
              onChange={(file) => {
                setCbeSlipFile(file);
                if (file && !notes.trim()) {
                  setNotes(`Slip attached: ${file.filename} (${file.objectKey})`);
                }
              }}
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#233349]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#2D405B] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162438] cursor-pointer"
              >
                {biText(locale, 'Cancel', 'ሰርዝ')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#C28A24] hover:bg-[#A6731B] text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Submit CBE Slip (Pending Verification)', 'የንግድ ባንክ ቅጽ አስገባ')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
