export type PersonaRole =
  | 'Owner / Director'
  | 'General Manager'
  | 'Assistant Manager'
  | 'Finance Officer'
  | 'Clerk'
  | 'Collections Clerk'
  | 'Property Clerk'
  | 'System Administrator'
  | 'Auditor / Read-only reviewer'
  | 'Training Coordinator';

export type NavSection =
  | 'dashboard'
  | 'owners'
  | 'portfolio'
  | 'rental-applications'
  | 'tenants-leases'
  | 'collections'
  | 'expenses'
  | 'maintenance'
  | 'finance'
  | 'tax'
  | 'compliance'
  | 'approvals'
  | 'audit'
  | 'admin'
  | 'backup-recovery'
  | 'migration'
  | 'reports'
  | 'requirements-acceptance'
  | 'training-exercises'
  | 'system-demonstration'
  | 'security-architecture'
  | 'visual-qa'
  | 'governance';

export type OwnerId = 'OWN-ALPHA' | 'OWN-BETA';

export type Cents = number & { readonly __brand: unique symbol };

export function asCents(value: number): Cents {
  return Math.round(Number(value) || 0) as Cents;
}

export function centsToNumber(cents: Cents | number): number {
  return Number(cents) || 0;
}

export type ApprovalPayload =
  | { kind: 'PeriodClose'; periodCode: string }
  | { kind: 'PeriodReopen'; periodCode: string; reason?: string }
  | {
      kind: 'ManualJournal';
      entryDate: string;
      periodCode: string;
      description: string;
      lines: { accountCode: string; debitEtb: number; creditEtb: number; description?: string }[];
    }
  | { kind: 'Generic'; [key: string]: unknown };

export type DateDisplayMode = 'gregorian' | 'ethiopic' | 'dual';

export type LifecycleStatus =
  | 'Draft'
  | 'Submitted'
  | 'Reviewed'
  | 'Approved'
  | 'Active'
  | 'Retired';

export type TaxLifecycleStage =
  | 'Draft'
  | 'Submitted for Review'
  | 'Adviser Confirmed'
  | 'Owner Approved'
  | 'Active';

export type UnitStatus =
  | 'Vacant'
  | 'Occupied'
  | 'Maintenance'
  | 'Reserved'
  | 'Inactive';

export type LeaseStatus =
  | 'Draft'
  | 'Active'
  | 'Expiring Soon'
  | 'Renewed'
  | 'Terminated';

export type ApprovalStatus =
  | 'Pending My Review'
  | 'Submitted by Me'
  | 'In Review'
  | 'Approved'
  | 'Rejected'
  | 'Returned'
  | 'Expired'
  | 'Cancelled'
  | 'Superseded';

export type ApprovalWorkflowStatus =
  | 'Pending'
  | 'In Review'
  | 'Approved'
  | 'Rejected'
  | 'Returned'
  | 'Expired'
  | 'Cancelled'
  | 'Superseded';

export type ApprovalWorkflowMode = 'One-Step' | 'Two-Step' | 'Multi-Step';

export type ApprovalCategory =
  | 'Unit Renumbering'
  | 'Ownership Change'
  | 'Lease Exception'
  | 'Account Change'
  | 'Tax Rule Review'
  | 'Compliance Decision'
  | 'Adviser Pack'
  | 'Receipt Void / Reversal'
  | 'Expense / Payment Proposal'
  | 'Maintenance Cost'
  | 'Role Assignment'
  | 'Temporary Delegation'
  | 'Backup Restore Drill'
  | 'Migration Exception'
  | 'Period Close'
  | 'Period Reopen'
  | 'Deposit Refund / Deduction'
  | 'Manual Journal'
  | 'Bad-Debt Write-Off'
  | 'Owner Draw';

export type PaymentMethod =
  | 'Cash'
  | 'Bank Transfer'
  | 'Cheque'
  | 'Telebirr (Synthetic)'
  | 'ArifPay (Synthetic)';

export type ReceiptDocumentState =
  | 'Draft'
  | 'Issued — Demo Only'
  | 'Void Requested'
  | 'Reversal Pending'
  | 'Reversed';

export type EvidenceStatusType =
  | 'Primary source identified'
  | 'Secondary source only'
  | 'Conflicting research'
  | 'Adviser confirmation required'
  | 'Owner decision required';

export interface DemoPersonaProfile {
  role: PersonaRole;
  displayName: string;
  syntheticId: string;
  department: string;
  summary: string;
  canSwitchOwner: boolean;
  defaultOwnerId: OwnerId;
  approvalAuthorities: string[];
  restrictions: string[];
}

export interface TrainingAccount {
  id: string;
  username: string;
  tempPasswordPlaceholder: string;
  displayName: string;
  role: PersonaRole;
  actorId: string;
  ownerScopeLabel: string;
  allowedOwners: OwnerId[];
  defaultOwnerId: OwnerId;
  accountStatus: 'Active Training Account' | 'Trainer Only';
  isTrainer?: boolean;
  classification: 'SRS Baseline Internal Role' | 'Governance / Configurable Template' | 'Training Facilitation';
}

export interface RoleAuthoritySpec {
  role: PersonaRole;
  classification: 'SRS v1.1 Baseline Internal Role' | 'Configurable Role Template' | 'Training Facilitation Role';
  responsibilities: string;
  permittedActions: string;
  prohibitedActions: string;
  ownerScope: string;
  approvalAuthority: string;
  sodConflicts: string;
  effectiveDates: string;
  delegationEligibility: string;
  requiredEvidence: string;
  auditRequirements: string;
}

