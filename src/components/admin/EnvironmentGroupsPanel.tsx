import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  Lock,
  RotateCcw,
  Save,
  Search,
  Server,
  Sliders,
} from 'lucide-react';
import {
  buildDotEnvFileContent,
  buildGroupEnvSnippet,
  ENV_GROUPS,
  ENV_UPDATED_EVENT,
  ENV_VARIABLE_REGISTRY,
  EnvGroupId,
  EnvVariableSpec,
  getAllEffectiveBrowserEnvValues,
  getBrowserEnvSource,
  getInitialServerDraftValues,
  maskSecretValue,
  validateEnvVariableValue,
} from '../../config/environmentRegistry';
import { usePrms } from '../../context/PrmsContext';
import { biText } from '../../data/i18n';
import {
  classifySupabaseKeyFormat,
  getStoredSupabaseAnonKey,
  getStoredSupabaseUrl,
  isSupabaseConfigured,
} from '../../lib/supabase';
import {
  runSupabaseDiagnostics,
  type SupabaseDiagnosticReport,
} from '../../services/supabaseDiagnosticsService';
import { getApiBaseUrl, getAppRuntimeMode } from '../../services/productionApiClient';
import { triggerBlobDownload } from '../../utils/exportDownload';

type ScopeFilter = 'all' | 'browser' | 'server';

