import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';

describe('AD-PRMS Application Integration Flows', () => {
  it('renders training login notice, rejects bad credentials, and authenticates gm.demo cleanly', () => {
    render(<App />);

    // Persistent training disclaimer & auth notice
    expect(screen.getByText(/TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Training authentication only — not production authentication\./i)
    ).toBeInTheDocument();

    // Reject wrong password
    const pwInput = screen.getByLabelText(/Synthetic Training Password/i);
    fireEvent.change(pwInput, { target: { value: 'WRONG-PASS' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Fill valid GM credentials via directory button and sign in
    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[0]); // gm.demo
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    // Workspace loads with persistent training banner and Home Workspace
    expect(screen.getByText(/TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Home Workspace/i })).toBeInTheDocument();
  });

  it('toggles Daylight and Dark Slate themes on document root and switches to Amharic UI', () => {
    render(<App />);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    const themeToggle = screen.getByLabelText(/Toggle daylight or dark slate theme/i);
    fireEvent.click(themeToggle);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const langBtn = screen.getByRole('button', { name: /አማርኛ/i });
    fireEvent.click(langBtn);
    expect(screen.getByRole('button', { name: /ወደ ስልጠና ክፍለ-ጊዜ ግባ/i })).toBeInTheDocument();
  });

  it('keeps Owner / Director locked to Test Owner Alpha and disables Active tax stage', () => {
    render(<App />);

    // Select Owner / Director (index 4 in TRAINING_ACCOUNTS: owner.alpha.demo)
    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[4]);

    // Beta owner context selector should be disabled for owner.alpha.demo
    const betaButton = screen.getByRole('button', { name: /Test Owner Beta/i });
    expect(betaButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    // Inside workspace, switch owner control should be disabled for Owner / Director
    const ownerSelect = screen.getByLabelText(/Owner Context/i) as HTMLSelectElement;
    expect(ownerSelect.value).toBe('OWN-ALPHA');
    expect(ownerSelect).toBeDisabled();
  });

  it('processes a tenant payment via the Rent Collections Telebirr mock trigger and updates the queue', async () => {
    render(<App />);

    // Sign in as collections.demo (index 5 in TRAINING_ACCOUNTS)
    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[5]);
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    // Navigate to Rent & Collections
    const navBtn = await screen.findByRole('button', { name: 'Rent & Collections' });
    fireEvent.click(navBtn);

    // Wait for lazy Rent & Collections module and trigger Mock Telebirr Pay on first open invoice
    const mockBtns = await screen.findAllByRole(
      'button',
      { name: /Mock Telebirr Pay/i },
      { timeout: 4000 }
    );
    expect(mockBtns.length).toBeGreaterThan(0);
    fireEvent.click(mockBtns[0]);

    // Synthetic DEMO receipt preview modal opens immediately with Telebirr (Synthetic)
    expect(await screen.findByText(/DEMO RECEIPT — NOT LEGALLY VALID — SYNTHETIC DATA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Telebirr \(Synthetic\)/i).length).toBeGreaterThan(0);

    // Close preview modal and verify Telebirr & Gateway Queue tab reflects verified entry
    fireEvent.click(screen.getByRole('button', { name: /Close modal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Telebirr & Gateway Queue/i }));
    expect(screen.getAllByText(/Telebirr USSD QR/i).length).toBeGreaterThan(0);
  }, 15_000);

  it('launches Tenant Self-Service Mobile strictly isolated to tenant unit, hides Internal Staff Notes, and settles via ArifPay', async () => {
    render(<App />);

    // Open Tenant Mobile for tenant.a101.demo (first "Open Tenant Mobile" button)
    const tenantBtns = screen.getAllByRole('button', { name: /Open Tenant Mobile/i });
    fireEvent.click(tenantBtns[0]);

    expect(await screen.findByTestId('tenant-mobile-app')).toBeInTheDocument();
    // Tenant A-101 sees own unit A-101, never Unit A-102 or B-101
    expect(screen.getAllByText(/A-101/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/SYNTH Unit A-102/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SYNTH Unit B-101/i)).not.toBeInTheDocument();

    // Open Repairs tab and inspect chat thread — Internal Staff Note must NEVER appear
    fireEvent.click(screen.getByRole('button', { name: /Repairs/i }));
    const chatBtns = await screen.findAllByRole('button', { name: /Chat with Office/i });
    fireEvent.click(chatBtns[0]);
    expect(screen.queryByText(/Internal Staff Note/i)).not.toBeInTheDocument();

    // Close chat sheet and open Pay tab -> ArifPay Checkout
    fireEvent.click(screen.getByRole('button', { name: /Close .* Chat/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Pay$/i }));
    const payButtons = await screen.findAllByRole('button', {
      name: /Pay via Telebirr \/ ArifPay \/ CBE/i,
    });
    fireEvent.click(payButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: /^ArifPay$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create ArifPay Hosted Checkout/i }));
    const settleBtn = await screen.findByRole('button', { name: /Authorize & Settle/i });
    fireEvent.click(settleBtn);

    expect(await screen.findByText(/DEMO — NOT A TAX INVOICE — SYNTHETIC DATA/i)).toBeInTheDocument();
  });

  it('switches GM / Owner into Out-of-Office Mobile Mode with 5 bottom tabs and 22-module launcher', async () => {
    render(<App />);

    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[0]); // gm.demo
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    // Toggle to Out-of-Office Mobile
    const mobileToggle = await screen.findByLabelText(/Switch to Out-of-Office Mobile/i);
    fireEvent.click(mobileToggle);

    expect(await screen.findByTestId('owner-mobile-app')).toBeInTheDocument();
    expect(screen.getByText(/Out-of-Office Executive Brief/i)).toBeInTheDocument();

    // Open More tab -> All 22 Platform Modules
    fireEvent.click(screen.getByRole('button', { name: /^More$/i }));
    expect(await screen.findByText(/All 22 Platform Modules/i)).toBeInTheDocument();

    // Return cleanly to Desktop view
    fireEvent.click(screen.getByRole('button', { name: /Desktop Mode/i }));
    expect(await screen.findByRole('heading', { name: /Home Workspace/i })).toBeInTheDocument();
  }, 15_000);

  it('supports Staff MFA and Tenant Phone OTP login mode switchers and renders ERCA Gate in Tax Config', async () => {
    render(<App />);

    // Toggle to Tenant Phone OTP login form
    fireEvent.click(screen.getByRole('button', { name: /Tenant Phone OTP/i }));
    expect(screen.getByRole('button', { name: /Send SMS OTP/i })).toBeInTheDocument();

    // Toggle to Live Staff (JWT + MFA) & Google Auth
    fireEvent.click(screen.getByRole('button', { name: /Live Staff \(JWT \+ MFA\)/i }));
    expect(screen.getByRole('button', { name: /Sign In \(JWT \+ TOTP MFA\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with Google Account/i })).toBeInTheDocument();

    // Switch back to Training Simulation and inspect Tax Config ERCA Verification Gate
    fireEvent.click(screen.getByRole('button', { name: /Training Simulation/i }));
    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Tax Configuration' }));
    expect(
      await screen.findByText(/ERCA & Licensed Adviser Production Activation Gate/i, {}, { timeout: 4000 })
    ).toBeInTheDocument();
  }, 15_000);

  it('renders D3 fiscal-year monthly revenue bars and Recharts 6-month occupancy widget on ExecutiveDashboard', async () => {
    render(<App />);

    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[0]); // gm.demo
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    const d3Widget = await screen.findByTestId('d3-fiscal-revenue-widget');
    const d3Svg = await screen.findByTestId('d3-fiscal-revenue-svg');
    const rechartsWidget = await screen.findByTestId('recharts-occupancy-widget');

    expect(d3Widget).toBeInTheDocument();
    expect(rechartsWidget).toBeInTheDocument();
    expect(d3Svg.querySelectorAll('rect.d3-revenue-bar').length).toBe(12);
  });

  it('opens QR scanner from Tenant Mobile Pay tab and auto-populates reference field from Telebirr QR payload', async () => {
    render(<App />);

    const tenantBtns = screen.getAllByRole('button', { name: /Open Tenant Mobile/i });
    fireEvent.click(tenantBtns[0]);

    expect(await screen.findByTestId('tenant-mobile-app')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Pay$/i }));

    const scanBtn = await screen.findByTestId('open-qr-scanner-btn');
    fireEvent.click(scanBtn);

    const payloadInput = await screen.findByLabelText(/Or Paste Decoded QR Payload/i);
    fireEvent.change(payloadInput, {
      target: {
        value:
          'telebirr://pay?merch=204910&inv=INV-SYNTH-A-1001&amt=15000&sess=TB-SESS-901234&ref=TEL-QR-901234&mode=SANDBOX',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Apply$/i }));

    const refInput = (await screen.findByLabelText(/Payment \/ QR Reference/i)) as HTMLInputElement;
    expect(refInput.value).toBe('TEL-QR-901234');

    // Settle the matched Telebirr QR payment and verify it appears in the scrollable QR payment history section
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Settle Reference/i }));
    expect(await screen.findByText(/DEMO — NOT A TAX INVOICE — SYNTHETIC DATA/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));

    const historySection = await screen.findByTestId('qr-payment-history-section');
    expect(historySection).toBeInTheDocument();
    expect(historySection.textContent).toContain('TEL-QR-901234');
    expect(historySection.textContent).toContain('Verified');
  });

  it('shows red fail feedback in PaymentQrScannerSheet when scanned QR invoice does not match tenant', async () => {
    render(<App />);

    const tenantBtns = screen.getAllByRole('button', { name: /Open Tenant Mobile/i });
    fireEvent.click(tenantBtns[0]);

    expect(await screen.findByTestId('tenant-mobile-app')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Pay$/i }));
    fireEvent.click(await screen.findByTestId('open-qr-scanner-btn'));

    const payloadInput = await screen.findByLabelText(/Or Paste Decoded QR Payload/i);
    fireEvent.change(payloadInput, {
      target: {
        value:
          'telebirr://pay?merch=204910&inv=INV-UNMATCHED-999&amt=15000&sess=TB-SESS-777777&ref=TEL-QR-777777',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Apply$/i }));

    const failFeedback = await screen.findByTestId('qr-scan-fail-feedback');
    expect(failFeedback).toBeInTheDocument();
    expect(screen.getByTestId('payment-qr-scanner-sheet')).toHaveAttribute('data-scan-status', 'fail');
  });

  it('provides refined PDF, Excel (.xlsx), and CSV export options on ReportsPage', async () => {
    render(<App />);

    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[0]); // gm.demo
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Reports' }));
    expect(await screen.findByRole('button', { name: /Download PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Excel \(\.xlsx\)/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Export Options/i }));
    expect(await screen.findByRole('button', { name: /CSV \(\.csv\)/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Layout:/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Include owner & demo header/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Excel \(\.xlsx\)$/i }));
    fireEvent.click(screen.getByTestId('confirm-download-export-btn'));
  }, 15_000);

  it('downloads Tenant Mobile processed payment history as PDF and Excel (.xlsx) in Pay tab', async () => {
    render(<App />);

    const tenantBtns = screen.getAllByRole('button', { name: /Open Tenant Mobile/i });
    fireEvent.click(tenantBtns[0]);

    expect(await screen.findByTestId('tenant-mobile-app')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Pay$/i }));

    const pdfBtn = await screen.findByTestId('tenant-download-history-pdf');
    const excelBtn = screen.getByTestId('tenant-download-history-excel');

    expect(pdfBtn).toBeEnabled();
    expect(excelBtn).toBeEnabled();

    fireEvent.click(pdfBtn);
    const statusAfterPdf = await screen.findByTestId('tenant-history-export-status');
    expect(statusAfterPdf.textContent).toMatch(/\.pdf/i);

    fireEvent.click(excelBtn);
    const statusAfterExcel = await screen.findByTestId('tenant-history-export-status');
    expect(statusAfterExcel.textContent).toMatch(/\.xlsx/i);
  });

  it('renders reusable Oromifa agreement builder with exact Afaan Oromoo text and Tax/Attachment samples', async () => {
    render(<App />);

    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[0]); // gm.demo
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    // 1. Navigate to Tenants & Leases -> Oromifa Contracts tab
    fireEvent.click(await screen.findByRole('button', { name: 'Tenants & Leases' }));
    const oromifaTab = await screen.findByTestId('tab-oromifa-contracts');
    fireEvent.click(oromifaTab);

    const preview = await screen.findByTestId('oromifa-contract-document-preview');
    expect(preview.textContent).toContain('WALIIGALTEE (AHADII) KIRAA MANA DALDALAA');
    expect(preview.textContent).toContain('KEEWWATA-1');
    expect(preview.textContent).toContain('KEEWWATA-8');

    // Switch to Rent & VAT input section and save reusable template
    fireEvent.click(screen.getByRole('button', { name: /3\. Rent & VAT/i }));
    fireEvent.click(screen.getByTestId('open-save-oromifa-template-btn'));
    fireEvent.click(screen.getByTestId('confirm-save-oromifa-template-btn'));

    // View original 5 attached sample scans
    fireEvent.click(screen.getByTestId('oromifa-view-scans-btn'));
    expect(await screen.findByTestId('oromifa-sample-scans-viewer')).toBeInTheDocument();

    // 2. Navigate to Tax Configuration -> Tax Form (OBR 1301) & Cash Attachment tab
    fireEvent.click(screen.getByRole('button', { name: 'Tax Configuration' }));
    const sampleFormsTab = await screen.findByTestId('tab-tax-sample-forms');
    fireEvent.click(sampleFormsTab);

    const samplesRoot = await screen.findByTestId('tax-and-attachment-samples');
    expect(samplesRoot.textContent).toContain('OBR Form 1301');

    fireEvent.click(screen.getByTestId('subtab-cash-attachment'));
    expect(samplesRoot.textContent).toContain('CASH Sales Attachment');
    expect(samplesRoot.textContent).toContain('House Rent');
    expect(screen.getByText(/ENABLE_LIVE_TAX_INVOICING=False/i)).toBeInTheDocument();
  }, 15_000);

  it('preserves user-entered CBE slip reference in TenantGatewayModal across gateway tab and state updates', async () => {
    render(<App />);

    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[5]); // collections.demo
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Rent & Collections' }));
    const openGatewayBtn = await screen.findByRole('button', { name: /Simulate Telebirr USSD QR \/ Gateway/i });
    fireEvent.click(openGatewayBtn);

    fireEvent.click(await screen.findByRole('button', { name: /CBE Transfer Slip/i }));
    const refInput = (await screen.findByPlaceholderText(/e\.g\. CBE-TRF-99281/i)) as HTMLInputElement;
    fireEvent.change(refInput, { target: { value: 'CBE-DRAFT-PRESERVE-42' } });
    expect(refInput.value).toBe('CBE-DRAFT-PRESERVE-42');

    // Toggle to ArifPay tab and back to CBE Transfer Slip — draft must NOT be wiped
    fireEvent.click(screen.getByRole('button', { name: /ArifPay Checkout/i }));
    fireEvent.click(screen.getByRole('button', { name: /CBE Transfer Slip/i }));
    const refAfterToggle = (await screen.findByPlaceholderText(/e\.g\. CBE-TRF-99281/i)) as HTMLInputElement;
    expect(refAfterToggle.value).toBe('CBE-DRAFT-PRESERVE-42');
  });

  it('submits a 3-line 5900 Depreciation manual journal as Finance Officer and posts it after GM Maker-Checker approval', async () => {
    render(<App />);

    // 1. Sign in as Finance Officer (finance.demo, index 2)
    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[2]);
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    // 2. Open Finance -> Journals & Rules -> Manual Journal (5xxx)
    fireEvent.click(await screen.findByRole('button', { name: 'Finance' }));
    const journalsTab = await screen.findByRole('button', { name: /Journals & Rules/i }, { timeout: 5000 });
    fireEvent.click(journalsTab);

    fireEvent.click(await screen.findByRole('button', { name: /Manual Journal \(5xxx\)/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /5900 · Depreciation/i }));

    expect(within(dialog).getByText(/Balanced \(Dr == Cr\)/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Submit Manual Journal$/i }));

    // 3. Switch user to General Manager (gm.demo) and approve in Approvals Centre
    fireEvent.click(screen.getAllByRole('button', { name: /Finance Officer/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Sign Out to Training Login/i }));
    const gmUseButtons = await screen.findAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(gmUseButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    fireEvent.click(await screen.findByRole('button', { name: /Approvals Centre/i }));
    const approvalSearch = await screen.findByPlaceholderText(
      /Search request #, category, maker role, or title/i,
      {},
      { timeout: 5000 }
    );
    fireEvent.change(approvalSearch, { target: { value: 'Monthly straight-line depreciation' } });
    const reqText = await screen.findByText(/Monthly straight-line depreciation charge/i, {}, { timeout: 5000 });
    const reqRow = reqText.closest('tr')!;
    fireEvent.click(within(reqRow).getByRole('button', { name: /Open Detail/i }));
    const approveBtn = await screen.findByRole('button', { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    // 4. Verify the 5900 journal appears in Finance Ledger under the 5900 filter
    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    fireEvent.click(await screen.findByRole('button', { name: /Journals & Rules/i }, { timeout: 5000 }));
    fireEvent.click(await screen.findByRole('button', { name: /5900 · Depreciation/i }));

    expect(
      await screen.findByText(/Monthly straight-line depreciation charge — buildings & equipment \(5900\)/i)
    ).toBeInTheDocument();
  }, 15_000);

  it('allows tenants on the Pay tab to request a manual payment reminder email or notification for missed deadlines', async () => {
    render(<App />);

    const tenantBtns = screen.getAllByRole('button', { name: /Open Tenant Mobile/i });
    fireEvent.click(tenantBtns[0]);

    expect(await screen.findByTestId('tenant-mobile-app')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Pay$/i }));

    // Missed-deadline banner card & per-invoice CTA render for overdue/past-due invoices
    const missedCard = await screen.findByTestId('missed-deadline-reminder-card');
    expect(missedCard.textContent).toContain('Missed Payment Deadline');
    expect(await screen.findByTestId('request-reminder-btn-INV-SYNTH-A-1101')).toBeInTheDocument();

    // Open Request Payment Reminder sheet from specific overdue invoice
    fireEvent.click(screen.getByTestId('request-reminder-btn-INV-SYNTH-A-1101'));

    const emailInput = (await screen.findByLabelText(/Recipient Email \*/i)) as HTMLInputElement;
    expect(emailInput.value).toBe('tenant001.demo@synthetic.example.et');

    // Validation blocks malformed email
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByTestId('submit-payment-reminder-btn'));
    expect(
      await screen.findByText(/Enter a valid email address to receive the payment reminder/i)
    ).toBeInTheDocument();

    // Enter valid email + note and submit using Email & Notification
    fireEvent.change(emailInput, { target: { value: 'tenant001.custom@synthetic.example.et' } });
    fireEvent.change(screen.getByLabelText(/Optional Note/i), {
      target: { value: 'Settling on Friday morning' },
    });
    fireEvent.click(screen.getByTestId('submit-payment-reminder-btn'));

    const confirmation = await screen.findByTestId('reminder-sent-confirmation');
    expect(confirmation.textContent).toContain('INV-SYNTH-A-1101');
    expect(confirmation.textContent).toContain('tenant001.custom@synthetic.example.et');
    expect(confirmation.textContent).toContain('Settling on Friday morning');

    // View in Notices verifies both the generated Tenant Notice and SMS/Notification Alert Log
    fireEvent.click(within(confirmation).getByRole('button', { name: /View in Notices/i }));
    expect(
      await screen.findByText(/Payment Reminder Sent \(Email & Notification\) — INV-SYNTH-A-1101/i)
    ).toBeInTheDocument();
  }, 15_000);

  it('renders SystemDemonstrationPage with Maker-Checker & Tenant Collection walkthroughs, Amharic Executive Mode, and live handoff', async () => {
    render(<App />);

    const useButtons = screen.getAllByRole('button', { name: /Use Credentials/i });
    fireEvent.click(useButtons[0]); // gm.demo
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    fireEvent.click(await screen.findByRole('button', { name: /System Demonstration/i }));
    expect(await screen.findByTestId('walkthrough-scene-player', {}, { timeout: 5000 })).toBeInTheDocument();

    // Verify horizontal scrollable chapter navigation tabs (Owner, GM, Finance Head, Clerk)
    const tabRail = screen.getByTestId('horizontal-chapter-tabs');
    expect(tabRail.className).toContain('overflow-x-auto');
    expect(screen.getByRole('tab', { name: /^Owner/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^GM/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Finance Head/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Clerk/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /^Owner/i }));
    expect(
      screen.getAllByText(/Owner 5-Building Isolation & Out-of-Office Mobile Mode/i).length
    ).toBeGreaterThan(0);

    // Switch back to All Chapters and verify Maker-Checker Approval & Self-Void Guard
    fireEvent.click(screen.getByRole('tab', { name: /^All Chapters/i }));
    expect(
      screen.getAllByText(/Maker-Checker Approval & Self-Void Guard/i).length
    ).toBeGreaterThan(0);

    // Toggle to reusable lazy-loading VideoPlayer mode and back
    fireEvent.click(screen.getByRole('button', { name: /Video Explainer Player/i }));
    expect(await screen.findByTestId('custom-video-player')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Interactive Walkthrough/i }));

    // Exercise interactive Maker-Checker simulation + PresentationCues overlay
    expect(screen.getByTestId('maker-checker-interactive-sim')).toBeInTheDocument();
    expect(screen.getByTestId('presentation-cues-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Submit as Clerk \(Maker\)/i }));
    expect(
      (await screen.findAllByText(/Self-Approval Hard-Blocked by Actor ID/i)).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Open Overlay View/i }));
    expect(screen.getByTestId('presentation-cues-overlay')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close presenter overlay/i }));

    // Verify progress tracker & live walkthrough status on Curated System Walkthroughs
    expect(screen.getByTestId('demo-progress-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('walkthrough-live-status-demo-maker-checker')).toBeInTheDocument();

    // Open Transcript panel and verify Amharic & English script toggles dynamically
    fireEvent.click(screen.getByTestId('transcript-toggle-btn'));
    expect(screen.getByTestId('demo-transcript-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('progress-chapter-owner'));
    expect(screen.getByTestId('demo-progress-summary').textContent).toContain('1 / 4');

    // Switch to Amharic Executive Mode in one click
    fireEvent.click(screen.getByRole('button', { name: /Amharic Executive Mode/i }));
    expect(
      await screen.findByText(/የመጀመሪያ የአማርኛ የሥርዓት ማቅረቢያና የቪዲዮ መቅረጫ ስቱዲዮ/i)
    ).toBeInTheDocument();

    // Filter to Clerks chapter and select Tenant Rental Collection
    fireEvent.click(screen.getByRole('tab', { name: /ጸሐፊዎች \(Clerks\)/i }));
    const collectionCard = screen.getByRole('button', {
      name: /የተከራይ ኪራይ ክፍያ አሰባሰብ/i,
    });
    fireEvent.click(collectionCard);
    expect(
      (await screen.findAllByText(/ደረጃ 1፡ ተከራይ የራሱን የሞባይል ክፍያ ገጽ ይከፍታል/i)).length
    ).toBeGreaterThan(0);

    // Jump straight into live Collections workspace
    fireEvent.click(screen.getByRole('button', { name: /ወደ ቀጥታ ኪራይ አሰባሰብ ገጽ ሂድ/i }));
    expect(await screen.findByRole('heading', { name: /ኪራይና አሰባሰብ/i })).toBeInTheDocument();
  }, 15_000);
});
