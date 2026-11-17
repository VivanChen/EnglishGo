import { CARDS, CHANT_CARDS, REWARD_POOL, STARTER_DECK, baseCost, cardFades, val } from '../data/cards.js';
import { ENCOUNTERS, ENEMIES } from '../data/enemies.js';
import { EVENTS, KEEPER } from '../data/events.js';
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

// ───────────── Run setup ─────────────
function addCard(r, id, up = false) {
  const card = { uid: `c${++r.uid}`, id, up };
  r.hero.deck.push(card);
  return card;
}

export function createRun({ seed = makeSeed(), difficulty = 'standard', lv = 'elementary' } = {}) {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.standard;
  const r = {
    version: SAVE_VERSION, seed, rng: seed >>> 0, difficulty: DIFFICULTIES[difficulty] ? difficulty : 'standard', lv,
    act: 1, floor: 0, uid: 0, attacks: 0, fights: 0, actFights: 0, removeCost: 75, potionChance: 40,
    hero: { hp: diff.heroHp, maxHp: diff.heroHp, gold: 99, deck: [], relics: ['inkwell'], potions: [null, null, null], flags: {} },
    map: null, pos: null, path: [], screen: 'event', actIntro: true,
    combat: null, reward: null, shop: null, rest: null, treasure: null, bossRelics: null, pending: null,
    event: { id: 'keeper', result: null, gains: [] }, seenEvents: [], lastEncounter: null,
    stats: { kills: 0, elites: 0, bosses: 0, chants: 0, chantsOk: 0, words: [], damage: 0, cards: 0, floors: 0 },
  };
  STARTER_DECK.forEach(id => addCard(r, id));
  r.map = generateMap(r, 1);
  return r;
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

function hurtEnemy(r, enemy, amount, kind = 'hit') {
  if (enemy.dead) return 0;
  let blocked = 0;
  if (kind !== 'burn' && enemy.ward > 0) { blocked = Math.min(enemy.ward, amount); enemy.ward -= blocked; }
  const loss = Math.min(enemy.hp, amount - blocked);
  enemy.hp -= loss;
  r.stats.damage += loss;
  fx(r, { kind, to: enemy.uid, amount: amount - blocked, blocked });
  if (enemy.hp <= 0) {
    enemy.dead = true; enemy.ward = 0; enemy.hp = 0;
    r.stats.kills += 1;
    fx(r, { kind: 'death', to: enemy.uid });
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
  return loss;
}

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
    c.hand.push(c.draw.shift());
    drawn += 1;
  }
  if (drawn) fx(r, { kind: 'draw', amount: drawn });
}

export function cardCost(r, inst) {
  const card = CARDS[inst.id];
  const cost = baseCost(card, inst.up);
  if (typeof cost !== 'number') return cost;
  return card.chant && hasRelic(r, 'sageEye') ? Math.max(0, cost - 1) : cost;
}

export function canPlay(r, uid) {
  const c = r.combat;
  if (!c || c.phase !== 'player' || !c.hand.includes(uid)) return false;
  const cost = cardCost(r, c.cards[uid]);
  if (cost === null) return false;
  return cost === 'X' || cost <= c.energy;
}

export function moveBase(r, enemy, moveId = enemy.move) {
  const move = ENEMIES[enemy.id].moves[moveId];
  if (!move || move.dmg == null) return null;
  return Math.round((move.dmg + (move.grow || 0) * (enemy.uses[moveId] || 0)) * DIFFICULTIES[r.difficulty].dmg);
}

export function intentOf(r, enemy) {
  const move = ENEMIES[enemy.id].moves[enemy.move];
  if (!move || enemy.dead) return null;
  const kinds = [];
  let dmg = null;
  if (move.dmg != null) { dmg = computeAttack(moveBase(r, enemy), enemy.st, r.combat.player.st); kinds.push('attack'); }
  if (move.ward || move.allyWard) kinds.push('defend');
  if (move.might || move.heal) kinds.push('buff');
  if (move.weak || move.exposed || move.frail || move.burn || move.cards) kinds.push('debuff');
  return { id: enemy.move, move, kinds, dmg, hits: move.hits || 1 };
}

function planMove(r, enemy) {
  enemy.move = ENEMIES[enemy.id].next(enemy, rnd(r));
}

function spawnEnemy(r, id, index) {
  const def = ENEMIES[id], diff = DIFFICULTIES[r.difficulty];
  const hp = Math.max(1, Math.round(randInt(r, def.hp[0], def.hp[1]) * diff.hp));
  return { uid: `e${index}`, id, hp, maxHp: hp, ward: 0, st: { ...(def.start || {}) }, move: null, history: [], uses: {}, turns: 0, dead: false };
}

