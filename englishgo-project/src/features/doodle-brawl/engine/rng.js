// Seeded random helpers (mulberry32). The holder object (a run or an arena
// world) owns the generator state in `rng`, so saved runs replay the same rolls.
export function makeSeed() {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

export function rnd(holder) {
  let t = (holder.rng = (holder.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const pick = (holder, list) => list[Math.floor(rnd(holder) * list.length)];

export function shuffle(holder, list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(holder) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function weighted(holder, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rnd(holder) * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1][0];
}
