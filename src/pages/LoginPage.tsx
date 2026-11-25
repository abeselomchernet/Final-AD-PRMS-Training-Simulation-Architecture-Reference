import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  UserCheck,
} from 'lucide-react';
import { TENANT_PORTAL_ACCOUNTS, TRAINING_ACCOUNTS } from '../data/trainingCatalog';
import { biText, UI_LABELS } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { useTheme } from '../context/ThemeContext';
import { OwnerId, TrainingAccount } from '../types/prms';
import { StatusLabel, ValidationSummary } from '../components/ui/Primitives';
import { AddisArchitecturalShowcase, BrandEmblem } from '../components/ui/BrandVisuals';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import {
  getApiBaseUrl,
  getAppRuntimeMode,
  loginStaffProduction,
  requestOfficeTenantOtp,
  requestTenantOtp,
  verifyOfficeTenantOtp,
  verifyStaffMfa,
  verifyTenantOtp,
} from '../services/productionApiClient';
import { signInWithGoogleSupabase } from '../services/supabaseAuthService';

export const LoginPage: React.FC = () => {
  const {
    loginWithTrainingAccount,
    loginWithSupabaseOperator,
    loginAsTenant,
    locale,
    setLocale,
  } = usePrms();
  const { theme, toggleTheme } = useTheme();
  const labels = UI_LABELS[locale];

  const runtimeMode = getAppRuntimeMode();
  const apiBaseUrl = getApiBaseUrl();

  const [username, setUsername] = useState(runtimeMode === 'production' ? '' : 'gm.demo');
  const [password, setPassword] = useState(runtimeMode === 'production' ? '' : 'TRAIN-GM-2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<OwnerId>('OWN-ALPHA');
  const [errors, setErrors] = useState<string[]>([]);
  const [authMode, setAuthMode] = useState<'training' | 'production-staff' | 'production-tenant'>(
    runtimeMode === 'production' ? 'production-staff' : 'training'
  );
  const [otpMsisdn, setOtpMsisdn] = useState('+2519');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [mfaChallengeToken, setMfaChallengeToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [prodNotice, setProdNotice] = useState('');
  const [prodBusy, setProdBusy] = useState(false);

  const matchedAccount: TrainingAccount | undefined = useMemo(
    () => TRAINING_ACCOUNTS.find((a) => a.username.toLowerCase() === username.trim().toLowerCase()),
    [username]
  );

  const canPickBeta = matchedAccount ? matchedAccount.allowedOwners.includes('OWN-BETA') : true;
  const effectiveOwnerId: OwnerId = canPickBeta ? selectedOwnerId : 'OWN-ALPHA';

  const handleFillAccount = (acc: TrainingAccount) => {
    setUsername(acc.username);
    setPassword(acc.tempPasswordPlaceholder);
    setSelectedOwnerId(acc.defaultOwnerId);
    setErrors([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: string[] = [];
    if (!username.trim()) {
      nextErrors.push(biText(locale, 'Training username is required.', 'የስልጠና የተጠቃሚ ስም ያስፈልጋል።'));
    }
    if (!password.trim()) {
      nextErrors.push(
        biText(locale, 'Training placeholder password is required.', 'የስልጠና የይለፍ ቃል ያስፈልጋል።')
      );
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    const res = loginWithTrainingAccount(username, password, effectiveOwnerId);
    if (!res.ok && res.error) {
      setErrors([res.error]);
    } else {
      setErrors([]);
    }
  };

  const handleRequestTenantOtp = async () => {
    setErrors([]);
    setProdNotice('');
    setProdBusy(true);
    try {
      if (!getApiBaseUrl()) {
        const res = await requestOfficeTenantOtp(otpMsisdn, locale);
        setOtpSent(true);
        setProdNotice(
          biText(
            locale,
            `Office Sandbox SMS OTP: ${res.sandboxOtpCode} — logged to SQLite SMS Outbox for ${res.msisdn}.`,
            `የቢሮ ሙከራ SMS OTP ኮድ፡ ${res.sandboxOtpCode} — ለ ${res.msisdn} በSQLite SMS መዝገብ ተመዝግቧል።`
          )
        );
        return;
      }
      const res = await requestTenantOtp(otpMsisdn, locale);
      setOtpSent(true);
      setProdNotice(res.detail);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'OTP request failed.']);
    } finally {
      setProdBusy(false);
    }
  };

  const handleVerifyTenantOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setProdBusy(true);
    try {
      if (!getApiBaseUrl()) {
        const res = await verifyOfficeTenantOtp(otpMsisdn, otpCode);
        const matched = TENANT_PORTAL_ACCOUNTS.find(
          (t) => t.username.toLowerCase() === res.account.username.toLowerCase()
        );
        if (!matched) {
          throw new Error('Matched synthetic tenant account not found.');
        }
        const loginRes = loginAsTenant(matched.username, matched.tempPasswordPlaceholder);
        if (!loginRes.ok && loginRes.error) {
          setErrors([loginRes.error]);
        }
        return;
      }
      const res = await verifyTenantOtp(otpMsisdn, otpCode);
      setProdNotice(`Authenticated ${res.user.username} (${res.user.owner_code}).`);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Invalid verification code.']);
    } finally {
      setProdBusy(false);
    }
  };

  const handleProductionStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setProdNotice('');
    if (!getApiBaseUrl()) {
      setErrors([
        biText(
          locale,
          'External Django JWT + MFA is optional and not enabled in Office Test & Training Mode. Use the "Training Simulation" tab to sign in with local SQLite persistence.',
          'የውጭ Django JWT + MFA በቢሮ ሙከራ ሁነታ አይፈለግም። በSQLite ለመግባት "የስልጠና ማስመሰያ" ትሩን ይጠቀሙ።'
        ),
      ]);
      return;
    }
    setProdBusy(true);
    try {
      if (mfaChallengeToken) {
        const verified = await verifyStaffMfa(mfaChallengeToken, totpCode);
        setProdNotice(`Staff MFA verified for ${verified.user.username}.`);
        return;
      }
      const res = await loginStaffProduction(username, password, effectiveOwnerId);
      if (res.mfa_required && res.mfa_challenge_token) {
        setMfaChallengeToken(res.mfa_challenge_token);
        setProdNotice('Enter your 6-digit Authenticator TOTP code to finish sign-in.');
      } else if (res.user) {
        setProdNotice(`Authenticated ${res.user.username} (${res.user.role}).`);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Production authentication failed.']);
    } finally {
      setProdBusy(false);
    }
  };

  const handleGoogleSupabaseLogin = async () => {
    setErrors([]);
    setProdNotice('');
    setProdBusy(true);
    try {
      const operator = await signInWithGoogleSupabase();
      loginWithSupabaseOperator(operator, effectiveOwnerId);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Google sign-in failed.']);
    } finally {
      setProdBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B131E] text-[#0F1D2F] dark:text-slate-100 flex flex-col transition-colors"
      data-locale={locale}
    >
      {/* Persistent Top Training Mode Banner + Theme & Language Controls */}
      <div className="bg-[#141A24] dark:bg-[#060B12] text-amber-50 px-4 py-2 border-b border-[#C28A24]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold tracking-wide text-[#F3D082]">{labels.demoBanner}</span>
        <div className="flex flex-wrap items-center gap-2">
          <PWAInstallButton compact showGuideFallback />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={biText(locale, 'Toggle daylight or dark slate theme', 'የቀን ወይም የምሽት ገጽታ ቀይር')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5 text-[#E5B85C]" /> : <Sun className="w-3.5 h-3.5 text-[#E5B85C]" />}
            <span>{theme === 'light' ? labels.themeDark : labels.themeLight}</span>
          </button>
          <button
            type="button"
            onClick={() => setLocale(locale === 'en' ? 'am' : 'en')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#166549]/90 hover:bg-[#166549] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{locale === 'en' ? 'አማርኛ (Switch to Amharic)' : 'English (Switch to English)'}</span>
          </button>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 space-y-6">
        <div className="w-full max-w-6xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch shadow-xs">
          {/* Left Institutional & Architectural Brief */}
          <div className="lg:col-span-5 bg-[#0D1D30] dark:bg-[#07101B] text-white flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#1F3550]">
            <div>
              <AddisArchitecturalShowcase
                badgeText={biText(locale, 'AD-PRMS · ADDIS ABABA COMMERCIAL REFERENCE', 'AD-PRMS · የአዲስ አበባ ንግድ ንብረት ማሳያ')}
                title={labels.appFull}
                subtitle={biText(
                  locale,
                  'Training Simulation & Architecture Reference',
                  'የስልጠና ማስመሰያ እና የአርክቴክቸር ማጣቀሻ'
                )}
                heightClass="h-44 sm:h-48"
              />

              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <BrandEmblem size="lg" />
                  <div>
                    <p className="text-[11px] font-mono tracking-wider uppercase text-[#E5B85C]">
                      AD-PRMS · TRAINING SIMULATION
                    </p>
                    <p className="text-sm font-semibold text-white mt-0.5">
                      {biText(locale, 'Human-Centered Bilingual Governance', 'ባለሁለት ቋንቋ የንብረት አስተዳደር ሥርዓት')}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed mt-4">
                  {biText(
                    locale,
                    'Bilingual Ethiopian office training environment & UI/UX architecture reference. Demonstrates owner isolation, Actor-ID Maker-Checker gates, Ethiopian/Gregorian calendars, and append-only audit trails.',
                    'ባለሁለት ቋንቋ የኢትዮጵያ ቢሮ የስልጠና አካባቢ እና የUI/UX አርክቴክቸር ማጣቀሻ። የባለቤትነት መረጃ መለያየትን፣ የActor-ID አዘጋጅ-አጽዳቂ ቁጥጥርን፣ የኢትዮጵያ/ግሪጎሪያን ቀንንና የማይፋቅ ኦዲትን ያሳያል።'
                  )}
                </p>

                <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                  <div className="flex items-start gap-3">
                    <Lock className="w-4 h-4 text-[#248F64] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {biText(locale, 'Fixed Session Role (No Mid-Session Switch)', 'በክፍለ-ጊዜው የተወሰነ ሚና')}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {biText(
                          locale,
                          'To test Checker approval or Segregation of Duties, sign out and sign in as another synthetic training account.',
                          'የአጽዳቂ ቁጥጥርን ለመሞከር ከክፍለ-ጊዜው ወጥተው በሌላ የስልጠና መለያ ይግቡ።'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <UserCheck className="w-4 h-4 text-[#E5B85C] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {biText(locale, '10 Configured Roles · SRS & Enterprise Templates', '10 የተዋቀሩ ሚናዎች እና የSRS ቅጾች')}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {biText(
                          locale,
                          'Includes General Manager, Assistant Manager, Finance Officer, and Clerk alongside Owner, System Admin, Auditor, and Trainer.',
                          'ዋና ሥራ አስኪያጅ፣ ረዳት ሥራ አስኪያጅ፣ የፋይናንስ ባለሙያ፣ ጸሐፊ፣ ባለቤት፣ ሲስተም አስተዳዳሪ፣ ኦዲተርና አሰልጣኝ ተካተዋል።'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#248F64] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {biText(locale, 'Separated From Production Architecture', 'ከምርት አርክቴክቸር የተለየ')}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {biText(
                          locale,
                          'Real enforcement belongs exclusively in the separately authorized Django 5.x + PostgreSQL 16 RLS backend.',
                          'እውነተኛው የደህንነት ቁጥጥር በተናጠል በሚጸድቀው Django + PostgreSQL 16 RLS ሰርቨር ውስጥ ብቻ ነው።'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-7 py-4 border-t border-white/10 text-xs text-slate-400">
              <p>
                {biText(
                  locale,
                  'Timezone: Africa/Addis_Ababa · Ethiopian (ዓ.ም) & Gregorian Dual Display',
                  'የሰዓት ዞን፡ Africa/Addis_Ababa · የኢትዮጵያ (ዓ.ም) እና ግሪጎሪያን ቀን'
                )}
              </p>
            </div>
          </div>

          {/* Right Sign-In Panel (Training Default + Live Django OTP/MFA Modes) */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex p-1 rounded-xl bg-[#EAEFF5] dark:bg-[#152236] text-xs">
                  {runtimeMode !== 'production' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('training');
                        setErrors([]);
                        setProdNotice('');
                      }}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        authMode === 'training'
                          ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {biText(locale, 'Training Simulation', 'የስልጠና ማስመሰያ')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('production-staff');
                      setErrors([]);
                      setProdNotice('');
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      authMode === 'production-staff'
                        ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {biText(locale, 'Live Staff (JWT + MFA)', 'የሠራተኛ መግቢያ (MFA)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('production-tenant');
                      setErrors([]);
                      setProdNotice('');
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      authMode === 'production-tenant'
                        ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {biText(locale, 'Tenant Phone OTP', 'የተከራይ ስልክ OTP')}
                  </button>
                </div>
                {!apiBaseUrl && authMode !== 'training' && (
                  <span className="text-[11px] font-mono text-[#166549] dark:text-emerald-300">
                    {authMode === 'production-tenant'
                      ? biText(locale, 'Office Sandbox OTP (SQLite)', 'የቢሮ ሙከራ OTP (SQLite)')
                      : biText(locale, 'Optional External Django Mode', 'አማራጭ የውጭ Django ሁነታ')}
                  </span>
                )}
              </div>

              {prodNotice && (
                <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 text-xs font-medium">
                  {prodNotice}
                </div>
              )}

              {authMode === 'production-tenant' ? (
                <form onSubmit={handleVerifyTenantOtp} className="space-y-4">
                  <ValidationSummary errors={errors} />
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold block mb-1">
                        {biText(locale, 'Registered Ethiopian Phone (+251)', 'የተመዘገበ የኢትዮጵያ ስልክ (+251)')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          autoComplete="tel"
                          value={otpMsisdn}
                          onChange={(e) => setOtpMsisdn(e.target.value)}
                          placeholder="+251911234567"
                          className="flex-1 px-3.5 py-2.5 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg font-mono text-sm"
                        />
                        <button
                          type="button"
                          disabled={prodBusy}
                          onClick={handleRequestTenantOtp}
                          className="px-4 py-2.5 rounded-lg bg-[#0F233A] dark:bg-[#166549] text-white font-semibold cursor-pointer whitespace-nowrap"
                        >
                          {otpSent ? 'Resend OTP' : 'Send SMS OTP'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">
                        {biText(locale, '6-Digit SMS Verification Code', 'ባለ 6 አሃዝ የSMS ማረጋገጫ ኮድ')}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg font-mono text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={prodBusy}
                    className="w-full px-5 py-2.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-sm font-semibold cursor-pointer"
                  >
                    {biText(locale, 'Verify OTP & Open Tenant Portal', 'OTP አረጋግጥ እና ግባ')}
                  </button>
                </form>
              ) : authMode === 'production-staff' ? (
                <form onSubmit={handleProductionStaffLogin} className="space-y-4">
                  {!apiBaseUrl && (
                    <div className="p-3.5 rounded-lg border border-sky-200 dark:border-sky-800/60 bg-sky-50/80 dark:bg-sky-950/25 text-sky-950 dark:text-sky-100 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold">
                          {biText(
                            locale,
                            'Office Test & Training Mode Active (No External Django Server Needed)',
                            'የቢሮ ሙከራና ሥልጠና ሁነታ ንቁ ነው (የውጭ Django ሰርቨር አያስፈልግም)'
                          )}
                        </p>
                        <p className="mt-0.5 text-sky-900 dark:text-sky-200">
                          {biText(
                            locale,
                            'All office test data is persisted locally in built-in Node SQLite. Switch to Training Simulation to sign in immediately.',
                            'ሁሉም የቢሮ መረጃዎች በአካባቢያዊ SQLite ውስጥ ይቀመጣሉ። ወዲያውኑ ለመግባት "የስልጠና ማስመሰያ" ይጠቀሙ።'
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('training');
                          setErrors([]);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#0F233A] dark:bg-[#166549] text-white font-semibold cursor-pointer whitespace-nowrap"
                      >
                        {biText(locale, 'Use Office Test Sign-In', 'ወደ ቢሮ ሙከራ መግቢያ ሂድ')}
                      </button>
                    </div>
                  )}
                  <ValidationSummary errors={errors} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-semibold block mb-1">Staff Username / Email</label>
                      <input
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Password</label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg font-mono text-sm"
                      />
                    </div>
                  </div>
                  {mfaChallengeToken && (
                    <div className="text-xs">
                      <label className="font-semibold block mb-1">Authenticator TOTP Code *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        placeholder="000000"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg font-mono text-sm"
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={prodBusy}
                    className="w-full px-5 py-2.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-sm font-semibold cursor-pointer"
                  >
                    {mfaChallengeToken ? 'Verify MFA & Sign In' : 'Sign In (JWT + TOTP MFA)'}
                  </button>
                  <div className="pt-2 border-t border-[#DFE5EE] dark:border-[#233349]">
                    <button
                      type="button"
                      disabled={prodBusy}
                      onClick={handleGoogleSupabaseLogin}
                      className="w-full px-5 py-2.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-[#0F233A] dark:text-slate-100 text-sm font-semibold cursor-pointer"
                    >
                      {biText(locale, 'Sign in with Google Account', 'በGoogle መለያ ይግቡ')}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="p-3.5 rounded-lg border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="w-4 h-4 text-[#C28A24] dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {biText(
                          locale,
                          'Training authentication only — not production authentication.',
                          'Training authentication only — not production authentication. (ለስልጠና ብቻ — የምርት መግቢያ አይደለም)'
                        )}
                      </p>
                      <p className="mt-0.5 text-amber-900 dark:text-amber-200/90">
                        {biText(
                          locale,
                          'Enter or select a synthetic training account below. Do not enter real staff passwords or sensitive personal information.',
                          'ከታች ካለው ማውጫ ሰው-ሠራሽ የስልጠና መለያ ይምረጡ። እውነተኛ የይለፍ ቃል አያስገቡ።'
                        )}
                      </p>
                    </div>
                  </div>

                  <ValidationSummary errors={errors} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label htmlFor="training-username" className="font-semibold text-slate-700 dark:text-slate-200 block mb-1.5">
                    {biText(locale, 'Training Username *', 'የስልጠና የተጠቃሚ ስም *')}
                  </label>
                  <input
                    id="training-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errors.length) setErrors([]);
                    }}
                    placeholder="e.g. gm.demo"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg font-mono text-sm text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549] dark:focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label htmlFor="training-password" className="font-semibold text-slate-700 dark:text-slate-200 block mb-1.5">
                    {biText(locale, 'Synthetic Training Password *', 'የስልጠና የይለፍ ቃል (ምትክ) *')}
                  </label>
                  <div className="relative">
                    <input
                      id="training-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="off"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.length) setErrors([]);
                      }}
                      placeholder="TRAIN-..."
                      className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg font-mono text-sm text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549] dark:focus:ring-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Matched Role Preview */}
              {matchedAccount && (
                <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F4F6F9] dark:bg-[#162438] p-3.5 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                      {matchedAccount.displayName} — {matchedAccount.role}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      Actor ID: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{matchedAccount.actorId}</span> ·{' '}
                      {matchedAccount.ownerScopeLabel}
                    </p>
                  </div>
                  <StatusLabel label={matchedAccount.accountStatus} />
                </div>
              )}

              {/* Owner Context Selection */}
              <div className="text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-200">
                    {biText(
                      locale,
                      'Session Owner Context (Data Isolation Boundary)',
                      'የክፍለ-ጊዜ ባለቤትነት ክልል (የውሂብ መለያየት ገደብ)'
                    )}
                  </label>
                  {!canPickBeta && (
                    <span className="text-red-700 dark:text-red-300 font-medium">
                      {biText(locale, 'Account locked to Test Owner Alpha', 'መለያው በ Test Owner Alpha የተገደበ ነው')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOwnerId('OWN-ALPHA')}
                    className={`px-3.5 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      effectiveOwnerId === 'OWN-ALPHA'
                        ? 'border-[#166549] bg-[#ECFDF5]/60 text-[#0F233A] dark:border-emerald-500/70 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : 'border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#162438] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1B2B44]'
                    }`}
                  >
                    <p className="font-semibold">Test Owner Alpha (OWN-ALPHA)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      DEMO Property Alpha · 3 Units
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={!canPickBeta}
                    onClick={() => setSelectedOwnerId('OWN-BETA')}
                    className={`px-3.5 py-2.5 rounded-lg border text-left transition-colors ${
                      !canPickBeta
                        ? 'border-[#DFE5EE] dark:border-[#233349] bg-slate-50 dark:bg-[#0F1926] text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        : effectiveOwnerId === 'OWN-BETA'
                          ? 'border-[#166549] bg-[#ECFDF5]/60 text-[#0F233A] dark:border-emerald-500/70 dark:bg-emerald-950/30 dark:text-emerald-100 cursor-pointer'
                          : 'border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#162438] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1B2B44] cursor-pointer'
                    }`}
                  >
                    <p className="font-semibold">Test Owner Beta (OWN-BETA)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      DEMO Property Beta · 1 Unit
                    </p>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-[#DFE5EE] dark:border-[#233349] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 shrink-0 text-[#C28A24]" />
                  <span>
                    {biText(
                      locale,
                      'Logs Training Session Started to owner-scoped Audit Trail',
                      'መግባት በባለቤት የኦዲት መዝገብ ውስጥ ይጻፋል'
                    )}
                  </span>
                </p>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {biText(locale, 'Sign In to Training Session', 'ወደ ስልጠና ክፍለ-ጊዜ ግባ')}
                </button>
              </div>
            </form>
              )}
            </div>
          </div>
        </div>

        {runtimeMode !== 'production' && (
          <>
            {/* Synthetic Training Account Reference Directory */}
            <section className="w-full max-w-6xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                {biText(
                  locale,
                  'Synthetic Training Accounts Directory (Fictional Training Credentials Only)',
                  'ሰው-ሠራሽ የስልጠና መለያዎች ማውጫ (ለስልጠና ብቻ የተዘጋጁ ምትክ የይለፍ ቃላት)'
                )}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {biText(
                  locale,
                  'Select "Use Credentials" to populate the training login form for a role-based walkthrough. Role switching inside an active session is disabled.',
                  'ለሚና-ተኮር ልምምድ መግቢያ ቅጹን ለመሙላት "መለያ ተጠቀም" የሚለውን ይጫኑ። በንቁ ክፍለ-ጊዜ ውስጥ ሚና መቀየር ተከልክሏል።'
                )}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {TRAINING_ACCOUNTS.length} {biText(locale, 'Training Accounts', 'የስልጠና መለያዎች')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Username', 'የተጠቃሚ ስም')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Temp Training Password', 'የስልጠና የይለፍ ቃል')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Role & Classification', 'ሚና እና ምድብ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Actor ID', 'Actor ID')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Owner Scope', 'የባለቤት ክልል')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Action', 'ተግባር')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                {TRAINING_ACCOUNTS.map((acc) => {
                  const selected = acc.username.toLowerCase() === username.trim().toLowerCase();
                  return (
                    <tr
                      key={acc.id}
                      className={
                        selected
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/25'
                          : 'hover:bg-slate-50 dark:hover:bg-[#162438]'
                      }
                    >
                      <td className="py-2.5 px-4 font-mono font-semibold text-[#0F233A] dark:text-slate-100">
                        {acc.username}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {acc.tempPasswordPlaceholder}
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{acc.role}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{acc.classification}</p>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{acc.actorId}</td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{acc.ownerScopeLabel}</td>
                      <td className="py-2.5 px-4">
                        <StatusLabel label={acc.accountStatus} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleFillAccount(acc)}
                          className="px-2.5 py-1 rounded-md border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] text-slate-800 dark:text-slate-200 hover:border-[#166549] hover:text-[#166549] dark:hover:border-emerald-400 dark:hover:text-emerald-300 font-semibold cursor-pointer whitespace-nowrap"
                        >
                          {biText(locale, 'Use Credentials', 'መለያ ተጠቀም')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tenant Self-Service Mobile App Portal */}
        <section className="w-full max-w-6xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#0D1D30] text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-[#E5B85C] shrink-0" />
              <div>
                <h2 className="text-sm font-bold">
                  {biText(
                    locale,
                    'Tenant Self-Service Mobile App Portal (Synthetic Demo Tenants)',
                    'የተከራዮች የራስ-አገልግሎት ሞባይል መግቢያ (ሰው-ሠራሽ የሙከራ ተከራዮች)'
                  )}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {biText(
                    locale,
                    'Strictly isolated to the signed-in tenant’s unit, invoices, Telebirr/ArifPay/CBE payments, repair chat, and notices.',
                    'የገባው ተከራይ የራሱን ክፍል፣ ደረሰኞች፣ የቴሌብር/አሪፍፔይ/ንግድ ባንክ ክፍያዎች፣ የጥገና ውይይትና ማስታወቂያዎችን ብቻ ያያል።'
                  )}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#E5B85C]">
              {TENANT_PORTAL_ACCOUNTS.length} {biText(locale, 'Tenant Accounts', 'የተከራይ መለያዎች')}
            </span>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {TENANT_PORTAL_ACCOUNTS.map((tAcc) => (
              <div
                key={tAcc.id}
                className="rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="font-bold text-[#0F233A] dark:text-slate-100">
                    {tAcc.displayName}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {tAcc.unitLabel}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {tAcc.username} · {tAcc.msisdnPlaceholder}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loginAsTenant(tAcc.username, tAcc.tempPasswordPlaceholder)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{biText(locale, 'Open Tenant Mobile', 'የተከራይ ሞባይል ክፈት')}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
          </>
        )}
      </main>
    </div>
  );
};
