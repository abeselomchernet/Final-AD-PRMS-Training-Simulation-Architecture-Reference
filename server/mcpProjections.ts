import { computeTenantAgeing } from '../src/services/accountingEngine.ts';
import type { LedgerTenantSubRecord, OwnerId } from '../src/types/prms.ts';
import { queryMcpAuditSummary, type McpActorBindingRow } from './mcpGovernanceStore.ts';
import { sanitizeMcpText, type McpRbacDecision, type McpToolName } from './mcpRbac.ts';
import type { OfficeSqliteStore } from './officeStore.ts';

export interface ProjectionContext {
  store: OfficeSqliteStore;
  binding: McpActorBindingRow;
  ownerId: OwnerId;
  decision: Exclude<McpRbacDecision, 'Deny'>;
  params: Record<string, unknown>;
}

export interface ProjectionResponse {
  data: Record<string, unknown>;
  rowCount: number;
}

function clampLimit(raw: unknown, def = 25): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(50, Math.floor(n)));
}

function clampOffset(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function daysBetweenGc(fromIso: string, toIso: string): number {
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.max(0, Math.floor((toMs - fromMs) / 86_400_000));
}

export function resolveOwnerIdForBinding(
  binding: McpActorBindingRow,
  staffAllowedOwners: string[],
  requestedOwnerId?: unknown
): { ok: true; ownerId: OwnerId } | { ok: false; status: number; code: string; message: string } {
  const effectiveAllowed = binding.allowedOwners.filter((o) => staffAllowedOwners.includes(o));
  if (effectiveAllowed.length === 0) {
    return {
      ok: false,
      status: 403,
      code: 'NO_AUTHORIZED_OWNER_SCOPE',
      message: 'Binding has no authorized synthetic owner scope.',
    };
  }

  let candidate: string;
  if (typeof requestedOwnerId === 'string' && requestedOwnerId.trim().length > 0) {
    candidate = requestedOwnerId.trim();
  } else if (binding.defaultOwnerId && effectiveAllowed.includes(binding.defaultOwnerId)) {
    candidate = binding.defaultOwnerId;
  } else if (effectiveAllowed.length === 1) {
    candidate = effectiveAllowed[0];
  } else {
    return {
      ok: false,
      status: 400,
      code: 'OWNER_ID_REQUIRED',
      message: 'Explicit ownerId is required because no default_owner_id is set for this multi-owner binding.',
    };
  }

  if (!effectiveAllowed.includes(candidate)) {
    return {
      ok: false,
      status: 403,
      code: 'CROSS_OWNER_FORBIDDEN',
      message: `Owner scope "${candidate}" is outside actor binding allowedOwners.`,
    };
  }

  return { ok: true, ownerId: candidate as OwnerId };
}

export function executeMcpProjection(
  toolName: McpToolName,
  ctx: ProjectionContext
): ProjectionResponse {
  const ws = ctx.store.getWorkspaceState();
  const state = (ws.state || {}) as Record<string, unknown>;
  const owners = Array.isArray(state.owners) ? (state.owners as Array<Record<string, unknown>>) : [];
  const properties = Array.isArray(state.properties)
    ? (state.properties as Array<Record<string, unknown>>)
    : [];
  const buildings = Array.isArray(state.buildings)
    ? (state.buildings as Array<Record<string, unknown>>)
    : [];
  const units = Array.isArray(state.units) ? (state.units as Array<Record<string, unknown>>) : [];
  const tenants = Array.isArray(state.tenants) ? (state.tenants as Array<Record<string, unknown>>) : [];
  const leases = Array.isArray(state.leases) ? (state.leases as Array<Record<string, unknown>>) : [];
  const charges = Array.isArray(state.charges) ? (state.charges as Array<Record<string, unknown>>) : [];
  const receipts = Array.isArray(state.receipts) ? (state.receipts as Array<Record<string, unknown>>) : [];

  const ownerRecord = owners.find((o) => String(o.id) === ctx.ownerId);
  const ownerProperties = properties.filter((p) => String(p.ownerId) === ctx.ownerId);
  const ownerBuildings = buildings.filter((b) => String(b.ownerId) === ctx.ownerId);
  const ownerUnits = units.filter((u) => String(u.ownerId) === ctx.ownerId);
  const ownerTenants = tenants.filter((t) => String(t.ownerId) === ctx.ownerId);
  const ownerLeases = leases.filter((l) => String(l.ownerId) === ctx.ownerId);
  const ownerCharges = charges.filter((c) => String(c.ownerId) === ctx.ownerId);
  const ownerReceipts = receipts.filter((r) => String(r.ownerId) === ctx.ownerId);

  switch (toolName) {
    case 'get_system_status': {
      const db = ctx.store.getDatabase();
      const latestAudit = db
        .prepare('SELECT MAX(seq) AS maxSeq FROM mcp_audit_events')
        .get() as { maxSeq: number | null } | undefined;
      return {
        rowCount: 1,
        data: {
          mode: 'TRAINING-SYNTHETIC-ONLY',
          isSyntheticFixture: true,
          initialized: ws.initialized,
          revision: ws.revision,
          activeOwnerId: ctx.ownerId,
          resolvedActorId: ctx.binding.actorId,
          resolvedRole: sanitizeMcpText(ctx.binding.role, 80),
          ledgerTriggerProtected: true,
          enableLiveTaxInvoicing: false,
          auditChainLength: Number(latestAudit?.maxSeq || 0),
          sqliteUpdatedAt: ws.updatedAt,
        },
      };
    }

    case 'get_property_summary': {
      const occupiedUnits = ownerUnits.filter((u) => u.status === 'Occupied').length;
      const vacantUnits = ownerUnits.filter((u) => u.status === 'Vacant').length;
      const activeLeaseCount = ownerLeases.filter(
        (l) => l.status === 'Active' || l.status === 'Expiring Soon'
      ).length;
      const monthlyScheduledRentEtb = ownerLeases
        .filter((l) => l.status === 'Active' || l.status === 'Expiring Soon')
        .reduce((sum, l) => sum + Number(l.monthlyRentEtb || 0), 0);

      const projectedProps = ownerProperties.map((p) => {
        const card = (p.addressCard || {}) as Record<string, unknown>;
        return {
          id: String(p.id),
          code: sanitizeMcpText(p.code, 40),
          name: sanitizeMcpText(p.name, 120),
          propertyType: sanitizeMcpText(p.propertyType, 60),
          status: sanitizeMcpText(p.status, 40),
          subCity: sanitizeMcpText(card.subCity || '', 80),
        };
      });

      const basePayload: Record<string, unknown> = {
        ownerId: ctx.ownerId,
        ownerName: sanitizeMcpText(ownerRecord?.name || ctx.ownerId, 120),
        isSyntheticFixture: true,
        businessOwnershipNote:
          'Synthetic training fixture only; production portfolio preserves 1 title-holder (Abdulwehab Dekebo) across 5 buildings isolated from Abdulwehab Dekebo Trading.',
        propertyCount: ownerProperties.length,
        buildingCount: ownerBuildings.length,
        unitCount: ownerUnits.length,
        occupiedUnits,
        vacantUnits,
        activeLeaseCount,
        properties: projectedProps,
      };

      // Property Clerk, Collections Clerk, Training Coordinator omit financial valuation totals
      if (ctx.decision === 'Allow') {
        basePayload.monthlyScheduledRentEtb = monthlyScheduledRentEtb;
      }

      return { rowCount: projectedProps.length, data: basePayload };
    }

    case 'list_buildings': {
      const limit = clampLimit(ctx.params.limit, 25);
      const offset = clampOffset(ctx.params.offset);
      const propertyIdFilter =
        typeof ctx.params.propertyId === 'string' ? ctx.params.propertyId.trim() : '';
      const statusFilter = typeof ctx.params.status === 'string' ? ctx.params.status.trim() : '';

      const filtered = ownerBuildings.filter((b) => {
        if (propertyIdFilter && String(b.propertyId) !== propertyIdFilter) return false;
        if (statusFilter && String(b.status) !== statusFilter) return false;
        return true;
      });

      const slice = filtered.slice(offset, offset + limit).map((b) => ({
        id: String(b.id),
        code: sanitizeMcpText(b.code, 40),
        name: sanitizeMcpText(b.name, 120),
        propertyId: String(b.propertyId),
        floors: Number(b.floors || 0),
        status: sanitizeMcpText(b.status, 40),
        unitCount: ownerUnits.filter((u) => String(u.buildingId) === String(b.id)).length,
      }));

      return {
        rowCount: slice.length,
        data: {
          ownerId: ctx.ownerId,
          isSyntheticFixture: true,
          items: slice,
          pagination: {
            total: filtered.length,
            limit,
            offset,
            hasMore: offset + slice.length < filtered.length,
          },
        },
      };
    }

    case 'get_unit_occupancy': {
      const limit = clampLimit(ctx.params.limit, 25);
      const offset = clampOffset(ctx.params.offset);
      const buildingIdFilter =
        typeof ctx.params.buildingId === 'string' ? ctx.params.buildingId.trim() : '';
      const statusFilter = typeof ctx.params.status === 'string' ? ctx.params.status.trim() : '';

      const scopedForSummary = ownerUnits.filter((u) =>
        buildingIdFilter ? String(u.buildingId) === buildingIdFilter : true
      );
      const total = scopedForSummary.length;
      const occupied = scopedForSummary.filter((u) => u.status === 'Occupied').length;
      const vacant = scopedForSummary.filter((u) => u.status === 'Vacant').length;
      const maintenance = scopedForSummary.filter((u) => u.status === 'Maintenance').length;
      const reserved = scopedForSummary.filter((u) => u.status === 'Reserved').length;

      const filtered = scopedForSummary.filter((u) =>
        statusFilter ? String(u.status) === statusFilter : true
      );
      const includeRent = ctx.decision === 'Allow';

      const items = filtered.slice(offset, offset + limit).map((u) => {
        const row: Record<string, unknown> = {
          id: String(u.id),
          code: sanitizeMcpText(u.code, 40),
          name: sanitizeMcpText(u.name, 120),
          buildingId: String(u.buildingId),
          floor: Number(u.floor || 0),
          unitType: sanitizeMcpText(u.unitType, 60),
          status: sanitizeMcpText(u.status, 40),
          areaSqm: Number(u.areaSqm || 0),
        };
        if (includeRent) {
          row.baseRentEtb = Number(u.baseRentEtb || 0);
        }
        return row;
      });

      return {
        rowCount: items.length,
        data: {
          ownerId: ctx.ownerId,
          isSyntheticFixture: true,
          summary: {
            total,
            occupied,
            vacant,
            maintenance,
            reserved,
            occupancyRatePct: total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0,
          },
          items,
          pagination: {
            total: filtered.length,
            limit,
            offset,
            hasMore: offset + items.length < filtered.length,
          },
        },
      };
    }

    case 'get_lease_summary': {
      const limit = clampLimit(ctx.params.limit, 25);
      const offset = clampOffset(ctx.params.offset);
      const statusFilter = typeof ctx.params.status === 'string' ? ctx.params.status.trim() : '';
      const expiringWithinDays =
        typeof ctx.params.expiringWithinDays === 'number' && Number.isFinite(ctx.params.expiringWithinDays)
          ? Math.max(0, Math.floor(ctx.params.expiringWithinDays))
          : null;

      const todayIso = new Date().toISOString().slice(0, 10);
      const tenantNameMap = new Map(
        ownerTenants.map((t) => [String(t.id), sanitizeMcpText(t.name || t.code || t.id, 120)])
      );

      const countsByStatus: Record<string, number> = {};
      for (const l of ownerLeases) {
        const st = sanitizeMcpText(l.status || 'Unknown', 40);
        countsByStatus[st] = (countsByStatus[st] || 0) + 1;
      }

      const filtered = ownerLeases.filter((l) => {
        if (statusFilter && String(l.status) !== statusFilter) return false;
        if (expiringWithinDays !== null) {
          const daysLeft = daysBetweenGc(todayIso, String(l.endDate || ''));
          if (daysLeft > expiringWithinDays) return false;
        }
        return true;
      });

      const includeFinancials = ctx.decision === 'Allow';
      const items = filtered.slice(offset, offset + limit).map((l) => {
        const item: Record<string, unknown> = {
          id: String(l.id),
          leaseNumber: sanitizeMcpText(l.leaseNumber, 60),
          unitId: String(l.unitId),
          tenantLabel: tenantNameMap.get(String(l.tenantId)) || String(l.tenantId),
          status: sanitizeMcpText(l.status, 40),
          startDate: sanitizeMcpText(l.startDate, 20),
          endDate: sanitizeMcpText(l.endDate, 20),
          billingCycle: sanitizeMcpText(l.billingCycle, 30),
        };
        if (includeFinancials) {
          item.monthlyRentEtb = Number(l.monthlyRentEtb || 0);
        }
        return item;
      });

      const data: Record<string, unknown> = {
        ownerId: ctx.ownerId,
        isSyntheticFixture: true,
        countsByStatus,
        items,
        pagination: {
          total: filtered.length,
          limit,
          offset,
          hasMore: offset + items.length < filtered.length,
        },
      };

      if (includeFinancials) {
        data.totalMonthlyRentEtb = filtered.reduce((s, l) => s + Number(l.monthlyRentEtb || 0), 0);
        data.totalSecurityDepositEtb = filtered.reduce(
          (s, l) => s + Number(l.securityDepositEtb || 0),
          0
        );
      }

      return { rowCount: items.length, data };
    }

    case 'get_rent_collection_summary': {
      const periodFilter = typeof ctx.params.period === 'string' ? ctx.params.period.trim() : '';
      const scopedCharges = periodFilter
        ? ownerCharges.filter((c) => String(c.period) === periodFilter)
        : ownerCharges;
      const scopedReceipts = periodFilter
        ? ownerReceipts.filter((r) => String(r.paymentDate || '').startsWith(periodFilter))
        : ownerReceipts;

      const billedEtb = scopedCharges.reduce((s, c) => s + Number(c.billedEtb || 0), 0);
      const collectedEtb = scopedCharges.reduce((s, c) => s + Number(c.paidEtb || 0), 0);
      const outstandingEtb = Math.max(0, billedEtb - collectedEtb);
      const collectionRatePct =
        billedEtb > 0 ? Math.round((collectedEtb / billedEtb) * 1000) / 10 : 0;

      const activeReceipts = scopedReceipts.filter(
        (r) => !String(r.documentState || '').toLowerCase().includes('void')
      );
      const voidedReceiptCount = scopedReceipts.length - activeReceipts.length;

      const data: Record<string, unknown> = {
        ownerId: ctx.ownerId,
        isSyntheticFixture: true,
        period: periodFilter || 'ALL',
        billedEtb,
        collectedEtb,
        outstandingEtb,
        collectionRatePct,
        receiptCount: activeReceipts.length,
        voidedReceiptCount,
      };

      if (ctx.decision === 'Allow') {
        const byMethod: Record<string, number> = {};
        for (const r of activeReceipts) {
          const method = sanitizeMcpText(r.method || 'Other', 40);
          byMethod[method] = (byMethod[method] || 0) + Number(r.amountEtb || 0);
        }
        data.byMethod = byMethod;
      }

      return { rowCount: scopedCharges.length, data };
    }

    case 'get_overdue_rent_summary': {
      const limit = clampLimit(ctx.params.limit, 25);
      const offset = clampOffset(ctx.params.offset);
      const minDaysOverdue =
        typeof ctx.params.minDaysOverdue === 'number' && Number.isFinite(ctx.params.minDaysOverdue)
          ? Math.max(0, Math.floor(ctx.params.minDaysOverdue))
          : 1;

      const refDateIso = new Date().toISOString().slice(0, 10);
      const unitCodeById = new Map(ownerUnits.map((u) => [String(u.id), sanitizeMcpText(u.code, 40)]));

      const tenantSubRecords: LedgerTenantSubRecord[] = ownerTenants.map((t) => {
        const tenantCharges = ownerCharges.filter((c) => {
          if (String(c.tenantId) !== String(t.id)) return false;
          const openEtb = Math.max(0, Number(c.billedEtb || 0) - Number(c.paidEtb || 0));
          if (openEtb <= 0) return false;
          const days = daysBetweenGc(String(c.dueDate || ''), refDateIso);
          return days >= minDaysOverdue;
        });

        const firstUnitId = tenantCharges[0] ? String(tenantCharges[0].unitId) : '';
        return {
          id: String(t.id),
          ownerId: ctx.ownerId,
          tenantCode: sanitizeMcpText(t.code || t.id, 40),
          tenantName: sanitizeMcpText(t.name || t.id, 120),
          unitCode: unitCodeById.get(firstUnitId) || 'N/A',
          propertyUse: 'Commercial',
          monthlyRentCents: 0,
          leaseTermMonths: 12,
          freeMonthsCount: 0,
          straightLineMonthlyCents: 0,
          advanceMonthsHeld: 0,
          advanceRentCents: 0,
          accruedRentCents: 0,
          deferredRentCents: 0,
          openInvoices: tenantCharges.map((c) => {
            const billedCents = Math.round(Number(c.billedEtb || 0) * 100);
            const paidCents = Math.round(Number(c.paidEtb || 0) * 100);
            const openCents = Math.max(0, billedCents - paidCents);
            const days = Math.max(1, daysBetweenGc(String(c.dueDate || ''), refDateIso));
            return {
              invoiceId: String(c.id),
              periodCode: String(c.period || ''),
              dueDateGc: String(c.dueDate || ''),
              daysOverdue: days,
              billedCents,
              paidCents,
              openCents,
            };
          }),
        };
      });

      const ageing = computeTenantAgeing(tenantSubRecords);
      const overdueItems = ageing.rows
        .filter((r) => r.totalReceivableCents > 0)
        .map((r) => {
          const maxDays = Math.max(
            0,
            ...(tenantSubRecords
              .find((ts) => ts.id === r.tenantId)
              ?.openInvoices.map((inv) => inv.daysOverdue) || [0])
          );
          const bucket =
            maxDays > 90
              ? '90+'
              : maxDays > 60
                ? '61-90'
                : maxDays > 30
                  ? '31-60'
                  : '1-30';
          return {
            tenantCode: r.tenantCode,
            tenantLabel: r.tenantName,
            unitCode: r.unitCode,
            openAmountEtb: Math.round(r.totalReceivableCents) / 100,
            daysOverdue: maxDays,
            bucket,
          };
        });

      const paged = overdueItems.slice(offset, offset + limit);
      const data: Record<string, unknown> = {
        ownerId: ctx.ownerId,
        isSyntheticFixture: true,
        totalArrearsEtb: Math.round(ageing.totalReceivableCents) / 100,
        buckets: {
          d1_30: Math.round(ageing.total1to30Cents) / 100,
          d31_60: Math.round(ageing.total31to60Cents) / 100,
          d61_90: Math.round(ageing.total61to90Cents) / 100,
          d90Plus: Math.round(ageing.total90PlusCents) / 100,
        },
        pagination: {
          total: overdueItems.length,
          limit,
          offset,
          hasMore: offset + paged.length < overdueItems.length,
        },
      };

      if (ctx.decision === 'Allow') {
        data.items = paged;
      }

      return { rowCount: paged.length, data };
    }

    case 'get_audit_summary': {
      const limit = clampLimit(ctx.params.limit, 25);
      const offset = clampOffset(ctx.params.offset);
      const decisionFilter =
        typeof ctx.params.decision === 'string' ? ctx.params.decision.trim().toUpperCase() : null;
      const channelFilter =
        typeof ctx.params.channel === 'string' ? ctx.params.channel.trim().toUpperCase() : null;

      // Never expose another owner's audit rows: filter strictly to resolved ownerId
      // unless actor explicitly allows cross-owner inspection and did not pass ownerId filter
      const filterOwnerId =
        typeof ctx.params.ownerId === 'string' && ctx.params.ownerId.trim().length > 0
          ? ctx.ownerId
          : ctx.binding.allowedOwners.length === 1
            ? ctx.ownerId
            : null;

      const summary = queryMcpAuditSummary(ctx.store.getDatabase(), {
        ownerId: filterOwnerId,
        channel: channelFilter,
        decision: decisionFilter,
        limit,
        offset,
      });

      return {
        rowCount: summary.recentEvents.length,
        data: {
          ...summary,
          isSyntheticFixture: true,
        },
      };
    }
  }
}
