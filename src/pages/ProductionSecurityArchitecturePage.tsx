import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  History,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { GovernanceCallout, StatusLabel } from '../components/ui/Primitives';
import { RequireAuth } from '../components/auth/RequireAuth';

interface ArchLayer {
  id: string;
  number: string;
  title: string;
  titleAm: string;
  sourceDoc: string;
  icon: React.ComponentType<{ className?: string }>;
  trainingState: string;
  productionSpec: string[];
  sqlOrCodeContract: string;
  blockerNote: string;
}

const ARCH_LAYERS: ArchLayer[] = [
  {
    id: 'auth',
    number: 'Layer 01',
    title: 'Server-Side Authentication & Session Security',
    titleAm: 'በሰርቨር ላይ የተመሠረተ ማረጋገጫ እና የክፍለ-ጊዜ ደህንነት',
    sourceDoc: 'ADR-001 · Technical Design Package v1.0 §5 · 06_GOVERNANCE_AND_CONTROLS',
    icon: KeyRound,
    trainingState: 'Client-side training account check only (no real credentials or cookies).',
    productionSpec: [
      'Server-side Django 5.x session authentication with Argon2id password hashing.',
      'HttpOnly, Secure, SameSite=Lax cookies + CSRF token enforcement on all POST/PUT/PATCH requests.',
      'Idle timeout (30 min configurable via owner-approved rule) and absolute max session lifetime with forced re-auth on privilege elevation.',
      'Failed-login rate limiting, account lockout policy, and server-verified session revocation on password reset or role revocation.',
    ],
    sqlOrCodeContract: `SESSION_COOKIE_HTTPONLY = True\nSESSION_COOKIE_SECURE = True\nPASSWORD_HASHERS = ["django.contrib.auth.hashers.Argon2PasswordHasher"]\nCSRF_COOKIE_SAMESITE = "Lax"`,
    blockerNote: 'Requires Django backend deployment and Owner-approved session policy.',
  },
  {
    id: 'authz',
    number: 'Layer 02',
    title: 'Server-Side Role & Permission Authorisation',
    titleAm: 'በሰርቨር የተረጋገጠ ሚና እና ፈቃድ ቁጥጥር (RBAC)',
    sourceDoc: 'SRS v1.1 §7 · 06_GOVERNANCE_AND_CONTROLS · Requirements Addendum §4',
    icon: ShieldCheck,
    trainingState: 'Client-side RBAC helper disables/hides UI actions for staff training only.',
    productionSpec: [
      'Deny-by-default Django decorators/DRF permission classes evaluated on every endpoint.',
      'Strict separation of User Identity (actor_id), Role Assignment, Permission Capability, Owner Scope, and Approval Authority.',
      'System Administrator role strictly barred from business, financial, tax, and audit approval endpoints at middleware & policy level.',
      'Time-bounded temporary delegations stored with effective start/end timestamps and verified server-side per request.',
    ],
    sqlOrCodeContract: `@require_capability(module="tax", action="submit_review", forbid_roles=["System Administrator", "Auditor"])\ndef submit_tax_rule_for_review(request, owner_id, rule_id): ...`,
    blockerNote: 'Authoritative Owner Authority-Matrix sign-off required for role slots 5–11.',
  },
  {
    id: 'rls',
    number: 'Layer 03',
    title: 'PostgreSQL Row-Level Security (Owner Isolation)',
    titleAm: 'የPostgreSQL ረድፍ-ደረጃ የባለቤትነት መረጃ መለያ (RLS)',
    sourceDoc: 'ADR-003 · WP2 Database & RLS Validation Plan',
    icon: Database,
    trainingState: 'In-memory ownerId filter in PrmsContext (not cryptographic DB isolation).',
    productionSpec: [
      'Application DB runtime role configured with NOSUPERUSER, NOBYPASSRLS, and FORCE ROW LEVEL SECURITY on every owner-scoped table.',
      'Django middleware sets transaction-local context: SET LOCAL app.current_owner_id = <uuid> inside atomic transaction blocks.',
      'Every tenant, property, unit, lease, charge, receipt, ledger journal, tax draft, source evidence, and audit row enforces owner_id = current_setting(\'app.current_owner_id\')::uuid.',
      'Cross-owner queries return zero rows at PostgreSQL engine level even if an application bug omits a WHERE clause.',
    ],
    sqlOrCodeContract: `ALTER TABLE prms_unit ENABLE ROW LEVEL SECURITY;\nALTER TABLE prms_unit FORCE ROW LEVEL SECURITY;\nCREATE POLICY unit_owner_isolation ON prms_unit\n  USING (owner_id = current_setting('app.current_owner_id', true)::uuid);`,
    blockerNote: 'WP-2 PostgreSQL 16 integration suite must execute and pass against live DB before cutover.',
  },
  {
    id: 'maker-checker',
    number: 'Layer 04',
    title: 'Database-Backed Maker-Checker & Self-Approval Engine',
    titleAm: 'በዳታቤዝ የተጠበቀ የአዘጋጅ-አጽዳቂ ሞተር',
    sourceDoc: '06_GOVERNANCE_AND_CONTROLS · Technical Design Addendum §6',
    icon: GitBranch,
    trainingState: 'In-browser actorId comparison blocks self-approval in workflow simulation.',
    productionSpec: [
      'Workflow state machine enforced in transactional service layer AND PostgreSQL CHECK/TRIGGER constraints.',
      'Immutable maker_actor_id recorded on creation; checker_actor_id <> maker_actor_id enforced by DB constraint.',
      'Multi-step escalations record distinct step1_actor_id and step2_actor_id to prevent same-person double-signoff.',
      'Finalized approvals (Approved / Rejected / Cancelled / Superseded) locked against mutation; corrections spawn linked superseding records.',
    ],
    sqlOrCodeContract: `ALTER TABLE prms_approval_decision\n  ADD CONSTRAINT chk_no_self_approval CHECK (checker_actor_id <> maker_actor_id);`,
    blockerNote: 'Requires PostgreSQL schema migration & threshold matrix approval.',
  },
  {
    id: 'audit',
    number: 'Layer 05',
    title: 'Append-Only Immutable Audit Log',
    titleAm: 'የማይፋቅ ተከታታይ የኦዲት መዝገብ',
    sourceDoc: '06_GOVERNANCE_AND_CONTROLS · WP2 Database Plan §4',
    icon: History,
    trainingState: 'In-browser append-only array; resets on browser reload or Trainer reset.',
    productionSpec: [
      'Dedicated audit_event table with REVOKE UPDATE, DELETE, TRUNCATE FROM PUBLIC, app_user, and admin_user.',
      'Database BEFORE UPDATE OR DELETE trigger unconditionally raises an exception.',
      'Captures server UTC timestamp + Africa/Addis_Ababa display timestamp, actor_id, role_at_event, owner_id, source IP hash, before_json, after_json, and linked approval_id.',
      'Nightly cryptographically checksummed offline backup verification (no direct DB edit tool even for System Admin).',
    ],
    sqlOrCodeContract: `REVOKE UPDATE, DELETE, TRUNCATE ON prms_audit_event FROM adprms_app;\nCREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON prms_audit_event\n  FOR EACH ROW EXECUTE FUNCTION raise_immutable_audit_error();`,
    blockerNote: 'Requires offline backup target & database role privilege audit.',
  },
  {
    id: 'wp2-uat',
    number: 'Layer 06',
    title: 'WP-2 RLS Test Suite & Formal UAT Acceptance Gate',
    titleAm: 'የWP-2 ዳታቤዝ ፍተሻ እና የባለቤት ተቀባይነት ማረጋገጫ',
    sourceDoc: 'WP2_DATABASE_AND_RLS_VALIDATION_PLAN.md · Phase 1 Approval Log',
    icon: FileCheck2,
    trainingState: 'Traceability register & simulated UAT runner only in prototype.',
    productionSpec: [
      'Automated pytest + PostgreSQL 16 WP-2 suite verifying cross-owner zero-leakage, NOSUPERUSER enforcement, and trigger immutability.',
      'Owner sign-off on Authority Matrix, Ethiopian licensed tax adviser written opinions, and legal document templates.',
      'Staged historical data reconciliation (control totals, duplicate detection, exception resolution) before first production cutover.',
      'Signed backup & restore test log on target Ethiopian office infrastructure.',
    ],
    sqlOrCodeContract: `pytest tests/wp2/test_rls_owner_isolation.py tests/wp2/test_audit_immutability.py\n# Expected: 0 cross-owner rows, 0 bypassed triggers, 100% pass gate`,
    blockerNote: 'All 9 compliance & operational production gates remain Blocked / Pending.',
  },
];

