import React, { useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Maximize2,
  PanelRight,
  X,
} from 'lucide-react';
import { DemoScenario } from '../../data/demoWalkthroughs';
import { biText, UiLocale } from '../../data/i18n';

export type TranscriptDisplayMode = 'side' | 'overlay';

export interface TranscriptPanelProps {
  scenario: DemoScenario;
  activeStepIndex: number;
  locale: UiLocale;
  displayMode: TranscriptDisplayMode;
  onDisplayModeChange: (mode: TranscriptDisplayMode) => void;
  onStepSelect: (stepIndex: number) => void;
  onClose: () => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  scenario,
  activeStepIndex,
  locale,
  displayMode,
  onDisplayModeChange,
  onStepSelect,
  onClose,
}) => {
  const totalSteps = scenario.keyframes.length;
  const isOverlay = displayMode === 'overlay';

  useEffect(() => {
    if (!isOverlay) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDisplayModeChange('side');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOverlay, onDisplayModeChange]);

  const containerClass = isOverlay
    ? 'fixed inset-y-4 right-4 z-50 w-[min(94vw,440px)] flex flex-col rounded-xl border border-[#166549] dark:border-[#248F64] bg-white/95 dark:bg-[#0D1624]/95 backdrop-blur-md shadow-2xl overflow-hidden'
    : 'rounded-xl border border-[#166549]/60 dark:border-[#248F64]/70 bg-white dark:bg-[#111C2C] overflow-hidden shadow-xs flex flex-col';

  const scrollBodyClass = isOverlay
    ? 'flex-1 overflow-y-auto divide-y divide-[#EAEFF5] dark:divide-[#1E2E43]'
    : 'max-h-[460px] overflow-y-auto divide-y divide-[#EAEFF5] dark:divide-[#1E2E43]';

  return (
    <aside
      role={isOverlay ? 'dialog' : 'complementary'}
      aria-modal={isOverlay ? false : undefined}
      data-testid="demo-transcript-panel"
      data-transcript-mode={displayMode}
      aria-label={biText(
        locale,
        'Active Video Amharic-English Transcript',
        'የተመረጠው ቪዲዮ የአማርኛ እና የእንግሊዝኛ ጽሑፍ'
      )}
      className={containerClass}
    >
      {/* Header Bar */}
      <div className="px-4 py-3 bg-[#F6F7F9] dark:bg-[#162438] border-b border-[#DFE5EE] dark:border-[#233349] flex items-start justify-between gap-2 shrink-0">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#166549] dark:text-[#34B684] shrink-0" />
            <h3 className="text-xs font-bold text-[#0F1D2F] dark:text-slate-100 truncate">
              {biText(
                locale,
                `Transcript · Ch. ${scenario.chapterOrder}`,
                `ሙሉ ጽሑፍ · ምዕራፍ ${scenario.chapterOrder}`
              )}
            </h3>
            <span className="font-mono tabular-nums text-[11px] font-semibold text-[#166549] dark:text-[#47C794] shrink-0">
              {activeStepIndex + 1}/{totalSteps}
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
            {biText(locale, scenario.titleEn, scenario.titleAm)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={activeStepIndex <= 0}
            onClick={() => onStepSelect(Math.max(0, activeStepIndex - 1))}
            aria-label={biText(locale, 'Transcript previous step', 'ቀዳሚ የጽሑፍ ደረጃ')}
            className="p-1.5 rounded-md border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={activeStepIndex >= totalSteps - 1}
            onClick={() => onStepSelect(Math.min(totalSteps - 1, activeStepIndex + 1))}
            aria-label={biText(locale, 'Transcript next step', 'ቀጣይ የጽሑፍ ደረጃ')}
            className="p-1.5 rounded-md border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="transcript-layout-mode-btn"
            onClick={() => onDisplayModeChange(isOverlay ? 'side' : 'overlay')}
            title={
              isOverlay
                ? biText(locale, 'Dock as side panel', 'በጎን ፓነል አስቀምጥ')
                : biText(locale, 'Float as overlay', 'ተንሳፋፊ ማያ አድርግ')
            }
            aria-label={
              isOverlay
                ? biText(locale, 'Dock transcript as side panel', 'ጽሑፉን በጎን ፓነል አስቀምጥ')
                : biText(locale, 'Open transcript as floating overlay', 'ጽሑፉን በተንሳፋፊ ማያ ክፈት')
            }
            className="p-1.5 rounded-md border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1D2E47] cursor-pointer"
          >
            {isOverlay ? (
              <PanelRight className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label={biText(locale, 'Close transcript panel', 'የጽሑፍ ፓነል ዝጋ')}
            className="p-1.5 rounded-md border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1D2E47] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Synchronized Steps List (Amharic + English Script) */}
      <div className={scrollBodyClass}>
        {scenario.keyframes.map((kf, idx) => {
          const isCurrent = idx === activeStepIndex;
          return (
            <button
              key={kf.stepNumber}
              type="button"
              data-testid={`transcript-step-${kf.stepNumber}`}
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => onStepSelect(idx)}
              className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer space-y-2 ${
                isCurrent
                  ? 'bg-[#F3FAF6] dark:bg-[#122623]'
                  : 'hover:bg-slate-50 dark:hover:bg-[#162438]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded font-mono tabular-nums text-[11px] font-bold shrink-0 mt-0.5 ${
                      isCurrent
                        ? 'bg-[#166549] text-white'
                        : 'bg-slate-100 dark:bg-[#1D2E47] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {String(kf.stepNumber).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F1D2F] dark:text-slate-100 leading-snug">
                      {biText(locale, kf.titleEn, kf.titleAm)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      {biText(locale, kf.activeActorEn, kf.activeActorAm)} · {kf.durationSec}s
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs leading-relaxed">
                <div className="rounded-md border border-[#EAEFF5] dark:border-[#233349] bg-white/90 dark:bg-[#0D1624] p-2.5 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#166549] dark:text-[#34B684]">
                    አማርኛ (Amharic Script)
                  </p>
                  <p className="text-slate-800 dark:text-slate-100">{kf.amharicScript}</p>
                </div>
                <div className="rounded-md border border-[#EAEFF5] dark:border-[#233349] bg-white/90 dark:bg-[#0D1624] p-2.5 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    English Narrative & Control Cue
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">{kf.englishCue}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Hint */}
      <div className="px-4 py-2 bg-[#F8FAFC] dark:bg-[#0D1624] border-t border-[#EAEFF5] dark:border-[#1E2E43] flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
        <span>
          {biText(locale, 'Click any step to jump', 'ወደ ፈለጉት ደረጃ ይዝለሉ')}
        </span>
        <span>{scenario.totalDurationLabel}</span>
      </div>
    </aside>
  );
};