export interface TrainingExercise {
  id: string;
  number: number;
  title: string;
  titleAm: string;
  recommendedUsername: string;
  recommendedRole: PersonaRole;
  secondaryCheckerUsername?: string;
  secondaryCheckerRole?: PersonaRole;
  targetSection: NavSection;
  objective: string;
  objectiveAm: string;
  startingCondition: string;
  startingConditionAm: string;
  steps: { en: string; am: string }[];
  expectedOutcome: string;
  expectedOutcomeAm: string;
  failedControlExplanation: string;
  failedControlExplanationAm: string;
  auditMatchKeywords: string[];
}

export interface RoleCatalogEntry {
  id: string;
  slotNumber: number;
  roleName: string;
  classification: 'SRS Baseline Internal' | 'Configurable Template' | 'Unconfigured Slot';
  configured: boolean;
  personaRole?: PersonaRole;
  ownerDecisionRequired: string;
  businessAuthority: string;
}

export interface SimulatedSession {
  actorId: string;
  actorName: string;
  username: string;
  assignedRoles: PersonaRole[];
  activeOwnerScope: OwnerId;
  sessionStartTime: string;
  sessionExpiryTime: string;
  activeDelegationId?: string;
  isTrainer?: boolean;
}

export type RbacActionVerb =
  | 'View'
  | 'Create Draft'
  | 'Edit Draft'
  | 'Submit'
  | 'Approve'
  | 'Reject'
  | 'Return'
  | 'Void'
  | 'Reverse'
  | 'Export'
  | 'Configure';

export interface DetailedPermissionRule {
  id: string;
  module: string;
  resource: string;
  action: RbacActionVerb;
  allowedRoles: PersonaRole[];
  prohibitedRoles: PersonaRole[];
  ownerScope: 'Own context only' | 'Authorised owner context' | 'Prohibited';
  approvalThreshold: string;
  evidenceRequirement: string;
  makerCheckerRule: string;
  effectiveDate: string;
}

export interface DelegationRecord {
  id: string;
  ownerId: OwnerId;
  delegatorActorId: string;
  delegatorName: string;
  delegatorRole: PersonaRole;
  delegateActorId: string;
  delegateName: string;
  delegateRole: PersonaRole;
  scopeModules: string;
  startDate: string;
  endDate: string;
  status: 'Pending Owner Approval' | 'Active' | 'Expired' | 'Revoked';
  ownerApprovalRef: string;
  evidenceRef: string;
}

export interface SodConflictRow {
  id: string;
  roleA: string;
  roleB: string;
  conflictArea: string;
  severity: 'Critical' | 'High';
  controlRule: string;
}

export interface QuarterlyAccessReviewItem {
  id: string;
  ownerId: OwnerId;
  reviewQuarter: string;
  userId: string;
  userName: string;
  assignedRoles: PersonaRole[];
  ownerScope: string;
  reviewStatus: 'Pending Review' | 'Attested (Simulation)' | 'Exception Flagged';
  reviewedBy?: string;
  reviewedAt?: string;
  note: string;
}

export interface OwnerVersion {
  version: number;
  effectiveDate: string;
  status: LifecycleStatus;
  changedBy: string;
  evidenceRef: string;
  summary: string;
}

export interface OwnerEntity {
  id: OwnerId;
  code: string;
  name: string;
  entityType: 'Individual Proprietor (Synthetic)' | 'Private Limited Placeholder (Synthetic)';
  status: LifecycleStatus;
  effectiveDate: string;
  tinPlaceholder: string;
  vatRegPlaceholder: string;
  addressPlaceholder: string;
  contactPlaceholder: string;
  emailPlaceholder: string;
  evidenceRef: string;
  version: number;
  versions: OwnerVersion[];
}

export interface PropertyRecord {
  id: string;
  ownerId: OwnerId;
  code: string;
  name: string;
  addressCard: {
    subCity: string;
    woreda: string;
    streetPlaceholder: string;
    landmarkPlaceholder: string;
    geoNote: string;
  };
  propertyType: 'Mixed-Use Commercial' | 'Commercial Office';
  status: LifecycleStatus;
  effectiveDate: string;
  evidenceRef: string;
}

export interface BuildingRecord {
  id: string;
  ownerId: OwnerId;
  propertyId: string;
  code: string;
  name: string;
  floors: number;
  status: LifecycleStatus;
  yearBuiltPlaceholder: string;
}

export interface UnitHistoryEntry {
  id: string;
  date: string;
  type: 'Created' | 'Renumbered' | 'Status Change' | 'Lease Assigned' | 'Maintenance';
  previousIdentifier?: string;
  newIdentifier?: string;
  detail: string;
  actor: string;
  evidenceRef: string;
}

export interface UnitRecord {
  id: string;
  ownerId: OwnerId;
  propertyId: string;
  buildingId: string;
  code: string;
  name: string;
  floor: number;
  areaSqm: number;
  unitType: 'Retail Ground' | 'Office Suite' | 'Commercial Hall';
  status: UnitStatus;
  baseRentEtb: number;
  previousIdentifiers: string[];
  currentTenantId?: string;
  currentLeaseId?: string;
  history: UnitHistoryEntry[];
}

export interface TenantRecord {
  id: string;
  ownerId: OwnerId;
  code: string;
  name: string;
  businessType: string;
  phonePlaceholder: string;
  emailPlaceholder: string;
  emergencyContactPlaceholder: string;
  idPlaceholder: string;
  documentPlaceholders: {
    id: string;
    label: string;
    refCode: string;
    status: 'Placeholder Only' | 'Synthetic Verified';
  }[];
  status: 'Active' | 'Former';
}

export interface LeaseRentScheduleItem {
  period: string;
  dueDate: string;
  amountEtb: number;
  status: 'Paid' | 'Partially Paid' | 'Overdue' | 'Scheduled';
}

