import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LocaleProvider } from './LocaleContext';
import { createInitialSeedState, DEMO_PERSONAS, SeedState } from '../data/seedData';
import { TENANT_PORTAL_ACCOUNTS, TRAINING_ACCOUNTS, TRAINING_EXERCISES } from '../data/trainingCatalog';
import {
  biText,
  formatDateDisplay,
  formatDateTimeDisplay,
  formatEtb,
  formatShortEtb,
  localizeStatus,
  UI_LABELS,
  UiLocale,
} from '../data/i18n';
import { canSwitchOwnerForRole, checkActionPermission, checkApprovalAuthority } from '../policies/rbac';
import { buildBilingualSmsBody, postSmsDispatchToServer } from '../services/smsNotificationService';
import { createDefaultOromifaTemplates } from '../data/oromifaContractTemplate';
import {
  disconnectRealtimeSocket,
  getRealtimeClientId,
  publishRealtimeEvent,
  subscribeRealtimeEvents,
} from '../services/realtimeSyncClient';
import {
  observeSupabaseAuthReadiness,
  signOutSupabase,
  SupabaseAuthenticatedOperator,
} from '../services/supabaseAuthService';
import {
  appendAuditEventToSupabase,
  recordPeriodClosureToSupabase,
  subscribeToWorkspaceSnapshot,
  syncWorkspaceSnapshotToSupabase,
} from '../services/supabaseWorkspaceService';
import {
  clearBrowserEnvOverrides,
  ENV_UPDATED_EVENT,
  ENV_VARIABLE_REGISTRY,
  formatAuditEnvValue,
  getAllEffectiveBrowserEnvValues,
  setBrowserEnvOverrides,
  validateEnvVariableValue,
} from '../config/environmentRegistry';
import { resetSupabaseClientCache } from '../lib/supabase';
import {
  AccountingPolicyItem,
  AdminUserRecord,
  AdviserReviewQuestion,
  AppNotification,
  ApprovalCategory,
  ApprovalRequest,
  ApprovalWorkflowMode,
  ApprovalWorkflowStatus,
  AuditEvent,
  BackupDrillRecord,
  BackupPolicyRecord,
  BuildingRecord,
  ChartOfAccount,
  ChargeRecord,
  DateDisplayMode,
  DelegationRecord,
  DemoPersonaProfile,
  ExpensePayableRecord,
  GatewayPaymentRecord,
  LeaseRecord,
  MaintenanceMessageRecord,
  MaintenanceTicketRecord,
  MigrationMappingRule,
  MigrationStagingRecord,
  MobileWorkspaceMode,
  NavSection,
  OfflinePendingAction,
  OromifaContractData,
  OromifaContractTemplate,
  OwnerEntity,
  OwnerId,
  PaymentMethod,
  PaymentReceipt,
  PaymentReminderChannel,
  PaymentReminderRequestRecord,
  PersonaRole,
  ProductionGateItem,
  PropertyRecord,
  PrototypeJournalEntry,
  QuarterlyAccessReviewItem,
  ReceiptDocumentState,
  RentalApplicationRecord,
  RequirementTraceabilityItem,
  ResearchRequirementRecord,
  RetentionClassRecord,
  SimulatedSession,
  SmsDispatchRecord,
  SmsTriggerType,
  SourceRecordCard,
  TaxLifecycleStage,
  TaxRuleRecord,
  TenantNoticeRecord,
  TenantNotificationPrefs,
  TenantPortalAccount,
  TenantRecord,
  UnitRecord,
  UnitStatus,
  OwnerLedgerConfig,
  LedgerAccountV2,
  AccountingPeriod,
  LedgerJournalEntry,
  LedgerTenantSubRecord,
  DepositCustodyRecord,
  GatewaySettlementBatch,
  FailedGatewayEventLog,
  BankStatementLine,
  ReconciliationRun,
  VendorBill,
  FixedAssetRecord,
  CloseChecklistRun,
  TaxRuleRegisterItem,
  VersionedTaxRulePack,
  TaxWorkpaperDraft,
  TaxCalendarObligation,
  OwnerStatementSummary,
  BackupIntegrityManifest,
} from '../types/prms';
import {
  BalanceSheetReport,
  buildMirrorReversal,
  buildYearEndCloseEntry,
  ClearingStatusReport,
  computeBalanceSheet,
  computeClearingStatus,
  computeIncomeStatement,
  computeOwnerStatement,
  computeTaxWorkpaperDraft,
  computeTenantAgeing,
  computeThreeWayDepositCheck,
  computeTrialBalance,
  evaluateCloseChecklist,
  IncomeStatementReport,
  LedgerOwnerBundle,
  postLedgerEvent,
  runMonthlyDepreciation,
  TenantAgeingSummary,
  ThreeWayDepositCheck,
  toCents,
  TrialBalanceReport,
  verifyBackupIntegrityManifest,
} from '../services/accountingEngine';
import { buildLedgerAccountsV2 } from '../data/accountingRulePack';
import { buildHidarAlphaBundle } from '../data/hidarWorkedMonth';
import {
  buildManualReminderCopy,
  isValidEmailAddress,
  maskMsisdnForDisplay,
} from '../utils/paymentReminders';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  title: string;
  detail?: string;
}

interface PrmsContextValue {
  isAuthenticated: boolean;
  currentPersona: DemoPersonaProfile;
  session: SimulatedSession;
  activeOwnerId: OwnerId;
  activeOwner: OwnerEntity;
  activeSection: NavSection;
  locale: UiLocale;
  dateMode: DateDisplayMode;
  labels: Record<string, string>;
  toasts: ToastMessage[];

  // Formatting & localisation helpers reactive to locale + dateMode
  fmtDate: (rawDate: string) => string;
  fmtDateTime: (rawDateTime: string) => string;
  fmtEtb: (amount: number) => string;
  fmtShortEtb: (amount: number) => string;
  trStatus: (status: string) => string;

  // Strictly owner-isolated projections
  ownerProperties: PropertyRecord[];
  ownerBuildings: BuildingRecord[];
  ownerUnits: UnitRecord[];
  ownerTenants: TenantRecord[];
  ownerLeases: LeaseRecord[];
  ownerCharges: ChargeRecord[];
  ownerReceipts: PaymentReceipt[];
  ownerAccounts: ChartOfAccount[];
  ownerAccountingPolicies: AccountingPolicyItem[];
  ownerJournalEntries: PrototypeJournalEntry[];
  ownerTaxRules: TaxRuleRecord[];
  ownerResearchRequirements: ResearchRequirementRecord[];
  ownerSourceRecords: SourceRecordCard[];
  ownerAdviserQuestions: AdviserReviewQuestion[];
  ownerProductionGates: ProductionGateItem[];
  ownerRetentionClasses: RetentionClassRecord[];
  ownerApprovals: ApprovalRequest[];
  ownerAuditEvents: AuditEvent[];
  ownerNotifications: AppNotification[];
  ownerDelegations: DelegationRecord[];
  ownerAccessReviews: QuarterlyAccessReviewItem[];
  ownerRentalApplications: RentalApplicationRecord[];
  ownerExpenses: ExpensePayableRecord[];
  ownerMaintenanceTickets: MaintenanceTicketRecord[];
  ownerBackupPolicies: BackupPolicyRecord[];
  ownerBackupDrills: BackupDrillRecord[];
  ownerMigrationBatches: MigrationStagingRecord[];
  ownerMigrationMappings: MigrationMappingRule[];
  ownerRequirementsTraceability: RequirementTraceabilityItem[];
  ownerGatewayPayments: GatewayPaymentRecord[];
  ownerMaintenanceMessages: MaintenanceMessageRecord[];
  ownerTenantNotices: TenantNoticeRecord[];
  ownerSmsLogs: SmsDispatchRecord[];
  ownerTenantPrefs: TenantNotificationPrefs[];
  ownerPaymentReminderRequests: PaymentReminderRequestRecord[];
  ownerOromifaTemplates: OromifaContractTemplate[];
  saveOromifaTemplate: (input: {
    id?: string;
    templateName: string;
    description: string;
    data: OromifaContractData;
  }) => OromifaContractTemplate;
  deleteOromifaTemplate: (templateId: string) => void;

  // Mobile Modes, Tenant Portal & Connectivity
  mobileMode: MobileWorkspaceMode;
  setMobileMode: (mode: MobileWorkspaceMode) => void;
  activeTenantAccount: TenantPortalAccount | null;
  isTenantAuthenticated: boolean;
  isOnline: boolean;
  pendingSyncQueue: OfflinePendingAction[];
  flushOfflineSyncQueue: () => void;
  loginAsTenant: (username: string, password: string) => { ok: boolean; error?: string };
  logoutTenant: () => void;

  // Administration data
  adminUsers: AdminUserRecord[];
  configRules: SeedState['configRules'];

  // Navigation, session & training controls
  loginWithTrainingAccount: (
    username: string,
    password: string,
    initialOwnerId?: OwnerId
  ) => { ok: boolean; error?: string };
  loginWithSupabaseOperator: (
    operator: SupabaseAuthenticatedOperator,
    initialOwnerId?: OwnerId
  ) => void;
  logoutToLogin: () => void;
  setActiveSection: (section: NavSection) => void;
  switchOwnerContext: (ownerId: OwnerId) => void;
  logCrossOwnerDeniedAttempt: (targetOwnerId: OwnerId) => void;
  attemptSelfApprovalAudit: (approvalId: string) => void;
  setLocale: (locale: UiLocale) => void;
  setDateMode: (mode: DateDisplayMode) => void;
  dismissToast: (id: string) => void;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
  resetDemoData: () => void;
  markNotificationRead: (id: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  completedExerciseIds: string[];
  exerciseStepChecks: Record<string, boolean[]>;
  toggleExerciseStep: (exerciseId: string, stepIndex: number) => void;
  markExerciseComplete: (exerciseId: string) => void;

  // Domain actions
  createProperty: (input: {
    name: string;
    code: string;
    propertyType: 'Mixed-Use Commercial' | 'Commercial Office';
    subCity: string;
    woreda: string;
    streetPlaceholder: string;
    evidenceRef: string;
  }) => boolean;

  createUnit: (input: {
    propertyId: string;
    buildingId: string;
    code: string;
    name: string;
    floor: number;
    areaSqm: number;
    unitType: 'Retail Ground' | 'Office Suite' | 'Commercial Hall';
    status: UnitStatus;
    baseRentEtb: number;
    evidenceRef: string;
  }) => boolean;

  updateUnitStatus: (unitId: string, newStatus: UnitStatus, reason: string, evidenceRef: string) => boolean;

  requestUnitRenumbering: (input: {
    unitId: string;
    newCode: string;
    effectiveDate: string;
    evidenceRef: string;
    reason: string;
  }) => boolean;

  requestOwnershipChange: (input: {
    propertyId: string;
    proposedOwnerName: string;
    effectiveDate: string;
    evidenceRef: string;
    reason: string;
  }) => boolean;

  createLease: (input: {
    unitId: string;
    tenantId: string;
    startDate: string;
    endDate: string;
    monthlyRentEtb: number;
    securityDepositEtb: number;
    evidenceRef: string;
    notes: string;
    contractLanguage?: 'en' | 'am' | 'om';
    oromifaContract?: OromifaContractData;
  }) => boolean;

  renewLease: (input: {
    leaseId: string;
    newStartDate: string;
    newEndDate: string;
    newMonthlyRentEtb: number;
    evidenceRef: string;
    notes: string;
  }) => boolean;

  recordPayment: (input: {
    tenantId: string;
    amountEtb: number;
    method: PaymentMethod;
    paymentDate: string;
    referencePlaceholder: string;
    allocations: { chargeId: string; amountEtb: number }[];
  }) => PaymentReceipt | null;

  requestReceiptVoid: (input: {
    receiptId: string;
    evidenceRef: string;
    reason: string;
  }) => boolean;

  proposeAccountChange: (input: {
    accountId: string;
    proposedName: string;
    effectiveDate: string;
    evidenceRef: string;
    reason: string;
  }) => boolean;

  createTaxDraft: (input: {
    code: string;
    taxCategory: string;
    propertyUseClassification: TaxRuleRecord['propertyUseClassification'];
    ownerEntityCategory: string;
    taxableStatus: TaxRuleRecord['taxableStatus'];
    effectiveDateFrom: string;
    effectiveDateTo: string;
    sourceReference: string;
    adviserEvidence: string;
    notes: string;
  }) => boolean;

  submitTaxForApproval: (taxRuleId: string, evidenceRef: string, reason: string) => boolean;

  prepareAdviserPack: (questionId: string, evidenceRef: string, notes: string) => boolean;

  submitAdviserForOwnerDecision: (questionId: string, evidenceRef: string, notes: string) => boolean;

  toggleRetentionLegalHold: (retentionId: string, reason: string) => boolean;

  requestRoleAssignment: (input: {
    userName: string;
    syntheticHandle: string;
    proposedRole: PersonaRole;
    effectiveDate: string;
    evidenceRef: string;
    reason: string;
  }) => boolean;

  updateConfigRuleDraft: (ruleId: string, newValue: string, effectiveDate: string, reason: string) => boolean;

  saveEnvironmentOverrides: (
    values: Record<string, string>
  ) => { ok: boolean; errors: string[]; updatedKeys: string[] };

  resetEnvironmentOverrides: () => boolean;

  logEnvironmentExport: (target: 'root' | 'backend' | 'snippet', detail: string) => void;

  submitGatewayPayment: (input: {
    gatewayType: 'Telebirr USSD QR' | 'ArifPay Checkout' | 'CBE Transfer Slip';
    tenantId: string;
    unitId: string;
    chargeId: string;
    amountEtb: number;
    referenceNumber: string;
    phoneOrAccount: string;
    notes: string;
    ussdSessionId?: string;
    ussdDialString?: string;
    traceId?: string;
    arifpaySessionId?: string;
    arifpayNonce?: string;
    arifpayMethod?: 'TELEBIRR' | 'CBE';
    autoVerified?: boolean;
  }) => PaymentReceipt | null;

  verifyGatewayPayment: (
    gatewayId: string,
    decision: 'Verified' | 'Rejected',
    note?: string
  ) => boolean;

  decideApproval: (
    approvalId: string,
    decision: 'Approved' | 'Rejected' | 'Returned',
    comment: string
  ) => boolean;
  cancelApproval: (approvalId: string, comment: string) => boolean;
  supersedeApproval: (approvalId: string, newReason: string, newEvidenceRef: string) => boolean;
  triggerApprovalReminderOrEscalate: (approvalId: string, mode: 'reminder' | 'escalate') => void;
  toggleApprovalChecklistItem: (approvalId: string, itemId: string) => void;

  // RBAC Delegations & Access Review
  requestDelegation: (input: {
    delegateActorId: string;
    scopeModules: string;
    startDate: string;
    endDate: string;
    evidenceRef: string;
  }) => boolean;
  revokeDelegation: (delegationId: string) => boolean;
  attestAccessReview: (
    reviewId: string,
    outcome: 'Attested (Simulation)' | 'Exception Flagged',
    note: string
  ) => boolean;

  // 5 Missing Planned Modules
  createRentalApplication: (input: {
    applicantName: string;
    businessType: string;
    requestedUnitId: string;
    proposedRentEtb: number;
    evidenceRef: string;
    notes: string;
  }) => boolean;
  submitRentalApplication: (appId: string) => boolean;
  decideRentalApplication: (appId: string, decision: 'Approved' | 'Rejected') => boolean;
  convertApplicationToLease: (appId: string) => boolean;

  createExpenseRequest: (input: {
    supplierPlaceholder: string;
    description: string;
    accountCode: string;
    amountEtb: number;
    dueDate: string;
    invoiceEvidenceRef: string;
    notes: string;
  }) => boolean;
  submitExpenseForApproval: (expenseId: string) => boolean;

  createMaintenanceTicket: (input: {
    unitId: string;
    category: 'Maintenance' | 'Complaint';
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    title: string;
    description: string;
    estimatedCostEtb: number;
    evidenceRef: string;
    applyUnitStatus: boolean;
  }) => boolean;
  advanceMaintenanceWorkOrder: (
    ticketId: string,
    nextState: MaintenanceTicketRecord['workOrderState'],
    applyUnitStatus?: boolean
  ) => boolean;

  requestBackupDrill: (input: { drillScope: string; evidenceRef: string }) => boolean;
  completeApprovedBackupDrill: (drillId: string) => boolean;

  requestMigrationExceptionApproval: (batchId: string, comment: string) => boolean;

  // Requirements Acceptance Runner
  runAcceptanceScenario: (
    reqId: string,
    outcome: 'Pass (Sim)' | 'Blocked (Expected)',
    note: string
  ) => boolean;

  logReportExport: (reportTitle: string, format: 'PDF' | 'Excel') => void;
  logSimulatedEvent: (
    module: AuditEvent['module'],
    action: string,
    recordType: string,
    recordId: string,
    reason: string,
    evidenceRef?: string
  ) => void;

  // Tenant Portal & Bilingual Communication Actions
  sendMaintenanceMessage: (input: {
    ticketId: string;
    body: string;
    visibility: 'Shared with Tenant' | 'Internal Staff Note';
    asTenant?: boolean;
  }) => boolean;
  createTenantMaintenanceTicket: (input: {
    unitId: string;
    category: 'Maintenance' | 'Complaint';
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    title: string;
    description: string;
  }) => boolean;
  publishTenantNotice: (input: {
    tenantId: string | 'ALL';
    titleEn: string;
    titleAm: string;
    bodyEn: string;
    bodyAm: string;
    category: TenantNoticeRecord['category'];
  }) => boolean;
  markTenantNoticeRead: (noticeId: string, tenantId: string) => void;
  dispatchAutomatedSmsReminder: (input: {
    tenantId: string;
    triggerType: SmsTriggerType;
    chargeId?: string;
    ticketId?: string;
    receiptNumber?: string;
    noticeTitle?: string;
  }) => boolean;
  dispatchBatchOverdueSmsReminders: () => number;
  updateTenantNotificationPrefs: (
    tenantId: string,
    updates: Partial<Pick<TenantNotificationPrefs, 'smsEnabled' | 'pushEnabled' | 'preferredLocale' | 'msisdn'>>
  ) => void;
  submitTenantMobilePayment: (input: {
    gatewayType: 'Telebirr USSD QR' | 'ArifPay Checkout' | 'CBE Transfer Slip';
    tenantId: string;
    unitId: string;
    chargeId: string;
    amountEtb: number;
    referenceNumber: string;
    phoneOrAccount: string;
    notes: string;
    ussdSessionId?: string;
    ussdDialString?: string;
    traceId?: string;
    arifpaySessionId?: string;
    arifpayNonce?: string;
    arifpayMethod?: 'TELEBIRR' | 'CBE';
    autoVerified?: boolean;
  }) => PaymentReceipt | null;
  requestTenantPaymentReminder: (input: {
    tenantId: string;
    chargeIds: string[];
    channel: PaymentReminderChannel;
    recipientEmail?: string;
    recipientMsisdn?: string;
    note?: string;
  }) => PaymentReminderRequestRecord | null;

  // Steps 1–7 Double-Entry Ledger, Period Close & Versioned Tax Engine
  ownerLedgerConfig: OwnerLedgerConfig;
  ownerLedgerAccountsV2: LedgerAccountV2[];
  ownerAccountingPeriods: AccountingPeriod[];
  ownerLedgerJournals: LedgerJournalEntry[];
  ownerLedgerTenants: LedgerTenantSubRecord[];
  ownerDeposits: DepositCustodyRecord[];
  ownerGatewayBatches: GatewaySettlementBatch[];
  ownerFailedGatewayEvents: FailedGatewayEventLog[];
  ownerBankStatementLines: BankStatementLine[];
  ownerReconRuns: ReconciliationRun[];
  ownerVendorBills: VendorBill[];
  ownerFixedAssets: FixedAssetRecord[];
  ownerCloseChecklist: CloseChecklistRun;
  ownerTrialBalance: TrialBalanceReport;
  ownerIncomeStatement: IncomeStatementReport;
  ownerBalanceSheet: BalanceSheetReport;
  ownerThreeWayDeposit: ThreeWayDepositCheck;
  ownerClearingStatus: ClearingStatusReport;
  ownerTenantAgeing: TenantAgeingSummary;
  ownerStatementSummary: OwnerStatementSummary;
  ownerBackupManifest: BackupIntegrityManifest;
  taxRuleRegister: TaxRuleRegisterItem[];
  taxRulePacks: VersionedTaxRulePack[];
  ownerTaxWorkpapers: TaxWorkpaperDraft[];
  ownerTaxCalendar: TaxCalendarObligation[];
  ownerLedgerBundle: LedgerOwnerBundle;

  submitManualJournal: (input: {
    entryDate: string;
    periodCode: string;
    description: string;
    evidenceRef: string;
    lines: { accountCode: string; debitEtb: number; creditEtb: number; description?: string }[];
  }) => { ok: boolean; error?: string };
  reverseLedgerJournal: (input: {
    journalId: string;
    entryDate: string;
    reason: string;
  }) => { ok: boolean; error?: string };
  postRentChargeEvent: (input: {
    tenantId: string;
    amountEtb: number;
    entryDate: string;
    periodCode: string;
    propertyUse: 'Residential' | 'Commercial';
    applyVatDraft?: boolean;
    description?: string;
  }) => { ok: boolean; error?: string };
  settleGatewayBatch: (input: {
    batchId: string;
    feeEtb: number;
    settlementDate: string;
  }) => { ok: boolean; error?: string };
  simulateFailedGatewayEvent: (input: {
    tenantRef: string;
    provider: 'Telebirr' | 'ArifPay';
    amountEtb: number;
    periodCode: string;
  }) => void;
  matchBankStatementLine: (lineId: string, journalId: string) => void;
  signOffBankRecon: (reconId: string) => { ok: boolean; error?: string };
  requestDepositSettlement: (input: {
    depositId: string;
    mode: 'Refund' | 'Deduction';
    amountEtb: number;
    evidenceRef: string;
    reason: string;
    moveOutChecklistDone: boolean;
  }) => { ok: boolean; error?: string };
  createVendorBill: (input: {
    vendorName: string;
    vendorTinPlaceholder: string;
    category: 'Goods' | 'Services' | 'Capital';
    expenseAccountCode: string;
    amountEtb: number;
    billDate: string;
    dueDate: string;
    periodCode: string;
    evidenceRef: string;
    description: string;
  }) => { ok: boolean; error?: string };
  payVendorBill: (input: {
    billId: string;
    paymentDate: string;
    method: 'Bank Transfer' | 'Cash' | 'Cheque';
    cashExceptionApproved?: boolean;
  }) => { ok: boolean; error?: string };
  registerFixedAsset: (input: {
    name: string;
    assetClass: 'Building' | 'Equipment';
    costEtb: number;
    usefulLifeMonths: number;
    inServiceDate: string;
  }) => { ok: boolean; error?: string };
  runPeriodDepreciation: (periodCode: string) => { ok: boolean; error?: string };
  requestPeriodClose: (periodCode: string, note: string) => { ok: boolean; error?: string };
  requestPeriodReopen: (periodCode: string, reason: string, evidenceRef: string) => { ok: boolean; error?: string };
  executeYearEndCloseAction: (periodCode: string) => { ok: boolean; error?: string };
  requestOwnerDraw: (input: {
    amountEtb: number;
    drawDate: string;
    periodCode: string;
    evidenceRef: string;
    reason: string;
  }) => { ok: boolean; error?: string };
  runAndSaveTaxWorkpaper: (input: {
    periodCode: string;
    combinedIndividualIncomeMode: boolean;
    otherIndividualIncomeEtb: number;
    priorYearIncomeTaxEtb: number;
  }) => TaxWorkpaperDraft;
  toggleRulesRegisterSignOff: (ruleId: number, status: TaxRuleRegisterItem['signOffStatus']) => void;
  toggleOwnerVatDraftMode: (vatRegistered: boolean) => void;
  simulateClosedPeriodPost: (periodCode: string) => { ok: boolean; error: string };
  resetToHidarWorkedMonth: () => void;
}

const PrmsContext = createContext<PrmsContextValue | null>(null);

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function addHoursTimestamp(hours: number): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function resolveInitialSectionFromPath(): NavSection {
  if (typeof window === 'undefined') return 'dashboard';
  const pathname = window.location.pathname;
  if (pathname === '/administration' || pathname === '/administration/') {
    return 'admin';
  }
  return 'dashboard';
}

export const PrmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [seed, setSeed] = useState<SeedState>(() => createInitialSeedState());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<DemoPersonaProfile>(DEMO_PERSONAS[0]);
  const [activeOwnerId, setActiveOwnerId] = useState<OwnerId>('OWN-ALPHA');
  const [activeSection, setActiveSection] = useState<NavSection>(resolveInitialSectionFromPath);
  const [locale, setLocale] = useState<UiLocale>('en');
  const [dateMode, setDateMode] = useState<DateDisplayMode>('gregorian');

  useEffect(() => {
    document.documentElement.dataset.locale = locale;
    document.documentElement.lang = locale;
  }, [locale]);
  const [session, setSession] = useState<SimulatedSession>({
    actorId: DEMO_PERSONAS[0].syntheticId,
    actorName: DEMO_PERSONAS[0].displayName,
    username: 'gm.demo',
    assignedRoles: [DEMO_PERSONAS[0].role],
    activeOwnerScope: 'OWN-ALPHA',
    sessionStartTime: nowTimestamp(),
    sessionExpiryTime: addHoursTimestamp(4),
    isTrainer: false,
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMode, setMobileMode] = useState<MobileWorkspaceMode>('desktop');
  const [activeTenantAccount, setActiveTenantAccount] = useState<TenantPortalAccount | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncQueue, setPendingSyncQueue] = useState<OfflinePendingAction[]>(() => {
    try {
      const raw = window.localStorage.getItem('ad_prms_offline_queue_v1');
      return raw ? (JSON.parse(raw) as OfflinePendingAction[]) : [];
    } catch {
      return [];
    }
  });
  const [completedExerciseIds, setCompletedExerciseIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('ad_prms_completed_exercises_v1');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [exerciseStepChecks, setExerciseStepChecks] = useState<Record<string, boolean[]>>(() => {
    const initial: Record<string, boolean[]> = {};
    TRAINING_EXERCISES.forEach((ex) => {
      initial[ex.id] = ex.steps.map(() => false);
    });
    try {
      const raw = window.localStorage.getItem('ad_prms_exercise_checks_v1');
      if (raw) {
        return { ...initial, ...(JSON.parse(raw) as Record<string, boolean[]>) };
      }
    } catch {
      // Ignore storage errors
    }
    return initial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('ad_prms_completed_exercises_v1', JSON.stringify(completedExerciseIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [completedExerciseIds]);

  const [oromifaTemplates, setOromifaTemplates] = useState<OromifaContractTemplate[]>(() => {
    const defaults = [
      ...createDefaultOromifaTemplates('OWN-ALPHA'),
      ...createDefaultOromifaTemplates('OWN-BETA'),
    ];
    try {
      const raw = window.localStorage.getItem('ad_prms_oromifa_templates_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as OromifaContractTemplate[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return defaults;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('ad_prms_oromifa_templates_v1', JSON.stringify(oromifaTemplates));
    } catch {
      // Ignore storage quota errors
    }
  }, [oromifaTemplates]);

  useEffect(() => {
    try {
      window.localStorage.setItem('ad_prms_exercise_checks_v1', JSON.stringify(exerciseStepChecks));
    } catch {
      // Ignore storage quota errors
    }
  }, [exerciseStepChecks]);

  useEffect(() => {
    try {
      window.localStorage.setItem('ad_prms_offline_queue_v1', JSON.stringify(pendingSyncQueue));
    } catch {
      // Ignore storage quota errors
    }
  }, [pendingSyncQueue]);

  // Built-in Node SQLite office state hydration & debounced persistence
  const officeHydratedRef = useRef(false);
  const officeRevisionRef = useRef<number | undefined>(undefined);
  const skipNextSaveRef = useRef(false);
  const pendingSaveTimerRef = useRef<number | null>(null);
  const dirtyForSaveRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const latestSeedRef = useRef(seed);
  latestSeedRef.current = seed;
  const latestMetaRef = useRef({ username: session.username, ownerId: activeOwnerId });
  latestMetaRef.current = { username: session.username, ownerId: activeOwnerId };
  const supabaseOperatorRef = useRef<SupabaseAuthenticatedOperator | null>(null);
  const [supabaseAuthReady, setSupabaseAuthReady] = useState(false);
  const [supabaseUid, setSupabaseUid] = useState<string | null>(null);
  const [officeSessionReady, setOfficeSessionReady] = useState(false);
  const [officeSessionRole, setOfficeSessionRole] = useState<'staff' | 'tenant' | null>(null);

  const canSyncOfficeDb =
    typeof window !== 'undefined' &&
    typeof fetch === 'function' &&
    Boolean(window.location?.protocol?.startsWith('http')) &&
    import.meta.env?.MODE !== 'test';

  const [envUpdateTick, setEnvUpdateTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleEnvUpdated = () => {
      setEnvUpdateTick((t) => t + 1);
    };
    window.addEventListener(ENV_UPDATED_EVENT, handleEnvUpdated);
    return () => {
      window.removeEventListener(ENV_UPDATED_EVENT, handleEnvUpdated);
    };
  }, []);

  useEffect(() => {
    if (!canSyncOfficeDb) return;
    const unsubscribe = observeSupabaseAuthReadiness((operator) => {
      setSupabaseAuthReady(true);
      if (operator) {
        supabaseOperatorRef.current = operator;
        setSupabaseUid(operator.uid);
      } else {
        supabaseOperatorRef.current = null;
        setSupabaseUid(null);
      }
    });
    return unsubscribe;
  }, [canSyncOfficeDb, envUpdateTick]);

  useEffect(() => {
    if (!canSyncOfficeDb || !supabaseAuthReady || !supabaseUid || !supabaseOperatorRef.current) {
      return;
    }
    const unsubscribe = subscribeToWorkspaceSnapshot(supabaseUid, () => {
      // Realtime Postgres Changes subscription active while authenticated
    });
    return unsubscribe;
  }, [canSyncOfficeDb, supabaseAuthReady, supabaseUid]);

  useEffect(() => {
    if (!canSyncOfficeDb || !officeSessionReady || officeSessionRole !== 'staff') {
      return;
    }

    let cancelled = false;
    const hydrateFromSqlite = async () => {
      try {
        const res = await fetch('/api/office/state', { cache: 'no-store' });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) {
          officeHydratedRef.current = true;
          return;
        }
        const data = (await res.json()) as {
          initialized?: boolean;
          revision?: number;
          state?: Partial<SeedState> | null;
        };
        if (cancelled) return;

        if (typeof data.revision === 'number') {
          officeRevisionRef.current = data.revision;
        }

        if (data.initialized && data.state) {
          skipNextSaveRef.current = true;
          setSeed({ ...createInitialSeedState(), ...data.state });
        } else {
          const initRes = await fetch('/api/office/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: latestSeedRef.current,
              onlyIfUninitialized: true,
              updatedBy: 'initial-seed',
              originClientId: getRealtimeClientId(),
              ownerId: latestMetaRef.current.ownerId,
            }),
          });
          if (initRes.ok) {
            const initJson = (await initRes.json()) as { revision?: number };
            if (typeof initJson.revision === 'number') {
              officeRevisionRef.current = initJson.revision;
            }
          }
        }
      } catch {
        // Offline or static preview — operate cleanly in memory
      } finally {
        if (!cancelled) {
          officeHydratedRef.current = true;
        }
      }
    };

    void hydrateFromSqlite();
    return () => {
      cancelled = true;
    };
  }, [canSyncOfficeDb, officeSessionReady, officeSessionRole]);

