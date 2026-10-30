import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { validWorldState } from '../../../netlify/functions/pet-account.mjs';
import { createWorld, applyWorldAction } from './worldState.js';
import { CHAPTERS } from './worldData.js';

const accountId = 'b169ffec-90be-4bd1-838f-cfe91dc993d1';
const credentials = { username: '測試夥伴', pinHash: 'a'.repeat(64) };
const worldState = {
  ...createWorld(),
  schemaVersion: 2, ownedPets: [], activePetId: null, starterChosen: false,
  ownedDecorations: [], placements: [], completedChapters: [], chapterProgress: {}, receipts: [],
  settings: { quality: 'auto', motion: true, sound: false }, journal: [],
};
const snapshot = { worldState, coins: 125 };
const result = { ok: true, accountId, revision: 1, snapshot, syncedAt: '2026-10-29T16:00:00Z' };
const save = { accountId, baseRevision: 0, mutationId: 'test-save-1', snapshot };
function request(body, options = {}) {
  return new Request('https://englishgo.example/.netlify/functions/pet-account', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials, ...body }), ...options,
  });
}
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://database.example');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-server-only-key');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(result))));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('pet account boundary', () => {
  it.each([null, { schemaVersion: 2 }])('does not restore an outdated database response (%j)', async oldWorld => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ ...result, snapshot: { worldState: oldWorld, coins: 999 } })));
    const response = await handler(request({ action: 'load', accountId }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok:false, code:'cloud_unavailable' });
  });
  it('sends credentials only to the server RPC and projects all response fields', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ ...result, pin_hash: 'private', legacyBackup: { secret: 'retired' }, snapshot: { ...snapshot, pinHash: 'private' } })));
    const response = await handler(request({ action: 'save', save }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://database.example/rest/v1/rpc/pet_town_account');
    expect(options.headers.Authorization).toBe('Bearer test-server-only-key');
    expect(JSON.parse(options.body)).toMatchObject({ p_action: 'save', p_username: credentials.username,
      p_pin_hash: credentials.pinHash, p_account_id: accountId, p_base_revision: 0, p_mutation_id: save.mutationId, p_snapshot: snapshot });
  });

  it('returns an account-scoped authorization failure without the latest save', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ ok: false, code: 'unauthorized' })));
    const response = await handler(request({ action: 'save', save }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: 'unauthorized' });
  });

  it('returns the latest world and revision for a 409 rebase', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ ...result, ok: false, code: 'revision_conflict', revision: 4 })));
    const response = await handler(request({ action: 'save', save }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ...result, ok: false, code: 'revision_conflict', revision: 4 });
  });

  it.each([
    { action: 'unknown' }, { action: 'login', credentials: { username: 'ab', pinHash: 'wrong' } },
    { action: 'save', save: { ...save, baseRevision: -1 } },
    { action: 'save', save: { ...save, accountId: 'someone-else' } },
    { action: 'save', save: { ...save, snapshot: { ...snapshot, coins: -1 } } },
    { action: 'save', save: { ...save, snapshot: { ...snapshot, worldState: { ...worldState, eggs: [] } } } },
  ])('rejects malformed input before contacting the database (%j)', async body => {
    expect((await handler(request(body))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('only allows the three new species and bounds placement and roster data', () => {
    expect(validWorldState({ ...worldState, progressVersion: undefined })).toBe(false);
    const pet = { id: 'pet-1', speciesId: 'harbor-cat', name: '港灣小貓', exp: 0, bond: 0, hunger: 100, clean: 100, energy: 100 };
    expect(validWorldState({ ...worldState, ownedPets: [pet], activePetId: pet.id })).toBe(true);
    expect(validWorldState({ ...worldState, ownedPets: [{ ...pet, speciesId: 'kitty' }] })).toBe(false);
    expect(validWorldState({ ...worldState, ownedPets: [pet, { ...pet, id: 'pet-2' }] })).toBe(false);
    expect(validWorldState({ ...worldState, placements: [{ id: 'chair', itemId: 'chair', x: Infinity, z: 0, rotation: 0 }] })).toBe(false);
    expect(validWorldState({ ...worldState, pinHash: 'secret' })).toBe(false);
  });

  it('limits streamed request bytes and rejects malformed JSON', async () => {
    expect((await handler(request({}, { body: 'x'.repeat(262145) }))).status).toBe(413);
    expect((await handler(request({}, { body: '{' }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts the canonical world after adoption and chapter settlement', () => {
    const chapter = CHAPTERS[0], level = 'elementary';
    let world = applyWorldAction(createWorld(), { type: 'ADOPT_STARTER', speciesId: 'harbor-cat' }).world;
    chapter.levels[level].challenges.forEach((challenge, step) => {
      world = applyWorldAction(world, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step, answer: challenge.answer }).world;
    });
    world = applyWorldAction(world, { type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level }).world;
    expect(world.chapterProgress[`${chapter.id}:${level}`].settled).toBe(true);
    expect(validWorldState(world)).toBe(true);
    world.chapterProgress[`${chapter.id}:${level}`].settled = 'invalid';
    expect(validWorldState(world)).toBe(false);
  });

  it('rejects cross-origin/form submissions and unsupported methods', async () => {
    expect((await handler(request({}, { headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' } }))).status).toBe(403);
    expect((await handler(request({}, { headers: { 'Content-Type': 'text/plain' } }))).status).toBe(415);
    expect((await handler(new Request('https://englishgo.example', { method: 'GET' }))).status).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts legacy fallback hashes for existing credentials, never new signups', async () => {
    const legacy = { username: '舊夥伴', pinHash: '-12345' };
    expect((await handler(request({ action: 'login', credentials: legacy }))).status).toBe(200);
    expect((await handler(request({ action: 'signup', credentials: legacy }))).status).toBe(400);
  });

  it('does not expose provider failures or a missing service secret', async () => {
    fetch.mockRejectedValue(new Error('sensitive provider details'));
    expect(await (await handler(request({ action: 'login' }))).json()).toEqual({ ok: false, code: 'cloud_unavailable' });
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', ''); fetch.mockClear();
    expect((await handler(request({ action: 'login' }))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
