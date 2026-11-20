import { ARCHIVE_CARDS, CARDS, CHANT_CARDS, REWARD_POOL, STARTER_DECK, archOf, baseCost, cardFades, isUnlocked, val } from '../data/cards.js';
import { BASE_MODS, MAX_SILENCE, TRIALS, buildMods } from '../data/challenges.js';
import { HEROES, heroOf, inHeroPool } from '../data/heroes.js';
import { ELITE_AFFIXES, ENCOUNTERS, ENEMIES, affixValue } from '../data/enemies.js';
import { BOONS, DUEL_MOVES, EVENTS, KEEPER } from '../data/events.js';
import { ENERGY_RELICS, POTIONS, RELICS } from '../data/relics.js';
import { availableNodes, generateMap } from './map.js';
import { makeSeed, pick, randInt, rnd, shuffle, weighted } from './rng.js';

export const SAVE_VERSION = 1;
export const HAND_LIMIT = 10;
export const DIFFICULTIES = {
  story: { en: 'Story', zh: '輕鬆', hp: 0.75, dmg: 0.7, ward: 0.8, heroHp: 80, gold: 1.2, text: '敵人較弱、生命較多，適合第一次冒險。' },
  standard: { en: 'Standard', zh: '標準', hp: 1, dmg: 1, ward: 1, heroHp: 72, gold: 1, text: '原汁原味的牌組構築冒險。' },
  heroic: { en: 'Heroic', zh: '英雄', hp: 1.15, dmg: 1.2, ward: 1.15, heroHp: 66, gold: 0.9, text: '敵人更兇猛，每一步都要精打細算。' },
};

const clone = value => JSON.parse(JSON.stringify(value));
export const hasRelic = (r, id) => r.hero.relics.includes(id);
export const living = c => c.enemies.filter(enemy => !enemy.dead);
const add = (st, key, n) => { st[key] = (st[key] || 0) + n; if (st[key] <= 0) delete st[key]; };
const decay = st => ['weak', 'exposed', 'frail'].forEach(key => { if (st[key]) add(st, key, -1); });
export const eventDef = id => (id === 'keeper' ? KEEPER : EVENTS[id]);
export const canUpgrade = card => !card.up && ['attack', 'skill', 'power'].includes(CARDS[card.id]?.type);
// Rule tweaks from Silence levels and the daily challenge (saves made before
// they existed simply play with the base values).
export const runMods = r => r.mods || BASE_MODS;

// ───────────── Run setup ─────────────
// Foil cards (rare duplicates from the Archive Gacha) always arrive upgraded.
export const isFoil = (r, id) => Boolean(r.foils?.includes(id));

function addCard(r, id, up = false) {
  const card = { uid: `c${++r.uid}`, id, up: up || isFoil(r, id) };
  r.hero.deck.push(card);
  return card;
}

// Cards the run may offer: the base collection plus Archive cards the player
// has unlocked. Fixed at run start so a save resumes with the same pool.
export const cardPool = r => REWARD_POOL.filter(id => isUnlocked(id, r.unlocked) && inHeroPool(id, heroOf(r)));
// The boss encounter waiting at the end of this act's map (older saves
// predate the draw and keep the act's first boss).
export const actBoss = r => r.map?.boss || ENCOUNTERS[r.act]?.bosses[0];
export const KEY_IDS = ['flame', 'page', 'echo'];
export const hasAllKeys = r => KEY_IDS.every(id => r.keys?.[id]);

// `daily` is a challenge from dailyChallenge(): it fixes the seed, plays on
// Standard and adds its featured card. `silence` (0–10) only applies on Heroic.
export function createRun({ seed = makeSeed(), difficulty = 'standard', lv = 'elementary', unlocked = [], foils = [], silence = 0, trials = [], daily = null, startedAt = null, hero = 'scribe' } = {}) {
  const heroId = HEROES[daily?.hero || hero] ? daily?.hero || hero : 'scribe';
  const heroDef = HEROES[heroId];
  const mode = daily ? 'standard' : DIFFICULTIES[difficulty] ? difficulty : 'standard';
  const diff = DIFFICULTIES[mode];
  const level = mode === 'heroic' && !daily ? Math.max(0, Math.min(MAX_SILENCE, Math.floor(silence) || 0)) : 0;
  const challenge = daily ? { date: daily.date, blessing: daily.blessing, trial: daily.trial, card: daily.card, hero: heroId } : null;
  const chosenTrials = daily ? [] : [...new Set((trials || []).filter(id => TRIALS[id]))];
  const mods = buildMods({ silence: level, daily: challenge, trials: chosenTrials });
  const runSeed = (daily ? daily.seed : seed) >>> 0;
  const maxHp = Math.max(20, diff.heroHp + heroDef.hp + mods.heroHp);
  const r = {
    version: SAVE_VERSION, seed: runSeed, rng: runSeed, difficulty: mode, lv,
    silence: level, daily: challenge, trials: chosenTrials, mods, startedAt,
    unlocked: (unlocked || []).filter(id => ARCHIVE_CARDS.includes(id)),
    foils: (foils || []).filter(id => ARCHIVE_CARDS.includes(id) && (unlocked || []).includes(id)),
    act: 1, floor: 0, uid: 0, attacks: 0, fights: 0, actFights: 0, removeCost: Math.round(75 * mods.shopPrice), potionChance: 40,
    hero: { id: heroId, hp: maxHp, maxHp, gold: 99 + mods.startGold, deck: [], relics: [heroDef.relic], potions: [null, null, null], flags: {} },
    keys: { flame: false, page: false, echo: false }, trueEnding: false,
    map: null, pos: null, path: [], screen: 'event', actIntro: true,
    combat: null, reward: null, shop: null, rest: null, treasure: null, bossRelics: null, pending: null,
    event: { id: 'keeper', result: null, gains: [] }, seenEvents: [], lastEncounter: null,
    stats: { kills: 0, elites: 0, bosses: 0, chants: 0, chantsOk: 0, words: [], damage: 0, cards: 0, floors: 0 },
  };
  heroDef.deck.forEach(id => addCard(r, id));
  if (challenge?.card && CARDS[challenge.card]) addCard(r, challenge.card);
  mods.startCurses.forEach(id => addCard(r, id));
  for (let i = 0; i < Math.min(3, mods.startPotions); i++) r.hero.potions[i] = pick(r, Object.keys(POTIONS));
  r.map = makeMap(r, 1);
  return r;
}

// Each map of Acts I–III hides one echoing elite until the Echo Key is found.
function makeMap(r, act) {
  const map = generateMap(r, act);
  // Each act draws one of its bosses; the map shows it from the start.
  const bosses = ENCOUNTERS[act]?.bosses || [];
  map.boss = bosses.length > 1 ? pick(r, bosses) : bosses[0];
  if (act > 3 || r.keys?.echo) return map;
  const nodes = Object.values(map.nodes);
  let elites = nodes.filter(node => node.type === 'elite');
  if (!elites.length) {
    const spare = nodes.filter(node => node.type === 'monster' && node.row >= 3 && node.row <= 6);
    if (spare.length) { const node = pick(r, spare); node.type = 'elite'; elites = [node]; }
  }
  if (elites.length) pick(r, elites).echo = true;
  return map;
}

// ───────────── Combat helpers ─────────────
function fx(r, event) {
  const c = r.combat;
  if (!c) return;
  c.fxSeq += 1;
  c.fx.push({ id: c.fxSeq, ...event });
}

export function computeAttack(base, attacker = {}, defender = {}) {
  let amount = base + (attacker.might || 0);
  if (attacker.weak) amount = Math.floor(amount * 0.75);
  if (defender.exposed) amount = Math.floor(amount * 1.5);
  return Math.max(0, amount);
}

export const hasAffix = (enemy, id) => Boolean(enemy?.affixes?.includes(id));

// A boss at half health turns the page: it shakes off Weak and Exposed,
// gains Might and Ward, may call help, and shows its next move at once.
function enterPhaseTwo(r, enemy) {
  const def = ENEMIES[enemy.id].phase2, c = r.combat;
  enemy.phased = true;
  if (def.cleanse) ['weak', 'exposed'].forEach(st => { delete enemy.st[st]; });
  if (def.might) add(enemy.st, 'might', def.might);
  if (def.ward) enemy.ward += Math.round(def.ward * DIFFICULTIES[r.difficulty].ward);
  (def.summon || []).forEach(({ id, n }) => { for (let i = 0; i < n; i++) summonEnemy(r, id); });
  (def.cards || []).forEach(({ id, n }) => {
    for (let i = 0; i < n; i++) c.discard.push(makeTemp(r, id));
    fx(r, { kind: 'cards', to: 'player', card: id, amount: n });
  });
  fx(r, { kind: 'phase', to: enemy.uid, enemy: enemy.id });
  planMove(r, enemy);
}

function hurtEnemy(r, enemy, amount, kind = 'hit') {
  if (enemy.dead) return 0;
  let blocked = 0;
  if (kind !== 'burn' && kind !== 'sever' && enemy.ward > 0) { blocked = Math.min(enemy.ward, amount); enemy.ward -= blocked; }
  const loss = Math.min(enemy.hp, amount - blocked);
  enemy.hp -= loss;
  r.stats.damage += loss;
  fx(r, { kind, to: enemy.uid, amount: amount - blocked, blocked });
  if (enemy.hp > 0 && enemy.hp <= enemy.maxHp / 2 && r.combat) {
    if (hasAffix(enemy, 'enraged') && !enemy.raged) {
      enemy.raged = true;
      add(enemy.st, 'might', affixValue('enraged', r.act));
      fx(r, { kind: 'buff', to: enemy.uid, st: 'might' });
    }
    if (ENEMIES[enemy.id].phase2 && !enemy.phased) enterPhaseTwo(r, enemy);
  }
  if (enemy.hp <= 0) {
    enemy.dead = true; enemy.ward = 0; enemy.hp = 0;
    r.stats.kills += 1;
    fx(r, { kind: 'death', to: enemy.uid });
    const c = r.combat;
    if (c) {
      // A boss's minions fall with it; a severed arm wounds its boss (through
      // Ward); twins rage when their partner falls.
      if (ENEMIES[enemy.id].boss) living(c).filter(other => ENEMIES[other.id].minion).forEach(other => { other.dead = true; other.hp = 0; other.ward = 0; fx(r, { kind: 'death', to: other.uid }); });
      const severs = ENEMIES[enemy.id].severs;
      const head = severs && living(c).find(other => ENEMIES[other.id].boss);
      if (head) hurtEnemy(r, head, severs, 'sever');
      living(c).forEach(other => {
        const avenge = ENEMIES[other.id].avenge;
        if (avenge?.might) { add(other.st, 'might', avenge.might); fx(r, { kind: 'buff', to: other.uid, st: 'might' }); }
      });
      if (hasAffix(enemy, 'splitting') && !enemy.split) {
        enemy.split = true;
        const minion = ELITE_AFFIXES.splitting.minions[Math.min(4, r.act)];
        for (let i = 0; i < 2; i++) summonEnemy(r, minion);
      }
    }
  }
  return loss;
}

