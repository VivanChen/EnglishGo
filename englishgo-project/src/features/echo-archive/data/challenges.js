import { CARDS, REWARD_POOL } from './cards.js';
import { inHeroPool } from './heroes.js';
import { pick } from '../engine/rng.js';

// Plain numbers the engine reads during a run. A run stores its own copy, so
// rules never change under a save, and old saves fall back to these values.
export const BASE_MODS = {
  enemyHp: 1, eliteHp: 1, bossHp: 1, enemyDmg: 1, monsterDmg: 1,
  restHeal: 0.3, actHeal: 0.75, gold: 1, shopPrice: 1, eliteRooms: 1,
  heroHp: 0, startGold: 0, startPotions: 0, startCurses: [],
  startMight: 0, drawBonus: 0, firstTurnEnergy: 0, rareBoost: 1, bossMight: 0,
  eliteAffixes: 1, startWard: false, fog: false, cardChoices: 3, strictChant: false,
};

// Silence levels stack on top of Heroic. Winning level N unlocks level N + 1.
export const MAX_SILENCE = 10;
export const SILENCE_LEVELS = [
  { level: 1, zh: '兇猛菁英', text: '菁英敵人生命 +15%。', apply: m => { m.eliteHp += 0.15; } },
  { level: 2, zh: '沉重打擊', text: '一般敵人的傷害 +10%。', apply: m => { m.monsterDmg += 0.1; } },
  { level: 3, zh: '微弱燈火', text: '休息時回復的生命從 30% 降為 22%。', apply: m => { m.restHeal = 0.22; } },
  { level: 4, zh: '沉重行囊', text: '開局牌組多一張詛咒 Doubt（疑慮）。', apply: m => { m.startCurses = [...m.startCurses, 'doubt']; } },
  { level: 5, zh: '首領覺醒', text: '首領生命 +12%。', apply: m => { m.bossHp += 0.12; } },
  { level: 6, zh: '貧瘠書庫', text: '戰鬥獲得的金幣 -20%。', apply: m => { m.gold *= 0.8; } },
  { level: 7, zh: '墨商漲價', text: '商店價格 +15%。', apply: m => { m.shopPrice += 0.15; } },
  { level: 8, zh: '脆弱身軀', text: '起始最大生命 -6。', apply: m => { m.heroHp -= 6; } },
  { level: 9, zh: '疲憊行軍', text: '進入下一章時只回復 40% 已損失的生命（原本 75%）。', apply: m => { m.actHeal = 0.4; } },
  { level: 10, zh: '靜默之主', text: '所有敵人傷害 +10%，首領開戰時帶著 1 Might。', apply: m => { m.enemyDmg += 0.1; m.bossMight += 1; } },
];

// A daily run mixes one blessing with one trial.
export const DAILY_BLESSINGS = {
  sharpInk: { zh: '鋒利墨水', en: 'Sharp Ink', glyph: 'whetblade', text: '每場戰鬥開始時獲得 1 Might。', apply: m => { m.startMight += 1; } },
  swiftHand: { zh: '靈巧之手', en: 'Swift Hand', glyph: 'deck', text: '每回合多抽 1 張牌。', apply: m => { m.drawBonus += 1; } },
  spark: { zh: '開場火花', en: 'Opening Spark', glyph: 'surge', text: '每場戰鬥的第一回合 +1 能量。', apply: m => { m.firstTurnEnergy += 1; } },
  richRoad: { zh: '富饒之路', en: 'Golden Road', glyph: 'gold', text: '開局多 150 金幣。', apply: m => { m.startGold += 150; } },
  alchemist: { zh: '藥劑師', en: 'Alchemist', glyph: 'inkwell', text: '開局三格藥劑全部裝滿。', apply: m => { m.startPotions = 3; } },
  rareTomes: { zh: '稀有手稿', en: 'Rare Tomes', glyph: 'gem', text: '卡牌獎勵更容易出現稀有卡。', apply: m => { m.rareBoost = 2.5; } },
  thickHide: { zh: '堅韌書皮', en: 'Thick Binding', glyph: 'heartFill', text: '起始最大生命 +15。', apply: m => { m.heroHp += 15; } },
};

export const DAILY_TRIALS = {
  giants: { zh: '巨人書庫', en: 'Giant Stacks', glyph: 'monster', text: '所有敵人生命 +20%。', apply: m => { m.enemyHp *= 1.2; } },
  fury: { zh: '狂怒之夜', en: 'Night of Fury', glyph: 'wrath', text: '所有敵人傷害 +15%。', apply: m => { m.enemyDmg += 0.15; } },
  eliteNest: { zh: '菁英巢穴', en: 'Elite Nest', glyph: 'elite', text: '地圖上的菁英房間大幅增加。', apply: m => { m.eliteRooms = 2.2; } },
  cursed: { zh: '詛咒之書', en: 'Cursed Pages', glyph: 'regret', text: '開局帶著 Regret 與 Doubt 兩張詛咒。', apply: m => { m.startCurses = [...m.startCurses, 'regret', 'doubt']; } },
  dimLamp: { zh: '昏暗燈火', en: 'Dim Lamp', glyph: 'lantern', text: '休息時只回復 15% 生命，進入下一章時回復也減半。', apply: m => { m.restHeal = 0.15; m.actHeal = 0.4; } },
  glass: { zh: '玻璃身軀', en: 'Glass Body', glyph: 'heart', text: '起始最大生命 -18。', apply: m => { m.heroHp -= 18; } },
  poor: { zh: '拮据旅程', en: 'Lean Purse', glyph: 'coin', text: '戰鬥獲得的金幣 -40%，商店價格 +10%。', apply: m => { m.gold *= 0.6; m.shopPrice += 0.1; } },
};

