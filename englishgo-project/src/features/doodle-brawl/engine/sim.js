// The arena: one wave of real-time play. createWorld builds it from the run,
// stepWorld advances it by a fixed step. The world is a plain mutable object
// so a frame stays cheap; it is seeded, so the same inputs replay the same wave.
import { ELITE_WAVES, ENEMIES, WAVE_COUNT, enemyDamage, enemyHp, maxAlive, spawnRate, waveDuration, wavePool } from '../data/enemies.js';
import { DIFFICULTIES } from '../data/heroes.js';
import { WEAPONS } from '../data/weapons.js';
import { armorFactor, computeStats, effectiveDodge, xpForLevel } from './build.js';
import { rnd, weighted } from './rng.js';

export const STEP = 1 / 60;
export const ARENA = { w: 1400, h: 1000 };
const PLAYER_R = 18;
const BASE_SPEED = 215;
const BASE_PICKUP = 72;
const MAX_STAR_DROPS = 150;
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleTo = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
function turnToward(angle, target, amount) {
  let diff = ((target - angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (Math.abs(diff) <= amount) return target;
  return angle + Math.sign(diff) * amount;
}

export function createWorld(run, options = {}) {
  const stats = computeStats(run);
  const difficulty = DIFFICULTIES[run.difficulty] || DIFFICULTIES.normal;
  const final = run.wave >= WAVE_COUNT;
  const world = {
    wave: run.wave, final, difficulty, stats, heroId: run.hero,
    rng: ((options.seed ?? run.seed) ^ Math.imul(run.wave + 1, 0x9e3779b1)) >>> 0,
    time: 0, duration: waveDuration(run.wave), phase: 'fight', outro: 0, done: false, result: null,
    player: { x: ARENA.w / 2, y: ARENA.h / 2, r: PLAYER_R, vx: 0, vy: 0, hp: stats.maxHp, maxHp: stats.maxHp, inv: 0, regen: 0, steal: 0, face: 1, moving: false, walk: 0 },
    weapons: run.weapons.map((weapon, index) => ({ id: weapon.id, tier: weapon.tier, cd: 0.25 + index * 0.08, angle: 0, x: 0, y: 0, lunge: 0, reach: 0 })),
    enemies: [], shots: [], foeShots: [], pickups: [], telegraphs: [], puddles: [], turrets: [], kites: [],
    fx: { particles: [], texts: [], splats: [], strokes: [] },
    shake: 0, events: [], nextId: 1, spawnAcc: 0, eliteSpawned: false, bossSpawned: false, boss: null,
    stars: 0, xp: run.xp || 0, level: run.level || 0, levelsGained: 0, kills: 0, crates: 0, cratesDropped: 0, damage: 0,
  };
  for (let i = 0; i < stats.effects.turret; i++) {
    const angle = (i / Math.max(1, stats.effects.turret)) * TAU + 0.6;
    world.turrets.push({ x: ARENA.w / 2 + Math.cos(angle) * 130, y: ARENA.h / 2 + Math.sin(angle) * 100, cd: 0.6 + i * 0.2, angle: 0, recoil: 0 });
  }
  for (let i = 0; i < stats.effects.kite; i++) world.kites.push({ angle: (i / stats.effects.kite) * TAU, x: 0, y: 0 });
  return world;
}

// ── Effects (visual only, but kept in the world so the renderer is stateless) ──
function text(world, x, y, value, color = '#ffffff', big = false) {
  const list = world.fx.texts;
  if (list.length > 70) list.shift();
  list.push({ x: x + (rnd(world) - 0.5) * 14, y, value, color, big, life: big ? 1.1 : 0.7, max: big ? 1.1 : 0.7 });
}
function burst(world, x, y, color, count = 6, speed = 160, size = 4) {
  const list = world.fx.particles;
  for (let i = 0; i < count; i++) {
    if (list.length > 320) list.shift();
    const angle = rnd(world) * TAU, v = speed * (0.4 + rnd(world) * 0.8);
    list.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, color, size: size * (0.6 + rnd(world) * 0.8), life: 0.45 + rnd(world) * 0.3, max: 0.75 });
  }
}
function splat(world, x, y, r, color) {
  const list = world.fx.splats;
  if (list.length > 90) list.shift();
  list.push({ x, y, r, color, rot: rnd(world) * TAU, seed: Math.floor(rnd(world) * 1000), life: 1 });
}
function stroke(world, item) {
  if (world.fx.strokes.length > 60) world.fx.strokes.shift();
  world.fx.strokes.push({ life: item.max || 0.18, max: item.max || 0.18, ...item });
}
function emit(world, name) { if (world.events.length < 40) world.events.push(name); }

function updateFx(world, dt) {
  const { particles, texts, strokes } = world.fx;
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; p.life -= dt; }
  for (const t of texts) { t.y -= (t.big ? 34 : 52) * dt; t.life -= dt; }
  for (const s of strokes) s.life -= dt;
  world.fx.particles = particles.filter(p => p.life > 0);
  world.fx.texts = texts.filter(t => t.life > 0);
  world.fx.strokes = strokes.filter(s => s.life > 0);
  world.shake = Math.max(0, world.shake - dt * 30);
}

