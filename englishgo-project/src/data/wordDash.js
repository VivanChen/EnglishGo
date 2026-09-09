import { arcadeWords, shortMeaning, shuffleArcade } from './arcade.js';

export const DASH_COURSES = [
  { id: 'candy', title: '糖果天空賽道', subtitle: '先練習，再衝刺', difficulty: '入門', rounds: 5, speed: 4.4, tempo: 1, sky: '#73d7f4', rail: '#ff70c1', floors: ['#38c8e3', '#a28bea', '#52d5bd', '#fbabcf', '#45cce2'], pattern: ['bar', 'ball', 'bar', 'ball', 'bar'], description: '跳過旋轉棒、閃開彈跳球，熟悉天空賽道。', tip: '空白鍵或「跳躍」跨過旋轉棒，也可以換道閃球。' },
  { id: 'jelly', title: '果凍滾球谷', subtitle: '看準空檔，換道前進', difficulty: '初階', rounds: 6, speed: 4.6, tempo: 1, sky: '#ffceae', rail: '#ff9a71', floors: ['#89ddab', '#ffd082', '#9ce9d0'], pattern: ['roller', 'ball', 'roller', 'ball', 'roller', 'roller'], description: '大果凍球橫越跑道，找空檔換道或跳過它！', tip: '滾球會橫向移動，提早換道；跳起來也能越過它。' },
  { id: 'soda', title: '汽水機關城', subtitle: '抓住升降節奏', difficulty: '進階', rounds: 7, speed: 4.8, tempo: 1.1, sky: '#9cdfee', rail: '#906ce0', floors: ['#91b4f2', '#cca2ef', '#75dcca'], pattern: ['piston', 'bar', 'piston', 'roller', 'piston', 'bar', 'piston'], description: '汽水活塞輪流升起！觀察節奏，跳躍或換道通過。', tip: '圓形底座是升降機關；活塞縮回時通過，升起時跳開。' },
  { id: 'starlight', title: '星光皇冠賽', subtitle: '所有本領，一起上場', difficulty: '挑戰', rounds: 8, speed: 5, tempo: 1.2, sky: '#7780bd', rail: '#cc91f7', floors: ['#9d8bde', '#819ddf', '#c093d8', '#7ebdd9'], pattern: ['roller', 'piston', 'bar', 'ball', 'piston', 'roller', 'ball', 'bar'], description: '在星球之間闖過四種機關，完成八道單字門拿皇冠。', tip: '每一段都有不同機關；保持冷靜，選錯門還能再試。' },
];
export const DASH_OBSTACLE_NAMES = { bar: '旋轉糖果棒', ball: '蹦蹦軟糖球', roller: '橫越果凍球', piston: '汽水升降台' };
export const dashCourseObstacle = (course, round) => course.pattern[round % course.pattern.length];

export function dashObstacleHit(obstacle, x, z, jumpHeight) {
  const dx = x - obstacle.x, dz = z - obstacle.z;
  if (obstacle.type === 'ball' || obstacle.type === 'roller') return dx * dx + dz * dz < (obstacle.radius + .45) ** 2 && jumpHeight < obstacle.y + obstacle.radius && jumpHeight + 1.7 > obstacle.y - obstacle.radius;
  if (obstacle.type === 'piston') return obstacle.y + obstacle.height / 2 > .18 && Math.abs(dx) < obstacle.width / 2 + .4 && Math.abs(dz) < obstacle.depth / 2 + .4 && jumpHeight < obstacle.y + obstacle.height / 2 && jumpHeight + 1.7 > obstacle.y - obstacle.height / 2;
  const perpendicular = Math.sin(obstacle.angle) * dx + Math.cos(obstacle.angle) * dz;
  const along = Math.cos(obstacle.angle) * dx - Math.sin(obstacle.angle) * dz;
  return Math.abs(perpendicular) < .75 && Math.abs(along) < 6.8 && jumpHeight < 1.1;
}

export function makeDashRounds(words, random = Math.random, count = 5) {
  const meanings = new Set();
  const pool = arcadeWords(words).filter(word => {
    const meaning = shortMeaning(word.m);
    if (meanings.has(meaning)) return false;
    meanings.add(meaning); return true;
  });
  if (pool.length < 3) return [];
  const targets = [], total = Math.max(1, Math.min(8, Math.trunc(Number(count)) || 5));
  while (targets.length < total) {
    const batch = shuffleArcade(pool, random);
    if (batch[0].w === targets.at(-1)?.w) [batch[0], batch[1]] = [batch[1], batch[0]];
    targets.push(...batch.slice(0, total - targets.length));
  }
  return targets.map(word => ({
    ...word, choices: shuffleArcade([word, ...shuffleArcade(pool.filter(item => item.w !== word.w), random).slice(0, 2)], random).map(item => ({ w: item.w, m: shortMeaning(item.m) })),
  }));
}

// Rivals follow their own race clock, including a short hesitation at each door.
export function dashRivalDistances(seconds, course, total) {
  const finish = total * 32 - 3;
  return Array.from({ length: 6 }, (_, i) => {
    const speed = course.speed * (1.02 - i * .045);
    const elapsed = Math.max(0, seconds - i * .35);
    const cycle = 32 / speed + .7 + i * .22;
    const section = Math.floor(elapsed / cycle);
    return Math.min(finish, -2 + section * 32 + Math.min(32, (elapsed % cycle) * speed));
  });
}
export function dashRaceRank(distance, rivals, finish) {
  return 1 + rivals.filter(value => value > distance || value >= finish).length;
}

// Keep the camera still during recoil so only the player visibly falls back.
export const dashCameraDistance = (previous, player) => Math.max(previous, player);
