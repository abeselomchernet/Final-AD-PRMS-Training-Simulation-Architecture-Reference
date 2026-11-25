import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { TRAINING_EXERCISES } from '../data/trainingCatalog';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { getModuleAccess } from '../policies/rbac';
import { AuditEvent, TrainingExercise } from '../types/prms';
import {
  GovernanceCallout,
  SlideDrawer,
  StatusLabel,
} from '../components/ui/Primitives';

export const TrainingExercisesPage: React.FC = () => {
  const {
    locale,
    currentPersona,
    session,
    activeOwner,
    ownerAuditEvents,
    completedExerciseIds,
    exerciseStepChecks,
    toggleExerciseStep,
    markExerciseComplete,
    setActiveSection,
    fmtDateTime,
  } = usePrms();

  const [filterMode, setFilterMode] = useState<'all' | 'my-role' | 'completed' | 'remaining'>('all');
  const [selectedExId, setSelectedExId] = useState<string>(TRAINING_EXERCISES[0].id);
  const [auditDrawerEvent, setAuditDrawerEvent] = useState<AuditEvent | null>(null);

  const visibleExercises = useMemo(() => {
    return TRAINING_EXERCISES.filter((ex) => {
      const done = completedExerciseIds.includes(ex.id);
      const matchesRole =
        ex.recommendedRole === currentPersona.role ||
        ex.secondaryCheckerRole === currentPersona.role;
      if (filterMode === 'my-role') return matchesRole;
      if (filterMode === 'completed') return done;
      if (filterMode === 'remaining') return !done;
      return true;
    });
  }, [filterMode, completedExerciseIds, currentPersona.role]);

  const selectedExercise: TrainingExercise =
    TRAINING_EXERCISES.find((e) => e.id === selectedExId) || TRAINING_EXERCISES[0];

  const matchingAuditEvents = useMemo(() => {
    return ownerAuditEvents.filter((evt) =>
      selectedExercise.auditMatchKeywords.some(
        (kw) =>
          evt.action.toLowerCase().includes(kw.toLowerCase()) ||
          evt.reason.toLowerCase().includes(kw.toLowerCase())
      )
    );
  }, [ownerAuditEvents, selectedExercise]);

  const stepChecks = exerciseStepChecks[selectedExercise.id] || [];
  const allStepsChecked = stepChecks.length > 0 && stepChecks.every(Boolean);
  const isCompleted = completedExerciseIds.includes(selectedExercise.id);
  const targetAccess = getModuleAccess(currentPersona.role, selectedExercise.targetSection);

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          `Guided Staff Training Exercises — ${activeOwner.name}`,
          `የሰራተኞች የስልጠና ልምምዶች — ${activeOwner.name}`
        )}
        description={biText(
          locale,
          `Signed in as ${session.username} (${currentPersona.role} · ${session.actorId}). Follow any of the ${TRAINING_EXERCISES.length} workflows below, verify Maker-Checker and isolation blocks, and inspect live immutable audit evidence.`,
          `በ ${session.username} (${currentPersona.role} · ${session.actorId}) ገብተዋል። ከታች ያሉትን ${TRAINING_EXERCISES.length} የስራ ሂደቶች በመከተል የቁጥጥር ማስረጃዎችን በኦዲት መዝገብ ያረጋግጡ።`
        )}
        controlType="Prototype Simulation"
      />

      {/* Progress & Filter Header */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F233A] dark:text-slate-100">
            <GraduationCap className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
            <span>
              {biText(
                locale,
                `Curriculum Progress: ${completedExerciseIds.length} of ${TRAINING_EXERCISES.length} Exercises Completed`,
                `የስልጠና ሂደት፡ ${completedExerciseIds.length} ከ ${TRAINING_EXERCISES.length} ልምምዶች ተጠናቀዋል`
              )}
            </span>
          </div>
          <div className="w-full max-w-md h-2 rounded-full bg-[#EAEFF5] dark:bg-[#152236] overflow-hidden">
            <div
              className="h-full bg-[#166549] dark:bg-emerald-500 transition-all"
              style={{
                width: `${Math.round((completedExerciseIds.length / TRAINING_EXERCISES.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              ['all', biText(locale, `All Scenarios (${TRAINING_EXERCISES.length})`, `ሁሉም (${TRAINING_EXERCISES.length})`)],
              ['my-role', biText(locale, `My Role (${currentPersona.role})`, `የእኔ ሚና`)],
              ['completed', biText(locale, `Completed (${completedExerciseIds.length})`, `የተጠናቀቁ (${completedExerciseIds.length})`)],
              ['remaining', biText(locale, `Remaining (${TRAINING_EXERCISES.length - completedExerciseIds.length})`, `የቀሩ (${TRAINING_EXERCISES.length - completedExerciseIds.length})`)],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterMode(id)}
              className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                filterMode === id
                  ? 'bg-[#0F233A] text-white border-[#0F233A] dark:bg-[#248F64] dark:text-white dark:border-[#248F64]'
                  : 'bg-white dark:bg-[#152236] text-slate-700 dark:text-slate-200 border-[#DFE5EE] dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#1D2E48]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Two-Pane Training Workbench */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-5 space-y-2.5">
          {visibleExercises.length === 0 ? (
            <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {biText(locale, 'No exercises match this filter.', 'ከዚህ ማጣሪያ ጋር የሚዛመድ ልምምድ የለም።')}
            </div>
          ) : (
            visibleExercises.map((ex) => {
              const active = ex.id === selectedExId;
              const done = completedExerciseIds.includes(ex.id);
              const forCurrentRole =
                ex.recommendedRole === currentPersona.role ||
                ex.secondaryCheckerRole === currentPersona.role;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedExId(ex.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? 'border-[#166549] dark:border-emerald-500/70 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] hover:bg-[#F8FAFC] dark:hover:bg-[#152236]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-[#E5B85C]">
                      #{String(ex.number).padStart(2, '0')} · {ex.recommendedUsername}
                    </span>
                    <StatusLabel label={done ? 'Completed' : forCurrentRole ? 'In Progress' : 'Not Started'} />
                  </div>
                  <p className="text-xs font-bold text-[#0F233A] dark:text-slate-100 mt-1">
                    {biText(locale, ex.title, ex.titleAm)}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    {biText(locale, 'Role:', 'ሚና:')} {ex.recommendedRole}
                    {ex.secondaryCheckerRole ? ` -> ${ex.secondaryCheckerRole}` : ''}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail & Checklist */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-6 space-y-5 text-xs shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#DFE5EE] dark:border-[#233349]">
            <div>
              <p className="font-mono text-[#166549] dark:text-emerald-400 font-semibold">
                {biText(locale, `Exercise #${selectedExercise.number}`, `ልምምድ #${selectedExercise.number}`)} ·{' '}
                {selectedExercise.id}
              </p>
              <h2 className="text-base font-bold text-[#0F233A] dark:text-slate-100 mt-0.5">
                {biText(locale, selectedExercise.title, selectedExercise.titleAm)}
              </h2>
            </div>
            <StatusLabel label={isCompleted ? 'Completed' : 'In Progress'} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3.5">
            <div>
              <p className="text-slate-500 dark:text-slate-400">
                {biText(locale, 'Recommended Training Account', 'የሚመከር የስልጠና መለያ')}
              </p>
              <p className="font-semibold text-[#0F233A] dark:text-slate-100 mt-0.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400 shrink-0" />
                <span>
                  <span className="font-mono dark:text-[#E5B85C]">{selectedExercise.recommendedUsername}</span> ({selectedExercise.recommendedRole})
                </span>
              </p>
              {selectedExercise.secondaryCheckerUsername && (
                <p className="text-[11px] text-[#9A6712] dark:text-[#E5B85C] mt-0.5">
                  {biText(locale, 'Checker sign-in:', 'የአጽዳቂ መግቢያ:')}{' '}
                  <span className="font-mono font-semibold">{selectedExercise.secondaryCheckerUsername}</span> (
                  {selectedExercise.secondaryCheckerRole})
                </p>
              )}
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">
                {biText(locale, 'Starting Condition', 'መነሻ ሁኔታ')}
              </p>
              <p className="text-slate-800 dark:text-slate-200 mt-0.5">
                {biText(locale, selectedExercise.startingCondition, selectedExercise.startingConditionAm)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-[#0F233A] dark:text-slate-100 mb-1">
              {biText(locale, 'Training Objective', 'የስልጠና ዓላማ')}
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {biText(locale, selectedExercise.objective, selectedExercise.objectiveAm)}
            </p>
          </div>

          {/* Interactive Step Checklist */}
          <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-2.5 bg-[#F8FAFC]/50 dark:bg-[#152236]/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-[#0F233A] dark:text-slate-100 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
                <span>{biText(locale, 'Step-by-Step Guided Checklist', 'የደረጃ በደረጃ ማረጋገጫ ዝርዝር')}</span>
              </h3>
              <button
                type="button"
                disabled={!targetAccess.enabled}
                title={targetAccess.enabled ? undefined : targetAccess.reason}
                onClick={() => setActiveSection(selectedExercise.targetSection)}
                className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173454] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white font-semibold inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <span>{biText(locale, 'Open Target Module', 'ወደ ዒላማው ክፍል ሂድ')}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {!targetAccess.enabled && (
              <p className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/35 border border-[#D9A441]/50 dark:border-amber-700/60 rounded-lg px-2.5 py-1.5">
                {targetAccess.reason} ({biText(locale, 'Sign out and sign in as', 'ውተው በዚህ መለያ ይግቡ:')}{' '}
                <span className="font-mono font-semibold">{selectedExercise.recommendedUsername}</span>)
              </p>
            )}

            <div className="space-y-2 pt-1">
              {selectedExercise.steps.map((step, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] hover:bg-slate-50 dark:hover:bg-[#162438] cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(stepChecks[idx])}
                    onChange={() => toggleExerciseStep(selectedExercise.id, idx)}
                    className="mt-0.5 accent-[#166549]"
                  />
                  <span
                    className={
                      stepChecks[idx]
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-200'
                    }
                  >
                    {idx + 1}. {biText(locale, step.en, step.am)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl p-3.5">
              <p className="font-bold text-emerald-950 dark:text-emerald-200 mb-1">
                {biText(locale, 'Expected Outcome', 'የሚጠበቅ ውጤት')}
              </p>
              <p className="text-emerald-900 dark:text-emerald-100 leading-relaxed">
                {biText(locale, selectedExercise.expectedOutcome, selectedExercise.expectedOutcomeAm)}
              </p>
            </div>
            <div className="border border-red-200 dark:border-red-800/70 bg-red-50/50 dark:bg-red-950/30 rounded-xl p-3.5">
              <p className="font-bold text-red-950 dark:text-red-200 mb-1 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{biText(locale, 'Failed-Control / Block Explanation', 'የቁጥጥር እገዳ ማብራሪያ')}</span>
              </p>
              <p className="text-red-900 dark:text-red-100 leading-relaxed">
                {biText(
                  locale,
                  selectedExercise.failedControlExplanation,
                  selectedExercise.failedControlExplanationAm
                )}
              </p>
            </div>
          </div>

          {/* Live Audit Evidence Matches */}
          <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-2.5 bg-white dark:bg-[#111C2C]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-[#0F233A] dark:text-slate-100">
                {biText(locale, 'Matching Immutable Audit Evidence', 'ተዛማጅ የማይፋቅ የኦዲት ማስረጃ')} (
                {matchingAuditEvents.length})
              </h3>
              <button
                type="button"
                onClick={() => setActiveSection('audit')}
                className="text-[#166549] dark:text-emerald-400 font-semibold hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                {biText(locale, 'Open Full Audit Trail', 'ሙሉ የኦዲት መዝገብ ክፈት')}
              </button>
            </div>

            {matchingAuditEvents.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">
                {biText(
                  locale,
                  'No matching events recorded yet during this session. Execute the steps above to produce live audit evidence.',
                  'እስካሁን ተዛማጅ ክስተት አልተመዘገበም። የኦዲት ማስረጃ ለመፍጠር ከላይ ያሉትን ደረጃዎች ይተግብሩ።'
                )}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#1D2D42] border border-[#DFE5EE] dark:border-[#233349] rounded-lg overflow-hidden">
                {matchingAuditEvents.slice(0, 4).map((evt) => (
                  <div
                    key={evt.id}
                    className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-[#F8FAFC] dark:hover:bg-[#152236] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        <span className="font-mono dark:text-[#E5B85C]">{evt.id}</span> · {evt.action}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {evt.actor} ({evt.actorId}) · {fmtDateTime(evt.timestamp)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAuditDrawerEvent(evt)}
                      className="text-[#166549] dark:text-emerald-400 font-semibold inline-flex items-center gap-1 shrink-0 hover:underline cursor-pointer"
                    >
                      <span>{biText(locale, 'Inspect Evidence', 'ማስረጃ እይ')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DFE5EE] dark:border-[#233349]">
            <span className="text-slate-500 dark:text-slate-400">
              {allStepsChecked
                ? biText(locale, 'All checklist steps verified.', 'ሁሉም ደረጃዎች ተረጋግጠዋል።')
                : biText(locale, 'Check off steps above as you complete them.', 'ሲጨርሱ ደረጃዎቹን ምልክት ያድርጉ።')}
            </span>
            <button
              type="button"
              disabled={isCompleted}
              onClick={() => markExerciseComplete(selectedExercise.id)}
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isCompleted
                  ? biText(locale, 'Exercise Marked Complete', 'ልምምዱ ተጠናቋል')
                  : biText(locale, 'Mark Exercise Complete & Log', 'ልምምዱን አጠናቅቅ እና መዝግብ')}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Audit Evidence Drawer */}
      <SlideDrawer
        open={Boolean(auditDrawerEvent)}
        onClose={() => setAuditDrawerEvent(null)}
        title={auditDrawerEvent ? `Audit Evidence — ${auditDrawerEvent.id}` : ''}
        subtitle={biText(locale, 'Immutable training simulation audit event', 'የማይፋቅ የስልጠና ኦዲት መዝገብ')}
      >
        {auditDrawerEvent && (
          <div className="space-y-4 text-xs">
            <dl className="grid grid-cols-2 gap-3 border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236]">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Timestamp', 'ቀንና ሰዓት')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {fmtDateTime(auditDrawerEvent.timestamp)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Owner Scope', 'የባለቤት ክልል')}
                </dt>
                <dd className="font-mono text-slate-900 dark:text-[#E5B85C] mt-0.5">
                  {auditDrawerEvent.ownerId}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Actor & Actor ID', 'ተጠቃሚ')}
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {auditDrawerEvent.actor} ({auditDrawerEvent.actorId})
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Action', 'እርምጃ')}
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {auditDrawerEvent.action}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Reason', 'ምክንያት')}
                </dt>
                <dd className="text-slate-900 dark:text-slate-200 mt-0.5">
                  {auditDrawerEvent.reason}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
};
