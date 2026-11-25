import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  Building2,
  Calculator,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Command,
  DatabaseBackup,
  Eye,
  EyeOff,
  FileCheck2,
  FileInput,
  FileSpreadsheet,
  Globe,
  GraduationCap,
  History,
  Languages,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MonitorPlay,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  PlusCircle,
  Receipt,
  RotateCcw,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { biText } from '../../data/i18n';
import { usePrms } from '../../context/PrmsContext';
import { useTheme } from '../../context/ThemeContext';
import {
  canSwitchOwnerForRole,
  checkActionPermission,
  checkApprovalAuthority,
  getModuleAccess,
} from '../../policies/rbac';
import { DateDisplayMode, NavSection, OwnerId, PersonaRole } from '../../types/prms';
import { BrandEmblem } from '../ui/BrandVisuals';
import { Modal } from '../ui/Primitives';
import { OfflineIndicator, PWAInstallButton } from '../pwa/PWAInstallButton';

export type NavGroupId = 'operations' | 'finance' | 'governance' | 'training';

export interface NavItem {
  id: NavSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  group: NavGroupId;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', labelKey: 'navDashboard', icon: LayoutDashboard, group: 'operations' },
  { id: 'owners', labelKey: 'navOwners', icon: BookOpenCheck, group: 'operations' },
  { id: 'portfolio', labelKey: 'navPortfolio', icon: Building2, group: 'operations' },
  { id: 'rental-applications', labelKey: 'navRentalApplications', icon: ClipboardList, group: 'operations' },
  { id: 'tenants-leases', labelKey: 'navTenantsLeases', icon: Users, group: 'operations' },
  { id: 'maintenance', labelKey: 'navMaintenance', icon: Wrench, group: 'operations' },
  { id: 'collections', labelKey: 'navCollections', icon: Wallet, group: 'finance' },
  { id: 'expenses', labelKey: 'navExpenses', icon: Receipt, group: 'finance' },
  { id: 'finance', labelKey: 'navFinance', icon: Calculator, group: 'finance' },
  { id: 'tax', labelKey: 'navTax', icon: Percent, group: 'finance' },
  { id: 'reports', labelKey: 'navReports', icon: FileSpreadsheet, group: 'finance' },
  { id: 'approvals', labelKey: 'navApprovals', icon: CheckSquare, group: 'governance' },
  { id: 'compliance', labelKey: 'navCompliance', icon: ClipboardCheck, group: 'governance' },
  { id: 'audit', labelKey: 'navAudit', icon: History, group: 'governance' },
  { id: 'admin', labelKey: 'navAdmin', icon: Settings, group: 'governance' },
  { id: 'backup-recovery', labelKey: 'navBackupRecovery', icon: DatabaseBackup, group: 'governance' },
  { id: 'migration', labelKey: 'navMigration', icon: FileInput, group: 'governance' },
  { id: 'requirements-acceptance', labelKey: 'navRequirementsAcceptance', icon: FileCheck2, group: 'governance' },
  { id: 'governance', labelKey: 'navGovernance', icon: ShieldCheck, group: 'governance' },
  { id: 'training-exercises', labelKey: 'navTrainingExercises', icon: GraduationCap, group: 'training' },
  { id: 'system-demonstration', labelKey: 'navSystemDemonstration', icon: MonitorPlay, group: 'training' },
  { id: 'security-architecture', labelKey: 'navSecurityArchitecture', icon: ServerCog, group: 'training' },
  { id: 'visual-qa', labelKey: 'navVisualQa', icon: Languages, group: 'training' },
];

export const NAV_GROUPS: { id: NavGroupId; labelKey: string }[] = [
  { id: 'operations', labelKey: 'navGroupOperations' },
  { id: 'finance', labelKey: 'navGroupFinance' },
  { id: 'governance', labelKey: 'navGroupGovernance' },
  { id: 'training', labelKey: 'navGroupTraining' },
];