// Trials the player may pick before any run but the daily one. Each adds its
// bonus to the run's shard multiplier.
export const TRIALS = {
  giants: { ...DAILY_TRIALS.giants, bonus: 20 },
  fury: { ...DAILY_TRIALS.fury, bonus: 20 },
  champions: { zh: '菁英強化', en: 'Champions', glyph: 'elite', bonus: 20, text: '每隻菁英都帶兩個詞綴。', apply: m => { m.eliteAffixes = 2; } },
  bound: { zh: '書皮護甲', en: 'Bound Covers', glyph: 'shield', bonus: 15, text: '敵人開戰時帶著 Ward（一般 6、菁英 12、首領 20）。', apply: m => { m.startWard = true; } },
  narrow: { zh: '狹窄書架', en: 'Narrow Shelves', glyph: 'deck', bonus: 15, text: '卡牌獎勵只剩兩選一。', apply: m => { m.cardChoices = 2; } },
  sleepless: { zh: '無眠之夜', en: 'Sleepless', glyph: 'rest', bonus: 20, text: '休息點不能回血（仍然可以升級或拿鑰匙）。', apply: m => { m.restHeal = 0; } },
  glass: { ...DAILY_TRIALS.glass, bonus: 15 },
  fog: { zh: '墨霧', en: 'Ink Fog', glyph: 'smoke', bonus: 10, text: '每場戰鬥的第一回合看不到敵人的意圖。', apply: m => { m.fog = true; } },
  poor: { ...DAILY_TRIALS.poor, bonus: 10 },
  strictChant: { zh: '嚴格詠唱', en: 'Strict Chant', glyph: 'rune', bonus: 10, text: '詠唱題目一定要回答，答錯失去 2 生命。', apply: m => { m.strictChant = true; } },
};
export const TRIAL_IDS = Object.keys(TRIALS);
export const trialBonus = trials => (trials || []).reduce((sum, id) => sum + (TRIALS[id]?.bonus || 0), 0);

export function buildMods({ silence = 0, daily = null, trials = [] } = {}) {
  const mods = { ...BASE_MODS, startCurses: [] };
  SILENCE_LEVELS.filter(item => item.level <= silence).forEach(item => item.apply(mods));
  if (daily) {
    DAILY_BLESSINGS[daily.blessing]?.apply(mods);
    DAILY_TRIALS[daily.trial]?.apply(mods);
  } else (trials || []).forEach(id => TRIALS[id]?.apply(mods));
  return mods;
}

export const silenceRules = level => SILENCE_LEVELS.filter(item => item.level <= level);

// Local calendar day, so the challenge turns over at the player's midnight.
export function dateKey(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function previousDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash >>> 0;
}

// Everything about a day's challenge comes from its date: the map seed, the
// blessing, the trial and a featured rare card added to the starting deck.
export function dailyChallenge(key = dateKey()) {
  const seed = hashString(`echo-archive-daily-${key}`) || 1;
  const holder = { rng: seed ^ 0x9e3779b9 };
  const blessing = pick(holder, Object.keys(DAILY_BLESSINGS));
  const trial = pick(holder, Object.keys(DAILY_TRIALS));
  const rares = REWARD_POOL.filter(id => CARDS[id].rarity === 'rare' && !CARDS[id].pack && !CARDS[id].hero);
  const featured = pick(holder, rares);
  // Picked last so earlier days keep the same blessing, trial and card.
  const hero = pick(holder, ['scribe', 'caller']);
  // The featured card must suit the day's hero (the Inkcaller has no blade,
  // combo or ward cards); only those days draw it again.
  const card = inHeroPool(featured, hero) ? featured : pick(holder, rares.filter(id => inHeroPool(id, hero)));
  return { date: key, seed, blessing, trial, card, hero };
}

// Extra shards for daily runs and new silence records; added after the
// difficulty multiplier so the numbers stay easy to read.
export const DAILY_BONUS = 30;
export const STREAK_STEP = 5;
export const STREAK_CAP = 5;
export const SILENCE_CLEAR_BONUS = 40;
export const dailyBonus = streak => DAILY_BONUS + Math.min(Math.max(0, streak - 1), STREAK_CAP) * STREAK_STEP;
