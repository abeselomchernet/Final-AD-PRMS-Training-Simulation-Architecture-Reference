import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { chromium } from '@playwright/test';

const LOCAL_HEADLESS_SHELL =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (fs.existsSync(LOCAL_HEADLESS_SHELL) ? LOCAL_HEADLESS_SHELL : undefined);

const BASE_URL = process.env.DEMO_BASE_URL || 'http://127.0.0.1:4173';
const OUTPUT_DIR = path.resolve(process.cwd(), 'demo-recordings');

function resolveFfmpegBinary() {
  const candidates = [
    process.env.FFMPEG_BIN,
    '/usr/bin/ffmpeg',
    '/ms-playwright/ffmpeg-1011/ffmpeg-linux',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'ffmpeg';
}

async function isServerHealthy(url) {
  try {
    const res = await fetch(`${url}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerHealthy(url)) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Preview server did not become healthy at ${url} within ${timeoutMs}ms`);
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adprms-demo-frames-'));

  let serverProc = null;
  const alreadyRunning = await isServerHealthy(BASE_URL);
  if (!alreadyRunning) {
    console.log('Starting AD-PRMS server for demo recording...');
    serverProc = spawn('npx', ['tsx', 'server.ts'], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '4173',
        OFFICE_DB_PATH: '/tmp/adprms-demo-recording.db',
      },
      stdio: 'ignore',
    });
    await waitForServer(BASE_URL);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const cdp = await context.newCDPSession(page);
  let frameCounter = 0;

  cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
    const frameFile = path.join(framesDir, `frame-${String(frameCounter++).padStart(5, '0')}.jpg`);
    fs.writeFileSync(frameFile, Buffer.from(data, 'base64'));
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId });
    } catch {
      // Ignore ack failure during teardown
    }
  });

  try {
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 90,
      maxWidth: 1440,
      maxHeight: 900,
      everyNthFrame: 1,
    });

    console.log('1/5 Opening Login & Signing in as General Manager...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Use Credentials/i }).first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(700);

    await page.getByRole('button', { name: /Use Credentials/i }).first().click();
    await page.getByRole('button', { name: /Sign In to Training Session/i }).click();
    await page.waitForSelector('h1', { timeout: 10_000 });
    await page.waitForTimeout(800);

    console.log('2/5 Navigating to System Demonstration Studio & Enabling Amharic Executive Mode...');
    await page.getByRole('button', { name: /System Demonstration/i }).click();
    await page.waitForSelector('[data-testid="walkthrough-scene-player"]', { timeout: 10_000 });
    await page.waitForTimeout(800);

    // Verify no horizontal overflow at 1440px desktop
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    if (hasOverflow) {
      throw new Error('Horizontal overflow detected on SystemDemonstrationPage at 1440px');
    }

    const amharicModeBtn = page.getByRole('button', { name: /Amharic Executive Mode/i });
    if (await amharicModeBtn.isVisible()) {
      await amharicModeBtn.click();
      await page.waitForTimeout(800);
    }

    console.log('3/5 Walking through Maker-Checker Approval keyframes...');
    const stepButtons = page.locator('[data-testid="walkthrough-scene-player"] button');
    const stepCount = await stepButtons.count();
    for (let i = 0; i < stepCount; i++) {
      await stepButtons.nth(i).click();
      await page.waitForTimeout(900);
    }

    console.log('4/5 Switching to Tenant Rental Collection (Telebirr / ArifPay / CBE)...');
    await page
      .getByRole('button', { name: /የተከራይ ኪራይ ክፍያ አሰባሰብ|Tenant Rental Collection/i })
      .click();
    await page.waitForTimeout(800);
    for (let i = 0; i < stepCount; i++) {
      await stepButtons.nth(i).click();
      await page.waitForTimeout(900);
    }

    console.log('5/5 Jumping directly into Live Collections & Approvals Modules...');
    await page
      .getByRole('button', { name: /ወደ ቀጥታ ኪራይ አሰባሰብ ገጽ ሂድ|Open Live Rent & Collections/i })
      .click();
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: /የማጽደቂያ ማዕከል|Approvals Centre/i }).click();
    await page.waitForTimeout(1000);

    await cdp.send('Page.stopScreencast');

    if (pageErrors.length > 0) {
      throw new Error(`Page errors observed during recording: ${pageErrors.join(' | ')}`);
    }

    if (frameCounter > 0) {
      const ffmpegBin = resolveFfmpegBinary();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const finalPath = path.join(OUTPUT_DIR, `ad-prms-amharic-inaugural-demo-${stamp}.webm`);
      execFileSync(
        ffmpegBin,
        [
          '-y',
          '-framerate',
          '4',
          '-i',
          path.join(framesDir, 'frame-%05d.jpg'),
          '-c:v',
          'libvpx',
          '-b:v',
          '1500k',
          '-pix_fmt',
          'yuv420p',
          finalPath,
        ],
        { stdio: 'pipe' }
      );
      console.log(`Captured ${frameCounter} frames -> WebM demo video saved: ${finalPath}`);
    } else {
      throw new Error('Zero screencast frames captured during demo recording');
    }
  } finally {
    await context.close();
    await browser.close();
    fs.rmSync(framesDir, { recursive: true, force: true });
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
