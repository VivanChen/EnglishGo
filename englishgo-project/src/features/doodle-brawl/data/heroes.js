// Playable doodles and the three difficulty settings.
export const HEROES = {
  sketch: {
    en: 'Sketch', zh: '小畫', weapon: 'pencil', color: '#f6efdc', accent: '#e5484d',
    perk: '均衡的萬能型，什麼武器都能用。', stats: {},
  },
  brick: {
    en: 'Brick', zh: '磚磚', weapon: 'ruler', color: '#f7a8b8', accent: '#c2456b',
    perk: '又硬又穩：近戰傷害 +20%，遠程傷害 −20%。', stats: { maxHp: 8, armor: 2, speed: -8, melee: 20, ranged: -20 },
  },
  zip: {
    en: 'Zip', zh: '咻咻', weapon: 'scissors', color: '#8fd3ff', accent: '#2f7bf6',
    perk: '跑得超快、很會閃，但比較脆弱。', stats: { speed: 15, dodge: 10, maxHp: -3 },
    unlock: { bestWave: 6, text: '撐過第 6 波解鎖' },
  },
  lucky: {
    en: 'Lucky', zh: '幸運星', weapon: 'plane', color: '#ffd84d', accent: '#e8890c',
    perk: '運氣超好：商店和寶箱更容易出好東西，收穫也更多。', stats: { luck: 30, harvest: 6, damage: -8 },
    unlock: { wins: 1, text: '打倒墨水大王一次解鎖' },
  },
};

export const HERO_IDS = Object.keys(HEROES);

export function heroUnlocked(id, meta) {
  const hero = HEROES[id];
  if (!hero) return false;
  const rule = hero.unlock;
  if (!rule) return true;
  if (rule.bestWave && (meta?.bestWave || 0) >= rule.bestWave) return true;
  if (rule.wins && (meta?.wins || 0) >= rule.wins) return true;
  return false;
}

export const DIFFICULTIES = {
  easy: { en: 'Chill', zh: '輕鬆', hp: 0.62, dmg: 0.55, rate: 0.8, text: '敵人比較少也比較弱，適合第一次玩。' },
  normal: { en: 'Normal', zh: '標準', hp: 1, dmg: 1, rate: 1, text: '原汁原味的塗鴉大亂鬥。' },
  hard: { en: 'Wild', zh: '狂野', hp: 1.3, dmg: 1.35, rate: 1.2, text: '更多、更兇的墨水怪，給高手的挑戰。' },
};