function hurtPlayer(r, amount, kind = 'hit') {
  const c = r.combat;
  let blocked = 0;
  if (c && kind === 'hit' && c.player.ward > 0) { blocked = Math.min(c.player.ward, amount); c.player.ward -= blocked; }
  const loss = Math.min(r.hero.hp, amount - blocked);
  r.hero.hp -= loss;
  fx(r, { kind, to: 'player', amount: amount - blocked, blocked });
  if (c && loss > 0 && hasRelic(r, 'bloodInk') && !c.bloodInk) {
    c.bloodInk = true;
    add(c.player.st, 'might', 1);
    fx(r, { kind: 'buff', to: 'player', st: 'might' });
  }
  return loss;
}

// ───────────── Familiar (the Inkcaller's ink spirit) ─────────────
function feedFamiliar(r, amount) {
  const c = r.combat;
  if (!c || !amount) return;
  c.player.familiar = Math.max(0, (c.player.familiar || 0) + amount);
  fx(r, { kind: 'feed', to: 'player', amount });
}

// The familiar bites the weakest enemy (or all of them with Ink Sovereign)
// for damage equal to its stacks. Might and Weak do not change it.
function familiarStrike(r) {
  const c = r.combat;
  const power = c.player.familiar || 0;
  if (power <= 0) return;
  const strikes = 1 + (c.player.pw.twinStrike || 0);
  for (let i = 0; i < strikes; i++) {
    const pool = living(c);
    if (!pool.length) return;
    const targets = c.player.pw.sovereign ? pool : [pool.reduce((low, enemy) => (enemy.hp < low.hp ? enemy : low))];
    fx(r, { kind: 'familiar', to: targets[0].uid, all: targets.length > 1, amount: power });
    const burn = (c.player.pw.emberSpirit || 0) + (hasRelic(r, 'inkHorn') ? 2 : 0);
    targets.forEach(enemy => {
      hurtEnemy(r, enemy, power);
      if (burn && !enemy.dead) { add(enemy.st, 'burn', burn); fx(r, { kind: 'status', to: enemy.uid, st: 'burn' }); }
    });
    if (c.player.pw.bond) gainWard(r, c.player.pw.bond, false);
  }
}

// Burn ticks on enemies, boosted by Ember Heart.
const burnDamage = (r, stacks) => (hasRelic(r, 'emberHeart') ? Math.floor(stacks * 1.5) : stacks);

function attackEnemy(r, enemy, base, mult = 1) {
  const c = r.combat;
  if (!enemy || enemy.dead) return;
  hurtEnemy(r, enemy, computeAttack(base, c.player.st, enemy.st) * mult);
  if (enemy.st.spikes) hurtPlayer(r, enemy.st.spikes, 'hit');
}

function gainWard(r, base, fromCard = true) {
  const c = r.combat;
  let amount = fromCard ? base + (c.player.st.grace || 0) : base;
  if (fromCard && c.player.st.frail) amount = Math.floor(amount * 0.75);
  amount = Math.max(0, amount);
  c.player.ward += amount;
  fx(r, { kind: 'ward', to: 'player', amount });
}

function heal(r, amount) {
  const before = r.hero.hp;
  r.hero.hp = Math.min(r.hero.maxHp, r.hero.hp + amount);
  const gained = r.hero.hp - before;
  if (gained) fx(r, { kind: 'heal', to: 'player', amount: gained });
  return gained;
}

function makeTemp(r, id) {
  const c = r.combat;
  const uid = `t${++c.tmp}`;
  c.cards[uid] = { uid, id, up: false, temp: true };
  return uid;
}

function drawCards(r, count) {
  const c = r.combat;
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (c.hand.length >= HAND_LIMIT) break;
    if (!c.draw.length) {
      if (!c.discard.length) break;
      c.draw = shuffle(r, c.discard);
      c.discard = [];
      fx(r, { kind: 'shuffle' });
    }
    const uid = c.draw.shift();
    c.hand.push(uid);
    drawn += 1;
    if (hasRelic(r, 'smudgedLens') && isJunk(CARDS[c.cards[uid].id])) gainWard(r, 3, false);
  }
  if (drawn) fx(r, { kind: 'draw', amount: drawn });
}

const isJunk = card => card.type === 'status' || card.type === 'curse';

export function cardCost(r, inst) {
  const card = CARDS[inst.id];
  if (isJunk(card) && r.combat?.player.pw.livingInk) return 0;
  const cost = baseCost(card, inst.up);
  if (typeof cost !== 'number') return cost;
  if (inst.free) return 0;
  return card.chant && hasRelic(r, 'sageEye') ? Math.max(0, cost - 1) : cost;
}

const statusCount = c => [...c.hand, ...c.draw, ...c.discard].filter(uid => isJunk(CARDS[c.cards[uid].id])).length;

// Numbers the card text needs to preview combo, chant and status scaling.
export function cardContext(r) {
  const c = r.combat;
  if (!c) return {};
  const st = c.player.st;
  return { might: st.might, weak: st.weak, grace: st.grace, frail: st.frail, combo: c.played || 0, chants: c.chantsOk || 0, statuses: statusCount(c), blades: c.blades || 0, keen: c.player.pw.keenCrease || 0, dragon: c.player.pw.paperDragon || 0, livingInk: Boolean(c.player.pw.livingInk), familiar: heroOf(r) === 'caller' || c.player.familiar ? c.player.familiar || 0 : undefined };
}

export function canPlay(r, uid) {
  const c = r.combat;
  if (!c || c.phase !== 'player' || c.choice || !c.hand.includes(uid)) return false;
  const cost = cardCost(r, c.cards[uid]);
  if (cost === null) return false;
  return cost === 'X' || cost <= c.energy;
}

export function moveBase(r, enemy, moveId = enemy.move) {
  const move = ENEMIES[enemy.id].moves[moveId];
  if (!move || move.dmg == null) return null;
  const mods = runMods(r);
  const scale = DIFFICULTIES[r.difficulty].dmg * mods.enemyDmg * (r.combat?.kind === 'monster' ? mods.monsterDmg : 1);
  return Math.round((move.dmg + (move.grow || 0) * (enemy.uses[moveId] || 0)) * scale);
}

export function intentOf(r, enemy) {
  const move = ENEMIES[enemy.id].moves[enemy.move];
  if (!move || enemy.dead) return null;
  const kinds = [];
  let dmg = null;
  if (move.dmg != null) { dmg = computeAttack(moveBase(r, enemy), enemy.st, r.combat.player.st); kinds.push('attack'); }
  if (move.ward || move.allyWard) kinds.push('defend');
  if (move.might || move.heal) kinds.push('buff');
  if (move.summon) kinds.push('summon');
  if (move.weak || move.exposed || move.frail || move.burn || move.cards || move.stealWard) kinds.push('debuff');
  return { id: enemy.move, move, kinds, dmg, hits: move.hits || 1 };
}

function planMove(r, enemy) {
  const allies = r.combat ? living(r.combat).filter(item => item !== enemy) : [];
  enemy.move = ENEMIES[enemy.id].next(enemy, rnd(r), { allies });
}

function spawnEnemy(r, id, index, kind, echo = false) {
  const def = ENEMIES[id], diff = DIFFICULTIES[r.difficulty], mods = runMods(r);
  const scale = diff.hp * mods.enemyHp * (kind === 'elite' ? mods.eliteHp : kind === 'boss' ? mods.bossHp : 1) * (echo ? 1.25 : 1);
  const hp = Math.max(1, Math.round(randInt(r, def.hp[0], def.hp[1]) * scale));
  const st = { ...(def.start || {}) };
  if (echo) st.might = (st.might || 0) + 1;
  return { uid: `e${index}`, id, hp, maxHp: hp, ward: 0, st, move: null, history: [], uses: {}, turns: 0, dead: false };
}

// Minions join the fight in a free slot (a fallen enemy's place counts).
const MAX_ENEMIES = 4;
function summonEnemy(r, id) {
  const c = r.combat;
  if (living(c).length >= MAX_ENEMIES) return null;
  c.spawned = (c.spawned || c.enemies.length) + 1;
  const enemy = spawnEnemy(r, id, c.spawned + 10, 'monster');
  const slot = c.enemies.length >= MAX_ENEMIES ? c.enemies.findIndex(item => item.dead) : -1;
  if (slot >= 0) c.enemies[slot] = enemy; else c.enemies.push(enemy);
  planMove(r, enemy);
  fx(r, { kind: 'summon', to: enemy.uid, enemy: id });
  return enemy;
}

