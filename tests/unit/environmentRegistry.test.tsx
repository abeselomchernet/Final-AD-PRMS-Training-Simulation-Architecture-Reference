import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BROWSER_ENV_STORAGE_KEYS,
  buildDotEnvFileContent,
  clearBrowserEnvOverrides,
  ENV_GROUPS,
  ENV_VARIABLE_REGISTRY,
  formatAuditEnvValue,
  maskSecretValue,
  setBrowserEnvOverrides,
  validateEnvVariableValue,
} from '../../src/config/environmentRegistry';
import { PrmsProvider, usePrms } from '../../src/context/PrmsContext';
import { getStoredSupabaseAnonKey, getStoredSupabaseUrl, isSupabaseConfigured } from '../../src/lib/supabase';
import { AdministrationPage } from '../../src/pages/AdministrationPage';
import {
  getApiBaseUrl,
  getAppRuntimeMode,
  getVapidPublicKey,
  getWsBaseUrl,
  isProductionApiConfigured,
} from '../../src/services/productionApiClient';

const AdminHarness: React.FC = () => {
  const { loginWithTrainingAccount, ownerAuditEvents } = usePrms();
  return (
    <div>
      <button
        type="button"
        onClick={() => loginWithTrainingAccount('gm.demo', 'TRAIN-GM-2026!')}
      >
        Sign In GM
      </button>
      <button
        type="button"
        onClick={() => loginWithTrainingAccount('sysadmin.demo', 'TRAIN-SYS-2026!')}
      >
        Sign In SysAdmin
      </button>
      <div data-testid="latest-audit-action">
        {ownerAuditEvents[0]?.action || 'none'}
      </div>
      <div data-testid="latest-audit-after">
        {JSON.stringify(ownerAuditEvents[0]?.afterValues || {})}
      </div>
      <AdministrationPage />
    </div>
  );
};