// ── Player ──
function movePlayer(world, input, dt) {
  const p = world.player;
  let ix = Number(input?.x) || 0, iy = Number(input?.y) || 0;
  const length = Math.hypot(ix, iy);
  if (length > 1) { ix /= length; iy /= length; }
  const speed = BASE_SPEED * (1 + clamp(world.stats.speed, -50, 150) / 100);
  const blend = 1 - Math.exp(-14 * dt);
  p.vx += (ix * speed - p.vx) * blend;
  p.vy += (iy * speed - p.vy) * blend;
  p.x = clamp(p.x + p.vx * dt, p.r, ARENA.w - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, ARENA.h - p.r);
  p.moving = Math.hypot(p.vx, p.vy) > 30;
  if (p.moving) p.walk += dt * 11;
  if (Math.abs(p.vx) > 12) p.face = p.vx > 0 ? 1 : -1;
  p.inv = Math.max(0, p.inv - dt);
  p.steal = Math.max(0, p.steal - dt);
  if (world.stats.regen > 0 && p.hp < p.maxHp) {
    p.regen += (world.stats.regen / 5) * dt;
    while (p.regen >= 1) { p.regen -= 1; heal(world, 1, false); }
  }
}

function heal(world, amount, show = true) {
  const p = world.player;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  if (show && p.hp > before) text(world, p.x, p.y - 30, `+${p.hp - before}`, '#35c26b');
}

function hurtPlayer(world, raw, x, y) {
  const p = world.player;
  if (p.inv > 0 || world.phase !== 'fight') return false;
  if (rnd(world) * 100 < effectiveDodge(world.stats)) {
    p.inv = 0.3;
    text(world, p.x, p.y - 34, 'Dodge!', '#7fd0ff');
    emit(world, 'dodge');
    return false;
  }
  const amount = Math.max(1, Math.round(raw * armorFactor(world.stats.armor)));
  p.hp -= amount;
  p.inv = 0.55;
  world.shake = Math.min(14, world.shake + 8);
  text(world, p.x, p.y - 34, `-${amount}`, '#ff5a5f', true);
  burst(world, p.x, p.y, '#ff6b6b', 7, 170, 4);
  if (x !== undefined) { const a = Math.atan2(p.y - y, p.x - x); p.vx += Math.cos(a) * 260; p.vy += Math.sin(a) * 260; }
  emit(world, 'hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    world.phase = 'dead';
    world.outro = 0;
    emit(world, 'dead');
  }
  return true;
}

function gainXp(world, amount) {
  world.xp += amount;
  while (world.xp >= xpForLevel(world.level)) {
    world.xp -= xpForLevel(world.level);
    world.level += 1;
    world.levelsGained += 1;
    text(world, world.player.x, world.player.y - 52, 'LEVEL UP!', '#ffd23f', true);
    burst(world, world.player.x, world.player.y, '#ffd23f', 14, 220, 5);
    emit(world, 'levelup');
  }
}

// ── Enemies ──
function farPoint(world, minDistance) {
  const p = world.player;
  for (let tries = 0; tries < 20; tries++) {
    const x = 60 + rnd(world) * (ARENA.w - 120), y = 60 + rnd(world) * (ARENA.h - 120);
    if (Math.hypot(x - p.x, y - p.y) >= minDistance) return { x, y };
  }
  return { x: p.x < ARENA.w / 2 ? ARENA.w - 80 : 80, y: p.y < ARENA.h / 2 ? ARENA.h - 80 : 80 };
}

function makeEnemy(world, type, x, y) {
  const def = ENEMIES[type];
  const wave = world.wave, difficulty = world.difficulty;
  const hp = enemyHp(type, wave, difficulty);
  const jitter = def.boss || def.elite ? 1 : 0.92 + rnd(world) * 0.16;
  return {
    id: world.nextId++, type, x, y, r: def.r, hp, maxHp: hp,
    speed: def.speed * jitter * (def.boss ? 1 : 1 + Math.min(0.22, (wave - 1) * 0.02)),
    dmg: enemyDamage(def.dmg, wave, difficulty),
    state: 'walk', t: 0, cd: 0.6 + rnd(world) * (def.shoot?.every || def.ring?.every || 1.2), dirX: 0, dirY: 0, chain: 0,
    kx: 0, ky: 0, flash: 0, slowT: 0, slowK: 0, face: -1, wob: rnd(world) * TAU, born: 0, kiteCd: 0, phase: 1, spin: 0, volley: 0,
  };
}

function queueSpawn(world, type, x, y, delay = 0.9) {
  world.telegraphs.push({ type, x: clamp(x, 40, ARENA.w - 40), y: clamp(y, 40, ARENA.h - 40), t: 0, dur: delay });
}