function startCombat(r, kind, encounter, options = {}) {
  const cards = {};
  r.hero.deck.forEach(card => { cards[card.uid] = { ...card }; });
  const bonus = r.hero.relics.filter(id => ENERGY_RELICS.includes(id)).length;
  r.fights += 1;
  const c = r.combat = {
    id: r.fights, kind, round: 0, energy: 0, maxEnergy: 3 + bonus, cards, tmp: 0,
    draw: shuffle(r, Object.keys(cards)), hand: [], discard: [], faded: [],
    player: { ward: 0, st: {}, pw: {} },
    enemies: encounter.map((id, index) => spawnEnemy(r, id, index, kind, Boolean(options.echo))),
    echo: 0, mirror: hasRelic(r, 'mirrorShard'), phase: 'player', queue: [], fx: [], fxSeq: 0, reward: null,
    played: 0, lastPlayed: null, chantsOk: 0, echoElite: Boolean(options.echo), spawned: encounter.length,
    ambush: Boolean(options.ambush),
  };
  // Event blessings last a few fights: note the ones active here, then count down.
  // Elite fights: the toughest foe rolls its affixes (none in Story's first act).
  if (kind === 'elite') {
    const mods = runMods(r);
    const count = Math.max(0, (mods.eliteAffixes ?? 1) - (r.difficulty === 'story' && r.act === 1 ? 1 : 0));
    const leader = c.enemies.reduce((top, enemy) => (enemy.maxHp > top.maxHp ? enemy : top), c.enemies[0]);
    if (leader && count) {
      leader.affixes = shuffle(r, Object.keys(ELITE_AFFIXES)).slice(0, count);
      if (hasAffix(leader, 'thorny')) add(leader.st, 'spikes', affixValue('thorny', r.act));
      if (hasAffix(leader, 'armored')) leader.ward += affixValue('armored', r.act);
    }
  }
  if (runMods(r).startWard) {
    const ward = Math.round((kind === 'boss' ? 20 : kind === 'elite' ? 12 : 6) * DIFFICULTIES[r.difficulty].ward);
    c.enemies.forEach(enemy => { enemy.ward += ward; });
  }
  c.boons = (r.hero.boons || []).map(boon => boon.id);
  r.hero.boons = (r.hero.boons || []).map(boon => ({ ...boon, fights: boon.fights - 1 })).filter(boon => boon.fights > 0);
  if (c.boons.includes('sun')) add(c.player.st, 'might', 2);
  if (c.boons.includes('omen')) living(c).forEach(enemy => add(enemy.st, 'might', 1));
  c.player.familiar = (hasRelic(r, 'spiritJar') ? 2 : 0) + (hasRelic(r, 'spiritBell') ? 2 : 0);
  if (hasRelic(r, 'paperCrane')) living(c).forEach(enemy => add(enemy.st, 'weak', 1));
  r.screen = 'combat';
  if (hasRelic(r, 'whetstone')) add(c.player.st, 'might', 1);
  if (hasRelic(r, 'thornRing')) add(c.player.st, 'spikes', 3);
  if (hasRelic(r, 'redThread')) heal(r, 3);
  if (hasRelic(r, 'emberStone')) living(c).forEach(enemy => add(enemy.st, 'burn', 3));
  if (hasRelic(r, 'crownOfEchoes')) living(c).forEach(enemy => add(enemy.st, 'might', 1));
  if (hasRelic(r, 'grandCodex')) for (let i = 0; i < 2; i++) c.draw.splice(randInt(r, 0, c.draw.length), 0, makeTemp(r, 'smudge'));
  const mods = runMods(r);
  if (mods.startMight) add(c.player.st, 'might', mods.startMight);
  if (kind === 'boss' && mods.bossMight) living(c).forEach(enemy => add(enemy.st, 'might', mods.bossMight));
  living(c).forEach(enemy => planMove(r, enemy));
  startPlayerTurn(r);
}

function startPlayerTurn(r) {
  const c = r.combat;
  c.round += 1;
  c.phase = 'player';
  c.bloodInk = false;
  delete c.player.st.reflect;
  if (!c.player.pw.bastion) c.player.ward = hasRelic(r, 'bulwark') ? Math.floor(c.player.ward / 2) : 0;
  c.energy = c.maxEnergy;
  c.played = 0;
  c.lastPlayed = null;
  if (c.player.st.charge) { c.energy += c.player.st.charge; fx(r, { kind: 'energy', amount: c.player.st.charge }); delete c.player.st.charge; }
  if (c.round === 1 && hasRelic(r, 'lantern')) c.energy += 1;
  if (c.round === 1) c.energy += runMods(r).firstTurnEnergy;
  if (c.round === 1 && c.boons?.includes('comet')) c.energy += 1;
  if (c.round % 3 === 0 && hasRelic(r, 'hourglass')) c.energy += 1;
  if (c.player.st.burn) { hurtPlayer(r, c.player.st.burn, 'burn'); add(c.player.st, 'burn', -1); }
  if (c.player.pw.wildfire) living(c).forEach(enemy => add(enemy.st, 'burn', c.player.pw.wildfire));
  if (c.player.pw.hellfire) living(c).forEach(enemy => { add(enemy.st, 'burn', c.player.pw.hellfire); hurtEnemy(r, enemy, burnDamage(r, enemy.st.burn), 'burn'); });
  if (c.player.pw.ascend) add(c.player.st, 'might', c.player.pw.ascend);
  if (c.player.pw.legion) feedFamiliar(r, c.player.pw.legion);
  if (hasRelic(r, 'cinderCharm') && living(c).length) { const enemy = pick(r, living(c)); add(enemy.st, 'burn', 2); fx(r, { kind: 'status', to: enemy.uid, st: 'burn' }); }
  if (c.player.pw.library) {
    const skills = cardPool(r).filter(id => CARDS[id].type === 'skill' && CARDS[id].rarity !== 'mythic' && !CARDS[id].fx.some(item => item.op === 'choose' || item.op === 'upgradeHand'));
    for (let i = 0; i < c.player.pw.library; i++) addTempToHand(r, pick(r, skills));
  }
  if (c.round === 1 && hasRelic(r, 'anchor')) gainWard(r, 10, false);
  if (c.round === 1 && c.boons?.includes('moon')) gainWard(r, 8, false);
  if (c.player.pw.afterimage) c.echo += c.player.pw.afterimage;
  const count = 5 + runMods(r).drawBonus + (c.player.pw.clarity || 0) + (hasRelic(r, 'runeHeart') ? 1 : 0) + (c.round === 1 && hasRelic(r, 'bookmark') ? 2 : 0)
    + (c.round === 1 && c.boons?.includes('star') ? 2 : 0);
  drawCards(r, count);
  const paper = (c.player.pw.origami || 0) + (c.round === 1 && hasRelic(r, 'origamiBox') ? 2 : 0);
  if (paper) foldPaper(r, paper);
  if (c.player.pw.runeChoir) {
    const chants = cardPool(r).filter(id => CARDS[id].chant && CARDS[id].rarity !== 'mythic');
    for (let i = 0; i < c.player.pw.runeChoir && chants.length; i++) addTempToHand(r, pick(r, chants));
  }
  if (c.player.pw.abyssalInk && c.hand.length < HAND_LIMIT) {
    c.hand.push(makeTemp(r, 'smudge'));
    fx(r, { kind: 'cards', to: 'player', card: 'smudge', amount: 1 });
  }
  fx(r, { kind: 'turn', round: c.round });
  settle(r);
}

function addTempToHand(r, id, up = false) {
  const c = r.combat;
  if (c.hand.length >= HAND_LIMIT) return;
  const uid = makeTemp(r, id);
  c.cards[uid].up = up || isFoil(r, id);
  c.cards[uid].free = true;
  c.hand.push(uid);
  fx(r, { kind: 'conjure', card: id });
}

// Fold cards make Paper Blades: free attacks that only live for this combat.
function foldPaper(r, count, up = false) {
  const c = r.combat;
  let made = 0;
  while (made < count && c.hand.length < HAND_LIMIT) {
    const uid = makeTemp(r, 'paperBlade');
    c.cards[uid].up = up;
    c.hand.push(uid);
    made += 1;
  }
  if (made) fx(r, { kind: 'conjure', card: 'paperBlade', amount: made });
  return made;
}

// Every card that fades goes through here so Abyssal Ink can feed on status cards.
function fadeCard(r, uid) {
  const c = r.combat;
  c.faded.push(uid);
  const power = c.player.pw.abyssalInk;
  if (power && isJunk(CARDS[c.cards[uid].id]) && living(c).length) {
    fx(r, { kind: 'abyss', amount: power });
    living(c).forEach(enemy => hurtEnemy(r, enemy, power));
  }
}

function inscribe(r, uid, amount) {
  const c = r.combat;
  if (!uid || !c.cards[uid]) return;
  c.cards[uid].bonus = (c.cards[uid].bonus || 0) + amount;
  const deckCard = r.hero.deck.find(card => card.uid === uid);
  if (deckCard) deckCard.bonus = (deckCard.bonus || 0) + amount;
  fx(r, { kind: 'buff', to: 'player', st: 'inscribe' });
}

// "Choose a card" effects pause the turn until the player picks (CHOOSE_CARD).
const CHOICE_ACTIONS = new Set(['toHand', 'discard', 'fade', 'inscribe', 'upgrade']);
function offerChoice(r, effect, up) {
  const c = r.combat;
  let options = [];
  if (effect.from === 'discard') options = [...c.discard];
  else if (effect.from === 'top') {
    if (!c.draw.length && c.discard.length) { c.draw = shuffle(r, c.discard); c.discard = []; fx(r, { kind: 'shuffle' }); }
    options = c.draw.slice(0, val(effect.n, up) || 3);
  } else options = [...c.hand];
  if (effect.action === 'upgrade') options = options.filter(uid => !c.cards[uid].up && ['attack', 'skill', 'power'].includes(CARDS[c.cards[uid].id].type));
  if (effect.action === 'inscribe') options = options.filter(uid => CARDS[c.cards[uid].id].fx.some(item => item.op === 'damage' || item.op === 'ward'));
  if (!options.length || !CHOICE_ACTIONS.has(effect.action)) return;
  c.choice = { from: effect.from, action: effect.action, options, v: val(effect.v, up) || 0, energy: val(effect.energy, up) || 0 };
}

export function chooseCard(r, uid) {
  const c = r.combat;
  const choice = c?.choice;
  if (!choice || !choice.options.includes(uid)) return false;
  const take = pile => { c[pile] = c[pile].filter(item => item !== uid); };
  switch (choice.action) {
    case 'toHand':
      if (choice.from === 'top') {
        take('draw');
        const rest = choice.options.filter(item => item !== uid);
        c.draw = c.draw.filter(item => !rest.includes(item));
        c.discard.push(...rest);
      } else take('discard');
      if (c.hand.length < HAND_LIMIT) c.hand.push(uid); else c.discard.push(uid);
      break;
    case 'discard': take('hand'); c.discard.push(uid); break;
    case 'fade': take('hand'); fadeCard(r, uid); if (choice.energy) { c.energy += choice.energy; fx(r, { kind: 'energy', amount: choice.energy }); } break;
    case 'upgrade': c.cards[uid].up = true; fx(r, { kind: 'buff', to: 'player', st: 'upgrade' }); break;
    case 'inscribe': inscribe(r, uid, choice.v); break;
    default: break;
  }
  fx(r, { kind: 'chosen', card: c.cards[uid].id, action: choice.action });
  c.choice = null;
  settle(r);
  return true;
}

