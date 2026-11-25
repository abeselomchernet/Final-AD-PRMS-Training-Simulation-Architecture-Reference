import { describe, expect, it } from 'vitest';
import {
  DEMO_SCENARIOS,
  formatAmharicCueHandout,
  STAKEHOLDER_CHAPTERS,
} from '../../src/data/demoWalkthroughs';
import { getModuleAccess } from '../../src/policies/rbac';

describe('System Demonstration Bilingual Walkthrough Catalog', () => {
  it('covers all four inaugural stakeholder chapters (owner, gm, finance, clerks) and required flagship workflows', () => {
    const chapterIds = STAKEHOLDER_CHAPTERS.map((c) => c.id);
    expect(chapterIds).toEqual(['all', 'owner', 'gm', 'finance', 'clerks']);

    const titles = DEMO_SCENARIOS.map((s) => s.titleEn);
    expect(titles.some((t) => /Maker-Checker Approval/i.test(t))).toBe(true);
    expect(titles.some((t) => /Tenant Rental Collection/i.test(t))).toBe(true);

    for (const stakeholder of ['owner', 'gm', 'finance', 'clerks'] as const) {
      expect(
        DEMO_SCENARIOS.some((s) => s.stakeholders.includes(stakeholder)),
        `Expected at least one walkthrough covering ${stakeholder}`
      ).toBe(true);
    }
  });

  it('includes complete Amharic speaking scripts, English governance cues, and valid target modules for every keyframe', () => {
    expect(DEMO_SCENARIOS.length).toBe(5);

    for (const scenario of DEMO_SCENARIOS) {
      expect(scenario.titleAm.trim().length).toBeGreaterThan(5);
      expect(scenario.summaryAm.trim().length).toBeGreaterThan(10);
      expect(scenario.keyframes.length).toBe(4);
      expect(getModuleAccess('General Manager', scenario.targetSection).enabled).toBe(true);

      for (const kf of scenario.keyframes) {
        expect(kf.titleAm.trim().length).toBeGreaterThan(4);
        expect(kf.amharicScript.trim().length).toBeGreaterThan(20);
        expect(kf.englishCue.trim().length).toBeGreaterThan(15);
        expect(kf.liveProofValue.trim().length).toBeGreaterThan(3);
      }
    }
  });

  it('formats a complete Amharic-English presenter cue handout script cleanly', () => {
    const handout = formatAmharicCueHandout(DEMO_SCENARIOS);
    expect(handout).toContain('ምዕራፍ 01:');
    expect(handout).toContain('Maker-Checker Approval & Self-Void Guard');
    expect(handout).toContain('Tenant Rental Collection (Telebirr, ArifPay & CBE Slip)');
    expect(handout).toContain('Amharic Script:');
  });
});
