import {
  classifySupabaseKeyFormat,
  getStoredSupabaseAnonKey,
  getStoredSupabaseUrl,
  getSupabaseClient,
  isSupabaseConfigured,
  type SupabaseKeyClassification,
} from '../lib/supabase';
import { getProhibitedBrowserSecretReason, isPlaceholderEnvValue } from '../config/environmentRegistry';

export const REQUIRED_ADPRMS_SUPABASE_TABLES = [
  'users',
  'user_private_info',
  'admins',
  'workspaces',
  'audit_events',
  'period_closures',
  'payments',
  'push_subscriptions',
] as const;

export const REQUIRED_ADPRMS_SUPABASE_RPCS = ['close_fiscal_period'] as const;

export type SupabaseOverallStatus =
  | 'unconfigured'
  | 'prohibited-key'
  | 'unreachable'
  | 'key-rejected'
  | 'data-api-disabled'
  | 'schema-missing'
  | 'rls-warning'
  | 'schema-ready-unauthenticated'
  | 'connected-and-verified';

export type SupabaseTableAccessState =
  | 'missing'
  | 'restricted'
  | 'anon-exposed'
  | 'exists-anon-zero'
  | 'authenticated-readable'
  | 'error';

export interface SupabaseTableProbeResult {
  table: string;
  exists: boolean;
  accessState: SupabaseTableAccessState;
  httpStatus: number | null;
  rowCount: number | null;
  detail: string;
}

export interface SupabaseDiagnosticReport {
  checkedAt: string;
  projectUrl: string;
  keyClassification: SupabaseKeyClassification;
  overallStatus: SupabaseOverallStatus;
  badgeLabel: string;
  summary: string;
  workspaceSyncOperational: boolean;
  auth: {
    reachable: boolean;
    httpStatus: number | null;
    keyAccepted: boolean;
    sessionActive: boolean;
    sessionEmail: string | null;
    sessionUid: string | null;
    providers: {
      google: boolean;
      email: boolean;
      phone: boolean;
    } | null;
    disableSignup: boolean | null;
    detail: string;
  };
  dataApi: {
    enabled: boolean;
    httpStatus: number | null;
    openApiExposed: boolean;
    closeFiscalPeriodRpcPresent: boolean | null;
    detail: string;
  };
  tables: SupabaseTableProbeResult[];
  missingTables: string[];
  anonExposedTables: string[];
  limitations: string[];
}