const TARGETED = new Set(['doubleBurn', 'stripWard', 'ifExposed', 'detonate', 'spreadBurn']);
function resolve(r, effects, up, target, ctx) {
  const c = r.combat;
  for (const effect of effects) {
    const v = val(effect.v, up);
    const single = (TARGETED.has(effect.op) && !effect.all) ||(effect.op === 'damageWard' && !effect.all) || (effect.op === 'damage' && !effect.all && !effect.random) || (effect.op === 'debuff' && !effect.all);
    if (single && (!target || target.dead)) continue;
    switch (effect.op) {
      case 'damage': {
        const familiar = c.player.familiar || 0;
        const base = v + (ctx.bonus || 0) + (ctx.grow || 0) + (effect.perCombo ? val(effect.perCombo, up) * (ctx.combo || 0) : 0) + (effect.perChant ? val(effect.perChant, up) * (c.chantsOk || 0) : 0) + (effect.perFamiliar ? val(effect.perFamiliar, up) * familiar : 0)
          + (effect.perBlade ? val(effect.perBlade, up) * (c.blades || 0) : 0) + (effect.perStatus ? val(effect.perStatus, up) * statusCount(c) : 0)
          + (effect.perBurn && target ? val(effect.perBurn, up) * (target.st.burn || 0) : 0) + (ctx.id === 'paperBlade' ? (c.player.pw.keenCrease || 0) + (c.player.pw.paperDragon || 0) : 0)
          + (effect.mightMult ? (c.player.st.might || 0) * (val(effect.mightMult, up) - 1) : 0);
        const hits = effect.hits === 'X' ? ctx.x : effect.comboHits ? (ctx.combo || 0) + 1 : effect.hitsPerFamiliar ? 1 + Math.floor(familiar / effect.hitsPerFamiliar) : effect.hitsPerStatus ? val(effect.hits || 1, up) + statusCount(c) : val(effect.hits || 1, up);
        // Sword Saint (single-target attacks) and Paper Dragon (Paper Blades) hit everyone.
        const sweep = !effect.all && !effect.random && ((c.player.pw.swordSaint && CARDS[ctx.id]?.type === 'attack') || (ctx.id === 'paperBlade' && c.player.pw.paperDragon));
        for (let i = 0; i < hits; i++) {
          const pool = living(c);
          if (!pool.length) break;
          const targets = effect.all || sweep ? pool : effect.random ? [pick(r, pool)] : [target];
          targets.forEach(enemy => {
            // Execute: double damage once the target is at half health or less.
            const finish = effect.wounded && enemy.hp * 2 <= enemy.maxHp ? 2 : 1;
            attackEnemy(r, enemy, base, (ctx.mult || 1) * finish);
            if (effect.burnPerHit && !enemy.dead) add(enemy.st, 'burn', effect.burnPerHit);
          });
        }
        if (effect.grow && c.cards[ctx.uid]) c.cards[ctx.uid].grow = (c.cards[ctx.uid].grow || 0) + val(effect.grow, up);
        if (effect.onKill && target?.dead) {
          const gain = val(effect.onKill, up);
          r.hero.maxHp += gain; r.hero.hp += gain;
          fx(r, { kind: 'maxhp', to: 'player', amount: gain });
        }
        break;
      }
      case 'damageWard': (effect.all ? living(c) : [target]).forEach(enemy => attackEnemy(r, enemy, c.player.ward, ctx.mult)); break;
      case 'ward': gainWard(r, v + (ctx.bonus || 0) + (effect.perKept ? val(effect.perKept, up) * (ctx.kept || 0) : 0)); break;
      case 'wardPerHand': gainWard(r, v * c.hand.length); break;
      case 'drawX': drawCards(r, (ctx.x || 0) + v); break;
      case 'choose': offerChoice(r, effect, up); break;
      case 'upgradeHand': {
        const open = c.hand.filter(uid => !c.cards[uid].up && ['attack', 'skill', 'power'].includes(CARDS[c.cards[uid].id].type));
        if (val(effect.all, up)) { open.forEach(uid => { c.cards[uid].up = true; }); if (open.length) fx(r, { kind: 'buff', to: 'player', st: 'upgrade' }); }
        else offerChoice(r, { from: 'hand', action: 'upgrade' }, up);
        break;
      }
      case 'detonate': { const burn = target.st.burn || 0; delete target.st.burn; if (burn) hurtEnemy(r, target, burn * v * (ctx.mult || 1)); break; }
      case 'spreadBurn': { const burn = target.st.burn || 0; if (burn) living(c).filter(enemy => enemy !== target).forEach(enemy => { add(enemy.st, 'burn', burn); fx(r, { kind: 'status', to: enemy.uid, st: 'burn' }); }); break; }
      case 'burnTickAll': living(c).forEach(enemy => { if (enemy.st.burn) hurtEnemy(r, enemy, burnDamage(r, enemy.st.burn), 'burn'); }); break;
      case 'feed': feedFamiliar(r, v); break;
      case 'fold': foldPaper(r, effect.fill ? HAND_LIMIT : v, Boolean(effect.upBlades)); break;
      // Every matching card in hand fades and blasts all enemies once.
      case 'burstHand': {
        const burst = c.hand.filter(uid => (effect.kind === 'junk' ? isJunk(CARDS[c.cards[uid].id]) : c.cards[uid].id === 'paperBlade'));
        if (!burst.length) break;
        c.hand = c.hand.filter(uid => !burst.includes(uid));
        burst.forEach(uid => fadeCard(r, uid));
        fx(r, { kind: 'burst', amount: burst.length });
        burst.forEach(() => living(c).forEach(enemy => attackEnemy(r, enemy, v, ctx.mult)));
        break;
      }
      case 'unleash': {
        const times = effect.x ? (ctx.x || 0) + val(effect.plus, up) : v;
        for (let i = 0; i < times && living(c).length; i++) familiarStrike(r);
        break;
      }
      case 'spend': {
        const stacks = c.player.familiar || 0;
        const used = effect.half ? Math.floor(stacks / 2) : stacks;
        c.player.familiar = stacks - used;
        if (used > 0 && target && !target.dead) attackEnemy(r, target, used * v, ctx.mult);
        break;
      }
      case 'burnFromFamiliar': {
        const stacks = Math.floor((c.player.familiar || 0) * v);
        if (stacks > 0) living(c).forEach(enemy => { add(enemy.st, 'burn', stacks); fx(r, { kind: 'status', to: enemy.uid, st: 'burn' }); });
        break;
      }
      case 'doubleFamiliar': feedFamiliar(r, c.player.familiar || 0); break;
      case 'wardFamiliar': gainWard(r, v + (c.player.familiar || 0)); break;
      case 'ifFamiliar': if ((c.player.familiar || 0) >= effect.n) resolve(r, effect.then, up, target, ctx); break;
      // Mirror Image never copies another copy effect, or two of them would loop for free.
      case 'copyLast': if (c.lastPlayed && !CARDS[c.lastPlayed.id].fx.some(item => item.op === 'copyLast')) addTempToHand(r, c.lastPlayed.id, c.lastPlayed.up); break;
      case 'conjure': {
        const pool = cardPool(r).filter(id => CARDS[id].type === effect.kind && CARDS[id].rarity !== 'mythic');
        for (let i = 0; i < v; i++) addTempToHand(r, pick(r, pool));
        break;
      }
      case 'absorb': {
        const junk = c.hand.filter(uid => isJunk(CARDS[c.cards[uid].id]));
        c.hand = c.hand.filter(uid => !junk.includes(uid));
        junk.forEach(uid => fadeCard(r, uid));
        if (junk.length) { c.energy += junk.length; fx(r, { kind: 'energy', amount: junk.length }); }
        if (val(effect.draw, up)) drawCards(r, 1);
        break;
      }
      case 'addStatus': for (let i = 0; i < v; i++) c.discard.push(makeTemp(r, effect.id)); break;
      case 'wardPerStatus': gainWard(r, v + val(effect.per, up) * statusCount(c)); break;
      case 'inscribe': inscribe(r, ctx.uid, v); break;
      case 'draw': drawCards(r, v); break;
      case 'energy': c.energy += v; fx(r, { kind: 'energy', amount: v }); break;
      case 'debuff': (effect.all ? living(c) : [target]).forEach(enemy => { add(enemy.st, effect.st, v); fx(r, { kind: 'status', to: enemy.uid, st: effect.st }); }); break;
      case 'buff': add(c.player.st, effect.st, v); fx(r, { kind: 'buff', to: 'player', st: effect.st }); break;
      case 'heal': heal(r, v); break;
      case 'loseHp': hurtPlayer(r, v, 'loss'); break;
      case 'selfWeak': add(c.player.st, 'weak', v); break;
      case 'doubleWard': gainWard(r, c.player.ward, false); break;
      case 'doubleBurn': (effect.all ? living(c) : [target]).forEach(enemy => { if (enemy.st.burn) { add(enemy.st, 'burn', enemy.st.burn); fx(r, { kind: 'status', to: enemy.uid, st: 'burn' }); } }); break;
      case 'reflect': c.player.st.reflect = 1; fx(r, { kind: 'buff', to: 'player', st: 'reflect' }); break;
      case 'stripWard': target.ward = 0; break;
      case 'echo': c.echo += v; break;
      case 'power':
        if (effect.set) c.player.pw[effect.id] = c.player.pw[effect.id] ? Math.min(c.player.pw[effect.id], v) : v;
        else add(c.player.pw, effect.id, v);
        fx(r, { kind: 'buff', to: 'player', st: effect.id });
        break;
      case 'wardFromBurn': gainWard(r, living(c).reduce((sum, enemy) => sum + (enemy.st.burn || 0), 0), false); break;
      case 'ifExposed': if (target.st.exposed) resolve(r, effect.then, up, target, ctx); break;
      case 'recycle': c.draw = shuffle(r, [...c.draw, ...c.discard]); c.discard = []; fx(r, { kind: 'shuffle' }); break;
      default: break;
    }
  }
}

function settle(r) {
  const c = r.combat;
  if (!c || c.phase === 'won' || c.phase === 'lost') return;
  if (r.hero.hp <= 0) {
    if (hasRelic(r, 'phoenixAsh') && !r.hero.flags.phoenix) {
      r.hero.flags.phoenix = true;
      r.hero.hp = Math.ceil(r.hero.maxHp / 2);
      fx(r, { kind: 'revive', to: 'player', amount: r.hero.hp });
    } else {
      c.phase = 'lost';
      return;
    }
  }
  if (!living(c).length) winCombat(r);
}

function winCombat(r) {
  const c = r.combat;
  c.phase = 'won';
  if (hasRelic(r, 'inkwell')) heal(r, 6);
  if (c.kind === 'elite') r.stats.elites += 1;
  if (c.kind === 'boss') r.stats.bosses += 1;
  c.reward = makeReward(r, c.kind);
  if (c.echoElite && !r.keys?.echo) c.reward.items.unshift({ kind: 'key', key: 'echo', taken: false });
}

