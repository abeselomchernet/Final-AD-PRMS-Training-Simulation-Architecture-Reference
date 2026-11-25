import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';
import { getApiBaseUrl, getAppRuntimeMode, getWsBaseUrl } from '../../src/services/productionApiClient';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

describe('Cloudflare Pages Frontend-Only Deployment Preparation', () => {
  const originalPath = window.location.pathname;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.history.replaceState({}, '', originalPath);
  });

  it('defines build:frontend -> dist/client/ in package.json while preserving backend/MCP builds and synchronized lockfile', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(pkg.scripts['build:frontend']).toBe('vite build --outDir dist/client --emptyOutDir');
    expect(pkg.scripts.build).toBe('vite build && npm run build:server && npm run build:mcp');
    expect(pkg.scripts['build:server']).toContain('dist/server.js');
    expect(pkg.scripts['build:mcp']).toContain('dist/mcp-server.js');

    const lock = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package-lock.json'), 'utf8')) as {
      lockfileVersion: number;
      packages: Record<
        string,
        {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }
      >;
    };
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages['']?.dependencies).toEqual(pkg.dependencies);
    expect(lock.packages['']?.devDependencies).toEqual(pkg.devDependencies);
    expect(fs.existsSync(path.join(ROOT_DIR, 'bun.lock'))).toBe(false);

    const vercelCfg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'vercel.json'), 'utf8')) as {
      installCommand: string;
      buildCommand: string;
      outputDirectory: string;
    };
    expect(vercelCfg.installCommand).toBe('npm ci');
    expect(vercelCfg.buildCommand).toBe('npm run build:frontend');
    expect(vercelCfg.outputDirectory).toBe('dist/client');

    const mig0004 = fs.readFileSync(
      path.join(
        ROOT_DIR,
        'backend/apps/ledger/migrations/0004_leaseaccountingschedule_ledger_sched_own_lse_per_idx.py'
      ),
      'utf8'
    );
    expect(mig0004).toContain("('ledger', '0003_deposit_subledger_and_tax_packs')");
    expect(mig0004).toContain("model_name='leaseaccountingschedule'");
    expect(mig0004).toContain("name='ledger_sched_own_lse_per_idx'");
  });

  it('configures Cloudflare Pages _redirects SPA fallback and _headers security policy', () => {
    const redirects = fs.readFileSync(path.join(ROOT_DIR, 'public/_redirects'), 'utf8');
    expect(redirects).toMatch(/^\s*\/\*\s+\/index\.html\s+200\s*$/m);

    const headers = fs.readFileSync(path.join(ROOT_DIR, 'public/_headers'), 'utf8');
    expect(headers).toContain("Content-Security-Policy:");
    expect(headers).toContain("default-src 'self'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(headers).not.toContain("'unsafe-eval'");
    expect(headers).toContain("connect-src 'self' wss: https:");
    expect(headers).toContain("worker-src 'self'");
    expect(headers).toContain("manifest-src 'self'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(headers).toContain('Permissions-Policy: camera=(self), microphone=(), geolocation=()');
    expect(headers).toContain('/sw.js');
    expect(headers).toContain('/index.html');
    expect(headers).toContain('/manifest.webmanifest');
    expect(headers).toContain('Cache-Control: public, max-age=0, must-revalidate');
  });

  it('preserves training-mode defaults with zero localhost API endpoints', () => {
    expect(getAppRuntimeMode()).toBe('training');
    expect(getApiBaseUrl()).toBe('');
    expect(getWsBaseUrl()).toBe('');
  });

  it('renders login gate for /, /login, and /administration when unauthenticated, and routes sysadmin /administration post-login', async () => {
    window.history.replaceState({}, '', '/');
    const { unmount } = render(<App />);
    expect(await screen.findByText(/TRAINING MODE — SYNTHETIC DATA — NOT PRODUCTION/i)).toBeInTheDocument();
    unmount();

    window.history.replaceState({}, '', '/login');
    const loginRender = render(<App />);
    expect(await screen.findByRole('button', { name: /Sign In to Training Session/i })).toBeInTheDocument();
    loginRender.unmount();

    window.history.replaceState({}, '', '/administration');
    const adminRender = render(<App />);
    // Unauthenticated /administration still presents LoginPage (no auth bypass)
    expect(await screen.findByRole('button', { name: /Sign In to Training Session/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Training Username/i), { target: { value: 'sysadmin.demo' } });
    fireEvent.change(screen.getByLabelText(/Synthetic Training Password/i), {
      target: { value: 'TRAIN-SYS-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Training Session/i }));

    expect(await screen.findByRole('button', { name: /Environment Groups/i })).toBeInTheDocument();
    adminRender.unmount();
  });

  it('routes /oauth/consent to OAuthConsentPage cleanly without loading PrmsProvider workspace', async () => {
    window.history.replaceState({}, '', '/oauth/consent');
    render(<App />);
    expect(await screen.findByText(/AD-PRMS — OAuth 2\.1 AI Client Authorization/i)).toBeInTheDocument();
    expect(await screen.findByText(/Supabase OAuth Configuration Required/i)).toBeInTheDocument();
  });
});
