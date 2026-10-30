import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPin, legacyPinHash, requestPetAccount } from './cloudAccount.js';
afterEach(() => vi.unstubAllGlobals());

describe('pet cloud client', () => {
  it('uses SHA-256 for existing PIN compatibility and rejects invalid PINs', async () => {
    vi.stubGlobal('crypto', webcrypto);
    expect(await hashPin('1234')).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');
    await expect(hashPin('123')).rejects.toThrow();
    await expect(hashPin('123abc')).rejects.toThrow();
  });
  it('does not create weak replacement credentials without Web Crypto', async () => {
    vi.stubGlobal('crypto', {});
    await expect(hashPin('1234')).rejects.toThrow('安全登入');
  });
  it('matches the retired client PIN hashes exactly for login-only compatibility', () => {
    expect(legacyPinHash('1234')).toBe('1509442');
    expect(legacyPinHash('0000')).toBe('1477632');
    expect(legacyPinHash('012345')).toBe('1420992003');
    expect(legacyPinHash('999999')).toBe('1686256992');
    expect(() => legacyPinHash('123abc')).toThrow();
  });
  it('keeps a conflict snapshot available for the provider to rebase', async () => {
    const conflict = { ok: false, code: 'revision_conflict', accountId: 'id', revision: 7, snapshot: { worldState: { schemaVersion: 2 }, coins: 41 } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(conflict), { status: 409 })));
    const result = await requestPetAccount('save', { action: 'login', credentials: { username: 'ab', pinHash: 'hash' } });
    expect(result).toMatchObject({ ...conflict, status: 409 });
    expect(result.error).toContain('另一台裝置');
    expect(JSON.parse(fetch.mock.calls[0][1].body).action).toBe('save');
  });
  it('normalizes offline, non-JSON and platform throttling failures without provider text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('private network detail'))
      .mockResolvedValueOnce(new Response('<html>platform failure</html>', { status: 502 }))
      .mockResolvedValueOnce(new Response('Too many requests', { status: 429 })));
    expect(await requestPetAccount('load')).toMatchObject({ ok: false, code: 'cloud_unavailable', status: 0 });
    expect(await requestPetAccount('load')).toMatchObject({ ok: false, code: 'cloud_unavailable', status: 502 });
    expect(await requestPetAccount('load')).toMatchObject({ ok: false, code: 'rate_limited', status: 429 });
  });
  it('retains cancellation instead of treating it as an offline failure', async () => {
    const controller = new AbortController(); controller.abort();
    const error = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(requestPetAccount('login', {}, { signal: controller.signal })).rejects.toBe(error);
  });
});