export function playCard(r, uid, targetUid, chant = null) {
  if (!canPlay(r, uid)) return false;
  const c = r.combat, inst = c.cards[uid], card = CARDS[inst.id];
  let target = null;
  if (card.target === 'enemy') {
    const pool = living(c);
    target = pool.find(enemy => enemy.uid === targetUid) || (pool.length === 1 ? pool[0] : null);
    if (!target) return false;
  }
  const cost = cardCost(r, inst);
  const x = cost === 'X' ? c.energy : 0;
  c.energy -= cost === 'X' ? c.energy : cost;
  c.hand.splice(c.hand.indexOf(uid), 1);
  r.stats.cards += 1;
  if (isJunk(card)) {
    // Living Ink: status and curse cards are burned for a fresh draw.
    fx(r, { kind: 'play', card: inst.id, uid, up: false, empowered: false, target: null });
    fadeCard(r, uid);
    drawCards(r, 1);
    afterCardPlayed(r, inst);
    settle(r);
    return true;
  }
  let empowered = false;
  if (card.chant && chant?.word) {
    r.stats.chants += 1;
    if (chant.ok) r.stats.chantsOk += 1;
    r.stats.words = [...r.stats.words.filter(item => item.w !== chant.word), { w: chant.word, m: chant.meaning, ok: Boolean(chant.ok) }].slice(-60);
    empowered = Boolean(chant.ok);
    if (empowered) c.chantsOk += 1;
    else if (runMods(r).strictChant) hurtPlayer(r, 2, 'strict');
  }
  fx(r, { kind: 'play', card: inst.id, uid, up: inst.up, empowered, target: target?.uid || null });
  const effects = empowered ? [...card.fx, ...card.chant] : card.fx;
  let repeats = 1, mult = 1;
  if (card.type === 'attack') {
    if (c.echo > 0) { repeats += 1; c.echo -= 1; }
    if (c.mirror) { repeats += 1; c.mirror = false; }
    r.attacks += 1;
    if (hasRelic(r, 'ironNib') && r.attacks % 10 === 0) { mult = 2; fx(r, { kind: 'nib' }); }
  }
  if (card.chant && c.player.pw.archmage) repeats += 1;
  const combo = c.played || 0;
  for (let i = 0; i < repeats; i++) {
    if (!living(c).length) break;
    if (card.target === 'enemy' && (!target || target.dead)) target = pick(r, living(c));
    if (i > 0) fx(r, { kind: 'echo' });
    resolve(r, effects, inst.up, target, { x, mult, combo, uid, id: inst.id, bonus: inst.bonus || 0, grow: inst.grow || 0, kept: inst.kept || 0 });
  }
  if (empowered) {
    if (hasRelic(r, 'runestone') && !c.runestoneUsed) { c.runestoneUsed = true; c.energy += 1; fx(r, { kind: 'energy', amount: 1 }); drawCards(r, 1); }
    if (hasRelic(r, 'goldenQuill')) drawCards(r, 1);
    if (hasRelic(r, 'sageEye')) heal(r, 2);
    if (c.player.pw.scholar) { c.energy += c.player.pw.scholar; fx(r, { kind: 'energy', amount: c.player.pw.scholar }); }
    if (c.player.pw.wordsmith) gainWard(r, c.player.pw.wordsmith, false);
    if (c.player.pw.eloquence) living(c).forEach(enemy => hurtEnemy(r, enemy, c.player.pw.eloquence));
  }
  if (card.type === 'skill' && c.player.pw.resonance && living(c).length) hurtEnemy(r, pick(r, living(c)), c.player.pw.resonance);
  inst.free = false;
  inst.kept = 0;
  if (card.type !== 'power') (cardFades(card, inst.up) ? c.faded : c.discard).push(uid);
  afterCardPlayed(r, inst);
  settle(r);
  return true;
}

function afterCardPlayed(r, inst) {
  const c = r.combat;
  c.played = (c.played || 0) + 1;
  c.lastPlayed = { id: inst.id, up: Boolean(inst.up) };
  if (inst.id === 'paperBlade') {
    c.blades = (c.blades || 0) + 1;
    if (c.player.pw.paperArmor) gainWard(r, c.player.pw.paperArmor, false);
  }
  if (c.player.pw.thousandCuts) living(c).forEach(enemy => hurtEnemy(r, enemy, c.player.pw.thousandCuts));
  if (c.player.pw.momentum && c.played % c.player.pw.momentum === 0) drawCards(r, 1);
  if (c.player.pw.perpetualMotion && c.played % c.player.pw.perpetualMotion === 0) { c.energy += 1; fx(r, { kind: 'energy', amount: 1 }); drawCards(r, 1); }
  if (c.player.pw.origamiWorkshop && inst.id !== 'paperBlade') foldPaper(r, c.player.pw.origamiWorkshop);
  if (c.player.pw.sovereign && CARDS[inst.id].type === 'attack') feedFamiliar(r, c.player.pw.sovereign);
  if (c.played === 6 && hasRelic(r, 'metronome')) { c.energy += 1; fx(r, { kind: 'energy', amount: 1 }); }
}

export function usePotion(r, slot, targetUid) {
  const id = r.hero.potions[slot];
  if (!id) return false;
  const c = r.combat;
  if (!c) {
    if (id !== 'healTonic') return false;
    r.hero.potions[slot] = null;
    r.hero.hp = Math.min(r.hero.maxHp, r.hero.hp + 20);
    return true;
  }
  if (c.phase !== 'player' || c.choice) return false;
  let target = null;
  if (POTIONS[id].target === 'enemy') {
    const pool = living(c);
    target = pool.find(enemy => enemy.uid === targetUid) || (pool.length === 1 ? pool[0] : null);
    if (!target) return false;
  }
  r.hero.potions[slot] = null;
  fx(r, { kind: 'potion', potion: id });
  switch (id) {
    case 'fireTonic': hurtEnemy(r, target, 20); break;
    case 'ironTonic': gainWard(r, 12, false); break;
    case 'swiftTonic': drawCards(r, 3); break;
    case 'starTonic': c.energy += 2; fx(r, { kind: 'energy', amount: 2 }); break;
    case 'mightTonic': add(c.player.st, 'might', 2); break;
    case 'healTonic': heal(r, 20); break;
    case 'hexTonic': add(target.st, 'exposed', 3); add(target.st, 'weak', 2); fx(r, { kind: 'status', to: target.uid, st: 'exposed' }); break;
    case 'emberTonic': living(c).forEach(enemy => { add(enemy.st, 'burn', 6); fx(r, { kind: 'status', to: enemy.uid, st: 'burn' }); }); break;
    default: break;
  }
  settle(r);
  return true;
}

export function endTurn(r) {
  const c = r.combat;
  if (!c || c.phase !== 'player' || c.choice) return;
  const kept = [];
  for (const uid of [...c.hand]) {
    const inst = c.cards[uid], card = CARDS[inst.id];
    inst.free = false;
    if (card.endTurn) resolve(r, card.endTurn, inst.up, null, {});
    if (card.keep) { kept.push(uid); inst.kept = (inst.kept || 0) + 1; }
    else if (card.fleeting) fadeCard(r, uid);
    else c.discard.push(uid);
  }
  c.hand = kept;
  // The familiar bites at the end of your turn, and its ink thins a little.
  if (c.player.familiar > 0) {
    familiarStrike(r);
    if (!c.player.pw.eternalSpirit) c.player.familiar -= 1;
  }
  if (c.player.pw.stoneheart) gainWard(r, c.player.pw.stoneheart, false);
  if (hasRelic(r, 'owlFeather') && c.player.ward === 0) gainWard(r, 6, false);
  if (c.player.pw.colossus && c.player.ward >= 2) {
    const amount = Math.floor(c.player.ward / 2);
    fx(r, { kind: 'colossus', amount });
    living(c).forEach(enemy => hurtEnemy(r, enemy, amount));
  }
  decay(c.player.st);
  c.echo = 0;
  c.phase = 'enemy';
  c.acted = [];
  c.queue = living(c).flatMap(enemy => (hasAffix(enemy, 'swift') && enemy.turns === 0 ? [enemy.uid, enemy.uid] : [enemy.uid]));
  settle(r);
}

function performMove(r, enemy) {
  const c = r.combat, move = ENEMIES[enemy.id].moves[enemy.move], diff = DIFFICULTIES[r.difficulty];
  fx(r, { kind: 'act', from: enemy.uid, move: enemy.move });
  // Pilfer: the player's Ward is taken before the thief strikes; it keeps half.
  if (move.stealWard && c.player.ward > 0) {
    const stolen = c.player.ward;
    c.player.ward = 0;
    enemy.ward += Math.floor(stolen / 2);
    fx(r, { kind: 'steal', to: enemy.uid, amount: stolen, kept: Math.floor(stolen / 2) });
  }
  if (move.dmg != null) {
    const base = moveBase(r, enemy);
    let drained = 0;
    for (let i = 0; i < (move.hits || 1) && r.hero.hp > 0 && !enemy.dead; i++) {
      const ward = c.player.ward;
      drained += hurtPlayer(r, computeAttack(base, enemy.st, c.player.st));
      // Mirror Wall: whatever the Ward stopped flies back at the attacker.
      if (c.player.st.reflect && ward > c.player.ward) hurtEnemy(r, enemy, ward - c.player.ward, 'thorns');
      if (c.player.st.spikes) hurtEnemy(r, enemy, c.player.st.spikes, 'thorns');
    }
    const heal = hasAffix(enemy, 'vampiric') && !enemy.dead ? Math.min(enemy.maxHp - enemy.hp, Math.floor(drained / 2)) : 0;
    if (heal > 0) { enemy.hp += heal; fx(r, { kind: 'heal', to: enemy.uid, amount: heal }); }
  }
  if (!enemy.dead) {
    if (move.ward) { const amount = Math.round(move.ward * diff.ward); enemy.ward += amount; fx(r, { kind: 'ward', to: enemy.uid, amount }); }
    if (move.allyWard) living(c).forEach(ally => { const amount = Math.round(move.allyWard * diff.ward); ally.ward += amount; fx(r, { kind: 'ward', to: ally.uid, amount }); });
    if (move.might) { add(enemy.st, 'might', move.might); fx(r, { kind: 'buff', to: enemy.uid, st: 'might' }); }
    if (move.heal) {
      const before = enemy.hp;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.round(move.heal * diff.hp));
      if (enemy.hp > before) fx(r, { kind: 'heal', to: enemy.uid, amount: enemy.hp - before });
    }
    (move.summon || []).forEach(({ id, n }) => { for (let i = 0; i < n; i++) summonEnemy(r, id); });
  }
  ['weak', 'exposed', 'frail', 'burn'].forEach(st => { if (move[st]) { add(c.player.st, st, move[st]); fx(r, { kind: 'status', to: 'player', st }); } });
  (move.cards || []).forEach(({ id, n }) => {
    for (let i = 0; i < n; i++) c.discard.push(makeTemp(r, id));
    fx(r, { kind: 'cards', to: 'player', card: id, amount: n });
  });
  enemy.uses[enemy.move] = (enemy.uses[enemy.move] || 0) + 1;
  enemy.history = [...enemy.history, enemy.move].slice(-6);
}