export interface OromifaContractData {
  contractDateEc: string;
  landlordTitleAndName: string;
  landlordAddress: string;
  landlordPhone: string;
  landlordTin: string;
  landlordVat: string;
  tenantTitleAndName: string;
  tenantAddress: string;
  tenantPhone: string;
  tenantTin: string;
  tenantVat: string;
  tenantTradeLicense: string;
  propertyLocation: string;
  parcelUniqueNo: string;
  registrationDateEc: string;
  unitRoomLabel: string;
  businessPurpose: string;
  startDateEc: string;
  endDateEc: string;
  durationText: string;
  advanceMonths: number;
  baseMonthlyRentEtb: number;
  vatRatePercent: number;
  vatAmountEtb: number;
  grossMonthlyRentEtb: number;
  advanceBaseTotalEtb: number;
  advanceVatTotalEtb: number;
  advanceGrandTotalEtb: number;
  advanceGrandTotalWordsOm: string;
  bankName: string;
  bankAccountNumber: string;
  nextCycleNoticeDays: number;
  dailyPenaltyPercent: number;
  evictionNoticeMonths: number;
  terminationNoticeLandlordMonths: number;
  terminationNoticeTenantMonths: number;
  forceMajeureMaxDays: number;
  utilityDepositEtb: number;
  utilityDepositWordsOm: string;
  breachPenaltyEtb: number;
  breachPenaltyWordsOm: string;
  witness1: string;
  witness2: string;
  witness3: string;
  signatureLandlordName: string;
  signatureTenantName: string;
}

export interface OromifaContractTemplate {
  id: string;
  ownerId: OwnerId;
  templateName: string;
  description: string;
  updatedAt: string;
  data: OromifaContractData;
}

export interface LeaseRecord {
  id: string;
  ownerId: OwnerId;
  leaseNumber: string;
  version: number;
  supersedesLeaseId?: string;
  supersededByLeaseId?: string;
  unitId: string;
  tenantId: string;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  monthlyRentEtb: number;
  securityDepositEtb: number;
  billingCycle: 'Monthly' | 'Quarterly';
  createdBy: string;
  evidenceRef: string;
  notes: string;
  contractLanguage?: 'en' | 'am' | 'om';
  oromifaContract?: OromifaContractData;
  schedule: LeaseRentScheduleItem[];
  timeline: {
    date: string;
    event: string;
    actor: string;
  }[];
}

export interface ChargeRecord {
  id: string;
  ownerId: OwnerId;
  leaseId: string;
  tenantId: string;
  unitId: string;
  period: string;
  invoiceNumber: string;
  dueDate: string;
  billedEtb: number;
  paidEtb: number;
  status: 'Paid' | 'Partially Paid' | 'Overdue' | 'Open';
}

export interface ReceiptHistoryEntry {
  timestamp: string;
  event: string;
  actor: string;
  state: ReceiptDocumentState;
}

export interface PaymentReceipt {
  id: string;
  ownerId: OwnerId;
  receiptNumber: string;
  tenantId: string;
  unitId: string;
  paymentDate: string;
  amountEtb: number;
  method: PaymentMethod;
  referencePlaceholder: string;
  recordedBy: string;
  allocations: {
    chargeId: string;
    invoiceNumber: string;
    allocatedEtb: number;
  }[];
  documentState: ReceiptDocumentState;
  lineDescription: string;
  taxableStatusPlaceholder: string;
  taxTreatmentPlaceholder: string;
  retentionClassPlaceholder: string;
  history: ReceiptHistoryEntry[];
}

export interface AccountVersion {
  version: number;
  effectiveDate: string;
  status: LifecycleStatus;
  name: string;
  changedBy: string;
  evidenceRef: string;
  note: string;
}

export interface ChartOfAccount {
  id: string;
  ownerId: OwnerId;
  code: string;
  name: string;
  category: 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Expenses';
  status: LifecycleStatus;
  effectiveDate: string;
  version: number;
  ownerDimensionRequired: true;
  designTag: 'Draft accounting design — professional review required.';
  description: string;
  versions: AccountVersion[];
  normalBalance?: 'Debit' | 'Credit';
  subCategory?: string;
  taxDeductibleClass?: 'Deductible' | 'Partially Deductible' | 'Non-Deductible' | 'Capital' | 'Exempt' | 'N/A';
  isTaxLocked?: boolean;
  isSystemControlled?: boolean;
  parentAccountCode?: string;
}

export interface AccountingPolicyItem {
  id: string;
  ownerId: OwnerId;
  topic: string;
  proposedTreatment: string;
  reviewStatus: 'Professional review required';
  postingAvailability: 'No production posting available';
  notes: string;
}

export interface PrototypeJournalEntry {
  id: string;
  ownerId: OwnerId;
  journalNumber: string;
  date: string;
  description: string;
  status: 'Prototype / Planned Capability';
  complianceNote: string;
  lines: {
    accountCode: string;
    accountName: string;
    debitEtb: number;
    creditEtb: number;
  }[];
}

export interface TaxRuleVersionSnapshot {
  version: number;
  effectiveDateFrom: string;
  effectiveDateTo: string;
  ratePlaceholder: string;
  taxableStatus: 'Undetermined' | 'Taxable (Unverified)' | 'Exempt (Unverified)';
  lifecycleStage: TaxLifecycleStage;
  sourceReference: string;
  adviserEvidence: string;
  ownerApprovalReference: string;
  changedBy: string;
  note: string;
}

export interface TaxRuleRecord {
  id: string;
  ownerId: OwnerId;
  code: string;
  taxCategory: string;
  propertyUseClassification: 'Commercial (Placeholder)' | 'Residential (Placeholder)' | 'Mixed-Use (Unclassified)';
  ownerEntityCategory: string;
  taxableStatus: 'Undetermined' | 'Taxable (Unverified)' | 'Exempt (Unverified)';
  ratePlaceholder: string;
  lifecycleStage: TaxLifecycleStage;
  effectiveDateFrom: string;
  effectiveDateTo: string;
  sourceReference: string;
  adviserEvidence: string;
  ownerApprovalReference: string;
  hasResearchConflict: boolean;
  conflictNotice?: string;
  notes: string;
  version: number;
  createdBy: string;
  versions: TaxRuleVersionSnapshot[];
}