function spawnStep(world, dt) {
  const { wave } = world;
  if (world.final) {
    if (!world.bossSpawned && world.time >= 0.8) {
      world.bossSpawned = true;
      queueSpawn(world, 'king', ARENA.w / 2, world.player.y > ARENA.h / 2 ? 170 : ARENA.h - 170, 1.6);
      emit(world, 'boss');
    }
    if (world.boss && !world.boss.dead) {
      world.spawnAcc += spawnRate(wave, 0.4, world.difficulty) * 0.55 * dt;
    }
  } else {
    world.spawnAcc += spawnRate(wave, world.time / world.duration, world.difficulty) * dt;
    const elite = ELITE_WAVES[wave];
    if (elite && !world.eliteSpawned && world.time >= 6) {
      world.eliteSpawned = true;
      const at = farPoint(world, 320);
      queueSpawn(world, elite, at.x, at.y, 1.5);
      emit(world, 'elite');
    }
    if (world.difficulty.rate > 1.1 && wave >= 10 && !world.extraElite && world.time >= 18) {
      world.extraElite = true;
      const at = farPoint(world, 320);
      queueSpawn(world, wave === 10 ? 'grumble' : 'quill', at.x, at.y, 1.5);
      emit(world, 'elite');
    }
  }
  const cap = maxAlive(wave);
  const pool = world.final ? [['scribble', 6], ['dash', 3], ['nib', 2], ['blot', 2]] : wavePool(wave);
  while (world.spawnAcc >= 1) {
    if (world.enemies.length + world.telegraphs.length >= cap) { world.spawnAcc = 0; break; }
    const size = Math.min(5, 1 + Math.floor(rnd(world) * (1 + wave / 4)));
    world.spawnAcc -= size;
    const type = weighted(world, pool);
    const at = farPoint(world, 230);
    for (let i = 0; i < size; i++) queueSpawn(world, type, at.x + (rnd(world) - 0.5) * 70, at.y + (rnd(world) - 0.5) * 70);
  }
}

function telegraphStep(world, dt) {
  const ready = [];
  for (const mark of world.telegraphs) { mark.t += dt; if (mark.t >= mark.dur) ready.push(mark); }
  if (!ready.length) return;
  world.telegraphs = world.telegraphs.filter(mark => mark.t < mark.dur);
  for (const mark of ready) {
    const enemy = makeEnemy(world, mark.type, mark.x, mark.y);
    world.enemies.push(enemy);
    if (ENEMIES[mark.type].boss) { world.boss = enemy; world.shake = 16; emit(world, 'phase'); }
    burst(world, mark.x, mark.y, '#2b2d42', ENEMIES[mark.type].boss ? 24 : 5, 120, 3);
  }
}

function fireFoeShot(world, enemy, angle, speed, damage, radius = 7) {
  if (world.foeShots.length > 220) return;
  world.foeShots.push({ x: enemy.x + Math.cos(angle) * enemy.r * 0.8, y: enemy.y + Math.sin(angle) * enemy.r * 0.8, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radius, dmg: damage, life: 6 });
}

function ring(world, enemy, count, speed, damage, offset = 0) {
  for (let i = 0; i < count; i++) fireFoeShot(world, enemy, offset + (i / count) * TAU, speed, damage, 8);
  emit(world, 'spit');
}

function chargeAi(world, e, def, d, ux, uy, dt, chainMode) {
  const charge = def.charge;
  if (e.state === 'walk') {
    e.cd -= dt;
    if (d < charge.range && e.cd <= 0) { e.state = 'windup'; e.t = 0; e.dirX = ux; e.dirY = uy; }
    return 1;
  }
  if (e.state === 'windup') {
    e.dirX = ux; e.dirY = uy;
    if (e.t >= charge.windup) { e.state = 'dash'; e.t = 0; emit(world, 'whoosh'); }
    return 0;
  }
  if (e.state === 'dash') {
    e.x += e.dirX * charge.speed * dt;
    e.y += e.dirY * charge.speed * dt;
    if (rnd(world) < 0.5) world.fx.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, color: def.ink, size: 3, life: 0.3, max: 0.3 });
    if (e.t >= charge.time) {
      e.t = 0;
      if (chainMode && ++e.chain < charge.chain) { e.state = 'windup'; e.t = charge.windup * 0.4; }
      else { e.state = 'rest'; e.chain = 0; e.cd = chainMode ? charge.longRest : charge.rest; }
    }
    return 0;
  }
  // rest
  e.cd -= dt;
  if (e.cd <= 0) { e.state = 'walk'; e.cd = 0.4 + rnd(world) * 0.6; }
  return 0.45;
}

