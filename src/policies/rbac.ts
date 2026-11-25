import {
  ApprovalRequest,
  DelegationRecord,
  DetailedPermissionRule,
  NavSection,
  OwnerId,
  PersonaRole,
  RoleAuthoritySpec,
  RoleCatalogEntry,
  SodConflictRow,
} from '../types/prms';

export type ActionKey =
  | 'create_property_unit'
  | 'request_unit_renumber'
  | 'request_ownership_change'
  | 'create_rental_application'
  | 'decide_rental_application'
  | 'create_lease'
  | 'renew_lease'
  | 'request_lease_exception'
  | 'record_payment'
  | 'request_receipt_void'
  | 'create_expense_request'
  | 'create_maintenance_ticket'
  | 'propose_account_change'
  | 'draft_tax_rule'
  | 'request_tax_review'
  | 'prepare_adviser_pack'
  | 'submit_owner_decision'
  | 'toggle_legal_hold_placeholder'
  | 'request_role_assignment'
  | 'request_delegation'
  | 'run_access_review'
  | 'request_backup_drill'
  | 'request_migration_exception'
  | 'run_acceptance_test'
  | 'update_system_config'
  | 'export_report'
  | 'post_manual_journal'
  | 'reverse_journal'
  | 'sign_bank_recon'
  | 'settle_deposit_refund'
  | 'run_period_close'
  | 'approve_period_close'
  | 'reopen_period'
  | 'manage_fixed_assets'
  | 'run_tax_workpaper'
  | 'record_owner_draw'
  | 'record_vendor_bill';

export interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
}

const ROLE_ACTIONS: Record<PersonaRole, ActionKey[]> = {
  'Owner / Director': [
    'request_ownership_change',
    'decide_rental_application',
    'submit_owner_decision',
    'request_delegation',
    'run_access_review',
    'run_acceptance_test',
    'export_report',
    'approve_period_close',
    'reopen_period',
    'record_owner_draw',
    'reverse_journal',
  ],
  'General Manager': [
    'create_property_unit',
    'request_unit_renumber',
    'request_ownership_change',
    'create_rental_application',
    'decide_rental_application',
    'create_lease',
    'renew_lease',
    'request_lease_exception',
    'record_payment',
    'request_receipt_void',
    'create_expense_request',
    'create_maintenance_ticket',
    'propose_account_change',
    'draft_tax_rule',
    'request_tax_review',
    'prepare_adviser_pack',
    'submit_owner_decision',
    'toggle_legal_hold_placeholder',
    'request_role_assignment',
    'request_delegation',
    'run_access_review',
    'request_backup_drill',
    'request_migration_exception',
    'run_acceptance_test',
    'export_report',
    'sign_bank_recon',
    'settle_deposit_refund',
    'approve_period_close',
    'reopen_period',
    'reverse_journal',
    'run_tax_workpaper',
    'record_vendor_bill',
  ],
  'Assistant Manager': [
    'create_property_unit',
    'request_unit_renumber',
    'create_rental_application',
    'decide_rental_application',
    'create_lease',
    'renew_lease',
    'request_lease_exception',
    'create_maintenance_ticket',
    'request_delegation',
    'run_acceptance_test',
    'export_report',
  ],
  'Finance Officer': [
    'record_payment',
    'request_receipt_void',
    'create_expense_request',
    'propose_account_change',
    'draft_tax_rule',
    'request_tax_review',
    'prepare_adviser_pack',
    'submit_owner_decision',
    'toggle_legal_hold_placeholder',
    'request_migration_exception',
    'run_acceptance_test',
    'export_report',
    'post_manual_journal',
    'reverse_journal',
    'settle_deposit_refund',
    'run_period_close',
    'reopen_period',
    'manage_fixed_assets',
    'run_tax_workpaper',
    'record_owner_draw',
    'record_vendor_bill',
  ],
  Clerk: [
    'create_property_unit',
    'request_unit_renumber',
    'create_rental_application',
    'create_lease',
    'renew_lease',
    'request_lease_exception',
    'record_payment',
    'request_receipt_void',
    'create_maintenance_ticket',
    'run_acceptance_test',
    'export_report',
  ],
  'Collections Clerk': [
    'record_payment',
    'request_receipt_void',
    'run_acceptance_test',
    'export_report',
  ],
  'Property Clerk': [
    'create_property_unit',
    'request_unit_renumber',
    'create_rental_application',
    'create_lease',
    'renew_lease',
    'request_lease_exception',
    'create_maintenance_ticket',
    'run_acceptance_test',
    'export_report',
  ],
  'System Administrator': [
    'request_role_assignment',
    'request_delegation',
    'run_access_review',
    'request_backup_drill',
    'request_migration_exception',
    'update_system_config',
    'run_acceptance_test',
    'export_report',
  ],
  'Auditor / Read-only reviewer': ['run_acceptance_test', 'export_report'],
  'Training Coordinator': ['run_acceptance_test', 'export_report'],
};