export interface ResearchRequirementRecord {
  id: string;
  ownerId: OwnerId;
  requirementId: string;
  topic: string;
  proposedProductControl: string;
  evidenceStatus: EvidenceStatusType;
  sourceType: string;
  effectiveDateField: string;
  adviserReviewStatus: 'Pending Adviser Review' | 'Unverified — Ethiopian licensed adviser confirmation required.';
  ownerApprovalStatus: 'Pending Owner Decision' | 'Not Submitted';
  productionActivationStatus: 'Blocked';
  notes: string;
}

export interface SourceRecordCard {
  id: string;
  ownerId: OwnerId;
  title: string;
  sourceType: string;
  publicationDateField: string;
  verificationDateField: string;
  reviewer: string;
  confidence: 'Primary Reference (Pending Legal Review)' | 'Official-Source Verification Required' | 'Adviser Verification Required';
  unverifiedLabel?: string;
  notes: string;
  scopeSummary: string;
}

export interface AdviserReviewQuestion {
  id: string;
  ownerId: OwnerId;
  question: string;
  impact: string;
  risk: 'High' | 'Critical' | 'Medium';
  assignedReviewerPlaceholder: string;
  evidenceRequired: string;
  decisionDueDatePlaceholder: string;
  status: 'Unresolved — Adviser Required' | 'Adviser Pack Prepared (Sim)' | 'Submitted for Owner Decision (Sim)';
  unverifiedNotice: string;
}

export interface ProductionGateItem {
  id: string;
  ownerId: OwnerId;
  group:
    | 'Tax professional sign-off'
    | 'Accounting professional sign-off'
    | 'Legal entity decision'
    | 'Owner approval'
    | 'Property evidence'
    | 'Unit census'
    | 'Opening balances'
    | 'Authority matrix'
    | 'Infrastructure/deployment';
  title: string;
  status: 'Blocked' | 'Pending' | 'Not Started';
  requiredEvidence: string;
  requiredApproval: string;
  blockingReason: string;
}

export interface RetentionClassRecord {
  id: string;
  ownerId: OwnerId;
  recordClassCode: string;
  recordType:
    | 'Leases'
    | 'Receipts'
    | 'Invoices'
    | 'Payment evidence'
    | 'Approvals'
    | 'Audit events'
    | 'Tax configuration'
    | 'Property evidence'
    | 'Financial reports';
  configuredDuration: 'Retention duration pending professional confirmation';
  researchReferenceNote: string;
  legalHoldState: 'None (Placeholder)' | 'Legal Hold Placeholder Active (Simulated)';
  enforcementNote: string;
}

export interface ApprovalDecisionLog {
  timestamp: string;
  actor: string;
  actorId?: string;
  persona: PersonaRole;
  action:
    | 'Submitted'
    | 'Reviewed (Step 1)'
    | 'Escalated'
    | 'Reminder Logged'
    | 'Approved'
    | 'Rejected'
    | 'Returned'
    | 'Expired'
    | 'Cancelled'
    | 'Superseded';
  comment: string;
}

export interface ApprovalEvidenceChecklistItem {
  id: string;
  label: string;
  verifiedPlaceholder: boolean;
}

export interface ApprovalRequest {
  id: string;
  ownerId: OwnerId;
  requestNumber: string;
  category: ApprovalCategory;
  title: string;
  targetRecordType: string;
  targetRecordId: string;
  makerActorId: string;
  makerName: string;
  makerPersona: PersonaRole;
  workflowMode: ApprovalWorkflowMode;
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  requiredCheckerRoles: PersonaRole[];
  escalatorRoles?: PersonaRole[];
  reviewerRoles?: PersonaRole[];
  amountThresholdPlaceholder: string;
  dueDate: string;
  expiryDate: string;
  reminderSentPlaceholder?: boolean;
  escalated?: boolean;
  submittedAt: string;
  effectiveDate: string;
  evidenceRef: string;
  evidenceChecklist: ApprovalEvidenceChecklistItem[];
  reason: string;
  status: ApprovalWorkflowStatus;
  finalized: boolean;
  supersededByRequestId?: string;
  supersedesRequestId?: string;
  beforeValues: Record<string, string | number>;
  afterValues: Record<string, string | number>;
  payload: Record<string, unknown>;
  decisionLog: ApprovalDecisionLog[];
}

export interface AuditEvent {
  id: string;
  ownerId: OwnerId;
  timestamp: string;
  actor: string;
  actorId?: string;
  persona: PersonaRole;
  executionMode: 'Simulation';
  module:
    | 'Executive Dashboard'
    | 'Owners & Entities'
    | 'Property Portfolio'
    | 'Rental Applications'
    | 'Tenants & Leases'
    | 'Rent & Collections'
    | 'Expenses & Payables'
    | 'Maintenance & Complaints'
    | 'Finance'
    | 'Tax Configuration'
    | 'Compliance Readiness'
    | 'Approvals Centre'
    | 'Administration'
    | 'Security & Access'
    | 'Backup & Recovery'
    | 'Migration Readiness'
    | 'Requirements & Acceptance'
    | 'Training Exercises'
    | 'Reports';
  action: string;
  recordType: string;
  recordId: string;
  reason: string;
  evidenceRef?: string;
  linkedApprovalId?: string;
  beforeValues?: Record<string, string | number | boolean | null>;
  afterValues?: Record<string, string | number | boolean | null>;
}

export interface AdminUserRecord {
  id: string;
  actorId: string;
  name: string;
  syntheticHandle: string;
  assignedRoles: PersonaRole[];
  ownerScope: string;
  status: 'Active' | 'Pending Role Approval';
  lastSessionPlaceholder: string;
}

