import { NavSection } from '../types/prms';

export type DemoStakeholderId = 'owner' | 'gm' | 'finance' | 'clerks';

export type DemoSceneType =
  | 'maker-checker'
  | 'tenant-collection'
  | 'three-way-deposit'
  | 'owner-mobile'
  | 'erca-tax';

export interface DemoKeyframe {
  stepNumber: number;
  titleEn: string;
  titleAm: string;
  activeActorEn: string;
  activeActorAm: string;
  amharicScript: string;
  englishCue: string;
  audienceTakeawayAm: string;
  liveProofLabel: string;
  liveProofValue: string;
  uiStateBadge: string;
  highlightZone: string;
  durationSec: number;
}

export interface DemoScenario {
  id: string;
  sceneType: DemoSceneType;
  chapterOrder: string;
  stakeholders: DemoStakeholderId[];
  audienceLabelAm: string;
  audienceLabelEn: string;
  titleEn: string;
  titleAm: string;
  summaryAm: string;
  summaryEn: string;
  totalDurationLabel: string;
  targetSection: NavSection;
  targetActionLabelAm: string;
  targetActionLabelEn: string;
  keyframes: DemoKeyframe[];
}

export interface StakeholderChapter {
  id: DemoStakeholderId | 'all';
  labelAm: string;
  labelEn: string;
  roleFocusAm: string;
  roleFocusEn: string;
}

