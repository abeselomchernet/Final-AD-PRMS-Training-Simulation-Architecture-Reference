// @vitest-environment node
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  parsePlaywrightAuthRateLimitOverride,
  resolveAuthRateLimitMax,
  resolveBindHost,
} from '../../server/security';

let baseUrl = '';
let srv: http.Server;
let tmpDbDir = '';

async function startTestServer() {
  tmpDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adprms-sec-test-'));
  process.env.OFFICE_DB_PATH = path.join(tmpDbDir, 'office-sec-test.sqlite');
  process.env.OFFICE_SESSION_SECRET = 'vitest-hmac-session-secret-0123456789';
  process.env.ARIFPAY_WEBHOOK_SECRET = 'arifpay-test-secret';
  delete process.env.TELEBIRR_PUBLIC_KEY_PEM;

  const { createTrainingServerApp } = await import('../../server');
  const { app } = await createTrainingServerApp({ attachVite: false });

  await new Promise<void>((resolve) => {
    srv = http.createServer(app);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr !== 'string') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
}

describe('Express Training Server Security, Loopback Default & Fail-Closed Webhooks (#9, #10)', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    if (srv) {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
    if (tmpDbDir && fs.existsSync(tmpDbDir)) {
      fs.rmSync(tmpDbDir, { recursive: true, force: true });
    }
  });

  it('defaults bind host to 127.0.0.1 unless explicitly overridden with OFFICE_ENABLE_LAN, container env, or --host', () => {
    expect(resolveBindHost([], {})).toBe('127.0.0.1');
    expect(resolveBindHost([], { OFFICE_ENABLE_LAN: 'true' })).toBe('0.0.0.0');
    expect(resolveBindHost([], { K_SERVICE: 'ais-dev-preview' })).toBe('0.0.0.0');
    expect(resolveBindHost(['--host', '0.0.0.0'], {})).toBe('0.0.0.0');
    expect(resolveBindHost([], { HOST: '192.168.1.50' })).toBe('192.168.1.50');
  });

  it('returns 401 on unauthenticated /api/office/* and /api/sms/* endpoints while /api/office/auth/session stays 200', async () => {
    const sess = await fetch(`${baseUrl}/api/office/auth/session`);
    expect(sess.status).toBe(200);
    expect(sess.headers.get('x-adprms-mode')).toBe('TRAINING-SYNTHETIC-ONLY');
    expect(await sess.json()).toMatchObject({ ok: true, authenticated: false, session: null });

    const stateRes = await fetch(`${baseUrl}/api/office/state`);
    expect(stateRes.status).toBe(401);

    const smsRes = await fetch(`${baseUrl}/api/sms/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '+251911000001', message: 'Test' }),
    });
    expect(smsRes.status).toBe(401);
  });

  it('enforces HttpOnly cookie login and blocks forged X-Office-Role resets by non-trainers (#9)', async () => {
    const badLogin = await fetch(`${baseUrl}/api/office/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'finance.demo', password: 'WRONG' }),
    });
    expect(badLogin.status).toBe(401);

    const finLogin = await fetch(`${baseUrl}/api/office/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'finance.demo', password: 'TRAIN-FIN-2026!' }),
    });
    expect(finLogin.status).toBe(200);
    const finCookie = finLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect(finCookie).toContain('adprms_office_sid=');

    // Finance Officer tries to spoof Training Coordinator header & body to call /api/office/reset
    const forgedReset = await fetch(`${baseUrl}/api/office/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: finCookie,
        'X-Office-Role': 'Training Coordinator',
      },
      body: JSON.stringify({ resetBy: 'trainer.demo', state: { version: 'forged' } }),
    });
    expect(forgedReset.status).toBe(403);

    // Auditor cannot write /api/office/state
    const audLogin = await fetch(`${baseUrl}/api/office/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'auditor.demo', password: 'TRAIN-AUD-2026!' }),
    });
    expect(audLogin.status).toBe(200);
    const audCookie = audLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
    const audWrite = await fetch(`${baseUrl}/api/office/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: audCookie },
      body: JSON.stringify({ state: {} }),
    });
    expect(audWrite.status).toBe(403);

    // Authenticated Training Coordinator CAN reset
    const trnLogin = await fetch(`${baseUrl}/api/office/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'trainer.demo', password: 'TRAIN-RESET-2026!' }),
    });
    expect(trnLogin.status).toBe(200);
    const trnCookie = trnLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
    const okReset = await fetch(`${baseUrl}/api/office/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: trnCookie },
      body: JSON.stringify({ state: { version: 'reset-unit' } }),
    });
    expect(okReset.status).toBe(200);
  });

  it('rejects unsigned, stale, and replayed ArifPay webhooks and fails closed on unconfigured Telebirr (#10)', async () => {
    const finLogin = await fetch(`${baseUrl}/api/office/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'finance.demo', password: 'TRAIN-FIN-2026!' }),
    });
    const finCookie = finLogin.headers.get('set-cookie')?.split(';')[0] ?? '';

    const sessRes = await fetch(`${baseUrl}/api/gateways/arifpay/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: finCookie },
      body: JSON.stringify({ ownerId: 'OWN-ALPHA', amountEtb: 1200, nonce: 'NONCE-UNIT-1' }),
    });
    expect(sessRes.status).toBe(200);
    const sessJson = (await sessRes.json()) as { data: { sessionId: string; transactionId: string } };

    const payload = {
      sessionId: sessJson.data.sessionId,
      transactionId: sessJson.data.transactionId,
      ownerId: 'OWN-ALPHA',
      status: 'COMPLETED',
      amountEtb: 1200,
    };
    const raw = JSON.stringify(payload);

    // Bad signature -> 403
    const badSig = await fetch(`${baseUrl}/api/webhooks/arifpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-arifpay-signature': 'deadbeef' },
      body: raw,
    });
    expect(badSig.status).toBe(403);

    // Valid HMAC with stale timestamp (>300s) -> 403
    const goodSig = crypto
      .createHmac('sha256', 'arifpay-test-secret')
      .update(raw)
      .digest('hex');
    const staleTs = String(Math.floor(Date.now() / 1000) - 900);
    const staleWebhook = await fetch(`${baseUrl}/api/webhooks/arifpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-arifpay-signature': goodSig,
        'x-arifpay-timestamp': staleTs,
      },
      body: raw,
    });
    expect(staleWebhook.status).toBe(403);

    // Valid HMAC & fresh timestamp -> 200
    const ts = Math.floor(Date.now() / 1000).toString();
    const okWebhook = await fetch(`${baseUrl}/api/webhooks/arifpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-arifpay-signature': goodSig,
        'x-arifpay-timestamp': ts,
      },
      body: raw,
    });
    expect(okWebhook.status).toBe(200);

    // Replay same transaction -> 409
    const replayWebhook = await fetch(`${baseUrl}/api/webhooks/arifpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-arifpay-signature': goodSig,
        'x-arifpay-timestamp': ts,
      },
      body: raw,
    });
    expect(replayWebhook.status).toBe(409);

    // Telebirr without TELEBIRR_PUBLIC_KEY_PEM -> fail-closed 503
    const tbFailClosed = await fetch(`${baseUrl}/api/webhooks/telebirr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merch_order_id: 'TB-UNIT-1', sign: 'dummy' }),
    });
    expect(tbFailClosed.status).toBe(503);
  });

  it('keeps production authRateLimitMax=10 by default, ignores E2E env vars on normal startup, validates overrides, and allows designated E2E harness', async () => {
    // 1. Validation & fail-closed guarantees on invalid/out-of-range overrides
    expect(resolveAuthRateLimitMax(undefined, true)).toBe(10);
    expect(resolveAuthRateLimitMax(undefined, false)).toBe(100);
    expect(resolveAuthRateLimitMax(120, true)).toBe(120);
    expect(() => resolveAuthRateLimitMax(0, true)).toThrow(RangeError);
    expect(() => resolveAuthRateLimitMax(-5, true)).toThrow(RangeError);
    expect(() => resolveAuthRateLimitMax(1.5, true)).toThrow(RangeError);
    expect(() => resolveAuthRateLimitMax(501, true)).toThrow(RangeError);
    expect(() => resolveAuthRateLimitMax(Number.NaN, true)).toThrow(RangeError);

    expect(() =>
      parsePlaywrightAuthRateLimitOverride({ ADPRMS_E2E_AUTH_RATE_LIMIT_MAX: '120' })
    ).toThrow(/ADPRMS_E2E_HARNESS=1/);
    expect(parsePlaywrightAuthRateLimitOverride({ ADPRMS_E2E_HARNESS: '1' })).toBe(120);
    expect(
      parsePlaywrightAuthRateLimitOverride({
        ADPRMS_E2E_HARNESS: '1',
        ADPRMS_E2E_AUTH_RATE_LIMIT_MAX: '75',
      })
    ).toBe(75);
    expect(() =>
      parsePlaywrightAuthRateLimitOverride({
        ADPRMS_E2E_HARNESS: '1',
        ADPRMS_E2E_AUTH_RATE_LIMIT_MAX: '0',
      })
    ).toThrow(RangeError);
    expect(() =>
      parsePlaywrightAuthRateLimitOverride({
        ADPRMS_E2E_HARNESS: '1',
        ADPRMS_E2E_AUTH_RATE_LIMIT_MAX: '999',
      })
    ).toThrow(RangeError);
    expect(() =>
      parsePlaywrightAuthRateLimitOverride({
        ADPRMS_E2E_HARNESS: '1',
        ADPRMS_E2E_AUTH_RATE_LIMIT_MAX: 'not-a-number',
      })
    ).toThrow(RangeError);

    const prevNodeEnv = process.env.NODE_ENV;
    const prevHarness = process.env.ADPRMS_E2E_HARNESS;
    const prevMax = process.env.ADPRMS_E2E_AUTH_RATE_LIMIT_MAX;
    const prevDbPath = process.env.OFFICE_DB_PATH;
    const prodTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adprms-prod-rl-'));
    const harnessTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adprms-e2e-rl-'));
    let prodSrv: http.Server | undefined;
    let harnessSrv: http.Server | undefined;

    try {
      const { createTrainingServerApp } = await import('../../server');

      // Invalid explicit option to createTrainingServerApp fails safely
      await expect(
        createTrainingServerApp({ attachVite: false, dbPath: path.join(prodTmpDir, 'bad.sqlite'), authRateLimitMax: 0 })
      ).rejects.toThrow(RangeError);

      // 2. Ordinary production startup ignores ADPRMS_E2E_* env vars and enforces strictly 10 attempts
      process.env.NODE_ENV = 'production';
      process.env.ADPRMS_E2E_HARNESS = '1';
      process.env.ADPRMS_E2E_AUTH_RATE_LIMIT_MAX = '120';

      const { app: prodApp } = await createTrainingServerApp({
        attachVite: false,
        dbPath: path.join(prodTmpDir, 'prod.sqlite'),
      });
      const prodUrl = await new Promise<string>((resolve) => {
        prodSrv = http.createServer(prodApp);
        prodSrv.listen(0, '127.0.0.1', () => {
          const addr = prodSrv!.address();
          resolve(`http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`);
        });
      });

      for (let i = 1; i <= 10; i += 1) {
        const res = await fetch(`${prodUrl}/api/office/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'gm.demo', password: 'WRONG' }),
        });
        expect(res.status, `Attempt ${i} should not hit 429`).toBe(401);
      }
      const eleventhProd = await fetch(`${prodUrl}/api/office/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'gm.demo', password: 'WRONG' }),
      });
      expect(eleventhProd.status).toBe(429);

      // 3. Designated Playwright harness option raises limit to bounded integer (e.g. 14) under production mode
      const harnessLimit = parsePlaywrightAuthRateLimitOverride({
        ADPRMS_E2E_HARNESS: '1',
        ADPRMS_E2E_AUTH_RATE_LIMIT_MAX: '14',
      });
      const { app: harnessApp } = await createTrainingServerApp({
        attachVite: false,
        dbPath: path.join(harnessTmpDir, 'e2e.sqlite'),
        authRateLimitMax: harnessLimit,
      });
      const harnessUrl = await new Promise<string>((resolve) => {
        harnessSrv = http.createServer(harnessApp);
        harnessSrv.listen(0, '127.0.0.1', () => {
          const addr = harnessSrv!.address();
          resolve(`http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`);
        });
      });

      for (let i = 1; i <= 14; i += 1) {
        const res = await fetch(`${harnessUrl}/api/office/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'gm.demo', password: 'WRONG' }),
        });
        expect(res.status, `Harness attempt ${i} should stay under limit`).toBe(401);
      }
      const fifteenthHarness = await fetch(`${harnessUrl}/api/office/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'gm.demo', password: 'WRONG' }),
      });
      expect(fifteenthHarness.status).toBe(429);
    } finally {
      if (prodSrv) {
        await new Promise<void>((resolve) => prodSrv!.close(() => resolve()));
      }
      if (harnessSrv) {
        await new Promise<void>((resolve) => harnessSrv!.close(() => resolve()));
      }
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevHarness === undefined) delete process.env.ADPRMS_E2E_HARNESS;
      else process.env.ADPRMS_E2E_HARNESS = prevHarness;
      if (prevMax === undefined) delete process.env.ADPRMS_E2E_AUTH_RATE_LIMIT_MAX;
      else process.env.ADPRMS_E2E_AUTH_RATE_LIMIT_MAX = prevMax;
      if (prevDbPath === undefined) delete process.env.OFFICE_DB_PATH;
      else process.env.OFFICE_DB_PATH = prevDbPath;
      fs.rmSync(prodTmpDir, { recursive: true, force: true });
      fs.rmSync(harnessTmpDir, { recursive: true, force: true });
    }
  });
});