export interface ConfigRuleRecord {
  id: string;
  group: 'Session & Security' | 'Approval Rules' | 'Numbering Configuration';
  key: string;
  value: string;
  status: 'Active' | 'Draft';
  effectiveDate: string;
  description: string;
}

export interface AppNotification {
  id: string;
  ownerId: OwnerId;
  title: string;
  detail: string;
  targetSection: NavSection;
  timestamp: string;
  read: boolean;
}

// Section F: 5 Planned Business Modules
export interface RentalApplicationRecord {
  id: string;
  ownerId: OwnerId;
  applicationNumber: string;
  applicantName: string;
  businessType: string;
  requestedUnitId: string;
  appliedDate: string;
  proposedRentEtb: number;
  documentPlaceholders: { label: string; refCode: string }[];
  screeningChecklist: { id: string; item: string; status: 'Pending' | 'Verified Placeholder' | 'Flagged' }[];
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Converted to Lease (Draft)';
  convertedLeaseId?: string;
  evidenceRef: string;
  notes: string;
}

export interface ExpensePayableRecord {
  id: string;
  ownerId: OwnerId;
  requestNumber: string;
  supplierPlaceholder: string;
  description: string;
  accountCode: string;
  accountName: string;
  amountEtb: number;
  invoiceEvidenceRef: string;
  requestedDate: string;
  dueDate: string;
  status: 'Draft' | 'Pending Approval' | 'Approved — Payment Proposal Only' | 'Rejected';
  paymentProposalRef?: string;
  createdByActorId: string;
  notes: string;
}

export interface MaintenanceTicketRecord {
  id: string;
  ownerId: OwnerId;
  ticketNumber: string;
  unitId: string;
  tenantId?: string;
  category: 'Maintenance' | 'Complaint';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  title: string;
  description: string;
  reportedDate: string;
  estimatedCostEtb: number;
  workOrderState: 'Logged' | 'Assessed' | 'Cost Approval Pending' | 'Scheduled' | 'Completed (Sim)' | 'Closed';
  unitMaintenanceStatusApplied: boolean;
  evidenceRef: string;
  timeline: { timestamp: string; event: string; actor: string }[];
}

export interface BackupPolicyRecord {
  id: string;
  ownerId: OwnerId;
  policyCode: string;
  scheduleLabel: string;
  rpoPlaceholder: string;
  rtoPlaceholder: string;
  storageNote: string;
  approvalStatus: 'Draft — Unapproved';
}

export interface BackupDrillRecord {
  id: string;
  ownerId: OwnerId;
  drillNumber: string;
  requestedDate: string;
  drillScope: string;
  status: 'Planned' | 'Approval Pending' | 'Approved Drill (Sim)' | 'Completed (Sim)';
  evidenceChecklist: { label: string; checked: boolean }[];
  evidenceRef: string;
}

export interface MigrationStagingRecord {
  id: string;
  ownerId: OwnerId;
  batchCode: string;
  sourceEntity: string;
  recordCountPlaceholder: number;
  controlTotalEtbPlaceholder: number;
  validationState: 'Pending Validation' | 'Exception Flagged' | 'Validated Staging (No Real Import)';
  exceptionDetail?: string;
  approvalStatus: 'Not Approved' | 'Approval Pending' | 'Exception Approved (Sim)';
  evidenceRef: string;
}

export interface MigrationMappingRule {
  id: string;
  ownerId: OwnerId;
  sourceField: string;
  targetEntity: string;
  targetField: string;
  validationRule: string;
  mappingStatus: 'Mapped (Synthetic)' | 'Review Required';
}

// Section A: Requirements Coverage & Acceptance Centre
export type RequirementCoverageStatus =
  | 'Demonstrated in prototype'
  | 'Partially demonstrated'
  | 'Planned only'
  | 'Blocked by decision/evidence'
  | 'Not yet designed';

export type RequirementDomain =
  | 'Owner Model'
  | 'Buildings / Floors / Units'
  | 'Tenants / CRM'
  | 'Rental Applications'
  | 'Lease Management'
  | 'Rent Billing'
  | 'Payments / Receipts'
  | 'Deposits / Refunds'
  | 'Double-Entry Accounting'
  | 'Owner Separation'
  | 'Expenses / Payables'
  | 'Tax Workspace'
  | 'Maintenance / Complaints'
  | 'Roles / Permissions'
  | 'Approvals'
  | 'Audit Trail'
  | 'Reports'
  | 'Backup / Recovery'
  | 'Local-First Architecture'
  | 'Migration'
  | 'Testing / Acceptance';

export interface RequirementTraceabilityItem {
  id: string;
  ownerId: OwnerId;
  requirementId: string;
  domain: RequirementDomain;
  title: string;
  sourceDocumentSection: string;
  relatedModule: string;
  targetSection: NavSection;
  prototypeStatus: RequirementCoverageStatus;
  workPackageStatus: string;
  acceptanceScenario: string;
  testPersona: PersonaRole;
  expectedResult: string;
  evidenceRef: string;
  ownerAcceptanceStatus: 'Pending Owner Acceptance' | 'Simulated Test Passed — Awaiting Formal Sign-off' | 'Blocked';
  productionReadinessStatus: 'Blocked' | 'Not Ready';
  lastTestedAt?: string;
  lastTestedBy?: string;
  lastTestOutcome?: 'Pass (Sim)' | 'Blocked (Expected)' | 'Failed';
}

