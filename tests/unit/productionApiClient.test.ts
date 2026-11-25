import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_RUNTIME_MODE,
  API_BASE_URL,
  apiRequest,
  fetchErcaGateStatus,
  getStoredJwtTokens,
  setStoredJwtTokens,
} from '../../src/services/productionApiClient';

describe('productionApiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    setStoredJwtTokens(null);
    vi.restoreAllMocks();
  });

  it('defaults to training mode when VITE_APP_MODE is unset and stores/clears JWT tokens in memory only', () => {
    expect(APP_RUNTIME_MODE).toBe('training');
    expect(API_BASE_URL).toBe('');
    expect(getStoredJwtTokens()).toBeNull();

    setStoredJwtTokens({ access: 'acc-1', refresh: 'ref-1' });
    expect(getStoredJwtTokens()).toEqual({ access: 'acc-1', refresh: 'ref-1' });
    expect(localStorage.getItem('adprms.prod.jwt')).toBeNull();

    setStoredJwtTokens(null);
    expect(getStoredJwtTokens()).toBeNull();
  });

  it('injects Authorization Bearer and X-Owner-Context headers and refreshes expired JWT on 401', async () => {
    setStoredJwtTokens({ access: 'expired-acc', refresh: 'valid-ref' });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'fresh-acc', refresh: 'fresh-ref' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, owner: 'OWN-ALPHA' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const data = await apiRequest<{ ok: boolean; owner: string }>('/api/v1/portfolio/units/', {
      ownerContext: 'OWN-ALPHA',
    });

    expect(data).toEqual({ ok: true, owner: 'OWN-ALPHA' });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(firstHeaders['Authorization']).toBe('Bearer expired-acc');
    expect(firstHeaders['X-Owner-Context']).toBe('OWN-ALPHA');

    const retryHeaders = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;
    expect(retryHeaders['Authorization']).toBe('Bearer fresh-acc');
    expect(getStoredJwtTokens()).toEqual({ access: 'fresh-acc', refresh: 'fresh-ref' });
  });

  it('returns null from fetchErcaGateStatus when API_BASE_URL is not configured', async () => {
    const res = await fetchErcaGateStatus('OWN-ALPHA');
    expect(res).toBeNull();
  });
});
