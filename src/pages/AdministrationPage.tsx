import React, { useState } from 'react';
import { KeyRound, LogOut, ShieldAlert, ShieldCheck, UserCheck, UserPlus } from 'lucide-react';
import { DEMO_PERSONAS } from '../data/seedData';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { EnvironmentGroupsPanel } from '../components/admin/EnvironmentGroupsPanel';
import { McpGovernancePanel } from '../components/admin/McpGovernancePanel';
import {
  checkActionPermission,
  DETAILED_PERMISSION_MATRIX,
  PERMISSION_MATRIX,
  ROLE_AUTHORITY_CATALOG,
  ROLE_CATALOG_11,
  SOD_CONFLICT_MATRIX,
} from '../policies/rbac';
import { ConfigRuleRecord, PersonaRole } from '../types/prms';
import {
  ConfirmDialog,
  GovernanceCallout,
  Modal,
  SlideDrawer,
  StatusLabel,
} from '../components/ui/Primitives';

const ALL_ROLES: PersonaRole[] = DEMO_PERSONAS.map((p) => p.role);

type AdminTab =
  | 'users'
  | 'authority'
  | 'catalog'
  | 'granular'
  | 'delegations'
  | 'sod'
  | 'reviews'
  | 'config'
  | 'environment'
  | 'mcp';

