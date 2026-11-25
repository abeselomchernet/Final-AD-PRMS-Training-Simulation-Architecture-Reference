import { describe, expect, it } from 'vitest';
import { createInitialSeedState } from '../../src/data/seedData';
import { TRAINING_ACCOUNTS, TRAINING_EXERCISES } from '../../src/data/trainingCatalog';

describe('Synthetic Seed Data, Owner Isolation & Compliance Safety Gates', () => {
  it('enforces strict ownerId scoping on all owner-owned collections including sourceRecords', () => {
    const seed = createInitialSeedState();

    const alphaSources = seed.sourceRecords.filter((s) => s.ownerId === 'OWN-ALPHA');
    const betaSources = seed.sourceRecords.filter((s) => s.ownerId === 'OWN-BETA');

    expect(alphaSources.length).toBeGreaterThan(0);
    expect(betaSources.length).toBeGreaterThan(0);

    // Every source record has a valid ownerId and zero shared IDs across owners
    const alphaIds = new Set(alphaSources.map((s) => s.id));
    for (const beta of betaSources) {
      expect(alphaIds.has(beta.id)).toBe(false);
    }

    for (const src of seed.sourceRecords) {
      expect(['OWN-ALPHA', 'OWN-BETA']).toContain(src.ownerId);
    }
  });

  it('contains separate synthetic portfolios for OWN-ALPHA and OWN-BETA with zero active tax rules', () => {
    const seed = createInitialSeedState();

    expect(seed.owners.map((o) => o.id)).toEqual(['OWN-ALPHA', 'OWN-BETA']);
    expect(seed.properties.some((p) => p.ownerId === 'OWN-ALPHA')).toBe(true);
    expect(seed.properties.some((p) => p.ownerId === 'OWN-BETA')).toBe(true);

    // Non-negotiable: Zero active tax configurations in prototype
    for (const taxRule of seed.taxRules) {
      expect(taxRule.lifecycleStage).not.toBe('Active');
    }

    // Production gates remain blocked in prototype
    for (const gate of seed.productionGates) {
      expect(gate.status).not.toBe('Approved');
    }
  });

  it('locks Directive 1142/2026 e-invoice metadata in non-submitted placeholder mode across seed records', () => {
    const seed = createInitialSeedState();
    const withMeta = seed.ledgerJournals.filter((j) => Boolean(j.eInvoiceMetadata));
    expect(withMeta.length).toBeGreaterThan(0);
    for (const j of withMeta) {
      expect(j.eInvoiceMetadata?.directiveRef).toBe('Directive 1142/2026');
      expect(j.eInvoiceMetadata?.submissionStatus).toBe('Not Submitted — Adapter Locked');
    }
    for (const cfg of seed.ledgerConfigs) {
      expect(cfg.enableLiveTaxInvoicing).toBe(false);
    }
  });

  it('seeds all 10 synthetic training accounts and 22 guided training exercises (10 baseline + 12 accounting/tax)', () => {
    expect(TRAINING_ACCOUNTS).toHaveLength(10);
    expect(TRAINING_EXERCISES).toHaveLength(22);
    const trainers = TRAINING_ACCOUNTS.filter((a) => a.isTrainer);
    expect(trainers).toHaveLength(1);
    expect(trainers[0].username).toBe('trainer.demo');
  });
});