export const STAKEHOLDER_CHAPTERS: StakeholderChapter[] = [
  {
    id: 'all',
    labelAm: 'ሁሉም ምዕራፎች',
    labelEn: 'All Chapters',
    roleFocusAm: 'ሙሉ የሥራ አመራርና ኦፕሬሽን አቀራረብ',
    roleFocusEn: 'Complete executive governance, finance, and daily operations walkthrough',
  },
  {
    id: 'owner',
    labelAm: 'ባለቤት (Owner)',
    labelEn: 'Owner',
    roleFocusAm: 'የባለቤትነት ክልል ቁጥጥር፣ 5 ሕንፃዎችና የመጨረሻ ማጽደቂያ',
    roleFocusEn: '5-building isolation, RLS lock, Step-2 escalation & Out-of-Office mobile brief',
  },
  {
    id: 'gm',
    labelAm: 'ዋና ሥራ አስኪያጅ (GM)',
    labelEn: 'GM',
    roleFocusAm: 'ዕለታዊ አስተዳደር፣ Maker-Checker ቁጥጥርና የፈጣን ውሳኔ ማዕከል',
    roleFocusEn: 'Maker-Checker approvals, period lock sign-off & cross-department supervision',
  },
  {
    id: 'finance',
    labelAm: 'የፋይናንስ ኃላፊ (Finance Head)',
    labelEn: 'Finance Head',
    roleFocusAm: 'ድርብ ሂሳብ መዝገብ፣ የ3-ዮሽ ዋስትና ማመሳከሪያና ERCA ዝግጁነት',
    roleFocusEn: 'Double-entry ledger, 3-way security deposit tie-out & ERCA tax gate',
  },
  {
    id: 'clerks',
    labelAm: 'ጸሐፊዎች (Clerks)',
    labelEn: 'Clerk',
    roleFocusAm: 'የኪራይ አሰባሰብ፣ ቴሌብር/አሪፍፔይና የውል መቀበያ',
    roleFocusEn: 'Telebirr/ArifPay/CBE rental collection, sequential receipts & maker requests',
  },
];

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'demo-maker-checker',
    sceneType: 'maker-checker',
    chapterOrder: '01',
    stakeholders: ['owner', 'gm', 'finance', 'clerks'],
    audienceLabelAm: 'ጸሐፊ · ፋይናንስ · ዋና ሥራ አስኪያጅ',
    audienceLabelEn: 'Clerks · Finance Head · GM',
    titleEn: 'Maker-Checker Approval & Self-Void Guard',
    titleAm: 'ባለ ሁለት እጅ ማጽደቂያ (Maker-Checker) እና የስርቆት መከላከያ',
    summaryAm:
      'ጸሐፊ የክፍያ ደረሰኝ ማስረጃ ቢያቀርብ እንኳን ራሱ ማጽደቅ እንደማይችል እና ገለልተኛ አጽዳቂ ሲፈርም ቋሚ SHA-256 ኦዲት መዝገብ እንዴት እንደሚፈጠር ያሳያል።',
    summaryEn:
      'Demonstrates dual-control receipt voiding where the originating clerk is blocked from self-approval and independent GM/Finance sign-off appends an immutable hash-chained audit record.',
    totalDurationLabel: '1m 40s',
    targetSection: 'approvals',
    targetActionLabelAm: 'ወደ ቀጥታ ማጽደቂያ ማዕከል ሂድ',
    targetActionLabelEn: 'Open Live Approvals Centre',
    keyframes: [
      {
        stepNumber: 1,
        titleEn: 'Clerk Submits Receipt Void Request',
        titleAm: 'ደረጃ 1፡ ጸሐፊ የክፍያ ደረሰኝ መሰረዣ ጥያቄ ያቀርባል',
        activeActorEn: 'Collections Clerk (USR-SYNTH-04)',
        activeActorAm: 'የአሰባሰብ ጸሐፊ (USR-SYNTH-04)',
        amharicScript:
          'ክቡር ባለቤት፣ ዋና ሥራ አስኪያጅና የፋይናንስ ኃላፊ — ይህ የሥርዓቱ ልብ የሆነው "ባለ ሁለት እጅ ቁጥጥር" ነው። ጸሐፊ የተሳሳተ የብር 15,000 ደረሰኝ ለማስተካከል በምክንያትና በባንክ ማስረጃ ጥያቄ ያስገባል። ሆኖም ደረሰኙ ወዲያውኑ አይሰረዝም፤ ለማጽደቅ ወደ ማዕከሉ ይላካል።',
        englishCue:
          'Maker (Clerk) creates Receipt Void request REQ-VOID-2019-01 with mandatory evidence ref. Ledger stays untouched until verified.',
        audienceTakeawayAm: 'ማንኛውም ጸሐፊ ደረሰኝ በግሉ አይሰርዝም፤ ሁልጊዜ ማስረጃ ያስፈልጋል።',
        liveProofLabel: 'Request Status',
        liveProofValue: 'Pending Checker (Step 1/2)',
        uiStateBadge: 'Submitted by Maker',
        highlightZone: 'maker-submit',
        durationSec: 25,
      },
      {
        stepNumber: 2,
        titleEn: 'Self-Approval Hard-Blocked by Actor ID',
        titleAm: 'ደረጃ 2፡ ራስን በራስ ማጽደቅ በሥርዓቱ ይታገዳል',
        activeActorEn: 'Guard Engine (Actor ID SoD Check)',
        activeActorAm: 'የደህንነት መቆጣጠሪያ (Actor ID SoD)',
        amharicScript:
          'አሁን ጸሐፊው "እኔ ራሴ ላጽድቀው" ብሎ ቢሞክር ወይም ሌላ ሚና ቢቀይር እንኳን፣ ሥርዓቱ በተጠቃሚ መለያ (Actor ID) ብቻ ሳይሆን በዳታቤዝ Trigger ጭምር ያግደዋል። ይህ የውስጥ ገንዘብ መዘረፍን ሙሉ በሙሉ ያስቆማል።',
        englishCue:
          'Self-approval attempt triggers HTTP 403 and PostgreSQL trg_prevent_self_approval guard (makerActorId === checkerActorId).',
        audienceTakeawayAm: 'አንድ ሰው አዘጋጅቶ ራሱ ማጽደቅ በፍጹም አይችልም (Zero Self-Approval)።',
        liveProofLabel: 'SoD Control Result',
        liveProofValue: 'Blocked · HTTP 403 / DB Trigger',
        uiStateBadge: 'Self-Approval Blocked',
        highlightZone: 'sod-block',
        durationSec: 25,
      },
      {
        stepNumber: 3,
        titleEn: 'GM / Finance Head Reviews Diff & Approves',
        titleAm: 'ደረጃ 3፡ ዋና ሥራ አስኪያጅ ወይም ፋይናንስ ኃላፊ መዝገቡን አይቶ ያጸድቃል',
        activeActorEn: 'General Manager (USR-SYNTH-02)',
        activeActorAm: 'ዋና ሥራ አስኪያጅ (USR-SYNTH-02)',
        amharicScript:
          'ዋና ሥራ አስኪያጁ ወይም የፋይናንስ ኃላፊው "ከለውጥ በፊት እና በኋላ" (Before/After) ያለውን ልዩነት፣ የተያያዘውን የባንክ ወረቀትና የጸሐፊውን ማብራሪያ አይተው በአንድ ንክኪ ያጸድቃሉ ወይም ለማስተካከያ ይመልሳሉ።',
        englishCue:
          'Independent checker inspects Before/After JSON diff + payload SHA-256 hash integrity and stamps decision.',
        audienceTakeawayAm: 'አጽዳቂው ሙሉ ማስረጃና ልዩነት በግልጽ አይቶ በኃላፊነት ይወስናል።',
        liveProofLabel: 'Checker Verified',
        liveProofValue: 'Approved by USR-SYNTH-02',
        uiStateBadge: 'Checker Approved',
        highlightZone: 'checker-approve',
        durationSec: 25,
      },
      {
        stepNumber: 4,
        titleEn: 'Mirror Reversal PR-25 & Immutable SHA-256 Audit',
        titleAm: 'ደረጃ 4፡ የሂሳብ ማስተካከያ (PR-25) እና የማይፋቅ የኦዲት ሰንሰለት ይፈጠራል',
        activeActorEn: 'Append-Only Audit Chain',
        activeActorAm: 'የማይጠፋ የኦዲት ሰንሰለት (SHA-256)',
        amharicScript:
          'በመጨረሻም የቀድሞው ደረሰኝ ሳይጠፋ ተቃራኒ የሂሳብ መዝገብ (PR-25 Mirror Reversal) ይጻፋል። እንዲሁም የኦዲት መዝገቡ በSHA-256 ክሪፕቶግራፊ ተቆልፎ ማንም (የሲስተም አድሚን ጭምር) እንዳይሰርዘው ይጠበቃል።',
        englishCue:
          'Original receipt stays visible; PR-25 mirror entry posts atomically and AuditEvent chains prev_hash -> event_hash.',
        audienceTakeawayAm: 'የተሰረዘ ወይም የተደበቀ ታሪክ የለም — ሁሉም ነገር ለኦዲት ክፍትና የማይጠፋ ነው።',
        liveProofLabel: 'Audit Hash Chain',
        liveProofValue: 'prev_hash Linked · Append-Only',
        uiStateBadge: 'Immutable Audit Logged',
        highlightZone: 'audit-chain',
        durationSec: 25,
      },
    ],
  },
  {
    id: 'demo-tenant-collection',
    sceneType: 'tenant-collection',
    chapterOrder: '02',
    stakeholders: ['clerks', 'finance', 'gm'],
    audienceLabelAm: 'ጸሐፊዎች · ፋይናንስ ኃላፊ · ተከራዮች',
    audienceLabelEn: 'Clerks · Finance Head · Tenants',
    titleEn: 'Tenant Rental Collection (Telebirr, ArifPay & CBE Slip)',
    titleAm: 'የተከራይ ኪራይ ክፍያ አሰባሰብ (ቴሌብር፣ አሪፍፔይ እና CBE ስሊፕ)',
    summaryAm:
      'ተከራይ በሞባይል ስልኩ ኪራዩን እንዴት በቀላሉ እንደሚከፍል፣ ሥርዓቱ በራሱ ደረሰኝ አዘጋጅቶ ወደ ድርብ ሂሳብ መዝገብ (PR-01/PR-03) እንዴት እንደሚያስገባ ያሳያል።',
    summaryEn:
      'Walks through tenant self-service QR/ArifPay/CBE slip payment, signed gateway verification, automatic double-entry GL settlement, and instant PDF/Excel receipt export.',
    totalDurationLabel: '1m 40s',
    targetSection: 'collections',
    targetActionLabelAm: 'ወደ ቀጥታ ኪራይ አሰባሰብ ገጽ ሂድ',
    targetActionLabelEn: 'Open Live Rent & Collections',
    keyframes: [
      {
        stepNumber: 1,
        titleEn: 'Tenant Opens Unit-Isolated Pay Tab',
        titleAm: 'ደረጃ 1፡ ተከራይ የራሱን የሞባይል ክፍያ ገጽ ይከፍታል',
        activeActorEn: 'Tenant Mobile Portal (B1-U104)',
        activeActorAm: 'የተከራይ ሞባይል መተግበሪያ (B1-U104)',
        amharicScript:
          'እያንዳንዱ ተከራይ በስልክ ቁጥሩ (OTP) ሲገባ የራሱን ሱቅ ወይም ቢሮ ሂሳብ ብቻ ነው የሚያየው። ቴሌብር QR መቃኘት፣ በአሪፍፔይ መክፈል፣ የCBE ባንክ ስሊፕ ማስገባት ወይም የማስታወሻ ኢሜይል መጠየቅ ይችላል።',
        englishCue:
          'Tenant sees strictly own active lease & invoices; can scan Telebirr QR, pay via ArifPay, submit CBE slip, or request payment reminder.',
        audienceTakeawayAm: 'ተከራዩ የራሱን ሂሳብ ብቻ ያያል፤ ስህተትና የቢሮ ወረፋ ይቀንሳል።',
        liveProofLabel: 'Active Invoice',
        liveProofValue: 'ETB 24,500.00 · B1-U104',
        uiStateBadge: 'Tenant Mobile Pay',
        highlightZone: 'tenant-pay',
        durationSec: 25,
      },
      {
        stepNumber: 2,
        titleEn: 'Signed Webhook & Replay Protection',
        titleAm: 'ደረጃ 2፡ የባንክ/ቴሌብር ማረጋገጫ ፊርማ እና የድግግሞሽ መከላከያ',
        activeActorEn: 'Gateway Security Verifier',
        activeActorAm: 'የክፍያ መግቢያ ደህንነት ማረጋገጫ',
        amharicScript:
          'ክፍያው ሲፈጸም ሥርዓቱ የአሪፍፔይ HMAC ፊርማ ወይም የቴሌብር RSA ፊርማ ያረጋግጣል፤ እንዲሁም አንድ ክፍያ ሁለት ጊዜ እንዳይመዘገብ (Idempotency Nonce) ይጠብቃል። ያልተሳካ ክፍያ (PR-08) ሂሳብ አይነካም።',
        englishCue:
          'HMAC/RSA signature & nonce verified server-side. Failed attempts follow PR-08 (zero accounting entries created).',
        audienceTakeawayAm: 'የውሸት የክፍያ መልዕክት አያልፍም፤ ድርብ ምዝገባ በፍጹም አይከሰትም።',
        liveProofLabel: 'Webhook Guard',
        liveProofValue: 'Signature OK · Nonce Unique',
        uiStateBadge: 'Verified Settlement',
        highlightZone: 'gateway-verify',
        durationSec: 25,
      },
      {
        stepNumber: 3,
        titleEn: 'Sequential Receipt & Double-Entry Posting',
        titleAm: 'ደረጃ 3፡ ተከታታይ ደረሰኝ እና ድርብ ሂሳብ መዝገብ በአንድ ጊዜ ይመዘገባል',
        activeActorEn: 'Ledger Engine (PR-01 / PR-03)',
        activeActorAm: 'የሂሳብ ሞተር (PR-01 / PR-03)',
        amharicScript:
          'ክፍያው እንደተረጋገጠ ሥርዓቱ በተከታታይ ቁጥር ደረሰኝ ይቆርጣል፤ ወዲያውኑም "1020 CBE ባንክ" ላይ ገቢ (Debit) እና "1200 የተከራይ ተቀባይ ሂሳብ" ላይ ቀናሽ (Credit) አድርጎ ይመዘግባል።',
        englishCue:
          'Atomic DB transaction issues sequential receipt RCT-2019-0148 and posts balanced journal DR 1020 / CR 1200.',
        audienceTakeawayAm: 'ጸሐፊ በእጅ ኤክሴል መሙላት አያስፈልገውም — ደረሰኙና ሂሳቡ በራሱ ይታሰራል።',
        liveProofLabel: 'Double-Entry Journal',
        liveProofValue: 'DR 1020 ETB 24,500 = CR 1200',
        uiStateBadge: 'Auto-Posted',
        highlightZone: 'auto-ledger',
        durationSec: 25,
      },
      {
        stepNumber: 4,
        titleEn: 'Live Collections Queue & PDF/Excel Export',
        titleAm: 'ደረጃ 4፡ የጸሐፊ መቆጣጠሪያ ዝርዝር ይታደሳል፤ PDF/Excel ደረሰኝ ይወርዳል',
        activeActorEn: 'Collections Desk & Tenant Export',
        activeActorAm: 'የጸሐፊ መዝገብ እና የተከራይ ደረሰኝ ማውረጃ',
        amharicScript:
          'ጸሐፊው በቢሮው ገጹን ሳያድስ (Real-time) ክፍያው እንደተፈጸመ ያያል፤ ተከራዩም የክፍያ ታሪኩን በPDF ወይም በExcel (.xlsx) ማውረድ ይችላል።',
        englishCue:
          'Collections queue updates live; tenant downloads processed payment history as PDF or Excel.',
        audienceTakeawayAm: 'ፈጣን አገልግሎት፣ ግልጽ ሪፖርት እና ዜሮ የወረቀት ብክነት።',
        liveProofLabel: 'Collection Status',
        liveProofValue: 'Settled · PDF & XLSX Ready',
        uiStateBadge: 'Receipt Ready',
        highlightZone: 'queue-settled',
        durationSec: 25,
      },
    ],
  },
  {
    id: 'demo-three-way-deposit',
    sceneType: 'three-way-deposit',
    chapterOrder: '03',
    stakeholders: ['finance', 'gm'],
    audienceLabelAm: 'የፋይናንስ ኃላፊ · ዋና ሥራ አስኪያጅ',
    audienceLabelEn: 'Finance Head · General Manager',
    titleEn: 'Independent 3-Way Security Deposit & Period Close',
    titleAm: 'የሦስትዮሽ የተከራይ ዋስትና (Deposit) ማመሳከሪያና የወር መዝጊያ',
    summaryAm:
      'የተከራይ ዋስትና ገንዘብ በውል መዝገብ፣ በንዑስ ሌጀር እና በዋናው ሂሳብ (GL 2120) መካከል አንድ ብር እንኳን ከተለያየ የወሩን ሂሳብ መዝጋት እንዴት እንደሚከለክል ያሳያል።',
    summaryEn:
      'Demonstrates the independent 3-way tie-out (Lease Register == DepositMovement Subledger == GL 2120) and the 9-step Ethiopian 13-period close lock.',
    totalDurationLabel: '1m 20s',
    targetSection: 'finance',
    targetActionLabelAm: 'ወደ ቀጥታ ፋይናንስ ገጽ ሂድ',
    targetActionLabelEn: 'Open Live Finance Ledger',
    keyframes: [
      {
        stepNumber: 1,
        titleEn: 'Three Independent Deposit Sources Compared',
        titleAm: 'ደረጃ 1፡ ሦስት ገለልተኛ የዋስትና ሂሳብ ምንጮች በአንድ ላይ ይነጻጸራሉ',
        activeActorEn: 'Finance Reconciliation Engine',
        activeActorAm: 'የፋይናንስ ማመሳከሪያ ሞተር',
        amharicScript:
          'ክቡር የፋይናንስ ኃላፊ — ሥርዓቱ የዋስትና ገንዘብን ከአንድ ቦታ ብቻ አይወስድም። 1ኛ) የውል መዝገቡን፣ 2ኛ) የማይጠፋውን DepositMovement ንዑስ ሌጀር እና 3ኛ) ዋናውን የGL 2120 ሂሳብ ለየብቻ ደምሮ ያነጻጽራል።',
        englishCue:
          'Compares Net Active Lease Deposits vs independent DepositMovement Subledger vs GL Account 2120 balance.',
        audienceTakeawayAm: 'ሁሉም ሂሳቦች በራሳቸው ተመሳክረው ትክክለኛነታቸው ይረጋገጣል።',
        liveProofLabel: 'Lease vs GL 2120',
        liveProofValue: 'ETB 1,050,000.00 Checked',
        uiStateBadge: '3-Way Audit Scan',
        highlightZone: 'three-way-scan',
        durationSec: 20,
      },
      {
        stepNumber: 2,
        titleEn: 'Mismatch Blocks Period Close Automatically',
        titleAm: 'ደረጃ 2፡ ልዩነት ከተገኘ የወር መዝጊያው በጥብቅ ይታገዳል',
        activeActorEn: 'Period Close Lock (CHK-3WAY-DEPOSIT)',
        activeActorAm: 'የወር መዝጊያ መቆለፊያ',
        amharicScript:
          'ለምሳሌ ያልተያያዘ የዋስትና ገቢ ቢኖርና ETB 15,000 ልዩነት ቢፈጠር፣ ሥርዓቱ ወሩን (ህዳር 2019 ዓ.ም) እንዳይዘጋ ያግዳል፤ የAccount 1040 Clearing ሂሳብም 0.00 መሆኑን ያረጋግጣል።',
        englishCue:
          'When Subledger != GL 2120 or Account 1040 != 0.00, CHK-3WAY-DEPOSIT fails and request_period_close raises ValidationError.',
        audienceTakeawayAm: 'ሂሳብ ሳይመሳከር ወር አይዘጋም፤ ስህተት ወደ ቀጣይ ወር አይተላለፍም።',
        liveProofLabel: 'Variance Guard',
        liveProofValue: 'ETB 15,000.00 Divergence Blocked',
        uiStateBadge: 'Close Blocked',
        highlightZone: 'variance-block',
        durationSec: 20,
      },
      {
        stepNumber: 3,
        titleEn: 'Subledger Linked -> Zero Variance Verified',
        titleAm: 'ደረጃ 3፡ ማስተካከያው ሲያያዝ ልዩነቱ ወደ ETB 0.00 ይመጣል',
        activeActorEn: 'Finance Officer (USR-SYNTH-03)',
        activeActorAm: 'የፋይናንስ ኃላፊ (USR-SYNTH-03)',
        amharicScript:
          'ፋይናንስ ኃላፊው ያልተያያዘውን እንቅስቃሴ ከጆርናሉ ጋር ሲያገናኝ፣ ሦስቱም ምንጮች በትክክል ETB 0.00 ልዩነት (Passed) ያሳያሉ፤ የዕለት ጥሬ ገንዘብ ገደብም (ETB 50,000) ተጠብቆ ይታያል።',
        englishCue:
          'DepositMovement links to posted_journal; 3-way check turns Passed (ETB 0.00 variance across all 3 legs).',
        audienceTakeawayAm: 'እያንዳንዱ ብር ከደረሰኝ እስከ ሚዛን መዝገብ ድረስ ሙሉ በሙሉ የተሳሰረ ነው።',
        liveProofLabel: '3-Way Variance',
        liveProofValue: 'ETB 0.00 · All 3 Legs Match',
        uiStateBadge: '3-Way Balanced',
        highlightZone: 'three-way-pass',
        durationSec: 20,
      },
      {
        stepNumber: 4,
        titleEn: 'GM / Owner Approves & Locks Ethiopian Period',
        titleAm: 'ደረጃ 4፡ ዋና ሥራ አስኪያጅ ወሩን ዘግቶ ወደኋላ መመለስ ይከለክላል',
        activeActorEn: 'General Manager Maker-Checker Close',
        activeActorAm: 'የወር መዝጊያ ፊርማ',
        amharicScript:
          'አዘጋጁ (ፋይናንስ ኃላፊ) ካረጋገጠ በኋላ ዋና ሥራ አስኪያጁ ወሩን ሲዘጋው፣ የተዘጋው ወር ላይ ማንም የኋላ ቀን መዝገብ እንዳያስገባ በዳታቤዝ ደረጃ ይቆለፋል።',
        englishCue:
          'Independent checker closes period 2019-03; back-dated journals into closed periods are blocked at service & DB level.',
        audienceTakeawayAm: 'የጸደቀ የወር ሪፖርት ከተዘጋ በኋላ በማንም አይቀየርም።',
        liveProofLabel: 'Period 2019-03',
        liveProofValue: 'Closed & Locked (SoD Verified)',
        uiStateBadge: 'Period Locked',
        highlightZone: 'period-locked',
        durationSec: 20,
      },
    ],
  },
  {
    id: 'demo-owner-mobile',
    sceneType: 'owner-mobile',
    chapterOrder: '04',
    stakeholders: ['owner', 'gm'],
    audienceLabelAm: 'ባለቤት (Owner) · ዋና ሥራ አስኪያጅ',
    audienceLabelEn: 'Owner · General Manager',
    titleEn: 'Owner 5-Building Isolation & Out-of-Office Mobile Mode',
    titleAm: 'የባለቤት 5 ሕንፃዎች መረጃ፣ ጠንካራ ክልል መለያየት እና የሞባይል ቁጥጥር',
    summaryAm:
      'የባለቤቱ 5 ሕንፃዎች (~100 ኪራይ ክፍሎች) ከንግድ ተቋማት (Abdulwehab Dekebo Trading) ጋር ሳይደባለቁ እና ባለቤቱ በሞባይል ስልኩ ብቻ ከየትኛውም ቦታ ውሳኔ እንዴት እንደሚሰጥ ያሳያል።',
    summaryEn:
      'Showcases the 5-building Abdulwehab Dekebo title-holder scope, PostgreSQL RLS owner isolation, Trading inter-entity block, and Out-of-Office Owner Mobile Mode.',
    totalDurationLabel: '1m 20s',
    targetSection: 'owners',
    targetActionLabelAm: 'ወደ ባለቤቶችና ተቋማት ገጽ ሂድ',
    targetActionLabelEn: 'Open Live Owners & Entities',
    keyframes: [
      {
        stepNumber: 1,
        titleEn: '5 Buildings Under 1 Title-Holder vs Pending Trading Entity',
        titleAm: 'ደረጃ 1፡ የአብዱልወሃብ ደከቦ 5 ሕንፃዎች እና የTrading ተቋም መለየት',
        activeActorEn: 'Owner Governance Scope (OWN-ALPHA)',
        activeActorAm: 'የባለቤት መዝገብ (OWN-ALPHA)',
        amharicScript:
          'ክቡር ባለቤት — የእርስዎ 5 ሕንፃዎች (እያንዳንዳቸው ~20 ክፍሎች) በአንድ ሕጋዊ ባለቤት ስር ተደራጅተዋል። "አብዱልወሃብ ደከቦ ትሬዲንግ" ግን ሰነዱ እስኪረጋገጥ ድረስ ከኪራይ ሂሳብ ጋር እንዳይደባለቅ ተለይቶ ተቀምጧል።',
        englishCue:
          'Title-Holder owns Buildings B1–B5; separate PartyIdentity "Abdulwehab Dekebo Trading" blocks inter-entity ledger postings until legal/tax sign-off.',
        audienceTakeawayAm: 'የግል ንብረት ኪራይ እና የንግድ ድርጅት ሂሳብ በስህተት አይደባለቁም።',
        liveProofLabel: 'Portfolio Structure',
        liveProofValue: '5 Buildings · Inter-Entity Blocked',
        uiStateBadge: 'Legal Entity Separated',
        highlightZone: 'entity-split',
        durationSec: 20,
      },
      {
        stepNumber: 2,
        titleEn: 'PostgreSQL 16 RLS Hard Owner Isolation',
        titleAm: 'ደረጃ 2፡ የባለቤት መረጃ በዳታቤዝ ደረጃ (PostgreSQL RLS) ይቆለፋል',
        activeActorEn: 'RLS Policy (app.current_owner_id)',
        activeActorAm: 'የመረጃ መለያየት መቆለፊያ (RLS)',
        amharicScript:
          'የባለቤት መለያ (OWN-ALPHA) በሚከፈትበት ጊዜ ሌላ ባለቤት መረጃ ማየት ወይም መቀላቀል በUI ብቻ ሳይሆን በPostgreSQL 16 Row-Level Security ጭምር ዜሮ ረድፍ (0 Rows) ተብሎ ይታገዳል።',
        englishCue:
          'SET LOCAL app.current_owner_id + FORCE ROW LEVEL SECURITY enforces strict single-owner isolation at DB layer.',
        audienceTakeawayAm: 'የአንድ ባለቤት መረጃ ለሌላ ባለቤት በፍጹም አይታይም።',
        liveProofLabel: 'Cross-Owner Query',
        liveProofValue: '0 Rows Returned · Isolation Active',
        uiStateBadge: 'DB Isolation Enforced',
        highlightZone: 'rls-lock',
        durationSec: 20,
      },
      {
        stepNumber: 3,
        titleEn: 'Owner Switches Into Out-of-Office Mobile Mode',
        titleAm: 'ደረጃ 3፡ ባለቤቱ ከቢሮ ውጭ ሲሆኑ በሞባይል ሁሉንም ይቆጣጠራሉ',
        activeActorEn: 'Owner Mobile Mode (390px PWA)',
        activeActorAm: 'የባለቤት ሞባይል ሁነታ (PWA)',
        amharicScript:
          'ባለቤቱ ጉዞ ላይ ወይም ከቢሮ ውጭ ቢሆኑም በስልካቸው "Out-of-Office Mobile Mode" በመክፈት የቀኑን ገቢ፣ ያልተከፈሉ ክፍያዎችን እና የሚጠብቁ ውሳኔዎችን በ5 ቀላል ቁልፎች ይከታተላሉ።',
        englishCue:
          'OwnerMobileApp renders 5 thumb-friendly tabs (Home, Approvals, Money, Ops, More) with instant drill-down to 22 modules.',
        audienceTakeawayAm: 'ቢሮ ባይኖሩም የዕለቱን የገንዘብ ፍሰትና ክምችት በእጅ ስልክዎ ያያሉ።',
        liveProofLabel: 'Mobile Surface',
        liveProofValue: '5 Tabs · 22 Modules Accessible',
        uiStateBadge: 'Owner Mobile Active',
        highlightZone: 'owner-mobile',
        durationSec: 20,
      },
      {
        stepNumber: 4,
        titleEn: 'One-Tap Step-2 Executive Sign-Off',
        titleAm: 'ደረጃ 4፡ ከ25,000 ብር በላይ ወጪዎችን በሞባይል ማጽደቅ',
        activeActorEn: 'Owner / Director (USR-SYNTH-01)',
        activeActorAm: 'ባለቤት / ዳይሬክተር (USR-SYNTH-01)',
        amharicScript:
          'ዋና ሥራ አስኪያጁ ደረጃ 1ን ያጣራውን ከፍተኛ ወጪ ወይም የውል ልዩነት ባለቤቱ በሞባይላቸው በአንድ ንክኪ ያጸድቃሉ፤ ፊርማውም ወዲያውኑ በቢሮ ሥርዓት ላይ ይንጸባረቃል።',
        englishCue:
          'Owner completes Step-2 escalation approval on mobile; Maker-Checker hash and AuditEvent sync instantaneously.',
        audienceTakeawayAm: 'ትልቅ የገንዘብ ውሳኔ ያለ ባለቤቱ ፊርማ አይፈጸምም።',
        liveProofLabel: 'Executive Authority',
        liveProofValue: 'Step-2 Owner Sign-Off Recorded',
        uiStateBadge: 'Executive Approved',
        highlightZone: 'owner-signoff',
        durationSec: 20,
      },
    ],
  },
  {
    id: 'demo-erca-tax',
    sceneType: 'erca-tax',
    chapterOrder: '05',
    stakeholders: ['finance', 'gm', 'owner'],
    audienceLabelAm: 'ፋይናንስ ኃላፊ · ዋና ሥራ አስኪያጅ · ባለቤት',
    audienceLabelEn: 'Finance Head · GM · Owner',
    titleEn: 'ERCA 4-Signoff Tax Gate & Encrypted Backup Reconciliation',
    titleAm: 'የERCA 4-ፊርማ የታክስ ቁጥጥር እና የምትኬ (Backup) ማረጋገጫ',
    summaryAm:
      'የአዋጅ 1395/2025 ታክስ ንጽጽር በረቂቅ ሁኔታ እንዴት እንደሚሰራ፣ የ4ቱ ERCA ማረጋገጫዎች ሳይሟሉ Active እንደማይሆን እና ዕለታዊ ምትኬ በSHA-256 እንዴት እንደሚረጋገጥ ያሳያል።',
    summaryEn:
      'Covers Proclamation 1395/2025 draft tax scenario comparison, the mandatory 4-signoff ERCA live activation lock, and AES-256 encrypted backup + restore reconciliation.',
    totalDurationLabel: '1m 20s',
    targetSection: 'tax',
    targetActionLabelAm: 'ወደ ታክስ እና ERCA ቁጥጥር ሂድ',
    targetActionLabelEn: 'Open Live Tax & ERCA Gate',
    keyframes: [
      {
        stepNumber: 1,
        titleEn: 'Proclamation 1395/2025 Scenario Comparison',
        titleAm: 'ደረጃ 1፡ የአዋጅ 1395/2025 የታክስ ስሌት ንጽጽር (በረቂቅ ደረጃ)',
        activeActorEn: 'Tax Engine (NON_FISCAL_DRAFT_ONLY)',
        activeActorAm: 'የታክስ ስሌት ሞተር (ረቂቅ)',
        amharicScript:
          'የፋይናንስ ኃላፊ — ሥርዓቱ በተመሳሳይ የኪራይ ገቢ ላይ የግለሰብ ንብረት (Marginal Bands)፣ የPLC (30%) እና የ20%/35% ቅናሽ አማራጮችን አነጻጽሮ ያሳያል። እስኪጸድቅ ድረስ "ረቂቅ (Non-Fiscal Draft)" ብቻ ነው።',
        englishCue:
          'Computes side-by-side workpaper comparing Marginal Bands vs PLC 30% vs 20%/35% allowances using versioned TaxRulePack.',
        audienceTakeawayAm: 'የታክስ አማካሪው በመረጃ የተደገፈ ውሳኔ እንዲሰጥ ግልጽ ንጽጽር ያቀርባል።',
        liveProofLabel: 'Fiscal Mode',
        liveProofValue: 'NON_FISCAL_DRAFT_ONLY',
        uiStateBadge: 'Workpaper Comparison',
        highlightZone: 'tax-workpaper',
        durationSec: 20,
      },
      {
        stepNumber: 2,
        titleEn: '4-Signoff ERCA Gate Blocks Premature Activation',
        titleAm: 'ደረጃ 2፡ አራቱ የERCA ማረጋገጫዎች ሳይሟሉ ቀጥታ ታክስ አይከፈትም',
        activeActorEn: 'ErcaVerificationGate',
        activeActorAm: 'የERCA ማረጋገጫ መቆለፊያ',
        amharicScript:
          '1) ERCA TIN፣ 2) VAT ሰርተፊኬት፣ 3) የተፈቀደለት የታክስ አማካሪ ፊርማ እና 4) የባለቤቱ የመጨረሻ ፈቃድ ሳይገቡ ማንም ሰው ታክስ ደንብን Active ማድረግ አይችልም።',
        englishCue:
          'Requires TIN + VAT Cert + Licensed Adviser Sign-Off + Owner Activation; missing even 1 blocks TaxRule Active stage.',
        audienceTakeawayAm: 'ሕጋዊ የታክስ ስህተትና የመንግሥት ቅጣትን አስቀድሞ ይከላከላል።',
        liveProofLabel: 'ERCA Sign-Offs',
        liveProofValue: '3 / 4 Verified -> Active Blocked',
        uiStateBadge: '4-Signoff Guard',
        highlightZone: 'erca-gate',
        durationSec: 20,
      },
      {
        stepNumber: 3,
        titleEn: 'AES-256 Encrypted Backup & Secret-Free Manifest',
        titleAm: 'ደረጃ 3፡ በAES-256 የተቆለፈ የዕለት ምትኬ (Backup) ያለ ምስጢር ቃል',
        activeActorEn: 'Backup & Recovery Pipeline',
        activeActorAm: 'የምትኬና ደህንነት መስመር',
        amharicScript:
          'በየቀኑ ዳታቤዙና የሰነድ ማህደሩ በAES-256-CBC ተቆልፎ ይቀመጣል፤ የማረጋገጫ ማኒፌስቱም ምንም ዓይነት የይለፍ ቃል እንዳይዝ በራስ-ሰር ይፈተሻል።',
        englishCue:
          'Dumps PG 16 + document vault, encrypts via AES-256-CBC PBKDF2, and validates zero secret leakage in manifest JSON.',
        audienceTakeawayAm: 'ኮምፒውተር ቢበላሽ ወይም ቢሰረቅ እንኳን መረጃው ተቆልፎና ተጠብቆ ይገኛል።',
        liveProofLabel: 'Backup Encryption',
        liveProofValue: 'AES-256-CBC · SHA-256 Verified',
        uiStateBadge: 'Encrypted Backup',
        highlightZone: 'backup-encrypt',
        durationSec: 20,
      },
      {
        stepNumber: 4,
        titleEn: 'Post-Restore Trial Balance & Audit Chain Drill',
        titleAm: 'ደረጃ 4፡ ምትኬው ሲመለስ ሚዛኑና የኦዲት ሰንሰለቱ 100% ትክክል መሆኑ ይረጋገጣል',
        activeActorEn: 'Reconciliation Verifier',
        activeActorAm: 'የድህረ-ምትኬ ማመሳከሪያ',
        amharicScript:
          'ምትኬው ወደ ሌላ ንጹህ ዳታቤዝ ተመልሶ፣ የTrial Balance ሚዛን፣ የ3-ዮሽ ዋስትና እና የSHA-256 ኦዲት ሰንሰለት በሙሉ 100% ማለፋቸው በየጊዜው ይፈተሻል።',
        englishCue:
          'Automated CI restore drill verifies Trial Balance dr==cr, 3-way deposit match, and unbroken AuditEvent hash chain.',
        audienceTakeawayAm: 'ምትኬ መያዝ ብቻ ሳይሆን መመለስ መቻሉም በማስረጃ ይረጋገጣል።',
        liveProofLabel: 'Restore Drill',
        liveProofValue: 'TB Balanced · Audit Chain 100%',
        uiStateBadge: 'Restore Verified',
        highlightZone: 'restore-verify',
        durationSec: 20,
      },
    ],
  },
];

