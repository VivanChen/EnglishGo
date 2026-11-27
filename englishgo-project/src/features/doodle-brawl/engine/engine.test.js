import { describe, expect, it } from 'vitest';
import { ENEMIES, WAVE_COUNT, enemyHp, waveDuration } from '../data/enemies.js';
import { HEROES, HERO_IDS, heroUnlocked } from '../data/heroes.js';
import { ITEMS, ITEM_IDS } from '../data/items.js';
import { STATS } from '../data/stats.js';
import { WEAPONS, WEAPON_IDS } from '../data/weapons.js';
import { armorFactor, computeStats, rerollCost, tierOdds, xpForLevel } from './build.js';
import { botBetweenWaves, playRun, playWave } from './bot.js';
import { addWeapon, combinePartner, newRun, runReducer } from './run.js';
import { STEP, createWorld, stepWorld } from './sim.js';

const start = (options = {}) => newRun({ seed: 1234, hero: 'sketch', difficulty: 'normal', ...options });

// Plays wave 1 with the autopilot and moves the run to the shop.
function toShop(run = start()) {
  const world = playWave(run);
  let next = runReducer(run, { type: 'WAVE_DONE', result: world.result });
  while (next.phase === 'levelup') next = runReducer(next, { type: 'PICK_LEVEL', index: 0 });
  while (next.phase === 'crate') { next = runReducer(next, { type: 'OPEN_CRATE', ok: null }); next = runReducer(next, { type: 'TAKE_CRATE' }); }
  return next;
}

describe('Doodle Brawl data', () => {
  it('describes every weapon, item, hero and monster completely', () => {
    WEAPON_IDS.forEach(id => {
      const def = WEAPONS[id];
      expect(def.en && def.zh && def.text, id).toBeTruthy();
      ['dmg', 'cd', 'range'].forEach(key => expect(def[key], `${id}.${key}`).toHaveLength(4));
    });
    ITEM_IDS.forEach(id => {
      const item = ITEMS[id];
      expect(item.en && item.zh, id).toBeTruthy();
      expect(item.tier).toBeGreaterThanOrEqual(0);
      Object.keys(item.stats).forEach(stat => expect(STATS[stat], `${id}: ${stat}`).toBeDefined());
      expect(Object.keys(item.stats).length || item.effect, id).toBeTruthy();
    });
    HERO_IDS.forEach(id => expect(WEAPONS[HEROES[id].weapon], id).toBeDefined());
    Object.values(ENEMIES).forEach(def => expect(def.hp).toHaveLength(2));
  });

  it('unlocks heroes from records', () => {
    expect(heroUnlocked('sketch', {})).toBe(true);
    expect(heroUnlocked('zip', { bestWave: 5 })).toBe(false);
    expect(heroUnlocked('zip', { bestWave: 6 })).toBe(true);
    expect(heroUnlocked('lucky', { wins: 1 })).toBe(true);
  });

  it('makes later waves longer and monsters tougher, with a boss at the end', () => {
    expect(waveDuration(1)).toBe(20);
    expect(waveDuration(WAVE_COUNT - 1)).toBe(50);
    expect(waveDuration(WAVE_COUNT)).toBe(Infinity);
    expect(enemyHp('scribble', 10, { hp: 1 })).toBeGreaterThan(enemyHp('scribble', 2, { hp: 1 }) * 4);
    expect(enemyHp('scribble', 5, { hp: 0.62 })).toBeLessThan(enemyHp('scribble', 5, { hp: 1 }));
  });
});

