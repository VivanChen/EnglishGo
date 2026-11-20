import { ARCHIVE_CARDS, CARDS } from './data/cards.js';
import { trialBonus } from './data/challenges.js';

// Archive Gacha: Ink Shards are earned only inside Echo Archive and spent here
// to unlock new cards for future runs. Odds are shown to the player, every ten
// pulls guarantee a Rare or better, and duplicates turn into shards, or now
// and then into a foil. A foil card always joins a run already upgraded.
export const PULL_COST = 20;
export const TEN_PULL_COST = 180;
export const WELCOME_SHARDS = 100;
export const ODDS = [['common', 52], ['uncommon', 30], ['rare', 13], ['mythic', 5]];
export const RARE_PITY = 10;
export const MYTHIC_PITY = 40;
export const REFUND = { common: 4, uncommon: 7, rare: 12, mythic: 25 };
export const FOIL_CHANCE = 10; // % of duplicates that become a foil
// Foils used to be cosmetic and came with every first duplicate. Collections
// saved under that rule trade their foils back for shards once.
export const FOIL_RULE = 2;

export const emptyCollection = () => ({ shards: 0, owned: {}, foils: [], sinceRare: 0, sinceMythic: 0, pulls: 0, welcomed: false, foilRule: FOIL_RULE, notice: null });

export function normalizeCollection(raw) {
  const base = emptyCollection();
  if (!raw || typeof raw !== 'object') return base;
  const owned = {};
  Object.entries(raw.owned || {}).forEach(([id, count]) => { if (ARCHIVE_CARDS.includes(id) && Number(count) > 0) owned[id] = Math.floor(Number(count)); });
  let shards = Math.max(0, Math.floor(Number(raw.shards) || 0));
  let foils = (raw.foils || []).filter(id => owned[id]);
  let notice = raw.notice?.kind === 'foilRefund' ? { kind: 'foilRefund', count: Number(raw.notice.count) || 0, shards: Number(raw.notice.shards) || 0 } : null;
  if (raw.foilRule !== FOIL_RULE && foils.length) {
    const refund = foils.reduce((sum, id) => sum + (REFUND[CARDS[id].rarity] || 0), 0);
    notice = { kind: 'foilRefund', count: foils.length, shards: refund };
    shards += refund;
    foils = [];
  }
  return {
    shards,
    owned,
    foils,
    sinceRare: Math.max(0, Number(raw.sinceRare) || 0),
    sinceMythic: Math.max(0, Number(raw.sinceMythic) || 0),
    pulls: Math.max(0, Number(raw.pulls) || 0),
    welcomed: Boolean(raw.welcomed),
    foilRule: FOIL_RULE,
    notice,
  };
}

export const dismissNotice = collection => ({ ...collection, notice: null });

export const unlockedCards = collection => ARCHIVE_CARDS.filter(id => collection.owned[id] > 0);
export const pullCost = count => (count >= 10 ? TEN_PULL_COST : PULL_COST * count);

function weightedRandom(table, random) {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of table) { roll -= weight; if (roll < 0) return value; }
  return table[table.length - 1][0];
}

export function claimWelcome(collection) {
  if (collection.welcomed) return collection;
  return { ...collection, welcomed: true, shards: collection.shards + WELCOME_SHARDS };
}

export function pullArchive(collection, count, random = Math.random) {
  const cost = pullCost(count);
  if (collection.shards < cost) return null;
  const next = { ...collection, owned: { ...collection.owned }, foils: [...collection.foils], shards: collection.shards - cost };
  const results = [];
  for (let i = 0; i < count; i++) {
    let rarity;
    if (next.sinceMythic + 1 >= MYTHIC_PITY) rarity = 'mythic';
    else if (next.sinceRare + 1 >= RARE_PITY) rarity = weightedRandom([['rare', 72], ['mythic', 28]], random);
    else rarity = weightedRandom(ODDS, random);
    const pool = ARCHIVE_CARDS.filter(id => CARDS[id].rarity === rarity);
    const id = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    next.pulls += 1;
    next.sinceRare = rarity === 'rare' || rarity === 'mythic' ? 0 : next.sinceRare + 1;
    next.sinceMythic = rarity === 'mythic' ? 0 : next.sinceMythic + 1;
    const owned = next.owned[id] || 0;
    let outcome = 'new', refund = 0;
    if (owned > 0 && !next.foils.includes(id) && random() * 100 < FOIL_CHANCE) { outcome = 'foil'; next.foils.push(id); }
    else if (owned > 0) { outcome = 'refund'; refund = REFUND[rarity]; next.shards += refund; }
    next.owned[id] = owned + 1;
    results.push({ id, rarity, outcome, refund });
  }
  return { collection: next, results };
}

// Ink Shards earned at the end of a run, win or lose. Daily runs pay like
// Heroic, and each Silence level adds 10%. `bonus` holds flat extras (daily
// reward, new Silence record) that are added after the multiplier.
export function shardsForRun(run, bonus = []) {
  const s = run.stats;
  const mult = run.daily ? 1.5 : Math.round(((({ story: 1, standard: 1.25, heroic: 1.5 })[run.difficulty] || 1) + (run.silence || 0) * 0.1 + trialBonus(run.trials) / 100) * 100) / 100;
  const extras = bonus.filter(([, amount]) => amount > 0);
  const parts = [
    ['抵達樓層', s.floors * 2],
    ['擊倒敵人', s.kills],
    ['菁英', s.elites * 8],
    ['首領', s.bosses * 25],
    ['詠唱成功', s.chantsOk * 2],
    ['通關獎勵', run.screen === 'victory' ? 60 : 0],
    ['真結局', run.trueEnding ? 100 : 0],
  ].filter(([, amount]) => amount > 0);
  const base = parts.reduce((sum, [, amount]) => sum + amount, 0);
  const flat = extras.reduce((sum, [, amount]) => sum + amount, 0);
  return { total: Math.round(base * mult) + flat, mult, parts, bonus: extras };
}

export const odds = ODDS.map(([rarity, weight]) => ({ rarity, percent: weight, cards: ARCHIVE_CARDS.filter(id => CARDS[id].rarity === rarity).length }));
