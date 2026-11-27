// Character stats. Every stat starts at 0 except Max HP; heroes, items and
// level-ups add to them. `pct` stats are shown with a % sign.
export const BASE_HP = 15;

export const STATS = {
  maxHp: { en: 'Max HP', zh: '最大生命', icon: 'heart' },
  regen: { en: 'HP Regen', zh: '生命回復', icon: 'regen' },
  lifesteal: { en: 'Life Steal', zh: '吸血', pct: true, icon: 'drop' },
  damage: { en: 'Damage', zh: '傷害', pct: true, icon: 'fist' },
  melee: { en: 'Melee Damage', zh: '近戰傷害', pct: true, icon: 'fist' },
  ranged: { en: 'Ranged Damage', zh: '遠程傷害', pct: true, icon: 'target' },
  magic: { en: 'Magic Damage', zh: '魔法傷害', pct: true, icon: 'spark' },
  atkSpeed: { en: 'Attack Speed', zh: '攻擊速度', pct: true, icon: 'bolt' },
  crit: { en: 'Crit Chance', zh: '暴擊率', pct: true, icon: 'crit' },
  critDmg: { en: 'Crit Damage', zh: '暴擊傷害', pct: true, icon: 'crit' },
  range: { en: 'Range', zh: '射程', icon: 'target' },
  armor: { en: 'Armor', zh: '護甲', icon: 'shield' },
  dodge: { en: 'Dodge', zh: '閃避', pct: true, icon: 'wind' },
  speed: { en: 'Speed', zh: '移動速度', pct: true, icon: 'shoe' },
  luck: { en: 'Luck', zh: '幸運', icon: 'clover' },
  harvest: { en: 'Harvest', zh: '收穫', icon: 'star' },
  pickup: { en: 'Pickup Range', zh: '拾取範圍', pct: true, icon: 'magnet' },
};

// Stats shown on the character sheet, in order.
export const SHEET_STATS = ['maxHp', 'regen', 'lifesteal', 'damage', 'melee', 'ranged', 'magic', 'atkSpeed', 'crit', 'range', 'armor', 'dodge', 'speed', 'luck', 'harvest', 'pickup'];

export const DODGE_CAP = 60;

export function formatStat(stat, value) {
  const def = STATS[stat];
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value)}${def?.pct ? '%' : ''}`;
}

// "+3 Max HP" style label with a Chinese gloss for the item and level-up cards.
export function statLine(stat, value) {
  const def = STATS[stat];
  return { stat, value, good: value > 0, text: `${formatStat(stat, value)} ${def.en}`, zh: def.zh };
}

// Level-up choices: each tier gives a bigger bump.
export const LEVEL_STATS = {
  maxHp: [3, 6, 9, 12],
  regen: [1, 2, 3, 4],
  lifesteal: [1, 2, 3, 4],
  damage: [5, 8, 12, 16],
  atkSpeed: [5, 10, 15, 20],
  crit: [3, 5, 7, 9],
  range: [20, 35, 50, 70],
  armor: [1, 2, 3, 4],
  dodge: [3, 6, 9, 12],
  speed: [3, 6, 9, 12],
  luck: [5, 10, 15, 20],
  harvest: [5, 8, 10, 12],
  melee: [6, 10, 15, 20],
  ranged: [6, 10, 15, 20],
};
