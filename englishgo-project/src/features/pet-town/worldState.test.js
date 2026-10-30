import { describe, expect, it } from 'vitest';
import { CHAPTERS, FURNITURE, LEVELS, PETS } from './worldData.js';
import { applyWorldAction, canAdoptPet, createWorld, getAdoptionSlots, getChapterProgress, getPetStage, isChapterUnlocked, isDecorationUnlocked, migrateLegacyWorld, validatePlacement } from './worldState.js';

const now = new Date('2026-10-30T04:00:00Z');
const context = { now, coins: 1000 };
const act = (world, action, options = {}) => applyWorldAction(world, action, { ...context, ...options });
const fresh = (speciesId = 'harbor-cat') => act(createWorld({ now }), { type: 'ADOPT_STARTER', speciesId }).world;
function solve(world, chapter, level = 'elementary') {
  return chapter.levels[level].challenges.reduce((state, challenge, step) => act(state, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step, answer: challenge.answer }).world, world);
}
function complete(world, chapter, level = 'elementary') {
  return act(solve(world, chapter, level), { type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level });
}
function finishThrough(world, count) {
  return CHAPTERS.slice(0, count).reduce((state, chapter) => complete(state, chapter).world, world);
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
}

describe('new island saves and deterministic adoptions', () => {
  it('does not import old pets, eggs, food, experience or unlocks into the new world', () => {
    const old = { pets: [{ petId: 'bunny', level: 99 }], eggs: [{ petId: 'dragon' }], coins: 5000, inventory: { apple: 50 }, completedChapters: CHAPTERS.map(chapter => chapter.id) };
    expect(migrateLegacyWorld(old, { now })).toEqual(createWorld({ now }));
    expect(createWorld({ now })).not.toHaveProperty('coins');
    expect(createWorld({ now })).not.toHaveProperty('eggs');
  });

  it.each(PETS.map(pet => pet.id))('allows %s as a free starter with exactly one starting slot', speciesId => {
    const initial = createWorld({ now }), result = act(initial, { type: 'ADOPT_STARTER', speciesId }, { coins: 0 });
    expect(result.coinDelta).toBe(0);
    expect(result.world.ownedPets).toHaveLength(1);
    expect(result.world.ownedPets[0].speciesId).toBe(speciesId);
    expect(result.world.activePetId).toBe(result.world.ownedPets[0].id);
    expect(getAdoptionSlots(result.world)).toBe(1);
    expect(act(result.world, { type: 'ADOPT_STARTER', speciesId }).world).toBe(result.world);
    expect(initial.ownedPets).toEqual([]);
  });

  it('opens exactly one additional choice after each of chapters three and six', () => {
    let world = fresh('garden-rabbit');
    expect(canAdoptPet(world, 'harbor-cat')).toBe(false);
    expect(act(world, { type: 'ADOPT_FRIEND', speciesId: 'harbor-cat' }).world).toBe(world);
    world = finishThrough(world, 3);
    expect(getAdoptionSlots(world)).toBe(2);
    world = act(world, { type: 'ADOPT_FRIEND', speciesId: 'sunny-dog' }).world;
    expect(world.ownedPets.map(pet => pet.speciesId)).toEqual(['garden-rabbit', 'sunny-dog']);
    expect(canAdoptPet(world, 'harbor-cat')).toBe(false);
    world = finishThrough(world, 6);
    world = act(world, { type: 'ADOPT_FRIEND', speciesId: 'harbor-cat' }).world;
    expect(world.ownedPets).toHaveLength(3);
    expect(getAdoptionSlots(world)).toBe(3);
    expect(act(world, { type: 'ADOPT_FRIEND', speciesId: 'harbor-cat' }).world).toBe(world);
  });

  it('preserves valid v2 data across reload and rejects invalid IDs and non-finite values', () => {
    const world = fresh();
    const raw = { ...world, ownedPets: [{ ...world.ownedPets[0], exp: 130 }, { ...world.ownedPets[0] }, { id: 'old', speciesId: 'dragon' }],
      ownedDecorations: [...world.ownedDecorations, 'unknown'], placements: [...world.placements, { id: 'bad', itemId: 'harbor-bowl', x: Infinity, z: 0 }],
      settings: { quality: 'ultra', motion: false, sound: true }, receipts: [...world.receipts, ...world.receipts, null], syncReceipts: ['wallet-op-1', 'wallet-op-1', 'save-op-2'] };
    const loaded = migrateLegacyWorld(raw, { now });
    expect(loaded.ownedPets).toHaveLength(1);
    expect(loaded.ownedPets[0].exp).toBe(130);
    expect(loaded.ownedDecorations).not.toContain('unknown');
    expect(loaded.placements).toHaveLength(3);
    expect(loaded.settings).toEqual({ quality: 'auto', motion: false, sound: true });
    expect(loaded.receipts).toEqual(world.receipts);
    expect(loaded.syncReceipts).toEqual(['wallet-op-1', 'save-op-2']);
    expect(migrateLegacyWorld(loaded, { now })).toEqual(loaded);
  });
});