  const flushOfficeSave = useCallback(() => {
    if (!officeSessionReady || officeSessionRole !== 'staff' || currentPersona.role === 'Auditor / Read-only reviewer') {
      return;
    }
    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    queuedSaveRef.current = false;
    dirtyForSaveRef.current = false;

    void fetch('/api/office/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: latestSeedRef.current,
        updatedBy: latestMetaRef.current.username || 'office-user',
        expectedRevision: officeRevisionRef.current,
        originClientId: getRealtimeClientId(),
        ownerId: latestMetaRef.current.ownerId,
      }),
    })
      .then(async (res) => {
        if (res.status === 409) {
          const latestRes = await fetch('/api/office/state', { cache: 'no-store' });
          if (latestRes.ok) {
            const latestJson = (await latestRes.json()) as {
              initialized?: boolean;
              revision?: number;
              state?: Partial<SeedState> | null;
            };
            if (typeof latestJson.revision === 'number') {
              officeRevisionRef.current = latestJson.revision;
            }
            if (latestJson.initialized && latestJson.state) {
              skipNextSaveRef.current = true;
              setSeed({ ...createInitialSeedState(), ...latestJson.state });
            }
          }
          setToasts((prev) =>
            [
              {
                id: `TST-CONFLICT-${Date.now()}`,
                tone: 'warning' as const,
                title: 'Workspace Sync Conflict Reconciled',
                detail: 'Another tab saved newer changes; synced latest SQLite revision.',
              },
              ...prev,
            ].slice(0, 4)
          );
          return;
        }
        if (res.ok) {
          const json = (await res.json()) as { revision?: number };
          if (typeof json.revision === 'number') {
            officeRevisionRef.current = json.revision;
          }
        }
      })
      .catch(() => {
        // Offline-safe
      })
      .finally(() => {
        saveInFlightRef.current = false;
        if (queuedSaveRef.current) {
          queuedSaveRef.current = false;
          flushOfficeSave();
        }
      });

    if (supabaseOperatorRef.current) {
      void syncWorkspaceSnapshotToSupabase({
        uid: supabaseOperatorRef.current.uid,
        activeOwnerId: latestMetaRef.current.ownerId,
        revision: officeRevisionRef.current ?? 1,
        seed: latestSeedRef.current,
      }).catch(() => {
        // Non-blocking background snapshot sync
      });
    }
  }, [officeSessionReady, officeSessionRole, currentPersona.role]);

  useEffect(() => {
    if (!canSyncOfficeDb || !officeSessionReady || officeSessionRole !== 'staff' || !officeHydratedRef.current) return;
    if (currentPersona.role === 'Auditor / Read-only reviewer') return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    dirtyForSaveRef.current = true;
    if (pendingSaveTimerRef.current) {
      window.clearTimeout(pendingSaveTimerRef.current);
    }

    pendingSaveTimerRef.current = window.setTimeout(() => {
      pendingSaveTimerRef.current = null;
      flushOfficeSave();
    }, 250);
  }, [canSyncOfficeDb, officeSessionReady, officeSessionRole, currentPersona.role, seed, flushOfficeSave]);

  useEffect(() => {
    if (!canSyncOfficeDb || !officeSessionReady || officeSessionRole !== 'staff') return;
    const flushPendingSave = () => {
      if (!dirtyForSaveRef.current || currentPersona.role === 'Auditor / Read-only reviewer') return;
      dirtyForSaveRef.current = false;
      if (pendingSaveTimerRef.current) {
        window.clearTimeout(pendingSaveTimerRef.current);
        pendingSaveTimerRef.current = null;
      }
      void fetch('/api/office/state', {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: latestSeedRef.current,
          updatedBy: latestMetaRef.current.username || 'office-user',
          originClientId: getRealtimeClientId(),
          ownerId: latestMetaRef.current.ownerId,
        }),
      }).catch(() => {
        // Ignore unload network interruptions
      });
    };
    window.addEventListener('pagehide', flushPendingSave);
    return () => {
      window.removeEventListener('pagehide', flushPendingSave);
    };
  }, [canSyncOfficeDb, officeSessionReady, officeSessionRole, currentPersona.role]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4));
      setTimeout(() => {
        dismissToast(id);
      }, 5000);
    },
    [dismissToast]
  );

  const appendAuditEvent = useCallback(
    (
      prev: SeedState,
      event: Omit<AuditEvent, 'id' | 'timestamp' | 'actor' | 'actorId' | 'persona' | 'executionMode'>
    ): AuditEvent[] => {
      const entry: AuditEvent = {
        ...event,
        id: `AUD-${9000 + prev.auditEvents.length + 1}`,
        timestamp: nowTimestamp(),
        actor: session.actorName || currentPersona.displayName,
        actorId: session.actorId,
        persona: currentPersona.role,
        executionMode: 'Simulation',
      };
      if (supabaseOperatorRef.current && import.meta.env?.MODE !== 'test') {
        void appendAuditEventToSupabase({
          uid: supabaseOperatorRef.current.uid,
          ownerEntityId: entry.ownerId,
          eventId: entry.id,
          actor: entry.actor,
          action: entry.action,
          sha256Hash: entry.id,
        }).catch(() => {
          // Non-blocking audit mirror
        });
      }
      return [entry, ...prev.auditEvents];
    },
    [currentPersona, session.actorId, session.actorName]
  );

  const logPermissionDenial = useCallback(
    (module: AuditEvent['module'], actionLabel: string, reason: string, recordId = 'POLICY-CHECK') => {
      setSeed((prev) => ({
        ...prev,
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Security & Access',
          action: `Denied: ${actionLabel}`,
          recordType: module,
          recordId,
          reason,
          afterValues: { allowed: false, actorId: session.actorId, role: currentPersona.role },
        }),
      }));
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, session.actorId]
  );

  const loginWithTrainingAccount = useCallback(
    (
      rawUsername: string,
      rawPassword: string,
      initialOwnerId?: OwnerId
    ): { ok: boolean; error?: string } => {
      const normalizedUser = rawUsername.trim().toLowerCase();
      const account = TRAINING_ACCOUNTS.find((a) => a.username.toLowerCase() === normalizedUser);
      if (!account) {
        return {
          ok: false,
          error:
            locale === 'am'
              ? 'የተጠቃሚ ስም በስልጠና ማውጫ ውስጥ አልተገኘም።'
              : 'Training username not found in synthetic account directory.',
        };
      }
      if (rawPassword.trim() !== account.tempPasswordPlaceholder) {
        return {
          ok: false,
          error:
            locale === 'am'
              ? 'የስልጠና የይለፍ ቃል አልተዛመደም። ከታች ያለውን የስልጠና መለያ ማጣቀሻ ሰንጠረዥ ይመልከቱ።'
              : 'Training password does not match placeholder credential. Check the synthetic training account reference table below.',
        };
      }

      const profile =
        DEMO_PERSONAS.find((p) => p.role === account.role) || DEMO_PERSONAS[0];
      const requestedOwner = initialOwnerId || account.defaultOwnerId;
      const chosenOwner: OwnerId = account.allowedOwners.includes(requestedOwner)
        ? requestedOwner
        : account.defaultOwnerId;

      const startTs = nowTimestamp();
      const expTs = addHoursTimestamp(4);

      setCurrentPersona({
        ...profile,
        syntheticId: account.actorId,
        displayName: account.displayName,
        defaultOwnerId: account.defaultOwnerId,
      });
      setActiveOwnerId(chosenOwner);
      setSession({
        actorId: account.actorId,
        actorName: account.displayName,
        username: account.username,
        assignedRoles: [account.role],
        activeOwnerScope: chosenOwner,
        sessionStartTime: startTs,
        sessionExpiryTime: expTs,
        isTrainer: Boolean(account.isTrainer),
      });
      setActiveSection(resolveInitialSectionFromPath());
      setIsAuthenticated(true);

      if (canSyncOfficeDb) {
        setOfficeSessionReady(false);
        void fetch('/api/office/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: account.username,
            password: rawPassword.trim(),
          }),
        })
          .then((res) => {
            const ct = res.headers.get('content-type') || '';
            if (res.ok && ct.includes('application/json')) {
              setOfficeSessionRole('staff');
              setOfficeSessionReady(true);
            }
          })
          .catch(() => {
            // Static or offline preview operates cleanly in memory
          });
      }

      setSeed((prev) => ({
        ...prev,
        auditEvents: [
          {
            id: `AUD-${9000 + prev.auditEvents.length + 1}`,
            ownerId: chosenOwner,
            timestamp: startTs,
            actor: account.displayName,
            actorId: account.actorId,
            persona: account.role,
            executionMode: 'Simulation',
            module: 'Security & Access',
            action: 'Training Session Started',
            recordType: 'Session',
            recordId: account.actorId,
            reason: `Training login (${account.username}) as ${account.role} scoped to ${chosenOwner}. Role fixed for session duration.`,
            afterValues: {
              username: account.username,
              actorId: account.actorId,
              role: account.role,
              ownerScope: chosenOwner,
              expiry: expTs,
              trainingOnly: true,
            },
          },
          ...prev.auditEvents,
        ],
      }));

      notify({
        tone: 'info',
        title: `Signed in (${account.username}) · ${account.role}`,
        detail: `Actor ${account.actorId} · Owner context: ${chosenOwner === 'OWN-ALPHA' ? 'Test Owner Alpha' : 'Test Owner Beta'}.`,
      });
      return { ok: true };
    },
    [canSyncOfficeDb, locale, notify]
  );

  const loginWithSupabaseOperator = useCallback(
    (operator: SupabaseAuthenticatedOperator, initialOwnerId?: OwnerId) => {
      supabaseOperatorRef.current = operator;
      const profile = DEMO_PERSONAS[0];
      const chosenOwner: OwnerId = initialOwnerId || 'OWN-ALPHA';
      const startTs = nowTimestamp();
      const expTs = addHoursTimestamp(4);

      setCurrentPersona({
        ...profile,
        syntheticId: operator.uid,
        displayName: operator.displayName,
        defaultOwnerId: chosenOwner,
      });
      setActiveOwnerId(chosenOwner);
      setSession({
        actorId: operator.uid,
        actorName: operator.displayName,
        username: operator.email || operator.uid,
        assignedRoles: [profile.role],
        activeOwnerScope: chosenOwner,
        sessionStartTime: startTs,
        sessionExpiryTime: expTs,
        isTrainer: false,
      });
      setActiveSection('dashboard');
      setIsAuthenticated(true);

      setSeed((prev) => ({
        ...prev,
        auditEvents: [
          {
            id: `AUD-${9000 + prev.auditEvents.length + 1}`,
            ownerId: chosenOwner,
            timestamp: startTs,
            actor: operator.displayName,
            actorId: operator.uid,
            persona: profile.role,
            executionMode: 'Simulation',
            module: 'Security & Access',
            action: 'Supabase Google Session Started',
            recordType: 'Session',
            recordId: operator.uid,
            reason: `Verified Google Supabase session (${operator.email}) scoped to ${chosenOwner}.`,
          },
          ...prev.auditEvents,
        ],
      }));

      void syncWorkspaceSnapshotToSupabase({
        uid: operator.uid,
        activeOwnerId: chosenOwner,
        revision: officeRevisionRef.current ?? 1,
        seed: latestSeedRef.current,
      }).catch(() => {
        // Non-blocking initial snapshot sync
      });

      notify({
        tone: 'info',
        title: `Signed in (${operator.email || operator.displayName})`,
        detail: `Verified Google session scoped to ${chosenOwner === 'OWN-ALPHA' ? 'Test Owner Alpha' : 'Test Owner Beta'}.`,
      });
    },
    [notify]
  );

  const logoutToLogin = useCallback(() => {
    setSeed((prev) => ({
      ...prev,
      auditEvents: appendAuditEvent(prev, {
        ownerId: activeOwnerId,
        module: 'Security & Access',
        action: 'Training Session Signed Out',
        recordType: 'Session',
        recordId: session.actorId,
        reason: `Signed out account ${session.username} (${currentPersona.role}).`,
      }),
    }));
    supabaseOperatorRef.current = null;
    setSupabaseUid(null);
    setOfficeSessionReady(false);
    setOfficeSessionRole(null);
    officeHydratedRef.current = false;
    disconnectRealtimeSocket();
    try {
      localStorage.removeItem('adprms.push.subscription.local');
    } catch {
      // Ignore storage cleanup error
    }
    if (canSyncOfficeDb) {
      void fetch('/api/office/auth/logout', { method: 'POST' }).catch(() => {});
    }
    void signOutSupabase();
    setCommandPaletteOpen(false);
    setIsAuthenticated(false);
    setActiveSection('dashboard');
  }, [activeOwnerId, appendAuditEvent, canSyncOfficeDb, currentPersona.role, session.actorId, session.username]);

  const switchOwnerContext = useCallback(
    (ownerId: OwnerId) => {
      const scope = canSwitchOwnerForRole(currentPersona.role);
      if (!scope.canSwitch) {
        logPermissionDenial('Security & Access', 'Owner Context Switch', scope.note, ownerId);
        notify({
          tone: 'warning',
          title: 'Owner Scope Restricted',
          detail: scope.note,
        });
        return;
      }
      setActiveOwnerId(ownerId);
      setSession((prev) => ({ ...prev, activeOwnerScope: ownerId }));
      setSeed((prev) => ({
        ...prev,
        auditEvents: appendAuditEvent(prev, {
          ownerId,
          module: 'Security & Access',
          action: 'Owner Context Switched',
          recordType: 'OwnerEntity',
          recordId: ownerId,
          reason: `Switched isolated workspace context to ${ownerId}.`,
        }),
      }));
      notify({
        tone: 'info',
        title: `Owner Context: ${ownerId === 'OWN-ALPHA' ? 'Test Owner Alpha' : 'Test Owner Beta'}`,
        detail: 'All views, KPIs, source cards, compliance registers, and ledgers are isolated to this owner.',
      });
    },
    [appendAuditEvent, currentPersona.role, logPermissionDenial, notify]
  );

  const logCrossOwnerDeniedAttempt = useCallback(
    (targetOwnerId: OwnerId) => {
      const scope = canSwitchOwnerForRole(currentPersona.role);
      const reason = `Actor ${session.actorId} (${currentPersona.role}) attempted cross-owner access to ${targetOwnerId} while locked to ${activeOwnerId}. ${scope.note}`;
      logPermissionDenial('Security & Access', 'Cross-Owner Access Attempt Blocked', reason, targetOwnerId);
      notify({
        tone: 'error',
        title: 'Cross-Owner Access Blocked (Audit Logged)',
        detail: `Target owner ${targetOwnerId} cannot be accessed by ${session.username}. Denial recorded in Audit Trail.`,
      });
    },
    [activeOwnerId, currentPersona.role, logPermissionDenial, notify, session.actorId, session.username]
  );

  const attemptSelfApprovalAudit = useCallback(
    (approvalId: string) => {
      const req = seed.approvals.find((a) => a.id === approvalId && a.ownerId === activeOwnerId);
      if (!req) return;
      const reason = `Actor ${session.actorId} (${currentPersona.role}) attempted self-approval on maker-owned request ${req.requestNumber} (${req.makerActorId}). Strictly blocked.`;
      logPermissionDenial('Approvals Centre', 'Self-Approval Attempt Blocked (Actor ID)', reason, req.id);
      notify({
        tone: 'error',
        title: `Self-Approval Blocked (${req.requestNumber})`,
        detail: `Actor ${session.actorId} is the maker and cannot approve this request. Event written to immutable Audit Trail.`,
      });
    },
    [activeOwnerId, currentPersona.role, logPermissionDenial, notify, seed.approvals, session.actorId]
  );

  const resetDemoData = useCallback(() => {
    if (!session.isTrainer) {
      logPermissionDenial(
        'Administration',
        'Trainer Seed Data Reset',
        `Account ${session.username} (${currentPersona.role}) lacks trainer authority. Only trainer.demo may reset synthetic training data.`,
        'SEED-RESET'
      );
      notify({
        tone: 'error',
        title: 'Reset Restricted to Trainer Account',
        detail: 'Sign in as trainer.demo (Training Coordinator) to reset synthetic seed data.',
      });
      return;
    }
    const freshSeed = createInitialSeedState();
    const ts = nowTimestamp();
    const nextResetState: SeedState = {
      ...freshSeed,
      auditEvents: [
        {
          id: `AUD-${9000 + freshSeed.auditEvents.length + 1}`,
          ownerId: activeOwnerId,
          timestamp: ts,
          actor: session.actorName,
          actorId: session.actorId,
          persona: currentPersona.role,
          executionMode: 'Simulation',
          module: 'Administration',
          action: 'Trainer Seed Data Reset Executed',
          recordType: 'TrainingSeed',
          recordId: 'SEED-RESET',
          reason: `Synthetic demo data and exercise checklist reset by ${session.username} (${session.actorId}).`,
        },
        ...freshSeed.auditEvents,
      ],
    };
    skipNextSaveRef.current = true;
    setSeed(nextResetState);
    if (canSyncOfficeDb && officeSessionReady) {
      void fetch('/api/office/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: nextResetState,
          originClientId: getRealtimeClientId(),
          ownerId: activeOwnerId,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            const json = (await res.json()) as { revision?: number };
            if (typeof json.revision === 'number') {
              officeRevisionRef.current = json.revision;
            }
          }
        })
        .catch(() => {
          // Ignore offline errors cleanly
        });
    }
    setCompletedExerciseIds([]);
    const resetChecks: Record<string, boolean[]> = {};
    TRAINING_EXERCISES.forEach((ex) => {
      resetChecks[ex.id] = ex.steps.map(() => false);
    });
    setExerciseStepChecks(resetChecks);
    notify({
      tone: 'success',
      title: 'Training Environment Reset (Trainer Control)',
      detail: 'All synthetic records, compliance registers, approvals, and SQLite office persistence were restored.',
    });
  }, [activeOwnerId, canSyncOfficeDb, currentPersona.role, logPermissionDenial, notify, officeSessionReady, session.actorId, session.actorName, session.isTrainer, session.username]);

  const toggleExerciseStep = useCallback((exerciseId: string, stepIndex: number) => {
    setExerciseStepChecks((prev) => {
      const current = prev[exerciseId] || [];
      const nextArr = current.map((val, idx) => (idx === stepIndex ? !val : val));
      return { ...prev, [exerciseId]: nextArr };
    });
  }, []);

  const markExerciseComplete = useCallback(
    (exerciseId: string) => {
      const ex = TRAINING_EXERCISES.find((e) => e.id === exerciseId);
      if (!ex) return;
      setCompletedExerciseIds((prev) => (prev.includes(exerciseId) ? prev : [...prev, exerciseId]));
      setExerciseStepChecks((prev) => ({
        ...prev,
        [exerciseId]: ex.steps.map(() => true),
      }));
      setSeed((prev) => ({
        ...prev,
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Training Exercises',
          action: `Training Exercise Completed (#${ex.number})`,
          recordType: 'TrainingExercise',
          recordId: ex.id,
          reason: `Completed guided training exercise "${ex.title}" under ${session.username}.`,
        }),
      }));
      notify({
        tone: 'success',
        title: `Exercise #${ex.number} Completed`,
        detail: ex.title,
      });
    },
    [activeOwnerId, appendAuditEvent, notify, session.username]
  );

  const markNotificationRead = useCallback((id: string) => {
    setSeed((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }, []);

  const createProperty = useCallback(
    (input: {
      name: string;
      code: string;
      propertyType: 'Mixed-Use Commercial' | 'Commercial Office';
      subCity: string;
      woreda: string;
      streetPlaceholder: string;
      evidenceRef: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'create_property_unit');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const propId = `PROP-${Date.now()}`;
      setSeed((prev) => {
        const newProp: PropertyRecord = {
          id: propId,
          ownerId: activeOwnerId,
          code: input.code,
          name: input.name,
          propertyType: input.propertyType,
          status: 'Active',
          effectiveDate: new Date().toISOString().slice(0, 10),
          evidenceRef: input.evidenceRef,
          addressCard: {
            subCity: input.subCity,
            woreda: input.woreda,
            streetPlaceholder: input.streetPlaceholder,
            landmarkPlaceholder: 'Synthetic Landmark Marker',
            geoNote: 'Map card placeholder — no live GIS / GPS integration',
          },
        };
        const newBld: BuildingRecord = {
          id: `BLD-${Date.now()}`,
          ownerId: activeOwnerId,
          propertyId: propId,
          code: `${input.code}-BLD1`,
          name: `${input.name} — Building 1`,
          floors: 2,
          status: 'Active',
          yearBuiltPlaceholder: '2026 (Synthetic)',
        };
        return {
          ...prev,
          properties: [newProp, ...prev.properties],
          buildings: [newBld, ...prev.buildings],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Property Portfolio',
            action: 'Synthetic Property Created',
            recordType: 'Property',
            recordId: propId,
            reason: `Registered synthetic property ${input.name}.`,
            evidenceRef: input.evidenceRef,
            afterValues: { code: input.code, name: input.name, ownerId: activeOwnerId },
          }),
        };
      });
      notify({
        tone: 'success',
        title: 'Synthetic Property Registered',
        detail: `${input.name} added under ${activeOwnerId === 'OWN-ALPHA' ? 'Test Owner Alpha' : 'Test Owner Beta'}.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, notify]
  );

  const createUnit = useCallback(
    (input: {
      propertyId: string;
      buildingId: string;
      code: string;
      name: string;
      floor: number;
      areaSqm: number;
      unitType: 'Retail Ground' | 'Office Suite' | 'Commercial Hall';
      status: UnitStatus;
      baseRentEtb: number;
      evidenceRef: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'create_property_unit');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const unitId = `UNIT-${Date.now()}`;
      const today = new Date().toISOString().slice(0, 10);
      setSeed((prev) => {
        const newUnit: UnitRecord = {
          id: unitId,
          ownerId: activeOwnerId,
          propertyId: input.propertyId,
          buildingId: input.buildingId,
          code: input.code,
          name: input.name,
          floor: input.floor,
          areaSqm: input.areaSqm,
          unitType: input.unitType,
          status: input.status,
          baseRentEtb: input.baseRentEtb,
          previousIdentifiers: [],
          history: [
            {
              id: `UH-${Date.now()}`,
              date: today,
              type: 'Created',
              newIdentifier: input.code,
              detail: `Created unit ${input.name} (${input.areaSqm} sqm).`,
              actor: currentPersona.displayName,
              evidenceRef: input.evidenceRef,
            },
          ],
        };
        return {
          ...prev,
          units: [...prev.units, newUnit],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Property Portfolio',
            action: 'Synthetic Unit Created',
            recordType: 'Unit',
            recordId: unitId,
            reason: `Added ${input.name} to portfolio.`,
            evidenceRef: input.evidenceRef,
            afterValues: { code: input.code, status: input.status, baseRentEtb: input.baseRentEtb },
          }),
        };
      });
      notify({ tone: 'success', title: 'Unit Added', detail: `${input.name} created.` });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify]
  );

  const updateUnitStatus = useCallback(
    (unitId: string, newStatus: UnitStatus, reason: string, evidenceRef: string) => {
      const perm = checkActionPermission(currentPersona.role, 'create_property_unit');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const target = seed.units.find((u) => u.id === unitId && u.ownerId === activeOwnerId);
      if (!target) return false;
      const oldStatus = target.status;
      const today = new Date().toISOString().slice(0, 10);

      setSeed((prev) => ({
        ...prev,
        units: prev.units.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: newStatus,
                history: [
                  {
                    id: `UH-${Date.now()}`,
                    date: today,
                    type: 'Status Change',
                    detail: `Status changed from ${oldStatus} to ${newStatus}: ${reason}`,
                    actor: currentPersona.displayName,
                    evidenceRef,
                  },
                  ...u.history,
                ],
              }
            : u
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Property Portfolio',
          action: 'Unit Status Updated',
          recordType: 'Unit',
          recordId: unitId,
          reason,
          evidenceRef,
          beforeValues: { status: oldStatus },
          afterValues: { status: newStatus },
        }),
      }));

      notify({
        tone: 'success',
        title: 'Unit Status Updated',
        detail: `${target.name} transitioned to ${newStatus}.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify, seed.units]
  );

  const createApprovalRecord = useCallback(
    (
      prev: SeedState,
      params: {
        category: ApprovalCategory;
        title: string;
        targetRecordType: string;
        targetRecordId: string;
        requiredCheckerRoles: PersonaRole[];
        escalatorRoles?: PersonaRole[];
        workflowMode?: ApprovalWorkflowMode;
        stepLabels?: string[];
        amountThresholdPlaceholder?: string;
        supersedesRequestId?: string;
        effectiveDate: string;
        evidenceRef: string;
        reason: string;
        beforeValues: Record<string, string | number>;
        afterValues: Record<string, string | number>;
        payload: Record<string, unknown>;
      }
    ): ApprovalRequest => {
      const num = 1000 + prev.approvals.length + 1;
      const mode: ApprovalWorkflowMode =
        params.workflowMode || (params.escalatorRoles && params.escalatorRoles.length > 0 ? 'Two-Step' : 'One-Step');
      const totalSteps = mode === 'Multi-Step' ? 3 : mode === 'Two-Step' ? 2 : 1;
      const todayPlus7 = new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10);
      const todayPlus21 = new Date(Date.now() + 21 * 86400 * 1000).toISOString().slice(0, 10);
      return {
        id: `APR-${num}`,
        ownerId: activeOwnerId,
        requestNumber: `REQ-SYNTH-2026-${String(prev.approvals.length + 1).padStart(3, '0')}`,
        category: params.category,
        title: params.title,
        targetRecordType: params.targetRecordType,
        targetRecordId: params.targetRecordId,
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        makerPersona: currentPersona.role,
        workflowMode: mode,
        currentStep: 1,
        totalSteps,
        stepLabels:
          params.stepLabels ||
          (totalSteps === 1
            ? ['Step 1: Checker Review & Sign-Off']
            : ['Step 1: Primary Checker Review', 'Step 2: Escalated Owner / GM Sign-Off']),
        requiredCheckerRoles: params.requiredCheckerRoles,
        escalatorRoles: params.escalatorRoles,
        amountThresholdPlaceholder: params.amountThresholdPlaceholder || 'Standard Maker-Checker Policy (Synthetic)',
        dueDate: todayPlus7,
        expiryDate: todayPlus21,
        reminderSentPlaceholder: false,
        escalated: false,
        submittedAt: nowTimestamp().slice(0, 16),
        effectiveDate: params.effectiveDate,
        evidenceRef: params.evidenceRef,
        evidenceChecklist: [
          {
            id: 'CHK-1',
            label: `Documentary evidence placeholder (${params.evidenceRef})`,
            verifiedPlaceholder: true,
          },
        ],
        reason: params.reason,
        status: 'Pending',
        finalized: false,
        supersedesRequestId: params.supersedesRequestId,
        beforeValues: params.beforeValues,
        afterValues: params.afterValues,
        payload: params.payload,
        decisionLog: [
          {
            timestamp: nowTimestamp().slice(0, 16),
            actor: currentPersona.displayName,
            actorId: session.actorId,
            persona: currentPersona.role,
            action: 'Submitted',
            comment: params.reason,
          },
        ],
      };
    },
    [activeOwnerId, currentPersona, session.actorId]
  );

  const requestUnitRenumbering = useCallback(
    (input: {
      unitId: string;
      newCode: string;
      effectiveDate: string;
      evidenceRef: string;
      reason: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'request_unit_renumber');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const unit = seed.units.find((u) => u.id === input.unitId && u.ownerId === activeOwnerId);
      if (!unit) return false;

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Unit Renumbering',
          title: `Renumber ${unit.name} (${unit.code} → ${input.newCode})`,
          targetRecordType: 'Unit',
          targetRecordId: unit.id,
          requiredCheckerRoles: ['General Manager', 'Owner / Director', 'Finance Officer'],
          effectiveDate: input.effectiveDate,
          evidenceRef: input.evidenceRef,
          reason: input.reason,
          beforeValues: { unitCode: unit.code, unitName: unit.name },
          afterValues: {
            unitCode: input.newCode,
            unitName: `SYNTH Unit ${input.newCode}`,
            preservedAlias: unit.code,
          },
          payload: { unitId: unit.id, newCode: input.newCode, newName: `SYNTH Unit ${input.newCode}` },
        });
        return {
          ...prev,
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Property Portfolio',
            action: 'Unit Renumbering Requested',
            recordType: 'Unit',
            recordId: unit.id,
            reason: input.reason,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
            beforeValues: { code: unit.code },
            afterValues: { proposedCode: input.newCode },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Renumbering Submitted to Approvals Centre',
        detail: 'Old identifier will be preserved in unit history upon checker approval.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, seed.units]
  );

  const requestOwnershipChange = useCallback(
    (input: {
      propertyId: string;
      proposedOwnerName: string;
      effectiveDate: string;
      evidenceRef: string;
      reason: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'request_ownership_change');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const prop = seed.properties.find((p) => p.id === input.propertyId && p.ownerId === activeOwnerId);
      const owner = seed.owners.find((o) => o.id === activeOwnerId);
      if (!prop || !owner) return false;

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Ownership Change',
          title: `Property Ownership Change Request: ${prop.name}`,
          targetRecordType: 'Property',
          targetRecordId: prop.id,
          requiredCheckerRoles: ['Owner / Director', 'General Manager'],
          effectiveDate: input.effectiveDate,
          evidenceRef: input.evidenceRef,
          reason: input.reason,
          beforeValues: { propertyName: prop.name, ownerName: owner.name },
          afterValues: { propertyName: prop.name, proposedOwnerRef: input.proposedOwnerName },
          payload: { propertyId: prop.id, proposedOwnerName: input.proposedOwnerName },
        });
        return {
          ...prev,
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Property Portfolio',
            action: 'Ownership Change Requested',
            recordType: 'Property',
            recordId: prop.id,
            reason: input.reason,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
            beforeValues: { owner: owner.name },
            afterValues: { proposedOwner: input.proposedOwnerName },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Ownership Change Request Submitted',
        detail: 'Requires maker-checker approval and onboarding evidence verification.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, seed.owners, seed.properties]
  );

  const createLease = useCallback(
    (input: {
      unitId: string;
      tenantId: string;
      startDate: string;
      endDate: string;
      monthlyRentEtb: number;
      securityDepositEtb: number;
      evidenceRef: string;
      notes: string;
      contractLanguage?: 'en' | 'am' | 'om';
      oromifaContract?: OromifaContractData;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'create_lease');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const unit = seed.units.find((u) => u.id === input.unitId && u.ownerId === activeOwnerId);
      const tenant = seed.tenants.find((t) => t.id === input.tenantId && t.ownerId === activeOwnerId);
      if (!unit || !tenant) return false;

      const leaseId = `LSE-${Date.now()}`;
      const leaseNumber = `LSE-SYNTH-${unit.code.replace('-', '')}`;
      const period = input.startDate.slice(0, 7);

      setSeed((prev) => {
        const newLease: LeaseRecord = {
          id: leaseId,
          ownerId: activeOwnerId,
          leaseNumber,
          version: 1,
          unitId: unit.id,
          tenantId: tenant.id,
          status: 'Active',
          startDate: input.startDate,
          endDate: input.endDate,
          monthlyRentEtb: input.monthlyRentEtb,
          securityDepositEtb: input.securityDepositEtb,
          billingCycle: 'Monthly',
          createdBy: currentPersona.displayName,
          evidenceRef: input.evidenceRef,
          notes: input.notes,
          contractLanguage: input.contractLanguage,
          oromifaContract: input.oromifaContract,
          schedule: [
            {
              period,
              dueDate: `${period}-05`,
              amountEtb: input.monthlyRentEtb,
              status: 'Scheduled',
            },
          ],
          timeline: [
            {
              date: new Date().toISOString().slice(0, 10),
              event:
                input.contractLanguage === 'om'
                  ? 'Lease v1 created with Afaan Oromoo (Oromifa) Waliigaltee contract'
                  : 'Lease v1 created in prototype simulation',
              actor: currentPersona.displayName,
            },
          ],
        };

        const newCharge: ChargeRecord = {
          id: `CHG-${Date.now()}`,
          ownerId: activeOwnerId,
          leaseId,
          tenantId: tenant.id,
          unitId: unit.id,
          period,
          invoiceNumber: `INV-SYNTH-${unit.code}-${period.replace('-', '')}`,
          dueDate: `${period}-05`,
          billedEtb: input.monthlyRentEtb,
          paidEtb: 0,
          status: 'Open',
        };

        return {
          ...prev,
          leases: [newLease, ...prev.leases],
          charges: [newCharge, ...prev.charges],
          units: prev.units.map((u) =>
            u.id === unit.id
              ? {
                  ...u,
                  status: 'Occupied',
                  currentTenantId: tenant.id,
                  currentLeaseId: leaseId,
                  history: [
                    {
                      id: `UH-${Date.now()}`,
                      date: new Date().toISOString().slice(0, 10),
                      type: 'Lease Assigned',
                      detail: `Assigned to ${tenant.name} under ${leaseNumber} v1.`,
                      actor: currentPersona.displayName,
                      evidenceRef: input.evidenceRef,
                    },
                    ...u.history,
                  ],
                }
              : u
          ),
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Tenants & Leases',
            action: 'Synthetic Lease Created',
            recordType: 'Lease',
            recordId: leaseId,
            reason: `Created ${leaseNumber} v1 for ${tenant.name}.`,
            evidenceRef: input.evidenceRef,
            afterValues: {
              leaseNumber,
              version: 1,
              monthlyRentEtb: input.monthlyRentEtb,
            },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Synthetic Lease Created',
        detail: `${leaseNumber} v1 activated for ${unit.name}.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify, seed.tenants, seed.units]
  );

  const renewLease = useCallback(
    (input: {
      leaseId: string;
      newStartDate: string;
      newEndDate: string;
      newMonthlyRentEtb: number;
      evidenceRef: string;
      notes: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'renew_lease');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const oldLease = seed.leases.find((l) => l.id === input.leaseId && l.ownerId === activeOwnerId);
      if (!oldLease) return false;

      const newLeaseId = `${oldLease.leaseNumber}-V${oldLease.version + 1}-${Date.now().toString().slice(-4)}`;
      const newVersion = oldLease.version + 1;
      const period = input.newStartDate.slice(0, 7);

      setSeed((prev) => {
        const renewedLease: LeaseRecord = {
          ...oldLease,
          id: newLeaseId,
          version: newVersion,
          supersedesLeaseId: oldLease.id,
          supersededByLeaseId: undefined,
          status: 'Active',
          startDate: input.newStartDate,
          endDate: input.newEndDate,
          monthlyRentEtb: input.newMonthlyRentEtb,
          evidenceRef: input.evidenceRef,
          notes: input.notes,
          schedule: [
            {
              period,
              dueDate: `${period}-05`,
              amountEtb: input.newMonthlyRentEtb,
              status: 'Scheduled',
            },
          ],
          timeline: [
            {
              date: new Date().toISOString().slice(0, 10),
              event: `Lease v${newVersion} created (supersedes v${oldLease.version})`,
              actor: currentPersona.displayName,
            },
            ...oldLease.timeline,
          ],
        };

        return {
          ...prev,
          leases: [
            renewedLease,
            ...prev.leases.map((l) =>
              l.id === oldLease.id
                ? {
                    ...l,
                    status: 'Renewed' as const,
                    supersededByLeaseId: newLeaseId,
                    timeline: [
                      {
                        date: new Date().toISOString().slice(0, 10),
                        event: `Superseded by non-destructive renewal v${newVersion}`,
                        actor: currentPersona.displayName,
                      },
                      ...l.timeline,
                    ],
                  }
                : l
            ),
          ],
          units: prev.units.map((u) =>
            u.id === oldLease.unitId ? { ...u, currentLeaseId: newLeaseId } : u
          ),
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Tenants & Leases',
            action: 'Lease Renewed (New Version)',
            recordType: 'Lease',
            recordId: newLeaseId,
            reason: `Non-destructive renewal from v${oldLease.version} to v${newVersion}.`,
            evidenceRef: input.evidenceRef,
            beforeValues: {
              leaseId: oldLease.id,
              version: oldLease.version,
              monthlyRentEtb: oldLease.monthlyRentEtb,
            },
            afterValues: {
              leaseId: newLeaseId,
              version: newVersion,
              monthlyRentEtb: input.newMonthlyRentEtb,
            },
          }),
        };
      });

      notify({
        tone: 'success',
        title: `Lease Renewed as v${newVersion}`,
        detail: `Prior version v${oldLease.version} preserved with status Renewed.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify, seed.leases]
  );

  const recordPayment = useCallback(
    (input: {
      tenantId: string;
      amountEtb: number;
      method: PaymentMethod;
      paymentDate: string;
      referencePlaceholder: string;
      allocations: { chargeId: string; amountEtb: number }[];
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'record_payment');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return null;
      }

      const tenantCharges = seed.charges.filter(
        (c) => c.ownerId === activeOwnerId && c.tenantId === input.tenantId
      );
      if (tenantCharges.length === 0) return null;

      const receiptId = `RCT-${Date.now()}`;
      const seq = String(seed.receipts.length + 1).padStart(3, '0');
      const ownerTag = activeOwnerId === 'OWN-ALPHA' ? 'A' : 'B';

      const allocationDetails = input.allocations
        .filter((a) => a.amountEtb > 0)
        .map((a) => {
          const ch = tenantCharges.find((c) => c.id === a.chargeId);
          return {
            chargeId: a.chargeId,
            invoiceNumber: ch?.invoiceNumber || a.chargeId,
            allocatedEtb: a.amountEtb,
          };
        });

      const unitName =
        seed.units.find((u) => u.id === tenantCharges[0].unitId)?.name || tenantCharges[0].unitId;

      const receipt: PaymentReceipt = {
        id: receiptId,
        ownerId: activeOwnerId,
        receiptNumber: `DEMO-RCT-${ownerTag}-2026-${seq}`,
        tenantId: input.tenantId,
        unitId: tenantCharges[0].unitId,
        paymentDate: input.paymentDate,
        amountEtb: input.amountEtb,
        method: input.method,
        referencePlaceholder: input.referencePlaceholder,
        recordedBy: currentPersona.displayName,
        allocations: allocationDetails,
        documentState: 'Issued — Demo Only',
        lineDescription: `Synthetic rent allocation — ${unitName} (${allocationDetails.map((a) => a.invoiceNumber).join(', ')})`,
        taxableStatusPlaceholder: 'Undetermined — Tax Config Not Active',
        taxTreatmentPlaceholder: 'Pending Adviser Confirmation — No Live Tax Calculation',
        retentionClassPlaceholder: 'RET-02 · Retention duration pending professional confirmation',
        history: [
          {
            timestamp: nowTimestamp().slice(0, 16),
            event: 'Issued synthetic receipt placeholder (DEMO only)',
            actor: currentPersona.displayName,
            state: 'Issued — Demo Only',
          },
          {
            timestamp: nowTimestamp().slice(0, 16),
            event: 'Drafted receipt allocation',
            actor: currentPersona.displayName,
            state: 'Draft',
          },
        ],
      };

      setSeed((prev) => {
        const updatedCharges = prev.charges.map((c) => {
          const alloc = allocationDetails.find((a) => a.chargeId === c.id);
          if (!alloc) return c;
          const nextPaid = Math.min(c.billedEtb, c.paidEtb + alloc.allocatedEtb);
          const nextStatus =
            nextPaid >= c.billedEtb ? 'Paid' : nextPaid > 0 ? 'Partially Paid' : c.status;
          return { ...c, paidEtb: nextPaid, status: nextStatus } as ChargeRecord;
        });

        return {
          ...prev,
          charges: updatedCharges,
          receipts: [receipt, ...prev.receipts],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Rent & Collections',
            action: 'Synthetic Payment Recorded',
            recordType: 'PaymentReceipt',
            recordId: receipt.id,
            reason: `Recorded ${input.method} payment ETB ${input.amountEtb.toLocaleString()} across ${allocationDetails.length} charge(s).`,
            evidenceRef: input.referencePlaceholder,
            afterValues: {
              receiptNumber: receipt.receiptNumber,
              amountEtb: input.amountEtb,
              method: input.method,
              documentState: receipt.documentState,
            },
          }),
        };
      });

      notify({
        tone: 'success',
        title: `Synthetic Receipt ${receipt.receiptNumber} Issued`,
        detail: 'Allocated across selected synthetic receivables.',
      });
      return receipt;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify, seed.charges, seed.receipts.length, seed.units]
  );

  const submitGatewayPayment = useCallback(
    (input: {
      gatewayType: 'Telebirr USSD QR' | 'ArifPay Checkout' | 'CBE Transfer Slip';
      tenantId: string;
      unitId: string;
      chargeId: string;
      amountEtb: number;
      referenceNumber: string;
      phoneOrAccount: string;
      notes: string;
      ussdSessionId?: string;
      ussdDialString?: string;
      traceId?: string;
      arifpaySessionId?: string;
      arifpayNonce?: string;
      arifpayMethod?: 'TELEBIRR' | 'CBE';
      autoVerified?: boolean;
    }): PaymentReceipt | null => {
      const perm = checkActionPermission(currentPersona.role, 'record_payment');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return null;
      }

      const targetCharge = seed.charges.find(
        (c) => c.id === input.chargeId && c.ownerId === activeOwnerId
      );
      if (!targetCharge) {
        notify({
          tone: 'error',
          title: 'Invalid Charge Target',
          detail: 'Selected invoice does not belong to the active owner context.',
        });
        return null;
      }

      const openBalance = Math.max(0, targetCharge.billedEtb - targetCharge.paidEtb);
      const allocatedEtb = Math.min(Math.max(0, input.amountEtb), openBalance);
      if (allocatedEtb <= 0) {
        notify({
          tone: 'warning',
          title: 'Invoice Already Settled',
          detail: `${targetCharge.invoiceNumber} has zero remaining balance.`,
        });
        return null;
      }

      const tsMs = Date.now();
      const tsShort = nowTimestamp().slice(0, 16);
      const paymentId = `GATE-${tsMs}`;
      const receiptId = `RCT-GATE-${tsMs}`;
      const seqNum = String(seed.receipts.filter((r) => r.ownerId === activeOwnerId).length + 1).padStart(
        3,
        '0'
      );
      const receiptNumber = `DEMO-GATE-${activeOwnerId === 'OWN-ALPHA' ? 'A' : 'B'}-2026-${seqNum}`;
      const method: PaymentMethod =
        input.gatewayType === 'Telebirr USSD QR'
          ? 'Telebirr (Synthetic)'
          : input.gatewayType === 'ArifPay Checkout'
            ? 'ArifPay (Synthetic)'
            : 'Bank Transfer';
      const tenant = seed.tenants.find(
        (t) => t.id === input.tenantId && t.ownerId === activeOwnerId
      );
      const tenantName = tenant?.name || input.tenantId;
      const resolvedUnitId = targetCharge.unitId || input.unitId;
      const gatewayStatus: GatewayPaymentRecord['status'] = input.autoVerified
        ? 'Verified'
        : 'Pending Verification';

      const newReceipt: PaymentReceipt = {
        id: receiptId,
        ownerId: activeOwnerId,
        receiptNumber,
        tenantId: input.tenantId,
        unitId: resolvedUnitId,
        paymentDate: new Date().toISOString().slice(0, 10),
        amountEtb: allocatedEtb,
        method,
        referencePlaceholder: input.referenceNumber,
        recordedBy: `${currentPersona.displayName} (${input.gatewayType})`,
        allocations: [
          {
            chargeId: targetCharge.id,
            invoiceNumber: targetCharge.invoiceNumber,
            allocatedEtb,
          },
        ],
        documentState: 'Issued — Demo Only',
        lineDescription: `Synthetic ${input.gatewayType} settlement — ${targetCharge.invoiceNumber} · Ref: ${input.referenceNumber}`,
        taxableStatusPlaceholder: 'Undetermined — Tax Config Not Active',
        taxTreatmentPlaceholder: 'Pending Adviser Confirmation — No Live Tax Calculation',
        retentionClassPlaceholder: 'RET-02 · Retention duration pending professional confirmation',
        history: [
          {
            timestamp: tsShort,
            event: `Payment processed via ${input.gatewayType} (${input.ussdSessionId || input.referenceNumber}) for ${tenantName}`,
            actor: currentPersona.displayName,
            state: 'Issued — Demo Only',
          },
        ],
      };

      const newRecord: GatewayPaymentRecord = {
        id: paymentId,
        ownerId: activeOwnerId,
        gatewayType: input.gatewayType,
        tenantId: input.tenantId,
        unitId: resolvedUnitId,
        chargeId: targetCharge.id,
        amountEtb: allocatedEtb,
        referenceNumber: input.referenceNumber,
        status: gatewayStatus,
        submittedAt: tsShort,
        phoneOrAccount: input.phoneOrAccount,
        notes: input.notes,
        ussdSessionId: input.ussdSessionId,
        ussdDialString: input.ussdDialString,
        traceId: input.traceId,
        arifpaySessionId: input.arifpaySessionId,
        arifpayNonce: input.arifpayNonce,
        arifpayMethod: input.arifpayMethod,
        receiptId: newReceipt.id,
        ...(input.autoVerified
          ? {
              verifiedBy: `${input.gatewayType} Sandbox Webhook`,
              verifiedAt: tsShort,
            }
          : {}),
      };

      const notif: AppNotification = {
        id: `NOTIF-GATE-${tsMs}`,
        ownerId: activeOwnerId,
        title: `${input.gatewayType} Settlement (${receiptNumber})`,
        detail: `${tenantName} processed ETB ${allocatedEtb.toLocaleString()} for ${targetCharge.invoiceNumber} (Ref: ${input.referenceNumber}).`,
        targetSection: 'collections',
        timestamp: tsShort,
        read: false,
      };

      setSeed((prev) => ({
        ...prev,
        gatewayPayments: [newRecord, ...prev.gatewayPayments],
        receipts: [newReceipt, ...prev.receipts],
        notifications: [notif, ...prev.notifications],
        charges: prev.charges.map((c) => {
          if (c.id !== targetCharge.id) return c;
          const nextPaid = Math.min(c.billedEtb, c.paidEtb + allocatedEtb);
          return {
            ...c,
            paidEtb: nextPaid,
            status: nextPaid >= c.billedEtb ? 'Paid' : 'Partially Paid',
          };
        }),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Rent & Collections',
          action: `Gateway Payment Processed (${input.gatewayType})`,
          recordType: 'PaymentReceipt',
          recordId: newReceipt.id,
          reason: `${tenantName} settled ETB ${allocatedEtb.toLocaleString()} against ${targetCharge.invoiceNumber} via ${input.gatewayType} (${input.referenceNumber}).`,
          evidenceRef: input.referenceNumber,
          afterValues: {
            gatewayId: newRecord.id,
            receiptNumber,
            amountEtb: allocatedEtb,
            gatewayType: input.gatewayType,
            status: gatewayStatus,
            ussdSessionId: input.ussdSessionId || input.arifpaySessionId || 'N/A',
          },
        }),
      }));

      publishRealtimeEvent({
        type: 'payment:settled',
        ownerId: activeOwnerId,
        data: { gatewayPayment: newRecord, receipt: newReceipt, chargeId: targetCharge.id },
      });

      notify({
        tone: 'success',
        title: `${input.gatewayType} Payment Processed`,
        detail: `Issued ${receiptNumber} for ETB ${allocatedEtb.toLocaleString()} (${targetCharge.invoiceNumber}).`,
      });
      return newReceipt;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify, seed.charges, seed.receipts, seed.tenants]
  );

  const verifyGatewayPayment = useCallback(
    (gatewayId: string, decision: 'Verified' | 'Rejected', note?: string): boolean => {
      const perm = checkActionPermission(currentPersona.role, 'record_payment');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }

      const target = seed.gatewayPayments.find(
        (g) => g.id === gatewayId && g.ownerId === activeOwnerId
      );
      if (!target || target.status !== 'Pending Verification') return false;

      const tsShort = nowTimestamp().slice(0, 16);
      const targetCharge = seed.charges.find(
        (c) => c.id === target.chargeId && c.ownerId === activeOwnerId
      );
      const tenant = seed.tenants.find((t) => t.id === target.tenantId);

      setSeed((prev) => {
        let updatedReceipts = prev.receipts;
        let updatedCharges = prev.charges;
        let linkedReceiptId = target.receiptId;

        // If pending seed record had no receipt issued yet, issue & allocate on verification
        if (decision === 'Verified' && !target.receiptId && targetCharge) {
          const openBal = Math.max(0, targetCharge.billedEtb - targetCharge.paidEtb);
          const allocAmt = Math.min(target.amountEtb, openBal);
          if (allocAmt > 0) {
            const seq = String(prev.receipts.filter((r) => r.ownerId === activeOwnerId).length + 1).padStart(
              3,
              '0'
            );
            const rctNo = `DEMO-GATE-${activeOwnerId === 'OWN-ALPHA' ? 'A' : 'B'}-2026-${seq}`;
            const rctId = `RCT-VER-${Date.now()}`;
            linkedReceiptId = rctId;
            const newReceipt: PaymentReceipt = {
              id: rctId,
              ownerId: activeOwnerId,
              receiptNumber: rctNo,
              tenantId: target.tenantId,
              unitId: target.unitId,
              paymentDate: new Date().toISOString().slice(0, 10),
              amountEtb: allocAmt,
              method:
                target.gatewayType === 'Telebirr USSD QR'
                  ? 'Telebirr (Synthetic)'
                  : 'Bank Transfer',
              referencePlaceholder: target.referenceNumber,
              recordedBy: `${currentPersona.displayName} (Verified ${target.gatewayType})`,
              allocations: [
                {
                  chargeId: targetCharge.id,
                  invoiceNumber: targetCharge.invoiceNumber,
                  allocatedEtb: allocAmt,
                },
              ],
              documentState: 'Issued — Demo Only',
              lineDescription: `Verified ${target.gatewayType} payment — ${targetCharge.invoiceNumber} · Ref: ${target.referenceNumber}`,
              taxableStatusPlaceholder: 'Undetermined — Tax Config Not Active',
              taxTreatmentPlaceholder: 'Pending Adviser Confirmation — No Live Tax Calculation',
              retentionClassPlaceholder: 'RET-02 · Retention duration pending professional confirmation',
              history: [
                {
                  timestamp: tsShort,
                  event: `Gateway payment ${target.id} verified and receipt issued for ${tenant?.name || target.tenantId}`,
                  actor: currentPersona.displayName,
                  state: 'Issued — Demo Only',
                },
              ],
            };
            updatedReceipts = [newReceipt, ...prev.receipts];
            updatedCharges = prev.charges.map((c) => {
              if (c.id !== targetCharge.id) return c;
              const nextPaid = Math.min(c.billedEtb, c.paidEtb + allocAmt);
              return {
                ...c,
                paidEtb: nextPaid,
                status: nextPaid >= c.billedEtb ? 'Paid' : 'Partially Paid',
              };
            });
          }
        }

        return {
          ...prev,
          receipts: updatedReceipts,
          charges: updatedCharges,
          gatewayPayments: prev.gatewayPayments.map((g) =>
            g.id === gatewayId
              ? {
                  ...g,
                  status: decision,
                  receiptId: linkedReceiptId,
                  verifiedBy: currentPersona.displayName,
                  verifiedAt: tsShort,
                  notes: note ? `${g.notes} | ${note}` : g.notes,
                }
              : g
          ),
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Rent & Collections',
            action: `Gateway Payment ${decision}`,
            recordType: 'GatewayPayment',
            recordId: gatewayId,
            reason:
              note ||
              `${decision} ${target.gatewayType} submission ${target.referenceNumber} (ETB ${target.amountEtb.toLocaleString()}).`,
            evidenceRef: target.referenceNumber,
            afterValues: {
              gatewayId,
              status: decision,
              receiptId: linkedReceiptId || 'None',
            },
          }),
        };
      });

      notify({
        tone: decision === 'Verified' ? 'success' : 'warning',
        title: `Gateway Submission ${decision}`,
        detail: `${target.referenceNumber} (${target.gatewayType}) marked ${decision}.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify, seed.charges, seed.gatewayPayments, seed.tenants]
  );

  const requestReceiptVoid = useCallback(
    (input: { receiptId: string; evidenceRef: string; reason: string }) => {
      const perm = checkActionPermission(currentPersona.role, 'request_receipt_void');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const receipt = seed.receipts.find((r) => r.id === input.receiptId && r.ownerId === activeOwnerId);
      if (!receipt) return false;

      const ts = nowTimestamp().slice(0, 16);

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Receipt Void / Reversal',
          title: `Void / Reversal Request for ${receipt.receiptNumber}`,
          targetRecordType: 'PaymentReceipt',
          targetRecordId: receipt.id,
          requiredCheckerRoles: ['Finance Officer', 'General Manager', 'Owner / Director'],
          effectiveDate: new Date().toISOString().slice(0, 10),
          evidenceRef: input.evidenceRef,
          reason: input.reason,
          beforeValues: {
            receiptNumber: receipt.receiptNumber,
            amountEtb: receipt.amountEtb,
            documentState: receipt.documentState,
          },
          afterValues: {
            receiptNumber: receipt.receiptNumber,
            amountEtb: receipt.amountEtb,
            documentState: 'Reversed (Preserved in Ledger)',
          },
          payload: { receiptId: receipt.id },
        });
        return {
          ...prev,
          receipts: prev.receipts.map((r) =>
            r.id === receipt.id
              ? {
                  ...r,
                  documentState: 'Reversal Pending' as ReceiptDocumentState,
                  history: [
                    {
                      timestamp: ts,
                      event: `Void Requested & routed to Reversal Pending (${req.requestNumber})`,
                      actor: currentPersona.displayName,
                      state: 'Reversal Pending',
                    },
                    ...r.history,
                  ],
                }
              : r
          ),
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Rent & Collections',
            action: 'Receipt Void Requested',
            recordType: 'PaymentReceipt',
            recordId: receipt.id,
            reason: input.reason,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
            beforeValues: { documentState: receipt.documentState },
            afterValues: { documentState: 'Reversal Pending' },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Void / Reversal Request Submitted',
        detail: 'Receipt cannot be deleted; routed to Approvals Centre for checker review.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona, notify, seed.receipts]
  );

  const proposeAccountChange = useCallback(
    (input: {
      accountId: string;
      proposedName: string;
      effectiveDate: string;
      evidenceRef: string;
      reason: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'propose_account_change');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const acct = seed.accounts.find((a) => a.id === input.accountId && a.ownerId === activeOwnerId);
      if (!acct) return false;

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Account Change',
          title: `Draft Accounting Design v${acct.version + 1} Proposal: ${acct.code}`,
          targetRecordType: 'ChartOfAccount',
          targetRecordId: acct.id,
          requiredCheckerRoles: ['Owner / Director', 'General Manager'],
          effectiveDate: input.effectiveDate,
          evidenceRef: input.evidenceRef,
          reason: input.reason,
          beforeValues: { code: acct.code, name: acct.name, version: acct.version },
          afterValues: { code: acct.code, name: input.proposedName, version: acct.version + 1 },
          payload: { accountId: acct.id, newName: input.proposedName },
        });
        return {
          ...prev,
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Finance',
            action: 'Draft Account Design Change Proposed',
            recordType: 'ChartOfAccount',
            recordId: acct.id,
            reason: input.reason,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
            beforeValues: { name: acct.name, version: acct.version },
            afterValues: { proposedName: input.proposedName, proposedVersion: acct.version + 1 },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Draft Account Proposal Submitted',
        detail: `Queued for maker-checker review for ${acct.code} (no production posting).`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, seed.accounts]
  );

  const createTaxDraft = useCallback(
    (input: {
      code: string;
      taxCategory: string;
      propertyUseClassification: TaxRuleRecord['propertyUseClassification'];
      ownerEntityCategory: string;
      taxableStatus: TaxRuleRecord['taxableStatus'];
      effectiveDateFrom: string;
      effectiveDateTo: string;
      sourceReference: string;
      adviserEvidence: string;
      notes: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'draft_tax_rule');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const taxId = `TAX-${Date.now()}`;
      setSeed((prev) => {
        const rule: TaxRuleRecord = {
          id: taxId,
          ownerId: activeOwnerId,
          code: input.code,
          taxCategory: input.taxCategory,
          propertyUseClassification: input.propertyUseClassification,
          ownerEntityCategory: input.ownerEntityCategory,
          taxableStatus: input.taxableStatus,
          ratePlaceholder: 'Rate pending adviser confirmation',
          lifecycleStage: 'Draft',
          effectiveDateFrom: input.effectiveDateFrom || 'Pending Adviser',
          effectiveDateTo: input.effectiveDateTo || 'Undetermined',
          sourceReference: input.sourceReference,
          adviserEvidence: input.adviserEvidence || 'Unverified — Ethiopian licensed adviser confirmation required.',
          ownerApprovalReference: 'Not Approved',
          hasResearchConflict: input.taxCategory.toLowerCase().includes('withholding'),
          conflictNotice: input.taxCategory.toLowerCase().includes('withholding')
            ? 'Research conflict: withholding applicability requires adviser verification.'
            : undefined,
          notes: input.notes,
          version: 1,
          createdBy: currentPersona.displayName,
          versions: [
            {
              version: 1,
              effectiveDateFrom: input.effectiveDateFrom || 'Pending Adviser',
              effectiveDateTo: input.effectiveDateTo || 'Undetermined',
              ratePlaceholder: 'Rate pending adviser confirmation',
              taxableStatus: input.taxableStatus,
              lifecycleStage: 'Draft',
              sourceReference: input.sourceReference,
              adviserEvidence: input.adviserEvidence || 'Pending',
              ownerApprovalReference: 'Not Approved',
              changedBy: currentPersona.displayName,
              note: input.notes || 'Created synthetic non-active tax draft.',
            },
          ],
        };
        return {
          ...prev,
          taxRules: [rule, ...prev.taxRules],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Tax Configuration',
            action: 'Synthetic Tax Draft Created',
            recordType: 'TaxRule',
            recordId: taxId,
            reason: 'Created non-active tax research draft (Active state disabled).',
            evidenceRef: input.sourceReference,
            afterValues: {
              code: input.code,
              taxCategory: input.taxCategory,
              lifecycleStage: 'Draft',
              ratePlaceholder: 'Rate pending adviser confirmation',
            },
          }),
        };
      });
      notify({
        tone: 'success',
        title: 'Synthetic Tax Draft Created',
        detail: `${input.code} saved in Draft stage (Active disabled).`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify]
  );

  const submitTaxForApproval = useCallback(
    (taxRuleId: string, evidenceRef: string, reason: string) => {
      const perm = checkActionPermission(currentPersona.role, 'request_tax_review');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const rule = seed.taxRules.find((t) => t.id === taxRuleId && t.ownerId === activeOwnerId);
      if (!rule) return false;

      const nextStage: TaxLifecycleStage =
        rule.lifecycleStage === 'Draft'
          ? 'Submitted for Review'
          : rule.lifecycleStage === 'Submitted for Review'
            ? 'Adviser Confirmed'
            : 'Owner Approved';

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Tax Rule Review',
          title: `Tax Review Simulation: ${rule.code} (${rule.lifecycleStage} → ${nextStage})`,
          targetRecordType: 'TaxRule',
          targetRecordId: rule.id,
          requiredCheckerRoles: ['Owner / Director', 'General Manager'],
          effectiveDate: rule.effectiveDateFrom,
          evidenceRef,
          reason,
          beforeValues: {
            code: rule.code,
            lifecycleStage: rule.lifecycleStage,
            ratePlaceholder: rule.ratePlaceholder,
          },
          afterValues: {
            code: rule.code,
            lifecycleStage: `${nextStage} (Active Disabled in Prototype)`,
            ratePlaceholder: rule.ratePlaceholder,
          },
          payload: { taxRuleId: rule.id, nextStage },
        });
        return {
          ...prev,
          taxRules: prev.taxRules.map((t) =>
            t.id === rule.id ? { ...t, lifecycleStage: 'Submitted for Review' } : t
          ),
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Tax Configuration',
            action: 'Tax Draft Submitted for Review',
            recordType: 'TaxRule',
            recordId: rule.id,
            reason,
            evidenceRef,
            linkedApprovalId: req.id,
            beforeValues: { lifecycleStage: rule.lifecycleStage },
            afterValues: { lifecycleStage: 'Submitted for Review', activeEnabled: false },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Submitted for Review Simulation',
        detail: 'Simulated approval and audit event created. Rule remains non-active.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, seed.taxRules]
  );

  const prepareAdviserPack = useCallback(
    (questionId: string, evidenceRef: string, notes: string) => {
      const perm = checkActionPermission(currentPersona.role, 'prepare_adviser_pack');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const q = seed.adviserQuestions.find((x) => x.id === questionId && x.ownerId === activeOwnerId);
      if (!q) return false;

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Adviser Pack',
          title: `Adviser Pack Prepared: ${q.question}`,
          targetRecordType: 'AdviserQuestion',
          targetRecordId: q.id,
          requiredCheckerRoles: ['Owner / Director', 'General Manager'],
          effectiveDate: 'Pending Adviser',
          evidenceRef,
          reason: notes || `Prepared simulated adviser briefing pack for: ${q.question}`,
          beforeValues: { status: q.status },
          afterValues: { status: 'Adviser Pack Prepared (Sim)' },
          payload: { questionId: q.id, targetStatus: 'Adviser Pack Prepared (Sim)' },
        });

        return {
          ...prev,
          adviserQuestions: prev.adviserQuestions.map((item) =>
            item.id === q.id ? { ...item, status: 'Adviser Pack Prepared (Sim)' } : item
          ),
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Compliance Readiness',
            action: 'Adviser Pack Prepared (Simulated)',
            recordType: 'AdviserQuestion',
            recordId: q.id,
            reason: notes || `Prepared adviser pack for unresolved compliance question.`,
            evidenceRef,
            linkedApprovalId: req.id,
            beforeValues: { status: q.status },
            afterValues: { status: 'Adviser Pack Prepared (Sim)' },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Simulated Adviser Pack Created',
        detail: 'Logged to Approvals Centre and Audit Trail. External adviser confirmation still required.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, seed.adviserQuestions]
  );

  const submitAdviserForOwnerDecision = useCallback(
    (questionId: string, evidenceRef: string, notes: string) => {
      const perm = checkActionPermission(currentPersona.role, 'submit_owner_decision');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const q = seed.adviserQuestions.find((x) => x.id === questionId && x.ownerId === activeOwnerId);
      if (!q) return false;

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Compliance Decision',
          title: `Owner Decision Request: ${q.question}`,
          targetRecordType: 'AdviserQuestion',
          targetRecordId: q.id,
          requiredCheckerRoles: ['Owner / Director', 'General Manager'],
          effectiveDate: 'Pending Owner Decision',
          evidenceRef,
          reason: notes || `Submitted unresolved question for owner decision simulation.`,
          beforeValues: { status: q.status },
          afterValues: { status: 'Submitted for Owner Decision (Sim)' },
          payload: { questionId: q.id, targetStatus: 'Submitted for Owner Decision (Sim)' },
        });

        return {
          ...prev,
          adviserQuestions: prev.adviserQuestions.map((item) =>
            item.id === q.id ? { ...item, status: 'Submitted for Owner Decision (Sim)' } : item
          ),
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Compliance Readiness',
            action: 'Submitted for Owner Decision (Simulated)',
            recordType: 'AdviserQuestion',
            recordId: q.id,
            reason: notes || `Submitted question for owner decision simulation.`,
            evidenceRef,
            linkedApprovalId: req.id,
            beforeValues: { status: q.status },
            afterValues: { status: 'Submitted for Owner Decision (Sim)' },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Submitted for Owner Decision (Simulation)',
        detail: 'Simulated approval request and immutable audit event recorded.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, seed.adviserQuestions]
  );

  const toggleRetentionLegalHold = useCallback(
    (retentionId: string, reason: string) => {
      const perm = checkActionPermission(currentPersona.role, 'toggle_legal_hold_placeholder');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const target = seed.retentionClasses.find(
        (r) => r.id === retentionId && r.ownerId === activeOwnerId
      );
      if (!target) return false;

      const nextHold: RetentionClassRecord['legalHoldState'] =
        target.legalHoldState === 'None (Placeholder)'
          ? 'Legal Hold Placeholder Active (Simulated)'
          : 'None (Placeholder)';

      setSeed((prev) => ({
        ...prev,
        retentionClasses: prev.retentionClasses.map((r) =>
          r.id === retentionId ? { ...r, legalHoldState: nextHold } : r
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Compliance Readiness',
          action: 'Legal-Hold Placeholder Toggled',
          recordType: 'RetentionClass',
          recordId: retentionId,
          reason: reason || `Toggled simulated legal-hold placeholder on ${target.recordType}.`,
          evidenceRef: 'EVD-RET-HOLD-SIM',
          beforeValues: { legalHoldState: target.legalHoldState },
          afterValues: { legalHoldState: nextHold },
        }),
      }));

      notify({
        tone: 'info',
        title: `Legal-Hold Placeholder Updated (${target.recordType})`,
        detail: `${nextHold}. No automated purge or deletion job exists.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, notify, seed.retentionClasses]
  );

  const requestRoleAssignment = useCallback(
    (input: {
      userName: string;
      syntheticHandle: string;
      proposedRole: PersonaRole;
      effectiveDate: string;
      evidenceRef: string;
      reason: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'request_role_assignment');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const userId = `ADM-USR-${Date.now().toString().slice(-4)}`;
      const actorId = `USR-SYNTH-${Date.now().toString().slice(-3)}`;
      setSeed((prev) => {
        const newUser: AdminUserRecord = {
          id: userId,
          actorId,
          name: input.userName,
          syntheticHandle: input.syntheticHandle,
          assignedRoles: [input.proposedRole],
          ownerScope: activeOwnerId === 'OWN-ALPHA' ? 'Test Owner Alpha' : 'Test Owner Beta',
          status: 'Pending Role Approval',
          lastSessionPlaceholder: 'Awaiting checker approval',
        };
        const req = createApprovalRecord(prev, {
          category: 'Role Assignment',
          title: `Assign ${input.proposedRole} Role to ${input.userName}`,
          targetRecordType: 'AdminUser',
          targetRecordId: userId,
          requiredCheckerRoles: ['Owner / Director', 'General Manager'],
          effectiveDate: input.effectiveDate,
          evidenceRef: input.evidenceRef,
          reason: input.reason,
          beforeValues: { user: input.userName, role: 'Unassigned', status: 'Pending' },
          afterValues: { user: input.userName, role: input.proposedRole, status: 'Active' },
          payload: { userId, role: input.proposedRole },
        });
        return {
          ...prev,
          adminUsers: [newUser, ...prev.adminUsers],
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Administration',
            action: 'Role Assignment Requested',
            recordType: 'AdminUser',
            recordId: userId,
            reason: input.reason,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
            afterValues: { userName: input.userName, proposedRole: input.proposedRole },
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Role Assignment Queued for Approval',
        detail: 'System Administrator cannot self-approve role grants.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify]
  );

  const updateConfigRuleDraft = useCallback(
    (ruleId: string, newValue: string, effectiveDate: string, reason: string) => {
      const perm = checkActionPermission(currentPersona.role, 'update_system_config');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const existing = seed.configRules.find((r) => r.id === ruleId);
      if (!existing) return false;

      setSeed((prev) => ({
        ...prev,
        configRules: prev.configRules.map((r) =>
          r.id === ruleId ? { ...r, value: newValue, effectiveDate, status: 'Draft' } : r
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Administration',
          action: 'Configuration Saved as Draft',
          recordType: 'ConfigRule',
          recordId: ruleId,
          reason,
          beforeValues: { value: existing.value, status: existing.status },
          afterValues: { value: newValue, status: 'Draft', effectiveDate },
        }),
      }));
      notify({
        tone: 'success',
        title: 'Configuration Draft Saved',
        detail: `${existing.key} updated as Draft effective ${effectiveDate}.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, notify, seed.configRules]
  );

  const saveEnvironmentOverrides = useCallback(
    (values: Record<string, string>): { ok: boolean; errors: string[]; updatedKeys: string[] } => {
      const perm = checkActionPermission(currentPersona.role, 'update_system_config');
      if (currentPersona.role !== 'System Administrator' || !perm.allowed) {
        const reason =
          currentPersona.role !== 'System Administrator'
            ? 'Only System Administrator may modify environment runtime overrides.'
            : perm.reason;
        logPermissionDenial('Administration', 'Update Environment Variables', reason, 'ENV-BROWSER-RUNTIME');
        notify({ tone: 'error', title: 'Action Restricted', detail: reason });
        return { ok: false, errors: [reason], updatedKeys: [] };
      }

      const browserSpecs = ENV_VARIABLE_REGISTRY.filter((spec) => spec.scope === 'browser');
      const errors: string[] = [];
      const nextValues: Record<string, string> = {};

      for (const spec of browserSpecs) {
        const val = String(values[spec.key] ?? '').trim();
        nextValues[spec.key] = val;
        const err = validateEnvVariableValue(spec, val);
        if (err) errors.push(err);
      }

      if (errors.length > 0) {
        notify({ tone: 'error', title: 'Environment Validation Failed', detail: errors[0] });
        return { ok: false, errors, updatedKeys: [] };
      }

      const previousValues = getAllEffectiveBrowserEnvValues();
      const beforeValues: Record<string, string | number | boolean> = {};
      const afterValues: Record<string, string | number | boolean> = {};
      const updatedKeys: string[] = [];

      for (const spec of browserSpecs) {
        const prevRaw = previousValues[spec.key] || '';
        const nextRaw = nextValues[spec.key] || '';
        if (prevRaw !== nextRaw) {
          updatedKeys.push(spec.key);
          beforeValues[spec.key] = formatAuditEnvValue(spec, prevRaw);
          afterValues[spec.key] = formatAuditEnvValue(spec, nextRaw);
        }
      }

      setBrowserEnvOverrides(nextValues);
      resetSupabaseClientCache();

      if (updatedKeys.length > 0) {
        setSeed((prev) => ({
          ...prev,
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Administration',
            action: 'Environment Runtime Overrides Updated',
            recordType: 'EnvironmentConfig',
            recordId: 'ENV-BROWSER-RUNTIME',
            reason: `Updated ${updatedKeys.length} browser runtime variable(s): ${updatedKeys.join(', ')} (secrets masked).`,
            beforeValues,
            afterValues,
          }),
        }));
      }

      notify({
        tone: 'success',
        title: 'Browser Runtime Overrides Applied',
        detail:
          updatedKeys.length > 0
            ? `Applied immediately for ${updatedKeys.join(', ')}.`
            : 'Runtime overrides confirmed with no changes.',
      });
      return { ok: true, errors: [], updatedKeys };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, logPermissionDenial, notify]
  );

  const resetEnvironmentOverrides = useCallback((): boolean => {
    const perm = checkActionPermission(currentPersona.role, 'update_system_config');
    if (currentPersona.role !== 'System Administrator' || !perm.allowed) {
      const reason = 'Only System Administrator may reset environment runtime overrides.';
      logPermissionDenial('Administration', 'Reset Environment Variables', reason, 'ENV-BROWSER-RUNTIME');
      notify({ tone: 'error', title: 'Action Restricted', detail: reason });
      return false;
    }

    const previousValues = getAllEffectiveBrowserEnvValues();
    const beforeValues: Record<string, string | number | boolean> = {};
    for (const spec of ENV_VARIABLE_REGISTRY.filter((s) => s.scope === 'browser')) {
      beforeValues[spec.key] = formatAuditEnvValue(spec, previousValues[spec.key] || '');
    }

    clearBrowserEnvOverrides();
    resetSupabaseClientCache();

    setSeed((prev) => ({
      ...prev,
      auditEvents: appendAuditEvent(prev, {
        ownerId: activeOwnerId,
        module: 'Administration',
        action: 'Environment Runtime Overrides Cleared',
        recordType: 'EnvironmentConfig',
        recordId: 'ENV-BROWSER-RUNTIME',
        reason: 'Reverted browser VITE_* overrides to build-time/default environment values.',
        beforeValues,
        afterValues: { mode: 'build-env-or-default' },
      }),
    }));

    notify({
      tone: 'info',
      title: 'Browser Overrides Cleared',
      detail: 'Frontend runtime reverted to build-time environment defaults.',
    });
    return true;
  }, [activeOwnerId, appendAuditEvent, currentPersona.role, logPermissionDenial, notify]);

  const logEnvironmentExport = useCallback(
    (target: 'root' | 'backend' | 'snippet', detail: string) => {
      setSeed((prev) => ({
        ...prev,
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Administration',
          action: 'Environment Template Exported',
          recordType: 'EnvironmentTemplate',
          recordId: `ENV-EXPORT-${target.toUpperCase()}`,
          reason: detail,
          afterValues: { target, secretsIncludedInAudit: false },
        }),
      }));
    },
    [activeOwnerId, appendAuditEvent]
  );

  const ownerDelegations = useMemo(
    () => seed.delegations.filter((d) => d.ownerId === activeOwnerId),
    [seed.delegations, activeOwnerId]
  );

  const decideApproval = useCallback(
    (approvalId: string, decision: 'Approved' | 'Rejected' | 'Returned', comment: string) => {
      const req = seed.approvals.find((a) => a.id === approvalId && a.ownerId === activeOwnerId);
      if (!req) return false;

      const auth = checkApprovalAuthority(
        currentPersona.role,
        req,
        session.actorId,
        ownerDelegations
      );
      if (!auth.allowed) {
        logPermissionDenial('Approvals Centre', `Approval ${decision} (${req.requestNumber})`, auth.reason, req.id);
        notify({ tone: 'error', title: 'Approval Prohibited', detail: auth.reason });
        return false;
      }

      const ts = nowTimestamp().slice(0, 16);
      const isStepAdvance = decision === 'Approved' && req.currentStep < req.totalSteps;
      const finalDecisionStatus: ApprovalWorkflowStatus = isStepAdvance ? 'In Review' : decision;
      const isFinalizing = !isStepAdvance && (decision === 'Approved' || decision === 'Rejected');

      setSeed((prev) => {
        let nextUnits = prev.units;
        let nextAccounts = prev.accounts;
        let nextReceipts = prev.receipts;
        let nextCharges = prev.charges;
        let nextTaxRules = prev.taxRules;
        let nextAdminUsers = prev.adminUsers;
        let nextOwners = prev.owners;
        let nextDelegations = prev.delegations;
        let nextExpenses = prev.expenses;
        let nextMaintenance = prev.maintenanceTickets;
        let nextDrills = prev.backupDrills;
        let nextMigration = prev.migrationBatches;
        let nextPeriods = prev.accountingPeriods;
        let nextChecklists = prev.closeChecklists;
        let nextDeposits = prev.depositCustodies;
        let nextLedgerJournals = prev.ledgerJournals;
        const nextLedgerConfigs = prev.ledgerConfigs;

        const activeConfig =
          prev.ledgerConfigs.find((c) => c.ownerId === activeOwnerId) || buildHidarAlphaBundle().config;
        const currentBundle: LedgerOwnerBundle = {
          config: activeConfig,
          accounts: prev.ledgerAccountsV2.filter((a) => a.ownerId === activeOwnerId),
          periods: prev.accountingPeriods.filter((p) => p.ownerId === activeOwnerId),
          openingBalances: prev.ledgerOpeningBalances[activeOwnerId] || {},
          entries: prev.ledgerJournals.filter((j) => j.ownerId === activeOwnerId),
          tenants: prev.ledgerTenants.filter((t) => t.ownerId === activeOwnerId),
          deposits: prev.depositCustodies.filter((d) => d.ownerId === activeOwnerId),
          gatewayBatches: prev.gatewayBatches.filter((b) => b.ownerId === activeOwnerId),
          failedEvents: prev.failedGatewayEvents.filter((f) => f.ownerId === activeOwnerId),
          bankLines: prev.bankStatementLines.filter((b) => b.ownerId === activeOwnerId),
          reconciliationRuns: prev.reconciliationRuns.filter((r) => r.ownerId === activeOwnerId),
          vendorBills: prev.vendorBills.filter((b) => b.ownerId === activeOwnerId),
          fixedAssets: prev.fixedAssets.filter((a) => a.ownerId === activeOwnerId),
          closeChecklists: prev.closeChecklists.filter((c) => c.ownerId === activeOwnerId),
        };

        if (decision === 'Approved' && !isStepAdvance) {
          if (req.category === 'Unit Renumbering') {
            const { unitId, newCode, newName } = req.payload as {
              unitId: string;
              newCode: string;
              newName: string;
            };
            nextUnits = prev.units.map((u) =>
              u.id === unitId
                ? {
                    ...u,
                    previousIdentifiers: Array.from(new Set([...u.previousIdentifiers, u.code])),
                    code: newCode,
                    name: newName,
                    history: [
                      {
                        id: `UH-${Date.now()}`,
                        date: req.effectiveDate,
                        type: 'Renumbered',
                        previousIdentifier: u.code,
                        newIdentifier: newCode,
                        detail: `Renumbered via ${req.requestNumber}; previous code ${u.code} preserved.`,
                        actor: currentPersona.displayName,
                        evidenceRef: req.evidenceRef,
                      },
                      ...u.history,
                    ],
                  }
                : u
            );
          } else if (req.category === 'Account Change') {
            const { accountId, newName } = req.payload as { accountId: string; newName: string };
            nextAccounts = prev.accounts.map((a) =>
              a.id === accountId
                ? {
                    ...a,
                    name: newName,
                    version: a.version + 1,
                    effectiveDate: req.effectiveDate,
                    versions: [
                      {
                        version: a.version + 1,
                        effectiveDate: req.effectiveDate,
                        status: a.status,
                        name: newName,
                        changedBy: `${req.makerName} / Reviewed by ${currentPersona.displayName}`,
                        evidenceRef: req.evidenceRef,
                        note: req.reason,
                      },
                      ...a.versions.map((v) => ({ ...v, status: 'Retired' as const })),
                    ],
                  }
                : a
            );
          } else if (req.category === 'Receipt Void / Reversal') {
            const { receiptId } = req.payload as { receiptId: string };
            const targetReceipt = prev.receipts.find((r) => r.id === receiptId);
            nextReceipts = prev.receipts.map((r) =>
              r.id === receiptId
                ? {
                    ...r,
                    documentState: 'Reversed' as ReceiptDocumentState,
                    history: [
                      {
                        timestamp: ts,
                        event: `Reversed after checker approval (${req.requestNumber})`,
                        actor: currentPersona.displayName,
                        state: 'Reversed',
                      },
                      ...r.history,
                    ],
                  }
                : r
            );
            if (targetReceipt) {
              nextCharges = prev.charges.map((c) => {
                const alloc = targetReceipt.allocations.find((a) => a.chargeId === c.id);
                if (!alloc) return c;
                const nextPaid = Math.max(0, c.paidEtb - alloc.allocatedEtb);
                return {
                  ...c,
                  paidEtb: nextPaid,
                  status: nextPaid === 0 ? 'Overdue' : 'Partially Paid',
                };
              });
            }
          } else if (req.category === 'Tax Rule Review') {
            const { taxRuleId } = req.payload as { taxRuleId: string };
            nextTaxRules = prev.taxRules.map((t) =>
              t.id === taxRuleId
                ? {
                    ...t,
                    lifecycleStage: 'Adviser Confirmed' as TaxLifecycleStage,
                    ownerApprovalReference: `${req.requestNumber} (Simulation Only — Active Disabled)`,
                    version: t.version + 1,
                    versions: [
                      {
                        version: t.version + 1,
                        effectiveDateFrom: t.effectiveDateFrom,
                        effectiveDateTo: t.effectiveDateTo,
                        ratePlaceholder: t.ratePlaceholder,
                        taxableStatus: t.taxableStatus,
                        lifecycleStage: 'Adviser Confirmed',
                        sourceReference: t.sourceReference,
                        adviserEvidence: req.evidenceRef,
                        ownerApprovalReference: `${req.requestNumber} (Sim)`,
                        changedBy: currentPersona.displayName,
                        note: 'Reviewed in prototype simulation. Active state remains disabled.',
                      },
                      ...t.versions,
                    ],
                  }
                : t
            );
          } else if (req.category === 'Role Assignment') {
            const { userId, role } = req.payload as { userId: string; role: PersonaRole };
            nextAdminUsers = prev.adminUsers.map((u) =>
              u.id === userId
                ? {
                    ...u,
                    assignedRoles: Array.from(new Set([...u.assignedRoles, role])),
                    status: 'Active',
                    lastSessionPlaceholder: 'Approved in prototype simulation',
                  }
                : u
            );
          } else if (req.category === 'Temporary Delegation') {
            const { delegationId } = req.payload as { delegationId: string };
            nextDelegations = prev.delegations.map((d) =>
              d.id === delegationId
                ? { ...d, status: 'Active', ownerApprovalRef: req.requestNumber }
                : d
            );
          } else if (req.category === 'Expense / Payment Proposal') {
            const { expenseId } = req.payload as { expenseId: string };
            nextExpenses = prev.expenses.map((ex) =>
              ex.id === expenseId
                ? {
                    ...ex,
                    status: 'Approved — Payment Proposal Only',
                    paymentProposalRef: `PAY-PROP-${req.requestNumber}`,
                  }
                : ex
            );
          } else if (req.category === 'Maintenance Cost') {
            const { ticketId } = req.payload as { ticketId: string };
            nextMaintenance = prev.maintenanceTickets.map((mt) =>
              mt.id === ticketId
                ? {
                    ...mt,
                    workOrderState: 'Scheduled',
                    timeline: [
                      {
                        timestamp: ts,
                        event: `Cost approved via ${req.requestNumber}; scheduled work order`,
                        actor: currentPersona.displayName,
                      },
                      ...mt.timeline,
                    ],
                  }
                : mt
            );
          } else if (req.category === 'Backup Restore Drill') {
            const { drillId } = req.payload as { drillId: string };
            nextDrills = prev.backupDrills.map((dr) =>
              dr.id === drillId ? { ...dr, status: 'Approved Drill (Sim)' } : dr
            );
          } else if (req.category === 'Migration Exception') {
            const { batchId } = req.payload as { batchId: string };
            nextMigration = prev.migrationBatches.map((mb) =>
              mb.id === batchId
                ? {
                    ...mb,
                    validationState: 'Validated Staging (No Real Import)',
                    approvalStatus: 'Exception Approved (Sim)',
                  }
                : mb
            );
          } else if (req.category === 'Ownership Change') {
            const { proposedOwnerName } = req.payload as { proposedOwnerName?: string };
            nextOwners = prev.owners.map((o) =>
              o.id === activeOwnerId
                ? {
                    ...o,
                    version: o.version + 1,
                    effectiveDate: req.effectiveDate,
                    versions: [
                      {
                        version: o.version + 1,
                        effectiveDate: req.effectiveDate,
                        status: 'Active',
                        changedBy: `${req.makerName} / Approved by ${currentPersona.displayName}`,
                        evidenceRef: req.evidenceRef,
                        summary: `Prototype ownership change recorded toward ${proposedOwnerName || 'Updated Representative'} (requires production onboarding verification).`,
                      },
                      ...o.versions.map((v) => ({ ...v, status: 'Retired' as const })),
                    ],
                  }
                : o
            );
          } else if (req.category === 'Period Close') {
            const { periodCode } = req.payload as { periodCode: string };
            const tb = computeTrialBalance(
              currentBundle.accounts,
              currentBundle.openingBalances,
              currentBundle.entries
            );
            nextPeriods = prev.accountingPeriods.map((p) =>
              p.ownerId === activeOwnerId && p.periodCode === periodCode
                ? {
                    ...p,
                    status: 'Closed' as const,
                    closedAt: ts,
                    closedBy: currentPersona.displayName,
                    closedApprovalId: req.id,
                    lastTrialBalanceCents: tb.totalDebitCents,
                  }
                : p
            );
            nextChecklists = prev.closeChecklists.map((c) =>
              c.ownerId === activeOwnerId && c.periodCode === periodCode
                ? {
                    ...c,
                    status: 'Closed' as const,
                    checkerActorId: session.actorId,
                    checkerName: currentPersona.displayName,
                    approvalId: req.id,
                  }
                : c
            );
            if (supabaseOperatorRef.current && import.meta.env?.MODE !== 'test') {
              void recordPeriodClosureToSupabase({
                uid: supabaseOperatorRef.current.uid,
                ownerEntityId: activeOwnerId,
                periodCode,
                trialBalanceDebitCents: tb.totalDebitCents,
                trialBalanceCreditCents: tb.totalCreditCents,
                journalCount: currentBundle.entries.filter((e) => e.periodCode === periodCode).length,
                closedByActor: currentPersona.displayName,
              }).catch(() => {
                // Non-blocking closure mirror
              });
            }
          } else if (req.category === 'Period Reopen') {
            const { periodCode } = req.payload as { periodCode: string };
            nextPeriods = prev.accountingPeriods.map((p) =>
              p.ownerId === activeOwnerId && p.periodCode === periodCode
                ? {
                    ...p,
                    status: 'Reopened' as const,
                    reopenReason: req.reason,
                    reopenApprovedBy: currentPersona.displayName,
                  }
                : p
            );
          } else if (req.category === 'Manual Journal') {
            const payload = req.payload as {
              entryDate: string;
              periodCode: string;
              description: string;
              lines: { accountCode: string; debitEtb: number; creditEtb: number; description?: string }[];
            };
            const posted = postLedgerEvent(currentBundle, {
              entryDate: payload.entryDate,
              periodCode: payload.periodCode,
              ruleId: 'Manual',
              sourceType: 'ManualJournal',
              sourceId: req.requestNumber,
              idempotencyKey: `APR-MJ-${req.id}`,
              description: payload.description,
              makerActorId: req.makerActorId,
              makerName: req.makerName,
              checkerActorId: session.actorId,
              checkerName: currentPersona.displayName,
              lines: payload.lines.map((l) => ({
                accountCode: l.accountCode,
                debitCents: toCents(l.debitEtb),
                creditCents: toCents(l.creditEtb),
                description: l.description,
              })),
            });
            if (posted.posted) {
              nextLedgerJournals = [...prev.ledgerJournals, posted.journal];
            }
          } else if (req.category === 'Deposit Refund / Deduction') {
            const { depositId, mode, amountEtb } = req.payload as {
              depositId: string;
              mode: 'Refund' | 'Deduction';
              amountEtb: number;
            };
            const dep = currentBundle.deposits.find((d) => d.id === depositId);
            if (dep) {
              const period = currentBundle.periods.find((p) => p.status === 'Open' || p.status === 'Reopened');
              const amountCents = toCents(amountEtb);
              const postRes = postLedgerEvent(currentBundle, {
                entryDate: period?.endDateGc || '2026-12-09',
                periodCode: period?.periodCode || '2019-03',
                ruleId: mode === 'Refund' ? 'PR-14' : 'PR-15',
                sourceType: 'Deposit',
                sourceId: req.requestNumber,
                idempotencyKey: `DEP-SETTLE-${req.id}`,
                description: `${mode} on deposit ${dep.unitCode} (${dep.tenantName})`,
                makerActorId: req.makerActorId,
                makerName: req.makerName,
                checkerActorId: session.actorId,
                checkerName: currentPersona.displayName,
                lines:
                  mode === 'Refund'
                    ? [
                        { accountCode: '2120', debitCents: amountCents, creditCents: 0, tenantId: dep.tenantId, unitId: dep.unitCode },
                        { accountCode: '1030', debitCents: 0, creditCents: amountCents, tenantId: dep.tenantId, unitId: dep.unitCode },
                      ]
                    : [
                        { accountCode: '2120', debitCents: amountCents, creditCents: 0, tenantId: dep.tenantId, unitId: dep.unitCode },
                        { accountCode: '1020', debitCents: amountCents, creditCents: 0, tenantId: dep.tenantId, unitId: dep.unitCode },
                        { accountCode: '4400', debitCents: 0, creditCents: amountCents, tenantId: dep.tenantId, unitId: dep.unitCode },
                        { accountCode: '1030', debitCents: 0, creditCents: amountCents, tenantId: dep.tenantId, unitId: dep.unitCode },
                      ],
              });
              if (postRes.posted) {
                nextLedgerJournals = [...prev.ledgerJournals, postRes.journal];
                nextDeposits = prev.depositCustodies.map((d) =>
                  d.id === depositId
                    ? {
                        ...d,
                        heldCents: Math.max(0, d.heldCents - amountCents),
                        status:
                          d.heldCents - amountCents <= 0
                            ? mode === 'Refund'
                              ? 'Refunded'
                              : 'Deducted'
                            : 'Held',
                        journalId: postRes.journal.id,
                      }
                    : d
                );
              }
            }
          } else if (req.category === 'Owner Draw') {
            const { amountEtb, drawDate, periodCode } = req.payload as {
              amountEtb: number;
              drawDate: string;
              periodCode: string;
            };
            const drawCents = toCents(amountEtb);
            const postRes = postLedgerEvent(currentBundle, {
              entryDate: drawDate,
              periodCode,
              ruleId: 'PR-24',
              sourceType: 'OwnerDraw',
              sourceId: req.requestNumber,
              idempotencyKey: `DRAW-${req.id}`,
              description: `Owner distribution draw (${req.reason})`,
              makerActorId: req.makerActorId,
              makerName: req.makerName,
              checkerActorId: session.actorId,
              checkerName: currentPersona.displayName,
              lines: [
                { accountCode: '3200', debitCents: drawCents, creditCents: 0 },
                { accountCode: '1020', debitCents: 0, creditCents: drawCents },
              ],
            });
            if (postRes.posted) {
              nextLedgerJournals = [...prev.ledgerJournals, postRes.journal];
            }
          } else if (req.category === 'Bad-Debt Write-Off') {
            const { amountEtb, tenantId, periodCode } = req.payload as {
              amountEtb: number;
              tenantId: string;
              periodCode: string;
            };
            const cents = toCents(amountEtb);
            const postRes = postLedgerEvent(currentBundle, {
              entryDate: req.effectiveDate,
              periodCode,
              ruleId: 'PR-23',
              sourceType: 'WriteOff',
              sourceId: req.requestNumber,
              idempotencyKey: `WO-${req.id}`,
              description: `PR-23 Bad-debt write-off (${req.reason})`,
              makerActorId: req.makerActorId,
              makerName: req.makerName,
              checkerActorId: session.actorId,
              checkerName: currentPersona.displayName,
              lines: [
                { accountCode: '5700', debitCents: cents, creditCents: 0, tenantId },
                { accountCode: '1110', debitCents: 0, creditCents: cents, tenantId },
              ],
            });
            if (postRes.posted) {
              nextLedgerJournals = [...prev.ledgerJournals, postRes.journal];
            }
          }
        } else if (decision === 'Rejected' || decision === 'Returned') {
          if (req.category === 'Receipt Void / Reversal') {
            const { receiptId } = req.payload as { receiptId: string };
            nextReceipts = prev.receipts.map((r) =>
              r.id === receiptId
                ? {
                    ...r,
                    documentState: 'Issued — Demo Only' as ReceiptDocumentState,
                    history: [
                      {
                        timestamp: ts,
                        event: `Void request ${decision.toLowerCase()} by ${currentPersona.role}`,
                        actor: currentPersona.displayName,
                        state: 'Issued — Demo Only',
                      },
                      ...r.history,
                    ],
                  }
                : r
            );
          } else if (req.category === 'Tax Rule Review') {
            const { taxRuleId } = req.payload as { taxRuleId: string };
            nextTaxRules = prev.taxRules.map((t) =>
              t.id === taxRuleId ? { ...t, lifecycleStage: 'Draft' } : t
            );
          } else if (req.category === 'Expense / Payment Proposal' && decision === 'Rejected') {
            const { expenseId } = req.payload as { expenseId: string };
            nextExpenses = prev.expenses.map((ex) =>
              ex.id === expenseId ? { ...ex, status: 'Rejected' } : ex
            );
          } else if (req.category === 'Period Close') {
            const { periodCode } = req.payload as { periodCode: string };
            nextPeriods = prev.accountingPeriods.map((p) =>
              p.ownerId === activeOwnerId && p.periodCode === periodCode
                ? { ...p, status: 'Open' as const }
                : p
            );
          }
        }

        const nextApprovals = prev.approvals.map((a) =>
          a.id === approvalId
            ? {
                ...a,
                status: finalDecisionStatus,
                currentStep: isStepAdvance ? a.currentStep + 1 : a.currentStep,
                finalized: isFinalizing,
                decisionLog: [
                  ...a.decisionLog,
                  {
                    timestamp: ts,
                    actor: currentPersona.displayName,
                    actorId: session.actorId,
                    persona: currentPersona.role,
                    action: isStepAdvance ? ('Reviewed (Step 1)' as const) : decision,
                    comment:
                      comment ||
                      (isStepAdvance
                        ? `Step 1 verified by ${currentPersona.role}; routed to Step 2 escalator.`
                        : `${decision} by ${currentPersona.role}.`),
                  },
                ],
              }
            : a
        );

        return {
          ...prev,
          units: nextUnits,
          accounts: nextAccounts,
          receipts: nextReceipts,
          charges: nextCharges,
          taxRules: nextTaxRules,
          adminUsers: nextAdminUsers,
          owners: nextOwners,
          delegations: nextDelegations,
          expenses: nextExpenses,
          maintenanceTickets: nextMaintenance,
          backupDrills: nextDrills,
          migrationBatches: nextMigration,
          accountingPeriods: nextPeriods,
          closeChecklists: nextChecklists,
          depositCustodies: nextDeposits,
          ledgerJournals: nextLedgerJournals,
          ledgerConfigs: nextLedgerConfigs,
          approvals: nextApprovals,
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Approvals Centre',
            action: isStepAdvance ? 'Approval Step 1 Verified (In Review)' : `Approval ${decision}`,
            recordType: req.targetRecordType,
            recordId: req.targetRecordId,
            reason: comment || `${finalDecisionStatus} ${req.requestNumber}`,
            evidenceRef: req.evidenceRef,
            linkedApprovalId: req.id,
            beforeValues: req.beforeValues,
            afterValues:
              decision === 'Approved' && !isStepAdvance
                ? req.afterValues
                : { status: finalDecisionStatus, step: isStepAdvance ? req.currentStep + 1 : req.currentStep },
          }),
        };
      });

      notify({
        tone: isStepAdvance ? 'info' : decision === 'Approved' ? 'success' : 'warning',
        title: isStepAdvance
          ? `${req.requestNumber} Advanced to Step ${req.currentStep + 1}`
          : `${req.requestNumber} ${decision}`,
        detail: 'Simulated workflow state and immutable audit trail updated.',
      });
      return true;
    },
    [
      activeOwnerId,
      appendAuditEvent,
      currentPersona,
      logPermissionDenial,
      notify,
      ownerDelegations,
      seed.approvals,
      session.actorId,
    ]
  );

  const cancelApproval = useCallback(
    (approvalId: string, comment: string) => {
      const req = seed.approvals.find((a) => a.id === approvalId && a.ownerId === activeOwnerId);
      if (!req || req.finalized) return false;
      const canCancel =
        req.makerActorId === session.actorId ||
        currentPersona.role === 'General Manager' ||
        currentPersona.role === 'Owner / Director';
      if (!canCancel || currentPersona.role === 'Auditor / Read-only reviewer') {
        logPermissionDenial('Approvals Centre', 'Cancel Approval Request', 'Only maker, GM, or Owner may cancel a pending request.', approvalId);
        notify({ tone: 'error', title: 'Cancellation Prohibited', detail: 'Only the maker, General Manager, or Owner may cancel an unfinalized request.' });
        return false;
      }
      const ts = nowTimestamp().slice(0, 16);
      setSeed((prev) => ({
        ...prev,
        approvals: prev.approvals.map((a) =>
          a.id === approvalId
            ? {
                ...a,
                status: 'Cancelled',
                finalized: true,
                decisionLog: [
                  ...a.decisionLog,
                  {
                    timestamp: ts,
                    actor: currentPersona.displayName,
                    actorId: session.actorId,
                    persona: currentPersona.role,
                    action: 'Cancelled',
                    comment: comment || 'Cancelled before final decision.',
                  },
                ],
              }
            : a
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Approvals Centre',
          action: 'Approval Request Cancelled',
          recordType: req.targetRecordType,
          recordId: req.targetRecordId,
          reason: comment || `Cancelled ${req.requestNumber}`,
          linkedApprovalId: req.id,
        }),
      }));
      notify({ tone: 'warning', title: `${req.requestNumber} Cancelled`, detail: 'Closed immutably; create a new request if needed.' });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, logPermissionDenial, notify, seed.approvals, session.actorId]
  );

  const supersedeApproval = useCallback(
    (approvalId: string, newReason: string, newEvidenceRef: string) => {
      const req = seed.approvals.find((a) => a.id === approvalId && a.ownerId === activeOwnerId);
      if (!req) return false;
      if (currentPersona.role === 'Auditor / Read-only reviewer') {
        logPermissionDenial('Approvals Centre', 'Supersede Approval Request', 'Auditor is strictly read-only.', approvalId);
        return false;
      }
      const ts = nowTimestamp().slice(0, 16);
      setSeed((prev) => {
        const replacement = createApprovalRecord(prev, {
          category: req.category,
          title: `${req.title} (Superseding ${req.requestNumber})`,
          targetRecordType: req.targetRecordType,
          targetRecordId: req.targetRecordId,
          requiredCheckerRoles: req.requiredCheckerRoles,
          escalatorRoles: req.escalatorRoles,
          workflowMode: req.workflowMode,
          stepLabels: req.stepLabels,
          amountThresholdPlaceholder: req.amountThresholdPlaceholder,
          supersedesRequestId: req.id,
          effectiveDate: req.effectiveDate,
          evidenceRef: newEvidenceRef || req.evidenceRef,
          reason: newReason || `Corrected/superseding submission replacing ${req.requestNumber}.`,
          beforeValues: req.beforeValues,
          afterValues: req.afterValues,
          payload: req.payload,
        });
        const updatedApprovals = prev.approvals.map((a) =>
          a.id === approvalId
            ? {
                ...a,
                status: 'Superseded' as const,
                finalized: true,
                supersededByRequestId: replacement.id,
                decisionLog: [
                  ...a.decisionLog,
                  {
                    timestamp: ts,
                    actor: currentPersona.displayName,
                    actorId: session.actorId,
                    persona: currentPersona.role,
                    action: 'Superseded' as const,
                    comment: `Superseded by linked request ${replacement.requestNumber}.`,
                  },
                ],
              }
            : a
        );
        return {
          ...prev,
          approvals: [replacement, ...updatedApprovals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Approvals Centre',
            action: 'Approval Request Superseded',
            recordType: 'ApprovalRequest',
            recordId: replacement.id,
            reason: `Created linked correction ${replacement.requestNumber} superseding ${req.requestNumber}.`,
            evidenceRef: newEvidenceRef || req.evidenceRef,
            linkedApprovalId: replacement.id,
          }),
        };
      });
      notify({
        tone: 'success',
        title: 'Linked Superseding Request Created',
        detail: `Prior request ${req.requestNumber} marked Superseded non-destructively.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona, logPermissionDenial, notify, seed.approvals, session.actorId]
  );

  const triggerApprovalReminderOrEscalate = useCallback(
    (approvalId: string, mode: 'reminder' | 'escalate') => {
      const req = seed.approvals.find((a) => a.id === approvalId && a.ownerId === activeOwnerId);
      if (!req || req.finalized) return;
      const ts = nowTimestamp().slice(0, 16);
      setSeed((prev) => ({
        ...prev,
        approvals: prev.approvals.map((a) =>
          a.id === approvalId
            ? {
                ...a,
                reminderSentPlaceholder: mode === 'reminder' ? true : a.reminderSentPlaceholder,
                escalated: mode === 'escalate' ? true : a.escalated,
                decisionLog: [
                  ...a.decisionLog,
                  {
                    timestamp: ts,
                    actor: currentPersona.displayName,
                    actorId: session.actorId,
                    persona: currentPersona.role,
                    action: mode === 'reminder' ? 'Reminder Logged' : 'Escalated',
                    comment:
                      mode === 'reminder'
                        ? 'Simulated due-date reminder logged (no live email/SMS sent).'
                        : 'Escalated to senior Owner / GM review queue (simulation).',
                  },
                ],
              }
            : a
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Approvals Centre',
          action: mode === 'reminder' ? 'Simulated Approval Reminder' : 'Approval Escalated (Sim)',
          recordType: 'ApprovalRequest',
          recordId: req.id,
          reason: `${mode === 'reminder' ? 'Reminder' : 'Escalation'} logged on ${req.requestNumber}.`,
          linkedApprovalId: req.id,
        }),
      }));
      notify({
        tone: 'info',
        title: mode === 'reminder' ? 'Reminder Logged (Simulation)' : 'Request Escalated (Simulation)',
        detail: `${req.requestNumber} timeline updated. No external email or SMS sent.`,
      });
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify, seed.approvals, session.actorId]
  );

  const toggleApprovalChecklistItem = useCallback(
    (approvalId: string, itemId: string) => {
      if (currentPersona.role === 'Auditor / Read-only reviewer') return;
      setSeed((prev) => ({
        ...prev,
        approvals: prev.approvals.map((a) =>
          a.id === approvalId && !a.finalized
            ? {
                ...a,
                evidenceChecklist: a.evidenceChecklist.map((chk) =>
                  chk.id === itemId ? { ...chk, verifiedPlaceholder: !chk.verifiedPlaceholder } : chk
                ),
              }
            : a
        ),
      }));
    },
    [currentPersona.role]
  );

  const requestDelegation = useCallback(
    (input: {
      delegateActorId: string;
      scopeModules: string;
      startDate: string;
      endDate: string;
      evidenceRef: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'request_delegation');
      if (!perm.allowed) {
        logPermissionDenial('Security & Access', 'Request Temporary Delegation', perm.reason);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const targetUser = seed.adminUsers.find((u) => u.actorId === input.delegateActorId) || seed.adminUsers[2];
      const delId = `DEL-${Date.now().toString().slice(-4)}`;
      setSeed((prev) => {
        const newDel: DelegationRecord = {
          id: delId,
          ownerId: activeOwnerId,
          delegatorActorId: session.actorId,
          delegatorName: currentPersona.displayName,
          delegatorRole: currentPersona.role,
          delegateActorId: targetUser.actorId,
          delegateName: targetUser.name,
          delegateRole: targetUser.assignedRoles[0],
          scopeModules: input.scopeModules,
          startDate: input.startDate,
          endDate: input.endDate,
          status: 'Pending Owner Approval',
          ownerApprovalRef: 'Pending Owner Sign-Off',
          evidenceRef: input.evidenceRef,
        };
        const req = createApprovalRecord(prev, {
          category: 'Temporary Delegation',
          title: `Temporary Authority Delegation to ${targetUser.name} (${input.startDate} → ${input.endDate})`,
          targetRecordType: 'Delegation',
          targetRecordId: delId,
          requiredCheckerRoles: ['Owner / Director', 'General Manager'],
          effectiveDate: input.startDate,
          evidenceRef: input.evidenceRef,
          reason: `Time-bounded temporary delegation for ${input.scopeModules}.`,
          beforeValues: { delegate: targetUser.name, status: 'None' },
          afterValues: { delegate: targetUser.name, status: 'Active', endDate: input.endDate },
          payload: { delegationId: delId },
        });
        return {
          ...prev,
          delegations: [newDel, ...prev.delegations],
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Security & Access',
            action: 'Temporary Delegation Requested',
            recordType: 'Delegation',
            recordId: delId,
            reason: `Requested delegation to ${targetUser.actorId} until ${input.endDate}.`,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
          }),
        };
      });
      notify({
        tone: 'success',
        title: 'Delegation Submitted for Owner Approval',
        detail: 'System Administrator cannot approve delegations.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona, logPermissionDenial, notify, seed.adminUsers, session.actorId]
  );

  const revokeDelegation = useCallback(
    (delegationId: string) => {
      const perm = checkActionPermission(currentPersona.role, 'request_delegation');
      if (!perm.allowed) {
        logPermissionDenial('Security & Access', 'Revoke Delegation', perm.reason, delegationId);
        return false;
      }
      setSeed((prev) => ({
        ...prev,
        delegations: prev.delegations.map((d) =>
          d.id === delegationId ? { ...d, status: 'Revoked' } : d
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Security & Access',
          action: 'Temporary Delegation Revoked',
          recordType: 'Delegation',
          recordId: delegationId,
          reason: 'Revoked temporary delegation in simulation.',
        }),
      }));
      notify({ tone: 'warning', title: 'Delegation Revoked', detail: 'Audit event recorded.' });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, logPermissionDenial, notify]
  );

  const attestAccessReview = useCallback(
    (
      reviewId: string,
      outcome: 'Attested (Simulation)' | 'Exception Flagged',
      note: string
    ) => {
      const perm = checkActionPermission(currentPersona.role, 'run_access_review');
      if (!perm.allowed) {
        logPermissionDenial('Security & Access', 'Quarterly Access Review', perm.reason, reviewId);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const today = new Date().toISOString().slice(0, 10);
      setSeed((prev) => ({
        ...prev,
        quarterlyAccessReviews: prev.quarterlyAccessReviews.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                reviewStatus: outcome,
                reviewedBy: currentPersona.displayName,
                reviewedAt: today,
                note: note || r.note,
              }
            : r
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Security & Access',
          action: `Quarterly Access Review: ${outcome}`,
          recordType: 'QuarterlyAccessReview',
          recordId: reviewId,
          reason: note || `Completed simulated quarterly review (${outcome}).`,
        }),
      }));
      notify({ tone: 'success', title: `Access Review Updated (${outcome})` });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, logPermissionDenial, notify]
  );

  const createRentalApplication = useCallback(
    (input: {
      applicantName: string;
      businessType: string;
      requestedUnitId: string;
      proposedRentEtb: number;
      evidenceRef: string;
      notes: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'create_rental_application');
      if (!perm.allowed) {
        logPermissionDenial('Rental Applications', 'Create Rental Application', perm.reason);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const appId = `APP-${Date.now().toString().slice(-4)}`;
      const appNum = `APP-SYNTH-${seed.rentalApplications.length + 101}`;
      setSeed((prev) => ({
        ...prev,
        rentalApplications: [
          {
            id: appId,
            ownerId: activeOwnerId,
            applicationNumber: appNum,
            applicantName: input.applicantName,
            businessType: input.businessType,
            requestedUnitId: input.requestedUnitId,
            appliedDate: new Date().toISOString().slice(0, 10),
            proposedRentEtb: input.proposedRentEtb,
            documentPlaceholders: [
              { label: 'Synthetic Applicant ID Placeholder', refCode: input.evidenceRef },
            ],
            screeningChecklist: [
              { id: 'SCR-1', item: 'Applicant identity placeholder documented', status: 'Verified Placeholder' },
              { id: 'SCR-2', item: 'Unit suitability & deposit capacity check', status: 'Pending' },
            ],
            status: 'Draft',
            evidenceRef: input.evidenceRef,
            notes: input.notes,
          },
          ...prev.rentalApplications,
        ],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Rental Applications',
          action: 'Synthetic Rental Application Created',
          recordType: 'RentalApplication',
          recordId: appId,
          reason: `Created draft application ${appNum} for ${input.applicantName}.`,
          evidenceRef: input.evidenceRef,
        }),
      }));
      notify({ tone: 'success', title: `Application ${appNum} Created (Draft)` });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, logPermissionDenial, notify, seed.rentalApplications.length]
  );

  const submitRentalApplication = useCallback(
    (appId: string) => {
      const perm = checkActionPermission(currentPersona.role, 'create_rental_application');
      if (!perm.allowed) {
        logPermissionDenial('Rental Applications', 'Submit Application', perm.reason, appId);
        return false;
      }
      setSeed((prev) => ({
        ...prev,
        rentalApplications: prev.rentalApplications.map((a) =>
          a.id === appId ? { ...a, status: 'Submitted' } : a
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Rental Applications',
          action: 'Rental Application Submitted for Screening Decision',
          recordType: 'RentalApplication',
          recordId: appId,
          reason: 'Submitted synthetic applicant dossier for owner/GM decision.',
        }),
      }));
      notify({ tone: 'info', title: 'Application Submitted for Decision' });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, logPermissionDenial, notify]
  );

  const decideRentalApplication = useCallback(
    (appId: string, decision: 'Approved' | 'Rejected') => {
      const perm = checkActionPermission(currentPersona.role, 'decide_rental_application');
      if (!perm.allowed) {
        logPermissionDenial('Rental Applications', `Application ${decision}`, perm.reason, appId);
        notify({ tone: 'error', title: 'Decision Blocked', detail: perm.reason });
        return false;
      }
      setSeed((prev) => ({
        ...prev,
        rentalApplications: prev.rentalApplications.map((a) =>
          a.id === appId ? { ...a, status: decision } : a
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Rental Applications',
          action: `Rental Application ${decision}`,
          recordType: 'RentalApplication',
          recordId: appId,
          reason: `Application marked ${decision} in prototype workflow.`,
        }),
      }));
      notify({ tone: decision === 'Approved' ? 'success' : 'warning', title: `Application ${decision}` });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, logPermissionDenial, notify]
  );

  const convertApplicationToLease = useCallback(
    (appId: string) => {
      const app = seed.rentalApplications.find((a) => a.id === appId && a.ownerId === activeOwnerId);
      if (!app || app.status !== 'Approved') {
        notify({
          tone: 'error',
          title: 'Conversion Blocked',
          detail: 'Only an Approved rental application can convert into a Draft lease.',
        });
        return false;
      }
      const perm = checkActionPermission(currentPersona.role, 'create_lease');
      if (!perm.allowed) {
        logPermissionDenial('Rental Applications', 'Convert Application to Lease', perm.reason, appId);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const newTenantId = `TEN-APP-${Date.now().toString().slice(-3)}`;
      const newLeaseId = `LSE-APP-${Date.now().toString().slice(-3)}`;
      const today = new Date().toISOString().slice(0, 10);
      const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
      setSeed((prev) => ({
        ...prev,
        tenants: [
          {
            id: newTenantId,
            ownerId: activeOwnerId,
            code: `SYNTH-TEN-${prev.tenants.length + 1}`,
            name: app.applicantName,
            businessType: app.businessType,
            phonePlaceholder: '+251-91-000-0099 (Synthetic)',
            emailPlaceholder: 'converted.applicant@synthetic.example.et',
            emergencyContactPlaceholder: 'Synthetic Emergency Contact',
            idPlaceholder: 'SYNTH-TIN-UNVERIFIED',
            documentPlaceholders: app.documentPlaceholders.map((d, idx) => ({
              id: `DOC-APP-${idx}`,
              label: d.label,
              refCode: d.refCode,
              status: 'Placeholder Only',
            })),
            status: 'Active',
          },
          ...prev.tenants,
        ],
        leases: [
          {
            id: newLeaseId,
            ownerId: activeOwnerId,
            leaseNumber: `LSE-SYNTH-APP-${prev.leases.length + 1}`,
            version: 1,
            unitId: app.requestedUnitId,
            tenantId: newTenantId,
            status: 'Draft',
            startDate: today,
            endDate: nextYear,
            monthlyRentEtb: app.proposedRentEtb,
            securityDepositEtb: app.proposedRentEtb * 2,
            billingCycle: 'Monthly',
            createdBy: currentPersona.displayName,
            evidenceRef: app.evidenceRef,
            notes: `Converted from approved application ${app.applicationNumber}.`,
            schedule: [{ period: today.slice(0, 7), dueDate: today, amountEtb: app.proposedRentEtb, status: 'Scheduled' }],
            timeline: [{ date: today, event: `Converted from ${app.applicationNumber} to Draft Lease`, actor: currentPersona.displayName }],
          },
          ...prev.leases,
        ],
        rentalApplications: prev.rentalApplications.map((a) =>
          a.id === appId ? { ...a, status: 'Converted to Lease (Draft)', convertedLeaseId: newLeaseId } : a
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Rental Applications',
          action: 'Approved Application Converted to Draft Lease',
          recordType: 'LeaseRecord',
          recordId: newLeaseId,
          reason: `Converted approved application ${app.applicationNumber} into Draft Lease.`,
          evidenceRef: app.evidenceRef,
        }),
      }));
      notify({
        tone: 'success',
        title: 'Converted to Draft Lease & Tenant Record',
        detail: `Synthetic tenant & Draft lease created under ${activeOwnerId}.`,
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, logPermissionDenial, notify, seed.rentalApplications]
  );

  const createExpenseRequest = useCallback(
    (input: {
      supplierPlaceholder: string;
      description: string;
      accountCode: string;
      amountEtb: number;
      dueDate: string;
      invoiceEvidenceRef: string;
      notes: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'create_expense_request');
      if (!perm.allowed) {
        logPermissionDenial('Expenses & Payables', 'Create Expense Request', perm.reason);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const acct = seed.accounts.find((a) => a.ownerId === activeOwnerId && a.code === input.accountCode);
      const expId = `EXP-${Date.now().toString().slice(-4)}`;
      const reqNum = `EXP-SYNTH-${seed.expenses.length + 101}`;
      setSeed((prev) => ({
        ...prev,
        expenses: [
          {
            id: expId,
            ownerId: activeOwnerId,
            requestNumber: reqNum,
            supplierPlaceholder: input.supplierPlaceholder,
            description: input.description,
            accountCode: input.accountCode,
            accountName: acct?.name || 'Draft Expense Account',
            amountEtb: input.amountEtb,
            invoiceEvidenceRef: input.invoiceEvidenceRef,
            requestedDate: new Date().toISOString().slice(0, 10),
            dueDate: input.dueDate,
            status: 'Draft',
            createdByActorId: session.actorId,
            notes: input.notes,
          },
          ...prev.expenses,
        ],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Expenses & Payables',
          action: 'Draft Expense Request Created',
          recordType: 'ExpensePayable',
          recordId: expId,
          reason: `Created draft expense ${reqNum} coded to ${input.accountCode}.`,
          evidenceRef: input.invoiceEvidenceRef,
        }),
      }));
      notify({ tone: 'success', title: `Expense Draft ${reqNum} Saved` });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, logPermissionDenial, notify, seed.accounts, seed.expenses.length, session.actorId]
  );

  const submitExpenseForApproval = useCallback(
    (expenseId: string) => {
      const perm = checkActionPermission(currentPersona.role, 'create_expense_request');
      if (!perm.allowed) {
        logPermissionDenial('Expenses & Payables', 'Submit Expense Proposal', perm.reason, expenseId);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const exp = seed.expenses.find((e) => e.id === expenseId && e.ownerId === activeOwnerId);
      if (!exp) return false;
      setSeed((prev) => {
        const isHighValue = exp.amountEtb > 25000;
        const req = createApprovalRecord(prev, {
          category: 'Expense / Payment Proposal',
          title: `Expense Payment Proposal ${exp.requestNumber} (ETB ${exp.amountEtb.toLocaleString()})`,
          targetRecordType: 'ExpensePayable',
          targetRecordId: exp.id,
          workflowMode: isHighValue ? 'Two-Step' : 'One-Step',
          requiredCheckerRoles: ['General Manager', 'Owner / Director'],
          escalatorRoles: isHighValue ? ['Owner / Director'] : undefined,
          amountThresholdPlaceholder: isHighValue ? '> ETB 25,000.00 (Two-Step Synthetic)' : '<= ETB 25,000.00 (One-Step Synthetic)',
          effectiveDate: exp.dueDate,
          evidenceRef: exp.invoiceEvidenceRef,
          reason: exp.description,
          beforeValues: { status: exp.status, amountEtb: exp.amountEtb },
          afterValues: { status: 'Approved — Payment Proposal Only', accountCode: exp.accountCode },
          payload: { expenseId: exp.id },
        });
        return {
          ...prev,
          expenses: prev.expenses.map((e) =>
            e.id === exp.id ? { ...e, status: 'Pending Approval' } : e
          ),
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Expenses & Payables',
            action: 'Expense Submitted as Payment Proposal',
            recordType: 'ExpensePayable',
            recordId: exp.id,
            reason: `Submitted ${exp.requestNumber} for maker-checker approval (no live bank transfer).`,
            evidenceRef: exp.invoiceEvidenceRef,
            linkedApprovalId: req.id,
          }),
        };
      });
      notify({
        tone: 'success',
        title: 'Expense Submitted to Approvals Centre',
        detail: 'Payment proposal only — no real bank disbursement or accounting posting.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, logPermissionDenial, notify, seed.expenses]
  );

  const createMaintenanceTicket = useCallback(
    (input: {
      unitId: string;
      category: 'Maintenance' | 'Complaint';
      priority: 'Low' | 'Medium' | 'High' | 'Urgent';
      title: string;
      description: string;
      estimatedCostEtb: number;
      evidenceRef: string;
      applyUnitStatus: boolean;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'create_maintenance_ticket');
      if (!perm.allowed) {
        logPermissionDenial('Maintenance & Complaints', 'Log Maintenance Ticket', perm.reason);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const needsApproval = input.estimatedCostEtb >= 10000;
      const ticketId = `MNT-${Date.now().toString().slice(-4)}`;
      const tNum = `${input.category === 'Complaint' ? 'CMP' : 'MNT'}-SYNTH-${seed.maintenanceTickets.length + 101}`;
      const ts = nowTimestamp().slice(0, 16);
      setSeed((prev) => {
        const req = needsApproval
          ? createApprovalRecord(prev, {
              category: 'Maintenance Cost',
              title: `Maintenance Cost Approval ${tNum} (ETB ${input.estimatedCostEtb.toLocaleString()})`,
              targetRecordType: 'MaintenanceTicket',
              targetRecordId: ticketId,
              requiredCheckerRoles: ['Finance Officer', 'General Manager', 'Owner / Director'],
              amountThresholdPlaceholder: '>= ETB 10,000.00 (Synthetic Cost Gate)',
              effectiveDate: ts.slice(0, 10),
              evidenceRef: input.evidenceRef,
              reason: input.title,
              beforeValues: { workOrderState: 'Logged', estimatedCostEtb: input.estimatedCostEtb },
              afterValues: { workOrderState: 'Scheduled', estimatedCostEtb: input.estimatedCostEtb },
              payload: { ticketId },
            })
          : null;

        return {
          ...prev,
          maintenanceTickets: [
            {
              id: ticketId,
              ownerId: activeOwnerId,
              ticketNumber: tNum,
              unitId: input.unitId,
              category: input.category,
              priority: input.priority,
              title: input.title,
              description: input.description,
              reportedDate: ts.slice(0, 10),
              estimatedCostEtb: input.estimatedCostEtb,
              workOrderState: needsApproval ? 'Cost Approval Pending' : 'Logged',
              unitMaintenanceStatusApplied: input.applyUnitStatus,
              evidenceRef: input.evidenceRef,
              timeline: [{ timestamp: ts, event: `${input.category} ticket created`, actor: currentPersona.displayName }],
            },
            ...prev.maintenanceTickets,
          ],
          units: input.applyUnitStatus
            ? prev.units.map((u) => (u.id === input.unitId ? { ...u, status: 'Maintenance' as UnitStatus } : u))
            : prev.units,
          approvals: req ? [req, ...prev.approvals] : prev.approvals,
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Maintenance & Complaints',
            action: `${input.category} Ticket Created`,
            recordType: 'MaintenanceTicket',
            recordId: ticketId,
            reason: input.title,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req?.id,
          }),
        };
      });
      notify({
        tone: 'success',
        title: `${tNum} Logged`,
        detail: needsApproval ? 'Cost >= ETB 10,000 routed for approval.' : 'Logged in maintenance work-order register.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona, logPermissionDenial, notify, seed.maintenanceTickets.length]
  );

  const advanceMaintenanceWorkOrder = useCallback(
    (ticketId: string, nextState: MaintenanceTicketRecord['workOrderState'], applyUnitStatus?: boolean) => {
      const perm = checkActionPermission(currentPersona.role, 'create_maintenance_ticket');
      if (!perm.allowed) {
        logPermissionDenial('Maintenance & Complaints', 'Update Work Order', perm.reason, ticketId);
        return false;
      }
      const ts = nowTimestamp().slice(0, 16);
      setSeed((prev) => {
        const ticket = prev.maintenanceTickets.find((m) => m.id === ticketId);
        return {
          ...prev,
          maintenanceTickets: prev.maintenanceTickets.map((m) =>
            m.id === ticketId
              ? {
                  ...m,
                  workOrderState: nextState,
                  unitMaintenanceStatusApplied:
                    applyUnitStatus !== undefined ? applyUnitStatus : m.unitMaintenanceStatusApplied,
                  timeline: [
                    { timestamp: ts, event: `Work order transitioned to ${nextState}`, actor: currentPersona.displayName },
                    ...m.timeline,
                  ],
                }
              : m
          ),
          units:
            ticket && applyUnitStatus !== undefined
              ? prev.units.map((u) =>
                  u.id === ticket.unitId
                    ? { ...u, status: applyUnitStatus ? ('Maintenance' as UnitStatus) : ('Vacant' as UnitStatus) }
                    : u
                )
              : prev.units,
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Maintenance & Complaints',
            action: `Work Order Updated (${nextState})`,
            recordType: 'MaintenanceTicket',
            recordId: ticketId,
            reason: `Transitioned maintenance ticket to ${nextState}.`,
          }),
        };
      });
      notify({ tone: 'info', title: `Work Order -> ${nextState}` });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, logPermissionDenial, notify]
  );

  const requestBackupDrill = useCallback(
    (input: { drillScope: string; evidenceRef: string }) => {
      const perm = checkActionPermission(currentPersona.role, 'request_backup_drill');
      if (!perm.allowed) {
        logPermissionDenial('Backup & Recovery', 'Request Restore Drill', perm.reason);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const drillId = `DRL-${Date.now().toString().slice(-4)}`;
      const dNum = `DRILL-SYNTH-${seed.backupDrills.length + 101}`;
      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Backup Restore Drill',
          title: `Authorize Restore Drill ${dNum}`,
          targetRecordType: 'BackupDrill',
          targetRecordId: drillId,
          workflowMode: 'Two-Step',
          requiredCheckerRoles: ['General Manager'],
          escalatorRoles: ['Owner / Director'],
          amountThresholdPlaceholder: 'Two-Step Infrastructure Gate',
          effectiveDate: new Date().toISOString().slice(0, 10),
          evidenceRef: input.evidenceRef,
          reason: input.drillScope,
          beforeValues: { drillStatus: 'Planned' },
          afterValues: { drillStatus: 'Approved Drill (Sim)' },
          payload: { drillId },
        });
        return {
          ...prev,
          backupDrills: [
            {
              id: drillId,
              ownerId: activeOwnerId,
              drillNumber: dNum,
              requestedDate: new Date().toISOString().slice(0, 10),
              drillScope: input.drillScope,
              status: 'Approval Pending',
              evidenceChecklist: [
                { label: 'Offline snapshot manifest placeholder verified', checked: true },
                { label: 'GM + Owner two-step approval', checked: false },
              ],
              evidenceRef: input.evidenceRef,
            },
            ...prev.backupDrills,
          ],
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Backup & Recovery',
            action: 'Restore Drill Approval Requested (Simulation)',
            recordType: 'BackupDrill',
            recordId: drillId,
            reason: input.drillScope,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
          }),
        };
      });
      notify({
        tone: 'success',
        title: `Restore Drill ${dNum} Submitted`,
        detail: 'Simulated request only; no real disk backup or restore executes.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, logPermissionDenial, notify, seed.backupDrills.length]
  );

  const completeApprovedBackupDrill = useCallback(
    (drillId: string) => {
      const drill = seed.backupDrills.find((d) => d.id === drillId && d.ownerId === activeOwnerId);
      if (!drill || drill.status !== 'Approved Drill (Sim)') return false;
      setSeed((prev) => ({
        ...prev,
        backupDrills: prev.backupDrills.map((d) =>
          d.id === drillId ? { ...d, status: 'Completed (Sim)' } : d
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Backup & Recovery',
          action: 'Restore Drill Completed (Simulation Only)',
          recordType: 'BackupDrill',
          recordId: drillId,
          reason: `Completed simulated restore drill ${drill.drillNumber}.`,
          evidenceRef: drill.evidenceRef,
        }),
      }));
      notify({ tone: 'success', title: 'Simulated Restore Drill Completed' });
      return true;
    },
    [activeOwnerId, appendAuditEvent, notify, seed.backupDrills]
  );

  const requestMigrationExceptionApproval = useCallback(
    (batchId: string, comment: string) => {
      const perm = checkActionPermission(currentPersona.role, 'request_migration_exception');
      if (!perm.allowed) {
        logPermissionDenial('Migration Readiness', 'Migration Exception Request', perm.reason, batchId);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return false;
      }
      const batch = seed.migrationBatches.find((b) => b.id === batchId && b.ownerId === activeOwnerId);
      if (!batch) return false;
      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Migration Exception',
          title: `Migration Staging Exception: ${batch.batchCode}`,
          targetRecordType: 'MigrationStaging',
          targetRecordId: batch.id,
          requiredCheckerRoles: ['General Manager', 'Owner / Director'],
          amountThresholdPlaceholder: `Control Total ETB ${batch.controlTotalEtbPlaceholder.toLocaleString()} (Synthetic)`,
          effectiveDate: new Date().toISOString().slice(0, 10),
          evidenceRef: batch.evidenceRef,
          reason: comment || batch.exceptionDetail || 'Staging batch exception approval simulation.',
          beforeValues: { validationState: batch.validationState },
          afterValues: { validationState: 'Validated Staging (No Real Import)' },
          payload: { batchId: batch.id },
        });
        return {
          ...prev,
          migrationBatches: prev.migrationBatches.map((b) =>
            b.id === batch.id ? { ...b, approvalStatus: 'Approval Pending' } : b
          ),
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Migration Readiness',
            action: 'Migration Exception Submitted',
            recordType: 'MigrationStaging',
            recordId: batch.id,
            reason: comment || `Submitted ${batch.batchCode} exception for approval.`,
            evidenceRef: batch.evidenceRef,
            linkedApprovalId: req.id,
          }),
        };
      });
      notify({
        tone: 'success',
        title: 'Migration Exception Queued for Approval',
        detail: 'Real production data import remains disabled.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, logPermissionDenial, notify, seed.migrationBatches]
  );

  const runAcceptanceScenario = useCallback(
    (reqId: string, outcome: 'Pass (Sim)' | 'Blocked (Expected)', note: string) => {
      const perm = checkActionPermission(currentPersona.role, 'run_acceptance_test');
      if (!perm.allowed) return false;
      const ts = nowTimestamp().slice(0, 16);
      setSeed((prev) => ({
        ...prev,
        requirementsTraceability: prev.requirementsTraceability.map((r) =>
          r.id === reqId
            ? {
                ...r,
                lastTestedAt: ts,
                lastTestedBy: `${currentPersona.displayName} (${session.actorId})`,
                lastTestOutcome: outcome,
                ownerAcceptanceStatus:
                  outcome === 'Pass (Sim)'
                    ? 'Simulated Test Passed — Awaiting Formal Sign-off'
                    : 'Blocked',
              }
            : r
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Requirements & Acceptance',
          action: `Acceptance Scenario Logged: ${outcome}`,
          recordType: 'RequirementTraceability',
          recordId: reqId,
          reason: note || `Simulated UAT scenario run (${outcome}). Does not approve production.`,
        }),
      }));
      notify({
        tone: outcome === 'Pass (Sim)' ? 'success' : 'warning',
        title: `Acceptance Check Recorded: ${outcome}`,
        detail: 'Simulated test evidence logged; formal owner & professional sign-offs remain required.',
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona, notify, session.actorId]
  );

  const logReportExport = useCallback(
    (reportTitle: string, format: 'PDF' | 'Excel') => {
      setSeed((prev) => ({
        ...prev,
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Reports',
          action: `Simulated ${format} Report Export`,
          recordType: 'Report',
          recordId: reportTitle.toUpperCase().replace(/\s+/g, '-'),
          reason: `Generated synthetic ${format} preview export for ${activeOwnerId}.`,
          afterValues: { format, syntheticOnly: true },
        }),
      }));
      notify({
        tone: 'info',
        title: `Simulated ${format} Export Ready`,
        detail: `${reportTitle} exported with SYNTHETIC DEMO DATA disclaimer.`,
      });
    },
    [activeOwnerId, appendAuditEvent, notify]
  );

  const logSimulatedEvent = useCallback(
    (
      module: AuditEvent['module'],
      action: string,
      recordType: string,
      recordId: string,
      reason: string,
      evidenceRef?: string
    ) => {
      setSeed((prev) => ({
        ...prev,
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module,
          action,
          recordType,
          recordId,
          reason,
          evidenceRef,
        }),
      }));
    },
    [activeOwnerId, appendAuditEvent]
  );

  const enqueueOfflineAction = useCallback(
    (action: Omit<OfflinePendingAction, 'id' | 'queuedAt'>) => {
      const entry: OfflinePendingAction = {
        ...action,
        id: `OFFQ-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        queuedAt: nowTimestamp().slice(0, 16),
      };
      setPendingSyncQueue((prev) => [entry, ...prev]);
    },
    []
  );

  const flushOfflineSyncQueue = useCallback(() => {
    setPendingSyncQueue((prevQueue) => {
      if (prevQueue.length === 0) return prevQueue;
      setSeed((prevSeed) => ({
        ...prevSeed,
        smsLogs: prevSeed.smsLogs.map((s) =>
          s.deliveryState === 'Queued Offline'
            ? { ...s, deliveryState: 'Delivered (Sandbox)' }
            : s
        ),
      }));
      prevQueue.forEach((item) => {
        publishRealtimeEvent({
          type:
            item.type === 'payment'
              ? 'payment:settled'
              : item.type === 'sms'
                ? 'sms:dispatched'
                : item.type === 'approval'
                  ? 'approval:decided'
                  : 'maintenance:message',
          ownerId: item.ownerId,
          data: item.payload,
        });
      });
      notify({
        tone: 'success',
        title: biText(
          locale,
          `Synced ${prevQueue.length} offline queued action(s)`,
          `${prevQueue.length} ከመስመር ውጭ የተያዙ ተግባራት ተመሳስለዋል`
        ),
      });
      return [];
    });
  }, [locale, notify]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => {
      setIsOnline(true);
      flushOfflineSyncQueue();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const unsubscribe = officeSessionReady
      ? subscribeRealtimeEvents((ev) => {
      if ((ev.type === 'state:synced' || ev.type === 'state:reset') && canSyncOfficeDb && officeSessionRole === 'staff') {
        void fetch('/api/office/state', { cache: 'no-store' })
          .then(async (res) => {
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || !ct.includes('application/json')) return;
            const data = (await res.json()) as {
              initialized?: boolean;
              revision?: number;
              state?: Partial<SeedState> | null;
            };
            if (typeof data.revision === 'number') {
              officeRevisionRef.current = data.revision;
            }
            if (data.initialized && data.state) {
              skipNextSaveRef.current = true;
              setSeed({ ...createInitialSeedState(), ...data.state });
              if (ev.type === 'state:reset') {
                notify({
                  tone: 'info',
                  title: 'Office Test Seed Reset by Trainer',
                  detail: 'Workspace synchronized with baseline SQLite snapshot.',
                });
              }
            }
          })
          .catch(() => {
            // Ignore transient sync errors
          });
        return;
      }

      setSeed((prev) => {
        if (ev.type === 'maintenance:message') {
          const msg = ev.data.message as MaintenanceMessageRecord | undefined;
          if (!msg || prev.maintenanceMessages.some((m) => m.id === msg.id)) return prev;
          return { ...prev, maintenanceMessages: [msg, ...prev.maintenanceMessages] };
        }
        if (ev.type === 'maintenance:ticket') {
          const ticket = ev.data.ticket as MaintenanceTicketRecord | undefined;
          if (!ticket || prev.maintenanceTickets.some((t) => t.id === ticket.id)) return prev;
          return { ...prev, maintenanceTickets: [ticket, ...prev.maintenanceTickets] };
        }
        if (ev.type === 'notice:published') {
          const notice = ev.data.notice as TenantNoticeRecord | undefined;
          if (!notice || prev.tenantNotices.some((n) => n.id === notice.id)) return prev;
          return { ...prev, tenantNotices: [notice, ...prev.tenantNotices] };
        }
        if (ev.type === 'payment:settled') {
          const gp = ev.data.gatewayPayment as GatewayPaymentRecord | undefined;
          const rct = ev.data.receipt as PaymentReceipt | undefined;
          let nextGateway = prev.gatewayPayments;
          let nextReceipts = prev.receipts;
          let nextCharges = prev.charges;
          if (gp && !prev.gatewayPayments.some((g) => g.id === gp.id)) {
            nextGateway = [gp, ...prev.gatewayPayments];
          }
          if (rct && !prev.receipts.some((r) => r.id === rct.id)) {
            nextReceipts = [rct, ...prev.receipts];
            nextCharges = prev.charges.map((c) => {
              const alloc = rct.allocations.find((a) => a.chargeId === c.id);
              if (!alloc) return c;
              const nextPaid = Math.min(c.billedEtb, c.paidEtb + alloc.allocatedEtb);
              return {
                ...c,
                paidEtb: nextPaid,
                status: nextPaid >= c.billedEtb ? 'Paid' : 'Partially Paid',
              };
            });
          }
          return {
            ...prev,
            gatewayPayments: nextGateway,
            receipts: nextReceipts,
            charges: nextCharges,
          };
        }
        return prev;
      });
      })
      : () => {};

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubscribe();
    };
  }, [canSyncOfficeDb, flushOfflineSyncQueue, notify, officeSessionReady, officeSessionRole]);

  const loginAsTenant = useCallback(
    (rawUsername: string, rawPassword: string): { ok: boolean; error?: string } => {
      const normalized = rawUsername.trim().toLowerCase();
      const account = TENANT_PORTAL_ACCOUNTS.find(
        (a) => a.username.toLowerCase() === normalized
      );
      if (!account) {
        return {
          ok: false,
          error:
            locale === 'am'
              ? 'የተከራይ መለያ በሰው-ሠራሽ ማውጫ ውስጥ አልተገኘም።'
              : 'Tenant portal username not found in synthetic tenant catalog.',
        };
      }
      if (rawPassword.trim() !== account.tempPasswordPlaceholder) {
        return {
          ok: false,
          error:
            locale === 'am'
              ? 'የተከራይ የይለፍ ቃል ትክክል አይደለም።'
              : 'Tenant synthetic password does not match catalog placeholder.',
        };
      }
      setActiveOwnerId(account.ownerId);
      setActiveTenantAccount(account);
      setMobileMode('tenant-mobile');
      setIsAuthenticated(false);
      if (canSyncOfficeDb) {
        setOfficeSessionReady(false);
        void fetch('/api/office/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: account.username,
            password: rawPassword.trim(),
          }),
        })
          .then((res) => {
            const ct = res.headers.get('content-type') || '';
            if (res.ok && ct.includes('application/json')) {
              setOfficeSessionRole('tenant');
              setOfficeSessionReady(true);
            }
          })
          .catch(() => {});
      }
      notify({
        tone: 'info',
        title: `${account.displayName}`,
        detail:
          locale === 'am'
            ? 'የተከራይ የሞባይል አገልግሎት ተከፍቷል።'
            : 'Signed in to Tenant Self-Service Mobile App (scoped to your unit only).',
      });
      return { ok: true };
    },
    [canSyncOfficeDb, locale, notify]
  );

  const logoutTenant = useCallback(() => {
    setOfficeSessionReady(false);
    setOfficeSessionRole(null);
    disconnectRealtimeSocket();
    if (canSyncOfficeDb) {
      void fetch('/api/office/auth/logout', { method: 'POST' }).catch(() => {});
    }
    setActiveTenantAccount(null);
    setMobileMode('desktop');
  }, [canSyncOfficeDb]);

  const dispatchAutomatedSmsReminder = useCallback(
    (input: {
      tenantId: string;
      triggerType: SmsTriggerType;
      chargeId?: string;
      ticketId?: string;
      receiptNumber?: string;
      noticeTitle?: string;
    }): boolean => {
      const tenant = seed.tenants.find((t) => t.id === input.tenantId);
      if (!tenant) return false;
      const targetOwnerId = tenant.ownerId;
      const prefs = seed.tenantPrefs.find((p) => p.tenantId === tenant.id);
      const prefLocale: UiLocale = prefs?.preferredLocale || locale;
      const unit =
        seed.units.find((u) => u.currentTenantId === tenant.id) ||
        seed.units.find((u) => u.ownerId === targetOwnerId);
      const charge = input.chargeId
        ? seed.charges.find((c) => c.id === input.chargeId)
        : seed.charges.find((c) => c.tenantId === tenant.id && c.billedEtb > c.paidEtb);
      const ticket = input.ticketId
        ? seed.maintenanceTickets.find((m) => m.id === input.ticketId)
        : undefined;

      const rawMsisdn = prefs?.msisdn || tenant.phonePlaceholder.replace(/[^\d+]/g, '') || '+251910000001';
      const maskedMsisdn =
        rawMsisdn.length >= 9
          ? `${rawMsisdn.slice(0, 6)}****${rawMsisdn.slice(-3)}`
          : rawMsisdn;

      const body = buildBilingualSmsBody(input.triggerType, prefLocale, {
        tenantName: tenant.name,
        unitCode: unit?.code || 'UNIT',
        amountEtb: charge ? Math.max(0, charge.billedEtb - charge.paidEtb) : undefined,
        invoiceNumber: charge?.invoiceNumber,
        dueDate: charge?.dueDate,
        receiptNumber: input.receiptNumber,
        ticketNumber: ticket?.ticketNumber,
        workOrderState: ticket?.workOrderState,
        noticeTitle: input.noticeTitle,
      });

      const smsRecord: SmsDispatchRecord = {
        id: `SMS-${Date.now()}-${Math.floor(10 + Math.random() * 89)}`,
        ownerId: targetOwnerId,
        tenantId: tenant.id,
        recipientMsisdn: maskedMsisdn,
        triggerType: input.triggerType,
        locale: prefLocale,
        messageBody: body,
        deliveryState: isOnline ? 'Delivered (Sandbox)' : 'Queued Offline',
        dispatchedAt: nowTimestamp().slice(0, 16),
        channelMode: 'SANDBOX DISPATCH — NO LIVE TELCO',
      };

      setSeed((prev) => ({
        ...prev,
        smsLogs: [smsRecord, ...prev.smsLogs],
        auditEvents: appendAuditEvent(prev, {
          ownerId: targetOwnerId,
          module: 'Rent & Collections',
          action: `Automated SMS Logged (${input.triggerType})`,
          recordType: 'SmsDispatch',
          recordId: smsRecord.id,
          reason: `Dispatched synthetic ${prefLocale.toUpperCase()} SMS alert to ${tenant.name} (${maskedMsisdn}).`,
        }),
      }));

      if (!isOnline) {
        enqueueOfflineAction({
          ownerId: targetOwnerId,
          type: 'sms',
          label: `SMS ${input.triggerType} -> ${tenant.name}`,
          payload: { smsId: smsRecord.id },
        });
      } else if (officeSessionRole !== 'tenant') {
        void postSmsDispatchToServer({
          ownerId: targetOwnerId,
          count: 1,
          triggerType: input.triggerType,
        });
      }
      return true;
    },
    [
      appendAuditEvent,
      enqueueOfflineAction,
      isOnline,
      locale,
      officeSessionRole,
      seed.charges,
      seed.maintenanceTickets,
      seed.tenantPrefs,
      seed.tenants,
      seed.units,
    ]
  );

  const dispatchBatchOverdueSmsReminders = useCallback((): number => {
    const openCharges = seed.charges.filter(
      (c) => c.ownerId === activeOwnerId && c.billedEtb > c.paidEtb
    );
    const seenTenants = new Set<string>();
    let sent = 0;
    openCharges.forEach((ch) => {
      if (seenTenants.has(ch.tenantId)) return;
      seenTenants.add(ch.tenantId);
      if (
        dispatchAutomatedSmsReminder({
          tenantId: ch.tenantId,
          triggerType: ch.status === 'Overdue' ? 'Overdue Reminder' : 'Rent Due Soon',
          chargeId: ch.id,
        })
      ) {
        sent += 1;
      }
    });
    notify({
      tone: sent > 0 ? 'success' : 'info',
      title:
        sent > 0
          ? biText(
              locale,
              `Sent ${sent} Automated Bilingual SMS Alert(s)`,
              `${sent} ራስ-ሰር የSMS ማሳሰቢያዎች ተልከዋል`
            )
          : biText(locale, 'No Open Tenant Balances to Remind', 'ማሳሰቢያ የሚያስፈልገው ክፍት ሂሳብ የለም'),
      detail: 'SANDBOX DISPATCH — NO LIVE TELCO',
    });
    return sent;
  }, [activeOwnerId, dispatchAutomatedSmsReminder, locale, notify, seed.charges]);

  const sendMaintenanceMessage = useCallback(
    (input: {
      ticketId: string;
      body: string;
      visibility: 'Shared with Tenant' | 'Internal Staff Note';
      asTenant?: boolean;
    }): boolean => {
      const trimmed = input.body.trim();
      if (!trimmed) return false;
      const ticket = seed.maintenanceTickets.find((m) => m.id === input.ticketId);
      if (!ticket) return false;

      const senderName =
        input.asTenant && activeTenantAccount
          ? activeTenantAccount.displayName
          : currentPersona.displayName;
      const senderRole: MaintenanceMessageRecord['senderRole'] = input.asTenant
        ? 'Tenant'
        : currentPersona.role === 'Owner / Director'
          ? 'Owner'
          : 'Staff';

      const msg: MaintenanceMessageRecord = {
        id: `MMSG-${Date.now()}-${Math.floor(10 + Math.random() * 89)}`,
        ownerId: ticket.ownerId,
        ticketId: ticket.id,
        senderName,
        senderRole,
        visibility: input.asTenant ? 'Shared with Tenant' : input.visibility,
        body: trimmed,
        timestamp: nowTimestamp().slice(0, 16),
      };

      const notif: AppNotification = {
        id: `NOTIF-MMSG-${Date.now()}`,
        ownerId: ticket.ownerId,
        title: `${ticket.ticketNumber} Message (${senderRole})`,
        detail: `${senderName}: ${trimmed.slice(0, 80)}`,
        targetSection: 'maintenance',
        timestamp: msg.timestamp,
        read: false,
      };

      setSeed((prev) => ({
        ...prev,
        maintenanceMessages: [...prev.maintenanceMessages, msg],
        notifications: [notif, ...prev.notifications],
        auditEvents: appendAuditEvent(prev, {
          ownerId: ticket.ownerId,
          module: 'Maintenance & Complaints',
          action: `Maintenance Thread Reply (${msg.visibility})`,
          recordType: 'MaintenanceTicket',
          recordId: ticket.id,
          reason: `${senderName} posted: ${trimmed.slice(0, 100)}`,
        }),
      }));

      if (!isOnline) {
        enqueueOfflineAction({
          ownerId: ticket.ownerId,
          type: 'maintenance_message',
          label: `Reply on ${ticket.ticketNumber}`,
          payload: { message: msg },
        });
      } else {
        publishRealtimeEvent({
          type: 'maintenance:message',
          ownerId: ticket.ownerId,
          data: { message: msg },
        });
      }

      if (!input.asTenant && msg.visibility === 'Shared with Tenant' && ticket.tenantId) {
        dispatchAutomatedSmsReminder({
          tenantId: ticket.tenantId,
          triggerType: 'Maintenance Update',
          ticketId: ticket.id,
        });
      }
      return true;
    },
    [
      activeTenantAccount,
      appendAuditEvent,
      currentPersona.displayName,
      currentPersona.role,
      dispatchAutomatedSmsReminder,
      enqueueOfflineAction,
      isOnline,
      seed.maintenanceTickets,
    ]
  );

  const createTenantMaintenanceTicket = useCallback(
    (input: {
      unitId: string;
      category: 'Maintenance' | 'Complaint';
      priority: 'Low' | 'Medium' | 'High' | 'Urgent';
      title: string;
      description: string;
    }): boolean => {
      if (!activeTenantAccount || !input.title.trim()) return false;
      const ticketId = `MNT-TEN-${Date.now().toString().slice(-5)}`;
      const tNum = `${input.category === 'Complaint' ? 'CMP' : 'MNT'}-MOB-${seed.maintenanceTickets.length + 101}`;
      const ts = nowTimestamp().slice(0, 16);
      const newTicket: MaintenanceTicketRecord = {
        id: ticketId,
        ownerId: activeTenantAccount.ownerId,
        ticketNumber: tNum,
        unitId: input.unitId,
        tenantId: activeTenantAccount.tenantId,
        category: input.category,
        priority: input.priority,
        title: input.title.trim(),
        description: input.description.trim() || 'Submitted via Tenant Self-Service Mobile App.',
        reportedDate: ts.slice(0, 10),
        estimatedCostEtb: 0,
        workOrderState: 'Logged',
        unitMaintenanceStatusApplied: false,
        evidenceRef: `MOB-TKT-${Date.now().toString().slice(-4)}`,
        timeline: [{ timestamp: ts, event: 'Submitted by Tenant Mobile App', actor: activeTenantAccount.displayName }],
      };

      const initialMsg: MaintenanceMessageRecord = {
        id: `MMSG-INIT-${Date.now()}`,
        ownerId: activeTenantAccount.ownerId,
        ticketId,
        senderName: activeTenantAccount.displayName,
        senderRole: 'Tenant',
        visibility: 'Shared with Tenant',
        body: input.description.trim() || input.title.trim(),
        timestamp: ts,
      };

      const notif: AppNotification = {
        id: `NOTIF-MOB-TKT-${Date.now()}`,
        ownerId: activeTenantAccount.ownerId,
        title: `New Mobile ${input.category}: ${tNum}`,
        detail: `${activeTenantAccount.displayName} (${input.priority}) — ${input.title}`,
        targetSection: 'maintenance',
        timestamp: ts,
        read: false,
      };

      setSeed((prev) => ({
        ...prev,
        maintenanceTickets: [newTicket, ...prev.maintenanceTickets],
        maintenanceMessages: [...prev.maintenanceMessages, initialMsg],
        notifications: [notif, ...prev.notifications],
        auditEvents: [
          {
            id: `AUD-${9000 + prev.auditEvents.length + 1}`,
            ownerId: activeTenantAccount.ownerId,
            timestamp: nowTimestamp(),
            actor: activeTenantAccount.displayName,
            actorId: activeTenantAccount.tenantId,
            persona: 'Clerk',
            executionMode: 'Simulation',
            module: 'Maintenance & Complaints',
            action: `Tenant Mobile ${input.category} Submitted`,
            recordType: 'MaintenanceTicket',
            recordId: ticketId,
            reason: input.title.trim(),
          },
          ...prev.auditEvents,
        ],
      }));

      if (!isOnline) {
        enqueueOfflineAction({
          ownerId: activeTenantAccount.ownerId,
          type: 'maintenance_ticket',
          label: `Mobile Ticket ${tNum}`,
          payload: { ticket: newTicket },
        });
      } else {
        publishRealtimeEvent({
          type: 'maintenance:ticket',
          ownerId: activeTenantAccount.ownerId,
          data: { ticket: newTicket },
        });
      }

      notify({
        tone: 'success',
        title: `${tNum} Submitted`,
        detail: biText(locale, 'Building team notified in real time.', 'የህንጻው አስተዳደር በቀጥታ ተነግሮታል።'),
      });
      return true;
    },
    [activeTenantAccount, enqueueOfflineAction, isOnline, locale, notify, seed.maintenanceTickets.length]
  );

  const publishTenantNotice = useCallback(
    (input: {
      tenantId: string | 'ALL';
      titleEn: string;
      titleAm: string;
      bodyEn: string;
      bodyAm: string;
      category: TenantNoticeRecord['category'];
    }): boolean => {
      if (!input.titleEn.trim() || !input.bodyEn.trim()) return false;
      const notice: TenantNoticeRecord = {
        id: `NTC-${Date.now().toString().slice(-5)}`,
        ownerId: activeOwnerId,
        tenantId: input.tenantId,
        titleEn: input.titleEn.trim(),
        titleAm: input.titleAm.trim() || input.titleEn.trim(),
        bodyEn: input.bodyEn.trim(),
        bodyAm: input.bodyAm.trim() || input.bodyEn.trim(),
        category: input.category,
        publishedAt: nowTimestamp().slice(0, 16),
        publishedBy: currentPersona.displayName,
        readByTenantIds: [],
      };
      setSeed((prev) => ({
        ...prev,
        tenantNotices: [notice, ...prev.tenantNotices],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Tenants & Leases',
          action: 'Tenant Notice Published',
          recordType: 'TenantNotice',
          recordId: notice.id,
          reason: `${notice.category}: ${notice.titleEn}`,
        }),
      }));
      publishRealtimeEvent({
        type: 'notice:published',
        ownerId: activeOwnerId,
        data: { notice },
      });
      if (input.tenantId !== 'ALL') {
        dispatchAutomatedSmsReminder({
          tenantId: input.tenantId,
          triggerType: 'General Notice',
          noticeTitle: notice.titleEn,
        });
      }
      notify({
        tone: 'success',
        title: biText(locale, 'Notice Published to Tenant Mobile', 'ማስታወቂያው ወደ ተከራይ መተግበሪያ ተልኳል'),
      });
      return true;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, dispatchAutomatedSmsReminder, locale, notify]
  );

  const markTenantNoticeRead = useCallback((noticeId: string, tenantId: string) => {
    setSeed((prev) => ({
      ...prev,
      tenantNotices: prev.tenantNotices.map((n) =>
        n.id === noticeId && !n.readByTenantIds.includes(tenantId)
          ? { ...n, readByTenantIds: [...n.readByTenantIds, tenantId] }
          : n
      ),
    }));
  }, []);

  const updateTenantNotificationPrefs = useCallback(
    (
      tenantId: string,
      updates: Partial<Pick<TenantNotificationPrefs, 'smsEnabled' | 'pushEnabled' | 'preferredLocale' | 'msisdn'>>
    ) => {
      setSeed((prev) => ({
        ...prev,
        tenantPrefs: prev.tenantPrefs.map((p) =>
          p.tenantId === tenantId ? { ...p, ...updates } : p
        ),
      }));
      if (updates.preferredLocale) {
        setLocale(updates.preferredLocale);
      }
      notify({
        tone: 'success',
        title: biText(locale, 'Notification Preferences Saved', 'የማንቂያ ምርጫዎች ተቀምጠዋል'),
      });
    },
    [locale, notify]
  );

  const submitTenantMobilePayment = useCallback(
    (input: {
      gatewayType: 'Telebirr USSD QR' | 'ArifPay Checkout' | 'CBE Transfer Slip';
      tenantId: string;
      unitId: string;
      chargeId: string;
      amountEtb: number;
      referenceNumber: string;
      phoneOrAccount: string;
      notes: string;
      ussdSessionId?: string;
      ussdDialString?: string;
      traceId?: string;
      arifpaySessionId?: string;
      arifpayNonce?: string;
      arifpayMethod?: 'TELEBIRR' | 'CBE';
      autoVerified?: boolean;
    }): PaymentReceipt | null => {
      const targetCharge = seed.charges.find(
        (c) => c.id === input.chargeId && c.tenantId === input.tenantId
      );
      if (!targetCharge) return null;

      const openBalance = Math.max(0, targetCharge.billedEtb - targetCharge.paidEtb);
      const allocatedEtb = Math.min(Math.max(0, input.amountEtb), openBalance);
      if (allocatedEtb <= 0) return null;

      const ownerId = targetCharge.ownerId;
      const tsMs = Date.now();
      const tsShort = nowTimestamp().slice(0, 16);
      const paymentId = `GATE-MOB-${tsMs}`;
      const receiptId = `RCT-MOB-${tsMs}`;
      const seqNum = String(seed.receipts.filter((r) => r.ownerId === ownerId).length + 1).padStart(3, '0');
      const receiptNumber = `DEMO-MOB-${ownerId === 'OWN-ALPHA' ? 'A' : 'B'}-2026-${seqNum}`;
      const method: PaymentMethod =
        input.gatewayType === 'Telebirr USSD QR'
          ? 'Telebirr (Synthetic)'
          : input.gatewayType === 'ArifPay Checkout'
            ? 'ArifPay (Synthetic)'
            : 'Bank Transfer';
      const tenant = seed.tenants.find((t) => t.id === input.tenantId);
      const tenantName = tenant?.name || input.tenantId;
      const gatewayStatus: GatewayPaymentRecord['status'] = input.autoVerified
        ? 'Verified'
        : 'Pending Verification';

      const newReceipt: PaymentReceipt = {
        id: receiptId,
        ownerId,
        receiptNumber,
        tenantId: input.tenantId,
        unitId: targetCharge.unitId,
        paymentDate: new Date().toISOString().slice(0, 10),
        amountEtb: allocatedEtb,
        method,
        referencePlaceholder: input.referenceNumber,
        recordedBy: `${tenantName} (Tenant Mobile ${input.gatewayType})`,
        allocations: [
          {
            chargeId: targetCharge.id,
            invoiceNumber: targetCharge.invoiceNumber,
            allocatedEtb,
          },
        ],
        documentState: 'Issued — Demo Only',
        lineDescription: `Tenant Mobile ${input.gatewayType} — ${targetCharge.invoiceNumber} · Ref: ${input.referenceNumber}`,
        taxableStatusPlaceholder: 'Undetermined — Tax Config Not Active',
        taxTreatmentPlaceholder: 'Pending Adviser Confirmation — No Live Tax Calculation',
        retentionClassPlaceholder: 'RET-02 · Retention duration pending professional confirmation',
        history: [
          {
            timestamp: tsShort,
            event: `Self-service mobile payment via ${input.gatewayType} (${input.referenceNumber})`,
            actor: tenantName,
            state: 'Issued — Demo Only',
          },
        ],
      };

      const newRecord: GatewayPaymentRecord = {
        id: paymentId,
        ownerId,
        gatewayType: input.gatewayType,
        tenantId: input.tenantId,
        unitId: targetCharge.unitId,
        chargeId: targetCharge.id,
        amountEtb: allocatedEtb,
        referenceNumber: input.referenceNumber,
        status: gatewayStatus,
        submittedAt: tsShort,
        phoneOrAccount: input.phoneOrAccount,
        notes: input.notes,
        ussdSessionId: input.ussdSessionId,
        ussdDialString: input.ussdDialString,
        traceId: input.traceId,
        arifpaySessionId: input.arifpaySessionId,
        arifpayNonce: input.arifpayNonce,
        arifpayMethod: input.arifpayMethod,
        receiptId: newReceipt.id,
        ...(input.autoVerified
          ? {
              verifiedBy: `${input.gatewayType} Sandbox Webhook`,
              verifiedAt: tsShort,
            }
          : {}),
      };

      const notif: AppNotification = {
        id: `NOTIF-MOB-PAY-${tsMs}`,
        ownerId,
        title: `Mobile Payment: ${receiptNumber}`,
        detail: `${tenantName} paid ETB ${allocatedEtb.toLocaleString()} via ${input.gatewayType}.`,
        targetSection: 'collections',
        timestamp: tsShort,
        read: false,
      };

      setSeed((prev) => ({
        ...prev,
        gatewayPayments: [newRecord, ...prev.gatewayPayments],
        receipts: [newReceipt, ...prev.receipts],
        notifications: [notif, ...prev.notifications],
        charges: prev.charges.map((c) => {
          if (c.id !== targetCharge.id) return c;
          const nextPaid = Math.min(c.billedEtb, c.paidEtb + allocatedEtb);
          return {
            ...c,
            paidEtb: nextPaid,
            status: nextPaid >= c.billedEtb ? 'Paid' : 'Partially Paid',
          };
        }),
        auditEvents: [
          {
            id: `AUD-${9000 + prev.auditEvents.length + 1}`,
            ownerId,
            timestamp: nowTimestamp(),
            actor: tenantName,
            actorId: input.tenantId,
            persona: 'Collections Clerk',
            executionMode: 'Simulation',
            module: 'Rent & Collections',
            action: `Tenant Mobile Payment (${input.gatewayType})`,
            recordType: 'PaymentReceipt',
            recordId: newReceipt.id,
            reason: `Self-service ${input.gatewayType} settlement ETB ${allocatedEtb.toLocaleString()} for ${targetCharge.invoiceNumber}.`,
            evidenceRef: input.referenceNumber,
          },
          ...prev.auditEvents,
        ],
      }));

      if (input.autoVerified) {
        dispatchAutomatedSmsReminder({
          tenantId: input.tenantId,
          triggerType: 'Payment Confirmed',
          chargeId: targetCharge.id,
          receiptNumber,
        });
      }

      if (!isOnline) {
        enqueueOfflineAction({
          ownerId,
          type: 'payment',
          label: `Mobile Pay ${receiptNumber}`,
          payload: { gatewayPayment: newRecord, receipt: newReceipt },
        });
      } else {
        publishRealtimeEvent({
          type: 'payment:settled',
          ownerId,
          data: { gatewayPayment: newRecord, receipt: newReceipt, chargeId: targetCharge.id },
        });
      }

      notify({
        tone: 'success',
        title: `${receiptNumber} Issued`,
        detail: `${input.gatewayType} · ETB ${allocatedEtb.toLocaleString()}`,
      });
      return newReceipt;
    },
    [dispatchAutomatedSmsReminder, enqueueOfflineAction, isOnline, notify, seed.charges, seed.receipts, seed.tenants]
  );

  const requestTenantPaymentReminder = useCallback(
    (input: {
      tenantId: string;
      chargeIds: string[];
      channel: PaymentReminderChannel;
      recipientEmail?: string;
      recipientMsisdn?: string;
      note?: string;
    }): PaymentReminderRequestRecord | null => {
      const tenant = seed.tenants.find((t) => t.id === input.tenantId);
      if (!tenant) return null;

      const selectedCharges = seed.charges.filter(
        (c) =>
          c.tenantId === input.tenantId &&
          input.chargeIds.includes(c.id) &&
          c.billedEtb > c.paidEtb
      );
      if (selectedCharges.length === 0) return null;

      const targetOwnerId = tenant.ownerId;
      const prefs = seed.tenantPrefs.find((p) => p.tenantId === tenant.id);
      const effectiveLocale: UiLocale = prefs?.preferredLocale || locale;
      const resolvedEmail = (input.recipientEmail ?? tenant.emailPlaceholder ?? '').trim();
      const includesEmail = input.channel === 'Email' || input.channel === 'Email & Notification';
      const includesNotification =
        input.channel === 'Notification' || input.channel === 'Email & Notification';

      if (includesEmail && !isValidEmailAddress(resolvedEmail)) {
        notify({
          tone: 'error',
          title: biText(locale, 'Invalid Email Address', 'የተሳሳተ የኢሜይል አድራሻ'),
          detail: biText(
            locale,
            'Enter a valid recipient email address for the payment reminder.',
            'ለክፍያ ማሳሰቢያው ትክክለኛ የኢሜይል አድራሻ ያስገቡ።'
          ),
        });
        return null;
      }

      const rawMsisdn =
        input.recipientMsisdn?.trim() ||
        prefs?.msisdn ||
        tenant.phonePlaceholder.replace(/[^\d+]/g, '') ||
        '+251910000001';
      const maskedMsisdn = maskMsisdnForDisplay(rawMsisdn);
      const tenantUnits = seed.units.filter((u) =>
        selectedCharges.some((ch) => ch.unitId === u.id)
      );
      const unitLabel =
        tenantUnits.map((u) => u.code).join(', ') ||
        activeTenantAccount?.unitLabel ||
        'Assigned Unit';

      const copy = buildManualReminderCopy({
        locale: effectiveLocale,
        tenantName: tenant.name,
        unitLabel,
        charges: selectedCharges,
        channel: input.channel,
        recipientEmail: resolvedEmail || tenant.emailPlaceholder,
        note: input.note,
      });

      const tsMs = Date.now();
      const tsShort = nowTimestamp().slice(0, 16);
      const deliveryStatus: PaymentReminderRequestRecord['deliveryStatus'] = isOnline
        ? 'Delivered (Sandbox)'
        : 'Queued Offline';

      const reminderRecord: PaymentReminderRequestRecord = {
        id: `REM-${tsMs}`,
        ownerId: targetOwnerId,
        tenantId: tenant.id,
        chargeIds: selectedCharges.map((c) => c.id),
        invoiceNumbers: selectedCharges.map((c) => c.invoiceNumber),
        totalOpenEtb: copy.totalOpenEtb,
        channel: input.channel,
        recipientEmail: resolvedEmail || tenant.emailPlaceholder,
        recipientMsisdn: includesNotification ? maskedMsisdn : undefined,
        note: input.note?.trim() || undefined,
        emailSubject: copy.emailSubject,
        emailPreviewBody: copy.emailPreviewBody,
        notificationBody: copy.notificationBody,
        requestedAt: tsShort,
        deliveryStatus,
      };

      const noticeRecord: TenantNoticeRecord = {
        id: `NTC-REM-${tsMs.toString().slice(-6)}`,
        ownerId: targetOwnerId,
        tenantId: tenant.id,
        titleEn: copy.noticeTitleEn,
        titleAm: copy.noticeTitleAm,
        bodyEn: copy.noticeBodyEn,
        bodyAm: copy.noticeBodyAm,
        category: 'Rent Reminder',
        publishedAt: tsShort,
        publishedBy: `${tenant.name} (Self-Requested)`,
        readByTenantIds: [],
      };

      const smsRecord: SmsDispatchRecord | null = includesNotification
        ? {
            id: `SMS-REM-${tsMs}`,
            ownerId: targetOwnerId,
            tenantId: tenant.id,
            recipientMsisdn: maskedMsisdn,
            triggerType: 'Overdue Reminder',
            locale: effectiveLocale,
            messageBody: copy.notificationBody,
            deliveryState: deliveryStatus,
            dispatchedAt: tsShort,
            channelMode: 'SANDBOX DISPATCH — NO LIVE TELCO',
          }
        : null;

      const officeNotif: AppNotification = {
        id: `NOTIF-REM-${tsMs}`,
        ownerId: targetOwnerId,
        title: `Manual Payment Reminder Requested (${input.channel})`,
        detail: `${tenant.name} requested reminder for ${copy.invoiceList} (ETB ${copy.totalOpenEtb.toLocaleString()}).`,
        targetSection: 'collections',
        timestamp: tsShort,
        read: false,
      };

      setSeed((prev) => ({
        ...prev,
        paymentReminderRequests: [reminderRecord, ...(prev.paymentReminderRequests || [])],
        tenantNotices: [noticeRecord, ...prev.tenantNotices],
        smsLogs: smsRecord ? [smsRecord, ...prev.smsLogs] : prev.smsLogs,
        notifications: [officeNotif, ...prev.notifications],
        auditEvents: [
          {
            id: `AUD-${9000 + prev.auditEvents.length + 1}`,
            ownerId: targetOwnerId,
            timestamp: nowTimestamp(),
            actor: tenant.name,
            actorId: tenant.id,
            persona: 'Collections Clerk',
            executionMode: 'Simulation',
            module: 'Rent & Collections',
            action: `Tenant Manual Payment Reminder Requested (${input.channel})`,
            recordType: 'PaymentReminderRequest',
            recordId: reminderRecord.id,
            reason: `Tenant requested ${input.channel} reminder for missed deadline invoice(s): ${copy.invoiceList} (ETB ${copy.totalOpenEtb.toLocaleString()}).`,
            evidenceRef: reminderRecord.id,
          },
          ...prev.auditEvents,
        ],
      }));

      if (
        includesNotification &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        try {
          new window.Notification(copy.noticeTitleEn, {
            body: copy.notificationBody,
          });
        } catch {
          // Ignore browser Notification constructor restrictions
        }
      }

      if (!isOnline) {
        enqueueOfflineAction({
          ownerId: targetOwnerId,
          type: 'sms',
          label: `Reminder (${input.channel}) -> ${copy.invoiceList}`,
          payload: { reminderId: reminderRecord.id },
        });
      } else {
        publishRealtimeEvent({
          type: 'notice:published',
          ownerId: targetOwnerId,
          data: { notice: noticeRecord, reminder: reminderRecord },
        });
      }

      notify({
        tone: 'success',
        title: biText(
          locale,
          `Payment Reminder Sent (${input.channel})`,
          `የክፍያ ማሳሰቢያ ተልኳል (${input.channel})`
        ),
        detail: `${copy.invoiceList} · ETB ${copy.totalOpenEtb.toLocaleString()} (${deliveryStatus})`,
      });

      return reminderRecord;
    },
    [
      activeTenantAccount?.unitLabel,
      enqueueOfflineAction,
      isOnline,
      locale,
      notify,
      seed.charges,
      seed.tenantPrefs,
      seed.tenants,
      seed.units,
    ]
  );

  // Strictly isolated owner projections
  const activeOwner = useMemo(
    () => seed.owners.find((o) => o.id === activeOwnerId) || seed.owners[0],
    [seed.owners, activeOwnerId]
  );
  const ownerProperties = useMemo(
    () => seed.properties.filter((p) => p.ownerId === activeOwnerId),
    [seed.properties, activeOwnerId]
  );
  const ownerBuildings = useMemo(
    () => seed.buildings.filter((b) => b.ownerId === activeOwnerId),
    [seed.buildings, activeOwnerId]
  );
  const ownerUnits = useMemo(
    () => seed.units.filter((u) => u.ownerId === activeOwnerId),
    [seed.units, activeOwnerId]
  );
  const ownerTenants = useMemo(
    () => seed.tenants.filter((t) => t.ownerId === activeOwnerId),
    [seed.tenants, activeOwnerId]
  );
  const ownerLeases = useMemo(
    () => seed.leases.filter((l) => l.ownerId === activeOwnerId),
    [seed.leases, activeOwnerId]
  );
  const ownerCharges = useMemo(
    () => seed.charges.filter((c) => c.ownerId === activeOwnerId),
    [seed.charges, activeOwnerId]
  );
  const ownerReceipts = useMemo(
    () => seed.receipts.filter((r) => r.ownerId === activeOwnerId),
    [seed.receipts, activeOwnerId]
  );
  const ownerAccounts = useMemo(
    () => seed.accounts.filter((a) => a.ownerId === activeOwnerId),
    [seed.accounts, activeOwnerId]
  );
  const ownerAccountingPolicies = useMemo(
    () => seed.accountingPolicies.filter((p) => p.ownerId === activeOwnerId),
    [seed.accountingPolicies, activeOwnerId]
  );
  const ownerJournalEntries = useMemo(
    () => seed.journalEntries.filter((j) => j.ownerId === activeOwnerId),
    [seed.journalEntries, activeOwnerId]
  );
  const ownerTaxRules = useMemo(
    () => seed.taxRules.filter((t) => t.ownerId === activeOwnerId),
    [seed.taxRules, activeOwnerId]
  );
  const ownerResearchRequirements = useMemo(
    () => seed.researchRequirements.filter((r) => r.ownerId === activeOwnerId),
    [seed.researchRequirements, activeOwnerId]
  );
  const ownerSourceRecords = useMemo(
    () => seed.sourceRecords.filter((s) => s.ownerId === activeOwnerId),
    [seed.sourceRecords, activeOwnerId]
  );
  const ownerAdviserQuestions = useMemo(
    () => seed.adviserQuestions.filter((q) => q.ownerId === activeOwnerId),
    [seed.adviserQuestions, activeOwnerId]
  );
  const ownerProductionGates = useMemo(
    () => seed.productionGates.filter((g) => g.ownerId === activeOwnerId),
    [seed.productionGates, activeOwnerId]
  );
  const ownerRetentionClasses = useMemo(
    () => seed.retentionClasses.filter((r) => r.ownerId === activeOwnerId),
    [seed.retentionClasses, activeOwnerId]
  );
  const ownerApprovals = useMemo(
    () => seed.approvals.filter((a) => a.ownerId === activeOwnerId),
    [seed.approvals, activeOwnerId]
  );
  const ownerAuditEvents = useMemo(
    () => seed.auditEvents.filter((e) => e.ownerId === activeOwnerId),
    [seed.auditEvents, activeOwnerId]
  );
  const ownerNotifications = useMemo(
    () => seed.notifications.filter((n) => n.ownerId === activeOwnerId),
    [seed.notifications, activeOwnerId]
  );
  const ownerAccessReviews = useMemo(
    () => seed.quarterlyAccessReviews.filter((r) => r.ownerId === activeOwnerId),
    [seed.quarterlyAccessReviews, activeOwnerId]
  );
  const ownerRentalApplications = useMemo(
    () => seed.rentalApplications.filter((a) => a.ownerId === activeOwnerId),
    [seed.rentalApplications, activeOwnerId]
  );
  const ownerExpenses = useMemo(
    () => seed.expenses.filter((e) => e.ownerId === activeOwnerId),
    [seed.expenses, activeOwnerId]
  );
  const ownerMaintenanceTickets = useMemo(
    () => seed.maintenanceTickets.filter((m) => m.ownerId === activeOwnerId),
    [seed.maintenanceTickets, activeOwnerId]
  );
  const ownerBackupPolicies = useMemo(
    () => seed.backupPolicies.filter((p) => p.ownerId === activeOwnerId),
    [seed.backupPolicies, activeOwnerId]
  );
  const ownerBackupDrills = useMemo(
    () => seed.backupDrills.filter((d) => d.ownerId === activeOwnerId),
    [seed.backupDrills, activeOwnerId]
  );
  const ownerMigrationBatches = useMemo(
    () => seed.migrationBatches.filter((b) => b.ownerId === activeOwnerId),
    [seed.migrationBatches, activeOwnerId]
  );
  const ownerMigrationMappings = useMemo(
    () => seed.migrationMappings.filter((m) => m.ownerId === activeOwnerId),
    [seed.migrationMappings, activeOwnerId]
  );
  const ownerRequirementsTraceability = useMemo(
    () => seed.requirementsTraceability.filter((t) => t.ownerId === activeOwnerId),
    [seed.requirementsTraceability, activeOwnerId]
  );
  const ownerGatewayPayments = useMemo(
    () => seed.gatewayPayments.filter((g) => g.ownerId === activeOwnerId),
    [seed.gatewayPayments, activeOwnerId]
  );
  const ownerMaintenanceMessages = useMemo(
    () => seed.maintenanceMessages.filter((m) => m.ownerId === activeOwnerId),
    [seed.maintenanceMessages, activeOwnerId]
  );
  const ownerTenantNotices = useMemo(
    () => seed.tenantNotices.filter((n) => n.ownerId === activeOwnerId),
    [seed.tenantNotices, activeOwnerId]
  );
  const ownerSmsLogs = useMemo(
    () => seed.smsLogs.filter((s) => s.ownerId === activeOwnerId),
    [seed.smsLogs, activeOwnerId]
  );
  const ownerTenantPrefs = useMemo(
    () => seed.tenantPrefs.filter((p) => p.ownerId === activeOwnerId),
    [seed.tenantPrefs, activeOwnerId]
  );
  const ownerPaymentReminderRequests = useMemo(
    () => (seed.paymentReminderRequests || []).filter((r) => r.ownerId === activeOwnerId),
    [seed.paymentReminderRequests, activeOwnerId]
  );

  const ownerOromifaTemplates = useMemo(
    () => oromifaTemplates.filter((t) => t.ownerId === activeOwnerId),
    [oromifaTemplates, activeOwnerId]
  );

  const saveOromifaTemplate = useCallback(
    (input: {
      id?: string;
      templateName: string;
      description: string;
      data: OromifaContractData;
    }): OromifaContractTemplate => {
      const updatedAt = new Date().toISOString().slice(0, 10);
      const id = input.id || `TPL-OM-${Date.now()}`;
      const record: OromifaContractTemplate = {
        id,
        ownerId: activeOwnerId,
        templateName: input.templateName.trim(),
        description: input.description.trim(),
        updatedAt,
        data: input.data,
      };
      setOromifaTemplates((prev) => {
        const exists = prev.some((t) => t.id === id);
        return exists ? prev.map((t) => (t.id === id ? record : t)) : [record, ...prev];
      });
      notify({
        tone: 'success',
        title: 'Oromifa Contract Template Saved',
        detail: `${record.templateName} saved for ${activeOwnerId}.`,
      });
      return record;
    },
    [activeOwnerId, notify]
  );

  const deleteOromifaTemplate = useCallback(
    (templateId: string) => {
      setOromifaTemplates((prev) => prev.filter((t) => t.id !== templateId));
      notify({
        tone: 'info',
        title: 'Oromifa Template Removed',
        detail: `Template ${templateId} deleted.`,
      });
    },
    [notify]
  );

  const ownerLedgerConfig = useMemo(
    () =>
      seed.ledgerConfigs.find((c) => c.ownerId === activeOwnerId) ||
      buildHidarAlphaBundle().config,
    [seed.ledgerConfigs, activeOwnerId]
  );

  const ownerLedgerAccountsV2 = useMemo(
    () => seed.ledgerAccountsV2.filter((a) => a.ownerId === activeOwnerId),
    [seed.ledgerAccountsV2, activeOwnerId]
  );

  const ownerAccountingPeriods = useMemo(
    () => seed.accountingPeriods.filter((p) => p.ownerId === activeOwnerId),
    [seed.accountingPeriods, activeOwnerId]
  );

  const ownerLedgerJournals = useMemo(
    () => seed.ledgerJournals.filter((j) => j.ownerId === activeOwnerId),
    [seed.ledgerJournals, activeOwnerId]
  );

  const ownerLedgerTenants = useMemo(
    () => seed.ledgerTenants.filter((t) => t.ownerId === activeOwnerId),
    [seed.ledgerTenants, activeOwnerId]
  );

  const ownerDeposits = useMemo(
    () => seed.depositCustodies.filter((d) => d.ownerId === activeOwnerId),
    [seed.depositCustodies, activeOwnerId]
  );

  const ownerGatewayBatches = useMemo(
    () => seed.gatewayBatches.filter((b) => b.ownerId === activeOwnerId),
    [seed.gatewayBatches, activeOwnerId]
  );

  const ownerFailedGatewayEvents = useMemo(
    () => seed.failedGatewayEvents.filter((f) => f.ownerId === activeOwnerId),
    [seed.failedGatewayEvents, activeOwnerId]
  );

  const ownerBankStatementLines = useMemo(
    () => seed.bankStatementLines.filter((b) => b.ownerId === activeOwnerId),
    [seed.bankStatementLines, activeOwnerId]
  );

  const ownerReconRuns = useMemo(
    () => seed.reconciliationRuns.filter((r) => r.ownerId === activeOwnerId),
    [seed.reconciliationRuns, activeOwnerId]
  );

  const ownerVendorBills = useMemo(
    () => seed.vendorBills.filter((b) => b.ownerId === activeOwnerId),
    [seed.vendorBills, activeOwnerId]
  );

  const ownerFixedAssets = useMemo(
    () => seed.fixedAssets.filter((a) => a.ownerId === activeOwnerId),
    [seed.fixedAssets, activeOwnerId]
  );

  const ownerTaxWorkpapers = useMemo(
    () => seed.taxWorkpapers.filter((w) => w.ownerId === activeOwnerId),
    [seed.taxWorkpapers, activeOwnerId]
  );

  const ownerTaxCalendar = useMemo(
    () => seed.taxCalendar.filter((t) => t.ownerId === activeOwnerId),
    [seed.taxCalendar, activeOwnerId]
  );

  const ownerLedgerBundle: LedgerOwnerBundle = useMemo(
    () => ({
      config: ownerLedgerConfig,
      accounts: ownerLedgerAccountsV2,
      periods: ownerAccountingPeriods,
      openingBalances: seed.ledgerOpeningBalances[activeOwnerId] || {},
      entries: ownerLedgerJournals,
      tenants: ownerLedgerTenants,
      deposits: ownerDeposits,
      gatewayBatches: ownerGatewayBatches,
      failedEvents: ownerFailedGatewayEvents,
      bankLines: ownerBankStatementLines,
      reconciliationRuns: ownerReconRuns,
      vendorBills: ownerVendorBills,
      fixedAssets: ownerFixedAssets,
      closeChecklists: seed.closeChecklists.filter((c) => c.ownerId === activeOwnerId),
    }),
    [
      ownerLedgerConfig,
      ownerLedgerAccountsV2,
      ownerAccountingPeriods,
      seed.ledgerOpeningBalances,
      activeOwnerId,
      ownerLedgerJournals,
      ownerLedgerTenants,
      ownerDeposits,
      ownerGatewayBatches,
      ownerFailedGatewayEvents,
      ownerBankStatementLines,
      ownerReconRuns,
      ownerVendorBills,
      ownerFixedAssets,
      seed.closeChecklists,
    ]
  );

  const ownerTrialBalance = useMemo(
    () =>
      computeTrialBalance(
        ownerLedgerAccountsV2,
        seed.ledgerOpeningBalances[activeOwnerId] || {},
        ownerLedgerJournals
      ),
    [ownerLedgerAccountsV2, seed.ledgerOpeningBalances, activeOwnerId, ownerLedgerJournals]
  );

  const ownerIncomeStatement = useMemo(
    () => computeIncomeStatement(ownerTrialBalance),
    [ownerTrialBalance]
  );

  const ownerBalanceSheet = useMemo(
    () => computeBalanceSheet(ownerTrialBalance, ownerIncomeStatement),
    [ownerTrialBalance, ownerIncomeStatement]
  );

  const ownerThreeWayDeposit = useMemo(
    () => computeThreeWayDepositCheck(ownerTrialBalance, ownerDeposits),
    [ownerTrialBalance, ownerDeposits]
  );

  const ownerClearingStatus = useMemo(
    () => computeClearingStatus(ownerTrialBalance, ownerGatewayBatches),
    [ownerTrialBalance, ownerGatewayBatches]
  );

  const ownerTenantAgeing = useMemo(
    () => computeTenantAgeing(ownerLedgerTenants),
    [ownerLedgerTenants]
  );

  const ownerStatementSummary = useMemo(
    () => computeOwnerStatement(ownerLedgerBundle, '2019-03'),
    [ownerLedgerBundle]
  );

  const ownerCloseChecklist = useMemo(
    () =>
      evaluateCloseChecklist(
        ownerLedgerBundle,
        '2019-03',
        session.actorId,
        currentPersona.displayName
      ),
    [ownerLedgerBundle, session.actorId, currentPersona.displayName]
  );

  const ownerBackupManifest = useMemo(
    () => verifyBackupIntegrityManifest(ownerLedgerBundle, ownerAuditEvents, false),
    [ownerLedgerBundle, ownerAuditEvents]
  );

  const submitManualJournal = useCallback(
    (input: {
      entryDate: string;
      periodCode: string;
      description: string;
      evidenceRef: string;
      lines: { accountCode: string; debitEtb: number; creditEtb: number; description?: string }[];
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'post_manual_journal');
      if (!perm.allowed) {
        logPermissionDenial('Finance', 'Manual Journal Submission', perm.reason, input.periodCode);
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }

      if (!Array.isArray(input.lines) || input.lines.length < 2) {
        const msg = 'Manual double-entry journal requires at least 2 balanced lines.';
        notify({ tone: 'error', title: 'Invalid Journal Lines', detail: msg });
        return { ok: false, error: msg };
      }

      for (let i = 0; i < input.lines.length; i++) {
        const l = input.lines[i];
        const dr = Math.round((Number(l.debitEtb) || 0) * 100);
        const cr = Math.round((Number(l.creditEtb) || 0) * 100);
        if (dr < 0 || cr < 0 || (dr > 0 && cr > 0) || (dr === 0 && cr === 0)) {
          const msg = `Line ${i + 1} (${l.accountCode}) must carry strictly one positive Debit or Credit amount.`;
          notify({ tone: 'error', title: 'Invalid Line Amount', detail: msg });
          return { ok: false, error: msg };
        }
        const acct = ownerLedgerAccountsV2.find((a) => a.code === l.accountCode);
        if (!acct) {
          const msg = `Account ${l.accountCode} does not exist in owner ledger ${activeOwnerId}.`;
          notify({ tone: 'error', title: 'Unknown Account', detail: msg });
          return { ok: false, error: msg };
        }
        if (acct.status !== 'Active') {
          const msg = `Account ${l.accountCode} (${acct.name}) is ${acct.status}, not Active.`;
          notify({ tone: 'error', title: 'Inactive Account', detail: msg });
          return { ok: false, error: msg };
        }
        if (acct.isTaxLocked) {
          const msg = `Account ${l.accountCode} (${acct.name}) is Tax-Locked until Directive 1142/2026 / VAT activation.`;
          notify({ tone: 'error', title: 'Tax-Locked Account Blocked', detail: msg });
          return { ok: false, error: msg };
        }
      }

      const debitTotal = input.lines.reduce((s, l) => s + (Number(l.debitEtb) || 0), 0);
      const creditTotal = input.lines.reduce((s, l) => s + (Number(l.creditEtb) || 0), 0);
      if (debitTotal <= 0 || Math.round(debitTotal * 100) !== Math.round(creditTotal * 100)) {
        const msg = `Journal imbalance: Debits ETB ${debitTotal.toLocaleString()} != Credits ETB ${creditTotal.toLocaleString()}.`;
        notify({ tone: 'error', title: 'Unbalanced Journal Rejected', detail: msg });
        return { ok: false, error: msg };
      }

      const targetPeriod = ownerAccountingPeriods.find(
        (p) => p.periodCode === input.periodCode || (input.entryDate >= p.startDateGc && input.entryDate <= p.endDateGc)
      );
      if (!targetPeriod || targetPeriod.status === 'Closed' || targetPeriod.status === 'Closing') {
        const msg = `Period ${targetPeriod?.periodCode || input.periodCode} is Closed. New entries dated in a closed month are refused.`;
        logPermissionDenial('Finance', 'Closed Period Posting Attempt Blocked', msg, input.periodCode);
        notify({ tone: 'error', title: 'Closed Period Lock Enforced', detail: msg });
        return { ok: false, error: msg };
      }

      const twoStep = debitTotal > 25000;
      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Manual Journal',
          title: `Manual Journal (ETB ${debitTotal.toLocaleString()}): ${input.description}`,
          targetRecordType: 'LedgerJournalEntry',
          targetRecordId: input.periodCode,
          workflowMode: twoStep ? 'Two-Step' : 'One-Step',
          requiredCheckerRoles: ['General Manager'],
          escalatorRoles: twoStep ? ['Owner / Director'] : undefined,
          stepLabels: twoStep
            ? ['General Manager Review (> ETB 25,000)', 'Owner / Director Final Sign-Off']
            : ['General Manager Checker Sign-Off'],
          amountThresholdPlaceholder: twoStep ? '> ETB 25,000.00' : '<= ETB 25,000.00',
          effectiveDate: input.entryDate,
          evidenceRef: input.evidenceRef,
          reason: input.description,
          beforeValues: { debitTotalEtb: debitTotal, periodCode: input.periodCode },
          afterValues: { status: 'Pending Approval', lineCount: input.lines.length },
          payload: input,
        });
        return {
          ...prev,
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Finance',
            action: 'Manual Journal Submitted for Approval',
            recordType: 'ApprovalRequest',
            recordId: req.id,
            reason: input.description,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
          }),
        };
      });

      notify({
        tone: 'success',
        title: 'Manual Journal Queued in Approvals Centre',
        detail: `ETB ${debitTotal.toLocaleString()} routed for independent Checker verification.`,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, logPermissionDenial, notify, ownerAccountingPeriods, ownerLedgerAccountsV2]
  );

  const reverseLedgerJournal = useCallback(
    (input: { journalId: string; entryDate: string; reason: string }) => {
      const perm = checkActionPermission(currentPersona.role, 'reverse_journal');
      if (!perm.allowed) {
        logPermissionDenial('Finance', 'Journal Reversal (PR-25)', perm.reason, input.journalId);
        notify({ tone: 'error', title: 'Reversal Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }

      const checkerRoleFallback = currentPersona.role === 'Finance Officer' ? 'USR-SYNTH-02' : 'USR-SYNTH-03';
      const checkerNameFallback =
        currentPersona.role === 'Finance Officer' ? 'Demo General Manager' : 'Demo Finance Officer';

      const rev = buildMirrorReversal({
        bundle: ownerLedgerBundle,
        originalJournalId: input.journalId,
        entryDate: input.entryDate,
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        checkerActorId: checkerRoleFallback,
        checkerName: checkerNameFallback,
        reason: input.reason,
      });

      if (!rev.ok) {
        notify({ tone: 'error', title: 'PR-25 Reversal Blocked', detail: rev.error });
        return { ok: false, error: rev.error };
      }

      setSeed((prev) => ({
        ...prev,
        ledgerJournals: prev.ledgerJournals
          .map((j) => (j.id === rev.updatedOriginal.id ? rev.updatedOriginal : j))
          .concat(rev.reversalJournal),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: `PR-25 Mirror Reversal Posted (${rev.reversalJournal.journalNumber})`,
          recordType: 'LedgerJournalEntry',
          recordId: rev.reversalJournal.id,
          reason: input.reason,
          beforeValues: { reversedJournal: rev.updatedOriginal.journalNumber },
          afterValues: { reversalJournal: rev.reversalJournal.journalNumber },
        }),
      }));

      notify({
        tone: 'success',
        title: `Mirror Reversal ${rev.reversalJournal.journalNumber} Posted`,
        detail: `${rev.updatedOriginal.journalNumber} remains visible as Reversed; net impact = ETB 0.`,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, currentPersona.role, logPermissionDenial, notify, ownerLedgerBundle, session.actorId]
  );

  const postRentChargeEvent = useCallback(
    (input: {
      tenantId: string;
      amountEtb: number;
      entryDate: string;
      periodCode: string;
      propertyUse: 'Residential' | 'Commercial';
      applyVatDraft?: boolean;
      description?: string;
    }) => {
      const ruleId =
        input.propertyUse === 'Residential'
          ? ('PR-01' as const)
          : input.applyVatDraft
            ? ('PR-03' as const)
            : ('PR-02' as const);
      const amountCents = toCents(input.amountEtb);
      const vatCents = input.applyVatDraft ? Math.round(amountCents * 0.15) : 0;
      const totalDr = amountCents + vatCents;

      const lines = [
        { accountCode: '1110', debitCents: totalDr, creditCents: 0, tenantId: input.tenantId },
        {
          accountCode: input.propertyUse === 'Residential' ? '4100' : '4110',
          debitCents: 0,
          creditCents: amountCents,
          tenantId: input.tenantId,
        },
        ...(vatCents > 0
          ? [{ accountCode: '2210', debitCents: 0, creditCents: vatCents, tenantId: input.tenantId, taxCode: 'VAT-15-DRAFT' }]
          : []),
      ];

      const res = postLedgerEvent(ownerLedgerBundle, {
        entryDate: input.entryDate,
        periodCode: input.periodCode,
        ruleId,
        sourceType: 'Charge',
        sourceId: `CHG-${Date.now()}`,
        idempotencyKey: `CHG-${activeOwnerId}-${input.tenantId}-${input.periodCode}-${Date.now()}`,
        description: input.description || `Rent charge (${input.propertyUse}) for ${input.tenantId}`,
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        propertyUse: input.propertyUse,
        vatDraftApplied: Boolean(input.applyVatDraft),
        lines,
      });

      if (!res.posted) {
        notify({ tone: 'error', title: 'Rent Charge Posting Blocked', detail: res.error });
        return { ok: false, error: res.error };
      }

      setSeed((prev) => ({
        ...prev,
        ledgerJournals: [...prev.ledgerJournals, res.journal],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: `Ledger Journal Posted (${res.journal.journalNumber} · ${ruleId})`,
          recordType: 'LedgerJournalEntry',
          recordId: res.journal.id,
          reason: res.journal.description,
        }),
      }));
      notify({
        tone: 'success',
        title: `Posted ${res.journal.journalNumber} (${ruleId})`,
        detail: res.journal.description,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, notify, ownerLedgerBundle, session.actorId]
  );

  const settleGatewayBatch = useCallback(
    (input: { batchId: string; feeEtb: number; settlementDate: string }) => {
      const batch = ownerGatewayBatches.find((b) => b.id === input.batchId);
      if (!batch) return { ok: false, error: 'Gateway batch not found.' };
      if (batch.status === 'Settled') return { ok: false, error: 'Batch already settled.' };

      const feeCents = toCents(input.feeEtb);
      const netCents = batch.grossCents - feeCents;
      const res = postLedgerEvent(ownerLedgerBundle, {
        entryDate: input.settlementDate,
        periodCode: batch.periodCode,
        ruleId: 'PR-09',
        sourceType: 'GatewaySettlement',
        sourceId: batch.batchNumber,
        idempotencyKey: `PR09-${batch.id}`,
        description: `${batch.provider} settles batch ${batch.batchNumber} (fee ETB ${input.feeEtb})`,
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        lines: [
          { accountCode: '1020', debitCents: netCents, creditCents: 0 },
          ...(feeCents > 0 ? [{ accountCode: '5600', debitCents: feeCents, creditCents: 0 }] : []),
          { accountCode: '1040', debitCents: 0, creditCents: batch.grossCents },
        ],
      });

      if (!res.posted) {
        notify({ tone: 'error', title: 'Gateway Settlement Failed', detail: res.error });
        return { ok: false, error: res.error };
      }

      setSeed((prev) => ({
        ...prev,
        ledgerJournals: [...prev.ledgerJournals, res.journal],
        gatewayBatches: prev.gatewayBatches.map((b) =>
          b.id === batch.id
            ? {
                ...b,
                status: 'Settled' as const,
                feeCents,
                netSettledCents: netCents,
                settlementJournalId: res.journal.id,
              }
            : b
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: `Gateway Batch Settled (${batch.batchNumber})`,
          recordType: 'GatewaySettlementBatch',
          recordId: batch.id,
          reason: `Cleared 1040 by ETB ${(batch.grossCents / 100).toLocaleString()} (Fee ETB ${input.feeEtb}).`,
        }),
      }));
      notify({
        tone: 'success',
        title: `Batch ${batch.batchNumber} Settled`,
        detail: `Posted ${res.journal.journalNumber} clearing 1040 -> 1020 + 5600.`,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, notify, ownerGatewayBatches, ownerLedgerBundle, session.actorId]
  );

  const simulateFailedGatewayEvent = useCallback(
    (input: { tenantRef: string; provider: 'Telebirr' | 'ArifPay'; amountEtb: number; periodCode: string }) => {
      const period = ownerAccountingPeriods.find((p) => p.periodCode === input.periodCode);
      const res = postLedgerEvent(ownerLedgerBundle, {
        entryDate: period?.endDateGc || '2026-11-25',
        periodCode: input.periodCode,
        ruleId: 'PR-08',
        sourceType: 'Receipt',
        sourceId: `GW-FAIL-${Date.now()}`,
        idempotencyKey: `GW-FAIL-${Date.now()}`,
        description: `Failed ${input.provider} attempt by ${input.tenantRef}`,
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        gatewayStatus: 'Failed',
        gatewayProvider: input.provider,
        tenantRef: input.tenantRef,
        attemptedAmountCents: toCents(input.amountEtb),
        lines: [],
      });

      if (!res.posted && res.failedEvent) {
        const failed = res.failedEvent;
        setSeed((prev) => ({
          ...prev,
          failedGatewayEvents: [failed, ...prev.failedGatewayEvents],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Finance',
            action: `PR-08 Failed Gateway Attempt Logged (${failed.eventRef})`,
            recordType: 'FailedGatewayEventLog',
            recordId: failed.id,
            reason: failed.reason,
          }),
        }));
        notify({
          tone: 'warning',
          title: `PR-08 Verified: 0 Journals Created (${failed.eventRef})`,
          detail: failed.reason,
        });
      }
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, notify, ownerAccountingPeriods, ownerLedgerBundle, session.actorId]
  );

  const matchBankStatementLine = useCallback(
    (lineId: string, journalId: string) => {
      setSeed((prev) => ({
        ...prev,
        bankStatementLines: prev.bankStatementLines.map((l) =>
          l.id === lineId ? { ...l, matchedJournalId: journalId, status: 'Matched' as const } : l
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: 'Bank Statement Line Matched',
          recordType: 'BankStatementLine',
          recordId: lineId,
          reason: `Matched bank statement line ${lineId} to journal ${journalId}.`,
        }),
      }));
      notify({
        tone: 'success',
        title: 'Bank Line Matched',
        detail: `${lineId} linked to journal ${journalId}.`,
      });
    },
    [activeOwnerId, appendAuditEvent, notify]
  );

  const signOffBankRecon = useCallback(
    (reconId: string) => {
      const perm = checkActionPermission(currentPersona.role, 'sign_bank_recon');
      if (!perm.allowed) {
        logPermissionDenial('Finance', 'Bank Reconciliation Sign-Off', perm.reason, reconId);
        notify({ tone: 'error', title: 'Sign-Off Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }
      const recon = ownerReconRuns.find((r) => r.id === reconId);
      if (!recon) return { ok: false, error: 'Reconciliation run not found.' };
      if (recon.makerActorId === session.actorId) {
        const msg = 'Maker-Checker block: preparer of bank reconciliation cannot sign it off.';
        logPermissionDenial('Finance', 'Bank Recon Self-Approval Blocked', msg, reconId);
        notify({ tone: 'error', title: 'Self-Sign-Off Blocked', detail: msg });
        return { ok: false, error: msg };
      }
      setSeed((prev) => ({
        ...prev,
        reconciliationRuns: prev.reconciliationRuns.map((r) =>
          r.id === reconId
            ? {
                ...r,
                status: 'Signed Off' as const,
                checkerActorId: session.actorId,
                checkerName: currentPersona.displayName,
                signedAt: nowTimestamp().slice(0, 16),
              }
            : r
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: 'Bank Reconciliation Signed Off',
          recordType: 'ReconciliationRun',
          recordId: reconId,
          reason: `Signed off by ${currentPersona.displayName}; statement matches 1020 Bank Operating & 1040 Clearing = 0.`,
        }),
      }));
      notify({
        tone: 'success',
        title: 'Bank Reconciliation Signed Off',
        detail: `${reconId} finalized by ${currentPersona.displayName}.`,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, currentPersona.role, logPermissionDenial, notify, ownerReconRuns, session.actorId]
  );

  const requestDepositSettlement = useCallback(
    (input: {
      depositId: string;
      mode: 'Refund' | 'Deduction';
      amountEtb: number;
      evidenceRef: string;
      reason: string;
      moveOutChecklistDone: boolean;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'settle_deposit_refund');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }
      const dep = ownerDeposits.find((d) => d.id === input.depositId);
      if (!dep) return { ok: false, error: 'Deposit record not found.' };
      if (!input.moveOutChecklistDone) {
        const msg = 'PR-14/PR-15 control: Move-out inspection checklist must be completed first.';
        notify({ tone: 'error', title: 'Move-Out Checklist Required', detail: msg });
        return { ok: false, error: msg };
      }
      if (toCents(input.amountEtb) > dep.heldCents) {
        const msg = `Requested amount ETB ${input.amountEtb.toLocaleString()} exceeds held deposit ETB ${(dep.heldCents / 100).toLocaleString()}.`;
        notify({ tone: 'error', title: 'Exceeds Held Deposit', detail: msg });
        return { ok: false, error: msg };
      }

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Deposit Refund / Deduction',
          title: `Deposit ${input.mode} (${dep.unitCode}): ETB ${input.amountEtb.toLocaleString()}`,
          targetRecordType: 'DepositCustodyRecord',
          targetRecordId: dep.id,
          requiredCheckerRoles: ['General Manager', 'Owner / Director'],
          effectiveDate: '2026-12-09',
          evidenceRef: input.evidenceRef,
          reason: input.reason,
          beforeValues: { heldEtb: dep.heldCents / 100 },
          afterValues: { settlementAmountEtb: input.amountEtb, mode: input.mode },
          payload: input,
        });
        return {
          ...prev,
          depositCustodies: prev.depositCustodies.map((d) =>
            d.id === dep.id ? { ...d, status: 'Refund Pending' as const, approvalId: req.id } : d
          ),
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Finance',
            action: `Deposit ${input.mode} Requested (${dep.unitCode})`,
            recordType: 'DepositCustodyRecord',
            recordId: dep.id,
            reason: input.reason,
            evidenceRef: input.evidenceRef,
            linkedApprovalId: req.id,
          }),
        };
      });
      notify({
        tone: 'success',
        title: `Deposit ${input.mode} Submitted`,
        detail: `Routed to Approvals Centre; 3-way check preserves 1030 == 2120 until approved.`,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, ownerDeposits]
  );

  const createVendorBill = useCallback(
    (input: {
      vendorName: string;
      vendorTinPlaceholder: string;
      category: 'Goods' | 'Services' | 'Capital';
      expenseAccountCode: string;
      amountEtb: number;
      billDate: string;
      dueDate: string;
      periodCode: string;
      evidenceRef: string;
      description: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'record_vendor_bill');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }
      const grossCents = toCents(input.amountEtb);
      const whtApplicable =
        ownerLedgerConfig.withholdingAgent &&
        ((input.category === 'Goods' && input.amountEtb > 20000) ||
          (input.category === 'Services' && input.amountEtb > 10000));
      const whtCents = whtApplicable ? Math.round(grossCents * 0.03) : 0;
      const netPayableCents = grossCents - whtCents;

      const res = postLedgerEvent(ownerLedgerBundle, {
        entryDate: input.billDate,
        periodCode: input.periodCode,
        ruleId: 'PR-19',
        sourceType: 'VendorBill',
        sourceId: `VBL-${Date.now()}`,
        idempotencyKey: `VBL-${activeOwnerId}-${Date.now()}`,
        description: `Vendor bill (${input.vendorName}): ${input.description}`,
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        lines: [
          { accountCode: input.expenseAccountCode, debitCents: grossCents, creditCents: 0 },
          { accountCode: '2010', debitCents: 0, creditCents: grossCents },
        ],
      });

      if (!res.posted) {
        notify({ tone: 'error', title: 'Vendor Bill Posting Blocked', detail: res.error });
        return { ok: false, error: res.error };
      }

      const bill: VendorBill = {
        id: `BILL-${Date.now()}`,
        ownerId: activeOwnerId,
        billNumber: `VBL-${input.periodCode}-${String(ownerVendorBills.length + 1).padStart(3, '0')}`,
        vendorName: input.vendorName,
        vendorTinPlaceholder: input.vendorTinPlaceholder,
        category: input.category,
        expenseAccountCode: input.expenseAccountCode,
        billDate: input.billDate,
        dueDate: input.dueDate,
        periodCode: input.periodCode,
        grossCents,
        whtApplicable,
        whtRateBps: whtApplicable ? 300 : 0,
        whtCents,
        netPayableCents,
        status: 'Approved',
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        checkerActorId: session.actorId === 'USR-SYNTH-03' ? 'USR-SYNTH-02' : 'USR-SYNTH-03',
        billJournalId: res.journal.id,
        evidenceRef: input.evidenceRef,
        description: input.description,
      };

      setSeed((prev) => ({
        ...prev,
        vendorBills: [bill, ...prev.vendorBills],
        ledgerJournals: [...prev.ledgerJournals, res.journal],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: `Vendor Bill Posted (${bill.billNumber})`,
          recordType: 'VendorBill',
          recordId: bill.id,
          reason: `${input.vendorName}: ETB ${input.amountEtb.toLocaleString()} (3% WHT: ETB ${(whtCents / 100).toLocaleString()})`,
          evidenceRef: input.evidenceRef,
        }),
      }));

      notify({
        tone: 'success',
        title: `Vendor Bill ${bill.billNumber} Recognized`,
        detail: whtApplicable
          ? `3% Withholding Tax applies: ETB ${(whtCents / 100).toLocaleString()} payable on settlement.`
          : 'Below statutory WHT threshold.',
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, currentPersona.role, notify, ownerLedgerBundle, ownerLedgerConfig.withholdingAgent, ownerVendorBills.length, session.actorId]
  );

  const payVendorBill = useCallback(
    (input: {
      billId: string;
      paymentDate: string;
      method: 'Bank Transfer' | 'Cash' | 'Cheque';
      cashExceptionApproved?: boolean;
    }) => {
      const bill = ownerVendorBills.find((b) => b.id === input.billId);
      if (!bill) return { ok: false, error: 'Bill not found.' };
      if (bill.status === 'Paid') return { ok: false, error: 'Bill already paid.' };

      const cashCode = input.method === 'Cash' ? '1010' : '1020';
      const res = postLedgerEvent(ownerLedgerBundle, {
        entryDate: input.paymentDate,
        periodCode: bill.periodCode,
        ruleId: 'PR-20',
        sourceType: 'BillPayment',
        sourceId: bill.billNumber,
        idempotencyKey: `PAY-BILL-${bill.id}`,
        description: `Pay bill ${bill.billNumber} (${bill.vendorName}) via ${input.method}`,
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        cashChannelAmountCents: input.method === 'Cash' ? bill.netPayableCents : 0,
        cashExceptionApproved: input.cashExceptionApproved,
        lines: [
          { accountCode: '2010', debitCents: bill.grossCents, creditCents: 0 },
          { accountCode: cashCode, debitCents: 0, creditCents: bill.netPayableCents },
          ...(bill.whtCents > 0
            ? [{ accountCode: '2220', debitCents: 0, creditCents: bill.whtCents }]
            : []),
        ],
      });

      if (!res.posted) {
        logPermissionDenial('Finance', 'Vendor Bill Payment Blocked', res.error, bill.id);
        notify({ tone: 'error', title: 'Bill Payment Blocked', detail: res.error });
        return { ok: false, error: res.error };
      }

      setSeed((prev) => ({
        ...prev,
        vendorBills: prev.vendorBills.map((b) =>
          b.id === bill.id
            ? {
                ...b,
                status: 'Paid' as const,
                paymentMethod: input.method,
                paymentJournalId: res.journal.id,
              }
            : b
        ),
        ledgerJournals: [...prev.ledgerJournals, res.journal],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: `Vendor Bill Paid (${bill.billNumber} · PR-20)`,
          recordType: 'VendorBill',
          recordId: bill.id,
          reason: `Net ETB ${(bill.netPayableCents / 100).toLocaleString()} paid via ${input.method}; WHT 2220 ETB ${(bill.whtCents / 100).toLocaleString()}.`,
        }),
      }));

      notify({
        tone: 'success',
        title: `Paid ${bill.billNumber} (${res.journal.journalNumber})`,
        detail: `Bank/Cash -ETB ${(bill.netPayableCents / 100).toLocaleString()} · 2220 WHT +ETB ${(bill.whtCents / 100).toLocaleString()}.`,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, logPermissionDenial, notify, ownerLedgerBundle, ownerVendorBills, session.actorId]
  );

  const registerFixedAsset = useCallback(
    (input: {
      name: string;
      assetClass: 'Building' | 'Equipment';
      costEtb: number;
      usefulLifeMonths: number;
      inServiceDate: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'manage_fixed_assets');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }
      const asset: FixedAssetRecord = {
        id: `AST-${activeOwnerId}-${Date.now()}`,
        ownerId: activeOwnerId,
        assetCode: `FA-${input.assetClass === 'Building' ? 'BLD' : 'EQP'}-${String(ownerFixedAssets.length + 1).padStart(3, '0')}`,
        name: input.name,
        assetClass: input.assetClass,
        assetAccountCode: input.assetClass === 'Building' ? '1210' : '1230',
        accumDepAccountCode: input.assetClass === 'Building' ? '1220' : '1240',
        inServiceDate: input.inServiceDate,
        costCents: toCents(input.costEtb),
        salvageCents: 0,
        usefulLifeMonths: input.usefulLifeMonths,
        accumDepOpeningCents: 0,
        accumDepCurrentCents: 0,
      };
      setSeed((prev) => ({
        ...prev,
        fixedAssets: [...prev.fixedAssets, asset],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: `Fixed Asset Registered (${asset.assetCode})`,
          recordType: 'FixedAssetRecord',
          recordId: asset.id,
          reason: `${asset.name} · Cost ETB ${input.costEtb.toLocaleString()} · ${input.usefulLifeMonths} months.`,
        }),
      }));
      notify({ tone: 'success', title: `Registered ${asset.assetCode}`, detail: asset.name });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.role, notify, ownerFixedAssets.length]
  );

  const runPeriodDepreciation = useCallback(
    (periodCode: string) => {
      const perm = checkActionPermission(currentPersona.role, 'manage_fixed_assets');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }
      const res = runMonthlyDepreciation(
        ownerLedgerBundle,
        periodCode,
        session.actorId,
        currentPersona.displayName
      );
      if (!res.ok) {
        notify({ tone: 'error', title: 'PR-22 Depreciation Refused', detail: res.error });
        return { ok: false, error: res.error };
      }
      setSeed((prev) => ({
        ...prev,
        ledgerJournals: [...prev.ledgerJournals, res.journal],
        fixedAssets: prev.fixedAssets.map((a) => {
          const updated = res.updatedAssets.find((u) => u.id === a.id);
          return updated || a;
        }),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: `PR-22 Monthly Depreciation Posted (${periodCode})`,
          recordType: 'LedgerJournalEntry',
          recordId: res.journal.id,
          reason: res.journal.description,
        }),
      }));
      notify({
        tone: 'success',
        title: `Posted Depreciation (${res.journal.journalNumber})`,
        detail: res.journal.description,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, currentPersona.role, notify, ownerLedgerBundle, session.actorId]
  );

  const requestPeriodClose = useCallback(
    (periodCode: string, note: string) => {
      const perm = checkActionPermission(currentPersona.role, 'run_period_close');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }
      const checklist = evaluateCloseChecklist(
        ownerLedgerBundle,
        periodCode,
        session.actorId,
        currentPersona.displayName
      );
      const failing = checklist.tasks.filter((t) => !t.passed);
      if (failing.length > 0) {
        const msg = `${failing.length} close checklist gate(s) failed (${failing.map((f) => f.id).join(', ')}). Resolve before closing.`;
        notify({ tone: 'error', title: 'Close Checklist Incomplete', detail: msg });
        return { ok: false, error: msg };
      }
      const period = ownerAccountingPeriods.find((p) => p.periodCode === periodCode);
      if (!period || period.status === 'Closed') {
        return { ok: false, error: `Period ${periodCode} is already closed.` };
      }

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Period Close',
          title: `Close Fiscal Period ${period.monthNameEn} ${period.fiscalYearEc} E.C. (${periodCode})`,
          targetRecordType: 'AccountingPeriod',
          targetRecordId: period.id,
          requiredCheckerRoles: ['General Manager', 'Owner / Director'],
          effectiveDate: period.endDateGc,
          evidenceRef: `CLOSE-CHK-${periodCode}`,
          reason: note || `All 9 close checklist controls passed for ${period.monthNameEn}.`,
          beforeValues: { status: period.status, clearing1040: 0 },
          afterValues: { status: 'Closed', trialBalanceEtb: ownerTrialBalance.totalDebitCents / 100 },
          payload: { periodCode },
        });
        return {
          ...prev,
          accountingPeriods: prev.accountingPeriods.map((p) =>
            p.id === period.id ? { ...p, status: 'Closing' as const } : p
          ),
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Finance',
            action: `Period Close Requested (${periodCode})`,
            recordType: 'AccountingPeriod',
            recordId: period.id,
            reason: note || '9/9 close checklist gates verified; awaiting GM approval.',
            linkedApprovalId: req.id,
          }),
        };
      });

      notify({
        tone: 'success',
        title: `Period Close Submitted (${periodCode})`,
        detail: 'Period placed in Closing state; sign in as GM or Owner to finalize.',
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.displayName, currentPersona.role, notify, ownerAccountingPeriods, ownerLedgerBundle, ownerTrialBalance.totalDebitCents, session.actorId]
  );

  const requestPeriodReopen = useCallback(
    (periodCode: string, reason: string, evidenceRef: string) => {
      const perm = checkActionPermission(currentPersona.role, 'reopen_period');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }
      if (!reason.trim()) {
        return { ok: false, error: 'Written reason required to reopen a closed period.' };
      }
      const period = ownerAccountingPeriods.find((p) => p.periodCode === periodCode);
      if (!period || period.status !== 'Closed') {
        return { ok: false, error: `Period ${periodCode} is not Closed.` };
      }
      const checkerRoles: PersonaRole[] =
        currentPersona.role === 'General Manager'
          ? ['Owner / Director']
          : ['General Manager', 'Owner / Director'];

      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Period Reopen',
          title: `Reopen Closed Period ${period.monthNameEn} (${periodCode})`,
          targetRecordType: 'AccountingPeriod',
          targetRecordId: period.id,
          requiredCheckerRoles: checkerRoles,
          effectiveDate: period.startDateGc,
          evidenceRef,
          reason,
          beforeValues: { status: 'Closed' },
          afterValues: { status: 'Reopened' },
          payload: { periodCode },
        });
        return {
          ...prev,
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Finance',
            action: `Period Reopen Requested (${periodCode})`,
            recordType: 'AccountingPeriod',
            recordId: period.id,
            reason,
            evidenceRef,
            linkedApprovalId: req.id,
          }),
        };
      });
      notify({
        tone: 'info',
        title: `Period Reopen Submitted (${periodCode})`,
        detail: `Awaiting ${checkerRoles.join(' / ')} approval.`,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, ownerAccountingPeriods]
  );

  const executeYearEndCloseAction = useCallback(
    (periodCode: string) => {
      const res = buildYearEndCloseEntry(
        ownerLedgerBundle,
        '2027-09-10',
        periodCode,
        session.actorId,
        currentPersona.displayName,
        'USR-SYNTH-01',
        'Test Owner Alpha (Director Demo)'
      );
      if (!res.posted) {
        notify({ tone: 'error', title: 'PR-27 Year-End Close Blocked', detail: res.error });
        return { ok: false, error: res.error };
      }
      setSeed((prev) => ({
        ...prev,
        ledgerJournals: [...prev.ledgerJournals, res.journal],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Finance',
          action: `PR-27 Year-End Close Posted (${res.journal.journalNumber})`,
          recordType: 'LedgerJournalEntry',
          recordId: res.journal.id,
          reason: res.journal.description,
        }),
      }));
      notify({
        tone: 'success',
        title: 'Year-End Close Posted to 3300 Retained Earnings',
        detail: res.journal.description,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, notify, ownerLedgerBundle, session.actorId]
  );

  const requestOwnerDraw = useCallback(
    (input: {
      amountEtb: number;
      drawDate: string;
      periodCode: string;
      evidenceRef: string;
      reason: string;
    }) => {
      const perm = checkActionPermission(currentPersona.role, 'record_owner_draw');
      if (!perm.allowed) {
        notify({ tone: 'error', title: 'Action Blocked', detail: perm.reason });
        return { ok: false, error: perm.reason };
      }
      setSeed((prev) => {
        const req = createApprovalRecord(prev, {
          category: 'Owner Draw',
          title: `Owner Distribution Draw (3200): ETB ${input.amountEtb.toLocaleString()}`,
          targetRecordType: 'OwnerLedgerConfig',
          targetRecordId: ownerLedgerConfig.id,
          requiredCheckerRoles: ['Owner / Director', 'General Manager'],
          effectiveDate: input.drawDate,
          evidenceRef: input.evidenceRef,
          reason: input.reason,
          beforeValues: { bank1020Etb: (ownerTrialBalance.rows.find((r) => r.accountCode === '1020')?.closingNetCents || 0) / 100 },
          afterValues: { drawAmountEtb: input.amountEtb, equityAccount: '3200' },
          payload: input,
        });
        return {
          ...prev,
          approvals: [req, ...prev.approvals],
          auditEvents: appendAuditEvent(prev, {
            ownerId: activeOwnerId,
            module: 'Finance',
            action: 'Owner Draw Requested (PR-24)',
            recordType: 'ApprovalRequest',
            recordId: req.id,
            reason: input.reason,
            evidenceRef: input.evidenceRef,
          }),
        };
      });
      notify({
        tone: 'success',
        title: 'Owner Draw Queued for Authorization',
        detail: `ETB ${input.amountEtb.toLocaleString()} routed to 3200 Owner Drawings upon approval.`,
      });
      return { ok: true };
    },
    [activeOwnerId, appendAuditEvent, createApprovalRecord, currentPersona.role, notify, ownerLedgerConfig.id, ownerTrialBalance.rows]
  );

  const runAndSaveTaxWorkpaper = useCallback(
    (input: {
      periodCode: string;
      combinedIndividualIncomeMode: boolean;
      otherIndividualIncomeEtb: number;
      priorYearIncomeTaxEtb: number;
    }) => {
      const wp = computeTaxWorkpaperDraft({
        bundle: ownerLedgerBundle,
        periodCode: input.periodCode,
        generatedBy: currentPersona.displayName,
        combinedIndividualIncomeMode: input.combinedIndividualIncomeMode,
        otherIndividualIncomeCents: toCents(input.otherIndividualIncomeEtb),
        priorYearIncomeTaxCents: toCents(input.priorYearIncomeTaxEtb),
      });
      setSeed((prev) => ({
        ...prev,
        taxWorkpapers: [
          wp,
          ...prev.taxWorkpapers.filter(
            (w) => !(w.ownerId === activeOwnerId && w.periodCode === input.periodCode)
          ),
        ],
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Tax Configuration',
          action: `Tax Workpaper Draft Generated (${input.periodCode})`,
          recordType: 'TaxWorkpaperDraft',
          recordId: wp.id,
          reason: `Computed Books vs Flat (20%/35%), WHT, VAT draft, and Property Tax estimates (Active gate locked).`,
        }),
      }));
      notify({
        tone: 'info',
        title: 'Tax Workpaper Draft Updated (Locked)',
        detail: `Books Tax: ETB ${(wp.taxBooksCents / 100).toLocaleString()} vs Flat 35%: ETB ${(wp.taxFlat35Cents / 100).toLocaleString()}`,
      });
      return wp;
    },
    [activeOwnerId, appendAuditEvent, currentPersona.displayName, notify, ownerLedgerBundle]
  );

  const toggleRulesRegisterSignOff = useCallback(
    (ruleId: number, status: TaxRuleRegisterItem['signOffStatus']) => {
      setSeed((prev) => ({
        ...prev,
        taxRuleRegister: prev.taxRuleRegister.map((r) =>
          r.id === ruleId ? { ...r, signOffStatus: status } : r
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Tax Configuration',
          action: `Rules Register #${ruleId} Sign-Off Status Updated`,
          recordType: 'TaxRuleRegisterItem',
          recordId: String(ruleId),
          reason: `Updated review status to "${status}". Live tax activation remains gated by ERCA.`,
        }),
      }));
    },
    [activeOwnerId, appendAuditEvent]
  );

  const toggleOwnerVatDraftMode = useCallback(
    (vatRegistered: boolean) => {
      setSeed((prev) => ({
        ...prev,
        ledgerConfigs: prev.ledgerConfigs.map((c) =>
          c.ownerId === activeOwnerId ? { ...c, vatRegistered } : c
        ),
        ledgerAccountsV2: prev.ledgerAccountsV2.map((a) =>
          a.ownerId === activeOwnerId && (a.code === '1190' || a.code === '2210')
            ? { ...a, isTaxLocked: !vatRegistered }
            : a
        ),
        auditEvents: appendAuditEvent(prev, {
          ownerId: activeOwnerId,
          module: 'Tax Configuration',
          action: `Draft VAT Simulation Toggled (${vatRegistered ? 'ON' : 'OFF'})`,
          recordType: 'OwnerLedgerConfig',
          recordId: ownerLedgerConfig.id,
          reason: `Draft VAT account unlock state toggled for training comparison only. ENABLE_LIVE_TAX_INVOICING remains false.`,
        }),
      }));
      notify({
        tone: 'info',
        title: `Draft VAT Mode ${vatRegistered ? 'Enabled' : 'Locked'}`,
        detail: vatRegistered
          ? '1190 Input VAT & 2210 Output VAT unlocked for Draft / Training Variant billing.'
          : '1190 Input VAT & 2210 Output VAT locked (default non-VAT state).',
      });
    },
    [activeOwnerId, appendAuditEvent, notify, ownerLedgerConfig.id]
  );

  const simulateClosedPeriodPost = useCallback(
    (periodCode: string) => {
      const targetPeriod = ownerAccountingPeriods.find((p) => p.periodCode === periodCode);
      const entryDate = targetPeriod?.startDateGc || '2026-10-12';
      const probe = postLedgerEvent(ownerLedgerBundle, {
        entryDate,
        periodCode,
        ruleId: 'Manual',
        sourceType: 'ManualJournal',
        sourceId: `CLOSED-PROBE-${Date.now()}`,
        idempotencyKey: `CLOSED-PROBE-${periodCode}-${Date.now()}`,
        description: `Control probe: attempting entry inside ${periodCode}`,
        makerActorId: session.actorId,
        makerName: currentPersona.displayName,
        lines: [
          { accountCode: '5200', debitCents: toCents(500), creditCents: 0 },
          { accountCode: '1020', debitCents: 0, creditCents: toCents(500) },
        ],
      });
      if (!probe.posted) {
        logPermissionDenial('Finance', `Closed Period Entry Blocked (${periodCode})`, probe.error, periodCode);
        notify({ tone: 'warning', title: 'Closed-Period Lock Verified', detail: probe.error });
        return { ok: false, error: probe.error };
      }
      return { ok: true, error: 'Period is currently Open or Reopened.' };
    },
    [currentPersona.displayName, logPermissionDenial, notify, ownerAccountingPeriods, ownerLedgerBundle, session.actorId]
  );

  const resetToHidarWorkedMonth = useCallback(() => {
    const freshAlpha = buildHidarAlphaBundle();
    const freshAccounts = buildLedgerAccountsV2('OWN-ALPHA', false);
    const wp = computeTaxWorkpaperDraft({
      bundle: freshAlpha,
      periodCode: '2019-03',
      generatedBy: 'Hidar Baseline Reset',
    });
    setSeed((prev) => ({
      ...prev,
      ledgerConfigs: prev.ledgerConfigs.map((c) => (c.ownerId === 'OWN-ALPHA' ? freshAlpha.config : c)),
      ledgerAccountsV2: prev.ledgerAccountsV2
        .filter((a) => a.ownerId !== 'OWN-ALPHA')
        .concat(freshAccounts),
      accountingPeriods: prev.accountingPeriods
        .filter((p) => p.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.periods),
      ledgerOpeningBalances: {
        ...prev.ledgerOpeningBalances,
        'OWN-ALPHA': freshAlpha.openingBalances,
      },
      ledgerJournals: prev.ledgerJournals
        .filter((j) => j.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.entries),
      ledgerTenants: prev.ledgerTenants
        .filter((t) => t.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.tenants),
      depositCustodies: prev.depositCustodies
        .filter((d) => d.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.deposits),
      gatewayBatches: prev.gatewayBatches
        .filter((b) => b.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.gatewayBatches),
      failedGatewayEvents: prev.failedGatewayEvents
        .filter((f) => f.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.failedEvents),
      bankStatementLines: prev.bankStatementLines
        .filter((b) => b.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.bankLines),
      reconciliationRuns: prev.reconciliationRuns
        .filter((r) => r.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.reconciliationRuns),
      vendorBills: prev.vendorBills
        .filter((b) => b.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.vendorBills),
      fixedAssets: prev.fixedAssets
        .filter((a) => a.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.fixedAssets),
      closeChecklists: prev.closeChecklists
        .filter((c) => c.ownerId !== 'OWN-ALPHA')
        .concat(freshAlpha.closeChecklists),
      taxWorkpapers: prev.taxWorkpapers
        .filter((w) => w.ownerId !== 'OWN-ALPHA')
        .concat(wp),
    }));
    notify({
      tone: 'success',
      title: 'Hidar 2019 E.C. Worked Month Restored',
      detail: 'OWN-ALPHA ledger reset to canonical 19 journals, E1 failed log, and 6,717,860 ETB TB.',
    });
  }, [notify]);

  const fmtDate = useCallback(
    (rawDate: string) => formatDateDisplay(rawDate, locale, dateMode),
    [locale, dateMode]
  );
  const fmtDateTime = useCallback(
    (rawDateTime: string) => formatDateTimeDisplay(rawDateTime, locale, dateMode),
    [locale, dateMode]
  );
  const fmtEtb = useCallback((amount: number) => formatEtb(amount, locale), [locale]);
  const fmtShortEtb = useCallback((amount: number) => formatShortEtb(amount, locale), [locale]);
  const trStatus = useCallback((status: string) => localizeStatus(status, locale), [locale]);
  const labels = useMemo(() => UI_LABELS[locale], [locale]);

  const value: PrmsContextValue = {
    isAuthenticated,
    currentPersona,
    session,
    activeOwnerId,
    activeOwner,
    activeSection,
    locale,
    dateMode,
    labels,
    toasts,
    fmtDate,
    fmtDateTime,
    fmtEtb,
    fmtShortEtb,
    trStatus,
    ownerProperties,
    ownerBuildings,
    ownerUnits,
    ownerTenants,
    ownerLeases,
    ownerCharges,
    ownerReceipts,
    ownerAccounts,
    ownerAccountingPolicies,
    ownerJournalEntries,
    ownerTaxRules,
    ownerResearchRequirements,
    ownerSourceRecords,
    ownerAdviserQuestions,
    ownerProductionGates,
    ownerRetentionClasses,
    ownerApprovals,
    ownerAuditEvents,
    ownerNotifications,
    ownerDelegations,
    ownerAccessReviews,
    ownerRentalApplications,
    ownerExpenses,
    ownerMaintenanceTickets,
    ownerBackupPolicies,
    ownerBackupDrills,
    ownerMigrationBatches,
    ownerMigrationMappings,
    ownerRequirementsTraceability,
    ownerGatewayPayments,
    ownerMaintenanceMessages,
    ownerTenantNotices,
    ownerSmsLogs,
    ownerTenantPrefs,
    ownerPaymentReminderRequests,
    ownerOromifaTemplates,
    saveOromifaTemplate,
    deleteOromifaTemplate,
    mobileMode,
    setMobileMode,
    activeTenantAccount,
    isTenantAuthenticated: Boolean(activeTenantAccount),
    isOnline,
    pendingSyncQueue,
    flushOfflineSyncQueue,
    loginAsTenant,
    logoutTenant,
    adminUsers: seed.adminUsers,
    configRules: seed.configRules,
    loginWithTrainingAccount,
    loginWithSupabaseOperator,
    logoutToLogin,
    setActiveSection,
    switchOwnerContext,
    logCrossOwnerDeniedAttempt,
    attemptSelfApprovalAudit,
    setLocale,
    setDateMode,
    dismissToast,
    notify,
    resetDemoData,
    markNotificationRead,
    commandPaletteOpen,
    setCommandPaletteOpen,
    completedExerciseIds,
    exerciseStepChecks,
    toggleExerciseStep,
    markExerciseComplete,
    createProperty,
    createUnit,
    updateUnitStatus,
    requestUnitRenumbering,
    requestOwnershipChange,
    createLease,
    renewLease,
    recordPayment,
    submitGatewayPayment,
    verifyGatewayPayment,
    requestReceiptVoid,
    proposeAccountChange,
    createTaxDraft,
    submitTaxForApproval,
    prepareAdviserPack,
    submitAdviserForOwnerDecision,
    toggleRetentionLegalHold,
    requestRoleAssignment,
    updateConfigRuleDraft,
    saveEnvironmentOverrides,
    resetEnvironmentOverrides,
    logEnvironmentExport,
    decideApproval,
    cancelApproval,
    supersedeApproval,
    triggerApprovalReminderOrEscalate,
    toggleApprovalChecklistItem,
    requestDelegation,
    revokeDelegation,
    attestAccessReview,
    createRentalApplication,
    submitRentalApplication,
    decideRentalApplication,
    convertApplicationToLease,
    createExpenseRequest,
    submitExpenseForApproval,
    createMaintenanceTicket,
    advanceMaintenanceWorkOrder,
    requestBackupDrill,
    completeApprovedBackupDrill,
    requestMigrationExceptionApproval,
    runAcceptanceScenario,
    logReportExport,
    logSimulatedEvent,
    sendMaintenanceMessage,
    createTenantMaintenanceTicket,
    publishTenantNotice,
    markTenantNoticeRead,
    dispatchAutomatedSmsReminder,
    dispatchBatchOverdueSmsReminders,
    updateTenantNotificationPrefs,
    submitTenantMobilePayment,
    requestTenantPaymentReminder,
    ownerLedgerConfig,
    ownerLedgerAccountsV2,
    ownerAccountingPeriods,
    ownerLedgerJournals,
    ownerLedgerTenants,
    ownerDeposits,
    ownerGatewayBatches,
    ownerFailedGatewayEvents,
    ownerBankStatementLines,
    ownerReconRuns,
    ownerVendorBills,
    ownerFixedAssets,
    ownerCloseChecklist,
    ownerTrialBalance,
    ownerIncomeStatement,
    ownerBalanceSheet,
    ownerThreeWayDeposit,
    ownerClearingStatus,
    ownerTenantAgeing,
    ownerStatementSummary,
    ownerBackupManifest,
    taxRuleRegister: seed.taxRuleRegister,
    taxRulePacks: seed.taxRulePacks,
    ownerTaxWorkpapers,
    ownerTaxCalendar,
    ownerLedgerBundle,
    submitManualJournal,
    reverseLedgerJournal,
    postRentChargeEvent,
    settleGatewayBatch,
    simulateFailedGatewayEvent,
    matchBankStatementLine,
    signOffBankRecon,
    requestDepositSettlement,
    createVendorBill,
    payVendorBill,
    registerFixedAsset,
    runPeriodDepreciation,
    requestPeriodClose,
    requestPeriodReopen,
    executeYearEndCloseAction,
    requestOwnerDraw,
    runAndSaveTaxWorkpaper,
    toggleRulesRegisterSignOff,
    toggleOwnerVatDraftMode,
    simulateClosedPeriodPost,
    resetToHidarWorkedMonth,
  };

  return (
    <LocaleProvider locale={locale}>
      <PrmsContext.Provider value={value}>{children}</PrmsContext.Provider>
    </LocaleProvider>
  );
};

export function usePrms(): PrmsContextValue {
  const ctx = useContext(PrmsContext);
  if (!ctx) throw new Error('usePrms must be used inside PrmsProvider');
  return ctx;
}