export const EnvironmentGroupsPanel: React.FC = () => {
  const {
    currentPersona,
    locale,
    notify,
    saveEnvironmentOverrides,
    resetEnvironmentOverrides,
    logEnvironmentExport,
  } = usePrms();

  const isSystemAdmin = currentPersona.role === 'System Administrator';

  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...getInitialServerDraftValues(),
    ...getAllEffectiveBrowserEnvValues(),
  }));
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copiedGroupId, setCopiedGroupId] = useState<EnvGroupId | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const browserSpecs = useMemo(
    () => ENV_VARIABLE_REGISTRY.filter((spec) => spec.scope === 'browser'),
    []
  );

  const activeOverrideCount = browserSpecs.filter(
    (spec) => getBrowserEnvSource(spec.key) === 'override'
  ).length;

  const savedSupabaseUrl = getStoredSupabaseUrl();
  const savedSupabaseKey = getStoredSupabaseAnonKey();
  const savedSupabaseConfigured = isSupabaseConfigured(savedSupabaseUrl, savedSupabaseKey);
  const savedKeyClassification = classifySupabaseKeyFormat(savedSupabaseKey);
  const [diagReport, setDiagReport] = useState<SupabaseDiagnosticReport | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);

  const runLiveSupabaseCheck = useCallback(async () => {
    setDiagRunning(true);
    try {
      const report = await runSupabaseDiagnostics();
      setDiagReport(report);
    } finally {
      setDiagRunning(false);
    }
  }, []);

  useEffect(() => {
    const canProbeLive =
      typeof window !== 'undefined' &&
      typeof fetch === 'function' &&
      Boolean(window.location?.protocol?.startsWith('http')) &&
      import.meta.env?.MODE !== 'test';

    if (!savedSupabaseConfigured) {
      setDiagReport(null);
      return;
    }
    if (canProbeLive) {
      void runLiveSupabaseCheck();
    }

    const onEnvUpdated = () => {
      if (!isSupabaseConfigured()) {
        setDiagReport(null);
      } else if (canProbeLive) {
        void runLiveSupabaseCheck();
      }
    };
    window.addEventListener(ENV_UPDATED_EVENT, onEnvUpdated);
    return () => {
      window.removeEventListener(ENV_UPDATED_EVENT, onEnvUpdated);
    };
  }, [runLiveSupabaseCheck, savedSupabaseConfigured]);

  const activeRuntimeMode = getAppRuntimeMode();
  const activeApiUrl = getApiBaseUrl();

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ENV_GROUPS.map((group) => {
      const specs = ENV_VARIABLE_REGISTRY.filter((spec) => {
        if (spec.groupId !== group.id) return false;
        if (scopeFilter === 'browser' && spec.scope !== 'browser') return false;
        if (scopeFilter === 'server' && spec.scope === 'browser') return false;
        if (!q) return true;
        return (
          spec.key.toLowerCase().includes(q) ||
          spec.labelEn.toLowerCase().includes(q) ||
          spec.labelAm.toLowerCase().includes(q) ||
          spec.descriptionEn.toLowerCase().includes(q) ||
          group.titleEn.toLowerCase().includes(q)
        );
      });
      return { group, specs };
    }).filter((entry) => entry.specs.length > 0);
  }, [searchQuery, scopeFilter]);

  const handleFieldChange = (spec: EnvVariableSpec, nextVal: string) => {
    setValues((prev) => ({ ...prev, [spec.key]: nextVal }));
    const err = validateEnvVariableValue(spec, nextVal);
    setFieldErrors((prev) => {
      const copy = { ...prev };
      if (err) {
        copy[spec.key] = err;
      } else {
        delete copy[spec.key];
      }
      return copy;
    });
  };

  const handleToggleReveal = (key: string) => {
    if (!isSystemAdmin) return;
    setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveBrowserRuntime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSystemAdmin) {
      saveEnvironmentOverrides({});
      return;
    }

    const nextErrors: Record<string, string> = {};
    for (const spec of browserSpecs) {
      const err = validateEnvVariableValue(spec, values[spec.key] || '');
      if (err) nextErrors[spec.key] = err;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      setStatusBanner({
        tone: 'error',
        text: Object.values(nextErrors)[0],
      });
      return;
    }

    const res = saveEnvironmentOverrides(values);
    if (res.ok) {
      if (isSupabaseConfigured() && import.meta.env?.MODE !== 'test') {
        void runLiveSupabaseCheck();
      } else if (!isSupabaseConfigured()) {
        setDiagReport(null);
      }
      setStatusBanner({
        tone: 'success',
        text:
          res.updatedKeys.length > 0
            ? biText(
                locale,
                `Saved ${res.updatedKeys.length} browser override(s) (${res.updatedKeys.join(', ')}) and logged masked audit entry.`,
                `${res.updatedKeys.length} የብራውዘር ቅንብር(ዎች) ተቀምጠዋል እና በኦዲት መዝገብ ተመዝግበዋል።`
              )
            : biText(
                locale,
                'Browser runtime overrides verified with no changes.',
                'የብራውዘር ቅንብሮች ያለ ለውጥ ተረጋግጠዋል።'
              ),
      });
    } else if (res.errors.length > 0) {
      setStatusBanner({ tone: 'error', text: res.errors[0] });
    }
  };

  const handleClearOverrides = () => {
    const ok = resetEnvironmentOverrides();
    if (!ok) return;
    setValues((prev) => ({
      ...prev,
      ...getAllEffectiveBrowserEnvValues(),
    }));
    setFieldErrors({});
    if (!isSupabaseConfigured()) {
      setDiagReport(null);
    }
    setStatusBanner({
      tone: 'warning',
      text: biText(
        locale,
        'Browser VITE_* overrides cleared. Reverted to build-time / default values.',
        'የብራውዘር ቅንብሮች ተሰርዘዋል፤ ወደ ነባሪ ዋጋዎች ተመልሰዋል።'
      ),
    });
  };

  const validateTargetBeforeExport = (target: 'root' | 'backend'): string[] => {
    const specs = ENV_VARIABLE_REGISTRY.filter((spec) =>
      target === 'root'
        ? spec.scope === 'browser' || spec.scope === 'server-root' || spec.alsoInRootEnv
        : spec.scope === 'server-backend'
    );
    const errors: string[] = [];
    const nextFieldErrors: Record<string, string> = {};
    for (const spec of specs) {
      const err = validateEnvVariableValue(spec, values[spec.key] || '');
      if (err) {
        errors.push(err);
        nextFieldErrors[spec.key] = err;
      }
    }
    if (errors.length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextFieldErrors }));
    }
    return errors;
  };

  const handleDownloadEnv = (target: 'root' | 'backend') => {
    if (!isSystemAdmin) {
      notify({
        tone: 'error',
        title: 'Action Restricted',
        detail: 'Only System Administrator may export deployment environment templates.',
      });
      return;
    }

    const errors = validateTargetBeforeExport(target);
    if (errors.length > 0) {
      setStatusBanner({ tone: 'error', text: errors[0] });
      notify({ tone: 'error', title: 'Validation Error', detail: errors[0] });
      return;
    }

    const content = buildDotEnvFileContent(target, values);
    const filename = target === 'root' ? 'adprms-root.env.txt' : 'adprms-backend.env.txt';
    triggerBlobDownload(new Blob([content], { type: 'text/plain;charset=utf-8' }), filename);
    logEnvironmentExport(
      target,
      `Exported ${target === 'root' ? 'root .env' : 'backend/.env'} template (${filename}).`
    );
    notify({
      tone: 'success',
      title: target === 'root' ? 'Root .env Exported' : 'Backend .env Exported',
      detail: `Downloaded ${filename} with masked audit log entry.`,
    });
  };

  const handleCopyGroupSnippet = async (groupId: EnvGroupId) => {
    if (!isSystemAdmin) return;
    const snippet = buildGroupEnvSnippet(groupId, values);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
      }
      setCopiedGroupId(groupId);
      logEnvironmentExport('snippet', `Copied ${groupId} environment group snippet.`);
      window.setTimeout(() => {
        setCopiedGroupId((curr) => (curr === groupId ? null : curr));
      }, 2000);
    } catch {
      notify({
        tone: 'error',
        title: 'Clipboard Unavailable',
        detail: 'Use Export .env buttons to download formatted environment files.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Overview & Export Action Strip */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#0F233A] dark:text-slate-100 text-balance">
              {biText(
                locale,
                'Environment Groups & Deployment Configuration',
                'የአካባቢ ተለዋዋጮች (Environment Groups) ማዋቀሪያ'
              )}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {biText(
                locale,
                'Manage browser VITE_* overrides (applied immediately) and prepare server Express & Django variables for .env export.',
                'የብራውዘር VITE_* ቅንብሮችን ወዲያውኑ ይተግብሩ፤ የExpress እና Django ተለዋዋጮችን ለ.env ማውጫ ያዘጋጁ።'
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
              <span>{ENV_VARIABLE_REGISTRY.length} Variables</span>
              <span aria-hidden="true">·</span>
              <span>{ENV_GROUPS.length} Service Groups</span>
              <span aria-hidden="true">·</span>
              <span>{activeOverrideCount} Active Browser Overrides</span>
              <span aria-hidden="true">·</span>
              <span>Mode: {activeRuntimeMode}</span>
              <span aria-hidden="true">·</span>
              <span>
                {activeApiUrl
                  ? `API: ${activeApiUrl}`
                  : 'API: Built-in Office SQLite (Default Training Store)'}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  diagReport?.overallStatus === 'connected-and-verified' ||
                  diagReport?.overallStatus === 'schema-ready-unauthenticated'
                    ? 'text-[#166549] dark:text-emerald-400 font-semibold'
                    : diagReport?.overallStatus === 'key-rejected' ||
                        diagReport?.overallStatus === 'unreachable' ||
                        diagReport?.overallStatus === 'prohibited-key'
                      ? 'text-red-700 dark:text-red-300 font-semibold'
                      : 'text-amber-700 dark:text-amber-300 font-semibold'
                }
              >
                {!savedSupabaseConfigured
                  ? 'Supabase: Offline / Key Not Configured'
                  : diagRunning
                    ? 'Supabase: Verifying Connection…'
                    : diagReport
                      ? diagReport.badgeLabel
                      : 'Supabase: Configured (Verification Pending)'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!isSystemAdmin}
              onClick={() => handleDownloadEnv('root')}
              className="min-h-[40px] px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-[#0F233A] dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{biText(locale, 'Export Root .env', 'Root .env አውርድ')}</span>
            </button>
            <button
              type="button"
              disabled={!isSystemAdmin}
              onClick={() => handleDownloadEnv('backend')}
              className="min-h-[40px] px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-[#0F233A] dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              <Server className="w-3.5 h-3.5" />
              <span>{biText(locale, 'Export Backend .env', 'Backend .env አውርድ')}</span>
            </button>
          </div>
        </div>

        {/* Role & Persistence Boundary Notice */}
        {!isSystemAdmin ? (
          <div
            role="status"
            className="rounded-lg border border-amber-300 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-100"
          >
            <Lock className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                {biText(
                  locale,
                  `Read-Only View for ${currentPersona.role}`,
                  `ለ${currentPersona.role} የንባብ ብቻ እይታ`
                )}
              </p>
              <p className="opacity-90">
                {biText(
                  locale,
                  'Only the System Administrator role can edit runtime overrides, reveal secrets, or export .env templates. Sensitive values remain redacted.',
                  'የአካባቢ ተለዋዋጮችን ማስተካከል፣ ሚስጥሮችን ማየት እና .env ማውረድ የሚችለው የSystem Administrator ሚና ብቻ ነው።'
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3.5 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <Sliders className="w-4 h-4 text-[#166549] dark:text-emerald-400 shrink-0 mt-0.5" />
            <p>
              {biText(
                locale,
                'Security boundary: Browser overrides persist only public VITE_* variables locally. Server secrets stay in transient memory for .env export only and are masked in all audit trail entries.',
                'የደህንነት ገደብ፡ ብራውዘር ውስጥ የሚቀመጡት የVITE_* ቅንብሮች ብቻ ናቸው። የሰርቨር ሚስጥሮች ለ.env ማውጫ በጊዜያዊ ማህደረ ትውስታ ብቻ ይቆያሉ እንዲሁም በኦዲት መዝገብ ይሸፈናሉ።'
              )}
            </p>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label={biText(locale, 'Search environment variables', 'የአካባቢ ተለዋዋጮችን ፈልግ')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={biText(
                locale,
                'Filter by key (e.g. VITE_API_BASE_URL, ARIFPAY, DATABASE_URL)...',
                'በቁልፍ ስም ፈልግ (ምሳሌ፡ VITE_API_BASE_URL, ARIFPAY)...'
              )}
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFF5] dark:bg-[#152236] rounded-lg">
            {(
              [
                ['all', biText(locale, 'All Groups', 'ሁሉም ምድቦች')],
                ['browser', biText(locale, 'Browser Runtime', 'የብራውዘር ሩጫ')],
                ['server', biText(locale, 'Server & Django', 'ሰርቨር እና Django')],
              ] as [ScopeFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setScopeFilter(id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  scopeFilter === id
                    ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0F233A] dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {statusBanner && (
          <div
            role="status"
            className={`rounded-lg border p-3 text-xs font-medium flex items-center gap-2 ${
              statusBanner.tone === 'success'
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/35 text-emerald-900 dark:text-emerald-200'
                : statusBanner.tone === 'warning'
                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/35 text-amber-950 dark:text-amber-200'
                  : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/35 text-red-900 dark:text-red-200'
            }`}
          >
            {statusBanner.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}
      </section>

      {/* Empty Search State */}
      {filteredGroups.length === 0 ? (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
            {biText(
              locale,
              'No environment variables match the current filter.',
              'ከአሁኑ ማጣሪያ ጋር የሚዛመድ ተለዋዋጭ አልተገኘም።'
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {biText(
              locale,
              `Clear the search query or switch back to All Groups to view all ${ENV_VARIABLE_REGISTRY.length} acceptable variables.`,
              `ሁሉንም ${ENV_VARIABLE_REGISTRY.length} ተለዋዋጮች ለማየት ፍለጋውን ያጽዱ ወይም ወደ ሁሉም ምድቦች ይመለሱ።`
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setScopeFilter('all');
            }}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#0F233A] dark:bg-[#248F64] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            {biText(locale, 'Reset Filters', 'ማጣሪያዎችን ዳግም አስጀምር')}
          </button>
        </section>
      ) : (
        <form onSubmit={handleSaveBrowserRuntime} className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filteredGroups.map(({ group, specs }) => {
              const isBrowserGroup = group.primaryScope === 'browser';
              return (
                <section
                  key={group.id}
                  className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-4">
                    {/* Group Header */}
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#DFE5EE] dark:border-[#233349]">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                          {locale === 'am' ? group.titleAm : group.titleEn}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {locale === 'am' ? group.subtitleAm : group.subtitleEn}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {specs.length} {specs.length === 1 ? 'Variable' : 'Variables'}
                          <span aria-hidden="true"> · </span>
                          <span
                            className={
                              isBrowserGroup
                                ? 'text-[#166549] dark:text-emerald-400 font-semibold'
                                : 'text-slate-600 dark:text-slate-300'
                            }
                          >
                            {locale === 'am' ? group.scopeLabelAm : group.scopeLabelEn}
                          </span>
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={!isSystemAdmin}
                        onClick={() => void handleCopyGroupSnippet(group.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                      >
                        {copiedGroupId === group.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
                            <span>{biText(locale, 'Copied', 'ተቀድቷል')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{biText(locale, 'Copy .env', '.env ቅዳ')}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Variables List */}
                    <div className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                      {specs.map((spec) => {
                        const rawVal = values[spec.key] ?? '';
                        const isRevealed = Boolean(revealedKeys[spec.key]);
                        const displayVal =
                          !isSystemAdmin && spec.sensitive && rawVal ? maskSecretValue(rawVal) : rawVal;
                        const source =
                          spec.scope === 'browser' ? getBrowserEnvSource(spec.key) : 'default';
                        const errorMsg = fieldErrors[spec.key];

                        return (
                          <div key={spec.key} className="py-3 first:pt-0 last:pb-0 space-y-1.5 text-xs">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <label
                                htmlFor={`env-input-${spec.key}`}
                                className="font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]"
                              >
                                {spec.key}
                              </label>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {spec.key === 'VITE_SUPABASE_ANON_KEY'
                                  ? 'Public Key'
                                  : spec.sensitive
                                    ? 'Secret'
                                    : 'Config'}
                                <span aria-hidden="true"> · </span>
                                {spec.scope === 'browser' ? (
                                  <span
                                    className={
                                      source === 'override'
                                        ? 'text-[#166549] dark:text-emerald-400 font-semibold'
                                        : ''
                                    }
                                  >
                                    {source === 'override'
                                      ? 'Override Active'
                                      : source === 'build'
                                        ? 'Build Env'
                                        : 'Default'}
                                  </span>
                                ) : (
                                  <span>
                                    {spec.alsoInRootEnv ? 'Root & Backend .env' : 'Export Only'}
                                  </span>
                                )}
                              </span>
                            </div>

                            {spec.inputKind === 'select' || spec.inputKind === 'boolean' ? (
                              <select
                                id={`env-input-${spec.key}`}
                                disabled={!isSystemAdmin}
                                value={displayVal || spec.defaultValue}
                                onChange={(e) => handleFieldChange(spec, e.target.value)}
                                className="w-full min-h-[40px] px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {(spec.options || []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : spec.inputKind === 'textarea-pem' ? (
                              <div className="space-y-1.5">
                                <textarea
                                  id={`env-input-${spec.key}`}
                                  rows={2}
                                  disabled={!isSystemAdmin}
                                  readOnly={Boolean(spec.sensitive && !isRevealed && rawVal)}
                                  value={
                                    spec.sensitive && !isRevealed && rawVal
                                      ? maskSecretValue(rawVal)
                                      : displayVal
                                  }
                                  onChange={(e) => handleFieldChange(spec, e.target.value)}
                                  placeholder={spec.placeholder}
                                  className="w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                                {spec.sensitive && isSystemAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleReveal(spec.key)}
                                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {isRevealed ? (
                                      <>
                                        <EyeOff className="w-3 h-3" />
                                        <span>Hide PEM</span>
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-3 h-3" />
                                        <span>Reveal / Edit PEM</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  id={`env-input-${spec.key}`}
                                  type={
                                    spec.sensitive && !isRevealed
                                      ? 'password'
                                      : spec.inputKind === 'number'
                                        ? 'number'
                                        : 'text'
                                  }
                                  disabled={!isSystemAdmin}
                                  value={displayVal}
                                  onChange={(e) => handleFieldChange(spec, e.target.value)}
                                  placeholder={spec.placeholder}
                                  autoComplete="off"
                                  className={`w-full min-h-[40px] px-3 py-2 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono text-xs disabled:opacity-60 disabled:cursor-not-allowed ${
                                    spec.sensitive ? 'pr-10' : ''
                                  }`}
                                />
                                {spec.sensitive && isSystemAdmin && (
                                  <button
                                    type="button"
                                    aria-label={
                                      isRevealed ? `Hide ${spec.key}` : `Show ${spec.key}`
                                    }
                                    onClick={() => handleToggleReveal(spec.key)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer"
                                  >
                                    {isRevealed ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}

                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {locale === 'am' ? spec.descriptionAm : spec.descriptionEn}
                            </p>

                            {errorMsg && (
                              <p
                                role="alert"
                                className="text-[11px] font-semibold text-red-700 dark:text-red-300"
                              >
                                {errorMsg}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {group.id === 'supabase' && (
                      <div className="mt-4 pt-3 border-t border-[#DFE5EE] dark:border-[#233349] space-y-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                              Live Supabase Connectivity, Auth & Schema Verification
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              Key Type:{' '}
                              {savedKeyClassification === 'publishable'
                                ? 'sb_publishable_... (Public Key)'
                                : savedKeyClassification === 'legacy-anon-jwt'
                                  ? 'Legacy Public Anon JWT'
                                  : savedKeyClassification === 'prohibited-secret'
                                    ? 'PROHIBITED SECRET KEY'
                                    : savedKeyClassification === 'empty'
                                      ? 'Unset'
                                      : 'Custom / Unrecognized'}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={diagRunning}
                            onClick={() => void runLiveSupabaseCheck()}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-[#0F233A] dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            <Activity className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
                            <span>
                              {diagRunning ? 'Verifying…' : 'Verify Connection & Schema'}
                            </span>
                          </button>
                        </div>

                        {diagReport && (
                          <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3 space-y-2.5">
                            <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                              {diagReport.badgeLabel}
                            </p>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                              {diagReport.summary}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                              <div className="p-2 rounded bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349]">
                                <p className="font-semibold text-slate-700 dark:text-slate-200">
                                  Auth API: {diagReport.auth.keyAccepted ? 'Accepted' : 'Not Verified'}
                                  {diagReport.auth.httpStatus ? ` (HTTP ${diagReport.auth.httpStatus})` : ''}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  Session:{' '}
                                  {diagReport.auth.sessionActive
                                    ? diagReport.auth.sessionEmail || diagReport.auth.sessionUid
                                    : 'None (Anon)'}
                                </p>
                                {diagReport.auth.providers && (
                                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                    Providers: Email({diagReport.auth.providers.email ? 'on' : 'off'}) · Google(
                                    {diagReport.auth.providers.google ? 'on' : 'off'}) · Phone(
                                    {diagReport.auth.providers.phone ? 'on' : 'off'})
                                  </p>
                                )}
                              </div>
                              <div className="p-2 rounded bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349]">
                                <p className="font-semibold text-slate-700 dark:text-slate-200">
                                  Data API: {diagReport.dataApi.enabled ? 'Enabled' : 'Disabled / Unreachable'}
                                  {diagReport.dataApi.httpStatus ? ` (HTTP ${diagReport.dataApi.httpStatus})` : ''}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  Workspace Sync:{' '}
                                  {diagReport.workspaceSyncOperational
                                    ? 'Operational'
                                    : 'Not Operational'}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  Default Store: Office SQLite
                                </p>
                              </div>
                            </div>

                            {diagReport.tables.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
                                {diagReport.tables.map((tbl) => (
                                  <div
                                    key={tbl.table}
                                    title={tbl.detail}
                                    className={`px-2 py-1 rounded border ${
                                      !tbl.exists
                                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                                        : tbl.accessState === 'anon-exposed'
                                          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200'
                                          : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                                    }`}
                                  >
                                    <span className="font-semibold block truncate">{tbl.table}</span>
                                    <span>
                                      {tbl.accessState === 'missing'
                                        ? 'Missing'
                                        : tbl.accessState === 'anon-exposed'
                                          ? 'Anon Exposed!'
                                          : tbl.accessState === 'authenticated-readable'
                                            ? 'RLS Auth OK'
                                            : tbl.accessState === 'restricted'
                                              ? 'Restricted'
                                              : 'Exists (0 anon)'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Sticky-Free Bottom Action Bar for Browser Overrides */}
          <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              {biText(
                locale,
                'Saving applies browser VITE_* overrides immediately across Supabase, login mode, API client, and WebSocket sync.',
                'ማስቀመጥ የብራውዘር VITE_* ቅንብሮችን ወዲያውኑ በSupabase፣ በመግቢያ፣ በAPI እና በWebSocket ላይ ይተገብራል።'
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!isSystemAdmin || activeOverrideCount === 0}
                onClick={handleClearOverrides}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Clear Browser Overrides', 'የብራውዘር ቅንብሮችን አጽዳ')}</span>
              </button>
              <button
                type="submit"
                disabled={!isSystemAdmin}
                className="min-h-[40px] px-5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Save Browser Overrides', 'የብራውዘር ቅንብሮችን አስቀምጥ')}</span>
              </button>
            </div>
          </section>
        </form>
      )}
    </div>
  );
};