function startCombat(r, kind, encounter) {
  const cards = {};
  r.hero.deck.forEach(card => { cards[card.uid] = { ...card }; });
  const bonus = r.hero.relics.filter(id => ENERGY_RELICS.includes(id)).length;
  r.fights += 1;
  const c = r.combat = {
    id: r.fights, kind, round: 0, energy: 0, maxEnergy: 3 + bonus, cards, tmp: 0,
    draw: shuffle(r, Object.keys(cards)), hand: [], discard: [], faded: [],
    player: { ward: 0, st: {}, pw: {} },
    enemies: encounter.map((id, index) => spawnEnemy(r, id, index)),
    echo: 0, mirror: hasRelic(r, 'mirrorShard'), phase: 'player', queue: [], fx: [], fxSeq: 0, reward: null,
  };
  r.screen = 'combat';
  if (hasRelic(r, 'whetstone')) add(c.player.st, 'might', 1);
  if (hasRelic(r, 'thornRing')) add(c.player.st, 'spikes', 3);
  if (hasRelic(r, 'redThread')) heal(r, 3);
  if (hasRelic(r, 'emberStone')) living(c).forEach(enemy => add(enemy.st, 'burn', 3));
  if (hasRelic(r, 'crownOfEchoes')) living(c).forEach(enemy => add(enemy.st, 'might', 1));
  if (hasRelic(r, 'grandCodex')) for (let i = 0; i < 2; i++) c.draw.splice(randInt(r, 0, c.draw.length), 0, makeTemp(r, 'smudge'));
  living(c).forEach(enemy => planMove(r, enemy));
  startPlayerTurn(r);
}

function startPlayerTurn(r) {
  const c = r.combat;
  c.round += 1;
  c.phase = 'player';
  c.player.ward = 0;
  c.energy = c.maxEnergy;
  if (c.round === 1 && hasRelic(r, 'lantern')) c.energy += 1;
  if (c.round % 3 === 0 && hasRelic(r, 'hourglass')) c.energy += 1;
  if (c.player.st.burn) { hurtPlayer(r, c.player.st.burn, 'burn'); add(c.player.st, 'burn', -1); }
  if (c.player.pw.wildfire) living(c).forEach(enemy => add(enemy.st, 'burn', c.player.pw.wildfire));
  if (c.player.pw.ascend) add(c.player.st, 'might', c.player.pw.ascend);
  if (c.round === 1 && hasRelic(r, 'anchor')) gainWard(r, 10, false);
  const count = 5 + (c.player.pw.clarity || 0) + (hasRelic(r, 'runeHeart') ? 1 : 0) + (c.round === 1 && hasRelic(r, 'bookmark') ? 2 : 0);
  drawCards(r, count);
  fx(r, { kind: 'turn', round: c.round });
  settle(r);
}