export function formatAmharicCueHandout(scenarios: DemoScenario[]): string {
  const lines: string[] = [
    '========================================================================',
    'AD-PRMS — የመጀመሪያ የአማርኛ የሥርዓት ማቅረቢያ መመሪያ (Inaugural Presentation Guide)',
    'Audience: ባለቤት (Owner) · ዋና ሥራ አስኪያጅ (GM) · ፋይናንስ ኃላፊ (Finance) · ጸሐፊዎች (Clerks)',
    '========================================================================',
    '',
  ];

  for (const scenario of scenarios) {
    lines.push(`ምዕራፍ ${scenario.chapterOrder}: ${scenario.titleAm}`);
    lines.push(`English Title: ${scenario.titleEn}`);
    lines.push(`Target Audience: ${scenario.audienceLabelAm} (${scenario.audienceLabelEn})`);
    lines.push(`Duration: ${scenario.totalDurationLabel}`);
    lines.push(`Summary: ${scenario.summaryAm}`);
    lines.push('------------------------------------------------------------------------');
    for (const kf of scenario.keyframes) {
      lines.push(`  [${kf.stepNumber}] ${kf.titleAm} (${kf.titleEn})`);
      lines.push(`      Actor: ${kf.activeActorAm}`);
      lines.push(`      Amharic Script: ${kf.amharicScript}`);
      lines.push(`      English Control: ${kf.englishCue}`);
      lines.push(`      Key Proof: ${kf.liveProofLabel} -> ${kf.liveProofValue}`);
      lines.push('');
    }
    lines.push('');
  }

  return lines.join('\n');
}