export const ROLE_CATALOG_11: RoleCatalogEntry[] = [
  {
    id: 'ROLE-BASE-01',
    slotNumber: 1,
    roleName: 'General Manager',
    classification: 'SRS Baseline Internal',
    configured: true,
    personaRole: 'General Manager',
    ownerDecisionRequired: 'SRS v1.1 §7 Baseline Role (Training Demo)',
    businessAuthority: 'Operational leadership and Step-1/Step-2 checker across isolated owner contexts.',
  },
  {
    id: 'ROLE-BASE-02',
    slotNumber: 2,
    roleName: 'Assistant Manager',
    classification: 'SRS Baseline Internal',
    configured: true,
    personaRole: 'Assistant Manager',
    ownerDecisionRequired: 'SRS v1.1 §7 Baseline Role (Training Demo)',
    businessAuthority: 'Leasing, applications, maintenance coordination, and Step-1 operational checker within limits.',
  },
  {
    id: 'ROLE-BASE-03',
    slotNumber: 3,
    roleName: 'Finance Officer',
    classification: 'SRS Baseline Internal',
    configured: true,
    personaRole: 'Finance Officer',
    ownerDecisionRequired: 'SRS v1.1 §7 Baseline Role (Training Demo)',
    businessAuthority: 'Draft CoA, tax placeholders, expense proposals, migration review, and receipt void checker.',
  },
  {
    id: 'ROLE-BASE-04',
    slotNumber: 4,
    roleName: 'Clerk',
    classification: 'SRS Baseline Internal',
    configured: true,
    personaRole: 'Clerk',
    ownerDecisionRequired: 'SRS v1.1 §7 Baseline Role (Training Demo)',
    businessAuthority: 'Front-office intake: applications, leases, payments, maintenance tickets, and maker submissions.',
  },
  {
    id: 'ROLE-TMPL-05',
    slotNumber: 5,
    roleName: 'Owner / Director',
    classification: 'Configurable Template',
    configured: true,
    personaRole: 'Owner / Director',
    ownerDecisionRequired: 'Configurable Governance Template (Alpha Scoped)',
    businessAuthority: 'Senior owner-scoped checker & final governance sign-off (own owner context only).',
  },
  {
    id: 'ROLE-TMPL-06',
    slotNumber: 6,
    roleName: 'Collections Clerk',
    classification: 'Configurable Template',
    configured: true,
    personaRole: 'Collections Clerk',
    ownerDecisionRequired: 'Configurable Clerk Split Template',
    businessAuthority: 'Receivables collection, receipt preview, and void/reversal maker only.',
  },
  {
    id: 'ROLE-TMPL-07',
    slotNumber: 7,
    roleName: 'Property Clerk',
    classification: 'Configurable Template',
    configured: true,
    personaRole: 'Property Clerk',
    ownerDecisionRequired: 'Configurable Clerk Split Template',
    businessAuthority: 'Portfolio intake, applications, leases, maintenance tickets, and renumbering maker only.',
  },
  {
    id: 'ROLE-TMPL-08',
    slotNumber: 8,
    roleName: 'System Administrator',
    classification: 'Configurable Template',
    configured: true,
    personaRole: 'System Administrator',
    ownerDecisionRequired: 'Configurable IT Security Template (Zero Business Approval)',
    businessAuthority: 'Draft security/numbering rules, role submission maker, backup drills (no business approvals).',
  },
  {
    id: 'ROLE-TMPL-09',
    slotNumber: 9,
    roleName: 'Auditor / Read-only reviewer',
    classification: 'Configurable Template',
    configured: true,
    personaRole: 'Auditor / Read-only reviewer',
    ownerDecisionRequired: 'Configurable Assurance Template (Read-Only)',
    businessAuthority: 'Read-only inspection, UAT acceptance verification, and audit report simulation.',
  },
  {
    id: 'ROLE-TMPL-10',
    slotNumber: 10,
    roleName: 'Unconfigured Role Slot #10 (Legal / Tax Reviewer Placeholder)',
    classification: 'Unconfigured Slot',
    configured: false,
    ownerDecisionRequired: 'Owner authority-matrix approval required.',
    businessAuthority: 'Unassignable & inactive — Owner authority-matrix approval required.',
  },
  {
    id: 'ROLE-TMPL-11',
    slotNumber: 11,
    roleName: 'Unconfigured Role Slot #11 (External Maintenance Supervisor Placeholder)',
    classification: 'Unconfigured Slot',
    configured: false,
    ownerDecisionRequired: 'Owner authority-matrix approval required.',
    businessAuthority: 'Unassignable & inactive — Owner authority-matrix approval required.',
  },
];

