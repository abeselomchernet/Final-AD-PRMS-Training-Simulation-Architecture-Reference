import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrmsProvider, usePrms } from '../../src/context/PrmsContext';
import { DEMO_SCENARIOS } from '../../src/data/demoWalkthroughs';
import { SystemDemonstrationPage } from '../../src/pages/SystemDemonstrationPage';

const STORAGE_KEY = 'ad_prms_demo_completed_chapters_v1';

const LivePaymentTrigger: React.FC = () => {
  const { ownerTenants, ownerCharges, recordPayment, loginWithTrainingAccount } = usePrms();

  const triggerLiveCollection = () => {
    const firstOpenCharge = ownerCharges.find((c) => c.billedEtb - c.paidEtb > 0);
    const tenant = ownerTenants.find((t) => t.id === firstOpenCharge?.tenantId) || ownerTenants[0];
    if (!tenant || !firstOpenCharge) return;

    const outstandingEtb = firstOpenCharge.billedEtb - firstOpenCharge.paidEtb;
    const payAmount = Math.min(1000, outstandingEtb);

    recordPayment({
      tenantId: tenant.id,
      amountEtb: payAmount,
      method: 'Telebirr (Synthetic)',
      paymentDate: '2026-11-20',
      referencePlaceholder: 'SYNTH-TELEBIRR-DEMO-999',
      allocations: [
        {
          chargeId: firstOpenCharge.id,
          amountEtb: payAmount,
        },
      ],
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => loginWithTrainingAccount('collections.demo', 'TRAIN-COL-2026!')}
      >
        Sign In Collections Clerk
      </button>
      <button type="button" onClick={triggerLiveCollection}>
        Trigger Live Telebirr Payment
      </button>
    </div>
  );
};

describe('SystemDemonstrationPage — Transcript, Live Walkthrough Status & Progress Tracker', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('toggles dynamic bilingual Amharic & English Transcript panel for the active video chapter', () => {
    render(
      <PrmsProvider>
        <SystemDemonstrationPage />
      </PrmsProvider>
    );

    const toggleBtn = screen.getByTestId('transcript-toggle-btn');
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('demo-transcript-panel')).not.toBeInTheDocument();

    // Open Transcript (defaults to docked right-hand side-panel)
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    const transcriptPanel = screen.getByTestId('demo-transcript-panel');
    expect(transcriptPanel).toBeInTheDocument();
    expect(transcriptPanel).toHaveAttribute('data-transcript-mode', 'side');
    expect(transcriptPanel.textContent).toContain(DEMO_SCENARIOS[0].keyframes[0].amharicScript);
    expect(transcriptPanel.textContent).toContain(DEMO_SCENARIOS[0].keyframes[0].englishCue);

    // Switch side-panel into floating overlay mode and re-dock via Escape
    fireEvent.click(screen.getByTestId('transcript-layout-mode-btn'));
    expect(transcriptPanel).toHaveAttribute('data-transcript-mode', 'overlay');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(transcriptPanel).toHaveAttribute('data-transcript-mode', 'side');

    // Clicking step 3 in transcript marks it as current step
    fireEvent.click(screen.getByTestId('transcript-step-3'));
    expect(screen.getByTestId('transcript-step-3')).toHaveAttribute('aria-current', 'step');
    expect(transcriptPanel.textContent).toContain(DEMO_SCENARIOS[0].keyframes[2].amharicScript);

    // Switching to Tenant Rental Collection updates transcript narration dynamically
    fireEvent.click(
      screen.getByRole('button', { name: /Tenant Rental Collection/i })
    );
    expect(transcriptPanel.textContent).toContain(DEMO_SCENARIOS[1].keyframes[0].amharicScript);
    expect(transcriptPanel.textContent).toContain(DEMO_SCENARIOS[1].keyframes[0].englishCue);

    // Toggle closes Transcript
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('demo-transcript-panel')).not.toBeInTheDocument();
  });

  it('tracks completed executive chapters (Owner, GM, Finance Head, Clerk), persists across remounts, and resets', () => {
    const { unmount } = render(
      <PrmsProvider>
        <SystemDemonstrationPage />
      </PrmsProvider>
    );

    const tracker = screen.getByTestId('demo-progress-tracker');
    expect(tracker).toBeInTheDocument();
    expect(screen.getByTestId('demo-progress-summary').textContent).toContain('0 / 4 Chapters · 0%');

    // Switch to Owner tab and use active-chapter complete button
    fireEvent.click(screen.getByRole('tab', { name: /^Owner/i }));
    fireEvent.click(screen.getByTestId('mark-active-chapter-complete-btn'));
    expect(screen.getByTestId('demo-progress-summary').textContent).toContain('1 / 4 Chapters · 25%');

    // Complete GM, Finance Head, and Clerk directly via tracker controls
    fireEvent.click(screen.getByTestId('progress-chapter-gm'));
    fireEvent.click(screen.getByTestId('progress-chapter-finance'));
    fireEvent.click(screen.getByTestId('progress-chapter-clerks'));

    expect(screen.getByTestId('demo-progress-summary').textContent).toContain('4 / 4 Chapters · 100%');
    expect(within(tracker).getByText(/Completed/i)).toBeInTheDocument();

    // Unmount and remount to verify localStorage persistence
    unmount();
    render(
      <PrmsProvider>
        <SystemDemonstrationPage />
      </PrmsProvider>
    );

    expect(screen.getByTestId('demo-progress-summary').textContent).toContain('4 / 4 Chapters · 100%');
    expect(screen.getByTestId('progress-chapter-owner')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('progress-chapter-clerks')).toHaveAttribute('aria-pressed', 'true');

    // Reset Progress clears saved completion state
    fireEvent.click(screen.getByTestId('reset-demo-progress-btn'));
    expect(screen.getByTestId('demo-progress-summary').textContent).toContain('0 / 4 Chapters · 0%');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('renders real live PRMS system status on Curated System Walkthroughs and updates when state changes', () => {
    render(
      <PrmsProvider>
        <LivePaymentTrigger />
        <SystemDemonstrationPage />
      </PrmsProvider>
    );

    const makerCheckerStatus = screen.getByTestId('walkthrough-live-status-demo-maker-checker');
    const tenantCollectionStatus = screen.getByTestId('walkthrough-live-status-demo-tenant-collection');
    const threeWayStatus = screen.getByTestId('walkthrough-live-status-demo-three-way-deposit');
    const ownerMobileStatus = screen.getByTestId('walkthrough-live-status-demo-owner-mobile');
    const ercaStatus = screen.getByTestId('walkthrough-live-status-demo-erca-tax');

    expect(makerCheckerStatus.textContent).toMatch(/Pending · .* Approved · .* Audit Logs/);
    expect(threeWayStatus.textContent).toMatch(/3-Way Balanced · GL 2120 .* · .* Closed/);
    expect(ownerMobileStatus.textContent).toMatch(/\d+ Buildings? · \d+\/\d+ Occupied/);
    expect(ercaStatus.textContent).toMatch(/Adviser Confirmed · .* Backup Drills/);

    const initialCollectionText = tenantCollectionStatus.textContent || '';
    const matchBefore = initialCollectionText.match(/(\d+) Receipts/);
    expect(matchBefore).not.toBeNull();
    const receiptsBefore = Number(matchBefore![1]);

    // Trigger a live payment in PrmsContext and verify the Curated Walkthrough status updates reactively
    fireEvent.click(screen.getByRole('button', { name: /Sign In Collections Clerk/i }));
    fireEvent.click(screen.getByRole('button', { name: /Trigger Live Telebirr Payment/i }));

    const updatedCollectionText =
      screen.getByTestId('walkthrough-live-status-demo-tenant-collection').textContent || '';
    const matchAfter = updatedCollectionText.match(/(\d+) Receipts/);
    expect(matchAfter).not.toBeNull();
    expect(Number(matchAfter![1])).toBe(receiptsBefore + 1);
  });
});
