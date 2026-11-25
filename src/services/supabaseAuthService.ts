import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function sanitizeSupabaseId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return SAFE_ID_PATTERN.test(cleaned) ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

export interface SupabaseAuthenticatedOperator {
  uid: string;
  email: string;
  displayName: string;
  accessToken: string;
}

export async function syncSupabaseUserProfile(user: User): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const displayName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    user.email ||
    'AD-PRMS Operator';

  const { error } = await client.from('users').upsert(
    {
      uid: user.id,
      display_name: displayName.trim().slice(0, 120) || 'Operator',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'uid' }
  );
  if (error) {
    throw new Error(`Supabase profile sync failed: ${error.message}`);
  }

  const email = (user.email || '').trim().slice(0, 254);
  if (email.length >= 3) {
    await client.from('user_private_info').upsert(
      {
        uid: user.id,
        email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'uid' }
    );
  }
}

export function extractOperatorFromSession(session: Session | null): SupabaseAuthenticatedOperator | null {
  const user = session?.user;
  if (!user || !session?.access_token) return null;
  const emailVerified = Boolean(user.email_confirmed_at || user.app_metadata?.provider === 'google');
  if (!emailVerified) return null;
  const displayName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    user.email ||
    'AD-PRMS Operator';

  return {
    uid: sanitizeSupabaseId(user.id, 'uid'),
    email: user.email || '',
    displayName: displayName.trim().slice(0, 120),
    accessToken: session.access_token,
  };
}

export async function signInWithGoogleSupabase(): Promise<SupabaseAuthenticatedOperator> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) {
    throw new Error(
      'Supabase Auth is not configured for this preview environment. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or use Training Simulation / Office Sandbox.'
    );
  }

  const { data: sessionData } = await client.auth.getSession();
  const existingOperator = extractOperatorFromSession(sessionData.session);
  if (existingOperator) {
    await syncSupabaseUserProfile(sessionData.session!.user);
    return existingOperator;
  }

  const redirectTo =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : undefined;

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (error) {
    throw new Error(error.message);
  }

  throw new Error('Redirecting to Google OAuth via Supabase Auth...');
}

export async function requestSupabasePhoneOtp(phone: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth is not configured.');
  }
  const { error } = await client.auth.signInWithOtp({ phone });
  if (error) throw new Error(error.message);
}

export async function verifySupabasePhoneOtp(
  phone: string,
  token: string
): Promise<SupabaseAuthenticatedOperator> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth is not configured.');
  }
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error || !data.session || !data.user) {
    throw new Error(error?.message || 'Unable to verify SMS OTP.');
  }
  await syncSupabaseUserProfile(data.user);
  const operator = extractOperatorFromSession(data.session);
  if (!operator) {
    throw new Error('Verified Supabase session is missing claims.');
  }
  return operator;
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch {
    // Offline/unconfigured clean sign-out
  }
}

export function observeSupabaseAuthReadiness(
  onState: (operator: SupabaseAuthenticatedOperator | null, rawUser: User | null) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    onState(null, null);
    return () => {};
  }

  void client.auth.getSession().then(({ data }) => {
    const op = extractOperatorFromSession(data.session);
    onState(op, data.session?.user ?? null);
  });

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const op = extractOperatorFromSession(session);
    onState(op, session?.user ?? null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
