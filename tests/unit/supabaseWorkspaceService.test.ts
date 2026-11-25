import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialSeedState } from '../../src/data/seedData';
import { clearBrowserEnvOverrides, setBrowserEnvOverrides } from '../../src/config/environmentRegistry';
import {
  classifySupabaseKeyFormat,
  getSupabaseClient,
  isSupabaseConfigured,
  setSupabaseCredentials,
} from '../../src/lib/supabase';
import { sanitizeSupabaseId } from '../../src/services/supabaseAuthService';
import {
  REQUIRED_ADPRMS_SUPABASE_TABLES,
  runSupabaseDiagnostics,
} from '../../src/services/supabaseDiagnosticsService';
import {
  appendAuditEventToSupabase,
  buildWorkspaceSummaryMap,
  recordPeriodClosureToSupabase,
  subscribeToWorkspaceSnapshot,
  syncWorkspaceSnapshotToSupabase,
} from '../../src/services/supabaseWorkspaceService';

describe('Supabase Workspace, Summary & Offline Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    clearBrowserEnvOverrides();
    vi.restoreAllMocks();
  });

  it('builds bounded workspace summary matching PostgreSQL schema constraints', () => {
    const seed = createInitialSeedState();
    const summary = buildWorkspaceSummaryMap(seed);

    expect(summary.ownersCount).toBe(seed.owners.length);
    expect(summary.propertiesCount).toBe(seed.properties.length);
    expect(summary.unitsCount).toBe(seed.units.length);
    expect(summary.chargesCount).toBe(seed.charges.length);
    expect(summary.receiptsCount).toBe(seed.receipts.length);
    expect(summary.approvalsCount).toBe(seed.approvals.length);
    expect(summary.auditEventsCount).toBe(seed.auditEvents.length);
    expect(summary.latestAuditHash).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
    expect(summary.ledgerJournalCount).toBe(seed.ledgerJournals.length);
    expect(summary.trialBalanceTotalCents).toBeGreaterThan(0);
    expect(summary.lastClosedPeriod).toBeTruthy();
    expect(typeof summary.threeWayCheckPassed).toBe('boolean');
  });

  it('validates Supabase URL and sb_publishable_ keys while rejecting placeholders and sb_secret_ keys', () => {
    expect(isSupabaseConfigured('', '')).toBe(false);
    expect(isSupabaseConfigured('https://MY_SUPABASE_PROJECT.supabase.co', 'sb_publishable_123')).toBe(false);
    expect(isSupabaseConfigured('not-a-url', 'sb_publishable_123')).toBe(false);
    expect(isSupabaseConfigured('https://vzjojdnttsfdwynumxtv.supabase.co', 'sb_secret_private_123')).toBe(false);
    expect(isSupabaseConfigured('https://vzjojdnttsfdwynumxtv.supabase.co', 'sb_publishable_training_123')).toBe(true);
    expect(isSupabaseConfigured('https://vzjojdnttsfdwynumxtv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true);

    expect(classifySupabaseKeyFormat('sb_publishable_abc')).toBe('publishable');
    expect(classifySupabaseKeyFormat('sb_secret_abc')).toBe('prohibited-secret');
    expect(() =>
      setSupabaseCredentials('https://vzjojdnttsfdwynumxtv.supabase.co', 'sb_secret_abc')
    ).toThrow(/prohibited/i);
  });

  it('sanitizes workspace/event identifiers against path traversal or injection', () => {
    expect(sanitizeSupabaseId('../workspaces/evil;DROP TABLE')).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
    expect(sanitizeSupabaseId('ws-usr_01-ALPHA')).toBe('ws-usr_01-ALPHA');
  });

  it('gracefully no-ops workspace sync and realtime subscription when unconfigured', async () => {
    const seed = createInitialSeedState();
    expect(getSupabaseClient()).toBeNull();

    await expect(
      syncWorkspaceSnapshotToSupabase({
        uid: 'usr-test',
        activeOwnerId: 'OWN-ALPHA',
        revision: 1,
        seed,
      })
    ).resolves.toBeUndefined();

    await expect(
      appendAuditEventToSupabase({
        uid: 'usr-test',
        ownerEntityId: 'OWN-ALPHA',
        eventId: 'AUD-1',
        actor: 'Test',
        action: 'Test',
        sha256Hash: 'HASH-1',
      })
    ).resolves.toBeUndefined();

    await expect(
      recordPeriodClosureToSupabase({
        uid: 'usr-test',
        ownerEntityId: 'OWN-ALPHA',
        periodCode: '2019-03',
        trialBalanceDebitCents: 1000,
        trialBalanceCreditCents: 1000,
        journalCount: 2,
        closedByActor: 'GM',
      })
    ).resolves.toBeUndefined();

    const onUpdate = vi.fn();
    const unsub = subscribeToWorkspaceSnapshot('usr-test', onUpdate);
    expect(typeof unsub).toBe('function');
    unsub();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('reports schema-missing honestly when Auth and Data API respond but AD-PRMS tables are absent', async () => {
    setBrowserEnvOverrides({
      VITE_SUPABASE_URL: 'https://vzjojdnttsfdwynumxtv.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_training_valid_format',
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/settings')) {
        return new Response(
          JSON.stringify({ external: { google: true, email: true, phone: false }, disable_signup: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.endsWith('/rest/v1/')) {
        return new Response(JSON.stringify({ paths: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ code: 'PGRST205', message: 'Could not find the table in the schema cache' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const report = await runSupabaseDiagnostics();
    expect(report.overallStatus).toBe('schema-missing');
    expect(report.auth.keyAccepted).toBe(true);
    expect(report.dataApi.enabled).toBe(true);
    expect(report.missingTables).toEqual([...REQUIRED_ADPRMS_SUPABASE_TABLES]);
    expect(report.workspaceSyncOperational).toBe(false);
    expect(report.badgeLabel).toContain('Schema Missing (0/8 Tables)');
  });
});
