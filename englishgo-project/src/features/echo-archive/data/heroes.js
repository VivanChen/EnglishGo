import { CARDS, REWARD_POOL, STARTER_DECK, archOf } from './cards.js';

// Playable heroes. `hp` is added to the difficulty's starting health.
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
  },
};
export const HERO_IDS = Object.keys(HEROES);
export const heroOf = run => (HEROES[run?.hero?.id] ? run.hero.id : 'scribe');

// The Inkcaller shares the Burn, Chant, Ink and Fold cards plus a few utility
// skills with the Scribe; everything else in its pool is its own.
const CALLER_UTILITY = new Set(['focus', 'insight', 'parry', 'barrier', 'smoke', 'haste', 'rewind', 'clarity', 'sanctum', 'mend', 'hex', 'echo', 'surge']);
export function inHeroPool(id, hero = 'scribe') {
  const card = CARDS[id];
  if (!card) return false;
  if (card.hero) return card.hero === hero;
  if (hero === 'scribe') return true;
  return ['burn', 'chant', 'ink', 'fold'].includes(archOf(id)) || CALLER_UTILITY.has(id);
}
export const heroPool = hero => REWARD_POOL.filter(id => inHeroPool(id, hero));

// A hero is playable once the player has beaten the first boss.
export const heroUnlocked = (id, meta = {}) => id === 'scribe' || (meta.bestAct || 0) >= 2 || (meta.wins || 0) > 0;