export const ROLE_AUTHORITY_CATALOG: RoleAuthoritySpec[] = [
  {
    role: 'General Manager',
    classification: 'SRS v1.1 Baseline Internal Role',
    responsibilities: 'Day-to-day operational oversight across properties, leasing, receivables, maintenance, and Step-1/2 operational approvals.',
    permittedActions: 'View, Create Draft, Edit Draft, Submit, Approve (checker for other actors), Reject, Return, Export.',
    prohibitedActions: 'Cannot self-approve own requests (Actor ID block); cannot activate tax rules; cannot alter/delete audit events.',
    ownerScope: 'Authorised single-owner context at a time (Alpha or Beta, never mixed).',
    approvalAuthority: 'Unit Renumbering, Applications, CoA/Tax Review Step 1, Receipt Voids, Expenses, Maintenance >= ETB 10,000, Role Grants.',
    sodConflicts: 'Blocked from checking any request created by own Actor ID; cannot supersede Owner / Director on Step-2 escalations.',
    effectiveDates: '2026-01-01 to 2027-12-31 (Training Effective Window).',
    delegationEligibility: 'Eligible to receive or grant time-bounded Step-1 operational delegation with Owner approval.',
    requiredEvidence: 'Documentary evidence ref required on every operational submission or approval decision.',
    auditRequirements: 'Every view export, draft submission, owner switch, and approval logged immutably with Actor ID & timestamp.',
  },
  {
    role: 'Assistant Manager',
    classification: 'SRS v1.1 Baseline Internal Role',
    responsibilities: 'Coordinates leasing intake, unit readiness, maintenance tickets, and first-line operational checks.',
    permittedActions: 'View, Create Draft, Edit Draft, Submit, Approve (Step-1 operational items where not maker), Reject, Return, Export.',
    prohibitedActions: 'Cannot approve ownership transfers, CoA/tax changes, high-value expenses (> ETB 25,000), role assignments, or self-requests.',
    ownerScope: 'Authorised single-owner context at a time (Alpha or Beta, isolated).',
    approvalAuthority: 'Rental Applications, Maintenance Cost Step 1, Unit Renumbering (when not maker).',
    sodConflicts: 'Blocked from approving own applications/leases/tickets or financial/admin authority grants.',
    effectiveDates: '2026-01-01 to 2027-12-31 (Training Effective Window).',
    delegationEligibility: 'Eligible for temporary Step-1 operational delegation; cannot receive Finance/Owner Step-2 escalations.',
    requiredEvidence: 'Unit inspection schedule, application screening checklist, maintenance quote reference.',
    auditRequirements: 'Logged across portfolio, applications, leases, maintenance, and Step-1 approval steps.',
  },
  {
    role: 'Finance Officer',
    classification: 'SRS v1.1 Baseline Internal Role',
    responsibilities: 'Maintains provisional Chart of Accounts designs, synthetic tax drafts, expense payment proposals, and receivables reconciliation.',
    permittedActions: 'View, Create Draft, Edit Draft, Submit, Approve (Receipt Void/Reversal & Maintenance Cost when not maker), Reverse (via approval), Export.',
    prohibitedActions: 'Cannot approve own CoA, Tax Draft, Adviser Pack, or Expense proposals; cannot activate tax rules or trigger real bank payouts.',
    ownerScope: 'Authorised single-owner context at a time (Alpha or Beta, isolated).',
    approvalAuthority: 'Receipt Void / Reversal (from Clerk/GM) and Maintenance Cost Step 1.',
    sodConflicts: 'Maker on CoA, Tax Drafts, Expenses — strictly blocked from checking those categories.',
    effectiveDates: '2026-01-01 to 2027-12-31 (Training Effective Window).',
    delegationEligibility: 'May receive temporary receipt-void checker delegation within Finance limits; cannot self-delegate.',
    requiredEvidence: 'Bank slip / supplier invoice placeholder, licensed tax adviser memo ref for tax/compliance packs.',
    auditRequirements: 'All CoA edits, tax draft reviews, expense proposals, and receipt reversals logged with before/after JSON snapshots.',
  },
  {
    role: 'Clerk',
    classification: 'SRS v1.1 Baseline Internal Role',
    responsibilities: 'Front-office intake: registers units, tenant applications, leases, rent payments, DEMO receipts, and maintenance/complaint tickets.',
    permittedActions: 'View, Create Draft, Edit Draft, Submit, Export (reports in scope).',
    prohibitedActions: 'Cannot Approve, Reject, Return, Reverse, or Void without checker; no Tax/Finance/Admin/Audit mutation.',
    ownerScope: 'Authorised single-owner context at a time (Alpha or Beta, isolated).',
    approvalAuthority: 'None — strict Maker role only across front-office workflows.',
    sodConflicts: 'Cannot approve unit renumbering, applications, receipt voids, or lease exceptions.',
    effectiveDates: '2026-01-01 to 2027-12-31 (Training Effective Window).',
    delegationEligibility: 'Not eligible to hold Checker delegations above Maker threshold.',
    requiredEvidence: 'Payment reference placeholder, synthetic tenant ID doc ref, maintenance photo/inspection ref.',
    auditRequirements: 'All intake creations, payment allocations, receipt print previews, and void requests append immutably.',
  },
  {
    role: 'Owner / Director',
    classification: 'Configurable Role Template',
    responsibilities: 'Executive governance oversight and final Step-2/Owner authorization strictly within Test Owner Alpha.',
    permittedActions: 'View, Approve, Reject, Return, Submit Owner Decision, Attest Access Review, Export.',
    prohibitedActions: 'Cannot switch into Test Owner Beta (hard owner isolation); cannot create routine clerk transactions or self-approve.',
    ownerScope: 'Own context only — locked to Test Owner Alpha (OWN-ALPHA).',
    approvalAuthority: 'Final Sign-off on Ownership Changes, CoA v2+, Tax Reviews (Active locked), Expenses > ETB 25k, Backup Drills, Role Assignments.',
    sodConflicts: 'Blocked from self-approving any item initiated by USR-SYNTH-01.',
    effectiveDates: '2026-01-01 to Open-Ended (Owner Charter Template).',
    delegationEligibility: 'May grant time-bounded temporary delegation to General Manager with audit trail.',
    requiredEvidence: 'Signed owner resolution / board memo placeholder & Step-1 checker clearance.',
    auditRequirements: 'Cross-owner switch attempts denied and logged; all executive approvals stamped with Actor ID.',
  },
  {
    role: 'Collections Clerk',
    classification: 'Configurable Role Template',
    responsibilities: 'Specialist receivables template handling synthetic ETB payment allocation, DEMO receipt previews, and void requests.',
    permittedActions: 'View (Collections/Tenants/Portfolio), Create Payment Draft, Submit Void Request, Export.',
    prohibitedActions: 'Cannot Approve/Reverse own voids, delete receipts, modify leases/units, or access Admin/Tax configuration.',
    ownerScope: 'Authorised single-owner context at a time (Alpha or Beta).',
    approvalAuthority: 'None — Maker Only for Receipt Void / Reversal.',
    sodConflicts: 'Strictly separated from Receipt Void Checker and CoA/Expense preparation.',
    effectiveDates: '2026-01-01 to 2027-12-31 (Configurable Template).',
    delegationEligibility: 'Not eligible for Checker delegation.',
    requiredEvidence: 'Bank deposit slip / cash voucher / cheque placeholder reference.',
    auditRequirements: 'Every payment, receipt print preview, and void request logged immutably.',
  },
  {
    role: 'Property Clerk',
    classification: 'Configurable Role Template',
    responsibilities: 'Specialist portfolio template handling buildings, units, applications, versioned leases, and maintenance intake.',
    permittedActions: 'View (Portfolio/Applications/Leases/Maintenance), Create/Edit Draft, Submit Unit Renumbering, Export.',
    prohibitedActions: 'Cannot approve renumbering or applications; cannot record rent payments or modify finance/tax/admin.',
    ownerScope: 'Authorised single-owner context at a time (Alpha or Beta).',
    approvalAuthority: 'None — Maker Only for unit renumbering and lease/application submissions.',
    sodConflicts: 'Separated from cash collections and checker approvals.',
    effectiveDates: '2026-01-01 to 2027-12-31 (Configurable Template).',
    delegationEligibility: 'Not eligible for Checker delegation.',
    requiredEvidence: 'Floor plan, unit census ref, lease evidence ref.',
    auditRequirements: 'Unit identifier aliases, lease versions, and renumbering requests logged immutably.',
  },
  {
    role: 'System Administrator',
    classification: 'Configurable Role Template',
    responsibilities: 'IT & security configuration drafts, role assignment submissions, quarterly review prep, backup drills, and migration staging.',
    permittedActions: 'View, Create Draft Config, Submit Role Assignment, Request Backup Drill, Submit Migration Exception, Export.',
    prohibitedActions: 'PROHIBITED from approving ANY business, tax, accounting, role, delegation, or audit request; cannot edit/delete audit log.',
    ownerScope: 'Authorised single-owner context at a time (never bypasses isolation).',
    approvalAuthority: 'NONE — Hard Governance Block across all approval workflows.',
    sodConflicts: 'IT Privilege Escalation block (SOD-02): zero self-grant or business checker authority.',
    effectiveDates: '2026-01-01 to 2027-12-31 (Configurable Security Template).',
    delegationEligibility: 'Cannot receive business, financial, or approval delegations.',
    requiredEvidence: 'HR authorization ref, backup checksum manifest, migration reconciliation ref.',
    auditRequirements: 'Any denied business approval attempt or config draft is recorded as high-visibility audit event.',
  },
  {
    role: 'Auditor / Read-only reviewer',
    classification: 'Configurable Role Template',
    responsibilities: 'Independent assurance inspection of ledgers, compliance gates, approvals, immutable audit logs, and UAT verification.',
    permittedActions: 'View all modules in read-only mode, Log Simulated UAT Verification Notes, Export Audit/Compliance Reports.',
    prohibitedActions: 'All Create, Edit, Submit, Approve, Reject, Return, Void, Reverse, and Configure actions disabled.',
    ownerScope: 'Authorised single-owner context at a time (Alpha or Beta, isolated).',
    approvalAuthority: 'None — Independent Read-Only Assurance.',
    sodConflicts: 'Complete separation from operational maker/checker workflows (SOD-05).',
    effectiveDates: '2026-01-01 to 2027-12-31 (Assurance Review Window).',
    delegationEligibility: 'Prohibited from holding operational or approval delegations.',
    requiredEvidence: 'UAT test observation ref on logged verification checks.',
    auditRequirements: 'Report exports and UAT check observations logged immutably.',
  },
  {
    role: 'Training Coordinator',
    classification: 'Training Facilitation Role',
    responsibilities: 'Facilitates staff walkthroughs, inspects Training Exercises, and holds exclusive permission to reset synthetic seed data.',
    permittedActions: 'View Training Modules, Execute Trainer Seed Reset, Log UAT Observations, Export Training Reports.',
    prohibitedActions: 'Cannot approve live business requests or modify audit records (reset restores baseline seed & logs reset event).',
    ownerScope: 'Training mode only (Alpha & Beta synthetic reset scope).',
    approvalAuthority: 'None — Training Facilitation & Seed Reset Only.',
    sodConflicts: 'Separated from Maker/Checker business decision authority.',
    effectiveDates: 'Training Simulation Only (Not Present in Production Authority Matrix).',
    delegationEligibility: 'Not applicable — non-production role.',
    requiredEvidence: 'Training cohort / walkthrough confirmation.',
    auditRequirements: 'Seed resets and training sign-in events recorded immediately.',
  },
];

