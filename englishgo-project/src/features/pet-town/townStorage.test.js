import { describe, expect, it } from 'vitest';
import { createWorld } from './worldState.js';
import { CHAPTERS } from './worldData.js';
import { validWorldState } from '../../../netlify/functions/pet-account.mjs';
import { acknowledgeTownSave, commitTownOperation, prepareTownSave,
  readTownSnapshot, rebaseTownOperations, recordTownLearning, saveTownSnapshot, townScope } from './townStorage.js';

const fresh = (coins = 100) => ({ worldState: createWorld(), coins, revision: 0, pending: [] });
const adopt = snapshot => commitTownOperation(snapshot, { type: 'ADOPT_STARTER', speciesId: 'harbor-cat', operationId: 'adopt-1' }).snapshot;

describe('pet town durable transport state', () => {
  it('keeps old same-name accounts isolated before their UUID is known', () => {
    expect(townScope({ username: 'same', pinHash: 'a' })).not.toBe(townScope({ username: 'same', pinHash: 'b' }));
  });
  it('preserves operation receipts and the exact request across a reload and new actions', () => {
    const first = prepareTownSave(adopt(fresh()));
    saveTownSnapshot(null, first);
    const reloaded = readTownSnapshot(null, 100);
    expect(reloaded.worldState.syncReceipts).toContain('adopt-1');
    const changed = commitTownOperation(reloaded, { type: 'SETTINGS', patch: { sound: true } }).snapshot;
    expect(prepareTownSave(changed).inFlight).toEqual(first.inFlight);
  });
  it('adopts an authoritative newer layout and replays only unsent wallet changes', () => {
    const sent = prepareTownSave(adopt(fresh()));
    const local = commitTownOperation(sent, { type: 'WALLET_DELTA', delta: 5, operationId: 'lesson-1' }).snapshot;
    const remoteWorld = { ...sent.worldState, placements: [], settings: { quality: 'low', motion: false, sound: false } };
    const next = acknowledgeTownSave(local, { revision: 4, snapshot: { worldState: remoteWorld, coins: 73 } });
    expect(next.coins).toBe(78); expect(next.revision).toBe(4); expect(next.worldState.placements).toEqual([]);
    expect(next.worldState.settings.quality).toBe('low'); expect(next.pending.map(op => op.id)).toEqual(['lesson-1']);
    expect(rebaseTownOperations({ ...next, revision: 5 }, next.pending).coins).toBe(78);
  });
  it('settles learning and its wallet award once outside the page, including batched calls', () => {
    saveTownSnapshot(null, adopt(fresh()));
    const event = { id: 'lesson-1', source: 'srs', coinDelta: 3 };
    recordTownLearning(event, null, 103); recordTownLearning(event, null, 103);
    recordTownLearning({ ...event, id: 'lesson-2' }, null, 103); // stale render total, explicit delta is reliable
    const saved = readTownSnapshot(null);
    expect(saved.coins).toBe(106); expect(saved.worldState.ownedPets[0].exp).toBe(4);
    expect(saved.pending.filter(op => op.action.type === 'LEARNING_EVENT')).toHaveLength(2);
    const remote = rebaseTownOperations({ worldState: createWorld(), coins: 70, revision: 2 }, saved.pending);
    expect(remote.coins).toBe(76); expect(remote.worldState.ownedPets[0].exp).toBe(4);
  });
  it('retains normal lesson coins even with no pet or after the daily pet growth cap', () => {
    for (let i = 0; i < 7; i++) recordTownLearning({ id: `lesson-${i}`, source: 'quiz', coinDelta: 2 }, null, 102);
    expect(readTownSnapshot(null).coins).toBe(114);
    expect(readTownSnapshot(null).worldState.ownedPets).toEqual([]);
  });
  it('accepts real domain state and story progress at the cloud boundary', () => {
    expect(validWorldState(createWorld())).toBe(true);
    expect(validWorldState({ ...adopt(fresh()).worldState, chapterProgress: { 'harbor-1:elementary': { step: 1, answers: { 0: 2 }, attempts: { 0: 1 } } } })).toBe(true);
  });

  it('rebases concurrent first chapter completions without duplicating their wallet award', () => {
    const initial = { ...adopt(fresh()), pending: [] }, chapter = CHAPTERS[0], level = 'elementary';
    function finish(device) {
      let saved = initial;
      chapter.levels[level].challenges.forEach((challenge, step) => {
        saved = commitTownOperation(saved, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step,
          answer: challenge.answer, operationId: `${device}-step-${step}` }).snapshot;
      });
      return commitTownOperation(saved, { type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level, operationId: `${device}-finish` }).snapshot;
    }
    const first = finish('phone'), second = finish('tablet');
    expect(first.coins).toBe(105); expect(second.coins).toBe(105);
    expect(second.pending.map(entry => entry.action.type)).not.toContain('WALLET_DELTA');
    const merged = rebaseTownOperations({ ...first, revision: 2 }, second.pending);
    expect(merged.coins).toBe(105);
    expect(merged.worldState.ownedPets[0].exp).toBe(chapter.petXp);
    expect(merged.worldState.receipts.filter(id => id === `chapter:${chapter.id}`)).toHaveLength(1);
  });
});
