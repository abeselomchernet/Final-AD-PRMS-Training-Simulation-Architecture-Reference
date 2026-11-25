import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  Clock,
  Compass,
  Layers,
  PlusCircle,
  Zap,
} from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { checkActionPermission, checkApprovalAuthority } from '../policies/rbac';
import { NavSection } from '../types/prms';
import { AddisArchitecturalShowcase } from '../components/ui/BrandVisuals';
import { GovernanceCallout, KpiCard, StatusLabel } from '../components/ui/Primitives';
import { FiscalRevenueD3Chart } from '../components/dashboard/FiscalRevenueD3Chart';
import { OccupancyTrendRechartsWidget } from '../components/dashboard/OccupancyTrendRechartsWidget';

export const ExecutiveDashboard: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    session,
    ownerUnits,
    ownerCharges,
    ownerReceipts,
    ownerApprovals,
    ownerDelegations,
    ownerAuditEvents,
    ownerTenants,
    ownerRentalApplications,
    ownerExpenses,
    ownerMaintenanceTickets,
    ownerTaxRules,
    ownerProductionGates,
    setActiveSection,
    locale,
    fmtDate,
    fmtDateTime,
    fmtEtb,
    fmtShortEtb,
  } = usePrms();

  const metrics = useMemo(() => {
    const occupied = ownerUnits.filter((u) => u.status === 'Occupied').length;
    const vacant = ownerUnits.filter((u) => u.status === 'Vacant').length;
    const monthlyBilled = ownerCharges
      .filter((c) => c.period === '2026-11')
      .reduce((sum, c) => sum + c.billedEtb, 0);
    const totalCollected = ownerReceipts
      .filter((r) => r.documentState !== 'Reversed')
      .reduce((sum, r) => sum + r.amountEtb, 0);
    const outstanding = ownerCharges.reduce(
      (sum, c) => sum + Math.max(0, c.billedEtb - c.paidEtb),
      0
    );
    const pendingApprovals = ownerApprovals.filter(
      (a) => a.status === 'Pending' || a.status === 'In Review'
    ).length;
    return { occupied, vacant, monthlyBilled, totalCollected, outstanding, pendingApprovals };
  }, [ownerUnits, ownerCharges, ownerReceipts, ownerApprovals]);

  const pendingForMyRole = useMemo(
    () =>
      ownerApprovals.filter(
        (req) =>
          (req.status === 'Pending' || req.status === 'In Review') &&
          checkApprovalAuthority(currentPersona.role, req, session.actorId, ownerDelegations).allowed
      ),
    [ownerApprovals, currentPersona.role, session.actorId, ownerDelegations]
  );

  const arrearsList = useMemo(
    () =>
      ownerCharges
        .filter((c) => c.billedEtb > c.paidEtb)
        .map((c) => {
          const tenant = ownerTenants.find((t) => t.id === c.tenantId);
          const unit = ownerUnits.find((u) => u.id === c.unitId);
          return {
            ...c,
            tenantName: tenant?.name || c.tenantId,
            unitName: unit?.name || c.unitId,
            balanceEtb: c.billedEtb - c.paidEtb,
          };
        }),
    [ownerCharges, ownerTenants, ownerUnits]
  );

  // Role-Tailored Hero Focus Lens across all 10 roles
  const roleLens = useMemo(() => {
    const role = currentPersona.role;
    const openTickets = ownerMaintenanceTickets.filter((m) => m.workOrderState !== 'Closed').length;
    const openApps = ownerRentalApplications.filter(
      (a) => a.status === 'Submitted' || a.status === 'Approved'
    ).length;
    const pendingExp = ownerExpenses.filter((e) => e.status === 'Pending Approval').length;

    switch (role) {
      case 'Owner / Director':
        return {
          focusLabel: biText(locale, 'Owner Executive Oversight', 'የባለቤት አስፈጻሚ ቁጥጥር'),
          headline: biText(
            locale,
            `${activeOwner.name} Portfolio & Governance Snapshot`,
            `የ${activeOwner.name} ንብረትና የአስተዳደር ማጠቃለያ`
          ),
          summary: biText(
            locale,
            `Inspect isolated property performance, verify compliance adviser gates, and sign off final Owner-level approvals without cross-owner leakage.`,
            `የተነጠለ የንብረት አፈጻጸምን ይመልከቱ፣ የታክስ/ሕግ አማካሪ በሮችን ያረጋግጡ፣ የባለቤት ማጽደቂያዎችን ይወስኑ።`
          ),
          ctaLabel: biText(locale, 'Open Owner Approvals', 'የባለቤት ማጽደቂያዎችን ክፈት'),
          ctaSection: 'approvals' as NavSection,
          highlightMetric: `${pendingForMyRole.length} ${biText(locale, 'Actionable Approvals', 'ለውሳኔ የቀረቡ')}`,
          showArtwork: true,
        };
      case 'General Manager':
        return {
          focusLabel: biText(locale, 'General Management Command', 'የዋና ሥራ አስኪያጅ መቆጣጠሪያ'),
          headline: biText(
            locale,
            'Cross-Operational Control, Maker-Checker & Arrears Watch',
            'አጠቃላይ የሥራ ክትትል፣ አዘጋጅ-አጽዳቂ እና የቀሪ ሂሳብ ቁጥጥር'
          ),
          summary: biText(
            locale,
            `Coordinate leases, expenses, and high-priority tenant renewals while preserving independent Checker segregation of duties.`,
            `ውሎችን፣ ወጪዎችን እና የማጽደቅ ሂደቶችን በገለልተኛ አጽዳቂ ቁጥጥር ይምሩ።`
          ),
          ctaLabel: biText(locale, 'Review Approval Queue', 'የማጽደቂያ ወረፋ ገምግም'),
          ctaSection: 'approvals' as NavSection,
          highlightMetric: `${pendingForMyRole.length} ${biText(locale, 'Pending Checks', 'ማጽደቂያዎች')}`,
          showArtwork: true,
        };
      case 'Assistant Manager':
        return {
          focusLabel: biText(locale, 'Operations & Leasing Coordination', 'የዕለት ሥራ እና የኪራይ አስተባባሪ'),
          headline: biText(
            locale,
            'Rental Applications, Maintenance Dispatch & First-Line Reviews',
            'የኪራይ ማመልከቻዎች፣ የጥገና ትዕዛዞች እና የመጀመሪያ ደረጃ ግምገማ'
          ),
          summary: biText(
            locale,
            `Review screened rental applications, dispatch maintenance work orders, and advance operational items within delegated limits.`,
            `የቀረቡ የኪራይ ማመልከቻዎችን እና የጥገና ትዕዛዞችን በተፈቀደ ውክልና መሠረት ያስተናግዱ።`
          ),
          ctaLabel: biText(locale, 'Review Rental Applications', 'የኪራይ ማመልከቻዎችን ክፈት'),
          ctaSection: 'rental-applications' as NavSection,
          highlightMetric: `${openApps} ${biText(locale, 'Active Applications', 'ንቁ ማመልከቻዎች')}`,
          showArtwork: false,
        };
      case 'Finance Officer':
        return {
          focusLabel: biText(locale, 'Finance, Double-Entry & Tax Drafts', 'የፋይናንስ፣ ድርብ-መዝገብ እና የታክስ ረቂቅ'),
          headline: biText(
            locale,
            'Receivables Reconciliation, Payables & Non-Active Tax Governance',
            'የሂሳብ ማስታረቅ፣ የወጪ ክፍያዎች እና ንቁ ያልሆነ የታክስ ቁጥጥር'
          ),
          summary: biText(
            locale,
            `Track overdue rent charges, draft supplier payables, inspect trial balance entries, and prepare Ethiopian tax adviser verification queues.`,
            `ያልተከፈሉ የኪራይ ክፍያዎችን፣ የወጪ መዝገቦችንና የታክስ አማካሪ ጥያቄዎችን ያቀናብሩ።`
          ),
          ctaLabel: biText(locale, 'Open Finance Ledger', 'የፋይናንስ መዝገብ ክፈት'),
          ctaSection: 'finance' as NavSection,
          highlightMetric: `${pendingExp} ${biText(locale, 'Expense Reviews', 'የወጪ ጥያቄዎች')}`,
          showArtwork: false,
        };
      case 'Collections Clerk':
        return {
          focusLabel: biText(locale, 'Rent Billing & Receipt Desk', 'የኪራይ ክፍያ እና ደረሰኝ መስኮት'),
          headline: biText(
            locale,
            'Daily Synthetic Rent Collections & DEMO Receipt Issuance',
            'ዕለታዊ ሰው-ሠራሽ የኪራይ አሰባሰብ እና DEMO ደረሰኝ አሰጣጥ'
          ),
          summary: biText(
            locale,
            `Post synthetic rent receipts against open monthly charges and track void-request handoffs to independent Checkers.`,
            `ለክፍት ወርሃዊ ክፍያዎች ሰው-ሠራሽ DEMO ደረሰኞችን ይመዝግቡ እና የቀሪ ሂሳብ ክትትል ያድርጉ።`
          ),
          ctaLabel: biText(locale, 'Open Rent & Collections', 'ኪራይና አሰባሰብ ክፈት'),
          ctaSection: 'collections' as NavSection,
          highlightMetric: `${arrearsList.length} ${biText(locale, 'Open Charges', 'ክፍት ክፍያዎች')}`,
          showArtwork: false,
        };
      case 'Property Clerk':
        return {
          focusLabel: biText(locale, 'Portfolio & Maintenance Desk', 'የንብረት ማህደር እና ጥገና'),
          headline: biText(
            locale,
            'Buildings, Unit Readiness, Leasing Intake & Work Orders',
            'ሕንጻዎች፣ የክፍሎች ዝግጁነት እና የጥገና ትዕዛዞች'
          ),
          summary: biText(
            locale,
            `Maintain unit occupancy records, register rental applicants, and log maintenance or tenant complaint tickets.`,
            `የክፍሎች ሁኔታን፣ አዲስ የኪራይ ማመልከቻዎችንና የጥገና/ቅሬታ መዝገቦችን ይከታተሉ።`
          ),
          ctaLabel: biText(locale, 'Open Property Portfolio', 'የንብረት ማህደር ክፈት'),
          ctaSection: 'portfolio' as NavSection,
          highlightMetric: `${openTickets} ${biText(locale, 'Open Tickets', 'ክፍት ጥገናዎች')}`,
          showArtwork: true,
        };
      case 'Clerk':
        return {
          focusLabel: biText(locale, 'Front-Desk Maker Operations', 'የፊት-መስኮት ጸሐፊ ሥራዎች'),
          headline: biText(
            locale,
            'Daily Intake, Receipts Drafts & Tenant Service Queue',
            'ዕለታዊ መረጃ መቀበያ፣ የደረሰኝ ረቂቅ እና የተከራዮች አገልግሎት'
          ),
          summary: biText(
            locale,
            `Prepare drafts for Checker approval without self-approval authority across leasing, collections, and maintenance.`,
            `ለአጽዳቂ የሚቀርቡ ረቂቆችን ያዘጋጁ (ራስን ማጽደቅ ተከልክሏል)።`
          ),
          ctaLabel: biText(locale, 'Open Rent & Collections', 'ኪራይና አሰባሰብ ክፈት'),
          ctaSection: 'collections' as NavSection,
          highlightMetric: `${arrearsList.length} ${biText(locale, 'Due Invoices', 'የሚከፈሉ')}`,
          showArtwork: false,
        };
      case 'System Administrator':
        return {
          focusLabel: biText(locale, 'RBAC Authority & Resilience Desk', 'የRBAC ሥልጣን እና ምትኬ አስተዳደር'),
          headline: biText(
            locale,
            'Role Governance, Backup Drills & Migration Readiness',
            'የሚና አስተዳደር፣ የምትኬ ልምምድ እና የውሂብ ሽግግር ዝግጁነት'
          ),
          summary: biText(
            locale,
            `Inspect the 10-role permission matrix, run simulated backup/restore verification drills, and review cutover gates.`,
            `የ10 ሚናዎችን የሥልጣን ሠንጠረዥ፣ የምትኬ መልሶ ማግኛ ልምምድ እና የውሂብ ሽግግር ዝግጁነትን ይቆጣጠሩ።`
          ),
          ctaLabel: biText(locale, 'Open Role & Authority Admin', 'ሚና እና ሥልጣን ክፈት'),
          ctaSection: 'admin' as NavSection,
          highlightMetric: biText(locale, '10 Configured Roles', '10 የተዋቀሩ ሚናዎች'),
          showArtwork: false,
        };
      case 'Auditor / Read-only reviewer':
        return {
          focusLabel: biText(locale, 'Independent Audit & UAT Evidence', 'ገለልተኛ ኦዲት እና የUAT ማስረጃ'),
          headline: biText(
            locale,
            'Immutable Audit Stream, Policy Denials & Compliance Gates',
            'የማይፋቅ የኦዲት መዝገብ፣ የፖሊሲ እገዳዎች እና የታክስ በሮች'
          ),
          summary: biText(
            locale,
            `Examine append-only audit chains, inspect RBAC/SoD policy denials, and verify evidence status with zero write risk.`,
            `የኦዲት መዝገቦችን፣ የፖሊሲ እገዳዎችን እና የተገዢነት ማስረጃዎችን በንባብ-ብቻ ሁኔታ ይመርምሩ።`
          ),
          ctaLabel: biText(locale, 'Inspect Audit Trail', 'የኦዲት መዝገብ መርምር'),
          ctaSection: 'audit' as NavSection,
          highlightMetric: `${ownerAuditEvents.length} ${biText(locale, 'Logged Events', 'የኦዲት መዝገቦች')}`,
          showArtwork: false,
        };
      case 'Training Coordinator':
      default:
        return {
          focusLabel: biText(locale, 'Training & Bilingual QA Facilitation', 'የስልጠና እና የአማርኛ QA አስተባባሪ'),
          headline: biText(
            locale,
            'Guided Staff Exercises, Seed Control & Bilingual QA',
            'የሰራተኞች ስልጠና ልምምዶች፣ ዳግም ማስጀመሪያ እና የአማርኛ ጥራት'
          ),
          summary: biText(
            locale,
            `Guide teams through 10 realistic AD-PRMS exercises, verify Amharic & Ethiopic calendar fidelity, and reset synthetic seeds.`,
            `10 የስልጠና ልምምዶችን ይምሩ፣ የአማርኛ እና የኢትዮጵያ ቀን አቆጣጠር ትክክለኛነትን ያረጋግጡ።`
          ),
          ctaLabel: biText(locale, 'Open Training Exercises', 'የስልጠና ልምምዶችን ክፈት'),
          ctaSection: 'training-exercises' as NavSection,
          highlightMetric: biText(locale, '10 Guided Scenarios', '10 የስልጠና ሁኔታዎች'),
          showArtwork: false,
        };
    }
  }, [
    currentPersona.role,
    activeOwner.name,
    locale,
    pendingForMyRole.length,
    arrearsList.length,
    ownerMaintenanceTickets,
    ownerRentalApplications,
    ownerExpenses,
    ownerAuditEvents.length,
  ]);

  // Role-specific "My Work" items
  const myWorkItems = useMemo(() => {
    const items: { label: string; meta: string; section: NavSection }[] = [];
    const role = currentPersona.role;

    if (role === 'General Manager' || role === 'Assistant Manager' || role === 'Owner / Director') {
      pendingForMyRole.slice(0, 3).forEach((req) => {
        items.push({
          label: `${req.requestNumber} — ${req.title}`,
          meta: `${req.workflowMode} Step ${req.currentStep}/${req.totalSteps}`,
          section: 'approvals',
        });
      });
    }
    if (role === 'Finance Officer' || role === 'Collections Clerk' || role === 'Clerk') {
      arrearsList.slice(0, 2).forEach((c) => {
        items.push({
          label: `${c.invoiceNumber} — ${c.tenantName}`,
          meta: `${fmtEtb(c.balanceEtb)} (${c.status})`,
          section: 'collections',
        });
      });
    }
    if (role === 'Finance Officer') {
      ownerExpenses
        .filter((e) => e.status === 'Draft' || e.status === 'Pending Approval')
        .slice(0, 2)
        .forEach((e) => {
          items.push({
            label: `${e.requestNumber} — ${e.supplierPlaceholder}`,
            meta: `${fmtEtb(e.amountEtb)} · ${e.status}`,
            section: 'expenses',
          });
        });
    }
    if (role === 'Property Clerk' || role === 'Assistant Manager' || role === 'Clerk') {
      ownerRentalApplications
        .filter((a) => a.status === 'Submitted' || a.status === 'Approved')
        .slice(0, 2)
        .forEach((a) => {
          items.push({
            label: `${a.applicationNumber} — ${a.applicantName}`,
            meta: `${a.status} · Unit Ready`,
            section: 'rental-applications',
          });
        });
      ownerMaintenanceTickets
        .filter((m) => m.workOrderState !== 'Closed')
        .slice(0, 2)
        .forEach((m) => {
          items.push({
            label: `${m.ticketNumber} — ${m.title}`,
            meta: `${m.priority} · ${m.workOrderState}`,
            section: 'maintenance',
          });
        });
    }
    if (role === 'System Administrator') {
      items.push({
        label: biText(locale, 'Schedule / Request Simulated Restore Drill', 'የምትኬ መልሶ ማግኛ ልምምድ ጠይቅ'),
        meta: 'Backup & Recovery',
        section: 'backup-recovery',
      });
      items.push({
        label: biText(locale, 'Review Role Catalog & Active Training Sessions', 'የሚና ዝርዝር እና የስልጠና ክፍለ-ጊዜዎችን ገምግም'),
        meta: 'Administration',
        section: 'admin',
      });
    }
    if (role === 'Auditor / Read-only reviewer') {
      items.push({
        label: biText(locale, 'Inspect Immutable Audit Events & Denials', 'የማይፋቁ የኦዲት መዝገቦችን መርምር'),
        meta: `${ownerAuditEvents.length} events`,
        section: 'audit',
      });
      items.push({
        label: biText(locale, 'Verify Compliance Research & Production Gates', 'የተገዢነት ማስረጃዎችንና በሮችን አረጋግጥ'),
        meta: 'Compliance Readiness',
        section: 'compliance',
      });
    }
    if (role === 'Training Coordinator') {
      items.push({
        label: biText(locale, 'Facilitate 10 Guided Staff Training Scenarios', '10 የሰራተኞች የስልጠና ልምምዶችን ምራ'),
        meta: 'Training Exercises',
        section: 'training-exercises',
      });
      items.push({
        label: biText(locale, 'Verify Amharic & Dual Calendar Visual QA', 'የአማርኛ እና የቀን መቁጠሪያ ጥራት ፈትሽ'),
        meta: 'Visual & Bilingual QA',
        section: 'visual-qa',
      });
    }

    if (items.length === 0) {
      ownerApprovals.slice(0, 3).forEach((req) => {
        items.push({
          label: `${req.requestNumber} — ${req.title}`,
          meta: req.status,
          section: 'approvals',
        });
      });
    }
    return items.slice(0, 4);
  }, [
    currentPersona.role,
    pendingForMyRole,
    arrearsList,
    ownerExpenses,
    ownerRentalApplications,
    ownerMaintenanceTickets,
    ownerAuditEvents.length,
    ownerApprovals,
    locale,
    fmtEtb,
  ]);

  // Due Today / Near-Term items
  const dueTodayItems = useMemo(() => {
    const dueCharges = arrearsList.slice(0, 3).map((c) => ({
      title: `${c.invoiceNumber} · ${c.tenantName}`,
      date: fmtDate(c.dueDate),
      badge: c.status,
      section: 'collections' as NavSection,
    }));
    const dueApprovals = ownerApprovals
      .filter((a) => a.status === 'Pending' || a.status === 'In Review')
      .slice(0, 2)
      .map((a) => ({
        title: `${a.requestNumber} · ${a.category}`,
        date: fmtDate(a.dueDate),
        badge: `Step ${a.currentStep}/${a.totalSteps}`,
        section: 'approvals' as NavSection,
      }));
    return [...dueCharges, ...dueApprovals].slice(0, 4);
  }, [arrearsList, ownerApprovals, fmtDate]);

  // Active Exceptions & Governance Blockers
  const exceptionItems = useMemo(() => {
    const list: { label: string; detail: string; section: NavSection }[] = [];
    const blockedGates = ownerProductionGates.filter((g) => g.status === 'Blocked').length;
    if (blockedGates > 0) {
      list.push({
        label: biText(
          locale,
          `${blockedGates} Production Gates Blocked`,
          `${blockedGates} የምርት መግቢያ በሮች ታግደዋል`
        ),
        detail: biText(locale, 'Tax Active state & live integrations permanently disabled', 'የታክስ ንቁ ሁኔታ ታግዷል'),
        section: 'compliance',
      });
    }
    const voidPending = ownerReceipts.filter((r) => r.documentState === 'Void Requested').length;
    if (voidPending > 0) {
      list.push({
        label: biText(locale, `${voidPending} Receipt Void Pending`, `${voidPending} የደረሰኝ መመለስ በመጠባበቅ ላይ`),
        detail: biText(locale, 'Awaiting independent Checker sign-off', 'ገለልተኛ አጽዳቂ ይጠብቃል'),
        section: 'collections',
      });
    }
    const deniedCount = ownerAuditEvents.filter((e) => e.action.startsWith('Denied:')).length;
    if (deniedCount > 0) {
      list.push({
        label: biText(locale, `${deniedCount} Policy Denials Logged`, `${deniedCount} የፖሊሲ እገዳዎች ተመዝግበዋል`),
        detail: biText(locale, 'RBAC / Self-Approval / Cross-Owner blocks verified', 'የቁጥጥር እገዳዎች ተረጋግጠዋል'),
        section: 'audit',
      });
    }
    if (ownerTaxRules.some((t) => t.hasResearchConflict)) {
      list.push({
        label: biText(locale, 'Ethiopian Tax Research Conflicts Open', 'ያልተፈቱ የታክስ ምርምር ግጭቶች አሉ'),
        detail: biText(locale, 'Licensed tax adviser sign-off required', 'የታክስ አማካሪ ማረጋገጫ ያስፈልጋል'),
        section: 'tax',
      });
    }
    return list.slice(0, 4);
  }, [ownerProductionGates, ownerReceipts, ownerAuditEvents, ownerTaxRules, locale]);

  // Role-gated Quick Actions
  const quickActions = useMemo(() => {
    const candidates: { label: string; section: NavSection; allowed: boolean }[] = [
      {
        label: biText(locale, 'Record Payment', 'ክፍያ መዝግብ'),
        section: 'collections',
        allowed: checkActionPermission(currentPersona.role, 'record_payment').allowed,
      },
      {
        label: biText(locale, 'Review Approvals', 'ማጽደቂያዎችን ገምግም'),
        section: 'approvals',
        allowed: currentPersona.role !== 'Clerk',
      },
      {
        label: biText(locale, 'New Rental Application', 'አዲስ የኪራይ ማመልከቻ'),
        section: 'rental-applications',
        allowed: checkActionPermission(currentPersona.role, 'create_rental_application').allowed,
      },
      {
        label: biText(locale, 'Log Maintenance Ticket', 'የጥገና ጥያቄ መዝግብ'),
        section: 'maintenance',
        allowed: checkActionPermission(currentPersona.role, 'create_maintenance_ticket').allowed,
      },
      {
        label: biText(locale, 'Training Exercises (10)', 'የስልጠና ልምምዶች (10)'),
        section: 'training-exercises',
        allowed: true,
      },
      {
        label: biText(locale, 'Production Architecture', 'የምርት አርክቴክቸር'),
        section: 'security-architecture',
        allowed: true,
      },
    ];
    return candidates.filter((c) => c.allowed);
  }, [currentPersona.role, locale]);

  // Illustrative synthetic 6-month trend points scoped by active owner
  const trendData = useMemo(() => {
    const isAlpha = activeOwner.id === 'OWN-ALPHA';
    return [
      {
        month: biText(locale, 'Jun', 'ሰኔ (Jun)'),
        occupancy: isAlpha ? 67 : 100,
        billed: isAlpha ? 77000 : 38000,
        collected: isAlpha ? 77000 : 38000,
      },
      {
        month: biText(locale, 'Jul', 'ሐምሌ (Jul)'),
        occupancy: isAlpha ? 67 : 100,
        billed: isAlpha ? 77000 : 38000,
        collected: isAlpha ? 77000 : 38000,
      },
      {
        month: biText(locale, 'Aug', 'ነሐሴ (Aug)'),
        occupancy: isAlpha ? 67 : 100,
        billed: isAlpha ? 77000 : 38000,
        collected: isAlpha ? 70000 : 38000,
      },
      {
        month: biText(locale, 'Sep', 'መስከረም (Sep)'),
        occupancy: isAlpha ? 67 : 100,
        billed: isAlpha ? 77000 : 38000,
        collected: isAlpha ? 77000 : 38000,
      },
      {
        month: biText(locale, 'Oct', 'ጥቅምት (Oct)'),
        occupancy: isAlpha ? 67 : 100,
        billed: isAlpha ? 77000 : 38000,
        collected: isAlpha ? 57000 : 38000,
      },
      {
        month: biText(locale, 'Nov', 'ኅዳር (Nov)'),
        occupancy: ownerUnits.length ? Math.round((metrics.occupied / ownerUnits.length) * 100) : 0,
        billed: metrics.monthlyBilled || (isAlpha ? 77000 : 38000),
        collected: ownerReceipts
          .filter((r) => r.documentState !== 'Reversed' && r.paymentDate.startsWith('2026-11'))
          .reduce((s, r) => s + r.amountEtb, 0),
      },
    ];
  }, [activeOwner.id, metrics.monthlyBilled, metrics.occupied, ownerUnits.length, ownerReceipts, locale]);

  const maxTrendVal = Math.max(...trendData.map((d) => Math.max(d.billed, d.collected)), 1);

  return (
    <div className="space-y-6 min-w-0">
      {/* Role-Tailored Hero Focus Lens */}
      <section className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-[#0D1D30] dark:bg-[#08121E] text-white overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-12 min-w-0">
        <div className={`${roleLens.showArtwork ? 'lg:col-span-7' : 'lg:col-span-12'} p-5 sm:p-6 flex flex-col justify-between gap-4 min-w-0`}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#E5B85C]">
                <Compass className="w-3.5 h-3.5" />
                <span>{roleLens.focusLabel} · {activeOwner.code}</span>
              </span>
              <span className="text-xs font-mono text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-md">
                {roleLens.highlightMetric}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white text-balance">
              {roleLens.headline}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              {roleLens.summary}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <p className="text-[11px] text-slate-400">
              {currentPersona.role} · <span className="font-mono text-slate-200">{session.username}</span> ({session.actorId})
            </p>
            <button
              type="button"
              onClick={() => setActiveSection(roleLens.ctaSection)}
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{roleLens.ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {roleLens.showArtwork && (
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-white/10">
            <AddisArchitecturalShowcase
              badgeText={activeOwner.code}
              title={activeOwner.name}
              subtitle={biText(
                locale,
                `${ownerUnits.length} Synthetic Units · Strict Owner Isolation`,
                `${ownerUnits.length} ሰው-ሠራሽ ክፍሎች · የተነጠለ የባለቤት መረጃ`
              )}
              heightClass="h-44 lg:h-full min-h-[180px]"
            />
          </div>
        )}
      </section>

      <GovernanceCallout
        title={biText(
          locale,
          `Role Home: ${currentPersona.role} (${session.username}) · ${activeOwner.name}`,
          `የሚና መነሻ ገጽ፡ ${currentPersona.role} (${session.username}) · ${activeOwner.name}`
        )}
        description={biText(
          locale,
          `Displaying synthetic training data exclusively for ${activeOwner.name} (${activeOwner.code}). Active role is fixed for this session.`,
          `ለ ${activeOwner.name} (${activeOwner.code}) ብቻ የተዘጋጁ ሰው-ሠራሽ የስልጠና መረጃዎች ቀርበዋል። ሚና በዚህ ክፍለ-ጊዜ የተወሰነ ነው።`
        )}
        controlType="Prototype Simulation"
      />

      {/* Quick Actions Strip */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0F233A] dark:text-slate-100">
          <Zap className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
          <span>{biText(locale, `Quick Actions (${currentPersona.role})`, `ፈጣን እርምጃዎች (${currentPersona.role})`)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quickActions.map((qa) => (
            <button
              key={qa.section}
              type="button"
              onClick={() => setActiveSection(qa.section)}
              className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:border-[#166549] dark:hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/25 text-xs font-semibold text-[#0F233A] dark:text-slate-100 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
              <span>{qa.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Role-Specific Operational Queue Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 min-w-0">
        {/* 1. My Work */}
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
              <span>{biText(locale, `My Work (${currentPersona.role})`, `የእኔ ሥራዎች (${currentPersona.role})`)}</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{myWorkItems.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#233349]/70 flex-1">
            {myWorkItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSection(item.section)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#162438] flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{item.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.meta}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* 2. Pending Approvals For My Role */}
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-[#C28A24]" />
              <span>{biText(locale, 'Pending Approvals (Actionable by Me)', 'ለእኔ የቀረቡ ማጽደቂያዎች')}</span>
            </h2>
            <button
              type="button"
              onClick={() => setActiveSection('approvals')}
              className="text-[11px] font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              {pendingForMyRole.length} {biText(locale, 'Open', 'ክፈት')}
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#233349]/70 flex-1">
            {pendingForMyRole.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                {biText(
                  locale,
                  `No approvals currently actionable by ${currentPersona.role} (${session.actorId}).`,
                  `በአሁኑ ጊዜ በ ${currentPersona.role} የሚጸድቅ ጥያቄ የለም።`
                )}
              </p>
            ) : (
              pendingForMyRole.slice(0, 4).map((req) => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setActiveSection('approvals')}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#162438] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{req.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {req.requestNumber} · Maker: {req.makerPersona}
                    </p>
                  </div>
                  <StatusLabel label={req.status} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* 3. Due Today & Watchlist */}
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0F233A] dark:text-slate-300" />
              <span>{biText(locale, 'Due Today & Deadlines', 'ዛሬ / በቅርብ የሚጠናቀቁ')}</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{dueTodayItems.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#233349]/70 flex-1">
            {dueTodayItems.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                {biText(locale, 'No open deadlines.', 'ምንም የቀረ የጊዜ ገደብ የለም።')}
              </p>
            ) : (
              dueTodayItems.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveSection(d.section)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#162438] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{d.title}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{d.date}</p>
                  </div>
                  <StatusLabel label={d.badge} />
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Exceptions + Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-w-0">
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden min-w-0">
          <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
              <span>{biText(locale, 'Exceptions & Governance Blockers', 'ልዩነቶች እና የቁጥጥር ማገጃዎች')}</span>
            </h2>
            <span className="text-[11px] font-mono text-red-700 dark:text-red-300">{exceptionItems.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#233349]/70">
            {exceptionItems.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveSection(ex.section)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#162438] flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-red-900 dark:text-red-200 truncate">{ex.label}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{ex.detail}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden min-w-0">
          <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Recent Activity (Immutable Audit)', 'የቅርብ ጊዜ እንቅስቃሴ (ኦዲት)')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveSection('audit')}
              className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{biText(locale, 'Audit Log', 'የኦዲት መዝገብ')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#233349]/70">
            {ownerAuditEvents.slice(0, 4).map((evt) => (
              <div key={evt.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{evt.action}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {evt.actor} ({evt.actorId}) · {evt.module}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                  {fmtDateTime(evt.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label={biText(locale, 'Occupied Units', 'የተከራዩ ክፍሎች')}
          value={String(metrics.occupied)}
          subtext={biText(
            locale,
            `of ${ownerUnits.length} total synthetic units`,
            `ከጠቅላላ ${ownerUnits.length} ሰው-ሠራሽ ክፍሎች`
          )}
          onClick={() => setActiveSection('portfolio')}
        />
        <KpiCard
          label={biText(locale, 'Vacant Units', 'ክፍት ክፍሎች')}
          value={String(metrics.vacant)}
          subtext={biText(locale, 'Available for synthetic leasing', 'ለሙከራ ኪራይ ዝግጁ')}
          onClick={() => setActiveSection('portfolio')}
        />
        <KpiCard
          label={biText(locale, 'Monthly Billed Rent (Nov)', 'ወርሃዊ የተጠየቀ ኪራይ (Nov)')}
          value={fmtShortEtb(metrics.monthlyBilled)}
          subtext={fmtEtb(metrics.monthlyBilled)}
          onClick={() => setActiveSection('collections')}
        />
        <KpiCard
          label={biText(locale, 'Synthetic Collections', 'የተሰበሰበ የሙከራ ገቢ')}
          value={fmtShortEtb(metrics.totalCollected)}
          subtext={biText(
            locale,
            `${ownerReceipts.filter((r) => r.documentState !== 'Reversed').length} active DEMO receipts`,
            `${ownerReceipts.filter((r) => r.documentState !== 'Reversed').length} ንቁ DEMO ደረሰኞች`
          )}
          onClick={() => setActiveSection('collections')}
        />
        <KpiCard
          label={biText(locale, 'Outstanding Receivables', 'ያልተከፈለ ቀሪ ሂሳብ')}
          value={fmtShortEtb(metrics.outstanding)}
          subtext={biText(
            locale,
            `${arrearsList.length} open/overdue charges`,
            `${arrearsList.length} ክፍት / ጊዜያቸው ያለፈባቸው`
          )}
          onClick={() => setActiveSection('collections')}
        />
        <KpiCard
          label={biText(locale, 'Pending Approvals', 'ማጽደቂያ የሚጠብቁ')}
          value={String(metrics.pendingApprovals)}
          subtext={biText(locale, 'Awaiting checker decision', 'የአጽዳቂ ውሳኔ የሚጠብቁ')}
          onClick={() => setActiveSection('approvals')}
        />
      </section>

      {/* Fiscal-Year Revenue (D3) & 6-Month Occupancy Rate (Recharts) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <FiscalRevenueD3Chart
          ownerId={activeOwner.id}
          ownerName={activeOwner.name}
          receipts={ownerReceipts}
          locale={locale}
          fmtEtb={fmtEtb}
          fmtShortEtb={fmtShortEtb}
        />
        <OccupancyTrendRechartsWidget
          ownerId={activeOwner.id}
          ownerName={activeOwner.name}
          units={ownerUnits}
          locale={locale}
        />
      </section>

      {/* Billed vs Collected 6-Month Comparison */}
      <section className="min-w-0">
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
                {biText(
                  locale,
                  'Billed vs. Collected Trend (Synthetic ETB)',
                  'የተጠየቀ እና የተሰበሰበ ንጽጽር (ሰው-ሠራሽ ብር)'
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {biText(
                  locale,
                  'Illustrative monthly comparison · Not production accounting',
                  'ለማሳያነት የቀረበ ወርሃዊ ንጽጽር · የምርት ሂሳብ መዝገብ አይደለም'
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />{' '}
                {biText(locale, 'Billed', 'የተጠየቀ')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#166549] dark:bg-[#248F64]" />{' '}
                {biText(locale, 'Collected', 'የተሰበሰበ')}
              </span>
            </div>
          </div>
          <div className="h-44 flex items-end gap-4 pt-4 border-t border-slate-100 dark:border-[#233349]">
            {trendData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1 h-28">
                  <div
                    className="w-4 bg-slate-300 dark:bg-slate-600 rounded-t"
                    style={{ height: `${Math.round((d.billed / maxTrendVal) * 100)}%` }}
                    title={`${biText(locale, 'Billed', 'የተጠየቀ')}: ${fmtEtb(d.billed)}`}
                  />
                  <div
                    className="w-4 bg-[#166549] dark:bg-[#248F64] rounded-t"
                    style={{ height: `${Math.round((d.collected / maxTrendVal) * 100)}%` }}
                    title={`${biText(locale, 'Collected', 'የተሰበሰበ')}: ${fmtEtb(d.collected)}`}
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center">{d.month}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
