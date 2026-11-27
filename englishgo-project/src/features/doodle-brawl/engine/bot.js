// A simple autopilot used by the tests (and handy for balancing): it kites
// away from monsters and bullets, drifts toward stars, and shops sensibly.
import { ITEMS } from '../data/items.js';
import { WAVE_COUNT } from '../data/enemies.js';
import { MAX_WEAPONS } from '../data/weapons.js';
import { rerollCost } from './build.js';
import { combinePartner, runReducer } from './run.js';
import { ARENA, STEP, createWorld, stepWorld } from './sim.js';

export function botInput(world) {
  const p = world.player;
  let fx = 0, fy = 0;
  for (const e of world.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const reach = 150 + e.r * 2 + (e.state === 'windup' || e.state === 'dash' ? 120 : 0);
    if (d < reach) { const w = (reach - d) / reach; fx += (dx / d) * w * w * 3; fy += (dy / d) * w * w * 3; }
  }
  for (const s of world.foeShots) {
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
    if (d < 110) { const w = (110 - d) / 110; fx += (dx / d) * w * 2.2; fy += (dy / d) * w * 2.2; }
  }
  let star = null, best = Infinity;
  for (const pk of world.pickups) {
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < best) { best = d; star = pk; }
  }
  if (star && best < 320) { fx += ((star.x - p.x) / best) * 0.35; fy += ((star.y - p.y) / best) * 0.35; }
  const wall = 140;
  if (p.x < wall) fx += ((wall - p.x) / wall) * 2.5;
  if (p.x > ARENA.w - wall) fx -= ((p.x - ARENA.w + wall) / wall) * 2.5;
  if (p.y < wall) fy += ((wall - p.y) / wall) * 2.5;
  if (p.y > ARENA.h - wall) fy -= ((p.y - ARENA.h + wall) / wall) * 2.5;
  fx += ((ARENA.w / 2 - p.x) / ARENA.w) * 0.25;
  fy += ((ARENA.h / 2 - p.y) / ARENA.h) * 0.25;
  const length = Math.hypot(fx, fy);
  return length > 0.05 ? { x: fx / length, y: fy / length } : { x: 0, y: 0 };
}

export function playWave(run, options = {}) {
  const world = createWorld(run);
  const limit = options.maxSeconds || 400;
  let steps = 0;
  while (!world.done && steps < limit / STEP) {
    stepWorld(world, options.idle ? {} : botInput(world), STEP);
    world.events.length = 0;
    steps += 1;
  }
  return world;
}

const LEVEL_PRIORITY = ['maxHp', 'damage', 'atkSpeed', 'armor', 'regen', 'ranged', 'melee', 'crit', 'dodge', 'lifesteal', 'speed', 'range', 'harvest', 'luck'];
const ITEM_SCORE = item => {
  const s = item.stats || {};
  return (s.maxHp || 0) * 1.2 + (s.damage || 0) * 0.9 + (s.atkSpeed || 0) * 0.8 + (s.armor || 0) * 3 + (s.regen || 0) * 2.5 + (s.lifesteal || 0) * 1.5
    + (s.dodge || 0) * 0.6 + (s.crit || 0) * 0.5 + (s.speed || 0) * 0.2 + (s.range || 0) * 0.02 + (item.effect ? 12 : 0);
};

// Spends the run's choices between waves until it is back in a wave.
export function botBetweenWaves(run) {
  let next = run;
  for (let guard = 0; guard < 200 && next && !['wave', 'victory', 'defeat'].includes(next.phase); guard++) {
    if (next.phase === 'levelup') {
      const offer = next.levelOffer;
      const index = offer.map((choice, i) => [LEVEL_PRIORITY.indexOf(choice.stat) - choice.tier * 2, i]).sort((a, b) => a[0] - b[0])[0][1];
      next = runReducer(next, { type: 'PICK_LEVEL', index });
    } else if (next.phase === 'crate') {
      next = runReducer(next, { type: 'OPEN_CRATE', ok: true });
      next = runReducer(next, { type: 'TAKE_CRATE' });
    } else if (next.phase === 'shop') {
      next.weapons.forEach((_, i) => { if (combinePartner(next.weapons, i) >= 0) next = runReducer(next, { type: 'COMBINE', index: i }); });
      let bought = true;
      while (bought) {
        bought = false;
        const choices = next.shop.slots.map((slot, i) => ({ slot, i })).filter(({ slot }) => !slot.sold && slot.price <= next.stars)
          .map(({ slot, i }) => {
            let score = 0;
            if (slot.kind === 'weapon') {
              const same = next.weapons.some(w => w.id === slot.id && w.tier === slot.tier);
              score = next.weapons.length < MAX_WEAPONS ? 40 + slot.tier * 15 : same ? 30 : -1;
            } else score = ITEM_SCORE(ITEMS[slot.id]) + slot.tier * 4;
            return { i, score: score / Math.max(8, slot.price) };
          }).filter(choice => choice.score > 0).sort((a, b) => b.score - a.score);
        if (choices.length) {
          const before = next;
          next = runReducer(next, { type: 'BUY', slot: choices[0].i });
          bought = next !== before;
        }
        if (!bought && next.stars >= rerollCost(next.wave, next.shop.rerolls) + 25 && next.shop.rerolls < 2) {
          next = runReducer(next, { type: 'REROLL_SHOP' });
          bought = true;
        }
      }
      next = runReducer(next, { type: 'NEXT_WAVE' });
    } else break;
  }
  return next;
}

export function playRun(run, options = {}) {
  let current = run;
  const waves = [];
  while (current && current.phase === 'wave' && current.wave <= WAVE_COUNT) {
    const world = playWave(current, options);
    waves.push({ wave: current.wave, dps: Math.round(world.damage / Math.max(1, world.time)), hp: world.player.hp, maxHp: world.player.maxHp, kills: world.kills, stars: world.stars, time: Math.round(world.time), outcome: world.result?.outcome || 'timeout' });
    if (!world.done) break;
    current = runReducer(current, { type: 'WAVE_DONE', result: world.result });
    current = botBetweenWaves(current);
  }
  return { run: current, waves };
}
