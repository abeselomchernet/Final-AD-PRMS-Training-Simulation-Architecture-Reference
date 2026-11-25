import { expect, test } from '@playwright/test';

async function signInAs(page: import('@playwright/test').Page, username: string) {
  await page.goto('/');
  await expect(page.getByText('TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION')).toBeVisible();

  const row = page.locator('tr', { hasText: username });
  await row.getByRole('button', { name: /Use Credentials/i }).click();
  await page.getByRole('button', { name: /Sign In to Training Session/i }).click();
  await expect(page.getByRole('banner')).toBeVisible();
}

test.describe('AD-PRMS End-to-End Governance, Isolation & UI Flows', () => {
  test('Login branding, Daylight/Dark theme toggle, bilingual Amharic switch, and validation', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expect(page.getByText('TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION')).toBeVisible();
    await expect(
      page.getByText('Training authentication only — not production authentication.')
    ).toBeVisible();

    // Custom emblem & architectural hero artwork render visibly
    await expect(
      page.getByRole('img', { name: /AD-PRMS architectural monogram emblem/i })
    ).toBeVisible();
    await expect(
      page.getByRole('img', { name: /Contemporary glass and stone commercial building in Addis Ababa/i })
    ).toBeVisible();

    // Theme toggle adds .dark class to <html>
    await page.getByLabel('Toggle daylight or dark slate theme').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByLabel('Toggle daylight or dark slate theme').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Invalid password validation
    await page.locator('#training-password').fill('INVALID-PASSWORD');
    await page.getByRole('button', { name: /Sign In to Training Session/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    // Switch language to Amharic and back to English
    await page.getByRole('button', { name: /አማርኛ/i }).click();
    await expect(page.getByRole('button', { name: /ወደ ስልጠና ክፍለ-ጊዜ ግባ/i })).toBeVisible();
    await page.getByRole('button', { name: /Switch to English/i }).click();

    expect(pageErrors).toEqual([]);
  });

  test('Owner isolation across Compliance Source & Evidence Review (Alpha vs Beta)', async ({
    page,
  }) => {
    await signInAs(page, 'gm.demo');

    // Open Compliance Readiness
    await page.getByRole('button', { name: 'Compliance Readiness', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Compliance Readiness/i })).toBeVisible();

    // Switch to Source & Evidence tab
    await page.getByRole('button', { name: /Source & Evidence/i }).click();
    await expect(
      page.getByText('Showing research references for: Test Owner Alpha')
    ).toBeVisible();

    // Switch owner context to Test Owner Beta
    await page.getByLabel('Owner Context').selectOption('OWN-BETA');
    await expect(
      page.getByText('Showing research references for: Test Owner Beta')
    ).toBeVisible();
  });

  test('Maker-Checker self-approval block for Finance Officer & System Admin SoD guard', async ({
    page,
  }) => {
    // 1. Finance Officer cannot self-approve own draft (REQ-SYNTH-2026-002 submitted by USR-SYNTH-03)
    await signInAs(page, 'finance.demo');
    await page.getByRole('button', { name: /Governance & Controls/i }).click();
    await page.getByRole('button', { name: /Approvals Centre/i }).click();
    await page.getByRole('button', { name: /Submitted by Me \(Self-Approval Blocked\)/i }).click();

    const aprRow = page.locator('tr', { hasText: 'REQ-SYNTH-2026-002' });
    await expect(aprRow).toBeVisible();
    await aprRow.getByRole('button', { name: /Open Detail/i }).click();

    await expect(
      page.getByText(/Self-approval is prohibited/i).first()
    ).toBeVisible();

    // Close drawer and sign out cleanly
    await page.getByLabel('Close detail drawer').click();
    await page.getByRole('button', { name: /Finance Officer/i }).first().click();
    await page.getByRole('button', { name: /Sign Out to Training Login/i }).click();

    // 2. System Administrator cannot access Finance & Tax / Collections modules
    await signInAs(page, 'sysadmin.demo');
    await page.getByRole('button', { name: /Finance & Tax/i }).click();
    const collectionsNav = page.getByRole('button', { name: /Rent & Collections/i });
    await expect(collectionsNav).toBeDisabled();
  });

  test('Tax Configuration permanently locks Active stage & Visual QA verifies zero DOM clipping', async ({
    page,
  }) => {
    await signInAs(page, 'finance.demo');

    await page.getByRole('button', { name: 'Tax Configuration', exact: true }).click();
    await expect(page.getByText(/Active.*Disabled/i).first()).toBeVisible();

    // Open Visual QA and run automated DOM Overflow Check in English
    await page.getByRole('button', { name: /Training & Reference/i }).click();
    await page.getByRole('button', { name: /Amharic & Date Visual QA/i }).click();
    await page.getByRole('button', { name: /Run DOM Overflow Check/i }).click();
    await expect(
      page.getByText(/Zero button or badge horizontal clipping detected/i)
    ).toBeVisible();
  });

  test('Mobile PWA viewport (390x844): manifest, zero horizontal overflow, Tenant & Owner Mobile modes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Web App Manifest link is attached in built preview
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    // Launch Tenant Self-Service Mobile Mode
    await page.getByRole('button', { name: /Open Tenant Mobile/i }).first().click();
    await expect(page.getByTestId('tenant-mobile-app')).toBeVisible();

    // Verify zero horizontal overflow & sticky chrome <= 15% of 844px viewport
    const tenantLayoutMetrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const nav = document.querySelector('nav');
      const stickyHeight =
        (header ? header.getBoundingClientRect().height : 0) +
        (nav ? nav.getBoundingClientRect().height : 0);
      return {
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        stickyRatio: stickyHeight / window.innerHeight,
      };
    });
    expect(tenantLayoutMetrics.overflowX).toBe(false);
    expect(tenantLayoutMetrics.stickyRatio).toBeLessThanOrEqual(0.15);

    // Sign out of Tenant Mobile and verify Owner Out-of-Office Mobile Mode
    await page.getByRole('button', { name: 'Sign out tenant' }).click();
    const gmRow = page.locator('tr', { hasText: 'gm.demo' });
    await gmRow.getByRole('button', { name: /Use Credentials/i }).click();
    await page.getByRole('button', { name: /Sign In to Training Session/i }).click();

    await page.getByRole('button', { name: /Switch to Out-of-Office Mobile/i }).click();
    await expect(page.getByTestId('owner-mobile-app')).toBeVisible();

    const ownerLayoutMetrics = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(ownerLayoutMetrics.overflowX).toBe(false);

    // Open More tab -> All 22 Platform Modules
    await page.getByRole('button', { name: /^More$/i }).click();
    await expect(page.getByText(/All 22 Platform Modules/i)).toBeVisible();
  });

  test('5xxx Manual Journal UI workflow (5600/5800/5900) and SQLite /api/office/ledger endpoints', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Sign in as Finance Officer and open Finance -> Journals & Rules -> Manual Journal (5xxx)
    await signInAs(page, 'finance.demo');
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByRole('button', { name: /Journals & Rules/i }).click();

    await page.getByRole('button', { name: /Manual Journal \(5xxx\)/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /5600 · Bank Charges/i }).click();
    await expect(dialog.getByLabel('Journal Narration / Description')).toHaveValue(/\(5600\)/);
    await dialog.getByRole('button', { name: /5800 · Interest Expense/i }).click();
    await expect(dialog.getByLabel('Journal Narration / Description')).toHaveValue(/\(5800\)/);
    await dialog.getByRole('button', { name: /5900 · Depreciation/i }).click();
    await expect(dialog.getByText(/Balanced \(Dr == Cr\)/i)).toBeVisible();

    const saveAfterSubmit = page.waitForResponse(
      (res) => res.url().includes('/api/office/state') && res.request().method() === 'PUT'
    );
    await dialog.getByRole('button', { name: /^Submit Manual Journal$/i }).click();
    await expect(page.getByText(/Manual Journal Queued in Approvals Centre/i)).toBeVisible();
    await saveAfterSubmit;

    // 2. Sign out and approve as General Manager (Maker-Checker SoD)
    await page.getByRole('button', { name: /Finance Officer/i }).first().click();
    await page.getByRole('button', { name: /Sign Out to Training Login/i }).click();
    await signInAs(page, 'gm.demo');

    await page.getByRole('button', { name: /Approvals Centre/i }).click();
    await page
      .getByPlaceholder(/Search request #, category, maker role, or title/i)
      .fill('Monthly straight-line depreciation');
    const mjRow = page.locator('tr', { hasText: /Monthly straight-line depreciation charge/i }).first();
    await expect(mjRow).toBeVisible();
    await mjRow.getByRole('button', { name: /Open Detail/i }).click();
    const saveAfterApprove = page.waitForResponse(
      (res) => res.url().includes('/api/office/state') && res.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: /^Approve$/i }).click();
    await saveAfterApprove;

    // 3. Verify journal renders in Finance -> Journals & Rules under 5900 filter
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByRole('button', { name: /Journals & Rules/i }).click();
    await page.getByRole('button', { name: /5900 · Depreciation/i }).click();
    await expect(
      page.getByText(/Monthly straight-line depreciation charge — buildings & equipment \(5900\)/i).first()
    ).toBeVisible();

    // 4. Verify live SQLite ledger endpoints (/accounts, /journals?accountPrefix=5, /trial-balance, /post, /reverse)
    const acctsRes = await page.request.get('/api/office/ledger/accounts?ownerId=OWN-ALPHA');
    expect(acctsRes.ok()).toBe(true);
    const acctsJson = await acctsRes.json();
    expect(acctsJson.accounts.some((a: { code: string }) => a.code === '5600')).toBe(true);

    const postRes = await page.request.post('/api/office/ledger/post', {
      data: {
        ownerId: 'OWN-ALPHA',
        entryDate: '2026-12-08',
        periodCode: '2019-03',
        ruleId: 'Manual',
        sourceType: 'ManualJournal',
        sourceId: 'E2E-5600',
        idempotencyKey: `E2E-5600-${Date.now()}`,
        description: 'E2E SQLite 5600 bank charge',
        makerActorId: 'USR-SYNTH-03',
        checkerActorId: 'USR-SYNTH-02',
        lines: [
          { accountCode: '5600', debitCents: 35000, creditCents: 0 },
          { accountCode: '1020', debitCents: 0, creditCents: 35000 },
        ],
      },
    });
    expect(postRes.ok()).toBe(true);
    const postJson = await postRes.json();
    expect(postJson.ok).toBe(true);

    const fiveXxxRes = await page.request.get('/api/office/ledger/journals?ownerId=OWN-ALPHA&accountPrefix=5');
    expect(fiveXxxRes.ok()).toBe(true);
    const fiveXxxJson = await fiveXxxRes.json();
    expect(fiveXxxJson.journals.some((j: { id: string }) => j.id === postJson.journalId)).toBe(true);

    const tbRes = await page.request.get('/api/office/ledger/trial-balance?ownerId=OWN-ALPHA&periodCode=2019-03');
    expect(tbRes.ok()).toBe(true);
    const tbJson = await tbRes.json();
    expect(tbJson.balanced).toBe(true);

    const revRes = await page.request.post('/api/office/ledger/reverse', {
      data: {
        ownerId: 'OWN-ALPHA',
        journalId: postJson.journalId,
        entryDate: '2026-12-08',
        periodCode: '2019-03',
        reason: 'E2E PR-25 reversal check',
        makerActorId: 'USR-SYNTH-03',
        checkerActorId: 'USR-SYNTH-02',
      },
    });
    expect(revRes.ok()).toBe(true);
    const revJson = await revRes.json();
    expect(revJson.ok).toBe(true);

    expect(pageErrors).toEqual([]);
  });

  test('Unauthenticated /api/office barrier (401) and Internet-Down vs Server-Down Offline/LAN modes (#9, #14)', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Unauthenticated /api/office/state & /api/office/ledger/accounts must return 401
    const unauthState = await page.request.get('/api/office/state');
    expect(unauthState.status()).toBe(401);
    const unauthLedger = await page.request.get('/api/office/ledger/accounts?ownerId=OWN-ALPHA');
    expect(unauthLedger.status()).toBe(401);

    // 2. Scenario A: Internet Unavailable (external payment endpoints blocked), Local LAN Server Reachable
    await page.route('**://*.arifpay.*/**', (route) => route.abort('failed'));
    await page.route('**://*.ethiotelebirr.*/**', (route) => route.abort('failed'));
    await signInAs(page, 'finance.demo');

    const localSessionRes = await page.request.get('/api/office/auth/session');
    expect(localSessionRes.ok()).toBe(true);
    expect((await localSessionRes.json()).authenticated).toBe(true);

    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByRole('button', { name: /Journals & Rules/i }).click();
    await expect(page.getByRole('heading', { name: /Append-Only Double-Entry Ledger/i })).toBeVisible();

    // 3. Scenario B: Office Server Unavailable (aborted /api/office/state) keeps app responsive without crashing
    await page.route('**/api/office/state**', (route) => route.abort('connectionrefused'));
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    await expect(page.getByText(/Offline — showing cached data/i)).toBeVisible();
    await page.getByRole('button', { name: /Governance & Controls/i }).click();
    await page.getByRole('button', { name: 'Compliance Readiness', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Compliance Readiness/i })).toBeVisible();

    await page.unroute('**/api/office/state**');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    expect(pageErrors).toEqual([]);
  });
});

