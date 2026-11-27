// Weapons are school supplies. Every array is indexed by tier (0 = I … 3 = IV);
// two copies of the same weapon and tier combine into the next tier.
export const MAX_WEAPONS = 6;

export const TIERS = [
  { roman: 'I', en: 'Common', zh: '普通', color: '#6b6f82' },
  { roman: 'II', en: 'Uncommon', zh: '精良', color: '#2f7bf6' },
  { roman: 'III', en: 'Rare', zh: '稀有', color: '#8e4ff0' },
  { roman: 'IV', en: 'Legendary', zh: '傳說', color: '#e8890c' },
];

export const KIND_LABEL = { melee: '近戰', ranged: '遠程', magic: '魔法' };

// style: how the weapon attacks.
//  shot    straight projectile        spread  a fan of short pellets
//  homing  projectile that steers     bounce  projectile that hops to new targets
//  thrust  melee poke in a line       snip    melee cut in a short cone
//  smash   melee blow with splash     beam    instant line through every foe
//  glob    lob that leaves a sticky slowing puddle
export const WEAPONS = {
  pencil: {
    en: 'Pencil', zh: '鉛筆', kind: 'ranged', style: 'shot', price: 12,
    text: '射出尖尖的筆芯，射速快、射程遠。',
    dmg: [5, 8, 12, 18], cd: [0.72, 0.64, 0.56, 0.46], range: [380, 400, 420, 450], speed: 640, pierce: [0, 0, 1, 1], crit: 0.05, critMult: 2, knock: 6,
  },
  crayon: {
    en: 'Crayon', zh: '蠟筆', kind: 'ranged', style: 'spread', price: 16,
    text: '一次噴出一把蠟筆碎片，近距離很痛。',
    dmg: [3, 5, 7, 10], cd: [1.05, 0.95, 0.85, 0.75], range: [250, 260, 270, 290], speed: 540, pellets: [3, 3, 4, 5], spread: 0.42, crit: 0.03, critMult: 1.5, knock: 22,
  },
  stapler: {
    en: 'Stapler', zh: '釘書機', kind: 'ranged', style: 'shot', price: 18,
    text: '連射訂書針，單發不痛但停不下來。',
    dmg: [2, 3, 5, 7], cd: [0.25, 0.22, 0.19, 0.16], range: [320, 330, 340, 360], speed: 720, pierce: [0, 0, 0, 1], inaccuracy: 0.16, crit: 0.03, critMult: 1.5, knock: 3,
  },
  plane: {
    en: 'Paper Plane', zh: '紙飛機', kind: 'ranged', style: 'homing', price: 20,
    text: '會自己轉彎追敵人的紙飛機。',
    dmg: [7, 11, 16, 24], cd: [1.15, 1.05, 0.95, 0.82], range: [460, 480, 500, 520], speed: 340, pierce: [0, 1, 1, 2], turn: 5.5, crit: 0.05, critMult: 1.8, knock: 10,
  },
  slingshot: {
    en: 'Slingshot', zh: '彈弓', kind: 'ranged', style: 'bounce', price: 18,
    text: '小石子打中後會彈向下一個敵人。',
    dmg: [6, 9, 13, 19], cd: [1.0, 0.92, 0.84, 0.74], range: [370, 380, 390, 410], speed: 580, bounces: [1, 2, 3, 4], crit: 0.05, critMult: 1.8, knock: 12,
  },
  ruler: {
    en: 'Ruler', zh: '尺', kind: 'melee', style: 'thrust', price: 14,
    text: '向前戳刺，一整排的敵人都會被打到。',
    dmg: [9, 14, 21, 32], cd: [0.9, 0.82, 0.74, 0.65], range: [125, 130, 140, 150], width: 20, crit: 0.05, critMult: 2, knock: 40,
  },
  scissors: {
    en: 'Scissors', zh: '剪刀', kind: 'melee', style: 'snip', price: 16,
    text: '快速剪擊，暴擊率很高。',
    dmg: [6, 9, 14, 21], cd: [0.55, 0.5, 0.45, 0.4], range: [100, 105, 110, 120], arc: 1.2, crit: 0.2, critMult: 2.2, knock: 14,
  },
  eraser: {
    en: 'Eraser', zh: '橡皮擦', kind: 'melee', style: 'smash', price: 20,
    text: '重重一擊擦掉一片敵人，還能把牠們擊退。',
    dmg: [15, 24, 36, 54], cd: [1.4, 1.3, 1.2, 1.1], range: [110, 115, 120, 130], radius: 52, crit: 0.03, critMult: 1.8, knock: 90,
  },
  highlighter: {
    en: 'Highlighter', zh: '螢光筆', kind: 'magic', style: 'beam', price: 24,
    text: '畫出一道螢光光束，貫穿整條線上的敵人。',
    dmg: [8, 13, 19, 28], cd: [1.5, 1.35, 1.2, 1.05], range: [400, 420, 440, 460], width: 16, crit: 0.05, critMult: 1.8, knock: 8,
  },
  glue: {
    en: 'Glue Gun', zh: '熱熔膠槍', kind: 'magic', style: 'glob', price: 20,
    text: '射出熱熔膠，留下會黏住敵人的膠池。',
    dmg: [4, 6, 9, 13], cd: [1.3, 1.2, 1.1, 1.0], range: [330, 340, 350, 370], speed: 420, puddle: { radius: 50, dps: [3, 4, 6, 9], slow: 0.45, life: 2.6 }, crit: 0.03, critMult: 1.5, knock: 4,
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);

// Shop price multiplier per tier.
export const WEAPON_TIER_PRICE = [1, 1.9, 3.4, 6];

export function weaponSummary(id, tier) {
  const def = WEAPONS[id];
  const lines = [`傷害 ${def.dmg[tier]}${def.pellets ? ` × ${def.pellets[tier]}` : ''}`, `冷卻 ${def.cd[tier]}s`, `射程 ${def.range[tier]}`];
  if (def.pierce?.[tier]) lines.push(`貫穿 ${def.pierce[tier]}`);
  if (def.bounces) lines.push(`彈跳 ${def.bounces[tier]}`);
  if (def.puddle) lines.push(`膠池 ${def.puddle.dps[tier]}/秒`);
  if (def.crit >= 0.1) lines.push(`暴擊 ${Math.round(def.crit * 100)}%`);
  return lines;
}