export function checkActionPermission(
  role: PersonaRole,
  action: ActionKey
): PermissionCheckResult {
  if (
    (role === 'Auditor / Read-only reviewer' || role === 'Training Coordinator') &&
    action !== 'export_report' &&
    action !== 'run_acceptance_test'
  ) {
    return {
      allowed: false,
      reason: `${role} cannot create, modify, submit, or approve operational or compliance records.`,
    };
  }

  if (
    role === 'System Administrator' &&
    ![
      'request_role_assignment',
      'request_delegation',
      'run_access_review',
      'request_backup_drill',
      'request_migration_exception',
      'update_system_config',
      'run_acceptance_test',
      'export_report',
    ].includes(action)
  ) {
    return {
      allowed: false,
      reason:
        'System Administrator restriction: cannot perform operational, tax, accounting, or business approval actions.',
    };
  }

  const allowedActions = ROLE_ACTIONS[role] || [];
  if (allowedActions.includes(action)) {
    return { allowed: true, reason: 'Permitted under active role & permission policy.' };
  }

  return {
    allowed: false,
    reason: `${role} is not authorized for this action under AD-PRMS role controls.`,
  };
}

export function checkApprovalAuthority(
  role: PersonaRole,
  request: ApprovalRequest,
  actorId?: string,
  activeDelegations: DelegationRecord[] = []
): PermissionCheckResult {
  if (request.finalized || !['Pending', 'In Review'].includes(request.status)) {
    return {
      allowed: false,
      reason: `Request is finalized/closed (${request.status}) and cannot be modified. Create a superseding request if correction is needed.`,
    };
  }

  // CRITICAL: Actor-ID self-approval prohibition
  if (actorId && request.makerActorId && request.makerActorId === actorId) {
    return {
      allowed: false,
      reason:
        'Self-approval is prohibited: the same Actor ID cannot approve their own request.',
    };
  }

  if (request.makerPersona === role) {
    return {
      allowed: false,
      reason: 'Self-approval is prohibited for the same maker role/account.',
    };
  }

  if (role === 'Auditor / Read-only reviewer' || role === 'Training Coordinator') {
    return {
      allowed: false,
      reason: `${role} cannot approve, reject, or return workflow requests.`,
    };
  }

  if (role === 'System Administrator') {
    return {
      allowed: false,
      reason:
        'System Administrator restriction: cannot approve tax, accounting, ownership, delegation, audit, or business requests.',
    };
  }

  // Multi-step Step 2 check: require escalator/owner roles and prevent same step-1 reviewer approving step 2
  const expectedRoles =
    request.currentStep > 1 && request.escalatorRoles && request.escalatorRoles.length > 0
      ? request.escalatorRoles
      : request.requiredCheckerRoles;

  const step1ReviewerLog = request.decisionLog.find((d) => d.action === 'Reviewed (Step 1)');
  if (
    request.currentStep > 1 &&
    step1ReviewerLog &&
    ((actorId && step1ReviewerLog.actorId === actorId) || step1ReviewerLog.persona === role)
  ) {
    return {
      allowed: false,
      reason:
        'Multi-step separation of duties: Step 1 reviewer cannot also complete Step 2 escalation approval.',
    };
  }

  const assistantEligible =
    role === 'Assistant Manager' &&
    request.currentStep === 1 &&
    ['Unit Renumbering', 'Maintenance Cost', 'Lease Exception'].includes(request.category);

  const hasDirectRole = expectedRoles.includes(role) || assistantEligible;
  const hasDelegatedRole =
    actorId &&
    activeDelegations.some(
      (del) =>
        del.status === 'Active' &&
        del.ownerId === request.ownerId &&
        del.delegateActorId === actorId &&
        expectedRoles.includes(del.delegatorRole)
    );

  if (!hasDirectRole && !hasDelegatedRole) {
    return {
      allowed: false,
      reason: `Step ${request.currentStep}/${request.totalSteps} requires checker role: ${expectedRoles.join(' or ')}.`,
    };
  }

  return {
    allowed: true,
    reason:
      hasDelegatedRole && !hasDirectRole
        ? 'Authorized via active owner-approved temporary delegation.'
        : `Authorized checker for Step ${request.currentStep} of ${request.totalSteps}.`,
  };
}