export function enemyStep(r) {
  const c = r.combat;
  if (!c || c.phase !== 'enemy') return;
  const uid = c.queue.shift();
  const enemy = c.enemies.find(item => item.uid === uid);
  if (enemy && !enemy.dead) {
    const first = !(c.acted || []).includes(uid);
    c.acted = [...(c.acted || []), uid];
    if (first) {
      enemy.ward = 0;
      if (enemy.st.burn) { hurtEnemy(r, enemy, burnDamage(r, enemy.st.burn), 'burn'); if (!c.player.pw.eternalFlame) add(enemy.st, 'burn', -1); }
    }
    if (!enemy.dead && hasAffix(enemy, 'armored')) { const amount = affixValue('armored', r.act); enemy.ward += amount; fx(r, { kind: 'ward', to: enemy.uid, amount }); }
    if (!enemy.dead) {
      performMove(r, enemy);
      enemy.turns += 1;
      if (first) decay(enemy.st);
      if (enemy.st.ritual && !enemy.dead) add(enemy.st, 'might', enemy.st.ritual);
      // A Swift foe's second action this turn needs a fresh move.
      if (!enemy.dead && c.queue.includes(uid)) planMove(r, enemy);
    }
  }
  settle(r);
  if (c.phase === 'enemy' && !c.queue.length) {
    living(c).forEach(item => planMove(r, item));
    startPlayerTurn(r);
  }
}

// Plays out the whole enemy phase at once (used by tests and fast-forward).
export function finishEnemyPhase(r) {
  let guard = 0;
  while (r.combat?.phase === 'enemy' && guard++ < 20) enemyStep(r);
}

// ───────────── Rewards ─────────────
const RARITY_WEIGHTS = {
  monster: [['common', 60], ['uncommon', 33], ['rare', 6], ['mythic', 1]],
  elite: [['common', 44], ['uncommon', 38], ['rare', 14], ['mythic', 4]],
  boss: [['rare', 85], ['mythic', 15]],
};

// Only rarities that still have unchosen, unlocked cards can be rolled.
function rollRarity(r, kind, pool) {
  const boost = runMods(r).rareBoost;
  const table = (RARITY_WEIGHTS[kind] || RARITY_WEIGHTS.monster)
    .map(([rarity, weight]) => [rarity, kind !== 'boss' && (rarity === 'rare' || rarity === 'mythic') ? weight * boost : weight])
    .filter(([rarity]) => pool.some(id => CARDS[id].rarity === rarity));
  return table.length ? weighted(r, table) : null;
}

// The play style the deck is building: the archetype with the most cards the
// player chose (starters and curses do not count), once there are two of them.
export function deckFocus(r) {
  const counts = {}, last = {};
  r.hero.deck.forEach((card, index) => {
    const def = CARDS[card.id];
    if (!def || ['starter', 'special'].includes(def.rarity)) return;
    const arch = archOf(card.id);
    counts[arch] = (counts[arch] || 0) + 1;
    last[arch] = index;
  });
  const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || last[b] - last[a])[0];
  return best && counts[best] >= 2 ? best : null;
}

export function cardOptions(r, kind, count, rarity) {
  const options = [];
  let guard = 0;
  while (options.length < count && guard++ < 200) {
    const open = cardPool(r).filter(id => !options.includes(id));
    const wanted = rarity || rollRarity(r, kind, open);
    const pool = open.filter(id => CARDS[id].rarity === wanted);
    if (pool.length) options.push(pick(r, pool));
    else if (!wanted) break;
  }
  // With 80+ cards in the pool, a build rarely gets its pieces by chance, so
  // one option always comes from the deck's play style (same rarity if possible).
  const focus = deckFocus(r);
  if (focus && options.length && !options.some(id => archOf(id) === focus)) {
    const slot = options.length - 1;
    const fits = cardPool(r).filter(id => archOf(id) === focus && !options.includes(id));
    const same = fits.filter(id => CARDS[id].rarity === CARDS[options[slot]].rarity);
    const plain = fits.filter(id => ['common', 'uncommon'].includes(CARDS[id].rarity));
    const choices = same.length ? same : plain;
    if (choices.length) options[slot] = pick(r, choices);
  }
  return options;
}

// Passing on a card reward is a real choice: the deck stays lean and the hero gets sturdier.
export const SKIP_CARD_HP = 2;
function skipCards(r, item) {
  if (item.taken) return;
  item.taken = true;
  item.skipped = true;
  r.hero.maxHp += SKIP_CARD_HP;
  r.hero.hp += SKIP_CARD_HP;
}

export function randomRelic(r, tier) {
  const owned = new Set(r.hero.relics);
  const wanted = tier || weighted(r, [['common', 50], ['uncommon', 33], ['rare', 17]]);
  const fits = id => !owned.has(id) && (!RELICS[id].hero || RELICS[id].hero === heroOf(r));
  let pool = Object.keys(RELICS).filter(id => RELICS[id].tier === wanted && fits(id));
  if (!pool.length) pool = Object.keys(RELICS).filter(id => ['common', 'uncommon', 'rare'].includes(RELICS[id].tier) && fits(id));
  return pool.length ? pick(r, pool) : null;
}

function gainRelic(r, id) {
  if (!id || hasRelic(r, id)) return false;
  r.hero.relics.push(id);
  if (id === 'moonPeach') { r.hero.maxHp += 10; r.hero.hp += 10; }
  if (id === 'oldCoin') r.hero.gold += 120;
  return true;
}

function gainPotion(r, id) {
  const slot = r.hero.potions.indexOf(null);
  if (slot < 0) return false;
  r.hero.potions[slot] = id;
  return true;
}

function makeReward(r, kind) {
  const diff = DIFFICULTIES[r.difficulty];
  const [low, high] = kind === 'boss' ? [70, 85] : kind === 'elite' ? [28, 38] : [12, 20];
  const items = [{ kind: 'gold', amount: Math.round(randInt(r, low, high) * diff.gold * runMods(r).gold), taken: false }];
  if (kind !== 'boss') {
    if (randInt(r, 1, 100) <= r.potionChance) { items.push({ kind: 'potion', id: pick(r, Object.keys(POTIONS)), taken: false }); r.potionChance = Math.max(10, r.potionChance - 10); }
    else r.potionChance = Math.min(80, r.potionChance + 10);
  }
  if (kind === 'elite') { const id = randomRelic(r); if (id) items.push({ kind: 'relic', id, taken: false }); }
  items.push({ kind: 'cards', options: cardOptions(r, kind, (runMods(r).cardChoices ?? 3) + (hasRelic(r, 'starChart') ? 1 : 0)), focus: deckFocus(r), taken: false });
  return { kind, items, after: kind === 'boss' ? 'boss' : 'map' };
}

function takeReward(r, index, choice) {
  const item = r.reward?.items[index];
  if (!item || item.taken) return;
  if (item.kind === 'gold') { r.hero.gold += item.amount; item.taken = true; }
  if (item.kind === 'potion' && gainPotion(r, item.id)) item.taken = true;
  if (item.kind === 'relic') { gainRelic(r, item.id); item.taken = true; }
  if (item.kind === 'cards') {
    if (choice != null && item.options[choice]) { addCard(r, item.options[choice]); item.chosen = item.options[choice]; item.taken = true; }
    else skipCards(r, item);
  }
  if (item.kind === 'key') {
    r.keys = { ...(r.keys || {}), [item.key]: true };
    item.taken = true;
  }
  // A chest offers either its relic or the Page Key, not both.
  if (item.or != null && item.taken) {
    const other = r.reward.items[item.or];
    if (other && !other.taken) { other.taken = true; other.skipped = true; }
  }
}

function leaveReward(r) {
  const after = r.reward?.after;
  (r.reward?.items || []).forEach(item => { if (item.kind === 'cards') skipCards(r, item); });
  r.reward = null;
  if (after === 'boss' && r.act >= 4) { r.trueEnding = true; r.screen = 'victory'; return; }
  if (after === 'boss') {
    r.bossRelics = shuffle(r, Object.keys(RELICS).filter(id => RELICS[id].tier === 'boss' && !hasRelic(r, id))).slice(0, 3);
    r.screen = 'bossRelic';
  } else r.screen = 'map';
}

function nextAct(r) {
  r.bossRelics = null;
  if (r.act >= 4 || (r.act === 3 && !hasAllKeys(r))) { r.screen = 'victory'; return; }
  r.act += 1;
  r.map = makeMap(r, r.act);
  r.pos = null; r.path = []; r.actFights = 0; r.lastEncounter = null;
  r.hero.hp = Math.min(r.hero.maxHp, r.hero.hp + Math.round((r.hero.maxHp - r.hero.hp) * runMods(r).actHeal));
  r.screen = 'map';
  r.actIntro = true;
}

// ───────────── Rooms ─────────────
function pickEncounter(r, kind) {
  const table = ENCOUNTERS[r.act];
  const list = kind === 'elite' ? table.elite : r.actFights < 2 ? table.easy : table.normal;
  const options = list.filter(item => item.join() !== r.lastEncounter);
  const chosen = pick(r, options.length ? options : list);
  r.lastEncounter = chosen.join();
  if (kind === 'monster') r.actFights += 1;
  return chosen;
}

// An unknown room is usually a story, but now and then something else waits
// there: an ambush, a forgotten chest or a wandering merchant. Never in the
// first room of an act.
export const SURPRISE_ODDS = { ambush: 12, treasure: 8, shop: 6 };

function startEvent(r) {
  if (r.path.length > 1) {
    let roll = randInt(r, 1, 100);
    if ((roll -= SURPRISE_ODDS.ambush) <= 0) { startCombat(r, 'monster', pickEncounter(r, 'monster'), { ambush: true }); return; }
    if ((roll -= SURPRISE_ODDS.treasure) <= 0) { r.treasure = { opened: false, surprise: true }; r.screen = 'treasure'; return; }
    if ((roll -= SURPRISE_ODDS.shop) <= 0) { r.shop = { ...makeShop(r), surprise: true }; r.screen = 'shop'; return; }
  }
  const pool = Object.keys(EVENTS).filter(id => EVENTS[id].acts.includes(r.act) && !r.seenEvents.includes(id));
  if (!pool.length) { startCombat(r, 'monster', pickEncounter(r, 'monster')); return; }
  const id = pick(r, pool);
  const def = EVENTS[id];
  r.seenEvents.push(id);
  r.event = { id, result: null, gains: [], riddle: def.riddle ? randInt(r, 0, def.riddles.length - 1) : null };
  if (def.roll) r.event.flags = Object.fromEntries(Object.entries(def.roll).map(([flag, chance]) => [flag, randInt(r, 1, 100) <= chance]));
  if (def.game === 'climb') r.event.game = { kind: 'climb', step: 0, loot: 0 };
  if (def.game === 'wheel') r.event.game = { kind: 'wheel', spins: [] };
  r.screen = 'event';
}