describe('story evidence and one-time rewards', () => {
  it('keeps wrong answers and retries without paying, and disallows jumping over a question', () => {
    const world = fresh(), chapter = CHAPTERS[0], level = 'elementary', question = chapter.levels[level].challenges[0];
    const wrong = act(world, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step: 0, answer: (question.answer + 1) % 3 }).world;
    expect(getChapterProgress(wrong, chapter.id, level)).toMatchObject({ step: 0, attempts: { 0: 1 } });
    expect(wrong.ownedPets[0].exp).toBe(0);
    expect(act(wrong, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step: 1, answer: 0 }).world).toBe(wrong);
    expect(act(wrong, { type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level }).completedChapter).toBeUndefined();
    const correct = act(wrong, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step: 0, answer: question.answer }).world;
    expect(getChapterProgress(correct, chapter.id, level)).toMatchObject({ step: 1, attempts: { 0: 2 } });
    expect(act(correct, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step: 0, answer: question.answer }).world).toBe(correct);
  });

  it('persists the exact next question and allows an honest retry after remount', () => {
    const chapter = CHAPTERS[0], level = 'junior';
    let world = act(fresh(), { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step: 0, answer: chapter.levels[level].challenges[0].answer }).world;
    world = migrateLegacyWorld(JSON.parse(JSON.stringify(world)), { now });
    expect(getChapterProgress(world, chapter.id, level).step).toBe(1);
    const result = complete(world, chapter, level);
    expect(result.completedChapter).toBe(chapter.id);
    expect(result.world.ownedPets[0].exp).toBe(40);
  });

  it('awards a chapter once across clicks, reloads, levels and previously purchased rewards', () => {
    const chapter = CHAPTERS[0];
    let world = act(fresh(), { type: 'BUY_DECOR', itemId: chapter.rewardItemIds[0] }).world;
    const first = complete(world, chapter);
    expect(first).toMatchObject({ completedChapter: chapter.id, coinDelta: 0 });
    expect(first.world.ownedPets[0]).toMatchObject({ exp: 40, bond: 8 });
    world = migrateLegacyWorld(first.world, { now });
    expect(complete(world, chapter).completedChapter).toBeUndefined();
    const repeatedAtSenior = complete(world, chapter, 'senior');
    expect(repeatedAtSenior.completedChapter).toBeUndefined();
    expect(repeatedAtSenior.world.ownedPets[0]).toMatchObject({ exp: 50, bond: 8 });
    expect(repeatedAtSenior.world.ownedDecorations.filter(id => id === chapter.rewardItemIds[0])).toHaveLength(1);
    expect(repeatedAtSenior.world.journal.filter(entry => entry.kind === 'story')).toHaveLength(1);
  });

  it('replays two real questions and gives modest growth once per chapter per day without another global reward', () => {
    const chapter = CHAPTERS[0], initial = complete(fresh(), chapter).world;
    const replay = act(initial, { type: 'REPLAY_CHAPTER', chapterId: chapter.id, level: 'elementary' }).world;
    expect(getChapterProgress(replay, chapter.id, 'elementary')).toEqual({ step: 0, answers: {}, attempts: {}, settled: false });
    expect(replay.completedChapters).toEqual(initial.completedChapters);
    expect(replay.receipts).toEqual(initial.receipts);
    expect(complete(replay, chapter)).not.toHaveProperty('completedChapter');
    const finished = complete(replay, chapter).world;
    expect(finished.ownedPets[0].exp).toBe(50);
    expect(complete(finished, chapter).world.ownedPets[0].exp).toBe(50);
    const anotherRun = act(finished, { type: 'REPLAY_CHAPTER', chapterId: chapter.id, level: 'elementary' }).world;
    expect(complete(anotherRun, chapter).world.ownedPets[0].exp).toBe(50);
    const tomorrow = new Date(now.getTime() + 86400000);
    const nextDayRun = act(finished, { type: 'REPLAY_CHAPTER', chapterId: chapter.id, level: 'elementary' }, { now: tomorrow }).world;
    const result = act(solve(nextDayRun, chapter), { type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level: 'elementary' }, { now: tomorrow });
    expect(result.world.ownedPets[0].exp).toBe(60);
    expect(result.coinDelta).toBe(0);
    expect(result.completedChapter).toBeUndefined();
    expect(result.world.ownedDecorations).toEqual(initial.ownedDecorations);
  });

  it.each(LEVELS)('finishes all nine chapters at %s with no microphone, key, timer or currency', level => {
    let world = fresh();
    expect(isChapterUnlocked(world, CHAPTERS[0].id)).toBe(true);
    expect(isChapterUnlocked(world, CHAPTERS[1].id)).toBe(false);
    expect(act(world, { type: 'STORY_PROGRESS', chapterId: CHAPTERS[8].id, level, step: 0, answer: 0 }).world).toBe(world);
    for (const chapter of CHAPTERS) {
      const result = complete(world, chapter, level);
      expect(result.completedChapter).toBe(chapter.id);
      expect(result.coinDelta).toBe(0);
      world = result.world;
    }
    expect(world.completedChapters).toHaveLength(9);
    expect(world.ownedPets[0].exp).toBe(360);
    expect(getPetStage(world.ownedPets[0])).toMatchObject({ id: 'grown', progress: 100 });
    expect(getAdoptionSlots(world)).toBe(3);
  });

  it('does not trust a saved step counter without matching answers', () => {
    const world = fresh(), chapter = CHAPTERS[0];
    const forged = { ...world, chapterProgress: { [`${chapter.id}:elementary`]: { step: 2, answers: {}, attempts: {} } } };
    expect(act(forged, { type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level: 'elementary' }).completedChapter).toBeUndefined();
    expect(getChapterProgress(migrateLegacyWorld(forged, { now }), chapter.id, 'elementary').step).toBe(0);
  });
});

