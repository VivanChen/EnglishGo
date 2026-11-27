// A run's build: the hero, items and level-ups add up to the stats the arena
// uses. Also the shared price and rarity rules for the shop and crates.
import { HEROES } from '../data/heroes.js';
import { ITEMS } from '../data/items.js';
import { BASE_HP, DODGE_CAP } from '../data/stats.js';
import { WEAPONS, WEAPON_TIER_PRICE } from '../data/weapons.js';
import { rnd } from './rng.js';

const ZERO = { maxHp: 0, regen: 0, lifesteal: 0, damage: 0, melee: 0, ranged: 0, magic: 0, atkSpeed: 0, crit: 0, critDmg: 0, range: 0, armor: 0, dodge: 0, speed: 0, luck: 0, harvest: 0, pickup: 0 };

export function computeStats(run) {
  const stats = { ...ZERO, maxHp: BASE_HP };
  const effects = { turret: 0, kite: 0, boom: 0, lunch: 0 };
  const add = (values, times = 1) => {
    Object.entries(values || {}).forEach(([key, value]) => { stats[key] = (stats[key] || 0) + value * times; });
  };
  add(HEROES[run?.hero]?.stats);
  Object.entries(run?.items || {}).forEach(([id, count]) => {
    const item = ITEMS[id];
    if (!item || !count) return;
    add(item.stats, count);
    if (item.effect) effects[item.effect] += count;
  });
  add(run?.bonus);
  stats.maxHp = Math.max(1, Math.round(stats.maxHp + (run?.level || 0)));
  return { ...stats, effects };
}

export const effectiveDodge = stats => Math.max(0, Math.min(DODGE_CAP, stats.dodge));

// Damage taken is scaled by armor: 12 armor halves it, negative armor hurts.
export function armorFactor(armor) {
  return armor >= 0 ? 12 / (12 + armor) : (12 - armor) / 12;
}

// Experience needed to go from `level` to the next one.
export const xpForLevel = level => (level + 3) ** 2;

// Rarity roll shared by the shop, crates and level-ups. Later waves and luck
// make better tiers more likely.
export function tierOdds(wave, luck = 0) {
  const boost = Math.max(0.2, 1 + luck / 100);
  const legendary = wave >= 8 ? Math.min(0.12, (wave - 7) * 0.02 * boost) : 0;
  const rare = wave >= 4 ? Math.min(0.3, (wave - 3) * 0.045 * boost) : 0;
  const uncommon = Math.min(0.55, (0.08 + wave * 0.05) * boost);
  return [Math.max(0, 1 - legendary - rare - uncommon), uncommon, rare, legendary];
}

export function rollTier(holder, wave, luck = 0) {
  const odds = tierOdds(wave, luck);
  let roll = rnd(holder);
  for (let tier = 3; tier >= 1; tier--) {
    if (roll < odds[tier]) return tier;
    roll -= odds[tier];
  }
  return 0;
}

export const priceFactor = wave => 1 + 0.09 * Math.max(0, wave - 1);
export const weaponPrice = (id, tier, wave) => Math.round(WEAPONS[id].price * WEAPON_TIER_PRICE[tier] * priceFactor(wave));
export const itemPrice = (id, wave) => Math.round(ITEMS[id].price * priceFactor(wave));
export const weaponSellValue = (weapon, wave) => Math.max(1, Math.round(weaponPrice(weapon.id, weapon.tier, wave) * 0.3));
export const recycleValue = (id, wave) => Math.max(1, Math.round(itemPrice(id, wave) * 0.35));
export const rerollCost = (wave, times) => Math.max(1, Math.round(1 + wave * 0.5)) + times * Math.max(1, Math.round(wave * 0.35));
