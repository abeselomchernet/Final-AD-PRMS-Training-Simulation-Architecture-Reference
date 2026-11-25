import React, { useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Lock,
  Receipt,
  RotateCcw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { biText, UiLocale } from '../../data/i18n';

export interface MakerCheckerSimulationProps {
  activeStepIndex: number;
  onStepChange: (nextStep: number) => void;
  locale: UiLocale;
}

type CheckerRole = 'Owner' | 'Finance Head' | 'GM';

const CHECKER_ACTORS: Record<CheckerRole, { actorId: string; labelAm: string; labelEn: string }> = {
  Owner: {
    actorId: 'USR-SYNTH-01',
    labelAm: 'ባለቤት (Owner · USR-SYNTH-01)',
    labelEn: 'Owner (USR-SYNTH-01)',
  },
  'Finance Head': {
    actorId: 'USR-SYNTH-03',
    labelAm: 'የፋይናንስ ኃላፊ (Finance Head · USR-SYNTH-03)',
    labelEn: 'Finance Head (USR-SYNTH-03)',
  },
  GM: {
    actorId: 'USR-SYNTH-02',
    labelAm: 'ዋና ሥራ አስኪያጅ (GM · USR-SYNTH-02)',
    labelEn: 'GM (USR-SYNTH-02)',
  },
};

export const MakerCheckerSimulation: React.FC<MakerCheckerSimulationProps> = ({
  activeStepIndex,
  onStepChange,
  locale,
}) => {
  const [txType, setTxType] = useState<'Receipt Void' | 'Expense Proposal'>('Receipt Void');
  const [amountEtb, setAmountEtb] = useState<string>('15,000.00');
  const [reason, setReason] = useState<string>(
    'Duplicate CBE bank slip posted on Unit B1-U104'
  );
  const [selectedChecker, setSelectedChecker] = useState<CheckerRole>('Owner');
  const [selfApprovalTested, setSelfApprovalTested] = useState<boolean>(false);

  const safeStep = Math.max(0, Math.min(activeStepIndex, 3));
  const checkerMeta = CHECKER_ACTORS[selectedChecker];

  const handleSubmitClerkTx = () => {
    setSelfApprovalTested(false);
    onStepChange(1);
  };

  const handleAttemptSelfApproval = () => {
    setSelfApprovalTested(true);
  };

  const handleApproveAsChecker = () => {
    onStepChange(3);
  };

  const handleResetSimulation = () => {
    setSelfApprovalTested(false);
    setTxType('Receipt Void');
    setAmountEtb('15,000.00');
    onStepChange(0);
  };

  const highlightRing = (targetStep: number) =>
    safeStep === targetStep
      ? 'ring-2 ring-[#D9A441] shadow-[0_0_0_4px_rgba(217,164,65,0.16)] border-[#D9A441]'
      : 'border-[#1F3047] opacity-90';

  return (
    <div data-testid="maker-checker-interactive-sim" className="space-y-3">
      {/* Interactive Highlight Progress Guide */}
      <div className="rounded-lg bg-[#0D1826] border border-[#1E3148] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[#D9A441] font-semibold shrink-0">
            {biText(locale, `STEP ${safeStep + 1} HIGHLIGHT:`, `ደረጃ ${safeStep + 1} ትኩረት፡`)}
          </span>
          <span className="text-slate-100 font-medium truncate">
            {safeStep === 0 &&
              biText(
                locale,
                'Clerk (Maker) fills evidence & submits transaction into Pending Approval queue.',
                'ጸሐፊ (Maker) ማስረጃውን አያይዞ ጥያቄውን ወደ ማጽደቂያ ወረፋ ያስገባል።'
              )}
            {safeStep === 1 &&
              biText(
                locale,
                'Test Actor-ID Self-Approval Guard (HTTP 403), then hand off to Owner / Finance Head.',
                'ራስን የማጽደቅ እገዳ (HTTP 403) ይሞክሩና ወደ ባለቤት / ፋይናንስ ኃላፊ ያስተላልፉ።'
              )}
            {safeStep === 2 &&
              biText(
                locale,
                'Owner / Finance Head inspects Before vs. After ledger diff and signs approval.',
                'ባለቤት / ፋይናንስ ኃላፊ ከለውጥ በፊትና በኋላ ልዩነቱን አይተው ያጸድቃሉ።'
              )}
            {safeStep === 3 &&
              biText(
                locale,
                'PR-25 Mirror Reversal posted atomically and locked with SHA-256 audit hash chain.',
                'PR-25 የሂሳብ ማስተካከያ እና SHA-256 የማይጠፋ የኦዲት ሰንሰለት ተመዝግቧል።'
              )}
          </span>
        </div>

        <button
          type="button"
          onClick={handleResetSimulation}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{biText(locale, 'Reset Flow', 'እንደገና ጀምር')}</span>
        </button>
      </div>

      {/* 3-Column Highlighted Role Workflow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Column 1: Clerk Creates Transaction (Step 0 Highlight) */}
        <div className={`rounded-lg border bg-[#101C2C] p-3.5 transition-all space-y-2.5 ${highlightRing(0)}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-[#D9A441]" />
              {biText(locale, '1. Clerk (Maker)', '1. ጸሐፊ (አዘጋጅ)')}
            </span>
            <span className="font-mono text-[11px] text-[#D9A441]">USR-SYNTH-04</span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label
                htmlFor="sim-tx-type"
                className="block text-[11px] text-slate-400 mb-1"
              >
                {biText(locale, 'Transaction Type', 'የግብይት ዓይነት')}
              </label>
              <select
                id="sim-tx-type"
                value={txType}
                onChange={(e) =>
                  setTxType(e.target.value as 'Receipt Void' | 'Expense Proposal')
                }
                disabled={safeStep > 0}
                className="w-full rounded bg-[#0A131E] border border-[#233349] px-2 py-1.5 text-xs text-slate-100 disabled:opacity-75"
              >
                <option value="Receipt Void">Receipt Void (PR-25)</option>
                <option value="Expense Proposal">Expense Proposal (&gt;25k)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">{biText(locale, 'Amount', 'መጠን')}</span>
              <input
                type="text"
                aria-label={biText(locale, 'Transaction amount ETB', 'የብር መጠን')}
                value={amountEtb}
                onChange={(e) => setAmountEtb(e.target.value)}
                disabled={safeStep > 0}
                className="w-28 text-right rounded bg-[#0A131E] border border-[#233349] px-2 py-1 font-mono tabular-nums text-white text-xs disabled:opacity-75"
              />
            </div>

            <div>
              <label htmlFor="sim-reason" className="block text-[11px] text-slate-400 mb-1">
                {biText(locale, 'Mandatory Evidence / Reason', 'ማስረጃና ምክንያት')}
              </label>
              <input
                id="sim-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={safeStep > 0}
                className="w-full rounded bg-[#0A131E] border border-[#233349] px-2 py-1 text-[11px] text-slate-200 disabled:opacity-75"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmitClerkTx}
            disabled={safeStep !== 0}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              safeStep === 0
                ? 'bg-[#D9A441] hover:bg-[#C28A24] text-[#081320] ring-2 ring-[#F3D082]/70'
                : 'bg-[#162438] text-slate-400 cursor-default'
            }`}
          >
            {safeStep === 0 ? (
              <>
                <span>{biText(locale, 'Submit as Clerk (Maker)', 'በጸሐፊ ስም አስገባ')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34B684]" />
                <span>{biText(locale, 'Submitted to Queue', 'ወደ ማጽደቂያ ተልኳል')}</span>
              </>
            )}
          </button>
        </div>

        {/* Column 2: SoD Self-Approval Guard & Owner/Finance Head Checker (Steps 1 & 2 Highlight) */}
        <div
          className={`rounded-lg border p-3.5 transition-all space-y-2.5 ${
            safeStep === 1
              ? 'bg-[#2B1419] ring-2 ring-red-400 border-red-500'
              : safeStep === 2
                ? `bg-[#112A24] ${highlightRing(2)}`
                : 'bg-[#101C2C] border-[#1F3047]'
          }`}
        >
          {safeStep === 1 ? (
            <>
              <div className="flex items-center gap-2 text-red-300 text-xs font-semibold">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                {biText(locale, '2. SoD Self-Approval Guard', '2. ራስን የማጽደቅ መከላከያ')}
              </div>

              <p className="text-[11px] text-red-100/90 leading-relaxed">
                {selfApprovalTested
                  ? biText(
                      locale,
                      'BLOCKED (HTTP 403): makerActorId (USR-SYNTH-04) === checkerActorId. PostgreSQL trigger trg_prevent_self_approval rejected self-approval.',
                      'ታግዷል (HTTP 403)፡ አዘጋጁ (USR-SYNTH-04) ራሱ ማጽደቅ አይችልም።'
                    )
                  : biText(
                      locale,
                      'Request REQ-VOID-2019-01 is pending. Try clicking Self-Approve as Clerk to verify the hard security block.',
                      'ጥያቄው በመጠባበቅ ላይ ነው። ጸሐፊ ራሱ ለማጽደቅ ሲሞክር የሚፈጠረውን እገዳ ይሞክሩ።'
                    )}
              </p>

              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleAttemptSelfApproval}
                  className="w-full py-1.5 px-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                >
                  {biText(locale, 'Test Self-Approve (Blocked 403)', 'ራስን ማጽደቅ ሞክር (403)')}
                </button>
                <button
                  type="button"
                  onClick={() => onStepChange(2)}
                  className="w-full py-1.5 px-2.5 rounded-md bg-[#166549] hover:bg-[#12533C] text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer ring-2 ring-[#47C794]/60"
                >
                  <span>{biText(locale, 'Switch to Owner / Finance Checker', 'ወደ ባለቤት / ፋይናንስ አጽዳቂ እለፍ')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#34B684]" />
                  {biText(locale, '2. Owner / Finance Checker', '2. ባለቤት / ፋይናንስ አጽዳቂ')}
                </span>
                <span className="font-mono text-[11px] text-[#47C794]">{checkerMeta.actorId}</span>
              </div>

              <div>
                <label htmlFor="sim-checker-role" className="block text-[11px] text-slate-400 mb-1">
                  {biText(locale, 'Approving Authority', 'አጽዳቂ ኃላፊ')}
                </label>
                <select
                  id="sim-checker-role"
                  value={selectedChecker}
                  onChange={(e) => setSelectedChecker(e.target.value as CheckerRole)}
                  disabled={safeStep === 3}
                  className="w-full rounded bg-[#0A131E] border border-[#233349] px-2 py-1 text-xs text-slate-100"
                >
                  <option value="Owner">{biText(locale, CHECKER_ACTORS.Owner.labelEn, CHECKER_ACTORS.Owner.labelAm)}</option>
                  <option value="Finance Head">
                    {biText(
                      locale,
                      CHECKER_ACTORS['Finance Head'].labelEn,
                      CHECKER_ACTORS['Finance Head'].labelAm
                    )}
                  </option>
                  <option value="GM">{biText(locale, CHECKER_ACTORS.GM.labelEn, CHECKER_ACTORS.GM.labelAm)}</option>
                </select>
              </div>

              <div className="space-y-1 text-[11px] font-mono">
                <div className="rounded bg-[#0A131E] px-2 py-1 border border-[#1E3148] flex justify-between">
                  <span className="text-slate-400">Before</span>
                  <span className="tabular-nums text-slate-200">Settled · ETB {amountEtb}</span>
                </div>
                <div className="rounded bg-[#0A131E] px-2 py-1 border border-[#1E3148] flex justify-between">
                  <span className="text-slate-400">After</span>
                  <span className="tabular-nums text-[#47C794]">{txType} · Reversed</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApproveAsChecker}
                disabled={safeStep !== 2}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  safeStep === 2
                    ? 'bg-[#248F64] hover:bg-[#1E7A55] text-white ring-2 ring-[#D9A441]'
                    : safeStep === 3
                      ? 'bg-[#122623] text-[#47C794] border border-[#248F64]/50 cursor-default'
                      : 'bg-[#162438] text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {safeStep === 3
                    ? biText(locale, `Approved by ${selectedChecker}`, `በ ${selectedChecker} ጸድቋል`)
                    : biText(
                        locale,
                        `Approve & Sign as ${selectedChecker}`,
                        `በ ${selectedChecker} አጽድቅ`
                      )}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Column 3: Atomic Ledger & Immutable SHA-256 Audit Chain (Step 3 Highlight) */}
        <div
          className={`rounded-lg border p-3.5 transition-all space-y-2.5 ${
            safeStep === 3 ? `bg-[#112A24] ${highlightRing(3)}` : 'bg-[#101C2C] border-[#1F3047]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#34B684]" />
              {biText(locale, '3. PR-25 & Audit Hash', '3. ድርብ ሂሳብ እና ኦዲት')}
            </span>
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">DR 4010 Rental Rev</span>
              <span className="tabular-nums text-white">{amountEtb}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CR 1020 CBE Bank</span>
              <span className="tabular-nums text-white">{amountEtb}</span>
            </div>
            <div className="pt-2 border-t border-[#1E3148] text-[11px] space-y-1">
              <div className="text-slate-400 truncate">
                maker: USR-SYNTH-04 · checker: {safeStep === 3 ? checkerMeta.actorId : 'pending'}
              </div>
              <div className={safeStep === 3 ? 'text-[#47C794]' : 'text-slate-400'}>
                {safeStep === 3
                  ? 'SHA-256: e81b20...c49f (LOCKED)'
                  : biText(locale, 'Status: Awaiting Checker Sign-Off', 'ሁኔታ፡ የአጽዳቂ ፊርማ ይጠበቃል')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