describe('free gentle care and optional learning', () => {
  it('never charges for care, never requires English and limits bond to once per action each day', () => {
    let world = fresh();
    const petId = world.activePetId;
    for (const careType of ['feed', 'wash', 'play', 'sleep', 'pet']) {
      const result = act(world, { type: 'CARE', petId, careType }, { coins: 0 });
      expect(result.coinDelta).toBe(0);
      world = result.world;
      const bond = world.ownedPets[0].bond;
      world = act(world, { type: 'CARE', petId, careType }, { coins: 0 }).world;
      expect(world.ownedPets[0].bond).toBe(bond);
    }
    expect(world.ownedPets[0]).toMatchObject({ exp: 0, bond: 10, hunger: 100, clean: 100, energy: 100 });
    expect(world.completedChapters).toEqual([]);
    const tomorrow = new Date(now.getTime() + 86400000);
    expect(act(world, { type: 'CARE', petId, careType: 'pet' }, { now: tomorrow }).world.ownedPets[0].bond).toBe(12);
  });

  it('caps long absences and handles future or corrupt timestamps without punishing the pet', () => {
    const world = fresh();
    const longBreak = migrateLegacyWorld(world, { now: new Date('2030-01-01T00:00:00Z') }).ownedPets[0];
    expect(longBreak.hunger).toBeGreaterThanOrEqual(50);
    expect(longBreak.clean).toBeGreaterThanOrEqual(50);
    expect(longBreak.energy).toBe(100);
    expect(longBreak.exp).toBe(0);
    for (const lastUpdate of ['bad date', '2099-01-01']) {
      const loaded = migrateLegacyWorld({ ...world, ownedPets: [{ ...world.ownedPets[0], lastUpdate, energy: -200 }] }, { now });
      expect(loaded.ownedPets[0].energy).toBe(50);
      expect(Number.isFinite(loaded.ownedPets[0].hunger)).toBe(true);
    }
  });

  it('deduplicates learning events, caps daily bonus and never unlocks stories or grants coins', () => {
    let world = fresh();
    const event = { id: 'session-1:apple:practice', source: 'srs', kind: 'practice', outcome: 'participated' };
    const first = act(world, { type: 'LEARNING_EVENT', event });
    expect(first.coinDelta).toBe(0);
    expect(first.world.ownedPets[0]).toMatchObject({ exp: 2, bond: 1 });
    expect(act(first.world, { type: 'LEARNING_EVENT', event }).world).toBe(first.world);
    world = first.world;
    for (let index = 0; index < 8; index++) world = act(world, { type: 'LEARNING_EVENT', event: { ...event, id: `reading:${index}`, source: 'reading' } }).world;
    expect(world.ownedPets[0]).toMatchObject({ exp: 10, bond: 5 });
    expect(world.completedChapters).toEqual([]);
    expect(act(world, { type: 'LEARNING_EVENT', event: { id: 'pet-loop', source: 'pets' } }).world).toBe(world);
    expect(act(world, { type: 'LEARNING_EVENT', event: { source: 'srs' } }).world).toBe(world);
    const nextDay = act(world, { type: 'LEARNING_EVENT', event: { ...event, id: 'session-2:apple:practice' } }, { now: new Date(now.getTime() + 86400000) });
    expect(nextDay.world.ownedPets[0].exp).toBe(12);
    expect(act(nextDay.world, { type: 'LEARNING_EVENT', event: { ...event, id: 'reading:7' } }, { now: new Date(now.getTime() + 86400000) }).world.ownedPets[0].exp).toBe(12);
  });
});