function bossAi(world, e, def, d, ux, uy, dt) {
  const ratio = e.hp / e.maxHp;
  const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  if (phase !== e.phase) {
    e.phase = phase;
    world.shake = 14;
    text(world, e.x, e.y - e.r - 20, phase === 2 ? 'Angry!' : 'FURIOUS!', '#ff5a5f', true);
    emit(world, 'phase');
  }
  const enraged = world.time > 120;
  const tempo = (phase === 3 ? 1.3 : 1) * (enraged ? 1.5 : 1);
  const shotDamage = enemyDamage(def.shot.dmg, world.wave, world.difficulty);
  const angle = Math.atan2(uy, ux);
  if (e.state === 'windup') {
    if (e.t >= 0.7 / tempo) {
      e.t = 0;
      if (e.next === 'charge') { e.state = 'dash'; e.dirX = ux; e.dirY = uy; emit(world, 'whoosh'); }
      else {
        if (e.next === 'ring') ring(world, e, phase === 3 ? 22 : 16, def.shot.speed, shotDamage, rnd(world) * TAU);
        if (e.next === 'double') { ring(world, e, 14, def.shot.speed, shotDamage, 0); ring(world, e, 14, def.shot.speed * 0.7, shotDamage, Math.PI / 14); }
        e.state = 'walk';
      }
    }
    return 0;
  }
  if (e.state === 'dash') {
    e.x += e.dirX * 600 * dt; e.y += e.dirY * 600 * dt;
    if (e.t >= 0.6) { e.state = 'walk'; e.t = 0; }
    return 0;
  }
  if (e.state === 'spiral') {
    e.volley -= dt;
    if (e.volley <= 0) {
      e.volley = 0.11 / tempo;
      e.spin += 0.37;
      fireFoeShot(world, e, e.spin, def.shot.speed * 0.9, shotDamage, 7);
      fireFoeShot(world, e, e.spin + Math.PI, def.shot.speed * 0.9, shotDamage, 7);
      if (phase === 3) fireFoeShot(world, e, e.spin + Math.PI / 2, def.shot.speed * 0.9, shotDamage, 7);
    }
    if (e.t >= 2.2) { e.state = 'walk'; e.t = 0; }
    return 0.3;
  }
  if (e.state === 'burst') {
    e.volley -= dt;
    if (e.volley <= 0) {
      e.volley = 0.28;
      for (let i = -2; i <= 2; i++) fireFoeShot(world, e, angle + i * 0.2, def.shot.speed * 1.15, shotDamage, 7);
      emit(world, 'spit');
      if (++e.chain >= 3) { e.state = 'walk'; e.chain = 0; }
    }
    return 0.5;
  }
  e.cd -= dt * tempo;
  if (e.cd <= 0) {
    const plans = phase === 1 ? ['ring', 'summon', 'burst', 'ring'] : phase === 2 ? ['spiral', 'charge', 'ring', 'summon', 'burst'] : ['double', 'spiral', 'charge', 'summon', 'burst'];
    const next = plans[(e.plan = ((e.plan ?? -1) + 1) % plans.length)];
    e.t = 0;
    if (next === 'summon') {
      const count = 2 + phase;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        queueSpawn(world, phase === 1 ? 'scribble' : i % 2 ? 'dash' : 'scribble', e.x + Math.cos(a) * 110, e.y + Math.sin(a) * 110, 0.7);
      }
      emit(world, 'summon');
      e.cd = 1.6;
    } else if (next === 'spiral') { e.state = 'spiral'; e.volley = 0; e.cd = 1.4; }
    else if (next === 'burst') { e.state = 'burst'; e.volley = 0; e.chain = 0; e.cd = 1.8; }
    else { e.state = 'windup'; e.next = next; e.cd = 2.1; }
  }
  return phase === 3 ? 1.25 : 1;
}

function enemyStep(world, dt) {
  const p = world.player;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const def = ENEMIES[e.type];
    e.t += dt; e.born += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.kiteCd = Math.max(0, e.kiteCd - dt);
    e.slowT = Math.max(0, e.slowT - dt);
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    let move = 1, mx = ux, my = uy;
    switch (def.ai) {
      case 'charge': move = chargeAi(world, e, def, d, ux, uy, dt, false); break;
      case 'chain': move = chargeAi(world, e, def, d, ux, uy, dt, true); break;
      case 'shoot': {
        const [near, far] = def.shoot.keep;
        if (d > far) move = 1;
        else if (d < near) { mx = -ux; my = -uy; move = 0.8; }
        else { mx = -uy * (e.id % 2 ? 1 : -1); my = ux * (e.id % 2 ? 1 : -1); move = 0.35; }
        e.cd -= dt;
        if (e.cd <= 0 && d < 470) {
          e.cd = def.shoot.every * (0.85 + rnd(world) * 0.3);
          fireFoeShot(world, e, Math.atan2(dy, dx), def.shoot.speed, enemyDamage(def.shoot.dmg, world.wave, world.difficulty));
          emit(world, 'spit');
        }
        break;
      }
      case 'ring': {
        if (e.state === 'windup') {
          move = 0;
          if (e.t >= def.ring.windup) {
            e.state = 'walk';
            e.spin += 0.4;
            ring(world, e, def.ring.count, def.ring.speed, enemyDamage(def.ring.dmg, world.wave, world.difficulty), e.spin);
          }
        } else {
          e.cd -= dt;
          if (e.cd <= 0) { e.state = 'windup'; e.t = 0; e.cd = def.ring.every; }
        }
        break;
      }
      case 'boss': move = bossAi(world, e, def, d, ux, uy, dt); break;
      default: {
        const wobble = Math.sin(e.t * 3 + e.wob) * 0.35;
        mx = ux - uy * wobble; my = uy + ux * wobble;
        const m = Math.hypot(mx, my) || 1; mx /= m; my /= m;
      }
    }
    const slow = e.slowT > 0 ? 1 - e.slowK : 1;
    const grow = Math.min(1, e.born / 0.35);
    e.x += (mx * e.speed * move * slow * grow + e.kx) * dt;
    e.y += (my * e.speed * move * slow * grow + e.ky) * dt;
    const decay = Math.exp(-9 * dt);
    e.kx *= decay; e.ky *= decay;
    e.x = clamp(e.x, e.r, ARENA.w - e.r);
    e.y = clamp(e.y, e.r, ARENA.h - e.r);
    if (Math.abs(dx) > 4) e.face = dx > 0 ? 1 : -1;
    if (d < e.r + p.r - 4) hurtPlayer(world, e.dmg, e.x, e.y);
  }
}

