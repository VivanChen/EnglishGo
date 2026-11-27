// The run between waves: rewards, level-ups, crates and the shop. Pure and
// seeded; the arena (sim.js) plays each wave and reports a result here.
import { WAVE_COUNT } from '../data/enemies.js';
import { HEROES } from '../data/heroes.js';
import { ITEMS, itemsOfTier } from '../data/items.js';
import { LEVEL_STATS } from '../data/stats.js';
import { MAX_WEAPONS, WEAPON_IDS } from '../data/weapons.js';
import { computeStats, itemPrice, recycleValue, rerollCost, rollTier, weaponPrice, weaponSellValue } from './build.js';
import { pick, rnd, shuffle } from './rng.js';

export const SAVE_VERSION = 1;
export const SHOP_SIZE = 4;
export const LEVEL_CHOICES = 4;

export function newRun({ seed, hero = 'sketch', difficulty = 'normal', startedAt = 0 }) {
  const heroId = HEROES[hero] ? hero : 'sketch';
  return {
    version: SAVE_VERSION, seed: seed >>> 0, rng: seed >>> 0, hero: heroId, difficulty, startedAt,
    wave: 1, phase: 'wave', stars: 0, xp: 0, level: 0, pendingLevels: 0, levelOffer: null, levelRerolls: 0,
    bonus: {}, weapons: [{ id: HEROES[heroId].weapon, tier: 0 }], items: {}, crates: 0, crate: null, shop: null,
    offerId: 0, kills: 0, damage: 0, words: [], waveLog: [], lastHarvest: 0,
  };
}

// Adds a weapon, merging it into a same-tier copy when every slot is full.
export function addWeapon(weapons, weapon) {
  if (weapons.length < MAX_WEAPONS) return [...weapons, { id: weapon.id, tier: weapon.tier }];
  const index = weapons.findIndex(other => other.id === weapon.id && other.tier === weapon.tier && other.tier < 3);
  if (index < 0) return null;
  return weapons.map((other, i) => (i === index ? { ...other, tier: other.tier + 1 } : other));
}

export const combinePartner = (weapons, index) => {
  const weapon = weapons[index];
  if (!weapon || weapon.tier >= 3) return -1;
  return weapons.findIndex((other, i) => i !== index && other.id === weapon.id && other.tier === weapon.tier);
};

function rollLevelOffer(run) {
  const luck = computeStats(run).luck;
  const basis = 1 + (run.level - run.pendingLevels + 1) * 0.9;
  return shuffle(run, Object.keys(LEVEL_STATS)).slice(0, LEVEL_CHOICES).map(stat => {
    const tier = rollTier(run, basis, luck);
    return { stat, tier, value: LEVEL_STATS[stat][tier] };
  });
}

function rollOffer(run, luck) {
  const tier = rollTier(run, run.wave + 1, luck);
  const key = ++run.offerId;
  // Early on, the shop leans toward weapons so the build can grow.
  const weaponOdds = run.weapons.length < 3 ? 0.55 : run.weapons.length < 6 ? 0.38 : 0.3;
  if (rnd(run) < weaponOdds) {
    const owned = [...new Set(run.weapons.map(weapon => weapon.id))];
    const id = owned.length && rnd(run) < 0.45 ? pick(run, owned) : pick(run, WEAPON_IDS);
    return { key, kind: 'weapon', id, tier, price: weaponPrice(id, tier, run.wave) };
  }
  let pool = [];
  for (let t = tier; !pool.length && t >= 0; t--) pool = itemsOfTier(t);
  const id = pick(run, pool);
  return { key, kind: 'item', id, tier: ITEMS[id].tier, price: itemPrice(id, run.wave) };
}

function rollShopSlots(run, previous = []) {
  const luck = computeStats(run).luck;
  return Array.from({ length: SHOP_SIZE }, (_, index) => {
    const old = previous[index];
    if (old?.locked && !old.sold) {
      // Locked offers keep their item but follow the current price.
      const price = old.kind === 'weapon' ? weaponPrice(old.id, old.tier, run.wave) : itemPrice(old.id, run.wave);
      return { ...old, price };
    }
    return rollOffer(run, luck);
  });
}

// Moves to the next screen after a wave: level-ups, then crates, then shop.
function advance(run) {
  const next = { ...run };
  if (next.pendingLevels > 0) {
    next.phase = 'levelup';
    if (!next.levelOffer) next.levelOffer = rollLevelOffer(next);
    return next;
  }
  if (next.crates > 0) {
    next.phase = 'crate';
    return next;
  }
  next.phase = 'shop';
  if (next.shop?.forWave !== next.wave) next.shop = { forWave: next.wave, rerolls: 0, slots: rollShopSlots(next, next.shop?.slots) };
  return next;
}