export interface GatewayPaymentRecord {
  id: string;
  ownerId: OwnerId;
  gatewayType: 'Telebirr USSD QR' | 'ArifPay Checkout' | 'CBE Transfer Slip';
  tenantId: string;
  unitId: string;
  chargeId: string;
  amountEtb: number;
  referenceNumber: string;
  status: 'Pending Verification' | 'Verified' | 'Rejected';
  submittedAt: string;
  phoneOrAccount: string;
  notes: string;
  ussdSessionId?: string;
  ussdDialString?: string;
  traceId?: string;
  arifpaySessionId?: string;
  arifpayNonce?: string;
  arifpayMethod?: 'TELEBIRR' | 'CBE';
  receiptId?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export type MobileWorkspaceMode = 'desktop' | 'owner-mobile' | 'tenant-mobile';

export interface TenantPortalAccount {
  id: string;
  username: string;
  tempPasswordPlaceholder: string;
  tenantId: string;
  ownerId: OwnerId;
  displayName: string;
  unitLabel: string;
  msisdnPlaceholder: string;
}

export interface MaintenanceMessageRecord {
  id: string;
  ownerId: OwnerId;
  ticketId: string;
  senderName: string;
  senderRole: 'Tenant' | 'Staff' | 'Owner';
  visibility: 'Shared with Tenant' | 'Internal Staff Note';
  body: string;
  timestamp: string;
}

export interface TenantNoticeRecord {
  id: string;
  ownerId: OwnerId;
  tenantId: string | 'ALL';
  titleEn: string;
  titleAm: string;
  bodyEn: string;
  bodyAm: string;
  category: 'Rent Reminder' | 'Maintenance Advisory' | 'Building Notice' | 'Payment Confirmation';
  publishedAt: string;
  publishedBy: string;
  readByTenantIds: string[];
}

export type SmsTriggerType =
  | 'Rent Due Soon'
  | 'Overdue Reminder'
  | 'Payment Confirmed'
  | 'Maintenance Update'
  | 'General Notice';

export interface SmsDispatchRecord {
  id: string;
  ownerId: OwnerId;
  tenantId: string;
  recipientMsisdn: string;
  triggerType: SmsTriggerType;
  locale: 'en' | 'am';
  messageBody: string;
  deliveryState: 'Queued Offline' | 'Delivered (Sandbox)';
  dispatchedAt: string;
  channelMode: 'SANDBOX DISPATCH — NO LIVE TELCO';
}

export interface TenantNotificationPrefs {
  tenantId: string;
  ownerId: OwnerId;
  smsEnabled: boolean;
  pushEnabled: boolean;
  preferredLocale: 'en' | 'am';
  msisdn: string;
}

export type PaymentReminderChannel = 'Email' | 'Notification' | 'Email & Notification';

export interface PaymentReminderRequestRecord {
  id: string;
  ownerId: OwnerId;
  tenantId: string;
  chargeIds: string[];
  invoiceNumbers: string[];
  totalOpenEtb: number;
  channel: PaymentReminderChannel;
  recipientEmail: string;
  recipientMsisdn?: string;
  note?: string;
  emailSubject: string;
  emailPreviewBody: string;
  notificationBody: string;
  requestedAt: string;
  deliveryStatus: 'Delivered (Sandbox)' | 'Queued Offline';
}

export interface OfflinePendingAction {
  id: string;
  ownerId: OwnerId;
  type: 'payment' | 'maintenance_message' | 'maintenance_ticket' | 'approval' | 'sms';
  label: string;
  queuedAt: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Steps 1–7 Double-Entry Ledger, Sub-Ledgers, Period Close & Versioned Tax Engine
// ============================================================================

export type LedgerBasis = 'Accrual' | 'Cash';
export type AccountingFramework = 'IFRS for SMEs' | 'Full IFRS' | 'Local Books';
export type EthiopianPeriodStatus = 'Open' | 'Closing' | 'Closed' | 'Reopened';

export type PostingRuleId =
  | 'PR-01'
  | 'PR-02'
  | 'PR-03'
  | 'PR-04'
  | 'PR-05'
  | 'PR-06'
  | 'PR-07'
  | 'PR-08'
  | 'PR-09'
  | 'PR-10'
  | 'PR-11'
  | 'PR-12'
  | 'PR-13'
  | 'PR-14'
  | 'PR-15'
  | 'PR-16'
  | 'PR-17'
  | 'PR-18'
  | 'PR-19'
  | 'PR-20'
  | 'PR-21'
  | 'PR-22'
  | 'PR-23'
  | 'PR-24'
  | 'PR-25'
  | 'PR-26'
  | 'PR-27';

export interface OwnerLedgerConfig {
  id: string;
  ownerId: OwnerId;
  ledgerCode: string;
  entityType: 'Individual' | 'Company';
  vatRegistered: boolean;
  withholdingAgent: boolean;
  booksMethodSupported: boolean;
  basis: LedgerBasis;
  framework: AccountingFramework;
  jurisdiction: 'Addis Ababa' | 'Oromia' | 'Regional';
  depositAccountCode: '1030';
  coaVersion: number;
  vatRateBps: number; // e.g., 1500 = 15%
  whtRateBps: number; // e.g., 300 = 3%
  currency: 'ETB';
  enableLiveTaxInvoicing: false;
}

export interface LedgerAccountV2 {
  id: string;
  ownerId: OwnerId;
  code: string;
  name: string;
  nameAm?: string;
  category: 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Expenses';
  subCategory: string;
  normalBalance: 'Debit' | 'Credit';
  taxDeductibleClass: 'Deductible' | 'Partially Deductible' | 'Non-Deductible' | 'Capital' | 'Exempt' | 'N/A';
  isTaxLocked: boolean;
  isSystemControlled: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'Active' | 'Draft' | 'Retired';
  version: number;
  mappedFromV1Code?: string;
}

export interface AccountingPeriod {
  id: string;
  ownerId: OwnerId;
  fiscalYearEc: number;
  monthIndex: number; // 1..13 (13 = Pagume)
  monthNameEn: string;
  monthNameAm: string;
  periodCode: string; // e.g. '2019-03' (Hidar 2019 E.C.)
  startDateGc: string;
  endDateGc: string;
  status: EthiopianPeriodStatus;
  closedAt?: string;
  closedBy?: string;
  closedApprovalId?: string;
  reopenReason?: string;
  reopenApprovedBy?: string;
  lastTrialBalanceCents?: number;
}

export interface PostingRuleDefinition {
  ruleId: PostingRuleId;
  version: number;
  title: string;
  eventSummary: string;
  conditions: string;
  debitAccounts: string[];
  creditAccounts: string[];
  approvalControl: string;
  effectiveDate: string;
}

export interface EInvoiceMetadata {
  irnPlaceholder: string;
  qrPayloadPlaceholder: string;
  submissionStatus: 'Not Submitted — Adapter Locked';
  directiveRef: 'Directive 1142/2026';
  propertyUse: 'Residential' | 'Commercial' | 'Mixed-Use';
  vatSupplyType: 'Exempt (Residential)' | 'Standard 15% (Draft)' | 'Out of Scope (Non-VAT)';
}

export interface LedgerJournalLine {
  id: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
  tenantId?: string;
  unitId?: string;
  leaseId?: string;
  vendorId?: string;
  taxCode?: string;
  description?: string;
}

export interface LedgerJournalEntry {
  id: string;
  ownerId: OwnerId;
  journalNumber: string; // e.g. 'J01', 'J19', 'JE-2019-03-020'
  entryDate: string; // Gregorian ISO YYYY-MM-DD
  ethiopianDateLabel: string;
  periodCode: string;
  ruleId: PostingRuleId | 'Manual' | 'Transfer' | 'Opening';
  ruleVersion: number;
  sourceType:
    | 'OpeningBalance'
    | 'Charge'
    | 'Receipt'
    | 'Deposit'
    | 'GatewaySettlement'
    | 'BankTransfer'
    | 'VendorBill'
    | 'BillPayment'
    | 'Depreciation'
    | 'ManualJournal'
    | 'Reversal'
    | 'OwnerDraw'
    | 'WriteOff'
    | 'YearEndClose';
  sourceId: string;
  idempotencyKey: string;
  description: string;
  status: 'Posted' | 'Pending Approval' | 'Reversed';
  makerActorId: string;
  makerName: string;
  checkerActorId?: string;
  checkerName?: string;
  reversalOfJournalId?: string;
  reversedByJournalId?: string;
  eInvoiceMetadata?: EInvoiceMetadata;
  lines: LedgerJournalLine[];
  createdAt: string;
}

export interface LedgerTenantSubRecord {
  id: string;
  ownerId: OwnerId;
  tenantCode: string; // e.g. T1, T2, T3, T4
  tenantName: string;
  unitCode: string;
  propertyUse: 'Residential' | 'Commercial';
  monthlyRentCents: number;
  leaseTermMonths: number;
  freeMonthsCount: number;
  straightLineMonthlyCents: number;
  advanceMonthsHeld: number;
  advanceRentCents: number;
  accruedRentCents: number;
  deferredRentCents: number;
  lastRentIncreaseDate?: string;
  newlyBuiltExemptUntil?: string;
  openInvoices: {
    invoiceId: string;
    periodCode: string;
    dueDateGc: string;
    daysOverdue: number;
    billedCents: number;
    paidCents: number;
    openCents: number;
  }[];
}

export interface DepositCustodyRecord {
  id: string;
  ownerId: OwnerId;
  leaseId: string;
  tenantId: string;
  tenantName: string;
  unitCode: string;
  bankAccountCode: '1030';
  liabilityAccountCode: '2120';
  heldCents: number;
  status: 'Held' | 'Refund Pending' | 'Refunded' | 'Deducted';
  moveOutChecklistDone?: boolean;
  deductionBreakdown?: string;
  evidenceRef?: string;
  approvalId?: string;
  journalId?: string;
}

export interface GatewaySettlementBatch {
  id: string;
  ownerId: OwnerId;
  provider: 'Telebirr' | 'ArifPay';
  batchNumber: string;
  settlementDate: string;
  periodCode: string;
  receiptRefs: string[];
  grossCents: number;
  feeCents: number;
  netSettledCents: number;
  clearingAccountCode: '1040';
  status: 'Pending Settlement' | 'Settled' | 'Exception';
  settlementJournalId?: string;
  exceptionNote?: string;
}

export interface FailedGatewayEventLog {
  id: string;
  ownerId: OwnerId;
  eventRef: string;
  provider: 'Telebirr' | 'ArifPay';
  tenantRef: string;
  attemptedAmountCents: number;
  occurredAt: string;
  periodCode: string;
  gatewayStatus: 'Failed' | 'Pending' | 'Expired';
  journalsCreatedCount: 0;
  reason: string;
}

export interface BankStatementLine {
  id: string;
  ownerId: OwnerId;
  bankAccountCode: '1020' | '1030';
  periodCode: string;
  txDate: string;
  reference: string;
  description: string;
  amountCents: number;
  direction: 'Inflow' | 'Outflow';
  matchedJournalId?: string;
  status: 'Unmatched' | 'Matched' | 'Exception';
}

export interface ReconciliationRun {
  id: string;
  ownerId: OwnerId;
  periodCode: string;
  bankAccountCode: '1020';
  statementClosingCents: number;
  ledgerClosingCents: number;
  clearingBalanceCents: number;
  threeWayBankCents: number;
  threeWayLedgerCents: number;
  threeWaySubledgerCents: number;
  status: 'Draft' | 'Pending Sign-Off' | 'Signed Off' | 'Exception';
  makerActorId: string;
  makerName: string;
  checkerActorId?: string;
  checkerName?: string;
  signedAt?: string;
  note?: string;
}

export interface VendorBill {
  id: string;
  ownerId: OwnerId;
  billNumber: string;
  vendorName: string;
  vendorTinPlaceholder: string;
  category: 'Goods' | 'Services' | 'Capital';
  expenseAccountCode: string;
  billDate: string;
  dueDate: string;
  periodCode: string;
  grossCents: number;
  whtApplicable: boolean;
  whtRateBps: number;
  whtCents: number;
  netPayableCents: number;
  paymentMethod?: 'Bank Transfer' | 'Cash' | 'Cheque';
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Paid';
  makerActorId: string;
  makerName: string;
  checkerActorId?: string;
  approvalId?: string;
  billJournalId?: string;
  paymentJournalId?: string;
  evidenceRef: string;
  description: string;
}

export interface FixedAssetRecord {
  id: string;
  ownerId: OwnerId;
  assetCode: string;
  name: string;
  assetClass: 'Building' | 'Equipment';
  assetAccountCode: '1210' | '1230';
  accumDepAccountCode: '1220' | '1240';
  inServiceDate: string;
  costCents: number;
  salvageCents: number;
  usefulLifeMonths: number;
  accumDepOpeningCents: number;
  accumDepCurrentCents: number;
  lastDepreciatedPeriod?: string;
  taxMarketValueCents?: number; // used for Proclamation 1365/2025 25% taxable value
  municipalPropertyTaxRateBps?: number;
}

export interface CloseChecklistTask {
  stepNumber: number;
  id: string;
  titleEn: string;
  titleAm: string;
  passed: boolean;
  detail: string;
  preparedByActorId: string;
}

export interface CloseChecklistRun {
  id: string;
  ownerId: OwnerId;
  periodCode: string;
  tasks: CloseChecklistTask[];
  makerActorId: string;
  makerName: string;
  checkerActorId?: string;
  checkerName?: string;
  approvalId?: string;
  status: 'In Progress' | 'Ready for Close Approval' | 'Closed';
  updatedAt: string;
}

export interface TaxRuleRegisterItem {
  id: number;
  ruleTitle: string;
  moduleAssumption: string;
  sourceSummary: string;
  checkedDate: string;
  signOffStatus: 'Not reviewed' | 'Adviser Confirmed' | 'Owner Decision Pending';
  hasConflict: boolean;
}

export interface VersionedTaxRulePack {
  id: string;
  packCode: string;
  jurisdiction: 'Federal Ethiopia' | 'Addis Ababa Reference' | 'Oromia Local Pack (Placeholder)';
  entityType: 'Individual' | 'Company' | 'All';
  taxLawRef: string;
  effectiveFrom: string;
  lifecycleStage: TaxLifecycleStage;
  activeGateLocked: true;
  marginalBands?: {
    upToEtb: number | null;
    ratePercent: number;
  }[];
  flatCompanyRatePercent?: number;
  presumptiveDeductionOptionsPercent?: number[];
  vatRatePercent?: number;
  vatRegistrationThresholdEtb?: number;
  whtGoodsThresholdEtb?: number;
  whtServicesThresholdEtb?: number;
  whtRatePercent?: number;
  cashTransactionLimitEtb?: number;
  advanceTaxQuarterPercent?: number;
  propertyTaxBasePercent?: number;
  propertyTaxFederalRangeLabel?: string;
  rentIncreaseAnnualCapPercent?: number;
  maxAdvanceRentMonths?: number;
}

export interface TaxWorkpaperDraft {
  id: string;
  ownerId: OwnerId;
  periodCode: string;
  fiscalYearEc: number;
  methodCompared: 'Books vs. Flat Presumptive (20% / 35%)';
  grossAnnualizedRentCents: number;
  deductibleExpensesBooksCents: number;
  taxableBooksCents: number;
  taxBooksCents: number;
  taxFlat20Cents: number;
  taxFlat35Cents: number;
  vatOutputDraftCents: number;
  vatInputDraftCents: number;
  vatNetDraftCents: number;
  whtPayableCents: number;
  quarterlyAdvanceTaxCents: number;
  propertyTaxEstimateCents: number;
  combinedIndividualIncomeMode: boolean;
  otherIndividualIncomeCents: number;
  workpaperStatus: 'Workpaper Draft — Active Gate Locked';
  generatedAt: string;
  generatedBy: string;
}

export interface TaxCalendarObligation {
  id: string;
  ownerId: OwnerId;
  obligationCode: string;
  titleEn: string;
  titleAm: string;
  ecScheduleLabel: string;
  gcDueDate: string;
  frequency: 'Monthly' | 'Quarterly' | 'Annual';
  draftEstimateCents: number;
  status: 'Draft Reminder — Filing Locked';
  ruleRef: string;
}

export interface BackupIntegrityManifest {
  ownerId: OwnerId;
  generatedAt: string;
  journalCount: number;
  totalDebitsCents: number;
  totalCreditsCents: number;
  lastClosedPeriodCode: string;
  lastClosedTrialBalanceCents: number;
  latestAuditChainId: string;
  checks: {
    id: number;
    label: string;
    passed: boolean;
    detail: string;
  }[];
  allPassed: boolean;
}

export interface OwnerStatementSummary {
  ownerId: OwnerId;
  periodCode: string;
  periodLabel: string;
  incomeLines: { label: string; amountCents: number }[];
  totalIncomeCents: number;
  expenseLines: { label: string; amountCents: number }[];
  totalExpenseCents: number;
  netIncomeCents: number;
  bankMovements: {
    openingCents: number;
    rentReceivedAfterFeesCents: number;
    repairPaidAfterWhtCents: number;
    utilitiesPaidCents: number;
    otherOperatingOutflowsCents: number;
    ownerDrawsCents: number;
    closingCents: number;
  };
  heldForOthers: {
    tenantDepositsCents: number;
    advanceRentCents: number;
    withholdingPayableCents: number;
  };
  notYetReceived: {
    rentReceivableCents: number;
    accruedRentCents: number;
  };
}



