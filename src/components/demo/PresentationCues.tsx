import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import {
  DemoKeyframe,
  DemoScenario,
  DemoStakeholderId,
  formatAmharicCueHandout,
} from '../../data/demoWalkthroughs';
import { biText, UiLocale } from '../../data/i18n';

export interface ChapterTalkingPoints {
  id: 'all' | DemoStakeholderId;
  titleEn: string;
  titleAm: string;
  points: {
    am: string;
    en: string;
  }[];
}

export const CHAPTER_TALKING_POINTS: Record<'all' | DemoStakeholderId, ChapterTalkingPoints> = {
  all: {
    id: 'all',
    titleEn: 'Full Executive Presentation Talking Points',
    titleAm: 'የሙሉ አመራር አቀራረብ ዋና ነጥቦች',
    points: [
      {
        am: 'ሥርዓቱ ለአምስቱ የባለቤቱ ሕንፃዎችና ~100 ክፍሎች ሙሉ የባለቤትነት ክልል ቁጥጥር ይሰጣል።',
        en: 'Single-title-holder governance across all 5 buildings (~100 units) with strict owner isolation.',
      },
      {
        am: 'አንድ ሰው አዘጋጅቶ ራሱ ማጽደቅ አይችልም (Maker-Checker & DB SoD Guard)።',
        en: 'Zero self-approval enforced at both application policy and database trigger level.',
      },
      {
        am: 'ሁሉም የኪራይ ክፍያዎች፣ ዋስትና እና የወር መዝጊያ ከድርብ ሂሳብ መዝገብ ጋር ተሳስረዋል።',
        en: 'Every rent collection, 3-way deposit tie-out, and period close reconciles atomically to GL.',
      },
    ],
  },
  owner: {
    id: 'owner',
    titleEn: 'Owner Chapter Talking Points',
    titleAm: 'የባለቤት (Owner) ምዕራፍ ቁልፍ ነጥቦች',
    points: [
      {
        am: 'የግል ንብረት ኪራይ እና የAbdulwehab Dekebo Trading ሂሳብ በሕጋዊ መንገድ ተለይተው አይደባለቁም።',
        en: 'Rental title-holder ledger is strictly isolated from separate Trading entity until tax clearance.',
      },
      {
        am: 'ከETB 25,000 በላይ ወጪዎችና የወር መዝጊያዎች ያለ ባለቤቱ Step-2 ፊርማ አይፈጸሙም።',
        en: 'High-value disbursements (> ETB 25,000) and sensitive overrides escalate cleanly for Owner sign-off.',
      },
      {
        am: 'ከቢሮ ውጭ ሆነው በOut-of-Office ሞባይል ሁነታ በ5 ቁልፎች የዕለቱን ገቢና ውሳኔዎች ይቆጣጠራሉ።',
        en: 'Out-of-Office Mobile Mode surfaces today’s collections, approvals, and alerts anywhere.',
      },
    ],
  },
  gm: {
    id: 'gm',
    titleEn: 'General Manager (GM) Chapter Talking Points',
    titleAm: 'የዋና ሥራ አስኪያጅ (GM) ምዕራፍ ቁልፍ ነጥቦች',
    points: [
      {
        am: 'በማጽደቂያ ማዕከል (Approvals Centre) ከለውጥ በፊትና በኋላ ያለውን ልዩነት (Before/After) አይተው ይወስናሉ።',
        en: 'Review Before/After JSON diff and attached bank evidence inside the Approvals Centre.',
      },
      {
        am: 'ጸሐፊዎች የሚያቀርቡትን የደረሰኝ ማስተካከያ ያለ ገለልተኛ አጽዳቂ እንዳይፈጸም ይቆጣጠራሉ።',
        en: 'Independent Step-1 verification prevents unauthorized receipt voids or adjustments.',
      },
      {
        am: 'የኢትዮጵያ 13-ወር የሂሳብ ዘመን መዝጊያ ከተቆለፈ በኋላ ወደኋላ መመለስ ይታገዳል።',
        en: 'Closing any Ethiopian accounting period blocks back-dated entries across all modules.',
      },
    ],
  },
  finance: {
    id: 'finance',
    titleEn: 'Finance Head Chapter Talking Points',
    titleAm: 'የፋይናንስ ኃላፊ (Finance Head) ምዕራፍ ቁልፍ ነጥቦች',
    points: [
      {
        am: 'የ3-ዮሽ ዋስትና ማመሳከሪያ (Lease == Subledger == GL 2120) ልዩነት ካለ ወር መዝጋት አይፈቅድም።',
        en: '3-Way Security Deposit tie-out and Account 1040 zero clearing guard block premature close.',
      },
      {
        am: 'የአዋጅ 1395/2025 የታክስ ንጽጽር በረቂቅ (Non-Fiscal Draft) ሆኖ 4 የERCA ፊርማዎች ሳይሟሉ Active አይሆንም።',
        en: 'Proclamation 1395/2025 draft scenarios require all 4 ERCA sign-offs before live activation.',
      },
      {
        am: 'ዕለታዊ AES-256 ምትኬ ሲመለስ የTrial Balance ሚዛን እና የSHA-256 ኦዲት ሰንሰለት 100% ይረጋገጣል።',
        en: 'Encrypted AES-256 backups run post-restore Trial Balance and unbroken hash-chain verification.',
      },
    ],
  },
  clerks: {
    id: 'clerks',
    titleEn: 'Clerk Operations Chapter Talking Points',
    titleAm: 'የጸሐፊዎች (Clerk) ምዕራፍ ቁልፍ ነጥቦች',
    points: [
      {
        am: 'ተከራዮች በቴሌብር QR፣ አሪፍፔይ ወይም CBE ስሊፕ ሲከፍሉ ተከታታይ ደረሰኝና ሂሳብ በራሱ ይመዘገባል።',
        en: 'Telebirr QR, ArifPay HMAC, and CBE slip settlements issue sequential receipts and auto-post GL.',
      },
      {
        am: 'ጸሐፊ የተሳሳተ ደረሰኝ ቢያገኝ በማስረጃ የመሰረዣ ጥያቄ (Maker) ይልካል እንጂ በግሉ አይሰርዝም።',
        en: 'Clerks initiate void/adjustment proposals with evidence; ledger only updates after Checker approval.',
      },
      {
        am: 'ተከራዮች የራሳቸውን የክፍያ ታሪክ በPDF እና በExcel (.xlsx) በቀጥታ ከሞባይል ማውረድ ይችላሉ።',
        en: 'Self-service PDF & Excel receipt downloads cut front-desk queues and paper filing errors.',
      },
    ],
  },
};

