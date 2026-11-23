import { CARDS, REWARD_POOL, STARTER_DECK, archOf } from './cards.js';

// Playable heroes. `hp` is added to the difficulty's starting health.
// Every hero but the Scribe borrows a few play styles (`shares`) and a handful
// of utility cards from the common pool; everything else in its pool is its own.
// `goal` is the unlock condition: a boss beaten in a given region (`zone`).
export const HEROES = {
  scribe: {
    en: 'The Scribe', zh: '詞術師', hp: 0, relic: 'inkwell', deck: STARTER_DECK,
    style: '劍與盾', text: '均衡的斬擊與護盾，靠符文詠唱讓牌組成長。',
  },
  caller: {
    en: 'The Inkcaller', zh: '喚墨師', hp: -6, relic: 'spiritJar',
    deck: ['inkBolt', 'inkBolt', 'inkBolt', 'inkBolt', 'inkVeil', 'inkVeil', 'inkVeil', 'inkVeil', 'summonSpirit', 'cinderLash'],
    style: '墨靈與灼燒', text: '召喚墨靈替你戰鬥：餵得越多，它每回合咬得越痛。再用灼燒收割。',
    unlock: '打倒第一章首領後解鎖',
    shares: ['burn', 'chant', 'ink', 'fold'],
    utility: ['focus', 'insight', 'parry', 'barrier', 'smoke', 'haste', 'rewind', 'clarity', 'sanctum', 'mend', 'hex', 'echo', 'surge'],
  },
  tinker: {
    en: 'The Tinker', zh: '機巧師', hp: 5, relic: 'pocketBoiler',
    deck: ['wrench', 'wrench', 'wrench', 'wrench', 'plating', 'plating', 'plating', 'releaseValve', 'stoke', 'steamBlast'],
    style: '蒸汽與壓力', text: '出牌會累積 Steam，讓攻擊越來越痛；用蒸汽噴射一口氣洩壓，壓力夠高還會變強。小心：回合結束時 Steam 滿 10 就會過熱！',
    unlock: '在「鏽蝕鐘塔」打倒第二章的首領', goal: { zone: '2', where: '鏽蝕鐘塔', how: '打倒第一章首領後，選擇「鏽蝕鐘塔」那條路' },
    shares: ['ward', 'combo', 'fold'],
    utility: ['mend', 'hex', 'cleave', 'riposte', 'comet'],
  },
  knight: {
    en: 'The Twilight Knight', zh: '暮光騎士', hp: 0, relic: 'twilightLocket',
    deck: ['sunblade', 'sunblade', 'sunblade', 'sunblade', 'moonguard', 'moonguard', 'moonguard', 'moonguard', 'duskStrike', 'eclipse'],
    style: '白晝與黑夜', text: '每回合在白晝 ☀ 與黑夜 ☾ 之間輪替。白晝的牌擅長進攻，黑夜的牌擅長防守，也能用 Eclipse 自己切換。',
    unlock: '在「星辰天文台」打倒第三章的首領', goal: { zone: 'observatory', where: '星辰天文台', how: '打倒第二章首領後，選擇「星辰天文台」那條路' },
    shares: ['blade', 'chant', 'combo'],
    utility: ['parry', 'barrier', 'smoke', 'mend', 'bramble', 'poise', 'fortress'],
  },
};
export const HERO_IDS = Object.keys(HEROES);
export const heroOf = run => (HEROES[run?.hero?.id] ? run.hero.id : 'scribe');

const UTILITY = Object.fromEntries(HERO_IDS.map(id => [id, new Set(HEROES[id].utility || [])]));
export function inHeroPool(id, hero = 'scribe') {
  const card = CARDS[id];
  if (!card) return false;
  if (card.hero) return card.hero === hero;
  const def = HEROES[hero];
  if (!def?.shares) return true;
  return def.shares.includes(archOf(id)) || UTILITY[hero].has(id);
}
export const heroPool = hero => REWARD_POOL.filter(id => inHeroPool(id, hero));

// Bosses beaten per region, kept in the meta save as { [zone]: count }.
// Saves from before regions existed are credited from their best act.
export function legacyClears(meta = {}) {
  const clears = {};
  if ((meta.bestAct || 0) >= 2 || (meta.wins || 0) > 0) clears['1'] = 1;
  if ((meta.bestAct || 0) >= 3 || (meta.wins || 0) > 0) clears['2'] = 1;
  if ((meta.wins || 0) > 0) clears['3'] = meta.wins;
  return clears;
}
const clearsOf = meta => meta?.clears || legacyClears(meta);

// The Inkcaller opens once the first boss falls; the Tinker and the Twilight
// Knight each need a boss beaten in one particular region.
export function heroUnlocked(id, meta = {}) {
  if (id === 'scribe') return true;
  if (id === 'caller') return (meta.bestAct || 0) >= 2 || (meta.wins || 0) > 0 || (clearsOf(meta)['1'] || 0) > 0;
  const goal = HEROES[id]?.goal;
  return Boolean(goal && (clearsOf(meta)[goal.zone] || 0) > 0);
}
// Heroes that `after` has unlocked and `before` had not.
export const newlyUnlocked = (before, after) => HERO_IDS.filter(id => !heroUnlocked(id, before) && heroUnlocked(id, after));
