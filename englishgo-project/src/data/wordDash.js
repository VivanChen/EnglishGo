import { arcadeWords, shortMeaning, shuffleArcade } from './arcade.js';

export function dashObstacleHit(obstacle, x, z, jumpHeight) {
  const dx = x - obstacle.x, dz = z - obstacle.z;
  if (obstacle.type === 'ball') return dx * dx + dz * dz < (obstacle.radius + .45) ** 2 && jumpHeight < obstacle.y + obstacle.radius && jumpHeight + 1.7 > obstacle.y - obstacle.radius;
  const perpendicular = Math.sin(obstacle.angle) * dx + Math.cos(obstacle.angle) * dz;
  const along = Math.cos(obstacle.angle) * dx - Math.sin(obstacle.angle) * dz;
  return Math.abs(perpendicular) < .75 && Math.abs(along) < 6.8 && jumpHeight < 1.1;
}

export function makeDashRounds(words, random = Math.random) {
  const meanings = new Set();
  const pool = arcadeWords(words).filter(word => {
    const meaning = shortMeaning(word.m);
    if (meanings.has(meaning)) return false;
    meanings.add(meaning); return true;
  });
  if (pool.length < 3) return [];
  return shuffleArcade(pool, random).slice(0, 5).map(word => ({
    ...word, choices: shuffleArcade([word, ...shuffleArcade(pool.filter(item => item.w !== word.w), random).slice(0, 2)], random).map(item => ({ w: item.w, m: shortMeaning(item.m) })),
  }));
}
