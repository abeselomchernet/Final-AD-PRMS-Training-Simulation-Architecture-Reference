import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  BROWSER_ENV_STORAGE_KEYS,
  dispatchEnvUpdatedEvent,
  getEffectiveBrowserEnvValue,
  getProhibitedBrowserSecretReason,
  isPlaceholderEnvValue,
} from '../config/environmentRegistry';

export type SupabaseKeyClassification =
  | 'empty'
  | 'publishable'
  | 'legacy-anon-jwt'
  | 'prohibited-secret'
  | 'unrecognized';

export function classifySupabaseKeyFormat(key: string): SupabaseKeyClassification {
  const cleanKey = key.trim();
  if (!cleanKey) return 'empty';
  if (getProhibitedBrowserSecretReason('VITE_SUPABASE_ANON_KEY', cleanKey)) {
    return 'prohibited-secret';
  }
  if (cleanKey.startsWith('sb_publishable_')) {
    return 'publishable';
  }
  if (cleanKey.split('.').length === 3 && cleanKey.startsWith('eyJ')) {
    return 'legacy-anon-jwt';
  }
  return 'unrecognized';
}

export function getStoredSupabaseUrl(): string {
  return getEffectiveBrowserEnvValue('VITE_SUPABASE_URL');
}

export function getStoredSupabaseAnonKey(): string {
  return getEffectiveBrowserEnvValue('VITE_SUPABASE_ANON_KEY');
}

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function resetSupabaseClientCache(): void {
  cachedClient = null;
  cachedUrl = '';
  cachedKey = '';
}

export function isSupabaseConfigured(
  url: string = getStoredSupabaseUrl(),
  anonKey: string = getStoredSupabaseAnonKey()
): boolean {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  if (!cleanUrl || !cleanKey) return false;
  if (isPlaceholderEnvValue(cleanUrl) || isPlaceholderEnvValue(cleanKey)) return false;
  if (getProhibitedBrowserSecretReason('VITE_SUPABASE_ANON_KEY', cleanKey)) return false;
  try {
    const parsed = new URL(cleanUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function setSupabaseCredentials(url: string, anonKey: string): void {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  const prohibitedReason = getProhibitedBrowserSecretReason('VITE_SUPABASE_ANON_KEY', cleanKey);
  if (prohibitedReason) {
    throw new Error(prohibitedReason);
  }
  try {
    if (cleanUrl) {
      localStorage.setItem(BROWSER_ENV_STORAGE_KEYS.VITE_SUPABASE_URL, cleanUrl);
    } else {
      localStorage.removeItem(BROWSER_ENV_STORAGE_KEYS.VITE_SUPABASE_URL);
    }
    if (cleanKey) {
      localStorage.setItem(BROWSER_ENV_STORAGE_KEYS.VITE_SUPABASE_ANON_KEY, cleanKey);
    } else {
      localStorage.removeItem(BROWSER_ENV_STORAGE_KEYS.VITE_SUPABASE_ANON_KEY);
    }
  } catch (e) {
    console.error('Failed to save Supabase configuration to localStorage', e);
  }
  resetSupabaseClientCache();
  dispatchEnvUpdatedEvent();
}

export function getSupabaseClient(): SupabaseClient | null {
  const url = getStoredSupabaseUrl();
  const anonKey = getStoredSupabaseAnonKey();
  if (!isSupabaseConfigured(url, anonKey)) {
    resetSupabaseClientCache();
    return null;
  }
  if (!cachedClient || cachedUrl !== url || cachedKey !== anonKey) {
    cachedUrl = url;
    cachedKey = anonKey;
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return cachedClient;
}

