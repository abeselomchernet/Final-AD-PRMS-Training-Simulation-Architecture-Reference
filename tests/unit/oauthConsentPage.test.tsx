import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthConsentPage } from '../../src/pages/OAuthConsentPage';

const mockGetSession = vi.fn();
const mockGetAuthDetails = vi.fn();
const mockApproveAuthorization = vi.fn();
const mockDenyAuthorization = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      oauth: {
        getAuthorizationDetails: mockGetAuthDetails,
        approveAuthorization: mockApproveAuthorization,
        denyAuthorization: mockDenyAuthorization,
      },
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
    },
  }),
}));

describe('/oauth/consent Page (AT-02 & AT-03 Mocked Supabase OAuth 2.1 SDK)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('AT-02: renders client metadata, scopes, synthetic boundary, and redirects on Approve', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'uid-123', email: 'gm@synthetic.example.et' } } },
    });
    mockGetAuthDetails.mockResolvedValue({
      data: {
        authorization_id: 'auth-req-001',
        redirect_uri: 'http://127.0.0.1:41932/oauth/callback',
        scope: 'openid profile email',
        user: { id: 'uid-123', email: 'gm@synthetic.example.et' },
        client: {
          id: 'client-gemini-01',
          name: 'AD-PRMS Gemini CLI (Training)',
          uri: 'https://geminicli.com',
          logo_uri: '',
        },
      },
      error: null,
    });
    mockApproveAuthorization.mockResolvedValue({
      data: { redirect_url: 'http://127.0.0.1:41932/oauth/callback?code=authcode_1&state=xyz' },
      error: null,
    });

    const onNavigate = vi.fn();
    render(<OAuthConsentPage initialAuthorizationId="auth-req-001" onNavigate={onNavigate} />);

    await screen.findByText('AD-PRMS Gemini CLI (Training)');
    expect(screen.getByText(/gm@synthetic\.example\.et/i)).toBeInTheDocument();
    expect(screen.getByText(/Read-Only Synthetic Training Data/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Approve & Connect Client/i }));

    await waitFor(() => {
      expect(mockApproveAuthorization).toHaveBeenCalledWith('auth-req-001', {
        skipBrowserRedirect: true,
      });
      expect(onNavigate).toHaveBeenCalledWith(
        'http://127.0.0.1:41932/oauth/callback?code=authcode_1&state=xyz'
      );
    });
  });

  it('AT-03: invokes denyAuthorization() and redirects with access_denied on Deny', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'uid-123', email: 'gm@synthetic.example.et' } } },
    });
    mockGetAuthDetails.mockResolvedValue({
      data: {
        authorization_id: 'auth-req-002',
        redirect_uri: 'http://127.0.0.1:41932/oauth/callback',
        scope: 'openid email',
        user: { id: 'uid-123', email: 'gm@synthetic.example.et' },
        client: {
          id: 'client-claude-01',
          name: 'AD-PRMS Claude Connector (Training)',
          uri: 'https://claude.ai',
          logo_uri: '',
        },
      },
      error: null,
    });
    mockDenyAuthorization.mockResolvedValue({
      data: { redirect_url: 'http://127.0.0.1:41932/oauth/callback?error=access_denied&state=xyz' },
      error: null,
    });

    const onNavigate = vi.fn();
    render(<OAuthConsentPage initialAuthorizationId="auth-req-002" onNavigate={onNavigate} />);

    await screen.findByText('AD-PRMS Claude Connector (Training)');
    fireEvent.click(screen.getByRole('button', { name: /Deny Access/i }));

    await waitFor(() => {
      expect(mockDenyAuthorization).toHaveBeenCalledWith('auth-req-002', {
        skipBrowserRedirect: true,
      });
      expect(onNavigate).toHaveBeenCalledWith(
        'http://127.0.0.1:41932/oauth/callback?error=access_denied&state=xyz'
      );
    });
  });

  it('preserves authorization_id and prompts sign-in when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    render(<OAuthConsentPage initialAuthorizationId="auth-req-signin" />);
    await screen.findByText(/Sign in with Supabase Operator Identity/i);
    expect(screen.getByText('auth-req-signin')).toBeInTheDocument();
  });

  it('auto-redirects immediately if Supabase returns pre-consented redirect_url', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'uid-123', email: 'gm@synthetic.example.et' } } },
    });
    mockGetAuthDetails.mockResolvedValue({
      data: { redirect_url: 'http://127.0.0.1:41932/oauth/callback?code=preapproved' },
      error: null,
    });

    const onNavigate = vi.fn();
    render(<OAuthConsentPage initialAuthorizationId="auth-pre" onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('http://127.0.0.1:41932/oauth/callback?code=preapproved');
    });
  });
});