async function fetchWithAbortTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller !== null
      ? globalThis.setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : null;
  try {
    return await fetch(url, {
      ...init,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } finally {
    if (timer !== null) {
      globalThis.clearTimeout(timer);
    }
  }
}

export async function runSupabaseDiagnostics(params?: {
  url?: string;
  anonKey?: string;
}): Promise<SupabaseDiagnosticReport> {
  const checkedAt = new Date().toISOString();
  const projectUrl = (params?.url ?? getStoredSupabaseUrl()).trim().replace(/\/+$/, '');
  const anonKey = (params?.anonKey ?? getStoredSupabaseAnonKey()).trim();
  const keyClassification = classifySupabaseKeyFormat(anonKey);

  const prohibitedReason = anonKey ? getProhibitedBrowserSecretReason('VITE_SUPABASE_ANON_KEY', anonKey) : null;
  if (prohibitedReason) {
    return {
      checkedAt,
      projectUrl,
      keyClassification: 'prohibited-secret',
      overallStatus: 'prohibited-key',
      badgeLabel: 'Supabase: Prohibited Secret Key Rejected',
      summary: prohibitedReason,
      workspaceSyncOperational: false,
      auth: {
        reachable: false,
        httpStatus: null,
        keyAccepted: false,
        sessionActive: false,
        sessionEmail: null,
        sessionUid: null,
        providers: null,
        disableSignup: null,
        detail: 'Aborted before network probe because a private server key was supplied.',
      },
      dataApi: {
        enabled: false,
        httpStatus: null,
        openApiExposed: false,
        closeFiscalPeriodRpcPresent: null,
        detail: 'Not checked because private server keys must not be used in the browser.',
      },
      tables: [],
      missingTables: [...REQUIRED_ADPRMS_SUPABASE_TABLES],
      anonExposedTables: [],
      limitations: [prohibitedReason],
    };
  }

  if (!projectUrl || !anonKey || isPlaceholderEnvValue(projectUrl) || isPlaceholderEnvValue(anonKey) || !isSupabaseConfigured(projectUrl, anonKey)) {
    return {
      checkedAt,
      projectUrl,
      keyClassification,
      overallStatus: 'unconfigured',
      badgeLabel: 'Supabase: Offline / Unconfigured',
      summary: !projectUrl
        ? 'VITE_SUPABASE_URL is not configured.'
        : 'Enter your public sb_publishable_... key in Environment Groups and save browser overrides to connect.',
      workspaceSyncOperational: false,
      auth: {
        reachable: false,
        httpStatus: null,
        keyAccepted: false,
        sessionActive: false,
        sessionEmail: null,
        sessionUid: null,
        providers: null,
        disableSignup: null,
        detail: 'Browser publishable key is missing or still uses a placeholder value.',
      },
      dataApi: {
        enabled: false,
        httpStatus: null,
        openApiExposed: false,
        closeFiscalPeriodRpcPresent: null,
        detail: 'Not checked until VITE_SUPABASE_URL and public browser key are saved.',
      },
      tables: [],
      missingTables: [...REQUIRED_ADPRMS_SUPABASE_TABLES],
      anonExposedTables: [],
      limitations: [
        'Built-in Office SQLite remains the active training data store.',
        'Browser key is empty or unconfigured.',
      ],
    };
  }

  // 1. Probe Auth API (/auth/v1/settings) using apikey only (never send sb_publishable_ as Bearer JWT)
  let authReachable = false;
  let authHttpStatus: number | null = null;
  let keyAccepted = false;
  let providers: { google: boolean; email: boolean; phone: boolean } | null = null;
  let disableSignup: boolean | null = null;
  let authDetail: string;

  try {
    const authRes = await fetchWithAbortTimeout(`${projectUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Accept: 'application/json',
      },
    });
    authHttpStatus = authRes.status;
    if (authRes.ok) {
      authReachable = true;
      keyAccepted = true;
      const body = (await authRes.json().catch(() => ({}))) as {
        external?: Record<string, unknown>;
        disable_signup?: boolean;
      };
      providers = {
        google: Boolean(body.external?.google),
        email: body.external?.email !== false,
        phone: Boolean(body.external?.phone),
      };
      disableSignup = typeof body.disable_signup === 'boolean' ? body.disable_signup : null;
      authDetail = `Auth endpoint reachable (HTTP ${authRes.status}); publishable key accepted.`;
    } else if (authRes.status === 401 || authRes.status === 403) {
      authReachable = true;
      keyAccepted = false;
      const errBody = (await authRes.json().catch(() => ({}))) as { message?: string; msg?: string };
      authDetail = `Supabase rejected the browser API key (HTTP ${authRes.status}): ${errBody.message || errBody.msg || 'Invalid API key'}.`;
    } else {
      authDetail = `Auth endpoint returned HTTP ${authRes.status}.`;
    }
  } catch (err) {
    authDetail = `Network error reaching Supabase Auth: ${err instanceof Error ? err.message : 'Request failed'}.`;
  }

  // 2. Check existing browser Supabase Auth session
  const usingActiveClient =
    projectUrl === getStoredSupabaseUrl().trim().replace(/\/+$/, '') &&
    anonKey === getStoredSupabaseAnonKey().trim();
  const client = usingActiveClient ? getSupabaseClient() : null;

  let sessionActive = false;
  let sessionEmail: string | null = null;
  let sessionUid: string | null = null;
  let sessionAccessToken: string | null = null;

  if (client) {
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session?.user && sessionData.session.access_token) {
        sessionActive = true;
        sessionEmail = sessionData.session.user.email || null;
        sessionUid = sessionData.session.user.id;
        sessionAccessToken = sessionData.session.access_token;
      }
    } catch {
      // Ignore storage/session errors
    }
  }

  // If key was rejected or Auth wasn't reachable at all, return honest failure immediately
  if (!authReachable || !keyAccepted) {
    const status: SupabaseOverallStatus = authReachable && !keyAccepted ? 'key-rejected' : 'unreachable';
    return {
      checkedAt,
      projectUrl,
      keyClassification,
      overallStatus: status,
      badgeLabel: status === 'key-rejected' ? 'Supabase: API Key Rejected' : 'Supabase: Unreachable',
      summary: authDetail,
      workspaceSyncOperational: false,
      auth: {
        reachable: authReachable,
        httpStatus: authHttpStatus,
        keyAccepted,
        sessionActive,
        sessionEmail,
        sessionUid,
        providers,
        disableSignup,
        detail: authDetail,
      },
      dataApi: {
        enabled: false,
        httpStatus: null,
        openApiExposed: false,
        closeFiscalPeriodRpcPresent: null,
        detail: 'Skipped Data API probe because Auth endpoint check failed.',
      },
      tables: [],
      missingTables: [...REQUIRED_ADPRMS_SUPABASE_TABLES],
      anonExposedTables: [],
      limitations: [
        authDetail,
        'Built-in Office SQLite remains active and unaffected.',
      ],
    };
  }

  // 3. Probe PostgREST Data API (/rest/v1/)
  let dataApiEnabled = false;
  let dataApiHttpStatus: number | null = null;
  let openApiExposed = false;
  let closeFiscalPeriodRpcPresent: boolean | null = null;
  let dataApiDetail: string;
  const openApiPaths = new Set<string>();

  try {
    const restHeaders: Record<string, string> = {
      apikey: anonKey,
      Accept: 'application/openapi+json',
    };
    if (sessionAccessToken) {
      restHeaders.Authorization = `Bearer ${sessionAccessToken}`;
    }
    const restRes = await fetchWithAbortTimeout(`${projectUrl}/rest/v1/`, {
      method: 'GET',
      headers: restHeaders,
    });
    dataApiHttpStatus = restRes.status;
    const rawText = await restRes.text().catch(() => '');
    const lowerText = rawText.toLowerCase();

    if (restRes.ok) {
      dataApiEnabled = true;
      try {
        const spec = JSON.parse(rawText) as { paths?: Record<string, unknown> };
        if (spec && spec.paths && typeof spec.paths === 'object') {
          openApiExposed = true;
          for (const p of Object.keys(spec.paths)) {
            openApiPaths.add(p);
          }
          closeFiscalPeriodRpcPresent = openApiPaths.has('/rpc/close_fiscal_period');
        }
      } catch {
        // Non-JSON response
      }
      dataApiDetail = openApiExposed
        ? `Data API enabled (HTTP ${restRes.status}); OpenAPI lists ${openApiPaths.size} path(s).`
        : `Data API enabled (HTTP ${restRes.status}).`;
    } else if (
      restRes.status === 404 ||
      lowerText.includes('data api is disabled') ||
      lowerText.includes('service is disabled')
    ) {
      dataApiEnabled = false;
      dataApiDetail = `Data API appears disabled or unavailable (HTTP ${restRes.status}).`;
    } else {
      // e.g. 401/403 when OpenAPI root introspection is disabled in PostgREST, even though table endpoints work
      dataApiEnabled = true;
      dataApiDetail = `Data API responded HTTP ${restRes.status} (OpenAPI root restricted; probing required tables directly).`;
    }
  } catch (err) {
    dataApiDetail = `Network error probing Data API: ${err instanceof Error ? err.message : 'Request failed'}.`;
  }

  // 4. Probe required AD-PRMS tables via read-only HEAD/count queries
  const tableResults: SupabaseTableProbeResult[] = [];
  for (const table of REQUIRED_ADPRMS_SUPABASE_TABLES) {
    if (!dataApiEnabled && dataApiHttpStatus === 404) {
      tableResults.push({
        table,
        exists: false,
        accessState: 'missing',
        httpStatus: 404,
        rowCount: null,
        detail: 'Data API disabled (HTTP 404).',
      });
      continue;
    }

    try {
      let queryStatus: number | null = null;
      let queryCount: number | null = null;
      let queryError: { code?: string; message?: string; details?: string } | null = null;

      if (client) {
        const res = await client.from(table).select('*', { count: 'exact', head: true }).limit(1);
        queryStatus = res.status;
        queryCount = res.count;
        queryError = res.error ? { code: res.error.code, message: res.error.message, details: res.error.details } : null;
      } else {
        const tableHeaders: Record<string, string> = {
          apikey: anonKey,
          Prefer: 'count=exact',
        };
        if (sessionAccessToken) {
          tableHeaders.Authorization = `Bearer ${sessionAccessToken}`;
        }
        const res = await fetchWithAbortTimeout(`${projectUrl}/rest/v1/${table}?select=*&limit=1`, {
          method: 'HEAD',
          headers: tableHeaders,
        });
        queryStatus = res.status;
        if (!res.ok) {
          queryError = { code: `HTTP_${res.status}`, message: res.statusText };
        }
      }

      const errCode = (queryError?.code || '').toUpperCase();
      const errMsg = (queryError?.message || '').toLowerCase();

      if (
        errCode === 'PGRST205' ||
        errCode === '42P01' ||
        queryStatus === 404 ||
        errMsg.includes('could not find the table') ||
        errMsg.includes('does not exist')
      ) {
        tableResults.push({
          table,
          exists: false,
          accessState: 'missing',
          httpStatus: queryStatus,
          rowCount: null,
          detail: queryError?.message || `Table public.${table} not found in Supabase schema cache.`,
        });
      } else if (
        errCode === '42501' ||
        queryStatus === 401 ||
        queryStatus === 403 ||
        errMsg.includes('permission denied')
      ) {
        dataApiEnabled = true;
        tableResults.push({
          table,
          exists: true,
          accessState: 'restricted',
          httpStatus: queryStatus,
          rowCount: null,
          detail: queryError?.message || `Table public.${table} exists; current role denied by grants/RLS.`,
        });
      } else if (queryError) {
        tableResults.push({
          table,
          exists: openApiPaths.has(`/${table}`),
          accessState: 'error',
          httpStatus: queryStatus,
          rowCount: null,
          detail: queryError.message || `Query error (${queryStatus ?? 'unknown'}).`,
        });
      } else {
        dataApiEnabled = true;
        if (sessionActive) {
          tableResults.push({
            table,
            exists: true,
            accessState: 'authenticated-readable',
            httpStatus: queryStatus,
            rowCount: queryCount,
            detail: `Accessible within authenticated RLS scope (${queryCount ?? 0} visible row(s)).`,
          });
        } else if ((queryCount ?? 0) > 0) {
          tableResults.push({
            table,
            exists: true,
            accessState: 'anon-exposed',
            httpStatus: queryStatus,
            rowCount: queryCount,
            detail: `WARNING: ${queryCount} row(s) readable by unauthenticated anon key. Check RLS policies.`,
          });
        } else {
          tableResults.push({
            table,
            exists: true,
            accessState: 'exists-anon-zero',
            httpStatus: queryStatus,
            rowCount: 0,
            detail: 'Table exists; 0 rows readable anonymously (RLS enforced or empty; sign in to verify authenticated writes).',
          });
        }
      }
    } catch (err) {
      tableResults.push({
        table,
        exists: openApiPaths.has(`/${table}`),
        accessState: 'error',
        httpStatus: null,
        rowCount: null,
        detail: err instanceof Error ? err.message : 'Probe error.',
      });
    }
  }

  const missingTables = tableResults.filter((t) => !t.exists).map((t) => t.table);
  const anonExposedTables = tableResults
    .filter((t) => t.accessState === 'anon-exposed')
    .map((t) => t.table);
  const existingCount = tableResults.filter((t) => t.exists).length;

  let overallStatus: SupabaseOverallStatus;
  let badgeLabel: string;
  let summary: string;
  const limitations: string[] = [];

  if (!dataApiEnabled && existingCount === 0) {
    overallStatus = 'data-api-disabled';
    badgeLabel = 'Supabase: Auth Reachable · Data API Disabled';
    summary =
      'Supabase Auth accepted the publishable key, but PostgREST Data API is disabled or unreachable. Workspace sync is NOT operational.';
    limitations.push('Data API is disabled or returning HTTP 404 on /rest/v1/.');
  } else if (missingTables.length > 0) {
    overallStatus = 'schema-missing';
    badgeLabel = `Supabase: Auth Reachable · Schema Missing (${existingCount}/${REQUIRED_ADPRMS_SUPABASE_TABLES.length} Tables)`;
    summary = `Connected to Supabase Auth and Data API, but ${missingTables.length} required AD-PRMS table(s) are missing (${missingTables.join(', ')}). Workspace sync is NOT operational until supabase/migrations/202611230001_initial_schema_rls.sql is applied.`;
    limitations.push(
      `Missing ${missingTables.length} required table(s): ${missingTables.join(', ')}.`,
      'Workspace snapshot, audit mirror, and fiscal period closure sync cannot run until the SQL migration is executed.'
    );
  } else if (anonExposedTables.length > 0) {
    overallStatus = 'rls-warning';
    badgeLabel = 'Supabase: RLS Warning (Anon Rows Visible)';
    summary = `All ${REQUIRED_ADPRMS_SUPABASE_TABLES.length} tables exist, but unauthenticated anon reads returned rows on: ${anonExposedTables.join(', ')}. Verify FORCE ROW LEVEL SECURITY policies before enabling workspace sync.`;
    limitations.push(`Anon-readable rows detected on: ${anonExposedTables.join(', ')}.`);
  } else if (!sessionActive) {
    overallStatus = 'schema-ready-unauthenticated';
    badgeLabel = `Supabase: Verified · Ready (${existingCount}/8 Tables · No Auth Session)`;
    summary =
      'Auth endpoint and Data API accepted the sb_publishable_... key, all 8 AD-PRMS tables exist with 0 rows exposed to anon, and Built-in Office SQLite remains the default store. Sign in via Supabase Auth to verify authenticated RLS reads/writes.';
    limitations.push(
      'No active Supabase Auth user session in browser; authenticated RLS INSERT/UPDATE behavior is untested until sign-in.'
    );
  } else {
    overallStatus = 'connected-and-verified';
    badgeLabel = `Supabase: Connected & Verified (${existingCount}/8 Tables · Auth Active)`;
    summary = `Authenticated as ${sessionEmail || sessionUid}; Auth API, Data API, and all ${REQUIRED_ADPRMS_SUPABASE_TABLES.length} AD-PRMS tables are present with RLS enforced.`;
  }

  if (closeFiscalPeriodRpcPresent === false) {
    limitations.push('RPC close_fiscal_period was not present in OpenAPI schema.');
  } else if (closeFiscalPeriodRpcPresent === null && dataApiEnabled) {
    limitations.push('RPC close_fiscal_period existence could not be confirmed from restricted OpenAPI root.');
  }
  limitations.push('Built-in Office SQLite remains the default training data store.');

  const workspaceSyncOperational =
    authReachable &&
    keyAccepted &&
    dataApiEnabled &&
    missingTables.length === 0 &&
    anonExposedTables.length === 0 &&
    sessionActive;

  return {
    checkedAt,
    projectUrl,
    keyClassification,
    overallStatus,
    badgeLabel,
    summary,
    workspaceSyncOperational,
    auth: {
      reachable: authReachable,
      httpStatus: authHttpStatus,
      keyAccepted,
      sessionActive,
      sessionEmail,
      sessionUid,
      providers,
      disableSignup,
      detail: authDetail,
    },
    dataApi: {
      enabled: dataApiEnabled,
      httpStatus: dataApiHttpStatus,
      openApiExposed,
      closeFiscalPeriodRpcPresent,
      detail: dataApiDetail,
    },
    tables: tableResults,
    missingTables,
    anonExposedTables,
    limitations,
  };
}