function makeShop(r) {
  const markup = runMods(r).shopPrice * (hasRelic(r, 'goldLeaf') ? 0.8 : 1);
  const scaled = amount => Math.round(amount * markup);
  const price = rarity => scaled({ common: randInt(r, 45, 55), uncommon: randInt(r, 68, 82), rare: randInt(r, 135, 160), mythic: randInt(r, 190, 220) }[rarity]);
  const chosen = [];
  const cards = ['attack', 'attack', 'skill', 'skill', 'power'].map(type => {
    const open = cardPool(r).filter(id => CARDS[id].type === type && !chosen.includes(id));
    const table = (type === 'power' ? [['uncommon', 70], ['rare', 22], ['mythic', 8]] : [['common', 53], ['uncommon', 34], ['rare', 10], ['mythic', 3]])
      .filter(([rarity]) => open.some(id => CARDS[id].rarity === rarity));
    const rarity = weighted(r, table);
    let pool = open.filter(id => CARDS[id].rarity === rarity);
    if (!pool.length) pool = open;
    const id = pick(r, pool);
    chosen.push(id);
    return { id, price: price(CARDS[id].rarity), sold: false };
  });
  const sale = randInt(r, 0, cards.length - 1);
  cards[sale].price = Math.round(cards[sale].price / 2);
  cards[sale].sale = true;
  const relics = [];
  for (let i = 0; i < 2; i++) {
    const id = randomRelic(r);
    if (id && !relics.some(item => item.id === id)) relics.push({ id, price: scaled({ common: randInt(r, 140, 160), uncommon: randInt(r, 195, 225), rare: randInt(r, 255, 285) }[RELICS[id].tier]), sold: false });
  }
  const potions = [0, 1, 2].map(() => ({ id: pick(r, Object.keys(POTIONS)), price: scaled(randInt(r, 48, 72)), sold: false }));
  return { cards, relics, potions, removed: false };
}

function shopBuy(r, kind, index) {
  const item = r.shop?.[kind]?.[index];
  if (!item || item.sold || r.hero.gold < item.price) return;
  if (kind === 'potions' && !gainPotion(r, item.id)) return;
  if (kind === 'cards') addCard(r, item.id);
  if (kind === 'relics') gainRelic(r, item.id);
  r.hero.gold -= item.price;
  item.sold = true;
}

export function enterNode(r, nodeId) {
  if (r.screen !== 'map' || !availableNodes(r).includes(nodeId)) return;
  r.pos = nodeId;
  r.path.push(nodeId);
  r.floor += 1;
  r.stats.floors += 1;
  r.actIntro = false;
  const node = r.map.nodes[nodeId];
  switch (node.type) {
    case 'monster': startCombat(r, 'monster', pickEncounter(r, 'monster')); break;
    case 'elite': startCombat(r, 'elite', pickEncounter(r, 'elite'), { echo: Boolean(node.echo) && !r.keys?.echo }); break;
    case 'boss': startCombat(r, 'boss', actBoss(r)); break;
    case 'event': startEvent(r); break;
    case 'rest': r.rest = { done: false, healed: 0, upgraded: null }; r.screen = 'rest'; break;
    case 'shop': r.shop = makeShop(r); r.screen = 'shop'; break;
    case 'treasure': r.treasure = { opened: false }; r.screen = 'treasure'; break;
    default: break;
  }
}

export const restHealAmount = r => (hasRelic(r, 'midnightOil') ? 0 : Math.round(r.hero.maxHp * runMods(r).restHeal) + (hasRelic(r, 'teaSet') ? 15 : 0));

// ───────────── Events ─────────────
export const meetsReq = (r, req) => !req || ((req.gold == null || r.hero.gold >= req.gold) && (req.hp == null || r.hero.hp >= req.hp) && (!req.potion || r.hero.potions.some(Boolean)));

function applyOutcome(r, effects = []) {
  const gains = r.event?.gains || [];
  for (const effect of effects) {
    switch (effect.op) {
      case 'gold': r.hero.gold = Math.max(0, r.hero.gold + effect.v); break;
      case 'heal': r.hero.hp = Math.min(r.hero.maxHp, r.hero.hp + effect.v); break;
      case 'healPct': r.hero.hp = Math.min(r.hero.maxHp, r.hero.hp + Math.round((r.hero.maxHp * effect.v) / 100)); break;
      case 'hurt': r.hero.hp = Math.max(1, r.hero.hp - effect.v); break;
      case 'maxHp': r.hero.maxHp += effect.v; r.hero.hp += effect.v; break;
      case 'curse': addCard(r, effect.id); gains.push({ type: 'card', id: effect.id }); break;
      case 'relic': { const id = randomRelic(r, effect.tier); if (gainRelic(r, id)) gains.push({ type: 'relic', id }); else { r.hero.gold += 50; gains.push({ type: 'gold', amount: 50 }); } break; }
      case 'potion': {
        const id = pick(r, Object.keys(POTIONS));
        if (gainPotion(r, id)) gains.push({ type: 'potion', id });
        else { r.hero.gold += 20; gains.push({ type: 'gold', amount: 20 }); } // no free slot: the bottle is sold on the spot
        break;
      }
      case 'boon': {
        const def = BOONS[effect.id];
        if (!def) break;
        const fights = effect.fights || def.fights;
        const boons = (r.hero.boons || []).filter(boon => boon.id !== effect.id);
        const current = (r.hero.boons || []).find(boon => boon.id === effect.id);
        r.hero.boons = [...boons, { id: effect.id, fights: Math.max(fights, current?.fights || 0) }];
        gains.push({ type: 'boon', id: effect.id, fights });
        break;
      }
      case 'chantCard': { const id = pick(r, CHANT_CARDS.filter(card => CARDS[card].rarity !== 'starter' && isUnlocked(card, r.unlocked) && inHeroPool(card, heroOf(r)))); addCard(r, id); gains.push({ type: 'card', id }); break; }
      case 'duplicate': if (r.hero.deck.length) r.pending = { kind: 'duplicate', cancellable: false, source: 'event' }; break;
      case 'transform': if (r.hero.deck.length) r.pending = { kind: 'transform', cancellable: false, source: 'event' }; break;
      case 'chance': applyOutcome(r, randInt(r, 1, 100) <= effect.p ? effect.then : effect.else || []); break;
      case 'losePotion': { const slot = r.hero.potions.findIndex(Boolean); if (slot >= 0) { gains.push({ type: 'lostPotion', id: r.hero.potions[slot] }); r.hero.potions[slot] = null; } break; }
      case 'randomCard': { const id = pick(r, cardPool(r).filter(card => CARDS[card].rarity === effect.rarity && (!effect.type || CARDS[card].type === effect.type))); addCard(r, id); gains.push({ type: 'card', id }); break; }
      case 'upgrade': if (r.hero.deck.some(canUpgrade)) r.pending = { kind: 'upgrade', cancellable: false, source: 'event' }; break;
      case 'remove': r.pending = { kind: 'remove', cancellable: false, source: 'event' }; break;
      case 'upgradeRandom': shuffle(r, r.hero.deck.filter(canUpgrade)).slice(0, effect.v).forEach(card => { card.up = true; gains.push({ type: 'upgrade', id: card.id }); }); break;
      case 'cardChoice': r.event = null; r.reward = { kind: 'event', items: [{ kind: 'cards', options: cardOptions(r, 'monster', runMods(r).cardChoices ?? 3, effect.rarity), focus: deckFocus(r), taken: false }], after: 'map' }; r.screen = 'reward'; break;
      case 'fight': r.event = null; startCombat(r, effect.kind || 'monster', effect.encounter); break;
      default: break;
    }
  }
}

const MOVE_ON = { en: 'You move on.', zh: '你繼續前進。' };

// The climb and the wheel build their buttons from how far the player got.
function climbChoices(r, def) {
  const { step, loot } = r.event.game;
  const { loot: gains, fall } = def.climb;
  return [
    { en: 'Climb higher', zh: '再往上爬', note: `${step === gains.length - 1 ? '登上塔頂：多拿' : '多拿'} ${gains[step]} 金幣${step === gains.length - 1 ? '和 1 件遺物' : ''}，${fall[step] ? `${fall[step]}% 機率摔下來` : '這一層很穩'}`, act: 'climb' },
    step ? { en: 'Climb down with the loot', zh: '帶著戰利品爬下來', note: `帶走 ${loot} 金幣`, act: 'stop' } : { en: 'Walk away', zh: '轉身離開', note: '什麼也不發生', act: 'stop' },
  ];
}

function wheelChoices(r, def) {
  const spins = r.event.game.spins.length;
  const cost = def.wheel.cost[spins];
  return [
    { en: spins ? `Spin again (${cost} gold)` : `Spin the wheel (${cost} gold)`, zh: spins ? `再轉一次（${cost} 金幣）` : `轉動轉盤（${cost} 金幣）`, note: '遺物、金幣、藥劑……也可能槓龜', req: { gold: cost }, act: 'spin' },
    spins ? { en: 'Take your prizes and go', zh: '帶著獎品離開', note: '', act: 'stop' } : { en: 'Walk on', zh: '繼續前進', note: '什麼也不發生', act: 'stop' },
  ];
}

export function eventChoices(r) {
  const ev = r.event, def = ev && eventDef(ev.id);
  if (!def) return [];
  if (def.riddle) {
    const riddle = def.riddles[ev.riddle];
    return [...riddle.options.map(option => ({ en: option.en, zh: option.zh, note: '' })), def.leave];
  }
  if (ev.game?.kind === 'climb') return climbChoices(r, def);
  if (ev.game?.kind === 'wheel') return wheelChoices(r, def);
  if (ev.game) return []; // a word game or duel is being played
  if (ev.stage) return def.stages?.[ev.stage]?.choices || [];
  return def.choices;
}

// The body text for the page of the event the player is on.
export const eventBody = r => {
  const def = r.event && eventDef(r.event.id);
  return (r.event?.stage && def?.stages?.[r.event.stage]?.body) || def?.body;
};

function finishEvent(r, result) {
  if (r.event) r.event.result = result || MOVE_ON;
}

// Applies one resolution { effects, result, goto, game }. A fight or a card
// reward leaves the event screen, so nothing else happens after it.
function resolveEventChoice(r, res) {
  applyOutcome(r, res.effects);
  const ev = r.event;
  if (!ev || r.screen !== 'event') return;
  if (res.goto) { ev.stage = res.goto; return; }
  if (res.game) { ev.game = { kind: res.game }; return; }
  finishEvent(r, res.result);
}