// Keeps monsters from stacking into one blob.
function separate(world) {
  const list = world.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.85;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= min) continue;
      const push = (min - d) / 2, nx = dx / d, ny = dy / d;
      const wa = ENEMIES[a.type].boss ? 0.1 : 1, wb = ENEMIES[b.type].boss ? 0.1 : 1;
      a.x -= nx * push * wa; a.y -= ny * push * wa;
      b.x += nx * push * wb; b.y += ny * push * wb;
    }
  }
}

// ── Damage ──
function rollDamage(world, def, tier, base) {
  const s = world.stats;
  const bonus = 1 + (s.damage + (s[def.kind] || 0)) / 100;
  let amount = Math.max(1, (base ?? def.dmg[tier]) * bonus);
  const crit = rnd(world) < (def.crit || 0) + s.crit / 100;
  if (crit) amount *= (def.critMult || 1.5) + s.critDmg / 100;
  return { amount: Math.max(1, Math.round(amount)), crit };
}

function hitEnemy(world, e, hit, dirX = 0, dirY = 0, knock = 0) {
  if (e.dead || world.phase !== 'fight') return;
  const def = ENEMIES[e.type];
  e.hp -= hit.amount;
  e.flash = 0.09;
  world.damage += hit.amount;
  const weight = def.boss ? 0.04 : def.elite ? 0.25 : 1;
  e.kx += dirX * knock * 7 * weight;
  e.ky += dirY * knock * 7 * weight;
  if (!hit.quiet || hit.crit) text(world, e.x, e.y - e.r - 6, hit.crit ? `${hit.amount}!` : `${hit.amount}`, hit.crit ? '#ffd23f' : '#ffffff', hit.crit);
  const s = world.stats, p = world.player;
  if (s.lifesteal > 0 && p.steal <= 0 && p.hp < p.maxHp && rnd(world) * 100 < s.lifesteal) { p.steal = 0.15; heal(world, 1); }
  if (e.hp <= 0) killEnemy(world, e);
  else emit(world, 'hit');
}

function dropPickup(world, kind, x, y, value = 1) {
  const angle = rnd(world) * TAU, v = 60 + rnd(world) * 90;
  world.pickups.push({ kind, x, y, value, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, t: rnd(world) * 3, magnet: false, speed: 0 });
}

function killEnemy(world, e) {
  const def = ENEMIES[e.type];
  e.dead = true;
  e.hp = 0;
  world.kills += 1;
  splat(world, e.x, e.y, e.r * (def.boss ? 1.6 : 1.15), def.ink);
  burst(world, e.x, e.y, def.ink, def.boss ? 40 : def.elite ? 22 : 8, def.boss ? 340 : 190, def.boss ? 7 : 4);
  emit(world, def.boss ? 'bossdown' : def.elite ? 'elitedown' : 'pop');
  const luck = 1 + world.stats.luck / 100;
  // Stars
  let count = def.stars >= 1 ? def.stars : rnd(world) < def.stars ? 1 : 0;
  const starCount = world.pickups.filter(pk => pk.kind === 'star').length;
  if (count > 0) {
    if (starCount > MAX_STAR_DROPS) {
      const target = world.pickups.find(pk => pk.kind === 'star');
      if (target) target.value += count;
    } else {
      const pieces = Math.min(count, 8);
      for (let i = 0; i < pieces; i++) dropPickup(world, 'star', e.x, e.y, Math.floor(count / pieces) + (i < count % pieces ? 1 : 0));
    }
  }
  if (!def.boss && rnd(world) < (0.022 + 0.015 * world.stats.effects.lunch) * Math.max(0.3, luck)) dropPickup(world, 'cookie', e.x, e.y);
  if (def.elite || (world.cratesDropped < 3 && rnd(world) < 0.011 * Math.max(0.3, luck))) {
    world.cratesDropped += 1;
    dropPickup(world, 'crate', e.x, e.y);
  }
  if (def.split) {
    for (let i = 0; i < 2; i++) {
      const child = makeEnemy(world, def.split, e.x + (i ? 14 : -14), e.y);
      child.kx = (i ? 1 : -1) * 220;
      world.enemies.push(child);
    }
  }
  if (def.boss) world.bossDead = true;
  const booms = world.stats.effects.boom;
  if (booms > 0 && !def.boss && rnd(world) < Math.min(0.75, 0.25 * booms)) {
    const radius = 62;
    const base = 6 + 2 * world.wave;
    stroke(world, { kind: 'boom', x: e.x, y: e.y, r: radius, max: 0.3 });
    emit(world, 'boom');
    for (const other of world.enemies) {
      if (other.dead || other === e) continue;
      if (Math.hypot(other.x - e.x, other.y - e.y) < radius + other.r) {
        const hit = rollDamage(world, { crit: 0, kind: 'magic' }, 0, base);
        hitEnemy(world, other, { ...hit, quiet: true }, 0, 0, 0);
      }
    }
  }
}

