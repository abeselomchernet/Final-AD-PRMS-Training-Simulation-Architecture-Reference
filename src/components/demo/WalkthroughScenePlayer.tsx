import React from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  QrCode,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { DemoScenario } from '../../data/demoWalkthroughs';
import { biText, UiLocale } from '../../data/i18n';
import { MakerCheckerSimulation } from './MakerCheckerSimulation';

interface WalkthroughScenePlayerProps {
  scenario: DemoScenario;
  activeStepIndex: number;
  locale: UiLocale;
  isPlaying: boolean;
  onStepSelect?: (index: number) => void;
}

export const WalkthroughScenePlayer: React.FC<WalkthroughScenePlayerProps> = ({
  scenario,
  activeStepIndex,
  locale,
  isPlaying,
  onStepSelect,
}) => {
  const safeIndex = Math.max(0, Math.min(activeStepIndex, scenario.keyframes.length - 1));
  const activeKeyframe = scenario.keyframes[safeIndex];

  const renderSceneBody = () => {
    switch (scenario.sceneType) {
      case 'maker-checker':
        return (
          <MakerCheckerSimulation
            activeStepIndex={safeIndex}
            onStepChange={(idx) => onStepSelect?.(idx)}
            locale={locale}
          />
        );
      case 'tenant-collection':
        return <TenantCollectionScene step={safeIndex} locale={locale} />;
      case 'three-way-deposit':
        return <ThreeWayDepositScene step={safeIndex} locale={locale} />;
      case 'owner-mobile':
        return <OwnerMobileScene step={safeIndex} locale={locale} />;
      case 'erca-tax':
        return <ErcaTaxScene step={safeIndex} locale={locale} />;
      default:
        return (
          <MakerCheckerSimulation
            activeStepIndex={safeIndex}
            onStepChange={(idx) => onStepSelect?.(idx)}
            locale={locale}
          />
        );
    }
  };

  return (
    <div
      data-testid="walkthrough-scene-player"
      className="rounded-xl border border-[#233349] bg-[#0B131E] text-slate-100 overflow-hidden shadow-sm"
    >
      {/* Top Theater Window Chrome */}
      <div className="px-4 py-2.5 bg-[#0E1826] border-b border-[#233349] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          </div>
          <span className="text-xs font-mono text-slate-400 truncate">
            AD-PRMS · {scenario.chapterOrder} ·{' '}
            {biText(locale, scenario.titleEn, scenario.titleAm)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="font-mono tabular-nums text-[#D9A441]">
            {biText(
              locale,
              `Step ${safeIndex + 1} / ${scenario.keyframes.length}`,
              `ደረጃ ${safeIndex + 1} / ${scenario.keyframes.length}`
            )}
          </span>
          <span className="text-slate-400 font-medium">
            {isPlaying
              ? biText(locale, 'Playing', 'በመጫወት ላይ')
              : biText(locale, 'Paused', 'ቆሟል')}
          </span>
        </div>
      </div>

      {/* Interactive Simulated Step Nodes */}
      <div className="px-4 py-2.5 bg-[#101C2C] border-b border-[#1E2D42] grid grid-cols-2 sm:grid-cols-4 gap-2">
        {scenario.keyframes.map((kf, idx) => {
          const isCurrent = idx === safeIndex;
          const isCompleted = idx < safeIndex;
          return (
            <button
              key={kf.stepNumber}
              type="button"
              onClick={() => onStepSelect?.(idx)}
              className={`text-left px-2.5 py-2 rounded-lg border transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-[#166549]/25 border-[#248F64] text-white'
                  : isCompleted
                    ? 'bg-[#122236] border-[#233349] text-slate-200 hover:border-slate-500'
                    : 'bg-[#0D1724] border-[#1B2A3E] text-slate-400 hover:text-slate-200 hover:border-[#2C405D]'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[11px] font-mono tabular-nums">
                <span>0{kf.stepNumber}</span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#34B684] shrink-0" />
                ) : isCurrent ? (
                  <span className="text-[#D9A441] font-semibold">ACTIVE</span>
                ) : null}
              </div>
              <p className="text-xs font-medium mt-0.5 line-clamp-1">
                {biText(locale, kf.uiStateBadge, kf.titleAm.replace(/^ደረጃ \d+፡\s*/, ''))}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main 16:9 Simulated UI Viewport */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-[#0D1724] to-[#09111B] min-h-[340px] flex flex-col justify-between gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-[#D9A441] uppercase tracking-wider">
              {biText(locale, activeKeyframe.activeActorEn, activeKeyframe.activeActorAm)}
            </p>
            <h3 className="text-base sm:text-lg font-semibold text-white mt-0.5 leading-snug">
              {biText(locale, activeKeyframe.titleEn, activeKeyframe.titleAm)}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-slate-400">{activeKeyframe.liveProofLabel}</p>
            <p className="text-xs sm:text-sm font-mono font-semibold tabular-nums text-[#47C794]">
              {activeKeyframe.liveProofValue}
            </p>
          </div>
        </div>

        {/* Scene-Specific Interactive Mockup */}
        <div className="flex-1 flex flex-col justify-center">{renderSceneBody()}</div>

        {/* Bottom Subtitle / Audience Takeaway Bar */}
        <div className="pt-3 border-t border-[#1D2D44] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <p className="text-slate-200 font-medium leading-relaxed">
            {locale === 'am'
              ? activeKeyframe.audienceTakeawayAm
              : activeKeyframe.englishCue}
          </p>
          <span className="font-mono text-[11px] text-slate-400 whitespace-nowrap shrink-0">
            {activeKeyframe.highlightZone} · {activeKeyframe.durationSec}s
          </span>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Scene 2: Tenant Rental Collection (Telebirr, ArifPay, CBE Slip)            */
/* -------------------------------------------------------------------------- */
const TenantCollectionScene: React.FC<{ step: number; locale: UiLocale }> = ({ step, locale }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Tenant Mobile Checkout */}
      <div
        className={`rounded-lg border p-3.5 ${
          step === 0 ? 'bg-[#12253A] border-[#D9A441]' : 'bg-[#101C2C] border-[#1F3047]'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-[#D9A441]" />
            {biText(locale, 'Tenant Unit B1-U104', 'የተከራይ ክፍል B1-U104')}
          </span>
          <QrCode className="w-4 h-4 text-slate-300" />
        </div>
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">{biText(locale, 'Monthly Rent', 'ወርሃዊ ኪራይ')}</span>
            <span className="font-mono tabular-nums font-semibold text-white">ETB 24,500.00</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-medium text-center">
            <span className="rounded bg-[#166549]/35 border border-[#248F64]/60 py-1 text-emerald-200">
              Telebirr QR
            </span>
            <span className="rounded bg-[#0A131E] border border-[#233349] py-1 text-slate-300">
              ArifPay
            </span>
            <span className="rounded bg-[#0A131E] border border-[#233349] py-1 text-slate-300">
              CBE Slip
            </span>
          </div>
        </div>
      </div>

      {/* Signed Webhook & Replay Guard */}
      <div
        className={`rounded-lg border p-3.5 ${
          step === 1 ? 'bg-[#112A24] border-[#248F64]' : 'bg-[#101C2C] border-[#1F3047]'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#34B684]" />
            {biText(locale, 'Webhook Security', 'የፊርማ ማረጋገጫ')}
          </span>
          <span className="font-mono text-[11px] text-[#47C794]">HMAC / RSA</span>
        </div>
        <div className="mt-3 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Signature</span>
            <span className="text-[#47C794]">VERIFIED</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Idempotency Nonce</span>
            <span className="text-slate-200">NC-88412-OK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">PR-08 Failed Guard</span>
            <span className="text-slate-200">0 GL Writes</span>
          </div>
        </div>
      </div>

      {/* Double-Entry + Export */}
      <div
        className={`rounded-lg border p-3.5 ${
          step >= 2 ? 'bg-[#112A24] border-[#248F64]' : 'bg-[#101C2C] border-[#1F3047]'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-[#34B684]" />
            {step === 3
              ? biText(locale, 'Settled & Exportable', 'ተመዝግቧል · PDF/Excel')
              : biText(locale, 'Auto GL Posting', 'ድርብ ሂሳብ መዝገብ')}
          </span>
          <span className="font-mono text-[11px] text-slate-300">RCT-2019-0148</span>
        </div>
        <div className="mt-3 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">DR 1020 CBE Bank</span>
            <span className="tabular-nums text-[#47C794]">24,500.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">CR 1200 Tenant AR</span>
            <span className="tabular-nums text-[#47C794]">24,500.00</span>
          </div>
          <div className="pt-2 border-t border-[#1E3148] flex items-center justify-between text-[11px] font-sans">
            <span className="flex items-center gap-1 text-slate-300">
              <Download className="w-3 h-3" />
              {biText(locale, 'PDF Receipt Ready', 'PDF ደረሰኝ ዝግጁ')}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <FileSpreadsheet className="w-3 h-3" />
              .xlsx
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Scene 3: 3-Way Security Deposit Tie-Out & Period Close                     */
/* -------------------------------------------------------------------------- */
const ThreeWayDepositScene: React.FC<{ step: number; locale: UiLocale }> = ({ step, locale }) => {
  const hasMismatch = step === 1;
  const isClosed = step === 3;
  const subledgerAmount = hasMismatch ? 'ETB 1,035,000.00' : 'ETB 1,050,000.00';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-[#233349] bg-[#101C2C] p-3">
          <p className="text-[11px] text-slate-400">
            {biText(locale, '1. Active Lease Register', '1. የውል መዝገብ ድምር')}
          </p>
          <p className="text-base font-mono font-semibold tabular-nums text-white mt-1">
            ETB 1,050,000.00
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            hasMismatch ? 'border-red-500/80 bg-[#2B1419]' : 'border-[#248F64] bg-[#112A24]'
          }`}
        >
          <p className="text-[11px] text-slate-300">
            {biText(locale, '2. DepositMovement Subledger', '2. የዋስትና ንዑስ ሌጀር')}
          </p>
          <p className="text-base font-mono font-semibold tabular-nums text-white mt-1">
            {subledgerAmount}
          </p>
        </div>
        <div className="rounded-lg border border-[#233349] bg-[#101C2C] p-3">
          <p className="text-[11px] text-slate-400">
            {biText(locale, '3. GL Account 2120 Liability', '3. ዋና ሂሳብ GL 2120')}
          </p>
          <p className="text-base font-mono font-semibold tabular-nums text-white mt-1">
            ETB 1,050,000.00
          </p>
        </div>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs ${
          hasMismatch
            ? 'bg-[#2B1419] border-red-500/70 text-red-100'
            : 'bg-[#112A24] border-[#248F64]/80 text-emerald-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 shrink-0" />
          <span className="font-semibold">
            {hasMismatch
              ? biText(
                  locale,
                  'Variance Detected: ETB 15,000.00 -> Period Close BLOCKED',
                  'ልዩነት ተገኝቷል፡ ETB 15,000.00 -> የወር መዝጊያ ታግዷል'
                )
              : isClosed
                ? biText(
                    locale,
                    '3-Way Variance: ETB 0.00 · Period 2019-03 CLOSED & LOCKED',
                    'ልዩነት: ETB 0.00 · የህዳር 2019 ወር ተዘግቶ ተቆልፏል'
                  )
                : biText(
                    locale,
                    '3-Way Reconciliation Balanced · Variance: ETB 0.00 · Clearing 1040 = 0.00',
                    'የ3-ዮሽ ዋስትና ተመሳክሯል · ልዩነት: ETB 0.00 · 1040 = 0.00'
                  )}
          </span>
        </div>
        <span className="font-mono text-[11px]">CHK-3WAY-DEPOSIT</span>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Scene 4: Owner 5-Building Isolation & Out-of-Office Mobile Mode            */
/* -------------------------------------------------------------------------- */
const OwnerMobileScene: React.FC<{ step: number; locale: UiLocale }> = ({ step, locale }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
      <div className="md:col-span-7 rounded-lg border border-[#233349] bg-[#101C2C] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#D9A441]" />
            {biText(locale, 'Abdulwehab Dekebo · 5 Buildings (~100 Units)', 'አብዱልወሃብ ደከቦ · 5 ሕንፃዎች')}
          </span>
          <span className="font-mono text-[11px] text-[#47C794]">OWN-ALPHA</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[11px]">
          {['B1', 'B2', 'B3', 'B4', 'B5'].map((b) => (
            <div key={b} className="rounded bg-[#0A131E] border border-[#1E3148] py-2">
              <div className="text-white font-semibold">{b}</div>
              <div className="text-slate-400 text-[10px]">20 Units</div>
            </div>
          ))}
        </div>
        <div className="rounded bg-[#2B1419]/80 border border-red-800/70 px-3 py-2 text-xs flex items-center justify-between gap-2">
          <span className="text-red-200 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            {biText(locale, 'Abdulwehab Dekebo Trading', 'አብዱልወሃብ ደከቦ ትሬዲንግ')}
          </span>
          <span className="font-mono text-[11px] text-red-300">
            {step === 1 ? 'RLS: 0 Rows Leak' : 'Inter-Entity Blocked'}
          </span>
        </div>
      </div>

      {/* Out-of-Office Mobile Frame */}
      <div
        className={`md:col-span-5 rounded-lg border p-3.5 flex flex-col justify-between ${
          step >= 2 ? 'bg-[#112A24] border-[#248F64]' : 'bg-[#101C2C] border-[#1F3047]'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-[#34B684]" />
            {biText(locale, 'Out-of-Office Mobile', 'የባለቤት ሞባይል ሁነታ')}
          </span>
          <span className="font-mono text-[11px] text-slate-300">390px PWA</span>
        </div>
        <div className="my-2 rounded bg-[#0A131E] border border-[#1E3148] p-2.5 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">{biText(locale, 'Collected Today', 'የዛሬ ገቢ')}</span>
            <span className="font-mono tabular-nums text-[#47C794] font-semibold">
              ETB 184,500.00
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{biText(locale, 'Step-2 Escalation', 'የባለቤት ፊርማ')}</span>
            <span className="font-mono text-[#D9A441]">
              {step === 3 ? 'SIGNED BY OWNER' : '1 Pending (>25k)'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1 text-[10px] text-center text-slate-300 font-medium">
          {['Home', 'Approve', 'Money', 'Ops', 'More'].map((tab) => (
            <span key={tab} className="rounded bg-[#0A131E] py-1 border border-[#1E3148]">
              {tab}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Scene 5: ERCA 4-Signoff Gate & Encrypted Backup Reconciliation             */
/* -------------------------------------------------------------------------- */
const ErcaTaxScene: React.FC<{ step: number; locale: UiLocale }> = ({ step, locale }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Left: Proclamation 1395/2025 & 4-Signoff Gate */}
      <div
        className={`rounded-lg border p-3.5 ${
          step <= 1 ? 'bg-[#12253A] border-[#D9A441]' : 'bg-[#101C2C] border-[#1F3047]'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5 text-[#D9A441]" />
            {biText(locale, 'Proclamation 1395/2025 Gate', 'አዋጅ 1395/2025 · ERCA')}
          </span>
          <span className="font-mono text-[11px] text-[#D9A441]">NON_FISCAL_DRAFT</span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded bg-[#0A131E] border border-[#1E3148] px-2 py-1.5 flex justify-between">
            <span>1. ERCA TIN</span>
            <span className="text-[#47C794]">OK</span>
          </div>
          <div className="rounded bg-[#0A131E] border border-[#1E3148] px-2 py-1.5 flex justify-between">
            <span>2. VAT Cert</span>
            <span className="text-[#47C794]">OK</span>
          </div>
          <div className="rounded bg-[#0A131E] border border-[#1E3148] px-2 py-1.5 flex justify-between">
            <span>3. Adviser</span>
            <span className="text-[#47C794]">OK</span>
          </div>
          <div className="rounded bg-[#0A131E] border border-[#1E3148] px-2 py-1.5 flex justify-between">
            <span>4. Owner Sign</span>
            <span className={step === 1 ? 'text-red-300' : 'text-[#D9A441]'}>
              {step === 1 ? 'BLOCKED' : 'REQUIRED'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: AES-256 Backup & Post-Restore Reconciliation */}
      <div
        className={`rounded-lg border p-3.5 ${
          step >= 2 ? 'bg-[#112A24] border-[#248F64]' : 'bg-[#101C2C] border-[#1F3047]'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#34B684]" />
            {biText(locale, 'AES-256 Backup & Restore Drill', 'የAES-256 ምትኬ እና መመለስ')}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <div className="mt-2.5 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Cipher</span>
            <span className="text-slate-100">AES-256-CBC · PBKDF2</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Secret Scan</span>
            <span className="text-[#47C794]">0 Secrets Exposed</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Restore TB & Audit</span>
            <span className="text-[#47C794]">
              {step === 3 ? '100% VERIFIED' : 'Scheduled Daily'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