export function canSwitchOwnerForRole(role: PersonaRole): {
  canSwitch: boolean;
  allowedOwners: OwnerId[];
  note: string;
} {
  if (role === 'Owner / Director') {
    return {
      canSwitch: false,
      allowedOwners: ['OWN-ALPHA'],
      note: 'Owner / Director session is isolated strictly to Test Owner Alpha.',
    };
  }
  return {
    canSwitch: true,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    note: 'Can inspect one owner context at a time; cross-owner mixing is strictly prohibited.',
  };
}

export interface ModuleAccessInfo {
  enabled: boolean;
  accessMode: 'Full' | 'Maker' | 'Checker' | 'Read Only' | 'Prohibited';
  reason: string;
}

export function getModuleAccess(role: PersonaRole, section: NavSection): ModuleAccessInfo {
  // Always accessible reference & training modules
  if (
    section === 'dashboard' ||
    section === 'training-exercises' ||
    section === 'system-demonstration' ||
    section === 'security-architecture' ||
    section === 'visual-qa' ||
    section === 'governance' ||
    section === 'requirements-acceptance' ||
    section === 'reports'
  ) {
    return {
      enabled: true,
      accessMode: role === 'Auditor / Read-only reviewer' ? 'Read Only' : 'Full',
      reason: 'Reference, reporting, and training verification scope.',
    };
  }

  if (role === 'System Administrator') {
    if (['admin', 'backup-recovery', 'migration', 'audit'].includes(section)) {
      return {
        enabled: true,
        accessMode: section === 'audit' ? 'Read Only' : 'Maker',
        reason: 'IT & security configuration / read-only audit inspection.',
      };
    }
    if (section === 'approvals') {
      return {
        enabled: true,
        accessMode: 'Read Only',
        reason: 'May track own Role Assignment submissions; all Checker approvals are disabled.',
      };
    }
    return {
      enabled: false,
      accessMode: 'Prohibited',
      reason: 'System Administrator is restricted from operational property, collections, finance, and tax workflows.',
    };
  }

  if (role === 'Collections Clerk') {
    if (['collections', 'tenants-leases', 'approvals'].includes(section)) {
      return {
        enabled: true,
        accessMode: section === 'collections' ? 'Maker' : 'Read Only',
        reason: 'Receivables collection and receipt void request scope.',
      };
    }
    if (['portfolio', 'owners'].includes(section)) {
      return { enabled: true, accessMode: 'Read Only', reason: 'Read-only unit/owner lookup.' };
    }
    return {
      enabled: false,
      accessMode: 'Prohibited',
      reason: 'Collections Clerk cannot access accounting, tax drafts, administration, or audit administration.',
    };
  }

  if (role === 'Property Clerk') {
    if (['portfolio', 'rental-applications', 'tenants-leases', 'maintenance', 'approvals'].includes(section)) {
      return {
        enabled: true,
        accessMode: section === 'approvals' ? 'Read Only' : 'Maker',
        reason: 'Leasing, unit intake, and maintenance maker scope.',
      };
    }
    if (['owners', 'collections'].includes(section)) {
      return { enabled: true, accessMode: 'Read Only', reason: 'Read-only visibility.' };
    }
    return {
      enabled: false,
      accessMode: 'Prohibited',
      reason: 'Property Clerk cannot access finance ledgers, tax drafts, or security administration.',
    };
  }

  if (role === 'Clerk') {
    if (['portfolio', 'rental-applications', 'tenants-leases', 'collections', 'maintenance', 'approvals'].includes(section)) {
      return {
        enabled: true,
        accessMode: section === 'approvals' ? 'Read Only' : 'Maker',
        reason: 'SRS baseline Clerk front-office intake & maker submissions.',
      };
    }
    if (['owners'].includes(section)) {
      return { enabled: true, accessMode: 'Read Only', reason: 'Read-only owner summary.' };
    }
    return {
      enabled: false,
      accessMode: 'Prohibited',
      reason: 'Baseline Clerk role cannot access finance design, tax configuration, RBAC admin, or backup drills.',
    };
  }

  if (role === 'Assistant Manager') {
    if (['admin', 'backup-recovery', 'tax'].includes(section)) {
      return {
        enabled: false,
        accessMode: 'Prohibited',
        reason: 'Assistant Manager focuses on leasing, maintenance, and Step-1 operational checks; Tax & Security Admin belong to Finance Officer / GM / Owner.',
      };
    }
    return {
      enabled: true,
      accessMode: ['audit', 'finance'].includes(section) ? 'Read Only' : 'Full',
      reason: 'SRS baseline Assistant Manager operational scope.',
    };
  }

  if (role === 'Finance Officer') {
    if (section === 'admin' || section === 'backup-recovery') {
      return {
        enabled: false,
        accessMode: 'Prohibited',
        reason: 'Finance Officer cannot modify RBAC administration or execute infrastructure backup drills.',
      };
    }
    return {
      enabled: true,
      accessMode: ['collections', 'expenses', 'finance', 'tax', 'compliance', 'migration'].includes(section)
        ? 'Full'
        : 'Read Only',
      reason: 'Finance, tax draft, expense, and void checker scope.',
    };
  }

  if (role === 'Owner / Director') {
    return {
      enabled: true,
      accessMode: section === 'approvals' ? 'Checker' : 'Read Only',
      reason: 'Owner governance & final Step-2 checker within OWN-ALPHA.',
    };
  }

  if (role === 'Auditor / Read-only reviewer') {
    return {
      enabled: true,
      accessMode: 'Read Only',
      reason: 'Independent read-only assurance across owner-isolated modules.',
    };
  }

  return {
    enabled: true,
    accessMode: 'Full',
    reason: 'General operational oversight.',
  };
}

