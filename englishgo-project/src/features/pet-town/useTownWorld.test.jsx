import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./cloudAccount.js', () => ({ requestPetAccount: vi.fn() }));
import { requestPetAccount } from './cloudAccount.js';
import useTownWorld from './useTownWorld.js';
import { createWorld, applyWorldAction } from './worldState.js';
import { CHAPTERS } from './worldData.js';
import { commitTownOperation, readTownSnapshot, recordTownLearning, saveTownSnapshot } from './townStorage.js';

const a = { username: 'same-name', pinHash: 'a'.repeat(64), accountId: 'account-a' };
const b = { username: 'same-name', pinHash: 'b'.repeat(64), accountId: 'account-b' };
const worldWithPet = (speciesId = 'harbor-cat') => applyWorldAction(createWorld(), { type: 'ADOPT_STARTER', speciesId }).world;
const state = (worldState = worldWithPet(), coins = 100, revision = 1) => ({ worldState, coins, revision, pending: [] });
const response = (account, saved) => ({ ok: true, accountId: account.accountId, revision: saved.revision,
  snapshot: { worldState: saved.worldState, coins: saved.coins } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(1501); });
function useHarness({ initialAccount = null, initialCoins = 100, onChapterComplete = vi.fn() } = {}) {
  const [account, setAccount] = useState(initialAccount), [coins, setCoins] = useState(initialCoins);
  const town = useTownWorld({ account, setAccount, coins, setCoins,
    onChapterComplete });
  return { town, coins, account, setAccount, setCoins };
}
beforeEach(() => { vi.useFakeTimers(); requestPetAccount.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('pet town sync lifecycle', () => {
  it('backs up a guest before connecting and restores that exact guest on logout', async () => {
    saveTownSnapshot(null, state());
    const hook = renderHook(() => useHarness());
    act(() => hook.result.current.town.connect(b, response(b, state(worldWithPet('sunny-dog'), 22, 4))));
    await flush();
    expect(hook.result.current.coins).toBe(22);
    expect(hook.result.current.town.world.ownedPets[0].speciesId).toBe('sunny-dog');
    expect(readTownSnapshot(b).pending).toEqual([]);
    act(() => hook.result.current.town.logout()); await flush();
    expect(hook.result.current.coins).toBe(100);
    expect(hook.result.current.town.world.ownedPets[0].speciesId).toBe('harbor-cat');
    expect(readTownSnapshot(b).coins).toBe(22);
  });

  it('retries an identical durable request, keeps new actions, and adopts authoritative success', async () => {
    const initial = state(); saveTownSnapshot(a, initial);
    const first = deferred();
    requestPetAccount.mockResolvedValueOnce(response(a, initial)).mockImplementationOnce(() => first.promise);
    const hook = renderHook(() => useHarness({ initialAccount: a })); await flush();
    act(() => hook.result.current.town.dispatch({ type: 'SETTINGS', patch: { sound: true } })); await tick();
    const sent = requestPetAccount.mock.calls[1][1].save;
    const signal = requestPetAccount.mock.calls[1][2].signal;
    act(() => hook.result.current.town.dispatch({ type: 'SETTINGS', patch: { quality: 'low' } }));
    expect(signal.aborted).toBe(false);
    await act(async () => first.resolve({ ok: false, status: 503, error: 'offline' }));
    expect(hook.result.current.town.status).toBe('error');
    const authoritative = { ...sent.snapshot.worldState, placements: [] };
    requestPetAccount.mockResolvedValueOnce(response(a, state(authoritative, 80, 4)));
    act(() => hook.result.current.town.retrySync()); await tick();
    expect(requestPetAccount.mock.calls[2][1].save).toEqual(sent);
    expect(hook.result.current.coins).toBe(80);
    expect(hook.result.current.town.world.placements).toEqual([]);
    expect(hook.result.current.town.world.settings).toMatchObject({ sound: true, quality: 'low' });
    expect(readTownSnapshot(a).pending).toHaveLength(1);
    requestPetAccount.mockImplementationOnce(async (_action, payload) => response(a, state(payload.save.snapshot.worldState, payload.save.snapshot.coins, 5)));
    await tick();
    expect(requestPetAccount.mock.calls[3][1].save.mutationId).not.toBe(sent.mutationId);
    expect(readTownSnapshot(a).pending).toEqual([]);
    expect(hook.result.current.town.status).toBe('synced');
  });

  it('ignores a previous account response even when both account names match', async () => {
    saveTownSnapshot(a, state()); saveTownSnapshot(b, state(worldWithPet('sunny-dog'), 40));
    const first = deferred(), second = deferred();
    requestPetAccount.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const hook = renderHook(() => useHarness({ initialAccount: a }));
    act(() => hook.result.current.setAccount(b)); await flush();
    expect(requestPetAccount.mock.calls[0][2].signal.aborted).toBe(true);
    await act(async () => first.resolve(response(a, state(worldWithPet(), 999, 8))));
    expect(hook.result.current.coins).toBe(40);
    await act(async () => second.resolve(response(b, state(worldWithPet('garden-rabbit'), 31, 3))));
    expect(hook.result.current.coins).toBe(31);
    expect(hook.result.current.town.world.ownedPets[0].speciesId).toBe('garden-rabbit');
    expect(readTownSnapshot(b).pending).toEqual([]);
    expect(readTownSnapshot(a).coins).toBe(100);
  });

  it('does not count a mounted external lesson wallet award twice', async () => {
    saveTownSnapshot(null, state());
    const hook = renderHook(() => useHarness());
    act(() => {
      recordTownLearning({ id: 'srs-one', source: 'srs', coinDelta: 3 }, null, 103);
      hook.result.current.setCoins(value => value + 3);
    }); await flush();
    expect(hook.result.current.coins).toBe(103);
    expect(readTownSnapshot(null).coins).toBe(103);
    expect(readTownSnapshot(null).pending.map(op => op.action.type)).toEqual(['LEARNING_EVENT']);
    expect(hook.result.current.town.world.ownedPets[0].exp).toBe(2);
  });

  it('awards global chapter XP through its completion callback only once', async () => {
    const chapter = CHAPTERS[0], level = 'elementary';
    let world = worldWithPet();
    chapter.levels[level].challenges.forEach((challenge, step) => {
      world = applyWorldAction(world, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step, answer: challenge.answer }).world;
    });
    saveTownSnapshot(null, state(world)); const completed = vi.fn();
    const hook = renderHook(() => useHarness({ onChapterComplete: completed }));
    act(() => {
      hook.result.current.town.dispatch({ type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level });
      hook.result.current.town.dispatch({ type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level });
    }); await flush();
    expect(completed).toHaveBeenCalledTimes(1); expect(hook.result.current.coins).toBe(105);
    expect(readTownSnapshot(null).coins).toBe(105);
    expect(readTownSnapshot(null).pending.filter(op => op.action.type === 'WALLET_DELTA')).toHaveLength(0);
  });

  it('migrates the cloud baseline before replaying offline adoption and coin awards', async () => {
    let local = { ...state(createWorld(), 100, 0) };
    local = commitTownOperation(local, { type: 'ADOPT_STARTER', speciesId: 'harbor-cat' }).snapshot;
    local = commitTownOperation(local, { type: 'WALLET_DELTA', delta: 5 }).snapshot;
    saveTownSnapshot(a, local);
    requestPetAccount.mockResolvedValueOnce(response(a, state(null, 99, 0)))
      .mockImplementation(async (_action, payload) => response(a, state(payload.save.snapshot.worldState, payload.save.snapshot.coins, payload.save.baseRevision + 1)));
    const hook = renderHook(() => useHarness({ initialAccount: a, initialCoins: 105 })); await flush();
    expect(hook.result.current.coins).toBe(104);
    await tick();
    const migration = requestPetAccount.mock.calls[1][1].save.snapshot;
    expect(migration.worldState.ownedPets).toEqual([]); expect(migration.coins).toBe(99);
    expect(hook.result.current.coins).toBe(104); expect(hook.result.current.town.world.ownedPets).toHaveLength(1);
    await tick();
    expect(requestPetAccount.mock.calls[2][1].save.snapshot.coins).toBe(104);
    expect(readTownSnapshot(a).pending).toEqual([]);
  });
});