describe('Environment Groups Registry, Dynamic Getters & System Admin RBAC', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('registers all 7 service groups and all acceptable client, Express, and Django variables', () => {
    expect(ENV_GROUPS.map((g) => g.id)).toEqual([
      'supabase',
      'frontend',
      'express',
      'django',
      'storage',
      'gateways',
      'fiscal',
    ]);

    const keys = new Set(ENV_VARIABLE_REGISTRY.map((v) => v.key));
    [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_APP_MODE',
      'VITE_API_BASE_URL',
      'VITE_WS_BASE_URL',
      'VITE_VAPID_PUBLIC_KEY',
      'APP_URL',
      'PORT',
      'HOST',
      'OFFICE_DB_PATH',
      'OFFICE_SESSION_SECRET',
      'ALLOWED_VITE_HOSTS',
      'GEMINI_API_KEY',
      'DJANGO_ENV',
      'DJANGO_SETTINGS_MODULE',
      'DJANGO_SECRET_KEY',
      'DJANGO_DEBUG',
      'DJANGO_ALLOWED_HOSTS',
      'CORS_ALLOWED_ORIGINS',
      'CSRF_TRUSTED_ORIGINS',
      'SECURE_SSL_REDIRECT',
      'FIELD_ENCRYPTION_KEY',
      'DATABASE_URL',
      'REDIS_URL',
      'STORAGE_BACKEND',
      'AWS_STORAGE_BUCKET_NAME',
      'AWS_S3_REGION_NAME',
      'AWS_S3_ENDPOINT_URL',
      'GS_BUCKET_NAME',
      'VAPID_PUBLIC_KEY',
      'VAPID_PRIVATE_KEY',
      'VAPID_SUBJECT',
      'ENABLE_LIVE_GATEWAYS',
      'ARIFPAY_API_KEY',
      'ARIFPAY_WEBHOOK_SECRET',
      'ARIFPAY_BASE_URL',
      'TELEBIRR_FABRIC_APP_ID',
      'TELEBIRR_APP_SECRET',
      'TELEBIRR_MERCHANT_CODE',
      'TELEBIRR_PRIVATE_KEY_PEM',
      'TELEBIRR_PUBLIC_KEY_PEM',
      'TELEBIRR_BASE_URL',
      'SMS_PROVIDER',
      'SMS_API_KEY',
      'SMS_SENDER_ID',
      'ENABLE_LIVE_TAX_INVOICING',
    ].forEach((requiredKey) => {
      expect(keys.has(requiredKey)).toBe(true);
    });
  });

  it('persists only browser VITE_* overrides to localStorage and applies dynamic getters immediately', () => {
    expect(getAppRuntimeMode()).toBe('training');
    expect(getApiBaseUrl()).toBe('');
    expect(getWsBaseUrl()).toBe('');
    expect(isProductionApiConfigured()).toBe(false);

    setBrowserEnvOverrides({
      VITE_APP_MODE: 'production',
      VITE_API_BASE_URL: 'https://api.prms.example.et/',
      VITE_WS_BASE_URL: 'wss://api.prms.example.et/',
      VITE_VAPID_PUBLIC_KEY: 'BTestVapidKey123',
      VITE_SUPABASE_URL: 'https://vzjojdnttsfdwynumxtv.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_test_public_key_1234',
      DJANGO_SECRET_KEY: 'must-never-persist-in-localstorage',
      GEMINI_API_KEY: 'must-never-persist-in-localstorage',
      DATABASE_URL: 'postgres://secret:pass@db:5432/prms',
    });

    expect(getAppRuntimeMode()).toBe('production');
    expect(getApiBaseUrl()).toBe('https://api.prms.example.et');
    expect(getWsBaseUrl()).toBe('wss://api.prms.example.et');
    expect(getVapidPublicKey()).toBe('BTestVapidKey123');
    expect(getStoredSupabaseUrl()).toBe('https://vzjojdnttsfdwynumxtv.supabase.co');
    expect(getStoredSupabaseAnonKey()).toBe('sb_publishable_test_public_key_1234');
    expect(isSupabaseConfigured()).toBe(true);
    expect(isProductionApiConfigured()).toBe(true);

    // Ensure non-VITE server keys and sb_secret_/DB passwords never persist in localStorage
    setBrowserEnvOverrides({
      VITE_SUPABASE_ANON_KEY: 'sb_secret_must_never_persist',
    });
    expect(getStoredSupabaseAnonKey()).toBe('sb_publishable_test_public_key_1234');
    expect(localStorage.getItem('DJANGO_SECRET_KEY')).toBeNull();
    expect(localStorage.getItem('GEMINI_API_KEY')).toBeNull();
    expect(localStorage.getItem('DATABASE_URL')).toBeNull();
    expect(Object.keys(localStorage).every((k) => Object.values(BROWSER_ENV_STORAGE_KEYS).includes(k))).toBe(true);

    clearBrowserEnvOverrides();
    expect(getAppRuntimeMode()).toBe('training');
    expect(getApiBaseUrl()).toBe('');
    expect(getWsBaseUrl()).toBe('');
    expect(getStoredSupabaseUrl()).toBe('https://vzjojdnttsfdwynumxtv.supabase.co');
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('validates unsafe schemes, ports, prohibited server secrets, and masks sensitive keys', () => {
    const apiSpec = ENV_VARIABLE_REGISTRY.find((v) => v.key === 'VITE_API_BASE_URL')!;
    const wsSpec = ENV_VARIABLE_REGISTRY.find((v) => v.key === 'VITE_WS_BASE_URL')!;
    const portSpec = ENV_VARIABLE_REGISTRY.find((v) => v.key === 'PORT')!;
    const anonSpec = ENV_VARIABLE_REGISTRY.find((v) => v.key === 'VITE_SUPABASE_ANON_KEY')!;
    const sessionSecretSpec = ENV_VARIABLE_REGISTRY.find((v) => v.key === 'OFFICE_SESSION_SECRET')!;

    expect(validateEnvVariableValue(apiSpec, 'javascript:alert(1)')).toMatch(/unsafe URI scheme/i);
    expect(validateEnvVariableValue(apiSpec, 'ftp://example.com')).toMatch(/https:\/\/ or http:\/\//i);
    expect(validateEnvVariableValue(wsSpec, 'https://api.example.et')).toMatch(/wss:\/\/ or ws:\/\//i);
    expect(validateEnvVariableValue(portSpec, '99999')).toMatch(/1 and 65535/);
    expect(validateEnvVariableValue(apiSpec, 'https://api.prms.example.et')).toBeNull();

    // sb_publishable_ is a public key (not private secret), while sb_secret_ & postgres:// are rejected
    expect(anonSpec.sensitive).toBe(false);
    expect(validateEnvVariableValue(anonSpec, 'sb_publishable_training_abc123')).toBeNull();
    expect(validateEnvVariableValue(anonSpec, 'sb_secret_private_key_123')).toMatch(/prohibited/i);
    expect(validateEnvVariableValue(anonSpec, 'postgres://user:pass@host:5432/db')).toMatch(/prohibited/i);
    expect(formatAuditEnvValue(anonSpec, 'sb_publishable_training_abc123')).toBe('sb_publishable_training_abc123');

    expect(maskSecretValue('short')).toBe('***REDACTED***');
    expect(formatAuditEnvValue(sessionSecretSpec, 'long-hmac-secret-value-ABCD')).toBe(
      '***REDACTED***ABCD'
    );
  });

  it('builds root and backend .env export content with clean formatting', () => {
    const rootEnv = buildDotEnvFileContent('root', {
      VITE_APP_MODE: 'production',
      VITE_API_BASE_URL: 'https://api.prms.example.et',
      PORT: '3000',
      GEMINI_API_KEY: 'test-key-value',
    });
    expect(rootEnv).toContain('VITE_APP_MODE="production"');
    expect(rootEnv).toContain('VITE_API_BASE_URL="https://api.prms.example.et"');
    expect(rootEnv).toContain('PORT="3000"');
    expect(rootEnv).toContain('GEMINI_API_KEY="test-key-value"');
    expect(rootEnv).not.toContain('STORAGE_BACKEND=');

    const backendEnv = buildDotEnvFileContent('backend', {
      DJANGO_ENV: 'prod',
      STORAGE_BACKEND: 'gcs',
      ENABLE_LIVE_TAX_INVOICING: 'False',
    });
    expect(backendEnv).toContain('DJANGO_ENV="prod"');
    expect(backendEnv).toContain('STORAGE_BACKEND="gcs"');
    expect(backendEnv).toContain('ENABLE_LIVE_TAX_INVOICING="False"');
    expect(backendEnv).not.toContain('VITE_SUPABASE_URL=');
  });

  it('enforces System Administrator-only editing in AdministrationPage and logs masked audit diffs', () => {
    render(
      <PrmsProvider>
        <AdminHarness />
      </PrmsProvider>
    );

    // Default tab is now Environment Groups (replacing Supabase & Project URL)
    expect(screen.getByRole('button', { name: /Environment Groups/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Supabase & Project URL/i })).not.toBeInTheDocument();

    // Sign in as General Manager -> should be read-only
    fireEvent.click(screen.getByRole('button', { name: 'Sign In GM' }));
    expect(screen.getByText(/Read-Only View for General Manager/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Browser Overrides/i })).toBeDisabled();

    // Sign in as System Administrator -> can edit, filter, and save with masked audit entry
    fireEvent.click(screen.getByRole('button', { name: 'Sign In SysAdmin' }));
    expect(screen.getByRole('button', { name: /Save Browser Overrides/i })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('VITE_API_BASE_URL'), {
      target: { value: 'https://api.addis.example.et' },
    });
    fireEvent.change(screen.getByLabelText('VITE_SUPABASE_ANON_KEY'), {
      target: { value: 'sb_publishable_public_training_key' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Browser Overrides/i }));

    expect(getApiBaseUrl()).toBe('https://api.addis.example.et');
    expect(screen.queryByText('Supabase: Connected')).not.toBeInTheDocument();
    expect(screen.getByText(/Supabase: Configured \(Verification Pending\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('latest-audit-action').textContent).toBe(
      'Environment Runtime Overrides Updated'
    );
    const auditAfter = screen.getByTestId('latest-audit-after').textContent || '';
    expect(auditAfter).toContain('https://api.addis.example.et');
    expect(auditAfter).toContain('sb_publishable_public_training_key');

    // Live search filtering and reset
    const searchInput = screen.getByLabelText(/Search environment variables/i);
    fireEvent.change(searchInput, { target: { value: 'NON_EXISTENT_ENV_KEY' } });
    expect(screen.getByText(/No environment variables match the current filter/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reset Filters/i }));
    expect(screen.getByLabelText('DATABASE_URL')).toBeInTheDocument();
  });
});
