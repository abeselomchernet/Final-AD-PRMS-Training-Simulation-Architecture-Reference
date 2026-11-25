import { describe, expect, it } from 'vitest';
import { createInitialSeedState } from '../../src/data/seedData';
import { UI_LABELS } from '../../src/data/i18n';
import { TRAINING_ACCOUNTS, TRAINING_EXERCISES } from '../../src/data/trainingCatalog';
import { checkApprovalAuthority, getModuleAccess } from '../../src/policies/rbac';
import { NavSection, PersonaRole } from '../../src/types/prms';

const ALL_22_SECTIONS: NavSection[] = [
  'dashboard',
  'owners',
  'portfolio',
  'rental-applications',
  'tenants-leases',
  'collections',
  'expenses',
  'maintenance',
  'finance',
  'tax',
  'compliance',
  'approvals',
  'audit',
  'admin',
  'backup-recovery',
  'migration',
  'reports',
  'requirements-acceptance',
  'training-exercises',
  'system-demonstration',
  'security-architecture',
  'visual-qa',
  'governance',
];

const ALL_10_ROLES: PersonaRole[] = [
  'Owner / Director',
  'General Manager',
  'Assistant Manager',
  'Finance Officer',
  'Clerk',
  'Collections Clerk',
  'Property Clerk',
  'System Administrator',
  'Auditor / Read-only reviewer',
  'Training Coordinator',
];