export function runReducer(run, action) {
  if (action.type === 'LOAD') return action.run;
  if (action.type === 'NEW_RUN') return newRun(action);
  if (action.type === 'CLEAR') return null;
  if (!run) return run;
  switch (action.type) {
    case 'WAVE_DONE': {
      if (run.phase !== 'wave') return run;
      const result = action.result;
      const base = {
        ...run,
        kills: run.kills + (result.kills || 0),
        damage: run.damage + (result.damage || 0),
        xp: result.xp ?? run.xp,
        level: result.level ?? run.level,
        pendingLevels: run.pendingLevels + (result.levelsGained || 0),
        crates: run.crates + (result.crates || 0),
        stars: run.stars + (result.stars || 0),
        waveLog: [...run.waveLog, { wave: run.wave, outcome: result.outcome, kills: result.kills || 0 }],
      };
      if (result.outcome === 'dead') return { ...base, phase: 'defeat', endedAt: action.at || 0 };
      if (result.outcome === 'victory' || run.wave >= WAVE_COUNT) return { ...base, phase: 'victory', endedAt: action.at || 0 };
      const harvest = Math.max(0, Math.round(computeStats(base).harvest));
      return advance({ ...base, stars: base.stars + harvest, lastHarvest: harvest });
    }
    case 'PICK_LEVEL': {
      const choice = run.phase === 'levelup' && run.levelOffer?.[action.index];
      if (!choice) return run;
      return advance({
        ...run,
        bonus: { ...run.bonus, [choice.stat]: (run.bonus[choice.stat] || 0) + choice.value },
        pendingLevels: run.pendingLevels - 1, levelOffer: null, levelRerolls: 0,
      });
    }
    case 'REROLL_LEVEL': {
      const cost = rerollCost(run.wave, run.levelRerolls);
      if (run.phase !== 'levelup' || run.stars < cost) return run;
      const next = { ...run, stars: run.stars - cost, levelRerolls: run.levelRerolls + 1 };
      next.levelOffer = rollLevelOffer(next);
      return next;
    }
    case 'OPEN_CRATE': {
      if (run.phase !== 'crate' || run.crate) return run;
      const next = { ...run };
      const luck = computeStats(run).luck;
      let tier = rollTier(next, run.wave + 1, luck);
      if (action.ok === true) tier = Math.min(3, Math.max(1, tier + 1));
      let pool = [];
      for (let t = tier; !pool.length && t >= 0; t--) pool = itemsOfTier(t);
      next.crate = { item: pick(next, pool), ok: action.ok ?? null };
      if (action.word) next.words = [...run.words, { w: action.word.w, m: action.word.m, ok: action.ok === true, wave: run.wave }];
      return next;
    }
    case 'TAKE_CRATE':
    case 'RECYCLE_CRATE': {
      if (run.phase !== 'crate' || !run.crate) return run;
      const id = run.crate.item;
      const next = { ...run, crate: null, crates: run.crates - 1 };
      if (action.type === 'TAKE_CRATE') next.items = { ...run.items, [id]: (run.items[id] || 0) + 1 };
      else next.stars = run.stars + recycleValue(id, run.wave);
      return advance(next);
    }
    case 'BUY': {
      const offer = run.phase === 'shop' && run.shop?.slots[action.slot];
      if (!offer || offer.sold || run.stars < offer.price) return run;
      const next = { ...run, stars: run.stars - offer.price };
      if (offer.kind === 'weapon') {
        const weapons = addWeapon(run.weapons, offer);
        if (!weapons) return run;
        next.weapons = weapons;
      } else {
        next.items = { ...run.items, [offer.id]: (run.items[offer.id] || 0) + 1 };
      }
      next.shop = { ...run.shop, slots: run.shop.slots.map((slot, i) => (i === action.slot ? { ...slot, sold: true, locked: false } : slot)) };
      return next;
    }
    case 'LOCK': {
      const offer = run.phase === 'shop' && run.shop?.slots[action.slot];
      if (!offer || offer.sold) return run;
      return { ...run, shop: { ...run.shop, slots: run.shop.slots.map((slot, i) => (i === action.slot ? { ...slot, locked: !slot.locked } : slot)) } };
    }
    case 'REROLL_SHOP': {
      const cost = rerollCost(run.wave, run.shop?.rerolls || 0);
      if (run.phase !== 'shop' || run.stars < cost) return run;
      const next = { ...run, stars: run.stars - cost };
      next.shop = { ...run.shop, rerolls: (run.shop.rerolls || 0) + 1, slots: rollShopSlots(next, run.shop.slots) };
      return next;
    }
    case 'SELL': {
      const weapon = run.phase === 'shop' && run.weapons[action.index];
      if (!weapon || run.weapons.length <= 1) return run;
      return { ...run, stars: run.stars + weaponSellValue(weapon, run.wave), weapons: run.weapons.filter((_, i) => i !== action.index) };
    }
    case 'COMBINE': {
      if (run.phase !== 'shop') return run;
      const partner = combinePartner(run.weapons, action.index);
      if (partner < 0) return run;
      const weapons = run.weapons.map((weapon, i) => (i === action.index ? { ...weapon, tier: weapon.tier + 1 } : weapon)).filter((_, i) => i !== partner);
      return { ...run, weapons };
    }
    case 'NEXT_WAVE': {
      if (run.phase !== 'shop') return run;
      return { ...run, wave: run.wave + 1, phase: 'wave', shop: { ...run.shop, forWave: null, rerolls: 0 } };
    }
    default:
      return run;
  }
}
