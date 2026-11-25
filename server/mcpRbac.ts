import type { PersonaRole } from '../src/types/prms.ts';

export const ALL_MCP_TOOL_NAMES = [
  'get_system_status',
  'get_property_summary',
  'list_buildings',
  'get_unit_occupancy',
  'get_lease_summary',
  'get_rent_collection_summary',
  'get_overdue_rent_summary',
  'get_audit_summary',
] as const;

export type McpToolName = (typeof ALL_MCP_TOOL_NAMES)[number];
export type McpRbacDecision = 'Allow' | 'Restricted' | 'Deny';

export const SYNTHETIC_OWNER_IDS = ['OWN-ALPHA', 'OWN-BETA'] as const;
export type SyntheticOwnerId = (typeof SYNTHETIC_OWNER_IDS)[number];

/**
 * Canonical Phase 1 Server-Side RBAC Matrix (§8.2 of implementation_plan.md).
 * Reconciles ui-level catch-all inconsistencies in src/policies/rbac.ts with strict module rules.
 */
export const MCP_RBAC_MATRIX: Record<PersonaRole, Record<McpToolName, McpRbacDecision>> = {
  'Owner / Director': {
    get_system_status: 'Allow',
    get_property_summary: 'Allow',
    list_buildings: 'Allow',
    get_unit_occupancy: 'Allow',
    get_lease_summary: 'Allow',
    get_rent_collection_summary: 'Allow',
    get_overdue_rent_summary: 'Allow',
    get_audit_summary: 'Allow',
  },
  'General Manager': {
    get_system_status: 'Allow',
    get_property_summary: 'Allow',
    list_buildings: 'Allow',
    get_unit_occupancy: 'Allow',
    get_lease_summary: 'Allow',
    get_rent_collection_summary: 'Allow',
    get_overdue_rent_summary: 'Allow',
    get_audit_summary: 'Allow',
  },
  'Assistant Manager': {
    get_system_status: 'Allow',
    get_property_summary: 'Allow',
    list_buildings: 'Allow',
    get_unit_occupancy: 'Allow',
    get_lease_summary: 'Allow',
    get_rent_collection_summary: 'Restricted',
    get_overdue_rent_summary: 'Restricted',
    get_audit_summary: 'Allow',
  },
  'Finance Officer': {
    get_system_status: 'Allow',
    get_property_summary: 'Allow',
    list_buildings: 'Allow',
    get_unit_occupancy: 'Allow',
    get_lease_summary: 'Allow',
    get_rent_collection_summary: 'Allow',
    get_overdue_rent_summary: 'Allow',
    get_audit_summary: 'Allow',
  },
  Clerk: {
    get_system_status: 'Allow',
    get_property_summary: 'Allow',
    list_buildings: 'Allow',
    get_unit_occupancy: 'Allow',
    get_lease_summary: 'Allow',
    get_rent_collection_summary: 'Allow',
    get_overdue_rent_summary: 'Allow',
    get_audit_summary: 'Deny',
  },
  'Collections Clerk': {
    get_system_status: 'Allow',
    get_property_summary: 'Restricted',
    list_buildings: 'Allow',
    get_unit_occupancy: 'Restricted',
    get_lease_summary: 'Restricted',
    get_rent_collection_summary: 'Allow',
    get_overdue_rent_summary: 'Allow',
    get_audit_summary: 'Deny',
  },
  'Property Clerk': {
    get_system_status: 'Allow',
    get_property_summary: 'Restricted', // Structural counts only; financial totals omitted per §8.2
    list_buildings: 'Allow',
    get_unit_occupancy: 'Allow',
    get_lease_summary: 'Allow',
    get_rent_collection_summary: 'Deny',
    get_overdue_rent_summary: 'Deny',
    get_audit_summary: 'Deny',
  },
  'System Administrator': {
    get_system_status: 'Allow',
    get_property_summary: 'Deny',
    list_buildings: 'Deny',
    get_unit_occupancy: 'Deny',
    get_lease_summary: 'Deny',
    get_rent_collection_summary: 'Deny',
    get_overdue_rent_summary: 'Deny',
    get_audit_summary: 'Allow',
  },
  'Auditor / Read-only reviewer': {
    get_system_status: 'Allow',
    get_property_summary: 'Allow',
    list_buildings: 'Allow',
    get_unit_occupancy: 'Allow',
    get_lease_summary: 'Allow',
    get_rent_collection_summary: 'Allow',
    get_overdue_rent_summary: 'Allow',
    get_audit_summary: 'Allow',
  },
  'Training Coordinator': {
    get_system_status: 'Allow',
    get_property_summary: 'Restricted',
    list_buildings: 'Allow',
    get_unit_occupancy: 'Allow',
    get_lease_summary: 'Restricted',
    get_rent_collection_summary: 'Restricted',
    get_overdue_rent_summary: 'Restricted',
    get_audit_summary: 'Allow',
  },
};

export function isMcpToolName(value: string): value is McpToolName {
  return (ALL_MCP_TOOL_NAMES as readonly string[]).includes(value);
}

export function getMcpToolDecision(role: string, toolName: McpToolName): McpRbacDecision {
  const row = (MCP_RBAC_MATRIX as Record<string, Record<McpToolName, McpRbacDecision>>)[role];
  if (!row) return 'Deny';
  return row[toolName] ?? 'Deny';
}

export function getRolePermittedTools(role: string): McpToolName[] {
  return ALL_MCP_TOOL_NAMES.filter((tool) => getMcpToolDecision(role, tool) !== 'Deny');
}

export function sanitizeMcpText(value: unknown, maxLength = 120): string {
  const str = String(value ?? '');
  // eslint-disable-next-line no-control-regex
  const stripped = str.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, Math.max(0, maxLength - 1))}…`;
}

const REDACTED_KEYS = new Set([
  'authorization',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'password',
  'client_secret',
  'signature',
  'rawjwt',
  'notes',
  'reason',
]);

function sanitizeForJson(input: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (input === null || input === undefined) return null;
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (typeof input === 'string') return sanitizeMcpText(input, 160);
  if (Array.isArray(input)) {
    return input.slice(0, 25).map((item) => sanitizeForJson(item, depth + 1));
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(input as Record<string, unknown>).sort();
    for (const k of keys) {
      if (REDACTED_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeForJson((input as Record<string, unknown>)[k], depth + 1);
      }
    }
    return out;
  }
  return String(input);
}

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return Number.isFinite(value) || typeof value === 'boolean' ? JSON.stringify(value) : 'null';
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const prop = record[key];
      if (prop === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalJson(prop)}`);
    }
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(String(value));
}

export function redactMcpParams(input: unknown): string {
  return canonicalJson(sanitizeForJson(input ?? {}));
}