// ── Weapons ──
function nearestEnemy(world, x, y, range, skip) {
  let best = null, bestD = Infinity;
  for (const e of world.enemies) {
    if (e.dead || (skip && skip.includes(e.id))) continue;
    const d = Math.hypot(e.x - x, e.y - y) - e.r;
    if (d < range && d < bestD) { best = e; bestD = d; }
  }
  return best;
}

function weaponRange(world, def, tier) {
  return Math.max(40, def.range[tier] + world.stats.range * (def.kind === 'melee' ? 0.5 : 1));
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

function fireWeapon(world, w, def, target, range) {
  const angle = Math.atan2(target.y - w.y, target.x - w.x);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const tier = w.tier;
  const shot = extra => {
    world.shots.push({ x: w.x + cos * 10, y: w.y + sin * 10, r: 6, weapon: w.id, tier, hits: [], pierce: def.pierce?.[tier] || 0, life: range / (extra.speed || def.speed) + 0.08, ...extra });
  };
  switch (def.style) {
    case 'shot': {
      const a = angle + (def.inaccuracy ? (rnd(world) - 0.5) * 2 * def.inaccuracy : 0);
      shot({ vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, speed: def.speed });
      emit(world, w.id === 'stapler' ? 'staple' : 'shoot');
      break;
    }
    case 'spread': {
      const count = def.pellets[tier];
      for (let i = 0; i < count; i++) {
        const a = angle + (count === 1 ? 0 : (i / (count - 1) - 0.5) * def.spread) + (rnd(world) - 0.5) * 0.08;
        shot({ vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, speed: def.speed, r: 5, hue: Math.floor(rnd(world) * 4) });
      }
      emit(world, 'shoot');
      break;
    }
    case 'homing':
      shot({ vx: cos * def.speed, vy: sin * def.speed, speed: def.speed, target: target.id, homing: true, r: 8, life: (range / def.speed) * 1.6 });
      emit(world, 'whoosh');
      break;
    case 'bounce':
      shot({ vx: cos * def.speed, vy: sin * def.speed, speed: def.speed, bounces: def.bounces[tier], r: 6 });
      emit(world, 'shoot');
      break;
    case 'glob': {
      const d = Math.min(range, Math.hypot(target.x - w.x, target.y - w.y));
      shot({ vx: cos * def.speed, vy: sin * def.speed, speed: def.speed, glob: true, r: 8, life: d / def.speed + 0.02 });
      emit(world, 'glob');
      break;
    }
    case 'beam': {
      const ex = w.x + cos * range, ey = w.y + sin * range;
      stroke(world, { kind: 'beam', x: w.x, y: w.y, x2: ex, y2: ey, width: def.width, max: 0.22 });
      for (const e of world.enemies) {
        if (!e.dead && distToSegment(e.x, e.y, w.x, w.y, ex, ey) < def.width / 2 + e.r) hitEnemy(world, e, rollDamage(world, def, tier), cos, sin, def.knock);
      }
      emit(world, 'beam');
      break;
    }
    default: {
      // Melee: the weapon lunges at the target and hits everything in its path.
      const reach = Math.min(range, Math.hypot(target.x - w.x, target.y - w.y));
      w.lunge = 0.16; w.reach = reach;
      if (def.style === 'thrust') {
        const ex = w.x + cos * (reach + 16), ey = w.y + sin * (reach + 16);
        stroke(world, { kind: 'thrust', x: w.x, y: w.y, x2: ex, y2: ey, width: def.width, max: 0.16 });
        for (const e of world.enemies) {
          if (!e.dead && distToSegment(e.x, e.y, w.x, w.y, ex, ey) < def.width / 2 + e.r) hitEnemy(world, e, rollDamage(world, def, tier), cos, sin, def.knock);
        }
      } else if (def.style === 'snip') {
        stroke(world, { kind: 'snip', x: w.x, y: w.y, angle, r: reach + 12, arc: def.arc, max: 0.16 });
        for (const e of world.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - w.x, e.y - w.y);
          const diff = Math.abs(((Math.atan2(e.y - w.y, e.x - w.x) - angle + Math.PI) % TAU + TAU) % TAU - Math.PI);
          if (d < reach + 14 + e.r && (diff < def.arc / 2 || d < e.r + 10)) hitEnemy(world, e, rollDamage(world, def, tier), cos, sin, def.knock);
        }
      } else {
        const cx = w.x + cos * reach, cy = w.y + sin * reach;
        stroke(world, { kind: 'smash', x: cx, y: cy, r: def.radius, max: 0.24 });
        world.shake = Math.min(10, world.shake + 2.5);
        for (const e of world.enemies) {
          if (!e.dead && Math.hypot(e.x - cx, e.y - cy) < def.radius + e.r) {
            const a = Math.atan2(e.y - cy, e.x - cx);
            hitEnemy(world, e, rollDamage(world, def, tier), Math.cos(a), Math.sin(a), def.knock);
          }
        }
      }
      emit(world, 'swing');
    }
  }
}