export const ProductionSecurityArchitecturePage: React.FC = () => {
  const { locale, setActiveSection } = usePrms();
  const [selectedLayerId, setSelectedLayerId] = useState<string>('rls');

  const activeLayer = ARCH_LAYERS.find((l) => l.id === selectedLayerId) || ARCH_LAYERS[0];

  return (
    <RequireAuth section="security-architecture">
    <div className="space-y-6">
      {/* Mandatory Production Architecture Banner */}
      <div className="rounded-xl border border-red-300 dark:border-red-800/70 bg-red-50/90 dark:bg-red-950/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-950 dark:text-red-100">
              Target production architecture — requires separately authorised backend implementation and PostgreSQL validation.
            </p>
            <p className="text-xs text-red-900 dark:text-red-200 mt-1">
              {biText(
                locale,
                'This browser prototype runs exclusively in Training Mode with synthetic data. Client-side TypeScript checks never replace server-side Django 5.x + PostgreSQL 16 RLS enforcement.',
                'ይህ የአሳሽ ፕሮቶታይፕ በስልጠና ሁነታ ብቻ በሰው-ሠራሽ ውሂብ ይሰራል። በአሳሽ ውስጥ ያሉ መቆጣጠሪያዎች በሰርቨር ላይ ያለውን Django + PostgreSQL 16 RLS ፈጽሞ አይተኩም።'
              )}
            </p>
          </div>
        </div>
        <StatusLabel label="Blocked — Pending Gate Clearance" />
      </div>

      {/* Mode Separation Comparison Card */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(locale, 'Mode 1: Current Browser Training Mode', 'ሁነታ 1፡ አሁን ያለው የአሳሽ ስልጠና ሁነታ')}
            </h2>
            <StatusLabel label="Prototype Simulation" />
          </div>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              {biText(
                locale,
                'Synthetic demo data & fictional training credentials only.',
                'ሰው-ሠራሽ የሙከራ ውሂብ እና ምትክ የስልጠና መለያዎች ብቻ።'
              )}
            </li>
            <li>
              {biText(
                locale,
                'Safe for Ethiopian office UAT walkthroughs, staff drills, and UI review.',
                'ለሰራተኞች ስልጠና እና ለUI/UX ግምገማ ደህንነቱ የተጠበቀ።'
              )}
            </li>
            <li>
              {biText(
                locale,
                'Zero connections to live banks, ERCA/MOR e-invoicing, or real production DB.',
                'ከባንክ፣ ከታክስ ወይም ከምርት ዳታቤዝ ጋር ምንም ግንኙነት የለውም።'
              )}
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                'Mode 2: Target Production Security Architecture',
                'ሁነታ 2፡ የታለመው የምርት ደህንነት አርክቴክቸር'
              )}
            </h2>
            <StatusLabel label="Production Boundary" />
          </div>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              {biText(
                locale,
                'Approved Stack: Django 5.x + PostgreSQL 16 + Server Templates / htmx (ADR-001).',
                'የጸደቀ ቴክኖሎጂ፡ Django 5.x + PostgreSQL 16 (ADR-001)።'
              )}
            </li>
            <li>
              {biText(
                locale,
                'Multi-owner isolation enforced at PostgreSQL engine level via RLS (ADR-003).',
                'የባለቤትነት መለያ በPostgreSQL RLS ዳታቤዝ ደረጃ ይተገበራል (ADR-003)።'
              )}
            </li>
            <li>
              {biText(
                locale,
                'Requires separate backend build authorization, WP-2 DB validation, and Owner sign-off.',
                'የተናጠል የኋላ-መድረክ ግንባታ ፈቃድና የWP-2 ፍተሻ ይፈልጋል።'
              )}
            </li>
          </ul>
        </div>
      </section>

      {/* 6-Layer Visual Architecture Stack + Inspector */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-2.5">
          <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
            {biText(locale, '6 Target Security Enforcement Layers', '6ቱ የታለሙ የደህንነት መቆጣጠሪያ ንብርብሮች')}
          </h2>
          {ARCH_LAYERS.map((layer) => {
            const Icon = layer.icon;
            const active = layer.id === selectedLayerId;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => setSelectedLayerId(layer.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start gap-3 cursor-pointer ${
                  active
                    ? 'border-[#166549] dark:border-emerald-500/70 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] hover:bg-[#F8FAFC] dark:hover:bg-[#152236]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    active
                      ? 'bg-[#166549] dark:bg-[#248F64] text-white'
                      : 'bg-[#0F233A] dark:bg-[#152236] text-white dark:text-[#E5B85C]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-[#E5B85C]">
                      {layer.number}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">·</span>
                    <span className="text-[11px] text-[#9A6712] dark:text-[#E5B85C] font-medium">
                      Target Only
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0F233A] dark:text-slate-100 mt-0.5">
                    {biText(locale, layer.title, layer.titleAm)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {layer.sourceDoc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#DFE5EE] dark:border-[#233349]">
            <div>
              <p className="text-xs font-mono text-[#166549] dark:text-emerald-400 font-semibold">
                {activeLayer.number} · {activeLayer.sourceDoc}
              </p>
              <h3 className="text-base font-bold text-[#0F233A] dark:text-slate-100 mt-1">
                {biText(locale, activeLayer.title, activeLayer.titleAm)}
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#CBD5E1] dark:border-[#2D405B] bg-[#F8FAFC] dark:bg-[#152236] text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
              <Lock className="w-3 h-3" />
              Backend Blueprint
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-[#D9A441]/50 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-950 dark:text-amber-100">
            <p className="font-semibold">
              {biText(
                locale,
                'Current Prototype Simulation vs. Production Boundary',
                'የፕሮቶታይፕ ማስመሰያ እና የምርት ልዩነት'
              )}
            </p>
            <p className="mt-1">{activeLayer.trainingState}</p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#0F233A] dark:text-slate-100 mb-2">
              {biText(locale, 'Approved Production Controls', 'የጸደቁ የምርት መቆጣጠሪያዎች')}
            </h4>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              {activeLayer.productionSpec.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#0F233A] dark:text-slate-100 mb-2">
              {biText(locale, 'Authoritative Implementation Contract', 'የቴክኒክ ትግበራ ንድፍ (SQL / Django)')}
            </h4>
            <pre className="p-3.5 rounded-lg bg-[#0B1728] dark:bg-[#08101A] border border-[#1E324D] text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
              {activeLayer.sqlOrCodeContract}
            </pre>
          </div>

          <GovernanceCallout
            title={biText(locale, 'Prerequisite Gate Status', 'የቅድመ-ሁኔታ በር ሁኔታ')}
            description={activeLayer.blockerNote}
            variant="warning"
            controlType="Production Boundary"
            action={
              <button
                type="button"
                onClick={() => setActiveSection('compliance')}
                className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173454] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                {biText(locale, 'View Compliance Gates', 'የተገዢነት በሮችን እይ')}
              </button>
            }
          />
        </div>
      </section>
    </div>
    </RequireAuth>
  );
};