export interface PresentationCuesProps {
  activeChapterId: 'all' | DemoStakeholderId;
  scenario: DemoScenario;
  activeKeyframe: DemoKeyframe;
  activeStepIndex: number;
  locale: UiLocale;
  targetAccessEnabled: boolean;
  currentRole: string;
  onJumpToModule: () => void;
  onStepChange: (nextIndex: number) => void;
}

export const PresentationCues: React.FC<PresentationCuesProps> = ({
  activeChapterId,
  scenario,
  activeKeyframe,
  activeStepIndex,
  locale,
  targetAccessEnabled,
  currentRole,
  onJumpToModule,
  onStepChange,
}) => {
  const [showEnglishCue, setShowEnglishCue] = useState<boolean>(true);
  const [copiedCue, setCopiedCue] = useState<boolean>(false);
  const [overlayOpen, setOverlayOpen] = useState<boolean>(false);

  const chapterPoints = CHAPTER_TALKING_POINTS[activeChapterId] || CHAPTER_TALKING_POINTS.all;
  const totalSteps = scenario.keyframes.length;

  useEffect(() => {
    if (!overlayOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOverlayOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [overlayOpen]);

  const handleCopyScript = async () => {
    const text = formatAmharicCueHandout([scenario]);
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedCue(true);
      window.setTimeout(() => setCopiedCue(false), 2200);
    } catch {
      setCopiedCue(false);
    }
  };

  return (
    <>
      <aside
        data-testid="presentation-cues-panel"
        className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] p-5 space-y-4"
      >
        {/* Header + Floating Teleprompter Overlay Toggle */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-mono text-[#C28A24] dark:text-[#D9A441]">
              {biText(
                locale,
                `Chapter ${scenario.chapterOrder} · Step ${activeKeyframe.stepNumber}/${totalSteps}`,
                `ምዕራፍ ${scenario.chapterOrder} · ደረጃ ${activeKeyframe.stepNumber}/${totalSteps}`
              )}
            </p>
            <h3 className="text-base font-bold text-[#0F1D2F] dark:text-slate-100 mt-0.5 leading-snug">
              {biText(locale, activeKeyframe.titleEn, activeKeyframe.titleAm)}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setOverlayOpen((v) => !v)}
              title={biText(
                locale,
                'Open floating presenter teleprompter overlay',
                'ተንሳፋፊ የአቅራቢ ጽሑፍ መስኮት ክፈት'
              )}
              aria-label={biText(
                locale,
                'Toggle Bilingual Presenter Overlay',
                'ተንሳፋፊ የአማርኛ-እንግሊዝኛ ማስታወሻ ክፈት'
              )}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                overlayOpen
                  ? 'bg-[#0F233A] text-white border-[#0F233A] dark:bg-[#248F64] dark:border-[#248F64]'
                  : 'border-[#DFE5EE] dark:border-[#233349] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162438]'
              }`}
            >
              {overlayOpen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleCopyScript}
              title={biText(locale, 'Copy chapter script', 'የምዕራፍ ጽሑፍ ቅዳ')}
              aria-label={biText(locale, 'Copy chapter script', 'የምዕራፍ ጽሑፍ ቅዳ')}
              className="p-2 rounded-lg border border-[#DFE5EE] dark:border-[#233349] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#162438] cursor-pointer"
            >
              {copiedCue ? (
                <Check className="w-4 h-4 text-[#166549] dark:text-[#34B684]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Synchronized Amharic Live Speaking Script */}
        <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0D1724] border border-[#EAEFF5] dark:border-[#1E2E43] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-[#166549] dark:text-[#34B684]">
              <BookOpen className="w-3.5 h-3.5" />
              የአቅራቢው የአማርኛ ንግግር (Amharic Cue)
            </span>
            <span className="font-mono tabular-nums">{activeKeyframe.durationSec}s</span>
          </div>
          <p className="text-sm leading-relaxed text-[#0F1D2F] dark:text-slate-100 font-medium">
            {activeKeyframe.amharicScript}
          </p>
        </div>

        {/* Toggleable English Governance Control Point */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowEnglishCue((v) => !v)}
              className="text-xs font-semibold text-[#0F233A] dark:text-[#47C794] hover:underline cursor-pointer"
            >
              {showEnglishCue
                ? biText(locale, 'Hide English Governance Cue', 'የእንግሊዝኛ ማብራሪያ ደብቅ')
                : biText(locale, 'Show English Governance Cue', 'የእንግሊዝኛ ማብራሪያ አሳይ')}
            </button>
            <button
              type="button"
              onClick={() => setOverlayOpen(true)}
              className="text-xs font-semibold text-[#C28A24] dark:text-[#D9A441] hover:underline cursor-pointer"
            >
              {biText(locale, 'Open Overlay View', 'ተንሳፋፊ ማያ ክፈት')}
            </button>
          </div>

          {showEnglishCue && (
            <div className="rounded-lg border border-[#EAEFF5] dark:border-[#1E2E43] px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Control Point:{' '}
              </span>
              {activeKeyframe.englishCue}
            </div>
          )}
        </div>

        {/* Chapter-Specific Bilingual Executive Talking Points */}
        <div className="pt-3 border-t border-[#EAEFF5] dark:border-[#1E2E43] space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-xs font-bold text-[#0F1D2F] dark:text-slate-100">
              {biText(locale, chapterPoints.titleEn, chapterPoints.titleAm)}
            </h4>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {chapterPoints.points.length} cues
            </span>
          </div>

          <ul className="space-y-2 text-xs">
            {chapterPoints.points.map((pt, idx) => (
              <li
                key={idx}
                className="rounded-lg bg-[#F8FAFC] dark:bg-[#0D1724] border border-[#EAEFF5] dark:border-[#1E2E43] px-3 py-2 space-y-1"
              >
                <p className="font-medium text-[#0F1D2F] dark:text-slate-100 leading-relaxed">
                  {idx + 1}. {pt.am}
                </p>
                {showEnglishCue && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    {pt.en}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Audience Takeaway & Live Proof Readout */}
        <div className="pt-3 border-t border-[#EAEFF5] dark:border-[#1E2E43] space-y-2 text-xs">
          <div>
            <p className="text-slate-500 dark:text-slate-400">
              {biText(locale, 'Audience Takeaway', 'ለተመልካቾች ዋና መልዕክት')}
            </p>
            <p className="font-medium text-[#0F1D2F] dark:text-slate-100 mt-0.5">
              {activeKeyframe.audienceTakeawayAm}
            </p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-500 dark:text-slate-400">
              {activeKeyframe.liveProofLabel}
            </span>
            <span className="font-mono font-semibold tabular-nums text-[#166549] dark:text-[#47C794]">
              {activeKeyframe.liveProofValue}
            </span>
          </div>
        </div>

        {/* Direct Live Workspace Jump */}
        <div className="pt-2">
          <button
            type="button"
            disabled={!targetAccessEnabled}
            onClick={onJumpToModule}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F233A] dark:bg-[#248F64] hover:opacity-95 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>
              {biText(locale, scenario.targetActionLabelEn, scenario.targetActionLabelAm)}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
          {!targetAccessEnabled && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1.5">
              {biText(
                locale,
                `Module restricted for ${currentRole}; switch to GM or Finance Head to open live.`,
                `ይህ ክፍል ለ ${currentRole} የተገደበ ነው፤ በቀጥታ ለመክፈት የዋና ሥራ አስኪያጅ መለያ ይጠቀሙ።`
              )}
            </p>
          )}
        </div>
      </aside>

      {/* Bilingual Live Teleprompter Overlay */}
      {overlayOpen && (
        <div
          role="region"
          aria-label={biText(
            locale,
            'Bilingual Presenter Cues Overlay',
            'የአማርኛ-እንግሊዝኛ አቅራቢ መመሪያ'
          )}
          data-testid="presentation-cues-overlay"
          className="fixed bottom-4 right-4 z-40 w-[min(94vw,460px)] rounded-xl border border-[#248F64]/80 bg-[#0B131E]/95 backdrop-blur-md text-slate-100 shadow-2xl p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-mono tabular-nums text-[#D9A441]">
                {biText(locale, chapterPoints.titleEn, chapterPoints.titleAm)} ·{' '}
                {activeKeyframe.stepNumber}/{totalSteps}
              </p>
              <h4 className="text-sm font-bold text-white mt-0.5 truncate">
                {biText(locale, activeKeyframe.titleEn, activeKeyframe.titleAm)}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setOverlayOpen(false)}
              aria-label={biText(locale, 'Close presenter overlay', 'ተንሳፋፊ ማስታወሻ ዝጋ')}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-lg bg-[#101C2C] border border-[#1E3148] p-3 space-y-2">
            <p className="text-xs sm:text-sm leading-relaxed text-white font-medium">
              {activeKeyframe.amharicScript}
            </p>
            <p className="text-[11px] leading-relaxed text-slate-300 border-t border-[#1E3148] pt-2">
              {activeKeyframe.englishCue}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono tabular-nums text-[#47C794] truncate">
              {activeKeyframe.liveProofValue}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={activeStepIndex <= 0}
                onClick={() => onStepChange(Math.max(0, activeStepIndex - 1))}
                aria-label={biText(locale, 'Overlay previous step', 'ቀዳሚ ደረጃ')}
                className="p-1.5 rounded border border-[#233349] bg-[#101C2C] text-slate-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={activeStepIndex >= totalSteps - 1}
                onClick={() => onStepChange(Math.min(totalSteps - 1, activeStepIndex + 1))}
                aria-label={biText(locale, 'Overlay next step', 'ቀጣይ ደረጃ')}
                className="p-1.5 rounded border border-[#233349] bg-[#101C2C] text-slate-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