function getDefaultExpandedGroups(role: PersonaRole): Record<NavGroupId, boolean> {
  switch (role) {
    case 'Owner / Director':
    case 'General Manager':
      return { operations: true, finance: true, governance: true, training: true };
    case 'Assistant Manager':
      return { operations: true, finance: true, governance: false, training: true };
    case 'Finance Officer':
    case 'Collections Clerk':
      return { operations: true, finance: true, governance: false, training: true };
    case 'Property Clerk':
    case 'Clerk':
      return { operations: true, finance: false, governance: false, training: true };
    case 'System Administrator':
      return { operations: false, finance: false, governance: true, training: true };
    case 'Auditor / Read-only reviewer':
      return { operations: false, finance: true, governance: true, training: true };
    case 'Training Coordinator':
      return { operations: true, finance: false, governance: true, training: true };
    default:
      return { operations: true, finance: true, governance: true, training: true };
  }
}

export const AppShell: React.FC<{
  pageTitle: string;
  contextualActions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ pageTitle, contextualActions, children }) => {
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
    resetDemoData,
    locale,
    setLocale,
    dateMode,
    setDateMode,
    labels,
    fmtDateTime,
    ownerApprovals,
    ownerDelegations,
    ownerNotifications,
    markNotificationRead,
    ownerProperties,
    ownerUnits,
    ownerTenants,
    ownerLeases,
    ownerAccounts,
    ownerResearchRequirements,
    ownerSourceRecords,
    ownerAdviserQuestions,
    ownerRentalApplications,
    ownerExpenses,
    ownerMaintenanceTickets,
    ownerRequirementsTraceability,
    toasts,
    dismissToast,
    commandPaletteOpen,
    setCommandPaletteOpen,
    completedExerciseIds,
  } = usePrms();

  const { theme, toggleTheme } = useTheme();
  const ownerScope = canSwitchOwnerForRole(currentPersona.role);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [hideRestrictedNav, setHideRestrictedNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('ad_prms_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<NavGroupId, boolean>>(() =>
    getDefaultExpandedGroups(currentPersona.role)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Reset default expanded groups when active role changes
  useEffect(() => {
    setExpandedGroups(getDefaultExpandedGroups(currentPersona.role));
  }, [currentPersona.role]);

  // Ensure the active module's domain group is always expanded when navigating
  useEffect(() => {
    const activeItem = NAV_ITEMS.find((item) => item.id === activeSection);
    if (activeItem) {
      setExpandedGroups((prev) =>
        prev[activeItem.group] ? prev : { ...prev, [activeItem.group]: true }
      );
    }
  }, [activeSection]);

  useEffect(() => {
    try {
      window.localStorage.setItem('ad_prms_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  }, [sidebarCollapsed]);

  // Ctrl+K / Cmd+K shortcut for Universal Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const pendingForMe = useMemo(
    () =>
      ownerApprovals.filter(
        (req) =>
          (req.status === 'Pending' || req.status === 'In Review') &&
          checkApprovalAuthority(currentPersona.role, req, session.actorId, ownerDelegations).allowed
      ),
    [ownerApprovals, currentPersona.role, session.actorId, ownerDelegations]
  );

  const unreadNotifCount = useMemo(
    () => ownerNotifications.filter((n) => !n.read).length,
    [ownerNotifications]
  );

  const allowedDraftActions = useMemo(() => {
    const drafts: { id: string; label: string; section: NavSection; allowed: boolean; reason: string }[] = [
      {
        id: 'draft-payment',
        label: biText(locale, 'Record Synthetic Rent Payment', 'ሰው-ሠራሽ የኪራይ ክፍያ መዝግብ'),
        section: 'collections',
        ...checkActionPermission(currentPersona.role, 'record_payment'),
      },
      {
        id: 'draft-app',
        label: biText(locale, 'Create Rental Application Draft', 'የኪራይ ማመልከቻ ረቂቅ ፍጠር'),
        section: 'rental-applications',
        ...checkActionPermission(currentPersona.role, 'create_rental_application'),
      },
      {
        id: 'draft-lease',
        label: biText(locale, 'Draft New Lease Version', 'አዲስ የኪራይ ውል ረቂቅ ፍጠር'),
        section: 'tenants-leases',
        ...checkActionPermission(currentPersona.role, 'create_lease'),
      },
      {
        id: 'draft-expense',
        label: biText(locale, 'Submit Expense Request Draft', 'የወጪ ጥያቄ ረቂቅ አስገባ'),
        section: 'expenses',
        ...checkActionPermission(currentPersona.role, 'create_expense_request'),
      },
      {
        id: 'draft-maint',
        label: biText(locale, 'Log Maintenance / Complaint Ticket', 'የጥገና ወይም ቅሬታ መዝገብ ክፈት'),
        section: 'maintenance',
        ...checkActionPermission(currentPersona.role, 'create_maintenance_ticket'),
      },
      {
        id: 'draft-tax',
        label: biText(locale, 'Create Non-Active Tax Draft', 'ንቁ ያልሆነ የታክስ ረቂቅ ፍጠር'),
        section: 'tax',
        ...checkActionPermission(currentPersona.role, 'draft_tax_rule'),
      },
    ];
    return drafts.filter((d) => d.allowed);
  }, [currentPersona.role, locale]);

  // Strictly active-owner-only global search & command results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: { label: string; meta: string; section: NavSection }[] = [];

    ownerProperties.forEach((p) => {
      if (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) {
        hits.push({ label: p.name, meta: `Property · ${p.code}`, section: 'portfolio' });
      }
    });
    ownerUnits.forEach((u) => {
      if (
        u.name.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        u.previousIdentifiers.some((prev) => prev.toLowerCase().includes(q))
      ) {
        hits.push({ label: u.name, meta: `Unit · ${u.status}`, section: 'portfolio' });
      }
    });
    ownerRentalApplications.forEach((app) => {
      if (app.applicantName.toLowerCase().includes(q) || app.applicationNumber.toLowerCase().includes(q)) {
        hits.push({
          label: `${app.applicationNumber} — ${app.applicantName}`,
          meta: `Application · ${app.status}`,
          section: 'rental-applications',
        });
      }
    });
    ownerTenants.forEach((t) => {
      if (t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)) {
        hits.push({ label: t.name, meta: `Tenant · ${t.code}`, section: 'tenants-leases' });
      }
    });
    ownerLeases.forEach((l) => {
      if (l.leaseNumber.toLowerCase().includes(q)) {
        hits.push({
          label: `${l.leaseNumber} (v${l.version})`,
          meta: `Lease · ${l.status}`,
          section: 'tenants-leases',
        });
      }
    });
    ownerExpenses.forEach((ex) => {
      if (ex.requestNumber.toLowerCase().includes(q) || ex.supplierPlaceholder.toLowerCase().includes(q)) {
        hits.push({
          label: `${ex.requestNumber} — ${ex.supplierPlaceholder}`,
          meta: `Expense · ${ex.status}`,
          section: 'expenses',
        });
      }
    });
    ownerMaintenanceTickets.forEach((mt) => {
      if (mt.ticketNumber.toLowerCase().includes(q) || mt.title.toLowerCase().includes(q)) {
        hits.push({
          label: `${mt.ticketNumber} — ${mt.title}`,
          meta: `${mt.category} · ${mt.workOrderState}`,
          section: 'maintenance',
        });
      }
    });
    ownerAccounts.forEach((a) => {
      if (a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)) {
        hits.push({ label: `${a.code} — ${a.name}`, meta: `CoA · ${a.category}`, section: 'finance' });
      }
    });
    ownerApprovals.forEach((a) => {
      if (a.title.toLowerCase().includes(q) || a.requestNumber.toLowerCase().includes(q)) {
        hits.push({ label: a.title, meta: `Approval · ${a.status}`, section: 'approvals' });
      }
    });
    ownerResearchRequirements.forEach((req) => {
      if (
        req.requirementId.toLowerCase().includes(q) ||
        req.topic.toLowerCase().includes(q) ||
        req.proposedProductControl.toLowerCase().includes(q)
      ) {
        hits.push({
          label: `${req.requirementId} — ${req.topic}`,
          meta: `Compliance · ${req.productionActivationStatus}`,
          section: 'compliance',
        });
      }
    });
    ownerAdviserQuestions.forEach((aq) => {
      if (aq.question.toLowerCase().includes(q) || aq.id.toLowerCase().includes(q)) {
        hits.push({
          label: aq.question,
          meta: `Adviser Queue · ${aq.status}`,
          section: 'compliance',
        });
      }
    });
    ownerSourceRecords.forEach((src) => {
      if (
        src.title.toLowerCase().includes(q) ||
        src.id.toLowerCase().includes(q) ||
        src.sourceType.toLowerCase().includes(q)
      ) {
        hits.push({
          label: `${src.id} — ${src.title}`,
          meta: `Source Record · ${activeOwner.code}`,
          section: 'compliance',
        });
      }
    });
    ownerRequirementsTraceability.forEach((tr) => {
      if (tr.requirementId.toLowerCase().includes(q) || tr.title.toLowerCase().includes(q)) {
        hits.push({
          label: `${tr.requirementId} — ${tr.title}`,
          meta: `UAT · ${tr.prototypeStatus}`,
          section: 'requirements-acceptance',
        });
      }
    });

    return hits.filter((h) => getModuleAccess(currentPersona.role, h.section).enabled).slice(0, 10);
  }, [
    searchQuery,
    activeOwner.code,
    currentPersona.role,
    ownerProperties,
    ownerUnits,
    ownerRentalApplications,
    ownerTenants,
    ownerLeases,
    ownerExpenses,
    ownerMaintenanceTickets,
    ownerAccounts,
    ownerApprovals,
    ownerResearchRequirements,
    ownerSourceRecords,
    ownerAdviserQuestions,
    ownerRequirementsTraceability,
  ]);

  const matchingNavModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return NAV_ITEMS.filter((item) => {
      const access = getModuleAccess(currentPersona.role, item.id);
      if (!access.enabled) return false;
      if (!q) return true;
      return labels[item.labelKey].toLowerCase().includes(q) || item.id.includes(q);
    });
  }, [currentPersona.role, labels, searchQuery]);

  const cycleDateMode = () => {
    const order: DateDisplayMode[] = ['gregorian', 'ethiopic', 'dual'];
    const idx = order.indexOf(dateMode);
    setDateMode(order[(idx + 1) % order.length]);
  };

  const renderSidebar = (isCompact: boolean) => (
    <div className="flex flex-col h-full bg-[#0D1D30] dark:bg-[#07101B] text-slate-100 select-none">
      {/* Brand Crest Header */}
      <div className={`px-3.5 py-3.5 border-b border-white/10 ${isCompact ? 'flex flex-col items-center gap-2' : ''}`}>
        <div className={`flex items-center ${isCompact ? 'justify-center' : 'justify-between'} gap-2 w-full`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandEmblem size="sm" />
            {!isCompact && (
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight text-white truncate">
                  {labels.appShort}
                </p>
                <p className="text-[11px] text-[#E5B85C]/90 truncate">
                  {biText(locale, 'Training & Reference', 'የስልጠና እና ማጣቀሻ')}
                </p>
              </div>
            )}
          </div>
          {!isCompact && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setHideRestrictedNav((v) => !v)}
                title={biText(
                  locale,
                  hideRestrictedNav ? 'Show restricted modules with explanation' : 'Hide restricted modules',
                  hideRestrictedNav ? 'የተገደቡ ክፍሎችን አሳይ' : 'የተገደቡ ክፍሎችን ደብቅ'
                )}
                aria-label={biText(locale, 'Toggle restricted modules', 'የተገደቡ ክፍሎችን ቀይር')}
                className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                {hideRestrictedNav ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                title={labels.collapseSidebar}
                aria-label={labels.collapseSidebar}
                className="hidden lg:inline-flex p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {isCompact && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            title={labels.expandSidebar}
            aria-label={labels.expandSidebar}
            className="hidden lg:inline-flex p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Collapsible Grouped Role Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5 space-y-2" aria-label="Primary Navigation">
        {NAV_GROUPS.map((group) => {
          const groupItems = NAV_ITEMS.filter((item) => {
            if (item.group !== group.id) return false;
            const access = getModuleAccess(currentPersona.role, item.id);
            if (hideRestrictedNav && !access.enabled) return false;
            return true;
          });
          if (groupItems.length === 0) return null;

          const isExpanded = isCompact || expandedGroups[group.id];

          return (
            <div key={group.id} className="space-y-0.5">
              {!isCompact && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                  }
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-[#E5B85C] transition-colors cursor-pointer"
                  aria-expanded={isExpanded}
                >
                  <span className="truncate">{labels[group.labelKey]}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )}
                </button>
              )}

              {isExpanded && (
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    const access = getModuleAccess(currentPersona.role, item.id);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!access.enabled}
                        title={access.enabled ? labels[item.labelKey] : access.reason}
                        onClick={() => {
                          if (!access.enabled) return;
                          setActiveSection(item.id);
                          setMobileNavOpen(false);
                        }}
                        className={`w-full flex items-center ${
                          isCompact ? 'justify-center px-2 py-2.5' : 'justify-between gap-2 px-3 py-2'
                        } rounded-md text-xs font-medium transition-colors ${
                          !access.enabled
                            ? 'text-slate-400/50 bg-white/[0.02] cursor-not-allowed'
                            : active
                              ? 'bg-[#166549] text-white shadow-xs cursor-pointer'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer'
                        }`}
                      >
                        <span className={`flex items-center ${isCompact ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                          <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#F3D082]' : ''}`} />
                          {!isCompact && <span className="truncate">{labels[item.labelKey]}</span>}
                        </span>
                        {!isCompact && (
                          <>
                            {!access.enabled ? (
                              <Lock className="w-3 h-3 text-slate-400/60 shrink-0" aria-hidden="true" />
                            ) : item.id === 'approvals' && pendingForMe.length > 0 ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#C28A24] text-slate-950 font-bold shrink-0">
                                {pendingForMe.length}
                              </span>
                            ) : item.id === 'training-exercises' ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/15 text-slate-100 shrink-0">
                                {completedExerciseIds.length}/10
                              </span>
                            ) : null}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Fixed Session Footer */}
      <div className="p-3 border-t border-white/10 text-[11px] text-slate-300 space-y-1">
        {isCompact ? (
          <div className="flex flex-col items-center gap-1" title={`${currentPersona.role} · ${session.actorId}`}>
            <span className="w-7 h-7 rounded bg-[#166549] text-white text-[10px] font-bold flex items-center justify-center">
              {currentPersona.role.slice(0, 2).toUpperCase()}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{labels.activePersona}</span>
              <span className="font-mono text-slate-200">{session.actorId}</span>
            </div>
            <p className="font-semibold text-white truncate">{currentPersona.role}</p>
            <p className="text-[10px] font-mono text-emerald-300 truncate">
              {session.username} · {biText(locale, 'Role Fixed for Session', 'ሚና በክፍለ-ጊዜው የተወሰነ')}
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{labels.sessionExpires}:</span>
              <span className="font-mono text-slate-300">{fmtDateTime(session.sessionExpiryTime)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B131E] text-[#0F1D2F] dark:text-slate-100 transition-colors"
      data-locale={locale}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-[#0F233A] focus:text-white focus:text-xs focus:font-semibold focus:shadow-lg"
      >
        {biText(locale, 'Skip to main content', 'ወደ ዋናው ይዘት እለፍ')}
      </a>
      {/* Persistent Top Training Mode Banner + Mode, Theme & Locale Bar */}
      <OfflineIndicator />
      <div className="bg-[#141A24] dark:bg-[#060B12] text-amber-50 px-3 sm:px-4 py-1.5 border-b border-[#C28A24]/30 flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-semibold tracking-wide min-w-0">
          <span className="text-[#F3D082] break-words">{labels.demoBanner}</span>
          <span className="hidden xl:inline text-slate-300 font-normal">
            · {labels.demoSubBanner}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setActiveSection('training-exercises')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'training-exercises'
                ? 'bg-[#166549] text-white'
                : 'bg-white/10 hover:bg-white/15 text-slate-100'
            }`}
          >
            {biText(locale, 'Training Exercises', 'የስልጠና ልምምዶች')} ({completedExerciseIds.length}/10)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('security-architecture')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'security-architecture'
                ? 'bg-[#C28A24] text-slate-950'
                : 'bg-white/10 hover:bg-white/15 text-slate-100'
            }`}
          >
            {biText(locale, 'Production Architecture Reference', 'የምርት ደህንነት አርክቴክቸር')}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={biText(locale, 'Toggle daylight or dark slate theme', 'የቀን ወይም የምሽት ገጽታ ቀይር')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-slate-100 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'light' ? (
              <Moon className="w-3 h-3 text-[#E5B85C]" />
            ) : (
              <Sun className="w-3 h-3 text-[#E5B85C]" />
            )}
            <span>{theme === 'light' ? labels.themeDark : labels.themeLight}</span>
          </button>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-slate-100 text-[11px] whitespace-nowrap shrink-0">
            <Calendar className="w-3 h-3 shrink-0 text-[#E5B85C]" />
            <select
              aria-label="Date Display Calendar Mode"
              value={dateMode}
              onChange={(e) => setDateMode(e.target.value as DateDisplayMode)}
              className="bg-transparent font-semibold text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="gregorian" className="text-slate-900">
                {labels.gregorianOption}
              </option>
              <option value="ethiopic" className="text-slate-900">
                {labels.ethiopicOption}
              </option>
              <option value="dual" className="text-slate-900">
                {labels.dualOption}
              </option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setLocale(locale === 'en' ? 'am' : 'en')}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#166549]/90 hover:bg-[#166549] text-white text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-3 h-3" />
            <span>{locale === 'en' ? 'EN → አማርኛ' : 'አማርኛ → EN'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden lg:block shrink-0 border-r border-[#DFE5EE] dark:border-[#233349] transition-all duration-150 ${
            sidebarCollapsed ? 'w-[68px]' : 'w-64'
          }`}
        >
          <div className="sticky top-0 h-screen max-h-[calc(100vh-2rem)]">
            {renderSidebar(sidebarCollapsed)}
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="w-64 h-full">{renderSidebar(false)}</div>
            <div className="flex-1 bg-slate-950/60" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="bg-white dark:bg-[#111C2C] border-b border-[#DFE5EE] dark:border-[#233349] px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 min-w-0">
            {/* Zone 1: Mobile Menu + Explicit Owner Context Isolation Control */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162438] cursor-pointer shrink-0"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Lock className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline whitespace-nowrap">
                  {labels.ownerContext}:
                </span>
                <select
                  aria-label="Active Owner Context"
                  value={activeOwnerId}
                  disabled={!ownerScope.canSwitch}
                  onChange={(e) => switchOwnerContext(e.target.value as OwnerId)}
                  className="text-xs font-semibold text-[#0F233A] dark:text-slate-100 bg-[#F4F6F9] dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-md px-2 sm:px-2.5 py-1.5 max-w-[160px] sm:max-w-none truncate disabled:opacity-75 disabled:cursor-not-allowed"
                  title={ownerScope.note}
                >
                  <option value="OWN-ALPHA">Test Owner Alpha (OWN-ALPHA)</option>
                  <option value="OWN-BETA">Test Owner Beta (OWN-BETA)</option>
                </select>
              </div>
            </div>

            {/* Zone 2: Universal Command Palette Trigger (Active Owner Scoped) */}
            <div className="hidden md:flex flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border border-[#DFE5EE] dark:border-[#233349] bg-[#F4F6F9] dark:bg-[#162438] hover:bg-slate-100 dark:hover:bg-[#1B2B44] text-xs text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                aria-label="Open Universal Command Palette"
              >
                <span className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{labels.searchPlaceholder}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-300 bg-white dark:bg-[#0D1D30] border border-[#DFE5EE] dark:border-[#233349] px-1.5 py-0.5 rounded shrink-0">
                  <Command className="w-2.5 h-2.5" />K
                </span>
              </button>
            </div>

            {/* Zone 3: Mobile Mode + PWA Install + Notifications + Persona Menu */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMode('owner-mobile')}
                aria-label={biText(locale, 'Switch to Out-of-Office Mobile', 'ወደ ሞባይል ገጽታ ቀይር')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#DFE5EE] dark:border-[#233349] bg-[#F4F6F9] dark:bg-[#162438] hover:bg-slate-100 dark:hover:bg-[#1B2B44] text-xs font-semibold text-[#0F233A] dark:text-[#E5B85C] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">
                  {biText(locale, 'Out-of-Office Mobile', 'የውጭ ሞባይል')}
                </span>
              </button>

              <PWAInstallButton compact showGuideFallback />

              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="md:hidden p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162438] cursor-pointer"
                aria-label="Open Command Palette"
              >
                <Search className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    setUserMenuOpen(false);
                  }}
                  className="relative p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162438] hover:text-[#0F233A] dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#C28A24]" />
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl shadow-lg z-40 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#0F233A] dark:text-slate-100">
                        {biText(locale, 'Owner Alerts', 'የባለቤት ማንቂያዎች')} ({activeOwner.name})
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        aria-label="Close notifications"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#233349]/70">
                      {ownerNotifications.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                          {biText(
                            locale,
                            `No notifications for ${activeOwner.name}.`,
                            `ለ ${activeOwner.name} ምንም ማንቂያ የለም።`
                          )}
                        </p>
                      ) : (
                        ownerNotifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              markNotificationRead(n.id);
                              if (getModuleAccess(currentPersona.role, n.targetSection).enabled) {
                                setActiveSection(n.targetSection);
                              }
                              setNotifOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#162438] transition-colors cursor-pointer ${
                              n.read ? 'opacity-70' : 'bg-amber-50/40 dark:bg-amber-950/20'
                            }`}
                          >
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{n.detail}</p>
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                              {fmtDateTime(n.timestamp)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((v) => !v);
                    setNotifOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[#DFE5EE] dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#162438] text-left transition-colors cursor-pointer"
                >
                  <div className="w-6 h-6 rounded bg-[#0F233A] dark:bg-[#166549] text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                    {currentPersona.role.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden sm:block min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                      {currentPersona.role}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl shadow-lg z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] space-y-1">
                      <p className="text-xs font-semibold text-[#0F233A] dark:text-slate-100">
                        {currentPersona.displayName}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {currentPersona.role} ·{' '}
                        <span className="font-mono">{session.username}</span> ·{' '}
                        <span className="font-mono">{session.actorId}</span>
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {labels.sessionExpires}: {fmtDateTime(session.sessionExpiryTime)}
                      </p>
                      <p className="text-[10px] text-[#946414] dark:text-amber-300 pt-0.5">
                        {biText(
                          locale,
                          'Active role is fixed per session. Sign out to switch training accounts.',
                          'ሚና በዚህ ክፍለ-ጊዜ የተወሰነ ነው፤ መለያ ለመቀየር ውጡ።'
                        )}
                      </p>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <button
                        type="button"
                        disabled={!session.isTrainer}
                        title={
                          session.isTrainer
                            ? biText(locale, 'Reset synthetic training seed', 'የስልጠና ውሂብ ዳግም አስጀምር')
                            : biText(
                                locale,
                                'Restricted to trainer.demo (Training Coordinator)',
                                'ለ trainer.demo (የስልጠና አስተባባሪ) ብቻ የተፈቀደ'
                              )
                        }
                        onClick={() => {
                          setUserMenuOpen(false);
                          resetDemoData();
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#162438] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{labels.resetDemo}</span>
                        </span>
                        {!session.isTrainer && (
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">trainer.demo</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logoutToLogin();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{labels.switchPersona}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page Header & Breadcrumb */}
          <div className="bg-white dark:bg-[#111C2C] border-b border-[#DFE5EE] dark:border-[#233349] px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>AD-PRMS</span>
                <span aria-hidden="true">/</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{activeOwner.name}</span>
                <span aria-hidden="true">/</span>
                <span className="text-[#166549] dark:text-emerald-400 font-semibold">{pageTitle}</span>
              </div>
              <h1 className="text-xl font-bold text-[#0F233A] dark:text-slate-100 mt-0.5 text-balance">{pageTitle}</h1>
            </div>
            {contextualActions && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">{contextualActions}</div>
            )}
          </div>

          {/* Main Content Area */}
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-4 sm:p-6 max-w-[1440px] w-full mx-auto focus:outline-none">
            {children}
          </main>
        </div>
      </div>

      {/* Universal Command Palette (Owner Isolated + Role Aware) */}
      <Modal
        open={commandPaletteOpen}
        onClose={() => {
          setCommandPaletteOpen(false);
          setSearchQuery('');
        }}
        title={`${labels.commandPaletteTitle} — ${activeOwner.name}`}
        subtitle={labels.commandPaletteSubtitle}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label="Universal Command Palette Input"
            className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549] dark:focus:ring-emerald-400"
          />

          <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
            {/* Search Records in Active Owner */}
            {searchQuery.trim() && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  {biText(locale, `Matching Records (${activeOwner.code})`, `ተዛማጅ መዝገቦች (${activeOwner.code})`)}
                </p>
                <div className="divide-y divide-slate-100 dark:divide-[#233349] border border-[#DFE5EE] dark:border-[#233349] rounded-lg">
                  {searchResults.length === 0 ? (
                    <p className="p-3 text-slate-500 dark:text-slate-400">{labels.noMatchingRecords}</p>
                  ) : (
                    searchResults.map((hit, idx) => (
                      <button
                        key={`${hit.label}-${idx}`}
                        type="button"
                        onClick={() => {
                          setActiveSection(hit.section);
                          setCommandPaletteOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-[#162438] flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <span className="font-medium text-[#0F233A] dark:text-slate-100 truncate">{hit.label}</span>
                        <span className="text-slate-500 dark:text-slate-400 shrink-0 font-mono text-[11px]">{hit.meta}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Open Pending Approvals */}
            {pendingForMe.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  {biText(locale, 'Pending Approvals Ready for Your Role', 'ለእርስዎ ሚና ዝግጁ የሆኑ ማጽደቂያዎች')}
                </p>
                <div className="divide-y divide-slate-100 dark:divide-[#233349] border border-[#DFE5EE] dark:border-[#233349] rounded-lg">
                  {pendingForMe.slice(0, 4).map((req) => (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => {
                        setActiveSection('approvals');
                        setCommandPaletteOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-[#162438] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <span className="font-medium text-[#0F233A] dark:text-slate-100 truncate">
                        {req.requestNumber} · {req.title}
                      </span>
                      <span className="text-[11px] font-mono text-[#946414] dark:text-amber-300 shrink-0">
                        Step {req.currentStep}/{req.totalSteps}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create Allowed Draft */}
            {allowedDraftActions.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  {biText(locale, `Allowed Draft Actions (${currentPersona.role})`, `የተፈቀዱ ረቂቅ እርምጃዎች (${currentPersona.role})`)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {allowedDraftActions.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(act.section);
                        setCommandPaletteOpen(false);
                        setSearchQuery('');
                      }}
                      className="text-left px-3 py-2 rounded-lg border border-[#DFE5EE] dark:border-[#233349] hover:border-[#166549] dark:hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 flex items-center gap-2 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{act.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Go to Module */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {biText(locale, 'Go to Module', 'ወደ ክፍል ሂድ')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {matchingNavModules.slice(0, 10).map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(mod.id);
                        setCommandPaletteOpen(false);
                        setSearchQuery('');
                      }}
                      className="text-left px-3 py-2 rounded-lg border border-[#DFE5EE] dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#162438] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 text-[#0F233A] dark:text-emerald-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{labels[mod.labelKey]}</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preferences */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {biText(locale, 'Quick Workspace Settings', 'ፈጣን የገጽታ ቅንብሮች')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLocale(locale === 'en' ? 'am' : 'en')}
                  className="px-3 py-1.5 rounded-md border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1B2B44] font-semibold text-[#0F233A] dark:text-slate-100 cursor-pointer"
                >
                  {biText(locale, 'Switch Language: EN → አማርኛ', 'ቋንቋ ቀይር: አማርኛ → EN')}
                </button>
                <button
                  type="button"
                  onClick={cycleDateMode}
                  className="px-3 py-1.5 rounded-md border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1B2B44] font-semibold text-[#0F233A] dark:text-slate-100 cursor-pointer"
                >
                  {biText(locale, `Calendar Mode: ${dateMode}`, `የቀን መቁጠሪያ: ${dateMode}`)}
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-md border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1B2B44] font-semibold text-[#0F233A] dark:text-slate-100 cursor-pointer"
                >
                  {theme === 'light' ? labels.themeDark : labels.themeLight}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-4 py-3 shadow-lg bg-white dark:bg-[#111C2C] flex items-start justify-between gap-2 ${
                t.tone === 'error'
                  ? 'border-red-300 dark:border-red-800/70'
                  : t.tone === 'warning'
                    ? 'border-amber-300 dark:border-amber-800/70'
                    : 'border-emerald-300 dark:border-emerald-800/70'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
                {t.detail && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{t.detail}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