function weaponStep(world, dt) {
  const p = world.player;
  const speedUp = 1 + clamp(world.stats.atkSpeed, -60, 300) / 100;
  const count = world.weapons.length;
  world.weapons.forEach((w, index) => {
    const def = WEAPONS[w.id];
    const slot = count === 1 ? 0 : (index / count) * TAU - Math.PI / 2;
    const radius = count === 1 ? 26 : count <= 3 ? 34 : 40;
    w.x = p.x + Math.cos(slot) * radius;
    w.y = p.y + Math.sin(slot) * radius * 0.82;
    w.lunge = Math.max(0, w.lunge - dt);
    w.cd -= dt * speedUp;
    const range = weaponRange(world, def, w.tier);
    const target = nearestEnemy(world, w.x, w.y, range);
    const aim = target ? angleTo(w, target) : (p.face > 0 ? 0 : Math.PI) + Math.sin(world.time * 2 + index) * 0.15;
    w.angle = turnToward(w.angle, aim, 14 * dt);
    if (target && w.cd <= 0) {
      w.cd = def.cd[w.tier];
      w.angle = aim;
      fireWeapon(world, w, def, target, range);
    }
  });
}

function turretStep(world, dt) {
  const speedUp = 1 + clamp(world.stats.atkSpeed, -60, 300) / 100 * 0.5;
  const def = { kind: 'ranged', crit: 0.03, critMult: 1.5, knock: 6 };
  for (const turret of world.turrets) {
    turret.cd -= dt * speedUp;
    turret.recoil = Math.max(0, turret.recoil - dt);
    const target = nearestEnemy(world, turret.x, turret.y, 380);
    if (!target) continue;
    turret.angle = angleTo(turret, target);
    if (turret.cd > 0) continue;
    turret.cd = 1.0;
    turret.recoil = 0.12;
    const speed = 600, cos = Math.cos(turret.angle), sin = Math.sin(turret.angle);
    world.shots.push({ x: turret.x + cos * 16, y: turret.y + sin * 16, vx: cos * speed, vy: sin * speed, speed, r: 6, weapon: 'turret', tier: 0, hits: [], pierce: 0, life: 380 / speed + 0.1, base: 5 + 0.9 * world.wave, def });
  }
}

function kiteStep(world, dt) {
  const p = world.player;
  const base = 8 + world.wave;
  for (const kite of world.kites) {
    kite.angle += 2.6 * dt;
    kite.x = p.x + Math.cos(kite.angle) * 92;
    kite.y = p.y + Math.sin(kite.angle) * 80;
    for (const e of world.enemies) {
      if (e.dead || e.kiteCd > 0) continue;
      if (Math.hypot(e.x - kite.x, e.y - kite.y) < 22 + e.r) {
        e.kiteCd = 0.5;
        const a = angleTo(kite, e);
        hitEnemy(world, e, rollDamage(world, { kind: 'magic', crit: 0.05, critMult: 1.5 }, 0, base), Math.cos(a), Math.sin(a), 18);
      }
    }
  }
}

function addPuddle(world, x, y, tier) {
  const def = WEAPONS.glue.puddle;
  if (world.puddles.length > 24) world.puddles.shift();
  world.puddles.push({ x, y, r: def.radius, dps: def.dps[tier], slow: def.slow, life: def.life, max: def.life, tick: 0 });
  emit(world, 'splash');
}

function shotStep(world, dt) {
  for (const s of world.shots) {
    if (s.done) continue;
    if (s.homing) {
      let target = world.enemies.find(e => e.id === s.target && !e.dead);
      if (!target) { target = nearestEnemy(world, s.x, s.y, 320, s.hits); s.target = target?.id; }
      if (target) {
        const current = Math.atan2(s.vy, s.vx);
        const next = turnToward(current, angleTo(s, target), WEAPONS.plane.turn * dt);
        s.vx = Math.cos(next) * s.speed; s.vy = Math.sin(next) * s.speed;
      }
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.life <= 0 || s.x < -20 || s.y < -20 || s.x > ARENA.w + 20 || s.y > ARENA.h + 20) {
      s.done = true;
      if (s.glob) addPuddle(world, clamp(s.x, 0, ARENA.w), clamp(s.y, 0, ARENA.h), s.tier);
      continue;
    }
    for (const e of world.enemies) {
      if (e.dead || s.hits.includes(e.id)) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) > e.r + s.r) continue;
      const def = s.def || WEAPONS[s.weapon];
      const length = Math.hypot(s.vx, s.vy) || 1;
      hitEnemy(world, e, rollDamage(world, def, s.tier, s.base), s.vx / length, s.vy / length, def.knock || 0);
      s.hits.push(e.id);
      if (s.glob) { addPuddle(world, e.x, e.y, s.tier); s.done = true; }
      else if (s.bounces > 0) {
        const next = nearestEnemy(world, s.x, s.y, 280, s.hits);
        if (next) {
          s.bounces -= 1;
          const a = angleTo(s, next);
          s.vx = Math.cos(a) * s.speed; s.vy = Math.sin(a) * s.speed;
          s.life = 280 / s.speed + 0.1;
        } else s.done = true;
      } else if (s.pierce > 0) s.pierce -= 1;
      else s.done = true;
      break;
    }
  }
  world.shots = world.shots.filter(s => !s.done);

  const p = world.player;
  for (const s of world.foeShots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.life <= 0 || s.x < -30 || s.y < -30 || s.x > ARENA.w + 30 || s.y > ARENA.h + 30) { s.done = true; continue; }
    if (Math.hypot(p.x - s.x, p.y - s.y) < p.r + s.r - 3 && p.inv <= 0) {
      hurtPlayer(world, s.dmg, s.x, s.y);
      s.done = true;
      burst(world, s.x, s.y, '#5b3fa8', 5, 120, 3);
    }
  }
  world.foeShots = world.foeShots.filter(s => !s.done);
}