describe('build rules', () => {
  it('adds hero, item and level-up stats', () => {
    const run = { ...start({ hero: 'brick' }), items: { snack: 2, helmet: 1 }, bonus: { damage: 5 }, level: 3 };
    const stats = computeStats(run);
    expect(stats.maxHp).toBe(15 + 8 + 6 + 3);
    expect(stats.armor).toBe(2 + 2);
    expect(stats.speed).toBe(-8 - 3);
    expect(stats.damage).toBe(5);
    expect(stats.melee).toBe(20);
  });

  it('turns armor into damage reduction and negative armor into extra damage', () => {
    expect(armorFactor(0)).toBe(1);
    expect(armorFactor(12)).toBeCloseTo(0.5);
    expect(armorFactor(-6)).toBeGreaterThan(1);
  });

  it('offers better tiers later in the run and with luck', () => {
    const early = tierOdds(1), late = tierOdds(11), lucky = tierOdds(11, 50);
    early.concat(late, lucky).forEach(p => expect(p).toBeGreaterThanOrEqual(0));
    expect(early.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(early[3]).toBe(0);
    expect(late[3]).toBeGreaterThan(0);
    expect(lucky[2] + lucky[3]).toBeGreaterThan(late[2] + late[3]);
    expect(xpForLevel(1)).toBeGreaterThan(xpForLevel(0));
  });
});

describe('the arena', () => {
  it('builds a world from the run with full health and the starting weapon', () => {
    const world = createWorld(start({ hero: 'brick' }));
    expect(world.player.hp).toBe(world.player.maxHp);
    expect(world.weapons.map(w => w.id)).toEqual(['ruler']);
    expect(world.duration).toBe(20);
  });

  it('auto-attacks, collects stars and clears the first wave', () => {
    const world = playWave(start());
    expect(world.done).toBe(true);
    expect(world.result.outcome).toBe('cleared');
    expect(world.result.kills).toBeGreaterThan(8);
    expect(world.result.stars).toBeGreaterThan(8);
    expect(world.time).toBeGreaterThanOrEqual(20);
    expect(world.enemies).toHaveLength(0);
  });

  it('replays a wave exactly from the same seed', () => {
    const a = playWave(start()), b = playWave(start());
    expect(a.result).toEqual(b.result);
  });

  it('knocks the hero out when it stands still in a late wave with a starter build', () => {
    const world = playWave({ ...start(), wave: 8 }, { idle: true });
    expect(world.result.outcome).toBe('dead');
    expect(world.player.hp).toBe(0);
  });

  it('hurts the hero on contact, but not again while it is flashing', () => {
    const world = createWorld(start());
    world.enemies.push({ ...createWorld(start()).player, id: 99, type: 'scribble', r: 17, hp: 50, maxHp: 50, speed: 0, dmg: 3, state: 'walk', t: 0, cd: 1, kx: 0, ky: 0, flash: 0, slowT: 0, slowK: 0, face: 1, wob: 0, born: 1, kiteCd: 0, x: world.player.x + 5, y: world.player.y });
    world.stats = { ...world.stats, dodge: 0 };
    stepWorld(world, {}, STEP);
    expect(world.player.hp).toBe(world.player.maxHp - 3);
    stepWorld(world, {}, STEP);
    expect(world.player.hp).toBe(world.player.maxHp - 3);
  });

  it('ends the final wave when the Ink King falls', () => {
    const run = { ...start({ difficulty: 'easy' }), wave: WAVE_COUNT, weapons: [{ id: 'pencil', tier: 3 }, { id: 'pencil', tier: 3 }, { id: 'highlighter', tier: 3 }, { id: 'eraser', tier: 3 }, { id: 'crayon', tier: 3 }, { id: 'plane', tier: 3 }], items: { crown: 3, trophy: 3, backpack: 4, raincoat: 3 } };
    const world = createWorld(run);
    let boss = null;
    for (let i = 0; i < 60 * 240 && !world.done; i++) {
      stepWorld(world, {}, STEP);
      world.events.length = 0;
      boss ||= world.boss;
      world.player.hp = world.player.maxHp;
    }
    expect(boss?.type).toBe('king');
    expect(world.result.outcome).toBe('victory');
  });
});

describe('between waves', () => {
  it('turns a cleared wave into stars, level-ups and then the shop', () => {
    const run = start();
    const world = playWave(run);
    const next = runReducer(run, { type: 'WAVE_DONE', result: world.result });
    expect(next.stars).toBeGreaterThanOrEqual(world.result.stars);
    expect(next.kills).toBe(world.result.kills);
    if (world.result.levelsGained) {
      expect(next.phase).toBe('levelup');
      expect(next.levelOffer).toHaveLength(4);
      const choice = next.levelOffer[1];
      const picked = runReducer(next, { type: 'PICK_LEVEL', index: 1 });
      expect(picked.bonus[choice.stat]).toBe(choice.value);
      expect(picked.pendingLevels).toBe(next.pendingLevels - 1);
    }
    expect(toShop().phase).toBe('shop');
  });

  it('ends the run when the hero falls', () => {
    const next = runReducer(start(), { type: 'WAVE_DONE', result: { outcome: 'dead', stars: 3, kills: 4, xp: 1, level: 0, levelsGained: 0, crates: 0, damage: 50 }, at: 9 });
    expect(next.phase).toBe('defeat');
    expect(next.endedAt).toBe(9);
  });

  it('sells, locks and rerolls in the shop', () => {
    const shop = { ...toShop(), stars: 500 };
    expect(shop.shop.slots).toHaveLength(4);
    const bought = runReducer(shop, { type: 'BUY', slot: 0 });
    expect(bought.stars).toBe(500 - shop.shop.slots[0].price);
    expect(bought.shop.slots[0].sold).toBe(true);
    expect(runReducer(bought, { type: 'BUY', slot: 0 })).toBe(bought);

    const locked = runReducer(bought, { type: 'LOCK', slot: 1 });
    const rerolled = runReducer(locked, { type: 'REROLL_SHOP' });
    expect(rerolled.stars).toBe(locked.stars - rerollCost(locked.wave, 0));
    expect(rerolled.shop.slots[1].key).toBe(locked.shop.slots[1].key);
    expect(rerolled.shop.slots[2].key).not.toBe(locked.shop.slots[2].key);

    const poor = { ...locked, stars: 0 };
    expect(runReducer(poor, { type: 'REROLL_SHOP' })).toBe(poor);
    expect(runReducer(poor, { type: 'BUY', slot: 2 })).toBe(poor);

    const next = runReducer(rerolled, { type: 'NEXT_WAVE' });
    expect(next.phase).toBe('wave');
    expect(next.wave).toBe(2);
  });

  it('keeps a locked offer into the next shop', () => {
    const shop = runReducer(toShop(), { type: 'LOCK', slot: 3 });
    const kept = shop.shop.slots[3];
    let run = runReducer(shop, { type: 'NEXT_WAVE' });
    run = runReducer(run, { type: 'WAVE_DONE', result: { outcome: 'cleared', stars: 5, kills: 5, xp: run.xp, level: run.level, levelsGained: 0, crates: 0, damage: 10 } });
    expect(run.phase).toBe('shop');
    expect(run.shop.slots[3]).toMatchObject({ key: kept.key, id: kept.id, locked: true });
  });

  it('merges weapons: two of the same tier become the next tier', () => {
    const full = Array.from({ length: 6 }, (_, i) => ({ id: i ? 'ruler' : 'pencil', tier: 0 }));
    expect(addWeapon(full, { id: 'crayon', tier: 0 })).toBeNull();
    expect(addWeapon(full, { id: 'pencil', tier: 0 })[0]).toEqual({ id: 'pencil', tier: 1 });
    const run = { ...toShop(), weapons: [{ id: 'pencil', tier: 1 }, { id: 'ruler', tier: 0 }, { id: 'pencil', tier: 1 }] };
    expect(combinePartner(run.weapons, 0)).toBe(2);
    expect(combinePartner(run.weapons, 1)).toBe(-1);
    const merged = runReducer(run, { type: 'COMBINE', index: 0 });
    expect(merged.weapons).toEqual([{ id: 'pencil', tier: 2 }, { id: 'ruler', tier: 0 }]);
    const sold = runReducer(merged, { type: 'SELL', index: 1 });
    expect(sold.weapons).toEqual([{ id: 'pencil', tier: 2 }]);
    expect(sold.stars).toBeGreaterThan(merged.stars);
    expect(runReducer(sold, { type: 'SELL', index: 0 })).toBe(sold);
  });

  it('upgrades a crate when its word is answered and records the word', () => {
    const base = { ...toShop(), phase: 'crate', crates: 2, crate: null };
    const right = runReducer(base, { type: 'OPEN_CRATE', ok: true, word: { w: 'apple', m: '蘋果' } });
    expect(ITEMS[right.crate.item].tier).toBeGreaterThanOrEqual(1);
    expect(right.words.at(-1)).toMatchObject({ w: 'apple', ok: true });
    const taken = runReducer(right, { type: 'TAKE_CRATE' });
    expect(taken.items[right.crate.item]).toBe((base.items[right.crate.item] || 0) + 1);
    expect(taken.phase).toBe('crate');
    expect(taken.crates).toBe(1);
    const skipped = runReducer(taken, { type: 'OPEN_CRATE', ok: null });
    expect(skipped.words).toHaveLength(taken.words.length);
    const recycled = runReducer(skipped, { type: 'RECYCLE_CRATE' });
    expect(recycled.stars).toBeGreaterThan(skipped.stars);
    expect(recycled.phase).toBe('shop');
  });

  it('lets the autopilot shop and play on', () => {
    const shop = { ...toShop(), stars: 80 };
    const next = botBetweenWaves(shop);
    expect(next.phase).toBe('wave');
    expect(next.wave).toBe(2);
    expect(next.stars).toBeLessThan(80);
  });
});

describe('a whole run', () => {
  it('can be won on Chill by the autopilot', () => {
    const { run, waves } = playRun(newRun({ seed: 7919, hero: 'sketch', difficulty: 'easy' }));
    expect(waves).toHaveLength(WAVE_COUNT);
    expect(run.phase).toBe('victory');
    expect(run.kills).toBeGreaterThan(500);
  }, 30000);
});
