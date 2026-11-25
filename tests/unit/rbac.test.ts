import { describe, expect, it } from 'vitest';
import {
  canSwitchOwnerForRole,
  checkActionPermission,
  checkApprovalAuthority,
  getModuleAccess,
  PERMISSION_MATRIX,
  ROLE_AUTHORITY_CATALOG,
} from '../../src/policies/rbac';
import { createInitialSeedState } from '../../src/data/seedData';
import { PersonaRole } from '../../src/types/prms';

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

describe('RBAC & Segregation of Duties Policies', () => {
  it('defines authority catalog specifications for all 10 roles', () => {
    const catalogRoles = ROLE_AUTHORITY_CATALOG.map((r) => r.role);
    for (const role of ALL_10_ROLES) {
      expect(catalogRoles).toContain(role);
    }
    expect(PERMISSION_MATRIX.length).toBeGreaterThanOrEqual(8);
  });

  it('strictly blocks System Administrator from business, tax, accounting, and approval actions', () => {
    expect(checkActionPermission('System Administrator', 'record_payment').allowed).toBe(false);
    expect(checkActionPermission('System Administrator', 'draft_tax_rule').allowed).toBe(false);
    expect(checkActionPermission('System Administrator', 'create_lease').allowed).toBe(false);
    expect(checkActionPermission('System Administrator', 'request_role_assignment').allowed).toBe(true);

    const seed = createInitialSeedState();
    const pendingReq = seed.approvals.find((a) => a.id === 'APR-1001')!;
    const roleAssignReq = seed.approvals.find((a) => a.id === 'APR-1004')!;

    expect(checkApprovalAuthority('System Administrator', pendingReq, 'USR-SYNTH-06').allowed).toBe(false);
    expect(checkApprovalAuthority('System Administrator', roleAssignReq, 'USR-SYNTH-06').allowed).toBe(false);
  });

  it('prohibits Actor-ID self-approval and same-maker-persona self-approval', () => {
    const seed = createInitialSeedState();
    const financeReq = seed.approvals.find((a) => a.id === 'APR-1002')!;

    // Same Actor ID (USR-SYNTH-03) cannot approve their own submission
    const sameActorResult = checkApprovalAuthority('Finance Officer', financeReq, 'USR-SYNTH-03');
    expect(sameActorResult.allowed).toBe(false);
    expect(sameActorResult.reason.toLowerCase()).toContain('self-approval');

    // Different Actor ID with same maker persona is also blocked
    const sameRoleResult = checkApprovalAuthority('Finance Officer', financeReq, 'USR-SYNTH-99');
    expect(sameRoleResult.allowed).toBe(false);

    // Authorized GM checker (USR-SYNTH-02) can perform Step 1 review
    const gmResult = checkApprovalAuthority('General Manager', financeReq, 'USR-SYNTH-02');
    expect(gmResult.allowed).toBe(true);
  });

  it('enforces multi-step separation of duties (Step 1 reviewer cannot approve Step 2)', () => {
    const seed = createInitialSeedState();
    const baseReq = seed.approvals.find((a) => a.id === 'APR-1002')!;
    const step2Req = {
      ...baseReq,
      currentStep: 2,
      status: 'In Review' as const,
      decisionLog: [
        ...baseReq.decisionLog,
        {
          timestamp: '2026-11-13 10:00',
          actor: 'Demo General Manager',
          actorId: 'USR-SYNTH-02',
          persona: 'General Manager' as PersonaRole,
          action: 'Reviewed (Step 1)' as const,
          comment: 'Step 1 cleared',
        },
      ],
    };

    expect(checkApprovalAuthority('General Manager', step2Req, 'USR-SYNTH-02').allowed).toBe(false);
    expect(checkApprovalAuthority('Owner / Director', step2Req, 'USR-SYNTH-01').allowed).toBe(true);
  });

  it('prevents finalized approvals from being re-approved or modified', () => {
    const seed = createInitialSeedState();
    const finalizedReq = seed.approvals.find((a) => a.id === 'APR-1005')!;
    expect(finalizedReq.finalized).toBe(true);
    expect(checkApprovalAuthority('Owner / Director', finalizedReq, 'USR-SYNTH-01').allowed).toBe(false);
  });

  it('enforces owner-scoped temporary delegations strictly within matching ownerId', () => {
    const seed = createInitialSeedState();
    const unitReq = seed.approvals.find((a) => a.id === 'APR-1001')!;
    const mockBetaReq = {
      ...unitReq,
      id: 'APR-BETA-MOCK',
      ownerId: 'OWN-BETA' as const,
      requiredCheckerRoles: ['General Manager' as PersonaRole],
    };
    const alphaDelegation = seed.delegations.filter((d) => d.ownerId === 'OWN-ALPHA' && d.status === 'Active');

    // Beta request cannot be approved using an Alpha delegation
    const crossOwnerCheck = checkApprovalAuthority(
      'Assistant Manager',
      { ...mockBetaReq, category: 'Account Change' },
      'USR-SYNTH-03',
      alphaDelegation
    );
    expect(crossOwnerCheck.allowed).toBe(false);
  });

  it('restricts Auditor and Training Coordinator to read-only / acceptance / export actions', () => {
    for (const role of ['Auditor / Read-only reviewer', 'Training Coordinator'] as PersonaRole[]) {
      expect(checkActionPermission(role, 'record_payment').allowed).toBe(false);
      expect(checkActionPermission(role, 'create_lease').allowed).toBe(false);
      expect(checkActionPermission(role, 'export_report').allowed).toBe(true);
      expect(checkActionPermission(role, 'run_acceptance_test').allowed).toBe(true);
    }
  });

  it('locks Owner / Director to OWN-ALPHA and enforces single-owner scope controls', () => {
    const ownerScope = canSwitchOwnerForRole('Owner / Director');
    expect(ownerScope.canSwitch).toBe(false);
    expect(ownerScope.allowedOwners).toEqual(['OWN-ALPHA']);

    const gmScope = canSwitchOwnerForRole('General Manager');
    expect(gmScope.canSwitch).toBe(true);
    expect(gmScope.allowedOwners).toEqual(['OWN-ALPHA', 'OWN-BETA']);
  });

  it('gates prohibited modules for specialized roles', () => {
    expect(getModuleAccess('Collections Clerk', 'tax').enabled).toBe(false);
    expect(getModuleAccess('Property Clerk', 'finance').enabled).toBe(false);
    expect(getModuleAccess('System Administrator', 'collections').enabled).toBe(false);
    expect(getModuleAccess('System Administrator', 'admin').enabled).toBe(true);
    expect(getModuleAccess('Clerk', 'collections').accessMode).toBe('Maker');
    expect(getModuleAccess('Auditor / Read-only reviewer', 'finance').accessMode).toBe('Read Only');
  });
});
