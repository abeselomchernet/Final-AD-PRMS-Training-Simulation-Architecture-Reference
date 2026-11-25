import React, { Suspense, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  CheckSquare,
  LayoutGrid,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Monitor,
  Moon,
  Send,
  ShieldAlert,
  Smartphone,
  Sun,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import { usePrms } from '../../context/PrmsContext';
import { useTheme } from '../../context/ThemeContext';
import { biText } from '../../data/i18n';
import {
  canSwitchOwnerForRole,
  checkActionPermission,
  checkApprovalAuthority,
  getModuleAccess,
} from '../../policies/rbac';
import {
  ApprovalRequest,
  MaintenanceTicketRecord,
  NavSection,
  OwnerId,
  TenantNoticeRecord,
} from '../../types/prms';
import { NAV_GROUPS, NAV_ITEMS } from '../layout/AppShell';
import { OfflineIndicator, PWAInstallButton } from '../pwa/PWAInstallButton';
import { BottomSheet } from './BottomSheet';
import { StatusLabel } from '../ui/Primitives';
import { useWebPush } from '../../hooks/useWebPush';

type OwnerMobileTab = 'brief' | 'approvals' | 'collections' | 'alerts' | 'more';

export const OwnerMobileApp: React.FC<{
  renderActiveModule: () => React.ReactNode;
}> = ({ renderActiveModule }) => {
  const {
    currentPersona,
    session,
    activeOwnerId,
    activeOwner,
    activeSection,
    setActiveSection,
    setMobileMode,
    switchOwnerContext,
    logoutToLogin,
    ownerUnits,
    ownerCharges,
    ownerReceipts,
    ownerApprovals,
    ownerDelegations,
    ownerMaintenanceTickets,
    ownerMaintenanceMessages,
    ownerGatewayPayments,
    ownerTenants,
    ownerSmsLogs,
    decideApproval,
    attemptSelfApprovalAudit,
    verifyGatewayPayment,
    sendMaintenanceMessage,
    publishTenantNotice,
    dispatchBatchOverdueSmsReminders,
    locale,
    setLocale,
    fmtDateTime,
    fmtEtb,
    fmtShortEtb,
    labels,
    toasts,
    dismissToast,
  } = usePrms();
  const { theme, toggleTheme } = useTheme();
  const webPush = useWebPush(`Owner Mobile (${currentPersona.role})`);

  const [tab, setTab] = useState<OwnerMobileTab>('brief');
  const [openedModule, setOpenedModule] = useState<NavSection | null>(null);

  // Approval BottomSheet
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Ticket Chat BottomSheet
  const [chatTicket, setChatTicket] = useState<MaintenanceTicketRecord | null>(null);
  const [chatBody, setChatBody] = useState('');
  const [chatVisibility, setChatVisibility] = useState<'Shared with Tenant' | 'Internal Staff Note'>(
    'Shared with Tenant'
  );

  // Publish Notice BottomSheet
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    tenantId: 'ALL' as string,
    category: 'Building Notice' as TenantNoticeRecord['category'],
    titleEn: '',
    titleAm: '',
    bodyEn: '',
    bodyAm: '',
  });

  const ownerScope = canSwitchOwnerForRole(currentPersona.role);
  const canRecordPayment = checkActionPermission(currentPersona.role, 'record_payment');

  const pendingApprovals = useMemo(
    () => ownerApprovals.filter((a) => !a.finalized && ['Pending', 'In Review'].includes(a.status)),
    [ownerApprovals]
  );
  const pendingGateway = useMemo(
    () => ownerGatewayPayments.filter((g) => g.status === 'Pending Verification'),
    [ownerGatewayPayments]
  );
  const urgentTickets = useMemo(
    () =>
      ownerMaintenanceTickets.filter(
        (m) => ['High', 'Urgent'].includes(m.priority) && m.workOrderState !== 'Closed'
      ),
    [ownerMaintenanceTickets]
  );
  const openTickets = useMemo(
    () => ownerMaintenanceTickets.filter((m) => m.workOrderState !== 'Closed'),
    [ownerMaintenanceTickets]
  );

  const occupiedCount = ownerUnits.filter((u) => u.status === 'Occupied').length;
  const occupancyRate = ownerUnits.length ? Math.round((occupiedCount / ownerUnits.length) * 100) : 0;
  const totalCollected = ownerReceipts
    .filter((r) => r.documentState !== 'Reversed')
    .reduce((s, r) => s + r.amountEtb, 0);
  const totalOverdue = ownerCharges
    .filter((c) => c.billedEtb > c.paidEtb)
    .reduce((s, c) => s + (c.billedEtb - c.paidEtb), 0);

  const approvalAuthority = selectedApproval
    ? checkApprovalAuthority(
        currentPersona.role,
        selectedApproval,
        session.actorId,
        ownerDelegations
      )
    : null;

  const handleOpenModule = (modId: NavSection) => {
    setActiveSection(modId);
    setOpenedModule(modId);
  };

  const handleApprovalDecision = (decision: 'Approved' | 'Rejected' | 'Returned') => {
    if (!selectedApproval) return;
    if (approvalAuthority && !approvalAuthority.allowed) {
      attemptSelfApprovalAudit(selectedApproval.id);
      return;
    }
    const ok = decideApproval(
      selectedApproval.id,
      decision,
      approvalComment.trim() || `${decision} from Out-of-Office Mobile Mode`
    );
    if (ok) {
      setSelectedApproval(null);
      setApprovalComment('');
    }
  };

  const handleSendTicketMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatTicket || !chatBody.trim()) return;
    const ok = sendMaintenanceMessage({
      ticketId: chatTicket.id,
      body: chatBody.trim(),
      visibility: chatVisibility,
      asTenant: false,
    });
    if (ok) setChatBody('');
  };

  const handlePublishNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.titleEn.trim() || !noticeForm.bodyEn.trim()) return;
    const ok = publishTenantNotice({
      tenantId: noticeForm.tenantId,
      category: noticeForm.category,
      titleEn: noticeForm.titleEn.trim(),
      titleAm: noticeForm.titleAm.trim() || noticeForm.titleEn.trim(),
      bodyEn: noticeForm.bodyEn.trim(),
      bodyAm: noticeForm.bodyAm.trim() || noticeForm.bodyEn.trim(),
    });
    if (ok) {
      setNoticeOpen(false);
      setNoticeForm({
        tenantId: 'ALL',
        category: 'Building Notice',
        titleEn: '',
        titleAm: '',
        bodyEn: '',
        bodyAm: '',
      });
    }
  };

  const ticketMessages = chatTicket
    ? ownerMaintenanceMessages.filter((m) => m.ticketId === chatTicket.id)
    : [];

  return (
    <div
      className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B131E] text-[#0F1D2F] dark:text-slate-100 flex flex-col pb-16 transition-colors"
      data-testid="owner-mobile-app"
    >
      {/* Compact Sticky Top Bar (48px) */}
      <header className="sticky top-0 z-30 h-12 bg-[#0D1D30] text-white px-3 flex items-center justify-between gap-2 border-b border-slate-800">
        <div className="min-w-0 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#C28A24] text-slate-950 text-[11px] font-bold flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#248F64] shrink-0" />
              <select
                aria-label="Mobile Active Owner Context"
                value={activeOwnerId}
                disabled={!ownerScope.canSwitch}
                onChange={(e) => switchOwnerContext(e.target.value as OwnerId)}
                className="bg-transparent text-xs font-bold text-white max-w-[135px] truncate focus:outline-none disabled:opacity-80 cursor-pointer"
              >
                <option value="OWN-ALPHA" className="text-slate-900">
                  Owner Alpha
                </option>
                <option value="OWN-BETA" className="text-slate-900">
                  Owner Beta
                </option>
              </select>
            </div>
            <p className="text-[10px] font-mono text-[#E5B85C] truncate leading-tight">
              {currentPersona.role} · Out-of-Office
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton compact showGuideFallback />
          <button
            type="button"
            onClick={() => setMobileMode('desktop')}
            aria-label={biText(locale, 'Switch to Desktop View', 'ወደ ዴስክቶፕ ገጽታ ተመለስ')}
            className="min-h-[36px] px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Monitor className="w-3.5 h-3.5 text-[#E5B85C]" />
            <span className="hidden sm:inline">{biText(locale, 'Desktop', 'ዴስክቶፕ')}</span>
          </button>
          <button
            type="button"
            onClick={logoutToLogin}
            aria-label="Sign out"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <OfflineIndicator />

      {/* Main Mobile Workspace */}
      <main className="flex-1 w-full max-w-2xl mx-auto p-3.5 space-y-4 overflow-x-hidden">
        {openedModule ? (
          <div className="space-y-3">
            <div className="sticky top-12 z-20 -mx-3.5 px-3.5 py-2 bg-white/95 dark:bg-[#111C2C]/95 backdrop-blur-xs border-b border-[#DFE5EE] dark:border-[#233349] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpenedModule(null)}
                className="min-h-[36px] px-2.5 rounded-lg bg-[#0F233A] dark:bg-[#166549] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Back to Mobile Hub', 'ወደ ሞባይል ማዕከል ተመለስ')}</span>
              </button>
              <span className="text-xs font-bold text-[#0F233A] dark:text-[#E5B85C] truncate">
                {labels[NAV_ITEMS.find((n) => n.id === activeSection)?.labelKey || 'navDashboard']}
              </span>
            </div>
            <Suspense
              fallback={
                <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Loading module…', 'በመጫን ላይ…')}
                </div>
              }
            >
              <div className="min-w-0 overflow-x-hidden">{renderActiveModule()}</div>
            </Suspense>
          </div>
        ) : (
          <>
            {/* TAB 1: EXECUTIVE BRIEF */}
            {tab === 'brief' && (
              <div className="space-y-4">
                <section className="rounded-2xl bg-[#0D1D30] text-white p-4 space-y-3 border border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#E5B85C]">
                        {activeOwner.code} · {activeOwner.name}
                      </p>
                      <h1 className="text-base font-bold mt-0.5">
                        {biText(locale, 'Out-of-Office Executive Brief', 'የውጭ ሥራ አስኪያጅ ማጠቃለያ')}
                      </h1>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                        className="min-h-[36px] min-w-[36px] rounded-lg bg-white/10 flex items-center justify-center cursor-pointer"
                      >
                        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocale(locale === 'en' ? 'am' : 'en')}
                        aria-label="Toggle language"
                        className="min-h-[36px] px-2 rounded-lg bg-white/10 text-[11px] font-semibold cursor-pointer"
                      >
                        {locale === 'en' ? 'አማ' : 'EN'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-[11px] text-slate-300">Occupancy</p>
                      <p className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-0.5">
                        {occupancyRate}%
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {occupiedCount}/{ownerUnits.length} units
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-[11px] text-slate-300">Collected (DEMO)</p>
                      <p className="text-xl font-bold font-mono tabular-nums text-[#E5B85C] mt-0.5">
                        {fmtShortEtb(totalCollected)}
                      </p>
                      <p className="text-[10px] text-slate-400">Overdue: {fmtShortEtb(totalOverdue)}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-[11px] text-slate-300">Pending Approvals</p>
                      <p className="text-xl font-bold font-mono tabular-nums text-white mt-0.5">
                        {pendingApprovals.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-[11px] text-slate-300">Urgent Maintenance</p>
                      <p className="text-xl font-bold font-mono tabular-nums text-red-400 mt-0.5">
                        {urgentTickets.length}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Quick Field Actions */}
                <section className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTab('approvals')}
                    className="min-h-[52px] rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-3 text-left flex items-center gap-2.5 cursor-pointer"
                  >
                    <CheckSquare className="w-5 h-5 text-[#166549] dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">1-Tap Approvals</p>
                      <p className="text-[11px] text-slate-500">{pendingApprovals.length} pending</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('collections')}
                    className="min-h-[52px] rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-3 text-left flex items-center gap-2.5 cursor-pointer"
                  >
                    <Wallet className="w-5 h-5 text-[#C28A24] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">Gateways & SMS</p>
                      <p className="text-[11px] text-slate-500">{pendingGateway.length} unverified</p>
                    </div>
                  </button>
                </section>
              </div>
            )}

            {/* TAB 2: 1-TAP APPROVALS */}
            {tab === 'approvals' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {biText(locale, 'Maker-Checker Approvals Queue', 'የአዘጋጅ-አጽዳቂ ማጽደቂያ ዝርዝር')} (
                    {pendingApprovals.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleOpenModule('approvals')}
                    className="text-xs font-semibold text-[#166549] dark:text-emerald-400 cursor-pointer"
                  >
                    {biText(locale, 'Full View', 'ሙሉ ዕይታ')}
                  </button>
                </div>

                {pendingApprovals.length === 0 ? (
                  <div className="rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-6 text-center text-xs text-slate-500">
                    {biText(locale, 'No pending approvals for this owner.', 'ምንም በመጠባበቅ ላይ ያለ ማጽደቂያ የለም።')}
                  </div>
                ) : (
                  pendingApprovals.map((req) => {
                    const auth = checkApprovalAuthority(
                      currentPersona.role,
                      req,
                      session.actorId,
                      ownerDelegations
                    );
                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] text-slate-500">
                              {req.requestNumber} · Step {req.currentStep}/{req.totalSteps}
                            </p>
                            <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100 mt-0.5">
                              {req.title}
                            </h3>
                          </div>
                          <StatusLabel label={req.status} />
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Maker: <span className="font-mono">{req.makerActorId}</span> ·{' '}
                          {req.makerPersona}
                        </p>
                        {!auth.allowed && (
                          <p className="text-[11px] text-red-700 dark:text-red-300 font-medium flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{auth.reason}</span>
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApproval(req);
                            setApprovalComment('');
                          }}
                          className="w-full min-h-[44px] rounded-xl bg-[#0F233A] dark:bg-[#166549] text-white text-xs font-semibold cursor-pointer"
                        >
                          {biText(locale, 'Review & Decide', 'ገምግም እና ወስን')}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: COLLECTIONS & GATEWAY MONITOR */}
            {tab === 'collections' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                        {biText(locale, 'Automated Rent SMS Reminders', 'አውቶማቲክ የኪራይ SMS ማስታወሻ')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {biText(
                          locale,
                          'Send bilingual alerts to tenants with open balances.',
                          'ክፍት ሂሳብ ላላቸው ተከራዮች ማስታወሻ ይላኩ።'
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatchBatchOverdueSmsReminders()}
                    className="w-full min-h-[44px] rounded-xl bg-[#C28A24] hover:bg-[#A6731B] text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{biText(locale, 'Send Automated Overdue SMS', 'አውቶማቲክ የውዝፍ ኪራይ SMS ላክ')}</span>
                  </button>
                </div>

                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {biText(locale, 'Gateway Queue', 'የጌትዌይ ክፍያዎች')} ({ownerGatewayPayments.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleOpenModule('collections')}
                      className="text-xs font-semibold text-[#166549] dark:text-emerald-400 cursor-pointer"
                    >
                      {biText(locale, 'Open Collections', 'ሙሉ አሰባሰብ')}
                    </button>
                  </div>

                  {ownerGatewayPayments.length === 0 ? (
                    <div className="rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-5 text-center text-xs text-slate-500">
                      No gateway payments submitted yet.
                    </div>
                  ) : (
                    ownerGatewayPayments.slice(0, 8).map((gp) => {
                      const tenant = ownerTenants.find((t) => t.id === gp.tenantId);
                      return (
                        <div
                          key={gp.id}
                          className="rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-4 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-[#0F233A] dark:text-slate-100">
                                {gp.gatewayType} · {tenant?.name || gp.tenantId}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500">
                                {gp.referenceNumber} · {fmtEtb(gp.amountEtb)}
                              </p>
                            </div>
                            <StatusLabel label={gp.status} />
                          </div>
                          {gp.status === 'Pending Verification' && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={!canRecordPayment.allowed}
                                onClick={() => verifyGatewayPayment(gp.id, 'Verified')}
                                className="min-h-[44px] rounded-xl bg-[#166549] disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Verify</span>
                              </button>
                              <button
                                type="button"
                                disabled={!canRecordPayment.allowed}
                                onClick={() => verifyGatewayPayment(gp.id, 'Rejected')}
                                className="min-h-[44px] rounded-xl bg-red-600 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </section>
              </div>
            )}

            {/* TAB 4: ALERTS, MAINTENANCE CHAT & NOTICES */}
            {tab === 'alerts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {biText(locale, 'Maintenance & Tenant Comms', 'ጥገናና የተከራይ ግንኙነት')} ({openTickets.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setNoticeOpen(true)}
                    className="min-h-[40px] px-3 rounded-xl bg-[#166549] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>{biText(locale, 'Publish Notice', 'ማስታወቂያ አውጣ')}</span>
                  </button>
                </div>

                {openTickets.map((t) => {
                  const unit = ownerUnits.find((u) => u.id === t.unitId);
                  const count = ownerMaintenanceMessages.filter((m) => m.ticketId === t.id).length;
                  return (
                    <div
                      key={t.id}
                      className="rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-[11px] text-slate-500">
                            {t.ticketNumber} · {unit?.code || t.unitId}
                          </p>
                          <p className="text-sm font-bold text-[#0F233A] dark:text-slate-100 mt-0.5">
                            {t.title}
                          </p>
                        </div>
                        <StatusLabel label={t.priority} />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{t.description}</p>
                      <button
                        type="button"
                        onClick={() => setChatTicket(t)}
                        className="w-full min-h-[44px] rounded-xl bg-[#0F233A] dark:bg-[#162438] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-[#E5B85C]" />
                        <span>
                          {biText(locale, 'Open 2-Way Thread', 'የውይይት መስመር ክፈት')} ({count})
                        </span>
                      </button>
                    </div>
                  );
                })}

                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {biText(locale, 'Recent SMS Dispatch Log', 'የተላኩ SMS መዝገብ')} ({ownerSmsLogs.length})
                  </h3>
                  {ownerSmsLogs.slice(0, 5).map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-bold text-[#166549] dark:text-emerald-400">
                          {s.triggerType}
                        </span>
                        <span className="text-slate-500">{s.recipientMsisdn}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">{s.messageBody}</p>
                    </div>
                  ))}
                </section>
              </div>
            )}

            {/* TAB 5: FULL 22-MODULE LAUNCHER */}
            {tab === 'more' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#0D1D30] text-white p-4 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold">
                      {biText(locale, 'All 22 Platform Modules', 'ሁሉም 22 የመድረኩ ክፍሎች')}
                    </h2>
                    <p className="text-[11px] text-slate-300">
                      {biText(
                        locale,
                        `Role-scoped access for ${currentPersona.role}`,
                        `ለ ${currentPersona.role} የተፈቀዱ ክፍሎች`
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMode('desktop')}
                    className="min-h-[40px] px-3 rounded-xl bg-[#166549] text-white text-xs font-semibold cursor-pointer shrink-0"
                  >
                    {biText(locale, 'Desktop Mode', 'ዴስክቶፕ')}
                  </button>
                </div>

                <div className="rounded-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#0F233A] dark:text-slate-100">
                        {biText(locale, 'Background Executive Push (VAPID)', 'የጀርባ Web Push ማሳወቂያ (VAPID)')}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {webPush.subscribed
                          ? biText(locale, 'Active for urgent approvals & rent settlements', 'ለአስቸኳይ ማጽደቂያና ክፍያዎች ነቅቷል')
                          : biText(locale, 'Receive alerts even when mobile PWA is closed', 'መተግበሪያው ሲዘጋም ማንቂያ ይቀበሉ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {webPush.subscribed && (
                        <button
                          type="button"
                          disabled={webPush.busy}
                          onClick={() => void webPush.sendTestPush(activeOwnerId)}
                          className="min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] font-semibold cursor-pointer whitespace-nowrap"
                        >
                          {biText(locale, 'Test Push', 'ሙከራ ላክ')}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={webPush.busy}
                        onClick={() => {
                          if (webPush.subscribed) void webPush.disablePush();
                          else void webPush.enablePush();
                        }}
                        className={`min-h-[44px] px-3.5 rounded-xl font-semibold cursor-pointer whitespace-nowrap ${
                          webPush.subscribed
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                            : 'bg-[#0F233A] text-white dark:bg-[#166549]'
                        }`}
                      >
                        {webPush.subscribed
                          ? biText(locale, 'Push Active', 'ነቅቷል')
                          : biText(locale, 'Enable Push', 'አንቃ')}
                      </button>
                    </div>
                  </div>
                  {webPush.statusMessage && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      {webPush.statusMessage}
                    </p>
                  )}
                  {webPush.error && (
                    <p className="text-[11px] text-red-700 dark:text-red-300">{webPush.error}</p>
                  )}
                </div>

                {NAV_GROUPS.map((grp) => {
                  const groupItems = NAV_ITEMS.filter((i) => i.group === grp.id);
                  return (
                    <section key={grp.id} className="space-y-2">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {labels[grp.labelKey] || grp.id}
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {groupItems.map((mod) => {
                          const Icon = mod.icon;
                          const access = getModuleAccess(currentPersona.role, mod.id);
                          return (
                            <button
                              key={mod.id}
                              type="button"
                              onClick={() => handleOpenModule(mod.id)}
                              className={`min-h-[52px] p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                                access.enabled
                                  ? 'bg-white dark:bg-[#111C2C] border-[#DFE5EE] dark:border-[#233349] hover:border-[#166549]'
                                  : 'bg-slate-100/80 dark:bg-[#0F1826] border-slate-200 dark:border-[#1F2D42] opacity-65'
                              }`}
                            >
                              <Icon className="w-4 h-4 text-[#166549] dark:text-emerald-400 shrink-0" />
                              <span className="text-xs font-semibold truncate">
                                {labels[mod.labelKey] || mod.id}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Fixed Bottom Navigation (56px) */}
      <nav
        aria-label="Owner mobile navigation"
        className="fixed bottom-0 inset-x-0 z-30 h-14 bg-white dark:bg-[#111C2C] border-t border-[#DFE5EE] dark:border-[#233349] grid grid-cols-5"
      >
        {(
          [
            { id: 'brief', label: biText(locale, 'Brief', 'ማጠቃለያ'), icon: TrendingUp },
            {
              id: 'approvals',
              label: biText(locale, 'Approvals', 'ማጽደቂያ'),
              icon: CheckSquare,
              badge: pendingApprovals.length,
            },
            {
              id: 'collections',
              label: biText(locale, 'Collect', 'አሰባሰብ'),
              icon: Wallet,
              badge: pendingGateway.length,
            },
            {
              id: 'alerts',
              label: biText(locale, 'Alerts', 'ማንቂያ'),
              icon: Bell,
              badge: urgentTickets.length,
            },
            { id: 'more', label: biText(locale, 'More', 'ሁሉም'), icon: LayoutGrid },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = !openedModule && tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setOpenedModule(null);
                setTab(item.id);
              }}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold relative cursor-pointer ${
                active
                  ? 'text-[#166549] dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {'badge' in item && item.badge ? (
                <span className="absolute top-1.5 right-3 min-w-[16px] h-4 px-1 rounded-full bg-[#C28A24] text-slate-950 text-[9px] font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Approval Decision BottomSheet */}
      <BottomSheet
        open={Boolean(selectedApproval)}
        onClose={() => setSelectedApproval(null)}
        title={selectedApproval ? `${selectedApproval.requestNumber} · Decision` : ''}
        subtitle={selectedApproval?.title}
      >
        {selectedApproval && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] space-y-1">
              <p>
                Maker: <span className="font-mono font-bold">{selectedApproval.makerActorId}</span> (
                {selectedApproval.makerPersona})
              </p>
              <p>
                Step {selectedApproval.currentStep} of {selectedApproval.totalSteps} ·{' '}
                {selectedApproval.category}
              </p>
              <p className="text-slate-600 dark:text-slate-300">{selectedApproval.reason}</p>
            </div>

            {approvalAuthority && !approvalAuthority.allowed && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{approvalAuthority.reason}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold mb-1">Decision Remark</label>
              <textarea
                rows={2}
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Executive decision note…"
                className="w-full p-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleApprovalDecision('Approved')}
                className="min-h-[44px] rounded-xl bg-[#166549] text-white font-semibold cursor-pointer"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleApprovalDecision('Returned')}
                className="min-h-[44px] rounded-xl bg-[#C28A24] text-slate-950 font-semibold cursor-pointer"
              >
                Return
              </button>
              <button
                type="button"
                onClick={() => handleApprovalDecision('Rejected')}
                className="min-h-[44px] rounded-xl bg-red-600 text-white font-semibold cursor-pointer"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Maintenance 2-Way Chat BottomSheet */}
      <BottomSheet
        open={Boolean(chatTicket)}
        onClose={() => setChatTicket(null)}
        title={chatTicket ? `${chatTicket.ticketNumber} · Comms` : ''}
        subtitle={chatTicket?.title}
      >
        {chatTicket && (
          <div className="space-y-3 text-xs">
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {ticketMessages.length === 0 ? (
                <p className="text-slate-500 text-center py-6">No messages on this ticket yet.</p>
              ) : (
                ticketMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-2xl border ${
                      msg.visibility === 'Internal Staff Note'
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                        : 'bg-[#F8FAFC] dark:bg-[#152236] border-[#DFE5EE] dark:border-[#233349]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] mb-1">
                      <span className="font-bold">
                        {msg.senderName} · {msg.visibility}
                      </span>
                      <span className="font-mono text-slate-500">{fmtDateTime(msg.timestamp)}</span>
                    </div>
                    <p>{msg.body}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendTicketMessage} className="space-y-2 pt-2 border-t border-[#DFE5EE] dark:border-[#233349]">
              <div className="grid grid-cols-2 gap-2">
                {(['Shared with Tenant', 'Internal Staff Note'] as const).map((vis) => (
                  <button
                    key={vis}
                    type="button"
                    onClick={() => setChatVisibility(vis)}
                    className={`min-h-[38px] rounded-xl border text-[11px] font-semibold cursor-pointer ${
                      chatVisibility === vis
                        ? 'border-[#166549] bg-emerald-50/70 dark:bg-emerald-950/30 text-[#166549] dark:text-emerald-300'
                        : 'border-[#DFE5EE] dark:border-[#233349] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {vis}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={chatBody}
                  onChange={(e) => setChatBody(e.target.value)}
                  placeholder="Write reply or internal note…"
                  className="flex-1 min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236]"
                />
                <button
                  type="submit"
                  aria-label="Send ticket message"
                  className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-[#166549] text-white flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </BottomSheet>

      {/* Publish Tenant Notice BottomSheet */}
      <BottomSheet
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        title={biText(locale, 'Publish Tenant Notice', 'የተከራይ ማስታወቂያ አውጣ')}
      >
        <form onSubmit={handlePublishNotice} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold mb-1">Audience</label>
              <select
                value={noticeForm.tenantId}
                onChange={(e) => setNoticeForm({ ...noticeForm, tenantId: e.target.value })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236]"
              >
                <option value="ALL">All Tenants ({activeOwner.code})</option>
                {ownerTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Category</label>
              <select
                value={noticeForm.category}
                onChange={(e) =>
                  setNoticeForm({
                    ...noticeForm,
                    category: e.target.value as TenantNoticeRecord['category'],
                  })
                }
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236]"
              >
                <option value="Building Notice">Building Notice</option>
                <option value="Rent Reminder">Rent Reminder</option>
                <option value="Maintenance Advisory">Maintenance Advisory</option>
                <option value="Payment Confirmation">Payment Confirmation</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Title (English) *</label>
            <input
              required
              value={noticeForm.titleEn}
              onChange={(e) => setNoticeForm({ ...noticeForm, titleEn: e.target.value })}
              placeholder="e.g. Scheduled Generator Maintenance"
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Title (Amharic)</label>
            <input
              value={noticeForm.titleAm}
              onChange={(e) => setNoticeForm({ ...noticeForm, titleAm: e.target.value })}
              placeholder="የጄኔሬተር ጥገና ማስታወቂያ"
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Message Body (English) *</label>
            <textarea
              required
              rows={2}
              value={noticeForm.bodyEn}
              onChange={(e) => setNoticeForm({ ...noticeForm, bodyEn: e.target.value })}
              className="w-full p-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236]"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-[#166549] text-white font-semibold cursor-pointer"
          >
            {biText(locale, 'Publish & Notify Tenants', 'አትም እና ተከራዮችን አሳውቅ')}
          </button>
        </form>
      </BottomSheet>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed top-14 right-3 z-50 space-y-2 w-72 max-w-[calc(100vw-1.5rem)]">
          {toasts.map((t) => (
            <div
              key={t.id}
              onClick={() => dismissToast(t.id)}
              className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] p-3 shadow-lg text-xs cursor-pointer"
            >
              <p className="font-bold">{t.title}</p>
              {t.detail && <p className="text-slate-600 dark:text-slate-300 mt-0.5">{t.detail}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