function puddleStep(world, dt) {
  for (const puddle of world.puddles) {
    puddle.life -= dt;
    puddle.tick -= dt;
    const tick = puddle.tick <= 0;
    if (tick) puddle.tick = 0.25;
    for (const e of world.enemies) {
      if (e.dead || Math.hypot(e.x - puddle.x, e.y - puddle.y) > puddle.r + e.r * 0.5) continue;
      e.slowT = 0.3; e.slowK = Math.max(e.slowK, puddle.slow);
      if (tick) hitEnemy(world, e, { ...rollDamage(world, { kind: 'magic', crit: 0, critMult: 1 }, 0, puddle.dps * 0.25), quiet: true }, 0, 0, 0);
    }
  }
  world.puddles = world.puddles.filter(puddle => puddle.life > 0);
}

function pickupStep(world, dt) {
  const p = world.player;
  const radius = BASE_PICKUP * (1 + Math.max(-50, world.stats.pickup) / 100);
  for (const pk of world.pickups) {
    pk.t += dt;
    const dx = p.x - pk.x, dy = p.y - pk.y, d = Math.hypot(dx, dy) || 1;
    if (!pk.magnet && (d < radius || world.phase === 'outro')) pk.magnet = true;
    if (pk.magnet) {
      pk.speed = Math.min(1100, pk.speed + 1700 * dt);
      pk.x += (dx / d) * pk.speed * dt;
      pk.y += (dy / d) * pk.speed * dt;
    } else {
      pk.x = clamp(pk.x + pk.vx * dt, 10, ARENA.w - 10);
      pk.y = clamp(pk.y + pk.vy * dt, 10, ARENA.h - 10);
      pk.vx *= 1 - 5 * dt; pk.vy *= 1 - 5 * dt;
    }
    if (d < p.r + 10) {
      pk.done = true;
      if (pk.kind === 'star') { world.stars += pk.value; gainXp(world, pk.value); emit(world, 'star'); }
      else if (pk.kind === 'cookie') { heal(world, 3 + 2 * world.stats.effects.lunch); emit(world, 'heal'); }
      else { world.crates += 1; text(world, p.x, p.y - 40, 'Mystery Box!', '#ffb02e', true); emit(world, 'crate'); }
    }
  }
  world.pickups = world.pickups.filter(pk => !pk.done);
}

function startOutro(world, outcome) {
  world.phase = 'outro';
  world.outcome = outcome;
  world.outro = 0;
  for (const e of world.enemies) {
    if (e.dead) continue;
    burst(world, e.x, e.y, ENEMIES[e.type].ink, 5, 140, 3);
    e.dead = true;
  }
  world.enemies = [];
  world.telegraphs = [];
  world.foeShots = [];
  emit(world, outcome === 'victory' ? 'victory' : 'clear');
}

function finish(world, outcome) {
  world.done = true;
  world.result = {
    outcome, stars: world.stars, xp: world.xp, level: world.level, levelsGained: world.levelsGained,
    kills: world.kills, crates: world.crates, damage: world.damage,
  };
}

export function stepWorld(world, input = {}, dt = STEP) {
  if (world.done) return world;
  updateFx(world, dt);
  if (world.phase === 'dead') {
    world.outro += dt;
    if (world.outro >= 1.4) finish(world, 'dead');
    return world;
  }
  movePlayer(world, input, dt);
  if (world.phase === 'outro') {
    world.outro += dt;
    pickupStep(world, dt);
    if ((world.outro > 0.9 && !world.pickups.length) || world.outro > 2.5) {
      // Anything still in flight is collected anyway.
      for (const pk of world.pickups) if (pk.kind === 'star') { world.stars += pk.value; gainXp(world, pk.value); } else if (pk.kind === 'crate') world.crates += 1;
      world.pickups = [];
      finish(world, world.outcome);
    }
    return world;
  }
  world.time += dt;
  spawnStep(world, dt);
  telegraphStep(world, dt);
  enemyStep(world, dt);
  separate(world);
  weaponStep(world, dt);
  turretStep(world, dt);
  kiteStep(world, dt);
  shotStep(world, dt);
  puddleStep(world, dt);
  if (world.enemies.some(e => e.dead)) world.enemies = world.enemies.filter(e => !e.dead);
  pickupStep(world, dt);
  if (world.phase === 'dead') return world;
  if (world.final ? world.bossDead : world.time >= world.duration) startOutro(world, world.final ? 'victory' : 'cleared');
  return world;
}

export const timeLeft = world => (world.final ? null : Math.max(0, Math.ceil(world.duration - world.time)));
