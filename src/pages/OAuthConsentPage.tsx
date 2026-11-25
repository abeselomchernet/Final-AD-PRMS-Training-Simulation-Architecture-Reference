import React, { useEffect, useState } from 'react';
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import { AlertTriangle, CheckCircle2, Globe, KeyRound, Lock, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

interface OAuthConsentPageProps {
  initialAuthorizationId?: string;
  onNavigate?: (url: string) => void;
}

type ConsentState =
  | { kind: 'loading' }
  | { kind: 'missing-config' }
  | { kind: 'missing-auth-id' }
  | { kind: 'needs-signin'; authId: string; emailInput: string; otpSent: boolean; message?: string }
  | { kind: 'ready'; details: OAuthAuthorizationDetails }
  | { kind: 'submitting'; details: OAuthAuthorizationDetails; action: 'approve' | 'deny' }
  | { kind: 'error'; message: string };

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Verify your authenticated Supabase operator identity',
  profile: 'Read operator profile name and avatar metadata',
  email: 'Read verified account email address',
  phone: 'Read registered phone identifier',
  offline_access: 'Allow refresh tokens for session continuity (revocable anytime)',
};

function isSafeRedirectUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const OAuthConsentPage: React.FC<OAuthConsentPageProps> = ({
  initialAuthorizationId,
  onNavigate,
}) => {
  const [state, setState] = useState<ConsentState>({ kind: 'loading' });
  const [signInEmail, setSignInEmail] = useState('');
  const [authActionBusy, setAuthActionBusy] = useState(false);

  const navigateTo = (url: string) => {
    if (!isSafeRedirectUrl(url)) {
      setState({ kind: 'error', message: 'Blocked unsafe OAuth redirect URL.' });
      return;
    }
    if (onNavigate) {
      onNavigate(url);
    } else {
      window.location.assign(url);
    }
  };

  const resolveAuthorizationId = (): string => {
    if (initialAuthorizationId) return initialAuthorizationId.trim();
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('authorization_id') || '';
    if (fromUrl.trim()) {
      try {
        sessionStorage.setItem('adprms_pending_oauth_authorization_id', fromUrl.trim());
      } catch {
        // Ignore sessionStorage restriction
      }
      return fromUrl.trim();
    }
    try {
      return sessionStorage.getItem('adprms_pending_oauth_authorization_id') || '';
    } catch {
      return '';
    }
  };

  useEffect(() => {
    let active = true;

    const loadConsent = async () => {
      const client = getSupabaseClient();
      if (!client || !isSupabaseConfigured()) {
        if (active) setState({ kind: 'missing-config' });
        return;
      }

      const authId = resolveAuthorizationId();
      if (!authId) {
        if (active) setState({ kind: 'missing-auth-id' });
        return;
      }

      const { data: sessionRes } = await client.auth.getSession();
      if (!sessionRes.session) {
        if (active) {
          setState({
            kind: 'needs-signin',
            authId,
            emailInput: '',
            otpSent: false,
          });
        }
        return;
      }

      const { data, error } = await client.auth.oauth.getAuthorizationDetails(authId);
      if (!active) return;

      if (error || !data) {
        setState({
          kind: 'error',
          message: error?.message || 'Unable to load OAuth 2.1 authorization request details.',
        });
        return;
      }

      if ('redirect_url' in data && data.redirect_url) {
        try {
          sessionStorage.removeItem('adprms_pending_oauth_authorization_id');
        } catch {
          // Ignore storage error
        }
        navigateTo(data.redirect_url);
        return;
      }

      if ('authorization_id' in data) {
        setState({ kind: 'ready', details: data });
        return;
      }

      setState({ kind: 'error', message: 'Unexpected response from Supabase OAuth 2.1 Server.' });
    };

    void loadConsent();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAuthorizationId]);

  const handleGoogleSignIn = async (authId: string) => {
    const client = getSupabaseClient();
    if (!client) return;
    setAuthActionBusy(true);
    try {
      const redirectTo = `${window.location.origin}/oauth/consent?authorization_id=${encodeURIComponent(authId)}`;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) {
        setState({
          kind: 'needs-signin',
          authId,
          emailInput: signInEmail,
          otpSent: false,
          message: error.message,
        });
      }
    } finally {
      setAuthActionBusy(false);
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent, authId: string) => {
    e.preventDefault();
    const client = getSupabaseClient();
    const cleanEmail = signInEmail.trim();
    if (!client || !cleanEmail) return;
    setAuthActionBusy(true);
    try {
      const emailRedirectTo = `${window.location.origin}/oauth/consent?authorization_id=${encodeURIComponent(authId)}`;
      const { error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo },
      });
      if (error) {
        setState({
          kind: 'needs-signin',
          authId,
          emailInput: cleanEmail,
          otpSent: false,
          message: error.message,
        });
      } else {
        setState({
          kind: 'needs-signin',
          authId,
          emailInput: cleanEmail,
          otpSent: true,
          message: `Verification link sent to ${cleanEmail}. Open it in this browser to resume consent.`,
        });
      }
    } finally {
      setAuthActionBusy(false);
    }
  };

  const handleDecision = async (action: 'approve' | 'deny') => {
    if (state.kind !== 'ready') return;
    const client = getSupabaseClient();
    if (!client) return;

    const details = state.details;
    setState({ kind: 'submitting', details, action });

    const result =
      action === 'approve'
        ? await client.auth.oauth.approveAuthorization(details.authorization_id, {
            skipBrowserRedirect: true,
          })
        : await client.auth.oauth.denyAuthorization(details.authorization_id, {
            skipBrowserRedirect: true,
          });

    if (result.error || !result.data?.redirect_url) {
      setState({
        kind: 'error',
        message: result.error?.message || `Failed to ${action} OAuth authorization request.`,
      });
      return;
    }

    try {
      sessionStorage.removeItem('adprms_pending_oauth_authorization_id');
    } catch {
      // Ignore storage error
    }
    navigateTo(result.data.redirect_url);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B131E] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-2xl shadow-lg overflow-hidden">
        <header className="bg-[#0F233A] text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#166549] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">
                AD-PRMS — OAuth 2.1 AI Client Authorization
              </h1>
              <p className="text-xs text-slate-300">
                ENVIRONMENT: TRAINING / SYNTHETIC DATA ONLY · Zero Live Financial Execution
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] font-semibold">
            Read-Only MCP Phase 1
          </span>
        </header>

        <main className="p-6 space-y-5 text-sm">
          {state.kind === 'loading' && (
            <div className="py-10 text-center text-slate-500 dark:text-slate-400 text-xs">
              Loading OAuth 2.1 authorization request…
            </div>
          )}

          {state.kind === 'missing-config' && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs space-y-1">
              <p className="font-bold">Supabase OAuth Configuration Required</p>
              <p>
                VITE_SUPABASE_URL and publishable key must be configured in Environment Groups before OAuth 2.1 consent can run.
              </p>
            </div>
          )}

          {state.kind === 'missing-auth-id' && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
              <p className="font-bold">Missing OAuth Authorization ID</p>
              <p>
                This page handles redirects from Supabase OAuth 2.1 (/oauth/authorize) containing an{' '}
                <code className="font-mono">authorization_id</code> query parameter. Launch authentication from your MCP client.
              </p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs flex items-start gap-2.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Authorization Request Error</p>
                <p>{state.message}</p>
              </div>
            </div>
          )}

          {state.kind === 'needs-signin' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] text-xs space-y-1.5">
                <p className="font-bold text-[#0F233A] dark:text-slate-100">
                  Sign in with Supabase Operator Identity
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Your authorization request (<span className="font-mono">{state.authId}</span>) is preserved. Authenticate with Supabase Auth to review and authorize the requesting AI client.
                </p>
              </div>

              {state.message && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                  {state.message}
                </div>
              )}

              <button
                type="button"
                disabled={authActionBusy}
                onClick={() => void handleGoogleSignIn(state.authId)}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0F233A] hover:bg-[#163150] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Continue with Google (Supabase Auth)
              </button>

              <form onSubmit={(e) => void handleMagicLinkSignIn(e, state.authId)} className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#233349]">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Or Sign In via Email Verification Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="operator@synthetic.example.et"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-xs"
                  />
                  <button
                    type="submit"
                    disabled={authActionBusy}
                    className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Send Link
                  </button>
                </div>
              </form>
            </div>
          )}

          {(state.kind === 'ready' || state.kind === 'submitting') && (
            <>
              <section className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] text-xs space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Signed-in Operator (Supabase Identity)
                </p>
                <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                  Email: <span className="font-mono">{state.details.user.email}</span>
                </p>
                <p className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                  Supabase UID: {state.details.user.id}
                </p>
              </section>

              <section className="p-4 rounded-xl border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] text-xs space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {state.details.client.logo_uri && isSafeRedirectUrl(state.details.client.logo_uri) ? (
                      <img
                        src={state.details.client.logo_uri}
                        alt={state.details.client.name}
                        className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#152236] flex items-center justify-center">
                        <Globe className="w-5 h-5 text-slate-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm text-[#0F233A] dark:text-slate-100">
                        {state.details.client.name}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        Client ID: {state.details.client.id}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pt-1 space-y-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono break-all">
                  {state.details.client.uri && <p>Website: {state.details.client.uri}</p>}
                  <p>Callback URI: {state.details.redirect_uri}</p>
                </div>
              </section>

              <section className="space-y-2 text-xs">
                <p className="font-bold text-[#0F233A] dark:text-slate-100">
                  Requested OAuth 2.1 Identity Scopes
                </p>
                <ul className="space-y-1.5">
                  {state.details.scope
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((scope) => (
                      <li
                        key={scope}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#152236] border border-slate-200/70 dark:border-[#233349]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400 shrink-0" />
                        <span className="font-mono font-semibold">{scope}</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          — {SCOPE_DESCRIPTIONS[scope] || 'Requested OIDC standard scope'}
                        </span>
                      </li>
                    ))}
                </ul>
              </section>

              <section className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-[#166549] dark:text-emerald-300">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>AD-PRMS Server-Enforced Access Boundary (Non-Overridable)</span>
                </div>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
                  <li>Mode: Read-Only Synthetic Training Data (Phase 1)</li>
                  <li>
                    Permitted tools and owner isolation are resolved strictly by AD-PRMS backend{' '}
                    <code className="font-mono">mcp_actor_bindings</code> + Maker-Checker governance
                  </li>
                  <li>Blocked: All mutations, financial postings, live tax filings, and raw SQLite access</li>
                </ul>
              </section>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <p>
                  Only approve AI clients you explicitly launched. You may immediately revoke this grant anytime from AD-PRMS Administration or Supabase OAuth Grants.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={state.kind === 'submitting'}
                  onClick={() => void handleDecision('deny')}
                  className="px-4 py-2.5 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {state.kind === 'submitting' && state.action === 'deny'
                    ? 'Denying…'
                    : 'Deny Access'}
                </button>
                <button
                  type="button"
                  disabled={state.kind === 'submitting'}
                  onClick={() => void handleDecision('approve')}
                  className="px-5 py-2.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {state.kind === 'submitting' && state.action === 'approve'
                      ? 'Approving…'
                      : 'Approve & Connect Client'}
                  </span>
                </button>
              </div>
            </>
          )}
        </main>

        <footer className="px-6 py-3 bg-[#F8FAFC] dark:bg-[#0F1826] border-t border-[#DFE5EE] dark:border-[#233349] text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>RFC 8707 Audience Isolation + PKCE S256 Enforced</span>
          </span>
          <span>Synthetic Training Fixture Boundary</span>
        </footer>
      </div>
    </div>
  );
};