export const AdministrationPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    session,
    locale,
    fmtDate,
    fmtDateTime,
    adminUsers,
    configRules,
    ownerDelegations,
    ownerAccessReviews,
    logoutToLogin,
    requestRoleAssignment,
    requestDelegation,
    revokeDelegation,
    attestAccessReview,
    updateConfigRuleDraft,
  } = usePrms();

  const [tab, setTab] = useState<AdminTab>('environment');
  const [selectedRoleDetail, setSelectedRoleDetail] = useState<PersonaRole | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [delegationModalOpen, setDelegationModalOpen] = useState(false);
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [editRule, setEditRule] = useState<ConfigRuleRecord | null>(null);

  const [roleForm, setRoleForm] = useState({
    userName: '',
    syntheticHandle: '',
    proposedRole: 'Collections Clerk' as PersonaRole,
    effectiveDate: '2026-12-01',
    evidenceRef: 'EVD-HR-SYNTH-009',
    reason: 'New synthetic staff role assignment routed through maker-checker approval.',
  });

  const [delegationForm, setDelegationForm] = useState({
    delegateActorId: 'USR-SYNTH-03',
    scopeModules: 'Maintenance Cost & Unit Renumbering Checker (Time-Bounded)',
    startDate: '2026-11-15',
    endDate: '2026-11-30',
    evidenceRef: 'EVD-DEL-SYNTH-010',
  });

  const [ruleDraftForm, setRuleDraftForm] = useState({
    value: '',
    effectiveDate: '2026-12-01',
    reason: '',
  });

  const canAssignRole = checkActionPermission(currentPersona.role, 'request_role_assignment');
  const canDelegate = checkActionPermission(currentPersona.role, 'request_delegation');
  const canReviewAccess = checkActionPermission(currentPersona.role, 'run_access_review');
  const canEditConfig = checkActionPermission(currentPersona.role, 'update_system_config');

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.userName.trim() || !roleForm.syntheticHandle.trim() || !roleForm.evidenceRef.trim())
      return;
    if (requestRoleAssignment(roleForm)) {
      setRoleModalOpen(false);
      setRoleForm({
        userName: '',
        syntheticHandle: '',
        proposedRole: 'Collections Clerk',
        effectiveDate: '2026-12-01',
        evidenceRef: 'EVD-HR-SYNTH-009',
        reason: 'New synthetic staff role assignment routed through maker-checker approval.',
      });
    }
  };

  const handleDelegationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegationForm.scopeModules.trim() || !delegationForm.evidenceRef.trim()) return;
    if (requestDelegation(delegationForm)) {
      setDelegationModalOpen(false);
    }
  };

  const handleConfigDraftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRule || !ruleDraftForm.value.trim()) return;
    if (
      updateConfigRuleDraft(
        editRule.id,
        ruleDraftForm.value.trim(),
        ruleDraftForm.effectiveDate,
        ruleDraftForm.reason.trim() || 'Saved configuration draft.'
      )
    ) {
      setEditRule(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Prominent System Administrator Restrictions Box */}
      <div className="bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-xl p-4 text-red-950 dark:text-red-200 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <ShieldAlert className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 min-w-0 flex-1">
            <h2 className="text-sm font-bold">
              {biText(
                locale,
                'System Administrator & Actor-ID Hard Governance Controls (Zero Super-User Authority)',
                'የሲስተም አስተዳዳሪ እና የActor-ID ጥብቅ ገደቦች (ምንም ልዕለ-ስልጣን የለም)'
              )}
            </h2>
            <p className="text-xs leading-relaxed opacity-90">
              {biText(
                locale,
                'Users, Roles, Permissions, Owner Scope, and Approval Authorities are strictly separated. Self-approval is checked by immutable Actor ID (actorId !== makerActorId) even if the user switches roles.',
                'ተጠቃሚ፣ ሚና፣ ፈቃድ፣ የባለቤትነት ክልል እና የማጽደቅ ስልጣን ተለያይተዋል። ሚና ቢቀየርም የራስን ጥያቄ ማጽደቅ በActor-ID ይታገዳል።'
              )}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs list-disc list-inside pt-1 opacity-90">
              <li>
                {biText(
                  locale,
                  'System Admin cannot approve business, tax, accounting, ownership, delegation, or audit changes',
                  'የሲስተም አስተዳዳሪ የንግድ፣ ታክስ፣ ሂሳብ፣ ባለቤትነት ወይም የኦዲት ውሳኔዎችን ማጽደቅ አይችልም'
                )}
              </li>
              <li>
                {biText(
                  locale,
                  'Audit Trail is append-only and immutable for ALL roles',
                  'የኦዲት መዝገብ ለሁሉም ሚናዎች የማይፋቅ እና የማይቀየር ነው'
                )}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Fixed-Session Governance Disclosure Bar (No Mid-Session Role Switch) */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs min-w-0">
        <div className="space-y-1 text-xs min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
            <span className="font-bold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Fixed Training Session Context', 'የተወሰነ የስልጠና ክፍለ-ጊዜ (Fixed Session)')}:
            </span>
            <span className="font-mono px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#152236] text-slate-800 dark:text-[#E5B85C]">
              {session.username}
            </span>
            <span className="font-mono px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#152236] text-slate-800 dark:text-slate-200">
              actorId: {session.actorId}
            </span>
            <span className="font-mono px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#152236] text-slate-800 dark:text-slate-200">
              ownerScope: {session.activeOwnerScope}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            {biText(
              locale,
              `Actor: ${session.actorName} · Active Role: ${currentPersona.role} (Fixed) · Expires: ${fmtDateTime(session.sessionExpiryTime)}`,
              `ተጠቃሚ: ${session.actorName} · ንቁ ሚና: ${currentPersona.role} (የተወሰነ) · ማብቂያ: ${fmtDateTime(session.sessionExpiryTime)}`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-300">
            {biText(
              locale,
              'Role switching inside an active session is prohibited.',
              'በንቁ ክፍለ-ጊዜ ውስጥ ሚና መቀየር ተከልክሏል።'
            )}
          </span>
          <button
            type="button"
            onClick={logoutToLogin}
            className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-[#0F233A] dark:text-slate-100 font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Sign Out to Switch Account', 'ሌላ መለያ ለመጠቀም ውጣ')}</span>
          </button>
        </div>
      </section>

      {/* Sub-Navigation Tabs + Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFF5] dark:bg-[#152236] rounded-xl min-w-0 max-w-full">
          {(
            [
              ['environment', biText(locale, 'Environment Groups', 'የአካባቢ ተለዋዋጮች (Environment)')],
              ['mcp', biText(locale, 'MCP Access & Provisioning', 'የMCP ፈቃድ እና ቁጥጥር')],
              ['authority', biText(locale, 'Role & Authority Design', 'የሚና እና የስልጣን ንድፍ')],
              ['catalog', biText(locale, '11-Role Catalog', '11-ሚና ዝርዝር')],
              ['users', biText(locale, `Users (${adminUsers.length})`, `ተጠቃሚዎች (${adminUsers.length})`)],
              ['granular', biText(locale, 'Permission Rules & Matrix', 'የፈቃድ ህጎች እና ሰንጠረዥ')],
              ['delegations', biText(locale, `Delegations (${ownerDelegations.length})`, `ውክልናዎች (${ownerDelegations.length})`)],
              ['sod', biText(locale, 'SoD Conflict Matrix', 'የግጭት መከላከያ (SoD)')],
              ['reviews', biText(locale, 'Quarterly Access Review', 'የሩብ ዓመት የመዳረሻ ግምገማ')],
              ['config', biText(locale, 'Config Rules', 'የስርዓት ደንቦች')],
            ] as [AdminTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                tab === id
                  ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canDelegate.allowed}
            title={canDelegate.reason}
            onClick={() => setDelegationModalOpen(true)}
            className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-[#0F233A] dark:text-slate-100 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Request Delegation', 'ጊዜያዊ ውክልና ጠይቅ')}</span>
          </button>
          <button
            type="button"
            disabled={!canAssignRole.allowed}
            title={canAssignRole.reason}
            onClick={() => setRoleModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Request Role Assignment', 'የሚና ምደባ ጠይቅ')}</span>
          </button>
        </div>
      </div>

      {/* Environment Groups Configuration Tab */}
      {tab === 'environment' && <EnvironmentGroupsPanel />}

      {/* MCP OAuth 2.1 Actor Bindings & Audit Tab */}
      {tab === 'mcp' && <McpGovernancePanel />}

      {/* Tab 1: Users & Role Assignments */}
      {tab === 'users' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Actor ID / User ID', 'የተጠቃሚ መታወቂያ (Actor ID)')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Synthetic Name & Handle', 'ሰው-ሠራሽ ስም')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Assigned Roles', 'የተመደቡ ሚናዎች')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Owner Isolation Scope', 'የባለቤትነት ክልል')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Last Session', 'የመጨረሻ ክፍለ-ጊዜ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {adminUsers.map((usr) => (
                  <tr
                    key={usr.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      <p className="font-semibold text-[#0F233A] dark:text-[#E5B85C]">{usr.actorId}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{usr.id}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0F233A] dark:text-slate-100">{usr.name}</p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {usr.syntheticHandle}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {usr.assignedRoles.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setSelectedRoleDetail(r)}
                            className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 font-semibold text-[#166549] dark:text-emerald-300 hover:underline cursor-pointer"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{usr.ownerScope}</td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {usr.lastSessionPlaceholder}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={usr.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 0: 10-Attribute Role & Authority Design */}
      {tab === 'authority' && (
        <section className="space-y-4">
          <GovernanceCallout
            title={biText(
              locale,
              'SRS v1.1 §7 Baseline Roles & Enterprise Governance Authority Design',
              'SRS v1.1 §7 መሠረታዊ ሚናዎች እና የአስተዳደር ስልጣን ንድፍ'
            )}
            description={biText(
              locale,
              'Includes the 4 SRS baseline internal roles (General Manager, Assistant Manager, Finance Officer, Clerk) plus configurable governance/training templates. Each role explicitly documents all 10 governance authority attributes.',
              '4ቱን መሠረታዊ የSRS ሚናዎች እና ሊዋቀሩ የሚችሉ የአስተዳደር ቅጾችን በ10 የስልጣን መለኪያዎች ይዘረዝራል።'
            )}
            controlType="Prototype Simulation"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {ROLE_AUTHORITY_CATALOG.map((spec) => (
              <div
                key={spec.role}
                className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-3 text-xs shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <div>
                    <p className="text-sm font-bold text-[#0F233A] dark:text-slate-100">{spec.role}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-[#E5B85C] mt-0.5">
                      {spec.classification}
                    </p>
                  </div>
                  <StatusLabel
                    label={spec.classification.includes('SRS') ? 'Active' : 'Prototype Simulation'}
                  />
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                      1. Responsibilities & Purpose
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                      {spec.responsibilities}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                      2. Owner Scope
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200 mt-0.5">{spec.ownerScope}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                      3. Effective Window
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                      {spec.effectiveDates}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                      4. Permitted Actions
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                      {spec.permittedActions}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-red-800 dark:text-red-300 font-semibold">
                      5. Prohibited Actions
                    </dt>
                    <dd className="text-red-900 dark:text-red-200 mt-0.5">
                      {spec.prohibitedActions}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-emerald-900 dark:text-emerald-300 font-semibold">
                      6. Approval Authority
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                      {spec.approvalAuthority}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                      7. Delegation Eligibility
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                      {spec.delegationEligibility}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                      8. Required Evidence
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                      {spec.requiredEvidence}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                      9. Audit Requirements
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                      {spec.auditRequirements}
                    </dd>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-[#1D2D42]">
                    <dt className="text-[#0F233A] dark:text-[#E5B85C] font-semibold">
                      10. Separation of Duties (SoD) Boundary
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                      {spec.sodConflicts}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 2: 11-Role Catalog (Baseline + Configurable + Owner Approval Slots) */}
      {tab === 'catalog' && (
        <section className="space-y-4">
          <GovernanceCallout
            title={biText(
              locale,
              '11-Role Enterprise Governance Catalog (SRS Baseline + Configurable Templates + Pending Owner Matrix Slots)',
              'ባለ 11 ሚና የአስተዳደር ዝርዝር (መሠረታዊ የSRS ሚናዎች + የባለቤት ውሳኔ የሚጠብቁ)'
            )}
            description={biText(
              locale,
              'Unconfigured role slots explicitly require Owner authority-matrix approval and cannot be assigned or activated in this prototype.',
              'ያልተዋቀሩ የሚና ቦታዎች የባለቤት የስልጣን ማትሪክስ ማጽደቂያ ይፈልጋሉ፤ በዚህ ፕሮቶታይፕ አይመደቡም።'
            )}
            controlType="Production Boundary"
          />
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">#</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Role Slot & Classification', 'የሚና ስም እና ምድብ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Configuration Status', 'የውቅር ሁኔታ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Authority Boundary', 'የስልጣን ወሰን')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {ROLE_CATALOG_11.map((rc) => (
                    <tr
                      key={rc.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-[#E5B85C]">
                        Slot {rc.slotNumber}
                      </td>
                      <td className="py-3 px-4">
                        {rc.configured && rc.personaRole ? (
                          <button
                            type="button"
                            onClick={() => setSelectedRoleDetail(rc.personaRole!)}
                            className="font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            {rc.roleName}
                          </button>
                        ) : (
                          <span className="font-semibold text-amber-900 dark:text-amber-300">
                            {rc.roleName}
                          </span>
                        )}
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {rc.classification}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel
                          label={
                            rc.configured
                              ? 'Active'
                              : 'Owner authority-matrix approval required.'
                          }
                        />
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {rc.businessAuthority}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: Granular Permission Model + Legacy Matrix */}
      {tab === 'granular' && (
        <section className="space-y-6">
          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
              <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
                {biText(
                  locale,
                  'Granular Permission Policy Model (Module · Resource · Action · Threshold · Evidence)',
                  'ዝርዝር የፈቃድ መመሪያ (ክፍል · ሀብት · እርምጃ · ገደብ · ማስረጃ)'
                )}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Module / Resource', 'ክፍል እና ሀብት')}</th>
                    <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Action Verb', 'እርምጃ')}</th>
                    <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Owner Scope', 'የባለቤት ክልል')}</th>
                    <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Threshold & Evidence', 'ገደብ እና ማስረጃ')}</th>
                    <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Maker-Checker Rule', 'የአዘጋጅ-አጽዳቂ ህግ')}</th>
                    <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Effective', 'ተፈጻሚ ቀን')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {DETAILED_PERMISSION_MATRIX.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 align-top transition-colors"
                    >
                      <td className="py-3 px-3">
                        <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                          {rule.module}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {rule.resource}
                        </p>
                        <p className="text-[10px] text-emerald-800 dark:text-emerald-400 mt-1">
                          Allowed: {rule.allowedRoles.join(', ')}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-[#E5B85C]">
                        {rule.action}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {rule.ownerScope}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {rule.approvalThreshold}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {rule.evidenceRequirement}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {rule.makerCheckerRule}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {fmtDate(rule.effectiveDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
              <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
                {biText(locale, 'Capability x Role Quick Matrix', 'የችሎታ እና የሚና ሰንጠረዥ')}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold min-w-[180px]">
                      {biText(locale, 'Capability', 'ችሎታ')}
                    </th>
                    {ALL_ROLES.map((r) => (
                      <th key={r} className="py-2.5 px-2.5 font-semibold text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedRoleDetail(r)}
                          className="text-[#0F233A] dark:text-slate-100 hover:text-[#166549] dark:hover:text-emerald-400 hover:underline cursor-pointer"
                        >
                          {r}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                  {PERMISSION_MATRIX.map((row) => (
                    <tr
                      key={row.capability}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {row.capability}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {row.module}
                        </p>
                      </td>
                      {ALL_ROLES.map((r) => (
                        <td key={r} className="py-3 px-2.5 text-center">
                          <StatusLabel label={row.roles[r]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Temporary Delegations */}
      {tab === 'delegations' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
            <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                `Time-Bounded Authority Delegations — ${activeOwner.name}`,
                `በጊዜ የተገደቡ ጊዜያዊ ውክልናዎች — ${activeOwner.name}`
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {biText(
                locale,
                'Requires Owner / GM approval. Actor-ID self-approval blocks remain enforced even under delegation.',
                'የባለቤት / ዋና ሥራ አስኪያጅ ማጽደቂያ ያስፈልጋል። በውክልናም የራስን ጥያቄ ማጽደቅ ታግዷል።'
              )}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Delegation ID', 'የውክልና መለያ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Delegator -> Delegate', 'ወካይ -> ተወካይ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Scope', 'ወሰን')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Window', 'የጊዜ ገደብ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Action', 'እርምጃ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {ownerDelegations.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[#0F233A] dark:text-[#E5B85C] font-semibold">
                      <p>{d.id}</p>
                      <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        {d.ownerApprovalRef}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {d.delegatorName} ({d.delegatorRole})
                      </p>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                        -&gt; {d.delegateName} ({d.delegateRole}) [{d.delegateActorId}]
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {d.scopeModules}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {fmtDate(d.startDate)} -&gt; {fmtDate(d.endDate)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={d.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {d.status === 'Active' && (
                        <button
                          type="button"
                          disabled={!canDelegate.allowed}
                          onClick={() => setRevokeTargetId(d.id)}
                          className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline disabled:opacity-40 cursor-pointer"
                        >
                          {biText(locale, 'Revoke', 'ሰርዝ')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 5: Separation-of-Duties Conflict Matrix */}
      {tab === 'sod' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
            <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Separation-of-Duties (SoD) Conflict Matrix', 'የተግባር ክፍፍል ግጭት መከላከያ ሰንጠረዥ')}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">ID</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Conflicting Roles / Identities', 'የሚጋጩ ሚናዎች / መታወቂያዎች')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Risk Area', 'የአደጋ ዘርፍ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Severity', 'ክብደት')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Enforced Prototype Rule', 'የቁጥጥር ህግ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {SOD_CONFLICT_MATRIX.map((sod) => (
                  <tr
                    key={sod.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                      {sod.id}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{sod.roleA}</p>
                      <p className="text-[11px] text-red-700 dark:text-red-400">vs. {sod.roleB}</p>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {sod.conflictArea}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={sod.severity} />
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {sod.controlRule}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 6: Quarterly Access Review Simulation */}
      {tab === 'reviews' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
            <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                `Quarterly Access-Review Simulation — ${activeOwner.name}`,
                `የሩብ ዓመት የመዳረሻ ግምገማ ማስመሰያ — ${activeOwner.name}`
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Quarter / User', 'ሩብ ዓመት እና ተጠቃሚ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Assigned Roles', 'የተመደቡ ሚናዎች')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Review Note', 'ማስታወሻ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Attestation', 'ማረጋገጫ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {ownerAccessReviews.map((rev) => (
                  <tr
                    key={rev.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                        {rev.userName}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {rev.userId} · {rev.reviewQuarter}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      {rev.assignedRoles.join(', ')}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      <p>{rev.note}</p>
                      {rev.reviewedAt && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {rev.reviewedBy} · {fmtDate(rev.reviewedAt)}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={rev.reviewStatus} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!canReviewAccess.allowed}
                        title={canReviewAccess.reason}
                        onClick={() =>
                          attestAccessReview(
                            rev.id,
                            'Attested (Simulation)',
                            'Confirmed role scope & owner isolation in simulated Q4 review.'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold disabled:opacity-40 cursor-pointer transition-colors"
                      >
                        <ShieldCheck className="w-3 h-3 inline mr-1" />
                        {biText(locale, 'Attest', 'አረጋግጥ')}
                      </button>
                      <button
                        type="button"
                        disabled={!canReviewAccess.allowed}
                        onClick={() =>
                          attestAccessReview(
                            rev.id,
                            'Exception Flagged',
                            'Flagged for owner remediation check.'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg border border-red-300 dark:border-red-700/60 bg-white dark:bg-[#152236] text-red-700 dark:text-red-300 font-semibold disabled:opacity-40 cursor-pointer transition-colors"
                      >
                        {biText(locale, 'Flag', 'ልዩነት አመልክት')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 7: Config Rules */}
      {tab === 'config' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
            <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                'Session, Approval & Numbering Configuration Rules',
                'የክፍለ-ጊዜ፣ የማጽደቂያ እና የቁጥር አሰጣጥ ደንቦች'
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Group', 'ምድብ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Setting Key', 'የቅንብር ቁልፍ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Value', 'ዋጋ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Effective Date', 'ተፈጻሚ ቀን')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Lifecycle', 'ሁኔታ')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Action', 'እርምጃ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                {configRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {rule.group}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0F233A] dark:text-slate-100">{rule.key}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {rule.description}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800 dark:text-[#E5B85C]">
                      {rule.value}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {fmtDate(rule.effectiveDate)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={rule.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={!canEditConfig.allowed}
                        title={canEditConfig.reason}
                        onClick={() => {
                          setEditRule(rule);
                          setRuleDraftForm({
                            value: rule.value,
                            effectiveDate: '2026-12-15',
                            reason: '',
                          });
                        }}
                        className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline disabled:opacity-40 cursor-pointer"
                      >
                        {biText(locale, 'Edit as Draft', 'እንደ ረቂቅ አርትዕ')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Role Detail Drawer */}
      <SlideDrawer
        open={Boolean(selectedRoleDetail)}
        onClose={() => setSelectedRoleDetail(null)}
        title={selectedRoleDetail || ''}
        subtitle={biText(locale, 'Role capability & restriction specification', 'የሚና ችሎታ እና ገደብ ዝርዝር')}
      >
        {selectedRoleDetail && (() => {
          const profile = DEMO_PERSONAS.find((p) => p.role === selectedRoleDetail);
          if (!profile) return null;
          return (
            <div className="space-y-4 text-xs">
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236] space-y-2">
                <p className="font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                  {profile.department}
                </p>
                <p className="text-slate-700 dark:text-slate-300">{profile.summary}</p>
              </div>
              <div>
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1.5">
                  {biText(locale, 'Approval Authorities', 'የማጽደቅ ስልጣኖች')}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  {profile.approvalAuthorities.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1.5">
                  {biText(locale, 'Restrictions', 'ገደቦች')}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  {profile.restrictions.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}
      </SlideDrawer>

      {/* Role Assignment Modal */}
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={biText(locale, 'Request Role Assignment (Maker-Checker)', 'የሚና ምደባ ጥያቄ')}
        subtitle={biText(
          locale,
          `Submitted for ${activeOwner.name}. System Administrator cannot approve role grants.`,
          `ለ ${activeOwner.name} የቀረበ። የሲስተም አስተዳዳሪ የራሱን ምደባ ማጽደቅ አይችልም።`
        )}
      >
        <form onSubmit={handleRoleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Synthetic User Name *', 'ሰው-ሠራሽ ስም *')}
              </label>
              <input
                required
                value={roleForm.userName}
                onChange={(e) => setRoleForm({ ...roleForm, userName: e.target.value })}
                placeholder="e.g. Demo Staff Member 09"
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Synthetic Handle *', 'ሰው-ሠራሽ አድራሻ *')}
              </label>
              <input
                required
                value={roleForm.syntheticHandle}
                onChange={(e) => setRoleForm({ ...roleForm, syntheticHandle: e.target.value })}
                placeholder="staff09@synthetic.example.et"
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Proposed Role *', 'የታቀደ ሚና *')}
              </label>
              <select
                value={roleForm.proposedRole}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, proposedRole: e.target.value as PersonaRole })
                }
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Effective Date *', 'ተፈጻሚ ቀን *')}
              </label>
              <input
                type="date"
                required
                value={roleForm.effectiveDate}
                onChange={(e) => setRoleForm({ ...roleForm, effectiveDate: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Evidence Reference *', 'የማስረጃ ቁጥር *')}
            </label>
            <input
              required
              value={roleForm.evidenceRef}
              onChange={(e) => setRoleForm({ ...roleForm, evidenceRef: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Justification *', 'ምክንያት *')}
            </label>
            <textarea
              required
              rows={2}
              value={roleForm.reason}
              onChange={(e) => setRoleForm({ ...roleForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRoleModalOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] cursor-pointer"
            >
              {biText(locale, 'Cancel', 'ሰርዝ')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold cursor-pointer transition-colors"
            >
              {biText(locale, 'Submit to Approvals Centre', 'ወደ ማጽደቂያ ማዕከል ላክ')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Request Temporary Delegation Modal */}
      <Modal
        open={delegationModalOpen}
        onClose={() => setDelegationModalOpen(false)}
        title={biText(locale, 'Request Time-Bounded Delegation', 'ጊዜያዊ የስልጣን ውክልና ጠይቅ')}
        subtitle={biText(
          locale,
          'Requires Owner / GM approval. Time-bounded with start and end dates.',
          'የባለቤት / ዋና ሥራ አስኪያጅ ማጽደቂያ ያስፈልጋል። መጀመሪያ እና መጨረሻ ቀን አለው።'
        )}
      >
        <form onSubmit={handleDelegationSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Delegate Staff Member (Actor ID)', 'ተወካይ ሰራተኛ (Actor ID)')}
            </label>
            <select
              value={delegationForm.delegateActorId}
              onChange={(e) =>
                setDelegationForm({ ...delegationForm, delegateActorId: e.target.value })
              }
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            >
              {adminUsers
                .filter((u) => u.actorId !== session.actorId)
                .map((u) => (
                  <option key={u.id} value={u.actorId}>
                    {u.name} ({u.actorId} · {u.assignedRoles.join(', ')})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Delegated Module Scope *', 'የውክልናው ወሰን *')}
            </label>
            <input
              required
              value={delegationForm.scopeModules}
              onChange={(e) => setDelegationForm({ ...delegationForm, scopeModules: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Start Date *', 'መጀመሪያ ቀን *')}
              </label>
              <input
                type="date"
                required
                value={delegationForm.startDate}
                onChange={(e) => setDelegationForm({ ...delegationForm, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'End Date *', 'መጨረሻ ቀን *')}
              </label>
              <input
                type="date"
                required
                value={delegationForm.endDate}
                onChange={(e) => setDelegationForm({ ...delegationForm, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Evidence Ref *', 'የማስረጃ ቁጥር *')}
            </label>
            <input
              required
              value={delegationForm.evidenceRef}
              onChange={(e) => setDelegationForm({ ...delegationForm, evidenceRef: e.target.value })}
              className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDelegationModalOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] cursor-pointer"
            >
              {biText(locale, 'Cancel', 'ሰርዝ')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#166549] dark:hover:bg-[#12533B] text-white font-semibold cursor-pointer transition-colors"
            >
              {biText(locale, 'Submit Delegation Request', 'የውክልና ጥያቄ ላክ')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Config Rule Draft Modal */}
      <Modal
        open={Boolean(editRule)}
        onClose={() => setEditRule(null)}
        title={editRule ? `Draft Configuration Update: ${editRule.key}` : ''}
        subtitle={biText(
          locale,
          'Changes are saved as Draft with an effective date.',
          'ለውጦች ከተፈጻሚ ቀን ጋር እንደ ረቂቅ ይቀመጣሉ።'
        )}
      >
        {editRule && (
          <form onSubmit={handleConfigDraftSubmit} className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Proposed Value *', 'የታቀደ ዋጋ *')}
              </label>
              <input
                required
                value={ruleDraftForm.value}
                onChange={(e) => setRuleDraftForm({ ...ruleDraftForm, value: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Effective Date *', 'ተፈጻሚ ቀን *')}
              </label>
              <input
                type="date"
                required
                value={ruleDraftForm.effectiveDate}
                onChange={(e) =>
                  setRuleDraftForm({ ...ruleDraftForm, effectiveDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Change Reason', 'የለውጥ ምክንያት')}
              </label>
              <input
                value={ruleDraftForm.reason}
                onChange={(e) => setRuleDraftForm({ ...ruleDraftForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRule(null)}
                className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] cursor-pointer"
              >
                {biText(locale, 'Cancel', 'ሰርዝ')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#166549] dark:hover:bg-[#12533B] text-white font-semibold cursor-pointer transition-colors"
              >
                {biText(locale, 'Save Draft', 'ረቂቅ አስቀምጥ')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(revokeTargetId)}
        onClose={() => setRevokeTargetId(null)}
        onConfirm={() => {
          if (revokeTargetId) revokeDelegation(revokeTargetId);
        }}
        title={biText(locale, 'Revoke Temporary Delegation?', 'ጊዜያዊ ውክልና ይሰረዝ?')}
        description={biText(
          locale,
          'Revoking immediately ends delegated approval rights in the prototype and records an immutable audit event.',
          'ውክልናውን መሰረዝ ወዲያውኑ የውክልና ስልጣንን ያቆማል እንዲሁም በኦዲት መዝገብ ውስጥ ይጻፋል።'
        )}
        confirmLabel={biText(locale, 'Revoke Delegation', 'ውክልና ሰርዝ')}
        tone="red"
      />
    </div>
  );
};
