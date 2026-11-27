// Ink monsters and the wave plan. hp and dmg are [base, growth per wave].
export const ENEMIES = {
  scribble: { en: 'Scribble', zh: '亂線怪', r: 17, size: 46, hp: [3, 1.7], dmg: [1, 0.5], speed: 92, stars: 1, ai: 'chase', ink: '#2b2d42' },
  mini: { en: 'Scribble', zh: '小亂線', r: 12, size: 32, sprite: 'scribble', hp: [2, 0.9], dmg: [1, 0.35], speed: 118, stars: 0.5, ai: 'chase', ink: '#2b2d42' },
  blot: { en: 'Blot', zh: '墨漬怪', r: 25, size: 66, hp: [10, 4.2], dmg: [2, 0.7], speed: 56, stars: 2, ai: 'chase', ink: '#26407a' },
  dash: {
    en: 'Dash', zh: '衝衝線', r: 17, size: 48, hp: [5, 2.2], dmg: [2, 0.7], speed: 66, stars: 1, ai: 'charge', ink: '#d9343f',
    charge: { range: 280, windup: 0.65, speed: 440, time: 0.55, rest: 1.6 },
  },
  nib: {
    en: 'Nib', zh: '筆尖砲', r: 16, size: 46, hp: [6, 2.2], dmg: [1, 0.45], speed: 78, stars: 1, ai: 'shoot', ink: '#6c3fc4',
    shoot: { keep: [220, 320], every: 2.3, speed: 230, dmg: [2, 0.55] },
  },
  twinblot: { en: 'Twinblot', zh: '分裂墨', r: 22, size: 58, hp: [8, 3.2], dmg: [2, 0.6], speed: 64, stars: 2, ai: 'chase', ink: '#2f9e57', split: 'mini' },
  grumble: {
    en: 'Grumble Cloud', zh: '墨雲怪', r: 46, size: 118, hp: [400, 160], dmg: [3, 0.9], speed: 46, stars: 24, ai: 'ring', elite: true, ink: '#4a4e69',
    ring: { every: 2.8, windup: 0.6, count: 12, speed: 190, dmg: [2, 0.6] },
  },
  quill: {
    en: 'Quill Knight', zh: '羽毛筆騎士', r: 34, size: 104, hp: [400, 180], dmg: [3, 0.9], speed: 72, stars: 24, ai: 'chain', elite: true, ink: '#178a8a',
    charge: { range: 560, windup: 0.55, speed: 560, time: 0.5, rest: 0.35, chain: 3, longRest: 2.2 },
  },
  king: {
    en: 'The Ink King', zh: '墨水大王', r: 62, size: 156, hp: [20000, 0], dmg: [6, 0], speed: 52, stars: 0, ai: 'boss', boss: true, ink: '#1d2f6f',
    shot: { speed: 210, dmg: [4, 0] },
  },
};

export const WAVE_COUNT = 12;
export const ELITE_WAVES = { 6: 'grumble', 9: 'quill' };

export function waveDuration(wave) {
  return wave >= WAVE_COUNT ? Infinity : Math.min(20 + (wave - 1) * 4, 50);
}

// Which monsters show up in a wave, by weight.
export function wavePool(wave) {
  const pool = [['scribble', 10]];
  if (wave >= 2) pool.push(['blot', 2 + Math.min(wave, 8) * 0.4]);
  if (wave >= 3) pool.push(['dash', 2 + Math.min(wave, 8) * 0.3]);
  if (wave >= 4) pool.push(['nib', 1.6 + Math.min(wave, 9) * 0.25]);
  if (wave >= 5) pool.push(['twinblot', 1.6 + Math.min(wave, 9) * 0.3]);
  return pool;
}

// Monsters per second, ramping up through the wave.
export function spawnRate(wave, progress, difficulty) {
  const base = wave >= WAVE_COUNT ? 1.2 : 1.5 + 0.42 * (wave - 1);
  return base * (0.65 + 0.7 * Math.min(1, progress)) * (difficulty?.rate || 1);
}

export const maxAlive = wave => Math.min(90, 45 + wave * 4);

// Builds grow fast, so later waves get tougher faster than a straight line.
export const hpScale = wave => 1 + 0.015 * (wave - 1) ** 2;

export function enemyHp(type, wave, difficulty) {
  const def = ENEMIES[type];
  const scale = def.boss ? 1 : hpScale(wave);
  return Math.max(1, Math.round((def.hp[0] + def.hp[1] * (wave - 1)) * scale * (difficulty?.hp || 1)));
}

export function enemyDamage(base, wave, difficulty) {
  return Math.max(1, Math.round((base[0] + base[1] * (wave - 1)) * (difficulty?.dmg || 1)));
}
