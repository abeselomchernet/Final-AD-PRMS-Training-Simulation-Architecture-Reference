import { TenantPortalAccount, TrainingAccount, TrainingExercise } from '../types/prms';
import { ACCOUNTING_TRAINING_EXERCISES } from './hidarWorkedMonth';

export const TRAINING_ACCOUNTS: TrainingAccount[] = [
  // 4 SRS v1.1 §7 Baseline Internal Roles
  {
    id: 'TRN-ACC-01',
    username: 'gm.demo',
    tempPasswordPlaceholder: 'TRAIN-GM-2026!',
    displayName: 'Demo General Manager',
    role: 'General Manager',
    actorId: 'USR-SYNTH-02',
    ownerScopeLabel: 'Single-Owner Switchable (Alpha / Beta)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'SRS Baseline Internal Role',
  },
  {
    id: 'TRN-ACC-02',
    username: 'am.demo',
    tempPasswordPlaceholder: 'TRAIN-AM-2026!',
    displayName: 'Demo Assistant Manager',
    role: 'Assistant Manager',
    actorId: 'USR-SYNTH-09',
    ownerScopeLabel: 'Single-Owner Switchable (Alpha / Beta)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'SRS Baseline Internal Role',
  },
  {
    id: 'TRN-ACC-03',
    username: 'finance.demo',
    tempPasswordPlaceholder: 'TRAIN-FIN-2026!',
    displayName: 'Demo Finance Officer',
    role: 'Finance Officer',
    actorId: 'USR-SYNTH-03',
    ownerScopeLabel: 'Single-Owner Switchable (Alpha / Beta)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'SRS Baseline Internal Role',
  },
  {
    id: 'TRN-ACC-04',
    username: 'clerk.demo',
    tempPasswordPlaceholder: 'TRAIN-CLK-2026!',
    displayName: 'Demo Front-Office Clerk',
    role: 'Clerk',
    actorId: 'USR-SYNTH-10',
    ownerScopeLabel: 'Single-Owner Switchable (Alpha / Beta)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'SRS Baseline Internal Role',
  },

  // Configurable Governance / Operational Templates & Special Training Roles
  {
    id: 'TRN-ACC-05',
    username: 'owner.alpha.demo',
    tempPasswordPlaceholder: 'TRAIN-OWN-2026!',
    displayName: 'Test Owner Alpha (Director Demo)',
    role: 'Owner / Director',
    actorId: 'USR-SYNTH-01',
    ownerScopeLabel: 'Locked to Test Owner Alpha (OWN-ALPHA)',
    allowedOwners: ['OWN-ALPHA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'Governance / Configurable Template',
  },
  {
    id: 'TRN-ACC-06',
    username: 'collections.demo',
    tempPasswordPlaceholder: 'TRAIN-COL-2026!',
    displayName: 'Demo Collections Clerk',
    role: 'Collections Clerk',
    actorId: 'USR-SYNTH-04',
    ownerScopeLabel: 'Single-Owner Switchable (Alpha / Beta)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'Governance / Configurable Template',
  },
  {
    id: 'TRN-ACC-07',
    username: 'property.demo',
    tempPasswordPlaceholder: 'TRAIN-PRP-2026!',
    displayName: 'Demo Property Clerk',
    role: 'Property Clerk',
    actorId: 'USR-SYNTH-05',
    ownerScopeLabel: 'Single-Owner Switchable (Alpha / Beta)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'Governance / Configurable Template',
  },
  {
    id: 'TRN-ACC-08',
    username: 'sysadmin.demo',
    tempPasswordPlaceholder: 'TRAIN-SYS-2026!',
    displayName: 'Demo System Administrator',
    role: 'System Administrator',
    actorId: 'USR-SYNTH-06',
    ownerScopeLabel: 'Single-Owner Switchable (IT & Security Only)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'Governance / Configurable Template',
  },
  {
    id: 'TRN-ACC-09',
    username: 'auditor.demo',
    tempPasswordPlaceholder: 'TRAIN-AUD-2026!',
    displayName: 'Demo Internal Auditor',
    role: 'Auditor / Read-only reviewer',
    actorId: 'USR-SYNTH-07',
    ownerScopeLabel: 'Single-Owner Switchable (Read-Only)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Active Training Account',
    classification: 'Governance / Configurable Template',
  },
  {
    id: 'TRN-ACC-10',
    username: 'trainer.demo',
    tempPasswordPlaceholder: 'TRAIN-RESET-2026!',
    displayName: 'Demo Training Coordinator',
    role: 'Training Coordinator',
    actorId: 'USR-TRAINER-00',
    ownerScopeLabel: 'Training Facilitator (Holds Seed Reset Authority)',
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    accountStatus: 'Trainer Only',
    isTrainer: true,
    classification: 'Training Facilitation',
  },
];

export const TENANT_PORTAL_ACCOUNTS: TenantPortalAccount[] = [
  {
    id: 'TEN-ACC-01',
    username: 'tenant.a101.demo',
    tempPasswordPlaceholder: 'TENANT-A101-2026!',
    tenantId: 'TEN-001',
    ownerId: 'OWN-ALPHA',
    displayName: 'SYNTH Tenant 001 (Unit A-101)',
    unitLabel: 'SYNTH Unit A-101 · Test Owner Alpha',
    msisdnPlaceholder: '+251910000001',
  },
  {
    id: 'TEN-ACC-02',
    username: 'tenant.a102.demo',
    tempPasswordPlaceholder: 'TENANT-A102-2026!',
    tenantId: 'TEN-002',
    ownerId: 'OWN-ALPHA',
    displayName: 'SYNTH Tenant 002 (Unit A-102)',
    unitLabel: 'SYNTH Unit A-102 · Test Owner Alpha',
    msisdnPlaceholder: '+251910000002',
  },
  {
    id: 'TEN-ACC-03',
    username: 'tenant.b101.demo',
    tempPasswordPlaceholder: 'TENANT-B101-2026!',
    tenantId: 'TEN-003',
    ownerId: 'OWN-BETA',
    displayName: 'SYNTH Tenant 003 (Unit B-101)',
    unitLabel: 'SYNTH Unit B-101 · Test Owner Beta',
    msisdnPlaceholder: '+251910000003',
  },
];

export const TRAINING_EXERCISES: TrainingExercise[] = [
  {
    id: 'EX-01',
    number: 1,
    title: 'Record a Payment and Issue a DEMO Receipt',
    titleAm: 'ክፍያ መመዝገብና የሙከራ (DEMO) ደረሰኝ ማውጣት',
    recommendedUsername: 'clerk.demo',
    recommendedRole: 'Clerk',
    targetSection: 'collections',
    objective:
      'Practice allocating a partial synthetic ETB rent payment oldest-first across open invoices and inspecting the watermarked DEMO receipt print preview.',
    objectiveAm:
      'ከፍት ደረሰኞች ላይ በቅደም ተከተል ሰው-ሠራሽ የብር ክፍያ መድቦ የDEMO ደረሰኝ ቅድመ-ዕይታን መፈተሽ።',
    startingCondition:
      'Signed in under Test Owner Alpha (OWN-ALPHA) with open/overdue charges for SYNTH Tenant 001.',
    startingConditionAm:
      'በ Test Owner Alpha (OWN-ALPHA) ክልል ውስጥ ለ SYNTH Tenant 001 ክፍት ደረሰኞች ሲኖሩ።',
    steps: [
      {
        en: 'Sign in as clerk.demo (or collections.demo) scoped to Test Owner Alpha.',
        am: 'በ clerk.demo (ወይም collections.demo) በ Test Owner Alpha ይግቡ።',
      },
      {
        en: 'Open Rent & Collections and click Record Synthetic Payment.',
        am: 'ወደ ኪራይና አሰባሰብ ገጽ ገብተው "ሰው-ሠራሽ ክፍያ መዝግብ" የሚለውን ይጫኑ።',
      },
      {
        en: 'Select SYNTH Tenant 001, enter ETB 20,000, verify FIFO allocation preview, and confirm.',
        am: 'SYNTH Tenant 001ን ይምረጡ፣ ETB 20,000 ያስገቡና የድልድል ቅድመ-ዕይታውን አረጋግጠው ይመዝግቡ።',
      },
      {
        en: 'Inspect the DEMO receipt watermark ("NOT LEGALLY VALID") and Compliance Preview tab.',
        am: 'በDEMO ደረሰኙ ላይ ያለውን የማስጠንቀቂያ ማህተም እና የተገዢነት ቅድመ-ዕይታን ይመልከቱ።',
      },
    ],
    expectedOutcome:
      'Sequential DEMO receipt created, invoice balance updated, and immutable audit event logged.',
    expectedOutcomeAm:
      'ተከታታይ የDEMO ደረሰኝ ይወጣል፣ የደረሰኝ ቀሪ ይቀንሳል፣ የኦዲት መዝገብም ይጻፋል።',
    failedControlExplanation:
      'If signed in as System Administrator or Auditor, Record Payment is disabled; receipt deletion does not exist anywhere in the UI.',
    failedControlExplanationAm:
      'የሲስተም አስተዳዳሪ ወይም ኦዲተር ክፍያ መመዝገብ አይችሉም፤ ደረሰኝ መሰረዝ በስርዓቱ ውስጥ የለም።',
    auditMatchKeywords: ['Synthetic Payment Recorded', 'Compliance Receipt Print-Preview Opened'],
  },
  {
    id: 'EX-02',
    number: 2,
    title: 'Submit and Approve a Unit-Renumbering Request',
    titleAm: 'የክፍል ቁጥር ለውጥ ጥያቄ ማቅረብና ማጽደቅ',
    recommendedUsername: 'property.demo',
    recommendedRole: 'Property Clerk',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'portfolio',
    objective:
      'Submit a unit identifier change through Maker-Checker approval while preserving old unit aliases in historical records.',
    objectiveAm:
      'የቀድሞውን የክፍል መለያ በታሪክ ውስጥ ጠብቆ በአዘጋጅ-አጽዳቂ ቁጥጥር የክፍል ቁጥር ለውጥ ማድረግ።',
    startingCondition:
      'Active vacant/occupied unit exists in Property Portfolio (e.g., SYNTH Unit A-201).',
    startingConditionAm: 'በንብረት ማህደር ውስጥ ንቁ ክፍል (ለምሳሌ SYNTH Unit A-201) ሲኖር።',
    steps: [
      {
        en: 'Sign in as property.demo (or clerk.demo) and open Property Portfolio.',
        am: 'በ property.demo (ወይም clerk.demo) ገብተው ወደ የንብረት ማህደር ይሂዱ።',
      },
      {
        en: 'Open a unit detail drawer, choose Request Renumbering, enter a new code, effective date, and evidence ref.',
        am: 'የክፍሉን ዝርዝር ከፍተው የቁጥር ለውጥ ጥያቄ (Renumbering) ያስገቡ።',
      },
      {
        en: 'Sign out and sign in as gm.demo (or am.demo) as an independent Checker.',
        am: 'ከክፍለ-ጊዜው ወጥተው በ gm.demo (ወይም am.demo) ይግቡ።',
      },
      {
        en: 'Open Approvals Centre -> Pending My Review and approve the Unit Renumbering request.',
        am: 'በማጽደቂያ ማዕከል ውስጥ ጥያቄውን ያጽድቁ።',
      },
    ],
    expectedOutcome:
      'Unit code updates only after checker approval; old identifier remains visible in Previous Aliases and Unit History.',
    expectedOutcomeAm:
      'የክፍሉ ቁጥር ከተጸደቀ በኋላ ይቀየራል፤ የቀድሞው ቁጥር በታሪክ መዝገብ ውስጥ ተጠብቆ ይቆያል።',
    failedControlExplanation:
      'Maker cannot self-approve their own renumbering request; direct overwrite without approval queue is blocked.',
    failedControlExplanationAm:
      'ጥያቄውን ያቀረበው ሰራተኛ በራሱ ማጽደቅ አይችልም፤ ያለ ማጽደቂያ በቀጥታ መቀየር ታግዷል።',
    auditMatchKeywords: ['Unit Renumbering Requested', 'Approval Approved', 'Unit Renumbered'],
  },
  {
    id: 'EX-03',
    number: 3,
    title: 'Create and Route a Lease',
    titleAm: 'የኪራይ ውል መፍጠርና ማስተላለፍ',
    recommendedUsername: 'am.demo',
    recommendedRole: 'Assistant Manager',
    targetSection: 'tenants-leases',
    objective:
      'Draft a new versioned synthetic lease (v1) from an approved rental application or wizard and verify schedule & unit status update.',
    objectiveAm:
      'ከጸደቀ የኪራይ ማመልከቻ ወይም ከአዲስ ውል ቅጽ በመነሳት ባለ እትም (v1) ውል መፍጠር።',
    startingCondition:
      'Vacant unit (A-201) or Approved application (APP-SYNTH-A-002) exists under Test Owner Alpha.',
    startingConditionAm: 'በ Test Owner Alpha ውስጥ ክፍት ክፍል (A-201) ወይም የጸደቀ ማመልከቻ ሲኖር።',
    steps: [
      {
        en: 'Sign in as am.demo (Assistant Manager) or clerk.demo.',
        am: 'በ am.demo (ረዳት ሥራ አስኪያጅ) ወይም clerk.demo ይግቡ።',
      },
      {
        en: 'Visit Rental Applications to convert Approved APP-SYNTH-A-002 to a Draft Lease, or open Tenants & Leases -> Create Lease.',
        am: 'በኪራይ ማመልከቻዎች ውስጥ APP-SYNTH-A-002ን ወደ ረቂቅ ውል ይቀይሩ ወይም በተከራዮችና ውሎች ገጽ አዲስ ውል ይፍጠሩ።',
      },
      {
        en: 'Complete both wizard steps with start/end dates, ETB rent, deposit, and evidence ref.',
        am: 'የመጀመሪያና የመጨረሻ ቀን፣ ወርሃዊ ኪራይ፣ ተቀማጭ ገንዘብ እና የማስረጃ ቁጥር አስገብተው ያጠናቅቁ።',
      },
    ],
    expectedOutcome:
      'Lease created non-destructively, unit transitions to Occupied, open invoice charge seeded, and audit trail appended.',
    expectedOutcomeAm:
      'አዲስ ውል ይፈጠራል፣ የክፍሉ ሁኔታ ወደ ተከራየ ይቀየራል፣ ክፍያና የኦዲት መዝገብም ይፈጠራሉ።',
    failedControlExplanation:
      'Unapproved rental applications cannot be converted to leases; invalid date ranges (end <= start) are blocked by form validation.',
    failedControlExplanationAm:
      'ያልጸደቁ ማመልከቻዎች ወደ ውል አይቀየሩም፤ የቀን ስህተቶች በቅጹ ይታገዳሉ።',
    auditMatchKeywords: ['Synthetic Lease Created', 'Application Converted to Lease'],
  },
  {
    id: 'EX-04',
    number: 4,
    title: 'Attempt Prohibited Self-Approval',
    titleAm: 'የተከለከለ የራስን ጥያቄ የማጽደቅ ሙከራ',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    targetSection: 'approvals',
    objective:
      'Verify that the same Actor ID cannot approve any workflow request they initiated, triggering an explicit block and audit denial event.',
    objectiveAm:
      'አንድ ተጠቃሚ (በActor ID) የራሱን ያቀረበውን ጥያቄ ማጽደቅ እንደማይችልና ሙከራው በኦዲት መዝገብ እንደሚያዝ ማረጋገጥ።',
    startingCondition:
      'Signed in as finance.demo (USR-SYNTH-03), who already submitted APR-1002 and APR-1003 (or any newly submitted request).',
    startingConditionAm:
      'በ finance.demo (USR-SYNTH-03) ሲገቡ በእሱ የቀረቡት APR-1002 እና APR-1003 በመጠባበቅ ላይ ይገኛሉ።',
    steps: [
      {
        en: 'Sign in as finance.demo (USR-SYNTH-03).',
        am: 'በ finance.demo (USR-SYNTH-03) ይግቡ።',
      },
      {
        en: 'Open Approvals Centre -> "Submitted by Me" tab and select APR-1002 (or APR-1003).',
        am: 'ወደ ማጽደቂያ ማዕከል -> "Submitted by Me" ገብተው APR-1002ን ይክፈቱ።',
      },
      {
        en: 'Inspect the blocked Approve control and click "Simulate Self-Approval Attempt (Audit Control Test)".',
        am: 'የታገደውን የማጽደቂያ መቆጣጠሪያ አይተው "የራስን የማጽደቅ ሙከራ ፈትሽ" የሚለውን ይጫኑ።',
      },
      {
        en: 'Confirm red error notification appears and inspect the new Denied event in Audit Trail.',
        am: 'የቀይ እገዳ ማንቂያ መታየቱንና በኦዲት መዝገብ ውስጥ Denied መጻፉን ያረጋግጡ።',
      },
    ],
    expectedOutcome:
      'Approval action remains strictly blocked; system logs Denied: Self-Approval Attempt Blocked in immutable audit trail.',
    expectedOutcomeAm:
      'ማጽደቅ ሙሉ በሙሉ ይታገዳል፤ ስርዓቱ የእገዳውን ክስተት በኦዲት መዝገብ ያስቀምጣል።',
    failedControlExplanation:
      'Both makerActorId === session.actorId AND makerPersona === role forbid self-approval. Mid-session role switching is also prohibited.',
    failedControlExplanationAm:
      'የተጠቃሚ መታወቂያ (Actor ID) እና የአቅራቢ ሚና መመሳሰል ራስን ማጽደቅን ይከለክላል።',
    auditMatchKeywords: ['Self-Approval'],
  },
  {
    id: 'EX-05',
    number: 5,
    title: 'Attempt Unauthorized Owner-Context Access',
    titleAm: 'ያልተፈቀደ የባለቤትነት ክልል የመግባት ሙከራ',
    recommendedUsername: 'owner.alpha.demo',
    recommendedRole: 'Owner / Director',
    targetSection: 'owners',
    objective:
      'Verify strict owner isolation: an Alpha-locked owner account cannot switch into or inspect Test Owner Beta records.',
    objectiveAm:
      'ጥብቅ የባለቤትነት መረጃ መለያየትን ማረጋገጥ፦ የAlpha ባለቤት ወደ Test Owner Beta መረጃ መግባት አይችልም።',
    startingCondition: 'Signed in as owner.alpha.demo (Owner / Director, USR-SYNTH-01).',
    startingConditionAm: 'በ owner.alpha.demo (Owner / Director) ክፍለ-ጊዜ ሲገቡ።',
    steps: [
      {
        en: 'Sign in as owner.alpha.demo (locked to Test Owner Alpha).',
        am: 'በ owner.alpha.demo ይግቡ።',
      },
      {
        en: 'Observe the locked Owner Context selector in the top bar and go to Owners & Entities.',
        am: 'ከላይ ያለውን የተቆለፈ የባለቤትነት መምረጫ አይተው ወደ ባለቤቶችና ተቋማት ገጽ ይሂዱ።',
      },
      {
        en: 'Click "Simulate Cross-Owner Access Test (Attempt OWN-BETA)" to test the isolation guard.',
        am: '"የሌላ ባለቤት መዳረሻ ሙከራ (OWN-BETA)" የሚለውን ቁልፍ ይጫኑ።',
      },
    ],
    expectedOutcome:
      'Switch is denied; Beta data remains invisible; Denied: Cross-Owner Access Attempt is written to Audit Trail.',
    expectedOutcomeAm:
      'ወደ Beta መግባት ይታገዳል፤ የBeta መረጃ አይታይም፤ የእገዳ ክስተት በኦዲት መዝገብ ይመዘገባል።',
    failedControlExplanation:
      'In production PostgreSQL RLS enforces isolation server-side via SET LOCAL app.current_owner_id. Here UI simulation blocks owner mutation and logs the denial.',
    failedControlExplanationAm:
      'በምርት ላይ PostgreSQL RLS መረጃውን በዳታቤዝ ይለያል፤ በዚህ ፕሮቶታይፕ ማስመሰያው መግባቱን ይከለክላል።',
    auditMatchKeywords: ['Owner Context Switch', 'Cross-Owner'],
  },
  {
    id: 'EX-06',
    number: 6,
    title: 'Submit a Receipt Void / Reversal Request',
    titleAm: 'የደረሰኝ መሰረዝ / መመለስ ጥያቄ ማቅረብ',
    recommendedUsername: 'collections.demo',
    recommendedRole: 'Collections Clerk',
    secondaryCheckerUsername: 'finance.demo',
    secondaryCheckerRole: 'Finance Officer',
    targetSection: 'collections',
    objective:
      'Demonstrate non-destructive financial correction: Clerks cannot delete issued DEMO receipts and must route reversals through Finance/GM.',
    objectiveAm:
      'ደረሰኝን ከማጥፋት ይልቅ በፋይናንስ ወይም በGM ማጽደቂያ በኩል የመመለስ (Reversal) ሂደት መፈጸም።',
    startingCondition: 'Issued DEMO receipt exists under active owner (e.g., RCT-SYNTH-A-001).',
    startingConditionAm: 'በንቁው ባለቤት ስር የወጣ የDEMO ደረሰኝ (ለምሳሌ RCT-SYNTH-A-001) ሲኖር።',
    steps: [
      {
        en: 'Sign in as collections.demo (or clerk.demo) and open Rent & Collections -> DEMO Receipts tab.',
        am: 'በ collections.demo (ወይም clerk.demo) ገብተው የDEMO ደረሰኞችን ትር ይክፈቱ።',
      },
      {
        en: 'Click Request Void on an issued DEMO receipt, enter evidence ref and reason, and confirm.',
        am: 'በወጣ ደረሰኝ ላይ "መሰረዝ ጠይቅ"ን ተጭነው የማስረጃ ቁጥርና ምክንያት ያስገቡ።',
      },
      {
        en: 'Sign out and sign in as finance.demo (or gm.demo) and approve the Receipt Void / Reversal in Approvals Centre.',
        am: 'በ finance.demo (ወይም gm.demo) ገብተው በማጽደቂያ ማዕከል የመመለስ ጥያቄውን ያጽድቁ።',
      },
    ],
    expectedOutcome:
      'Receipt transitions from Issued -> Void Requested -> Reversed while preserving full history and restoring invoice open balance.',
    expectedOutcomeAm:
      'ደረሰኙ ታሪኩ ሳይጠፋ ወደ Reversed ይቀየራል፤ የደረሰኙ ቀሪ ሂሳብም ይመለሳል።',
    failedControlExplanation:
      'Direct Delete buttons never exist; Collections Clerk cannot approve their own void request.',
    failedControlExplanationAm:
      'የመሰረዣ ቁልፍ በፍጹም የለም፤ የአሰባሰብ ሰራተኛ የራሱን የመመለስ ጥያቄ ማጽደቅ አይችልም።',
    auditMatchKeywords: ['Receipt Void / Reversal Requested', 'Receipt Voided'],
  },
  {
    id: 'EX-07',
    number: 7,
    title: 'Review a Maintenance-Cost Approval',
    titleAm: 'የጥገና ወጪ ማጽደቂያ መገምገም',
    recommendedUsername: 'property.demo',
    recommendedRole: 'Property Clerk',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'maintenance',
    objective:
      'Log or inspect a maintenance ticket with estimated cost >= ETB 10,000 and verify automatic two-step governance routing.',
    objectiveAm:
      'ከ ETB 10,000 በላይ የጥገና ወጪ ጥያቄ ወደ ማጽደቂያ ማዕከል መላኩንና መገምገሙን ማረጋገጥ።',
    startingCondition: 'Maintenance tickets exist (or log a new ticket >= ETB 10,000 under Test Owner Alpha).',
    startingConditionAm: 'በ Test Owner Alpha ስር የጥገና መዝገብ ሲኖር ወይም አዲስ >= ETB 10,000 ሲመዘገብ።',
    steps: [
      {
        en: 'Sign in as property.demo (or clerk.demo) and log a ticket in Maintenance & Complaints with estimated cost >= ETB 12,000.',
        am: 'በ property.demo (ወይም clerk.demo) ገብተው >= ETB 12,000 የሚገመት የጥገና ጥያቄ ይመዝግቡ።',
      },
      {
        en: 'Observe the ticket enters "Cost Approval Pending" and queues in Approvals Centre.',
        am: 'ጥያቄው ወደ "የወጪ ማጽደቂያ በመጠባበቅ ላይ" መግባቱን ያረጋግጡ።',
      },
      {
        en: 'Sign out and sign in as gm.demo (or am.demo) to verify Step 1 in Approvals Centre.',
        am: 'በ gm.demo (ወይም am.demo) ገብተው በማጽደቂያ ማዕከል ደረጃ 1ን ያረጋግጡ።',
      },
    ],
    expectedOutcome:
      'High-value maintenance costs cannot bypass budget approval; multi-step checker sign-off logs to audit trail.',
    expectedOutcomeAm:
      'ከፍተኛ የጥገና ወጪዎች ያለ ማጽደቂያ አይፈቀዱም፤ ውሳኔዎች በኦዲት ይመዘገባሉ።',
    failedControlExplanation:
      'Clerk cannot approve maintenance costs; Step-1 reviewer cannot also approve Step-2 escalation.',
    failedControlExplanationAm:
      'ጸሐፊ የጥገና ወጪ ማጽደቅ አይችልም፤ የደረጃ 1 አጽዳቂ ደረጃ 2ን በድጋሚ ማጽደቅ አይችልም።',
    auditMatchKeywords: ['Maintenance Ticket Logged', 'Maintenance Work Order Updated'],
  },
  {
    id: 'EX-08',
    number: 8,
    title: 'Run a Backup-Restore Readiness Exercise',
    titleAm: 'የምትኬ እና መልሶ ማግኛ ዝግጁነት ልምምድ ማካሄድ',
    recommendedUsername: 'sysadmin.demo',
    recommendedRole: 'System Administrator',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'backup-recovery',
    objective:
      'Request a simulated offline local-first restore drill as System Administrator and route it through GM/Owner sign-off.',
    objectiveAm:
      'በሲስተም አስተዳዳሪ የምትኬ መልሶ ማግኛ ልምምድ ጠይቆ በGM/ባለቤት ማጽደቂያ ማሳለፍ።',
    startingCondition: 'Signed in as sysadmin.demo scoped to Test Owner Alpha.',
    startingConditionAm: 'በ sysadmin.demo ወደ Test Owner Alpha ሲገቡ።',
    steps: [
      {
        en: 'Sign in as sysadmin.demo and open Backup & Recovery.',
        am: 'በ sysadmin.demo ገብተው የምትኬ እና መልሶ ማግኛ ገጽን ይክፈቱ።',
      },
      {
        en: 'Inspect the Draft — Unapproved RPO/RTO policy cards and click Request Restore Drill Approval.',
        am: 'ያልጸደቁትን የRPO/RTO ረቂቆች አይተው የመልሶ ማግኛ ልምምድ ፍቃድ ይጠይቁ።',
      },
      {
        en: 'Verify System Admin cannot self-approve the drill in Approvals Centre.',
        am: 'የሲስተም አስተዳዳሪው ጥያቄውን በራሱ ማጽደቅ አለመቻሉን ያረጋግጡ።',
      },
      {
        en: 'Approve Steps 1 & 2 via gm.demo and owner.alpha.demo, then inspect completion status.',
        am: 'በ gm.demo እና owner.alpha.demo ደረጃዎቹን አጽድቀው ውጤቱን ይመልከቱ።',
      },
    ],
    expectedOutcome:
      'Simulated drill progresses through governance approval without touching live storage or cloud services.',
    expectedOutcomeAm:
      'ልምምዱ ያለ እውነተኛ ዲስክ ወይም ክላውድ ግንኙነት በአስተዳደር ቁጥጥር ስር ይጠናቀቃል።',
    failedControlExplanation:
      'System Administrator is barred from self-approving infrastructure drills; RPO/RTO targets stay marked Draft — Unapproved.',
    failedControlExplanationAm:
      'የሲስተም አስተዳዳሪ ልምምዱን በራሱ ማጽደቅ አይችልም፤ RPO/RTO ግቦች ረቂቅ ሆነው ይቆያሉ።',
    auditMatchKeywords: ['Restore Drill Approval Requested', 'Restore Drill'],
  },
  {
    id: 'EX-09',
    number: 9,
    title: 'Resolve a Migration-Data Exception',
    titleAm: 'የውሂብ ሽግግር ልዩነት (Exception) መፍታት',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'migration',
    objective:
      'Review a flagged synthetic staging batch in Migration Readiness and route its exception for checker review without live cutover.',
    objectiveAm:
      'በውሂብ ሽግግር ዝግጁነት ገጽ ላይ ስህተት ያለበትን የሙከራ ስብስብ ወደ ማጽደቂያ ማዕከል መላክ።',
    startingCondition: 'Staging batch with "Exception Flagged" validation state exists.',
    startingConditionAm: 'ስህተት (Exception Flagged) ያለበት የሙከራ ሽግግር ስብስብ ሲኖር።',
    steps: [
      {
        en: 'Sign in as finance.demo (or sysadmin.demo) and open Migration Readiness.',
        am: 'በ finance.demo (ወይም sysadmin.demo) ገብተው የውሂብ ሽግግር ገጽን ይክፈቱ።',
      },
      {
        en: 'Locate the batch marked Exception Flagged and click Submit Exception.',
        am: 'Exception Flagged የተባለውን ስብስብ አግኝተው "ልዩነት አስገባ"ን ይጫኑ።',
      },
      {
        en: 'Sign in as gm.demo and review/approve the exception in Approvals Centre.',
        am: 'በ gm.demo ገብተው በማጽደቂያ ማዕከል ልዩነቱን ይገምግሙና ያጽድቁ።',
      },
    ],
    expectedOutcome:
      'Exception resolves to Exception Approved (Sim) in staging while real historical data import remains blocked.',
    expectedOutcomeAm:
      'ልዩነቱ በሙከራ መዝገብ ይጸድቃል፤ ትክክለኛ የቀድሞ ውሂብ ማስገባት ግን እንደተዘጋ ይቆያል።',
    failedControlExplanation:
      'Live CSV import and opening-balance ledger posting remain permanently disabled pending cutover sign-offs.',
    failedControlExplanationAm:
      'ቀጥተኛ የፋይል መጫንና የመክፈቻ ሚዛን ማስገባት ታግደው ይቆያሉ።',
    auditMatchKeywords: ['Migration Exception'],
  },
  {
    id: 'EX-10',
    number: 10,
    title: 'Review a Tax-Configuration Blocker',
    titleAm: 'የታክስ ውቅር ማገጃን (Blocker) መገምገም',
    recommendedUsername: 'finance.demo',
    recommendedRole: 'Finance Officer',
    secondaryCheckerUsername: 'gm.demo',
    secondaryCheckerRole: 'General Manager',
    targetSection: 'tax',
    objective:
      'Verify that synthetic Ethiopian tax placeholders cannot reach "Active" state and that conflicting research blocks production activation.',
    objectiveAm:
      'ሰው-ሠራሽ የኢትዮጵያ የታክስ ረቂቆች ወደ "ንቁ (Active)" ደረጃ መግባት አለመቻላቸውን ማረጋገጥ።',
    startingCondition: 'Synthetic tax rules & compliance gates active in Tax Configuration and Compliance Readiness.',
    startingConditionAm: 'በታክስ ረቂቅና በተገዢነት ዝግጁነት ገጾች ውስጥ ሰው-ሠራሽ መዝገቦች ሲኖሩ።',
    steps: [
      {
        en: 'Sign in as finance.demo and open Tax Configuration.',
        am: 'በ finance.demo ገብተው ወደ የታክስ ረቂቅ ገጽ ይሂዱ።',
      },
      {
        en: 'Inspect the 5-stage lifecycle strip and verify the final "Active" stage is permanently locked/disabled.',
        am: 'ባለ 5 ደረጃ ዑደቱን አይተው "ንቁ (Active)" የሚለው ደረጃ መዘጋቱን ያረጋግጡ።',
      },
      {
        en: 'Open Compliance Readiness -> Production Gates tab and run the Simulated Readiness Check.',
        am: 'በተገዢነት ዝግጁነት -> Production Gates ትር ውስጥ የዝግጁነት ፍተሻውን ያካሂዱ።',
      },
    ],
    expectedOutcome:
      'All tax calculations stay disabled, Research Conflict warnings remain clear, and 9/9 production gates report Blocked/Pending.',
    expectedOutcomeAm:
      'ምንም የታክስ ስሌት አይሰራም፤ ሁሉም 9 የምርት መግቢያ በሮች እንደተዘጉ ይቆያሉ።',
    failedControlExplanation:
      'Prototype prohibits live VAT/income/withholding rates without signed Ethiopian licensed tax adviser opinion & owner resolution.',
    failedControlExplanationAm:
      'ያለ ኢትዮጵያዊ ፈቃድ ያለው የታክስ አማካሪና የባለቤት ፊርማ የታክስ ምጣኔን ማንቃት አይቻልም።',
    auditMatchKeywords: ['Tax', 'Production Gate Readiness Check'],
  },
  ...ACCOUNTING_TRAINING_EXERCISES,
];
