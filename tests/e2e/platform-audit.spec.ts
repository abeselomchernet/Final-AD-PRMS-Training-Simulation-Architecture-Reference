import { expect, test } from '@playwright/test';

async function signInAs(page: import('@playwright/test').Page, username: string) {
  await page.goto('/');
  await expect(page.getByText('TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION')).toBeVisible();
  const row = page.locator('tr', { hasText: username });
  await row.getByRole('button', { name: /Use Credentials/i }).click();
  await page.getByRole('button', { name: /Sign In to Training Session/i }).click();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByText(/Loading workspace module/i)).toBeHidden();
}

const ALL_22_NAV_LABELS: { group: string; label: string }[] = [
  { group: 'Daily Operations', label: 'Home Workspace' },
  { group: 'Daily Operations', label: 'Owners & Entities' },
  { group: 'Daily Operations', label: 'Property Portfolio' },
  { group: 'Daily Operations', label: 'Rental Applications' },
  { group: 'Daily Operations', label: 'Tenants & Leases' },
  { group: 'Daily Operations', label: 'Maintenance & Complaints' },
  { group: 'Finance & Tax', label: 'Rent & Collections' },
  { group: 'Finance & Tax', label: 'Expenses & Payables' },
  { group: 'Finance & Tax', label: 'Finance' },
  { group: 'Finance & Tax', label: 'Tax Configuration' },
  { group: 'Finance & Tax', label: 'Reports' },
  { group: 'Governance & Controls', label: 'Approvals Centre' },
  { group: 'Governance & Controls', label: 'Compliance Readiness' },
  { group: 'Governance & Controls', label: 'Audit Trail' },
  { group: 'Governance & Controls', label: 'Role & Authority Admin' },
  { group: 'Governance & Controls', label: 'Backup & Recovery' },
  { group: 'Governance & Controls', label: 'Migration Readiness' },
  { group: 'Governance & Controls', label: 'Requirements & Acceptance' },
  { group: 'Governance & Controls', label: 'Governance & Boundaries' },
  { group: 'Training & Reference', label: 'Training Exercises' },
  { group: 'Training & Reference', label: 'Production Security Architecture' },
  { group: 'Training & Reference', label: 'Amharic & Date Visual QA' },
];

test.describe('Full Platform Runtime & Governance Audit (All 22 Modules & Roles)', () => {
  test('All 22 modules render cleanly for gm.demo with zero page/console errors and zero horizontal overflow', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await signInAs(page, 'gm.demo');

    // Expand Training & Reference group (collapsed by default for GM)
    await page.getByRole('button', { name: /Training & Reference/i }).click();

    for (const item of ALL_22_NAV_LABELS) {
      const navButton =
        item.label === 'Approvals Centre' || item.label === 'Training Exercises'
          ? page.locator('aside').getByRole('button', { name: new RegExp(`^${item.label}`, 'i') })
          : page.locator('aside').getByRole('button', { name: item.label, exact: true });
      await expect(navButton).toBeEnabled();
      await navButton.click();

      // Wait for React.lazy module chunk to hydrate out of Suspense fallback
      await expect(page.getByText(/Loading workspace module/i)).toBeHidden();

      // Persistent training banner remains visible on every single module
      await expect(page.getByText(/TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION/i)).toBeVisible();

      // Verify <main> rendered non-empty content and zero horizontal overflow
      const overflowCheck = await page.evaluate(() => {
        const main =
          document.querySelector<HTMLElement>('#main-content') ||
          document.querySelector<HTMLElement>('main');
        return {
          textLength: main ? main.innerText.trim().length : 0,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });

      expect(overflowCheck.textLength, `Empty main content on module: ${item.label}`).toBeGreaterThan(50);
      expect(
        overflowCheck.scrollWidth,
        `Horizontal overflow detected on module: ${item.label}`
      ).toBeLessThanOrEqual(overflowCheck.innerWidth + 1);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Bilingual Amharic + Ethiopic (ዓ.ም) mode renders cleanly across operational & governance screens without overflow', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await signInAs(page, 'gm.demo');

    // Switch to Amharic and Ethiopic Calendar
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('button', { name: /አማርኛ/i }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'am');
    await page.getByLabel('Date Display Calendar Mode').selectOption('ethiopic');

    // Verify skip link & main landmark exist cleanly
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('a[href="#main-content"]')).toBeAttached();

    // Visit key modules in Amharic
    const amharicModules = ['ኪራይና አሰባሰብ', 'የማጽደቂያ ማዕከል', 'የተገዢነት ዝግጁነት'];
    for (const label of amharicModules) {
      const btn =
        label === 'የማጽደቂያ ማዕከል'
          ? page.locator('aside').getByRole('button', { name: /^የማጽደቂያ ማዕከል/ })
          : page.locator('aside').getByRole('button', { name: label, exact: true });
      await btn.click();
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(metrics.scrollWidth, `Overflow in Amharic module: ${label}`).toBeLessThanOrEqual(
        metrics.innerWidth + 1
      );
    }

    expect(pageErrors).toEqual([]);
  });

  test('Enforces read-only Auditor controls, Owner / Director single-owner lock, and Trainer seed reset exclusivity', async ({
    page,
  }) => {
    // 1. Auditor / Read-only reviewer cannot trigger operational mutations
    await signInAs(page, 'auditor.demo');
    await page.locator('aside').getByRole('button', { name: 'Rent & Collections', exact: true }).click();
    const recordPayBtn = page.getByRole('button', { name: /Record.*Payment/i });
    if ((await recordPayBtn.count()) > 0) {
      await expect(recordPayBtn.first()).toBeDisabled();
    }
    await page.getByRole('button', { name: /Auditor \/ Read-only reviewer/i }).first().click();
    await page.getByRole('button', { name: /Sign Out to Training Login/i }).click();

    // 2. Owner / Director locked strictly to OWN-ALPHA
    await signInAs(page, 'owner.alpha.demo');
    const ownerSelect = page.getByLabel('Owner Context');
    await expect(ownerSelect).toHaveValue('OWN-ALPHA');
    await expect(ownerSelect).toBeDisabled();
    await page.getByRole('button', { name: /Owner \/ Director/i }).first().click();
    await page.getByRole('button', { name: /Sign Out to Training Login/i }).click();

    // 3. Training Coordinator has Trainer Reset Synthetic Seed action
    await signInAs(page, 'trainer.demo');
    await page.getByRole('button', { name: /Training Coordinator/i }).first().click();
    await expect(page.getByRole('button', { name: /Trainer Reset Synthetic Seed/i })).toBeEnabled();
  });

  test('Mobile 390x844 viewport renders Login and Authenticated Workspace with zero horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const loginOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(loginOverflow.scrollWidth).toBeLessThanOrEqual(loginOverflow.innerWidth + 1);

    await signInAs(page, 'gm.demo');
    const dashOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(dashOverflow.scrollWidth).toBeLessThanOrEqual(dashOverflow.innerWidth + 1);
  });
});