const TARGETED = new Set(['damageWard', 'doubleBurn', 'stripWard', 'ifExposed']);
function resolve(r, effects, up, target, ctx) {
  const c = r.combat;
  for (const effect of effects) {
    const v = val(effect.v, up);
    const single = TARGETED.has(effect.op) || (effect.op === 'damage' && !effect.all && !effect.random) || (effect.op === 'debuff' && !effect.all);
    if (single && (!target || target.dead)) continue;
    switch (effect.op) {
      case 'damage': {
        const hits = effect.hits === 'X' ? ctx.x : val(effect.hits || 1, up);
        for (let i = 0; i < hits; i++) {
          const pool = living(c);
          if (!pool.length) break;
          const targets = effect.all ? pool : effect.random ? [pick(r, pool)] : [target];
          targets.forEach(enemy => attackEnemy(r, enemy, v, ctx.mult));
        }
        if (effect.onKill && target?.dead) {
          const gain = val(effect.onKill, up);
          r.hero.maxHp += gain; r.hero.hp += gain;
          fx(r, { kind: 'maxhp', to: 'player', amount: gain });
        }
        break;
      }
      case 'damageWard': attackEnemy(r, target, c.player.ward, ctx.mult); break;
      case 'ward': gainWard(r, v); break;
      case 'draw': drawCards(r, v); break;
      case 'energy': c.energy += v; fx(r, { kind: 'energy', amount: v }); break;
      case 'debuff': (effect.all ? living(c) : [target]).forEach(enemy => { add(enemy.st, effect.st, v); fx(r, { kind: 'status', to: enemy.uid, st: effect.st }); }); break;
      case 'buff': add(c.player.st, effect.st, v); fx(r, { kind: 'buff', to: 'player', st: effect.st }); break;
      case 'heal': heal(r, v); break;
      case 'loseHp': hurtPlayer(r, v, 'loss'); break;
      case 'selfWeak': add(c.player.st, 'weak', v); break;
      case 'doubleWard': gainWard(r, c.player.ward, false); break;
      case 'doubleBurn': if (target.st.burn) { add(target.st, 'burn', target.st.burn); fx(r, { kind: 'status', to: target.uid, st: 'burn' }); } break;
      case 'stripWard': target.ward = 0; break;
      case 'echo': c.echo += v; break;
      case 'power': add(c.player.pw, effect.id, v); fx(r, { kind: 'buff', to: 'player', st: effect.id }); break;
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
  let empowered = false;
  if (card.chant && chant?.word) {
    r.stats.chants += 1;
    if (chant.ok) r.stats.chantsOk += 1;
    r.stats.words = [...r.stats.words.filter(item => item.w !== chant.word), { w: chant.word, m: chant.meaning, ok: Boolean(chant.ok) }].slice(-60);
    empowered = Boolean(chant.ok);
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
  for (let i = 0; i < repeats; i++) {
    if (!living(c).length) break;
    if (card.target === 'enemy' && (!target || target.dead)) target = pick(r, living(c));
    if (i > 0) fx(r, { kind: 'echo' });
    resolve(r, effects, inst.up, target, { x, mult });
  }
  if (empowered) {
    if (hasRelic(r, 'goldenQuill')) drawCards(r, 1);
    if (hasRelic(r, 'sageEye')) heal(r, 2);
    if (c.player.pw.scholar) { c.energy += c.player.pw.scholar; fx(r, { kind: 'energy', amount: c.player.pw.scholar }); }
  }
  if (card.type === 'skill' && c.player.pw.resonance && living(c).length) hurtEnemy(r, pick(r, living(c)), c.player.pw.resonance);
  if (card.type !== 'power') (cardFades(card, inst.up) ? c.faded : c.discard).push(uid);
  settle(r);
  return true;
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
  if (c.phase !== 'player') return false;
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
  if (!c || c.phase !== 'player') return;
  for (const uid of [...c.hand]) {
    const inst = c.cards[uid], card = CARDS[inst.id];
    if (card.endTurn) resolve(r, card.endTurn, inst.up, null, {});
    (card.fleeting ? c.faded : c.discard).push(uid);
  }
  c.hand = [];
  if (c.player.pw.stoneheart) gainWard(r, c.player.pw.stoneheart, false);
  if (hasRelic(r, 'owlFeather') && c.player.ward === 0) gainWard(r, 6, false);
  decay(c.player.st);
  c.echo = 0;
  c.phase = 'enemy';
  c.queue = living(c).map(enemy => enemy.uid);
  settle(r);
}

function performMove(r, enemy) {
  const c = r.combat, move = ENEMIES[enemy.id].moves[enemy.move], diff = DIFFICULTIES[r.difficulty];
  fx(r, { kind: 'act', from: enemy.uid, move: enemy.move });
  if (move.dmg != null) {
    const base = moveBase(r, enemy);
    for (let i = 0; i < (move.hits || 1) && r.hero.hp > 0 && !enemy.dead; i++) {
      hurtPlayer(r, computeAttack(base, enemy.st, c.player.st));
      if (c.player.st.spikes) hurtEnemy(r, enemy, c.player.st.spikes, 'thorns');
    }
  }
  if (!enemy.dead) {
    if (move.ward) { const amount = Math.round(move.ward * diff.ward); enemy.ward += amount; fx(r, { kind: 'ward', to: enemy.uid, amount }); }
    if (move.allyWard) living(c).forEach(ally => { const amount = Math.round(move.allyWard * diff.ward); ally.ward += amount; fx(r, { kind: 'ward', to: ally.uid, amount }); });
    if (move.might) { add(enemy.st, 'might', move.might); fx(r, { kind: 'buff', to: enemy.uid, st: 'might' }); }
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
    enemy.ward = 0;
    if (enemy.st.burn) { hurtEnemy(r, enemy, enemy.st.burn, 'burn'); add(enemy.st, 'burn', -1); }
    if (!enemy.dead) {
      performMove(r, enemy);
      enemy.turns += 1;
      decay(enemy.st);
      if (enemy.st.ritual && !enemy.dead) add(enemy.st, 'might', enemy.st.ritual);
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
function rollRarity(r, kind) {
  if (kind === 'boss') return 'rare';
  return weighted(r, kind === 'elite' ? [['common', 45], ['uncommon', 40], ['rare', 15]] : [['common', 60], ['uncommon', 34], ['rare', 6]]);
}

export function cardOptions(r, kind, count, rarity) {
  const options = [];
  let guard = 0;
  while (options.length < count && guard++ < 200) {
    const wanted = rarity || rollRarity(r, kind);
    const pool = REWARD_POOL.filter(id => CARDS[id].rarity === wanted && !options.includes(id));
    if (pool.length) options.push(pick(r, pool));
  }
  return options;
}

export function randomRelic(r, tier) {
  const owned = new Set(r.hero.relics);
  const wanted = tier || weighted(r, [['common', 50], ['uncommon', 33], ['rare', 17]]);
  let pool = Object.keys(RELICS).filter(id => RELICS[id].tier === wanted && !owned.has(id));
  if (!pool.length) pool = Object.keys(RELICS).filter(id => ['common', 'uncommon', 'rare'].includes(RELICS[id].tier) && !owned.has(id));
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
  const items = [{ kind: 'gold', amount: Math.round(randInt(r, low, high) * diff.gold), taken: false }];
  if (kind !== 'boss') {
    if (randInt(r, 1, 100) <= r.potionChance) { items.push({ kind: 'potion', id: pick(r, Object.keys(POTIONS)), taken: false }); r.potionChance = Math.max(10, r.potionChance - 10); }
    else r.potionChance = Math.min(80, r.potionChance + 10);
  }
  if (kind === 'elite') { const id = randomRelic(r); if (id) items.push({ kind: 'relic', id, taken: false }); }
  items.push({ kind: 'cards', options: cardOptions(r, kind, 3 + (hasRelic(r, 'starChart') ? 1 : 0)), taken: false });
  return { kind, items, after: kind === 'boss' ? 'boss' : 'map' };
}

function takeReward(r, index, choice) {
  const item = r.reward?.items[index];
  if (!item || item.taken) return;
  if (item.kind === 'gold') { r.hero.gold += item.amount; item.taken = true; }
  if (item.kind === 'potion' && gainPotion(r, item.id)) item.taken = true;
  if (item.kind === 'relic') { gainRelic(r, item.id); item.taken = true; }
  if (item.kind === 'cards') {
    if (choice != null && item.options[choice]) { addCard(r, item.options[choice]); item.chosen = item.options[choice]; }
    item.taken = true;
  }
}

function leaveReward(r) {
  const after = r.reward?.after;
  r.reward = null;
  if (after === 'boss') {
    r.bossRelics = shuffle(r, Object.keys(RELICS).filter(id => RELICS[id].tier === 'boss' && !hasRelic(r, id))).slice(0, 3);
    r.screen = 'bossRelic';
  } else r.screen = 'map';
}

function nextAct(r) {
  r.bossRelics = null;
  if (r.act >= 3) { r.screen = 'victory'; return; }
  r.act += 1;
  r.map = generateMap(r, r.act);
  r.pos = null; r.path = []; r.actFights = 0; r.lastEncounter = null;
  r.hero.hp = Math.min(r.hero.maxHp, r.hero.hp + Math.round((r.hero.maxHp - r.hero.hp) * 0.75));
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

function startEvent(r) {
  const pool = Object.keys(EVENTS).filter(id => EVENTS[id].acts.includes(r.act) && !r.seenEvents.includes(id));
  if (!pool.length) { startCombat(r, 'monster', pickEncounter(r, 'monster')); return; }
  const id = pick(r, pool);
  r.seenEvents.push(id);
  r.event = { id, result: null, gains: [], riddle: EVENTS[id].riddle ? randInt(r, 0, EVENTS[id].riddles.length - 1) : null };
  r.screen = 'event';
}

function makeShop(r) {
  const price = rarity => ({ common: randInt(r, 45, 55), uncommon: randInt(r, 68, 82), rare: randInt(r, 135, 160) })[rarity];
  const chosen = [];
  const cards = ['attack', 'attack', 'skill', 'skill', 'power'].map(type => {
    const rarity = type === 'power' ? weighted(r, [['uncommon', 75], ['rare', 25]]) : weighted(r, [['common', 55], ['uncommon', 35], ['rare', 10]]);
    let pool = REWARD_POOL.filter(id => CARDS[id].type === type && CARDS[id].rarity === rarity && !chosen.includes(id));
    if (!pool.length) pool = REWARD_POOL.filter(id => CARDS[id].type === type && !chosen.includes(id));
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
    if (id && !relics.some(item => item.id === id)) relics.push({ id, price: { common: randInt(r, 140, 160), uncommon: randInt(r, 195, 225), rare: randInt(r, 255, 285) }[RELICS[id].tier], sold: false });
  }
  const potions = [0, 1, 2].map(() => ({ id: pick(r, Object.keys(POTIONS)), price: randInt(r, 48, 72), sold: false }));
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
    case 'elite': startCombat(r, 'elite', pickEncounter(r, 'elite')); break;
    case 'boss': startCombat(r, 'boss', ENCOUNTERS[r.act].boss); break;
    case 'event': startEvent(r); break;
    case 'rest': r.rest = { done: false, healed: 0, upgraded: null }; r.screen = 'rest'; break;
    case 'shop': r.shop = makeShop(r); r.screen = 'shop'; break;
    case 'treasure': r.treasure = { opened: false }; r.screen = 'treasure'; break;
    default: break;
  }
}

export const restHealAmount = r => (hasRelic(r, 'midnightOil') ? 0 : Math.round(r.hero.maxHp * 0.3) + (hasRelic(r, 'teaSet') ? 15 : 0));

// ───────────── Events ─────────────
export const meetsReq = (r, req) => !req || ((req.gold == null || r.hero.gold >= req.gold) && (req.hp == null || r.hero.hp >= req.hp));

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
      case 'potion': { const id = pick(r, Object.keys(POTIONS)); if (gainPotion(r, id)) gains.push({ type: 'potion', id }); break; }
      case 'chantCard': { const id = pick(r, CHANT_CARDS.filter(card => CARDS[card].rarity !== 'starter')); addCard(r, id); gains.push({ type: 'card', id }); break; }
      case 'randomCard': { const id = pick(r, REWARD_POOL.filter(card => CARDS[card].rarity === effect.rarity && (!effect.type || CARDS[card].type === effect.type))); addCard(r, id); gains.push({ type: 'card', id }); break; }
      case 'upgrade': if (r.hero.deck.some(canUpgrade)) r.pending = { kind: 'upgrade', cancellable: false, source: 'event' }; break;
      case 'remove': r.pending = { kind: 'remove', cancellable: false, source: 'event' }; break;
      case 'upgradeRandom': shuffle(r, r.hero.deck.filter(canUpgrade)).slice(0, effect.v).forEach(card => { card.up = true; gains.push({ type: 'upgrade', id: card.id }); }); break;
      case 'cardChoice': r.event = null; r.reward = { kind: 'event', items: [{ kind: 'cards', options: cardOptions(r, 'monster', 3, effect.rarity), taken: false }], after: 'map' }; r.screen = 'reward'; break;
      case 'fight': r.event = null; startCombat(r, effect.kind || 'monster', effect.encounter); break;
      default: break;
    }
  }
}

export function eventChoices(r) {
  const ev = r.event, def = ev && eventDef(ev.id);
  if (!def) return [];
  if (def.riddle) {
    const riddle = def.riddles[ev.riddle];
    return [...riddle.options.map(option => ({ en: option.en, zh: option.zh, note: '' })), def.leave];
  }
  return def.choices;
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
  } else choice = def.choices[index];
  if (!choice || !meetsReq(r, choice.req)) return;
  ev.chosen = index;
  ev.result = choice.result || { en: 'You move on.', zh: '你繼續前進。' };
  applyOutcome(r, choice.effects);
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
    case 'SHOP_BUY': shopBuy(r, action.kind, action.index); break;
    case 'SHOP_REMOVE': if (r.shop && !r.shop.removed && r.hero.gold >= r.removeCost) r.pending = { kind: 'remove', cancellable: true, source: 'shop' }; break;
    case 'PICK_CARD': pickCard(r, action.uid); break;
    case 'CANCEL_PICK': if (r.pending?.cancellable) r.pending = null; break;
    case 'OPEN_CHEST':
      if (r.treasure && !r.treasure.opened) {
        r.treasure.opened = true;
        const id = randomRelic(r);
        r.reward = { kind: 'treasure', items: [{ kind: 'gold', amount: randInt(r, 25, 45), taken: false }, ...(id ? [{ kind: 'relic', id, taken: false }] : [])], after: 'map' };
        r.screen = 'reward';
      }
      break;
    case 'EVENT_CHOOSE': chooseEvent(r, action.index); break;
    case 'EVENT_CONTINUE': if (r.event?.result && !r.pending) { r.event = null; r.screen = 'map'; } break;
    case 'LEAVE_ROOM': if (!r.pending) { r.shop = null; r.rest = null; r.treasure = null; r.screen = 'map'; } break;
    default: return state;
  }
  return r;
}