describe('Full Platform Governance, Referential Integrity & Isolation Audit', () => {
  it('enforces same-owner referential integrity across properties, buildings, units, leases, charges, and receipts', () => {
    const seed = createInitialSeedState();

    const ownerIds = new Set(seed.owners.map((o) => o.id));
    expect(ownerIds).toEqual(new Set(['OWN-ALPHA', 'OWN-BETA']));

    const propMap = new Map(seed.properties.map((p) => [p.id, p]));
    const buildingMap = new Map(seed.buildings.map((b) => [b.id, b]));
    const unitMap = new Map(seed.units.map((u) => [u.id, u]));
    const tenantMap = new Map(seed.tenants.map((t) => [t.id, t]));
    const leaseMap = new Map(seed.leases.map((l) => [l.id, l]));
    const chargeMap = new Map(seed.charges.map((c) => [c.id, c]));

    for (const b of seed.buildings) {
      const prop = propMap.get(b.propertyId);
      expect(prop).toBeDefined();
      expect(prop!.ownerId).toBe(b.ownerId);
    }

    for (const u of seed.units) {
      const prop = propMap.get(u.propertyId);
      const bld = buildingMap.get(u.buildingId);
      expect(prop).toBeDefined();
      expect(bld).toBeDefined();
      expect(prop!.ownerId).toBe(u.ownerId);
      expect(bld!.ownerId).toBe(u.ownerId);
    }

    for (const l of seed.leases) {
      const unit = unitMap.get(l.unitId);
      const tenant = tenantMap.get(l.tenantId);
      expect(unit).toBeDefined();
      expect(tenant).toBeDefined();
      expect(unit!.ownerId).toBe(l.ownerId);
      expect(tenant!.ownerId).toBe(l.ownerId);
    }

    for (const c of seed.charges) {
      const lease = leaseMap.get(c.leaseId);
      const tenant = tenantMap.get(c.tenantId);
      const unit = unitMap.get(c.unitId);
      expect(lease).toBeDefined();
      expect(tenant).toBeDefined();
      expect(unit).toBeDefined();
      expect(lease!.ownerId).toBe(c.ownerId);
      expect(tenant!.ownerId).toBe(c.ownerId);
      expect(unit!.ownerId).toBe(c.ownerId);
    }

    for (const r of seed.receipts) {
      const tenant = tenantMap.get(r.tenantId);
      expect(tenant).toBeDefined();
      expect(tenant!.ownerId).toBe(r.ownerId);
      for (const alloc of r.allocations) {
        const ch = chargeMap.get(alloc.chargeId);
        expect(ch).toBeDefined();
        expect(ch!.ownerId).toBe(r.ownerId);
      }
    }

    for (const app of seed.rentalApplications) {
      const unit = unitMap.get(app.requestedUnitId);
      expect(unit).toBeDefined();
      expect(unit!.ownerId).toBe(app.ownerId);
    }

    for (const ticket of seed.maintenanceTickets) {
      const unit = unitMap.get(ticket.unitId);
      expect(unit).toBeDefined();
      expect(unit!.ownerId).toBe(ticket.ownerId);
      if (ticket.tenantId) {
        const tenant = tenantMap.get(ticket.tenantId);
        expect(tenant).toBeDefined();
        expect(tenant!.ownerId).toBe(ticket.ownerId);
      }
    }

    for (const gp of seed.gatewayPayments) {
      const tenant = tenantMap.get(gp.tenantId);
      const unit = unitMap.get(gp.unitId);
      const charge = chargeMap.get(gp.chargeId);
      expect(tenant).toBeDefined();
      expect(unit).toBeDefined();
      expect(charge).toBeDefined();
      expect(tenant!.ownerId).toBe(gp.ownerId);
      expect(unit!.ownerId).toBe(gp.ownerId);
      expect(charge!.ownerId).toBe(gp.ownerId);
    }

    const ticketMap = new Map(seed.maintenanceTickets.map((m) => [m.id, m]));
    for (const msg of seed.maintenanceMessages) {
      const ticket = ticketMap.get(msg.ticketId);
      expect(ticket).toBeDefined();
      expect(ticket!.ownerId).toBe(msg.ownerId);
    }

    for (const sms of seed.smsLogs) {
      const tenant = tenantMap.get(sms.tenantId);
      expect(tenant).toBeDefined();
      expect(tenant!.ownerId).toBe(sms.ownerId);
    }

    for (const pref of seed.tenantPrefs) {
      const tenant = tenantMap.get(pref.tenantId);
      expect(tenant).toBeDefined();
      expect(tenant!.ownerId).toBe(pref.ownerId);
    }

    const ownerScopedArrays: { name: string; rows: { ownerId: string }[] }[] = [
      { name: 'expenses', rows: seed.expenses },
      { name: 'delegations', rows: seed.delegations },
      { name: 'quarterlyAccessReviews', rows: seed.quarterlyAccessReviews },
      { name: 'taxRules', rows: seed.taxRules },
      { name: 'researchRequirements', rows: seed.researchRequirements },
      { name: 'sourceRecords', rows: seed.sourceRecords },
      { name: 'adviserQuestions', rows: seed.adviserQuestions },
      { name: 'productionGates', rows: seed.productionGates },
      { name: 'retentionClasses', rows: seed.retentionClasses },
      { name: 'backupPolicies', rows: seed.backupPolicies },
      { name: 'backupDrills', rows: seed.backupDrills },
      { name: 'migrationBatches', rows: seed.migrationBatches },
      { name: 'migrationMappings', rows: seed.migrationMappings },
      { name: 'requirementsTraceability', rows: seed.requirementsTraceability },
      { name: 'auditEvents', rows: seed.auditEvents },
      { name: 'gatewayPayments', rows: seed.gatewayPayments },
      { name: 'maintenanceMessages', rows: seed.maintenanceMessages },
      { name: 'tenantNotices', rows: seed.tenantNotices },
      { name: 'smsLogs', rows: seed.smsLogs },
      { name: 'tenantPrefs', rows: seed.tenantPrefs },
    ];

    for (const col of ownerScopedArrays) {
      expect(col.rows.some((r) => r.ownerId === 'OWN-ALPHA'), `${col.name} missing OWN-ALPHA`).toBe(true);
      expect(col.rows.some((r) => r.ownerId === 'OWN-BETA'), `${col.name} missing OWN-BETA`).toBe(true);
      for (const r of col.rows) {
        expect(['OWN-ALPHA', 'OWN-BETA'], `Invalid ownerId in ${col.name}`).toContain(r.ownerId);
      }
    }
  });

  it('maintains double-entry debit === credit balance on every prototype journal entry', () => {
    const seed = createInitialSeedState();
    expect(seed.journalEntries.length).toBeGreaterThan(0);

    for (const je of seed.journalEntries) {
      const totalDebit = je.lines.reduce((sum, l) => sum + l.debitEtb, 0);
      const totalCredit = je.lines.reduce((sum, l) => sum + l.creditEtb, 0);
      expect(totalDebit).toBeGreaterThan(0);
      expect(totalDebit).toBe(totalCredit);
      expect(je.status).toBe('Prototype / Planned Capability');
    }
  });

  it('confirms zero historical self-approval or prohibited System Admin approvals exist in seeded approval requests', () => {
    const seed = createInitialSeedState();
    for (const req of seed.approvals) {
      expect(['OWN-ALPHA', 'OWN-BETA']).toContain(req.ownerId);
      expect(req.makerActorId).toBeTruthy();

      for (const entry of req.decisionLog) {
        if (entry.action !== 'Submitted') {
          if (entry.actorId) {
            expect(entry.actorId).not.toBe(req.makerActorId);
          }
          expect(entry.persona).not.toBe('System Administrator');
          expect(entry.persona).not.toBe('Auditor / Read-only reviewer');
          expect(entry.persona).not.toBe('Training Coordinator');
        }
      }

      // Verify maker is always blocked by live policy function too
      const selfCheck = checkApprovalAuthority(req.makerPersona, req, req.makerActorId);
      expect(selfCheck.allowed).toBe(false);
    }
  });

  it('ensures every NavSection has defined RBAC access rules across all 10 roles and complete i18n keys', () => {
    for (const role of ALL_10_ROLES) {
      for (const section of ALL_22_SECTIONS) {
        const access = getModuleAccess(role, section);
        expect(typeof access.enabled).toBe('boolean');
        expect(access.reason.length).toBeGreaterThan(5);
      }
    }

    // Verify all navigation label keys exist in both English & Amharic
    const navKeys = [
      'navDashboard',
      'navOwners',
      'navPortfolio',
      'navRentalApplications',
      'navTenantsLeases',
      'navCollections',
      'navExpenses',
      'navMaintenance',
      'navFinance',
      'navTax',
      'navCompliance',
      'navApprovals',
      'navAudit',
      'navAdmin',
      'navBackupRecovery',
      'navMigration',
      'navReports',
      'navRequirementsAcceptance',
      'navTrainingExercises',
      'navSystemDemonstration',
      'navSecurityArchitecture',
      'navVisualQa',
      'navGovernance',
    ];
    for (const k of navKeys) {
      expect(UI_LABELS.en[k]).toBeTruthy();
      expect(UI_LABELS.am[k]).toBeTruthy();
    }
  });

  it('validates unique training account credentials, actor IDs, and valid exercise target modules', () => {
    const usernames = new Set(TRAINING_ACCOUNTS.map((a) => a.username));
    const actorIds = new Set(TRAINING_ACCOUNTS.map((a) => a.actorId));
    expect(usernames.size).toBe(TRAINING_ACCOUNTS.length);
    expect(actorIds.size).toBe(TRAINING_ACCOUNTS.length);

    for (const ex of TRAINING_EXERCISES) {
      expect(ALL_22_SECTIONS).toContain(ex.targetSection);
      expect(usernames.has(ex.recommendedUsername)).toBe(true);
      expect(ex.steps.length).toBeGreaterThan(0);
    }
  });
});