export const DETAILED_PERMISSION_MATRIX: DetailedPermissionRule[] = [
  {
    id: 'PERM-01',
    module: 'Owners & Entities',
    resource: 'Owner Profile / Ownership Transfer',
    action: 'Approve',
    allowedRoles: ['Owner / Director', 'General Manager'],
    prohibitedRoles: ['System Administrator', 'Clerk', 'Property Clerk', 'Collections Clerk', 'Auditor / Read-only reviewer'],
    ownerScope: 'Own context only',
    approvalThreshold: 'Any ownership change (Multi-Step)',
    evidenceRequirement: 'Title deed / board resolution placeholder',
    makerCheckerRule: 'Maker != Checker != Step-2 Escalator (Actor ID enforced)',
    effectiveDate: '2026-01-01',
  },
  {
    id: 'PERM-02',
    module: 'Property Portfolio',
    resource: 'Units & Renumbering',
    action: 'Create Draft',
    allowedRoles: ['Clerk', 'Property Clerk', 'Assistant Manager', 'General Manager'],
    prohibitedRoles: ['System Administrator', 'Collections Clerk', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: 'Renumbering always requires Checker',
    evidenceRequirement: 'Floor plan / unit census evidence ref',
    makerCheckerRule: 'Non-destructive alias preserved',
    effectiveDate: '2026-01-01',
  },
  {
    id: 'PERM-03',
    module: 'Rental Applications',
    resource: 'Applicant Dossier & Conversion',
    action: 'Submit',
    allowedRoles: ['Clerk', 'Property Clerk', 'Assistant Manager', 'General Manager'],
    prohibitedRoles: ['System Administrator', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: 'Assistant Manager / GM / Owner sign-off prior to lease conversion',
    evidenceRequirement: 'Screening checklist & synthetic ID placeholder',
    makerCheckerRule: 'Conversion blocked until application Approved',
    effectiveDate: '2026-11-01',
  },
  {
    id: 'PERM-04',
    module: 'Rent & Collections',
    resource: 'Receipts & Void / Reversal',
    action: 'Reverse',
    allowedRoles: ['Owner / Director', 'General Manager', 'Finance Officer'],
    prohibitedRoles: ['Clerk', 'Collections Clerk', 'System Administrator', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: 'Any receipt >= ETB 1.00 (Synthetic)',
    evidenceRequirement: 'Bank slip / reversal justification ref',
    makerCheckerRule: 'Clerk may only Request Void; never Approve',
    effectiveDate: '2026-01-01',
  },
  {
    id: 'PERM-05',
    module: 'Expenses & Payables',
    resource: 'Expense Request & Payment Proposal',
    action: 'Approve',
    allowedRoles: ['Owner / Director', 'General Manager'],
    prohibitedRoles: ['Finance Officer', 'System Administrator', 'Clerk', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: '> ETB 25,000.00 (Two-Step Synthetic Threshold)',
    evidenceRequirement: 'Supplier invoice placeholder & draft CoA code',
    makerCheckerRule: 'Finance Officer prepares; GM/Owner approves proposal only',
    effectiveDate: '2026-11-01',
  },
  {
    id: 'PERM-06',
    module: 'Maintenance & Complaints',
    resource: 'Work-Order Cost Approval',
    action: 'Approve',
    allowedRoles: ['Owner / Director', 'General Manager', 'Assistant Manager', 'Finance Officer'],
    prohibitedRoles: ['Clerk', 'Property Clerk', 'System Administrator', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: '>= ETB 10,000.00 (Synthetic Placeholder)',
    evidenceRequirement: 'Inspection photo / quote placeholder',
    makerCheckerRule: 'Clerk logs; Assistant Manager/Finance/GM/Owner approves cost',
    effectiveDate: '2026-11-01',
  },
  {
    id: 'PERM-07',
    module: 'Tax & Compliance',
    resource: 'Tax Rule Drafts & Adviser Packs',
    action: 'Configure',
    allowedRoles: ['Finance Officer', 'General Manager'],
    prohibitedRoles: ['System Administrator', 'Clerk', 'Collections Clerk', 'Property Clerk', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: 'Active stage permanently blocked in prototype',
    evidenceRequirement: 'Licensed Ethiopian adviser written opinion',
    makerCheckerRule: 'Requires Adviser Confirmed + Owner Approved',
    effectiveDate: '2026-01-01',
  },
  {
    id: 'PERM-08',
    module: 'Administration & RBAC',
    resource: 'Role Grants & Delegations',
    action: 'Configure',
    allowedRoles: ['System Administrator', 'General Manager'],
    prohibitedRoles: ['Clerk', 'Collections Clerk', 'Property Clerk', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: 'Every role & delegation requires Owner/GM Checker',
    evidenceRequirement: 'HR authorization / signed delegation ref',
    makerCheckerRule: 'System Admin may NEVER approve or self-grant authority',
    effectiveDate: '2026-01-01',
  },
  {
    id: 'PERM-09',
    module: 'Backup & Recovery',
    resource: 'Restore Drill Approval',
    action: 'Submit',
    allowedRoles: ['System Administrator', 'General Manager'],
    prohibitedRoles: ['Clerk', 'Collections Clerk', 'Property Clerk', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: 'Two-Step: GM Review + Owner Sign-off',
    evidenceRequirement: 'Checksum manifest & offline drill plan ref',
    makerCheckerRule: 'System Admin executes drill simulation only after approval',
    effectiveDate: '2026-11-01',
  },
  {
    id: 'PERM-10',
    module: 'Audit & Reports',
    resource: 'Immutable Audit Trail & Exports',
    action: 'Export',
    allowedRoles: [
      'Owner / Director',
      'General Manager',
      'Assistant Manager',
      'Finance Officer',
      'Clerk',
      'Collections Clerk',
      'Property Clerk',
      'System Administrator',
      'Auditor / Read-only reviewer',
      'Training Coordinator',
    ],
    prohibitedRoles: [],
    ownerScope: 'Own context only',
    approvalThreshold: 'Edit/Delete prohibited for ALL roles',
    evidenceRequirement: 'Logged automatically as Simulation audit event',
    makerCheckerRule: 'Append-only immutable log; zero destructive actions',
    effectiveDate: '2026-01-01',
  },
  {
    id: 'PERM-11',
    module: 'Finance Ledger',
    resource: 'Manual Journals, Reversals (PR-25) & Fixed Assets',
    action: 'Reverse',
    allowedRoles: ['Finance Officer', 'General Manager', 'Owner / Director'],
    prohibitedRoles: ['Clerk', 'Collections Clerk', 'Property Clerk', 'System Administrator', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: '> ETB 25,000 requires GM + Owner two-step check',
    evidenceRequirement: 'Reason code & supporting memo ref',
    makerCheckerRule: 'Maker != Checker; append-only mirror reversal leaves original visible',
    effectiveDate: '2026-07-08',
  },
  {
    id: 'PERM-12',
    module: 'Period Close & Reopen',
    resource: '13-Period Fiscal Close & Reopen Controls',
    action: 'Approve',
    allowedRoles: ['General Manager', 'Owner / Director'],
    prohibitedRoles: ['Finance Officer', 'Clerk', 'System Administrator', 'Auditor / Read-only reviewer'],
    ownerScope: 'Authorised owner context',
    approvalThreshold: 'Checklist preparer cannot approve close; Reopen requires GM/Owner',
    evidenceRequirement: '9-step Close Checklist & Trial Balance snapshot',
    makerCheckerRule: 'Closed period blocks back-dated entries across UI, SQLite & Django triggers',
    effectiveDate: '2026-07-08',
  },
];

export const SOD_CONFLICT_MATRIX: SodConflictRow[] = [
  {
    id: 'SOD-01',
    roleA: 'Any Maker Actor ID',
    roleB: 'Checker / Escalator Actor ID (Same Request)',
    conflictArea: 'Self-Approval Across Role or Prior Action',
    severity: 'Critical',
    controlRule: 'Blocked by actorId !== makerActorId check; mid-session role switching is prohibited.',
  },
  {
    id: 'SOD-02',
    roleA: 'System Administrator',
    roleB: 'Business, Tax, Accounting, or Role Approval',
    conflictArea: 'IT Privilege Escalation',
    severity: 'Critical',
    controlRule: 'System Admin cannot approve any workflow request or grant business authority.',
  },
  {
    id: 'SOD-03',
    roleA: 'Clerk / Collections Clerk',
    roleB: 'Receipt Void / Reversal Checker',
    conflictArea: 'Cash / Receipt Misappropriation Risk',
    severity: 'Critical',
    controlRule: 'Clerk can request void/reversal; Finance Officer, GM, or Owner must approve.',
  },
  {
    id: 'SOD-04',
    roleA: 'Finance Officer (CoA / Tax Maker)',
    roleB: 'CoA / Tax / Expense Approval',
    conflictArea: 'Accounting & Tax Rule Integrity',
    severity: 'High',
    controlRule: 'Finance Officer drafts CoA, tax placeholders, and expense proposals; GM/Owner reviews.',
  },
  {
    id: 'SOD-05',
    roleA: 'Auditor / Read-only reviewer',
    roleB: 'Any Create / Edit / Submit / Approve Action',
    conflictArea: 'Assurance Independence',
    severity: 'High',
    controlRule: 'All operational & approval mutation buttons remain disabled for Auditor.',
  },
];

export interface PermissionMatrixRow {
  capability: string;
  module: string;
  roles: Record<PersonaRole, 'Full' | 'Maker Only' | 'Checker' | 'Read Only' | 'Prohibited'>;
}

export const PERMISSION_MATRIX: PermissionMatrixRow[] = [
  {
    capability: 'Portfolio & Unit Registration',
    module: 'Property Portfolio',
    roles: {
      'Owner / Director': 'Read Only',
      'General Manager': 'Full',
      'Assistant Manager': 'Full',
      'Finance Officer': 'Read Only',
      Clerk: 'Full',
      'Collections Clerk': 'Read Only',
      'Property Clerk': 'Full',
      'System Administrator': 'Prohibited',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
  {
    capability: 'Unit Renumbering / Ownership Change',
    module: 'Property Portfolio',
    roles: {
      'Owner / Director': 'Checker',
      'General Manager': 'Full',
      'Assistant Manager': 'Checker',
      'Finance Officer': 'Read Only',
      Clerk: 'Maker Only',
      'Collections Clerk': 'Prohibited',
      'Property Clerk': 'Maker Only',
      'System Administrator': 'Prohibited',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
  {
    capability: 'Rental Applications & Lease Conversion',
    module: 'Rental Applications',
    roles: {
      'Owner / Director': 'Checker',
      'General Manager': 'Full',
      'Assistant Manager': 'Full',
      'Finance Officer': 'Read Only',
      Clerk: 'Maker Only',
      'Collections Clerk': 'Read Only',
      'Property Clerk': 'Maker Only',
      'System Administrator': 'Prohibited',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
  {
    capability: 'Payment Recording & Compliance Previews',
    module: 'Rent & Collections',
    roles: {
      'Owner / Director': 'Read Only',
      'General Manager': 'Full',
      'Assistant Manager': 'Read Only',
      'Finance Officer': 'Full',
      Clerk: 'Full',
      'Collections Clerk': 'Full',
      'Property Clerk': 'Read Only',
      'System Administrator': 'Prohibited',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
  {
    capability: 'Receipt Void / Reversal Approval',
    module: 'Rent & Collections',
    roles: {
      'Owner / Director': 'Checker',
      'General Manager': 'Checker',
      'Assistant Manager': 'Read Only',
      'Finance Officer': 'Checker',
      Clerk: 'Maker Only',
      'Collections Clerk': 'Maker Only',
      'Property Clerk': 'Prohibited',
      'System Administrator': 'Prohibited',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
  {
    capability: 'Expenses, Payables & Maintenance Costs',
    module: 'Expenses & Maintenance',
    roles: {
      'Owner / Director': 'Checker',
      'General Manager': 'Checker',
      'Assistant Manager': 'Checker',
      'Finance Officer': 'Maker Only',
      Clerk: 'Maker Only',
      'Collections Clerk': 'Prohibited',
      'Property Clerk': 'Maker Only',
      'System Administrator': 'Prohibited',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
  {
    capability: 'Tax Drafts, CoA Design & Compliance Packs',
    module: 'Finance, Tax & Compliance',
    roles: {
      'Owner / Director': 'Checker',
      'General Manager': 'Checker',
      'Assistant Manager': 'Prohibited',
      'Finance Officer': 'Maker Only',
      Clerk: 'Prohibited',
      'Collections Clerk': 'Prohibited',
      'Property Clerk': 'Prohibited',
      'System Administrator': 'Prohibited',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
  {
    capability: 'Role Assignment, Delegations & Drills',
    module: 'Administration & Backup',
    roles: {
      'Owner / Director': 'Checker',
      'General Manager': 'Checker',
      'Assistant Manager': 'Prohibited',
      'Finance Officer': 'Read Only',
      Clerk: 'Prohibited',
      'Collections Clerk': 'Prohibited',
      'Property Clerk': 'Prohibited',
      'System Administrator': 'Maker Only',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
  {
    capability: 'Immutable Audit Trail Inspection',
    module: 'Audit Trail',
    roles: {
      'Owner / Director': 'Read Only',
      'General Manager': 'Read Only',
      'Assistant Manager': 'Read Only',
      'Finance Officer': 'Read Only',
      Clerk: 'Prohibited',
      'Collections Clerk': 'Prohibited',
      'Property Clerk': 'Prohibited',
      'System Administrator': 'Read Only',
      'Auditor / Read-only reviewer': 'Read Only',
      'Training Coordinator': 'Read Only',
    },
  },
];