describe('furniture purchases and safe placement', () => {
  it('uses the external wallet exactly once and never permits an unaffordable purchase', () => {
    const world = fresh(), item = FURNITURE.find(item => !item.starter);
    expect(act(world, { type: 'BUY_DECOR', itemId: item.id }, { coins: item.price - 1 }).world).toBe(world);
    expect(act(world, { type: 'BUY_DECOR', itemId: item.id }, { coins: NaN }).coinDelta).toBe(0);
    const purchased = act(world, { type: 'BUY_DECOR', itemId: item.id }, { coins: item.price });
    expect(purchased.coinDelta).toBe(-item.price);
    expect(purchased.world.ownedDecorations).toContain(item.id);
    expect(act(purchased.world, { type: 'BUY_DECOR', itemId: item.id }, { coins: 1000 }).coinDelta).toBe(0);
    expect(purchased.world).not.toHaveProperty('coins');
  });

  it('enforces the same regional shop unlocks as exploration, even with enough coins', () => {
    const world = fresh();
    expect(isDecorationUnlocked(world, 'harbor-bench')).toBe(true);
    expect(isDecorationUnlocked(world, 'orchard-rug')).toBe(false);
    expect(act(world, { type: 'BUY_DECOR', itemId: 'orchard-rug' }).world).toBe(world);
    const orchard = finishThrough(world, 3);
    expect(act(orchard, { type: 'BUY_DECOR', itemId: 'orchard-rug' }).coinDelta).toBe(-45);
    expect(act(orchard, { type: 'BUY_DECOR', itemId: 'starlight-tree' }).world).toBe(orchard);
    expect(isDecorationUnlocked(finishThrough(orchard, 6), 'starlight-tree')).toBe(true);
  });

  it('rejects unowned items, non-finite coordinates, bounds, occupied space and the walking path', () => {
    const world = fresh(), itemId = 'harbor-cushion';
    expect(validatePlacement(world, { itemId: 'starlight-tree', x: 2, z: 2 }).ok).toBe(false);
    for (const placement of [
      { itemId, x: NaN, z: 2 }, { itemId, x: 3.9, z: 2 }, { itemId, x: 2, z: 3.9 },
      { itemId, x: 0, z: 2 }, { itemId, x: 2.6, z: 0 }, { itemId, x: 2, z: 2, rotation: Infinity },
    ]) expect(validatePlacement(world, placement).ok).toBe(false);
    expect(act(world, { type: 'PLACE_DECOR', placement: { itemId, x: 0, z: 2 } }).world).toBe(world);
  });

  it('moves an existing item, snaps its quarter turn, and removes it without losing ownership', () => {
    const world = fresh(), itemId = 'harbor-cushion';
    const moved = act(world, { type: 'PLACE_DECOR', placement: { id: 'new-id', itemId, x: 2.31, z: 2.03, rotation: 1.6 } }).world;
    expect(moved.placements).toHaveLength(3);
    const item = moved.placements.find(item => item.itemId === itemId);
    expect(item).toEqual({ id: 'placement-harbor-cushion', itemId, x: 2.3, z: 2, rotation: Math.PI / 2 });
    const removed = act(moved, { type: 'REMOVE_DECOR', placementId: item.id }).world;
    expect(removed.placements).toHaveLength(2);
    expect(removed.ownedDecorations).toContain(itemId);
    expect(act(removed, { type: 'PLACE_DECOR', placement: { itemId, x: 2.3, z: 2 } }).world.placements).toHaveLength(3);
  });

  it('allows an object on a decorative rug and rotates rectangular footprints correctly', () => {
    let world = finishThrough(fresh(), 3);
    for (const itemId of ['orchard-rug', 'harbor-bench']) world = act(world, { type: 'BUY_DECOR', itemId }).world;
    world = act(world, { type: 'PLACE_DECOR', placement: { itemId: 'orchard-rug', x: 2.5, z: 2.5 } }).world;
    expect(validatePlacement(world, { itemId: 'harbor-bench', x: 2.5, z: 2.5, rotation: 0 }).ok).toBe(true);
    expect(validatePlacement(world, { itemId: 'harbor-bench', x: 3.5, z: 2.5, rotation: 0 }).ok).toBe(false);
    expect(validatePlacement(world, { itemId: 'harbor-bench', x: 3.5, z: 2.5, rotation: Math.PI / 2 }).ok).toBe(true);
  });
});

describe('state boundaries', () => {
  it('keeps every action pure and settings independent of other state', () => {
    const world = deepFreeze(fresh()), before = JSON.stringify(world);
    const result = act(world, { type: 'CARE', careType: 'feed' });
    expect(JSON.stringify(world)).toBe(before);
    expect(result.world).not.toBe(world);
    const configured = act(world, { type: 'SETTINGS', patch: { quality: 'low', motion: false, sound: true } }).world;
    expect(configured.settings).toEqual({ quality: 'low', motion: false, sound: true });
    expect(configured.ownedPets).toBe(world.ownedPets);
    expect(act(world, { type: 'UNKNOWN' }).world).toBe(world);
  });
});