function climbStep(r, def, act) {
  const ev = r.event, game = ev.game;
  const { loot, fall, hurt } = def.climb;
  if (act === 'stop') {
    if (game.loot) applyOutcome(r, [{ op: 'gold', v: game.loot }]);
    finishEvent(r, game.step ? def.results.down : def.results.leave);
    return;
  }
  if (randInt(r, 1, 100) <= fall[game.step]) {
    game.fell = true;
    applyOutcome(r, [{ op: 'hurt', v: hurt }]);
    finishEvent(r, def.results.fall);
    return;
  }
  game.loot += loot[game.step];
  game.step += 1;
  if (game.step >= loot.length) {
    applyOutcome(r, [{ op: 'gold', v: game.loot }, { op: 'relic', tier: 'common' }]);
    finishEvent(r, def.results.top);
  }
}

function wheelSpin(r, def, act) {
  const ev = r.event, game = ev.game;
  if (act === 'stop') { finishEvent(r, game.spins.length ? def.results.done : def.results.leave); return; }
  const cost = def.wheel.cost[game.spins.length];
  if (cost == null || r.hero.gold < cost) return;
  r.hero.gold -= cost;
  const segment = weighted(r, def.wheel.segments.map((item, index) => [index, item.w || 1]));
  game.spins.push(segment);
  applyOutcome(r, def.wheel.segments[segment].effects);
  if (game.spins.length >= def.wheel.cost.length) finishEvent(r, def.results.done);
}

function chooseEvent(r, index) {
  const ev = r.event;
  if (!ev || ev.result) return;
  const def = eventDef(ev.id);
  let choice;
  if (def.riddle) {
    const riddle = def.riddles[ev.riddle];
    choice = index === riddle.options.length ? def.leave : riddle.options[index] ? (riddle.options[index].ok ? def.correct : def.wrong) : null;
    ev.answered = index;
  } else choice = eventChoices(r)[index];
  if (!choice || !meetsReq(r, choice.req)) return;
  ev.chosen = index;
  if (choice.act && ev.game?.kind === 'climb') { climbStep(r, def, choice.act); return; }
  if (choice.act && ev.game?.kind === 'wheel') { wheelSpin(r, def, choice.act); return; }
  if (choice.outcomes) {
    // The choice's own effects are its price, paid whatever happens next.
    applyOutcome(r, choice.effects);
    if (!r.event || r.screen !== 'event') return;
    const picked = weighted(r, choice.outcomes.map((item, i) => [i, item.w || 1]));
    ev.rolled = picked;
    resolveEventChoice(r, choice.outcomes[picked]);
    return;
  }
  if (choice.branch) {
    applyOutcome(r, choice.effects);
    if (!r.event || r.screen !== 'event') return;
    resolveEventChoice(r, ev.flags?.[choice.branch.flag] ? choice.branch.yes : choice.branch.no);
    return;
  }
  resolveEventChoice(r, choice);
}

// The memory and listening games are played on screen; the score they send
// back picks the reward, and the words go into the run's word list.
function finishWordGame(r, score, words = []) {
  const ev = r.event;
  if (!ev || ev.result || !['memory', 'echo'].includes(ev.game?.kind)) return;
  const def = eventDef(ev.id);
  const tier = [...(def.rewards || [])].sort((a, b) => b.min - a.min).find(item => score >= item.min);
  ev.game.score = score;
  words.filter(item => item?.w).forEach(item => {
    r.stats.words = [...r.stats.words.filter(entry => entry.w !== item.w), { w: item.w, m: item.m, ok: Boolean(item.ok) }].slice(-60);
  });
  if (tier) applyOutcome(r, tier.effects);
  finishEvent(r, tier?.result);
}

export const duelOutcome = (you, foe) => (you === foe ? 'draw' : DUEL_MOVES[you].beats === foe ? 'win' : 'lose');

function duelRound(r, move) {
  const ev = r.event;
  if (!ev || ev.result || ev.game?.kind !== 'duel' || !DUEL_MOVES[move]) return;
  const game = ev.game;
  game.rounds ||= [];
  game.you ||= 0;
  game.foe ||= 0;
  const foe = pick(r, Object.keys(DUEL_MOVES));
  const outcome = duelOutcome(move, foe);
  if (outcome === 'win') game.you += 1;
  if (outcome === 'lose') game.foe += 1;
  game.rounds.push({ you: move, foe, outcome });
  const def = eventDef(ev.id);
  // First to two; after seven rounds of stalemate the knight calls it a draw.
  if (game.you >= 2 || game.foe >= 2 || game.rounds.length >= 7) {
    const won = game.you > game.foe;
    const tie = game.you === game.foe;
    if (tie) applyOutcome(r, [{ op: 'gold', v: 30 }]);
    else applyOutcome(r, (won ? def.rewards.win : def.rewards.lose).effects);
    finishEvent(r, tie ? { en: '"A worthy match. Let us call it even."', zh: '「勢均力敵。這局就算平手吧。」' } : (won ? def.rewards.win : def.rewards.lose).result);
  }
}

function pickCard(r, uid) {
  const pending = r.pending;
  const card = r.hero.deck.find(item => item.uid === uid);
  if (!pending || !card) return;
  if (pending.kind === 'upgrade') {
    if (!canUpgrade(card)) return;
    card.up = true;
    if (pending.source === 'rest') { r.rest.done = true; r.rest.upgraded = card.id; }
    if (r.event) r.event.gains.push({ type: 'upgrade', id: card.id });
  }
  if (pending.kind === 'remove') {
    if (pending.source === 'shop') {
      if (r.hero.gold < r.removeCost) return;
      r.hero.gold -= r.removeCost;
      r.removeCost += 25;
      r.shop.removed = true;
    }
    r.hero.deck = r.hero.deck.filter(item => item.uid !== uid);
    if (r.event) r.event.gains.push({ type: 'removed', id: card.id });
  }
  if (pending.kind === 'duplicate') {
    const copy = addCard(r, card.id, card.up);
    if (r.event) r.event.gains.push({ type: 'card', id: copy.id });
  }
  if (pending.kind === 'transform') {
    // Leans towards better cards: the ashes rarely give back a common.
    const pool = cardPool(r).filter(id => id !== card.id);
    const rarity = weighted(r, [['common', 25], ['uncommon', 45], ['rare', 25], ['mythic', 5]].filter(([tier]) => pool.some(id => CARDS[id].rarity === tier)));
    const id = pick(r, pool.filter(item => CARDS[item].rarity === rarity));
    r.hero.deck = r.hero.deck.filter(item => item.uid !== uid);
    if (id) addCard(r, id);
    if (r.event) { r.event.gains.push({ type: 'removed', id: card.id }); if (id) r.event.gains.push({ type: 'card', id }); }
  }
  r.pending = null;
}

// ───────────── Reducer ─────────────
export function runReducer(state, action) {
  if (action.type === 'LOAD') return action.run;
  if (action.type === 'NEW_RUN') return createRun(action);
  if (action.type === 'CLEAR') return null;
  if (!state) return state;
  const r = clone(state);
  if (r.combat) r.combat.fx = [];
  switch (action.type) {
    case 'ACK_ACT': r.actIntro = false; break;
    case 'MAP_SELECT': enterNode(r, action.id); break;
    case 'PLAY_CARD': if (!playCard(r, action.uid, action.target, action.chant)) return state; break;
    case 'USE_POTION': if (!usePotion(r, action.slot, action.target)) return state; break;
    case 'DISCARD_POTION': r.hero.potions[action.slot] = null; break;
    case 'END_TURN': endTurn(r); break;
    case 'ENEMY_STEP': enemyStep(r); break;
    case 'FINISH_COMBAT':
      if (r.combat?.phase === 'won') { r.reward = r.combat.reward; r.combat = null; r.screen = 'reward'; }
      else if (r.combat?.phase === 'lost') r.screen = 'defeat';
      break;
    case 'TAKE_REWARD': takeReward(r, action.index, action.choice); break;
    case 'LEAVE_REWARD': leaveReward(r); break;
    case 'BOSS_RELIC': if (action.id && r.bossRelics?.includes(action.id)) gainRelic(r, action.id); nextAct(r); break;
    case 'REST_HEAL': if (r.rest && !r.rest.done) { const before = r.hero.hp; r.hero.hp = Math.min(r.hero.maxHp, r.hero.hp + restHealAmount(r)); r.rest.healed = r.hero.hp - before; r.rest.done = true; } break;
    case 'REST_UPGRADE': if (r.rest && !r.rest.done && r.hero.deck.some(canUpgrade)) r.pending = { kind: 'upgrade', cancellable: true, source: 'rest' }; break;
    case 'REST_KEY': if (r.rest && !r.rest.done && r.keys && !r.keys.flame && r.act <= 3) { r.keys.flame = true; r.rest.done = true; r.rest.key = true; } break;
    case 'SHOP_BUY': shopBuy(r, action.kind, action.index); break;
    case 'SHOP_REMOVE': if (r.shop && !r.shop.removed && r.hero.gold >= r.removeCost) r.pending = { kind: 'remove', cancellable: true, source: 'shop' }; break;
    case 'PICK_CARD': pickCard(r, action.uid); break;
    case 'CHOOSE_CARD': if (!chooseCard(r, action.uid)) return state; break;
    case 'CANCEL_PICK': if (r.pending?.cancellable) r.pending = null; break;
    case 'OPEN_CHEST':
      if (r.treasure && !r.treasure.opened) {
        r.treasure.opened = true;
        const id = randomRelic(r);
        const items = [{ kind: 'gold', amount: randInt(r, 25, 45), taken: false }, ...(id ? [{ kind: 'relic', id, taken: false }] : [])];
        if (r.keys && !r.keys.page && r.act <= 3) {
          const relicIndex = items.findIndex(item => item.kind === 'relic');
          items.push({ kind: 'key', key: 'page', taken: false, ...(relicIndex >= 0 ? { or: relicIndex } : {}) });
          if (relicIndex >= 0) items[relicIndex].or = items.length - 1;
        }
        r.reward = { kind: 'treasure', items, after: 'map' };
        r.screen = 'reward';
      }
      break;
    case 'EVENT_CHOOSE': chooseEvent(r, action.index); break;
    case 'EVENT_GAME': finishWordGame(r, Math.max(0, Math.floor(action.score) || 0), action.words); break;
    case 'EVENT_DUEL': duelRound(r, action.move); break;
    case 'EVENT_CONTINUE': if (r.event?.result && !r.pending) { r.event = null; r.screen = 'map'; } break;
    case 'LEAVE_ROOM': if (!r.pending) { r.shop = null; r.rest = null; r.treasure = null; r.screen = 'map'; } break;
    default: return state;
  }
  return r;
}
