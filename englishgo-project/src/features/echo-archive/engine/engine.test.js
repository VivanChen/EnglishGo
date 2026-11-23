import { describe, expect, it } from 'vitest';
import { ARCHIVE_CARDS, CARDS, describeCard } from '../data/cards.js';
import { ENCOUNTERS, ENEMIES, bossName, bossOf } from '../data/enemies.js';
import { ENEMY_ART } from '../components/Creatures.jsx';
import { claimWelcome, emptyCollection, pullArchive, shardsForRun } from '../archive.js';
import { canUpgrade, cardOptions, createRun, canPlay, eventChoices, finishEnemyPhase, living, moveBase, restHealAmount, runReducer } from './engine.js';
import { BASE_MODS, SILENCE_LEVELS, buildMods, dailyBonus, dailyChallenge, dateKey, previousDateKey } from '../data/challenges.js';
import { HISTORY_LIMIT, addRecord, recordDeck, runRecord } from '../history.js';
import { HEROES, heroPool, heroUnlocked, inHeroPool } from '../data/heroes.js';
import { RELICS } from '../data/relics.js';
import { EVENTS } from '../data/events.js';
import { SKIP_CARD_HP, actBoss, cardCost, cardPool, deckFocus, hasAllKeys, intentOf, randomRelic } from './engine.js';
import { MAP_ROWS, TREASURE_ROW, availableNodes, generateMap } from './map.js';

const act = (run, action) => runReducer(run, action);

function toMap(seed = 7, difficulty = 'standard') {
  let run = createRun({ seed, difficulty });
  run = act(run, { type: 'EVENT_CHOOSE', index: 3 });
  return act(run, { type: 'EVENT_CONTINUE' });
}

function intoCombat(seed = 7, encounter = null) {
  let run = toMap(seed);
  run = act(run, { type: 'MAP_SELECT', id: availableNodes(run)[0] });
  if (encounter) {
    // Swap in a known enemy line-up for deterministic assertions.
    run.combat.enemies = encounter.map((id, index) => ({ uid: `e${index}`, id, hp: 40, maxHp: 40, ward: 0, st: {}, move: Object.keys(ENEMIES[id].moves)[0], history: [], uses: {}, turns: 0, dead: false }));
  }
  return run;
}

function handCard(run, id) {
  const c = run.combat;
  let uid = c.hand.find(item => c.cards[item].id === id);
  if (!uid) {
    uid = Object.keys(c.cards).find(item => c.cards[item].id === id);
    for (const pile of ['draw', 'discard']) c[pile] = c[pile].filter(item => item !== uid);
    c.hand.push(uid);
  }
  return uid;
}

describe('echo archive map', () => {
  it('builds connected maps that always reach the boss without crossing paths', () => {
    for (let seed = 1; seed < 40; seed++) {
      const map = generateMap({ rng: seed }, 1 + (seed % 3));
      const nodes = Object.values(map.nodes).filter(node => node.id !== 'boss');
      expect(nodes.some(node => node.row === 0)).toBe(true);
      nodes.forEach(node => {
        expect(node.next.length).toBeGreaterThan(0);
        if (node.row === MAP_ROWS - 1) expect(node.next).toEqual(['boss']);
        if (node.row === 0) expect(node.type).toBe('monster');
        if (node.row === TREASURE_ROW) expect(node.type).toBe('treasure');
        if (node.row === MAP_ROWS - 1) expect(node.type).toBe('rest');
        if (node.row < 2) expect(['monster', 'event']).toContain(node.type);
      });
      const edges = nodes.flatMap(node => node.next.filter(id => id !== 'boss').map(id => ({ row: node.row, from: node.col, to: map.nodes[id].col })));
      edges.forEach(a => edges.forEach(b => {
        if (a.row === b.row) expect(a.from < b.from && a.to > b.to).toBe(false);
      }));
    }
  });

  it('is deterministic for a seed', () => {
    expect(createRun({ seed: 99 }).map).toEqual(createRun({ seed: 99 }).map);
  });
});

describe('echo archive run', () => {
  it('starts with the keeper blessing and a ten card deck', () => {
    const run = createRun({ seed: 3 });
    expect(run.screen).toBe('event');
    expect(run.hero.deck).toHaveLength(10);
    expect(eventChoices(run)).toHaveLength(4);
    const next = toMap(3);
    expect(next.screen).toBe('map');
    expect(next.hero.gold).toBe(199);
  });

  it('opens the card picker when the keeper burns a page', () => {
    let run = act(createRun({ seed: 3 }), { type: 'EVENT_CHOOSE', index: 2 });
    expect(run.pending).toMatchObject({ kind: 'remove' });
    run = act(run, { type: 'PICK_CARD', uid: run.hero.deck[0].uid });
    expect(run.hero.deck).toHaveLength(9);
    run = act(run, { type: 'EVENT_CONTINUE' });
    expect(run.screen).toBe('map');
  });
});

describe('echo archive combat', () => {
  it('deals damage, blocks with ward and draws a fresh hand each turn', () => {
    let run = intoCombat(11, ['bookworm']);
    expect(run.screen).toBe('combat');
    expect(run.combat.hand).toHaveLength(5);
    const slash = handCard(run, 'slash');
    run = act(run, { type: 'PLAY_CARD', uid: slash, target: 'e0' });
    expect(run.combat.enemies[0].hp).toBe(34);
    expect(run.combat.energy).toBe(2);
    const guard = handCard(run, 'guard');
    run = act(run, { type: 'PLAY_CARD', uid: guard });
    expect(run.combat.player.ward).toBe(5);
    run.combat.enemies[0].move = 'gnaw';
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(run.hero.hp).toBe(72 - 4);
    expect(run.combat.round).toBe(2);
    expect(run.combat.player.ward).toBe(0);
    expect(run.combat.hand).toHaveLength(5);
  });

  it('empowers chant cards when the rune word is read correctly', () => {
    const base = intoCombat(12, ['bookworm']);
    base.combat.enemies[0].hp = 80;
    const uid = handCard(base, 'thunder');
    const plain = act(base, { type: 'PLAY_CARD', uid, target: 'e0', chant: { word: 'moon', meaning: '月亮', ok: false } });
    const strong = act(base, { type: 'PLAY_CARD', uid, target: 'e0', chant: { word: 'moon', meaning: '月亮', ok: true } });
    expect(80 - plain.combat.enemies[0].hp).toBe(8);
    expect(80 - strong.combat.enemies[0].hp).toBe(8 + 7);
    expect(strong.stats.chantsOk).toBe(1);
    expect(strong.stats.words[0]).toMatchObject({ w: 'moon', ok: true });
  });

  it('ticks burn, decays debuffs and refuses cards without energy', () => {
    let run = intoCombat(13, ['bookworm']);
    run.combat.enemies[0].st = { burn: 4, exposed: 1 };
    run.combat.enemies[0].move = 'burrow';
    run.combat.energy = 0;
    expect(canPlay(run, handCard(run, 'slash'))).toBe(false);
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(run.combat.enemies[0].hp).toBe(36);
    expect(run.combat.enemies[0].st).toMatchObject({ burn: 3, might: 2 });
    expect(run.combat.enemies[0].st.exposed).toBeUndefined();
  });

  it('wins the fight and offers rewards', () => {
    let run = intoCombat(14, ['inkling']);
    run.combat.enemies[0].hp = 3;
    run = act(run, { type: 'PLAY_CARD', uid: handCard(run, 'slash'), target: 'e0' });
    expect(run.combat.phase).toBe('won');
    run = act(run, { type: 'FINISH_COMBAT' });
    expect(run.screen).toBe('reward');
    const cards = run.reward.items.findIndex(item => item.kind === 'cards');
    run = act(run, { type: 'TAKE_REWARD', index: cards, choice: 0 });
    expect(run.hero.deck).toHaveLength(11);
    run = act(run, { type: 'LEAVE_REWARD' });
    expect(run.screen).toBe('map');
  });

  it('describes every card with readable text', () => {
    Object.keys(CARDS).forEach(id => {
      const lines = describeCard({ id, up: false });
      expect(lines.length).toBeGreaterThan(0);
      expect(describeCard({ id, up: true }).length).toBeGreaterThan(0);
    });
  });
});

// A greedy bot plays complete runs to make sure no room, card, enemy or
// relic combination can wedge the state machine.
function botStep(run, seedOffset) {
  switch (run.screen) {
    case 'event': {
      if (run.pending) return act(run, { type: 'PICK_CARD', uid: (run.pending.kind === 'upgrade' ? run.hero.deck.find(canUpgrade) : run.hero.deck[0]).uid });
      if (run.event?.result) return act(run, { type: 'EVENT_CONTINUE' });
      // The word games run on screen and report a score; the duel takes moves.
      if (['memory', 'echo'].includes(run.event?.game?.kind)) return act(run, { type: 'EVENT_GAME', score: seedOffset % 5, words: [{ w: 'star', m: '星星', ok: seedOffset % 2 === 0 }] });
      if (run.event?.game?.kind === 'duel') return act(run, { type: 'EVENT_DUEL', move: ['sword', 'shield', 'scroll'][seedOffset % 3] });
      const options = eventChoices(run);
      for (let i = 0; i < options.length; i++) {
        const next = act(run, { type: 'EVENT_CHOOSE', index: (i + seedOffset) % options.length });
        if (next !== run) return next;
      }
      return run;
    }
    case 'map': {
      const run2 = run.actIntro ? act(run, { type: 'ACK_ACT' }) : run;
      const options = availableNodes(run2);
      return act(run2, { type: 'MAP_SELECT', id: options[seedOffset % options.length] });
    }
    case 'combat': {
      const c = run.combat;
      if (c.phase === 'won' || c.phase === 'lost') return act(run, { type: 'FINISH_COMBAT' });
      if (c.phase === 'enemy') return act(run, { type: 'ENEMY_STEP' });
      if (c.choice) return act(run, { type: 'CHOOSE_CARD', uid: c.choice.options[seedOffset % c.choice.options.length] });
      const potion = run.hero.potions.findIndex(Boolean);
      if (potion >= 0 && c.round === 2) {
        const next = act(run, { type: 'USE_POTION', slot: potion, target: living(c)[0]?.uid });
        if (next !== run) return next;
      }
      for (const uid of c.hand) {
        if (!canPlay(run, uid)) continue;
        const next = act(run, { type: 'PLAY_CARD', uid, target: living(c)[0]?.uid, chant: CARDS[c.cards[uid].id].chant ? { word: 'star', meaning: '星星', ok: uid.length % 2 === 0 } : null });
        if (next !== run) return next;
      }
      return act(run, { type: 'END_TURN' });
    }
    case 'reward': {
      const index = run.reward.items.findIndex(item => !item.taken && (item.kind !== 'potion' || run.hero.potions.includes(null)));
      if (index >= 0) return act(run, { type: 'TAKE_REWARD', index, choice: 0 });
      return act(run, { type: 'LEAVE_REWARD' });
    }
    case 'rest':
      if (run.pending) return act(run, { type: 'PICK_CARD', uid: run.hero.deck.find(card => !card.up && ['attack', 'skill', 'power'].includes(CARDS[card.id].type)).uid });
      if (!run.rest.done) return act(run, { type: seedOffset % 2 ? 'REST_HEAL' : 'REST_UPGRADE' });
      return act(run, { type: 'LEAVE_ROOM' });
    case 'shop': {
      if (run.pending) return act(run, { type: 'PICK_CARD', uid: run.hero.deck[0].uid });
      const index = run.shop.cards.findIndex(item => !item.sold && item.price <= run.hero.gold);
      if (index >= 0) return act(run, { type: 'SHOP_BUY', kind: 'cards', index });
      return act(run, { type: 'LEAVE_ROOM' });
    }
    case 'treasure': return act(run, { type: 'OPEN_CHEST' });
    case 'bossRelic': return act(run, { type: 'BOSS_RELIC', id: run.bossRelics[0] });
    case 'route': return act(run, { type: 'CHOOSE_ROUTE', zone: run.routes[seedOffset % run.routes.length] });
    default: return run;
  }
}

describe('echo archive expansion cards', () => {
  function give(run, id, up = false) {
    const c = run.combat;
    const uid = `g${Object.keys(c.cards).length}`;
    c.cards[uid] = { uid, id, up };
    c.hand.push(uid);
    return uid;
  }
  const fresh = (seed = 21) => {
    const run = intoCombat(seed, ['bookworm']);
    run.combat.enemies[0].hp = 200; run.combat.enemies[0].maxHp = 200;
    run.combat.energy = 10;
    return run;
  };

  it('grows Combo damage with every card played this turn', () => {
    let run = fresh();
    const first = give(run, 'jab');
    run = act(run, { type: 'PLAY_CARD', uid: first, target: 'e0' });
    expect(200 - run.combat.enemies[0].hp).toBe(3);
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'insight'), target: 'e0' });
    const before = run.combat.enemies[0].hp;
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'jab'), target: 'e0' });
    expect(before - run.combat.enemies[0].hp).toBe(3 + 2 * 2);
  });

  it('detonates and spreads Burn', () => {
    let run = fresh();
    run.combat.enemies[0].st.burn = 5;
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'detonate'), target: 'e0' });
    expect(200 - run.combat.enemies[0].hp).toBe(10);
    expect(run.combat.enemies[0].st.burn).toBeUndefined();
  });

  it('keeps Brace in hand, carries Charge and holds Ward with Iron Will', () => {
    let run = fresh();
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'ironWill') });
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'chargeUp') });
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'guard') });
    const brace = give(run, 'brace');
    run.combat.enemies[0].move = 'burrow';
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(run.combat.hand).toContain(brace);
    expect(run.combat.player.ward).toBe(5);
    expect(run.combat.energy).toBe(3 + 2);
  });

  it('inscribes a Chant card permanently for the rest of the run', () => {
    let run = fresh();
    const blade = give(run, 'runeBlade');
    run.hero.deck.push({ uid: blade, id: 'runeBlade', up: false });
    run = act(run, { type: 'PLAY_CARD', uid: blade, target: 'e0', chant: { word: 'star', meaning: '星星', ok: true } });
    expect(run.hero.deck.find(card => card.uid === blade).bonus).toBe(2);
    expect(run.combat.cards[blade].bonus).toBe(2);
    run.combat.discard = run.combat.discard.filter(uid => uid !== blade);
    run.combat.hand.push(blade);
    const before = run.combat.enemies[0].hp;
    run = act(run, { type: 'PLAY_CARD', uid: blade, target: 'e0' });
    expect(before - run.combat.enemies[0].hp).toBe(8);
  });

  it('turns status cards into fuel with Absorb and Living Ink', () => {
    let run = fresh();
    run.combat.energy = 0;
    give(run, 'smudge'); give(run, 'dust');
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'absorb') });
    expect(run.combat.energy).toBe(2);
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'livingInk') });
    const smudge = give(run, 'smudge');
    expect(canPlay(run, smudge)).toBe(true);
    const handBefore = run.combat.hand.length;
    run = act(run, { type: 'PLAY_CARD', uid: smudge });
    expect(run.combat.faded).toContain(smudge);
    expect(run.combat.hand.length).toBe(handBefore);
  });

  it('pauses for a card choice and resolves Recall, Foresee, Sift and Offering', () => {
    let run = fresh();
    const slash = run.combat.hand.find(uid => run.combat.cards[uid].id === 'slash') || give(run, 'slash');
    run = act(run, { type: 'PLAY_CARD', uid: slash, target: 'e0' });
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'recall') });
    expect(run.combat.choice).toMatchObject({ from: 'discard', action: 'toHand' });
    expect(canPlay(run, run.combat.hand[0])).toBe(false);
    run = act(run, { type: 'CHOOSE_CARD', uid: slash });
    expect(run.combat.hand).toContain(slash);
    expect(run.combat.choice).toBeNull();

    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'foresee') });
    const top = run.combat.choice.options;
    expect(top).toHaveLength(Math.min(3, top.length));
    run = act(run, { type: 'CHOOSE_CARD', uid: top[0] });
    expect(run.combat.hand).toContain(top[0]);
    top.slice(1).forEach(uid => expect(run.combat.discard).toContain(uid));

    const before = run.combat.hand.length;
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'sift') });
    expect(run.combat.hand.length).toBe(before + 2);
    run = act(run, { type: 'CHOOSE_CARD', uid: run.combat.choice.options[0] });
    expect(run.combat.hand.length).toBe(before + 1);

    run.combat.energy = 0;
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'offering') });
    run = act(run, { type: 'CHOOSE_CARD', uid: run.combat.choice.options[0] });
    expect(run.combat.energy).toBe(2);
  });

  it('grows Patience while kept, upgrades with Whetblade and draws X+1 with Word Flood', () => {
    let run = fresh();
    const patience = give(run, 'patience');
    run.combat.enemies[0].move = 'burrow';
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(run.combat.cards[patience].kept).toBe(1);
    run = act(run, { type: 'PLAY_CARD', uid: patience });
    expect(run.combat.player.ward).toBe(6 + 3);

    const target = give(run, 'slash');
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'whetblade', true) });
    expect(run.combat.cards[target].up).toBe(true);

    run.combat.energy = 2;
    const hand = run.combat.hand.length;
    run = act(run, { type: 'PLAY_CARD', uid: give(run, 'wordflood') });
    expect(run.combat.hand.length).toBe(Math.min(10, hand + 3));
    expect(run.combat.energy).toBe(0);
  });

  it('only offers Archive cards that are unlocked', () => {
    const locked = createRun({ seed: 9 });
    const open = createRun({ seed: 9, unlocked: ARCHIVE_CARDS });
    const lockedSeen = new Set(), openSeen = new Set();
    for (let i = 0; i < 80; i++) {
      cardOptions(locked, 'elite', 3).forEach(id => lockedSeen.add(id));
      cardOptions(open, 'elite', 3).forEach(id => openSeen.add(id));
    }
    expect([...lockedSeen].some(id => CARDS[id].pack)).toBe(false);
    expect([...openSeen].some(id => CARDS[id].pack)).toBe(true);
  });
});

describe('archive gacha', () => {
  it('charges shards, guarantees a Rare every ten pulls and converts duplicates', () => {
    let collection = { ...emptyCollection(), shards: 10000 };
    for (let round = 0; round < 6; round++) {
      const { collection: next, results } = pullArchive(collection, 10, () => 0.01);
      expect(next.shards).toBeLessThanOrEqual(collection.shards - 180 + 10 * 25);
      expect(results.some(item => ['rare', 'mythic'].includes(item.rarity))).toBe(true);
      collection = next;
    }
    const outcomes = new Set();
    for (let i = 0; i < 40; i++) {
      const result = pullArchive(collection, 1, () => 0.01);
      result.results.forEach(item => outcomes.add(item.outcome));
      collection = result.collection;
    }
    expect(outcomes.has('foil') || outcomes.has('refund')).toBe(true);
    expect(pullArchive({ ...emptyCollection(), shards: 5 }, 1)).toBeNull();
  });

  it('guarantees a Mythic within forty pulls and rewards every run', () => {
    let collection = { ...emptyCollection(), shards: 100000 };
    let mythics = 0;
    for (let i = 0; i < 40; i++) {
      const result = pullArchive(collection, 1, () => 0.01);
      if (result.results[0].rarity === 'mythic') mythics += 1;
      collection = result.collection;
    }
    expect(mythics).toBeGreaterThan(0);
    const run = createRun({ seed: 3, difficulty: 'heroic' });
    run.stats = { ...run.stats, floors: 10, kills: 12, elites: 1, bosses: 1, chantsOk: 4 };
    run.screen = 'defeat';
    expect(shardsForRun(run).total).toBe(Math.round((20 + 12 + 8 + 25 + 8) * 1.5));
    expect(claimWelcome(emptyCollection()).shards).toBe(100);
  });
});

describe('echo archive full runs', () => {
  it.each([[7, 'story'], [8, 'standard'], [9, 'heroic']])('seed %i on %s with every Archive card unlocked finishes', (seed, difficulty) => {
    let run = createRun({ seed: seed * 7919, difficulty, unlocked: ARCHIVE_CARDS });
    let steps = 0;
    while (!['victory', 'defeat'].includes(run.screen) && steps < 8000) {
      const next = botStep(run, seed + steps);
      expect(next).not.toBe(run);
      run = next;
      steps++;
    }
    expect(['victory', 'defeat']).toContain(run.screen);
  });

  it.each([[1, 'story'], [2, 'standard'], [3, 'heroic'], [4, 'story'], [5, 'standard'], [6, 'story']])('seed %i on %s finishes without getting stuck', (seed, difficulty) => {
    let run = createRun({ seed: seed * 7919, difficulty });
    let steps = 0;
    while (!['victory', 'defeat'].includes(run.screen) && steps < 6000) {
      const next = botStep(run, seed + steps);
      expect(next).not.toBe(run);
      expect(JSON.parse(JSON.stringify(next))).toEqual(next);
      run = next;
      steps++;
    }
    expect(['victory', 'defeat']).toContain(run.screen);
    expect(run.hero.hp).toBeGreaterThanOrEqual(0);
  });

  it.each([
    ['Silence 10', () => createRun({ seed: 4242, difficulty: 'heroic', silence: 10 })],
    ['a daily challenge', () => createRun({ daily: dailyChallenge('2026-11-19') })],
    ['a cursed elite-nest daily', () => createRun({ daily: { ...dailyChallenge('2026-11-20'), blessing: 'alchemist', trial: 'eliteNest' } })],
  ])('%s run finishes without getting stuck', (name, make) => {
    let run = make();
    let steps = 0;
    while (!['victory', 'defeat'].includes(run.screen) && steps < 8000) {
      const next = botStep(run, steps);
      expect(next).not.toBe(run);
      run = next;
      steps++;
    }
    expect(['victory', 'defeat']).toContain(run.screen);
  });
});

describe('echo archive silence levels', () => {
  it('stacks every rule up to the chosen level', () => {
    expect(SILENCE_LEVELS).toHaveLength(10);
    const top = buildMods({ silence: 10 });
    expect(top).toMatchObject({ eliteHp: 1.15, bossHp: 1.12, restHeal: 0.22, actHeal: 0.4, heroHp: -6, bossMight: 1, startCurses: ['doubt'] });
    expect(top.gold).toBeCloseTo(0.8);
    expect(buildMods({ silence: 2 })).toMatchObject({ eliteHp: 1.15, monsterDmg: 1.1, restHeal: 0.3 });
    expect(buildMods()).toEqual({ ...BASE_MODS, startCurses: [] });
  });

  it('applies to Heroic runs only and changes the run from the start', () => {
    expect(createRun({ seed: 5, difficulty: 'story', silence: 6 }).silence).toBe(0);
    const base = createRun({ seed: 5, difficulty: 'heroic' });
    const run = createRun({ seed: 5, difficulty: 'heroic', silence: 10 });
    expect(run.silence).toBe(10);
    expect(run.hero.maxHp).toBe(base.hero.maxHp - 6);
    expect(run.hero.deck.map(card => card.id)).toContain('doubt');
    expect(run.removeCost).toBe(Math.round(75 * 1.15));
    expect(restHealAmount(run)).toBe(Math.round(run.hero.maxHp * 0.22));
    expect(createRun({ seed: 5, difficulty: 'heroic', silence: 99 }).silence).toBe(10);
  });

  it('scales enemy health and damage through the run mods', () => {
    const plain = toMap(11);
    const node = availableNodes(plain)[0];
    const tough = { ...plain, mods: { ...BASE_MODS, enemyHp: 2, enemyDmg: 1.5 } };
    const a = act(plain, { type: 'MAP_SELECT', id: node }).combat;
    const b = act(tough, { type: 'MAP_SELECT', id: node }).combat;
    a.enemies.forEach((enemy, index) => expect(b.enemies[index].maxHp).toBe(Math.round((enemy.maxHp / 1) * 2)));
    const attacker = a.enemies.find(enemy => moveBase(plain, enemy) != null);
    if (attacker) {
      const runA = { ...plain, combat: a }, runB = { ...tough, combat: b };
      const twin = b.enemies.find(enemy => enemy.uid === attacker.uid);
      expect(moveBase(runB, twin)).toBe(Math.round(ENEMIES[attacker.id].moves[attacker.move].dmg * 1.5));
      expect(moveBase(runA, attacker)).toBe(ENEMIES[attacker.id].moves[attacker.move].dmg);
    }
  });

  it('pays more shards per level and adds flat bonuses after the multiplier', () => {
    const run = createRun({ seed: 1, difficulty: 'heroic', silence: 3 });
    run.stats = { ...run.stats, floors: 10, kills: 10 };
    run.screen = 'defeat';
    const result = shardsForRun(run, [['bonus', 40], ['nothing', 0]]);
    expect(result.mult).toBe(1.8);
    expect(result.total).toBe(Math.round(30 * 1.8) + 40);
    expect(result.bonus).toEqual([['bonus', 40]]);
  });
});

describe('echo archive daily challenge', () => {
  it('derives the same challenge from the same date', () => {
    expect(dailyChallenge('2026-11-19')).toEqual(dailyChallenge('2026-11-19'));
    const week = Array.from({ length: 7 }, (_, i) => dailyChallenge(`2026-12-0${i + 1}`));
    expect(new Set(week.map(day => day.seed)).size).toBe(7);
    week.forEach(day => expect(CARDS[day.card].rarity).toBe('rare'));
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28');
    expect(dailyBonus(1)).toBe(30);
    expect(dailyBonus(4)).toBe(45);
    expect(dailyBonus(30)).toBe(55);
  });

  it('builds a Standard run with the daily seed, featured card, blessing and trial', () => {
    const challenge = { ...dailyChallenge('2026-11-19'), blessing: 'richRoad', trial: 'cursed' };
    const run = createRun({ daily: challenge, difficulty: 'heroic', silence: 5, seed: 1 });
    expect(run.difficulty).toBe('standard');
    expect(run.silence).toBe(0);
    expect(run.seed).toBe(challenge.seed);
    expect(run.daily).toEqual({ date: '2026-11-19', blessing: 'richRoad', trial: 'cursed', card: challenge.card, hero: challenge.hero });
    expect(run.hero.gold).toBe(249);
    const ids = run.hero.deck.map(card => card.id);
    expect(ids).toContain(challenge.card);
    expect(ids.filter(id => id === 'regret' || id === 'doubt')).toHaveLength(2);
    expect(createRun({ daily: challenge }).map).toEqual(run.map);
    const shards = shardsForRun({ ...run, screen: 'defeat', stats: { ...run.stats, floors: 5 } });
    expect(shards.mult).toBe(1.5);
  });

  it('applies combat blessings on the first turn', () => {
    const challenge = { ...dailyChallenge('2026-11-19'), blessing: 'swiftHand', trial: 'giants' };
    let run = createRun({ daily: challenge });
    run = act(run, { type: 'EVENT_CHOOSE', index: 3 });
    run = act(run, { type: 'EVENT_CONTINUE' });
    run = act(run, { type: 'MAP_SELECT', id: availableNodes(run)[0] });
    expect(run.combat.hand).toHaveLength(6);
    const spark = createRun({ daily: { ...challenge, blessing: 'spark' } });
    let next = act(act(spark, { type: 'EVENT_CHOOSE', index: 3 }), { type: 'EVENT_CONTINUE' });
    next = act(next, { type: 'MAP_SELECT', id: availableNodes(next)[0] });
    expect(next.combat.energy).toBe(4);
    const might = createRun({ daily: { ...challenge, blessing: 'sharpInk' } });
    let third = act(act(might, { type: 'EVENT_CHOOSE', index: 3 }), { type: 'EVENT_CONTINUE' });
    third = act(third, { type: 'MAP_SELECT', id: availableNodes(third)[0] });
    expect(third.combat.player.st.might).toBe(1);
  });

  it('fills potion slots and adds elite rooms', () => {
    const challenge = { ...dailyChallenge('2026-11-19'), blessing: 'alchemist', trial: 'eliteNest' };
    const run = createRun({ daily: challenge });
    expect(run.hero.potions.every(Boolean)).toBe(true);
    let plain = 0, nest = 0;
    for (let seed = 1; seed <= 30; seed++) {
      plain += Object.values(generateMap({ rng: seed }, 2).nodes).filter(node => node.type === 'elite').length;
      nest += Object.values(generateMap({ rng: seed, mods: { eliteRooms: 2.2 } }, 2).nodes).filter(node => node.type === 'elite').length;
    }
    expect(nest).toBeGreaterThan(plain * 1.4);
  });
});

describe('echo archive chronicle', () => {
  it('records how a run ended and rebuilds its deck', () => {
    let run = intoCombat(13);
    run.startedAt = 1000;
    run.hero.deck[0].up = true;
    const record = runRecord(run, 'defeat', 42, 1000 + 25 * 60000);
    expect(record).toMatchObject({ outcome: 'defeat', difficulty: 'standard', act: 1, shards: 42, minutes: 25, foeKind: 'monster' });
    expect(record.foes).toEqual([...new Set(living(run.combat).map(enemy => enemy.id))]);
    const deck = recordDeck(record);
    expect(deck).toHaveLength(run.hero.deck.length);
    expect(deck.filter(card => card.up)).toHaveLength(1);
    expect(runRecord(run, 'victory').foes).toEqual([]);
  });

  it('keeps the newest records first without duplicates', () => {
    let history = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) history = addRecord(history, { key: `k${i}`, at: i });
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0].key).toBe(`k${HISTORY_LIMIT + 4}`);
    history = addRecord(history, { key: 'k24', at: 99 });
    expect(history.filter(item => item.key === 'k24')).toHaveLength(1);
    expect(addRecord(undefined, { key: 'a' })).toEqual([{ key: 'a' }]);
  });
});

// ───────────── Wave 3: the Inkcaller, new foes, keys and the last page ─────────────
function heroCombat(hero, encounter, seed = 31) {
  let run = createRun({ seed, hero });
  run = act(run, { type: 'EVENT_CHOOSE', index: 3 });
  run = act(run, { type: 'EVENT_CONTINUE' });
  run = act(run, { type: 'MAP_SELECT', id: availableNodes(run)[0] });
  if (encounter) run.combat.enemies = encounter.map((id, index) => ({ uid: `e${index}`, id, hp: 60, maxHp: 60, ward: 0, st: {}, move: Object.keys(ENEMIES[id].moves)[0], history: [], uses: {}, turns: 0, dead: false }));
  run.combat.energy = 10;
  return run;
}
function giveCard(run, id, up = false) {
  const c = run.combat;
  const uid = `g${Object.keys(c.cards).length}`;
  c.cards[uid] = { uid, id, up };
  c.hand.push(uid);
  return uid;
}
const play = (run, id, target = 'e0', up = false) => act(run, { type: 'PLAY_CARD', uid: giveCard(run, id, up), target });

describe('echo archive heroes', () => {
  it('starts the Inkcaller with its own deck, relic, health and card pool', () => {
    const run = createRun({ seed: 2, hero: 'caller', difficulty: 'standard' });
    expect(run.hero.id).toBe('caller');
    expect(run.hero.relics).toEqual(['spiritJar']);
    expect(run.hero.maxHp).toBe(72 + HEROES.caller.hp);
    expect(run.hero.deck.map(card => card.id)).toEqual(HEROES.caller.deck);
    const pool = cardPool(run);
    expect(pool).toContain('spiritClaw');
    expect(pool).toContain('ember');
    expect(pool).not.toContain('cleave');
    expect(cardPool(createRun({ seed: 2 }))).not.toContain('spiritClaw');
    expect(heroPool('caller').filter(id => CARDS[id].hero === 'caller').length).toBeGreaterThanOrEqual(20);
    expect(inHeroPool('legion', 'scribe')).toBe(false);
    expect(createRun({ seed: 2, hero: 'nobody' }).hero.id).toBe('scribe');
    expect(heroUnlocked('caller', { bestAct: 1 })).toBe(false);
    expect(heroUnlocked('caller', { bestAct: 2 })).toBe(true);
  });

  it('keeps hero-only relics out of the other hero\'s runs', () => {
    const callerOnly = Object.keys(RELICS).filter(id => RELICS[id].hero === 'caller' && RELICS[id].tier !== 'starter');
    const scribe = createRun({ seed: 3 });
    const caller = createRun({ seed: 3, hero: 'caller' });
    const seen = { scribe: new Set(), caller: new Set() };
    for (let i = 0; i < 300; i++) {
      seen.scribe.add(randomRelic(scribe));
      seen.caller.add(randomRelic(caller));
    }
    callerOnly.forEach(id => { expect(seen.scribe.has(id)).toBe(false); expect(seen.caller.has(id)).toBe(true); });
  });
});

describe('echo archive familiar', () => {
  it('starts with Spirit Jar stacks, grows when fed and bites the weakest enemy at end of turn', () => {
    let run = heroCombat('caller', ['bookworm', 'inkling']);
    expect(run.combat.player.familiar).toBe(2);
    run.combat.enemies[1].hp = 20;
    run = play(run, 'summonSpirit');
    expect(run.combat.player.familiar).toBe(5);
    run = act(run, { type: 'END_TURN' });
    expect(run.combat.enemies[1].hp).toBe(20 - 5);
    expect(run.combat.enemies[0].hp).toBe(60);
    expect(run.combat.player.familiar).toBe(4);
  });

  it('resolves the familiar cards', () => {
    let run = heroCombat('caller', ['bookworm']);
    run.combat.player.familiar = 8;
    run = play(run, 'command');
    expect(run.combat.enemies[0].hp).toBe(60 - 8);
    run = play(run, 'devourInk');
    expect(run.combat.player.familiar).toBe(4);
    expect(run.combat.enemies[0].hp).toBe(60 - 8 - 4 * 2);
    run = play(run, 'inkLance');
    expect(run.combat.enemies[0].hp).toBe(60 - 8 - 8 - (9 + 4));
    run = play(run, 'unboundSpirit');
    expect(run.combat.player.familiar).toBe(8);
    run = play(run, 'shadowGuard');
    expect(run.combat.player.ward).toBe(3 + 8);
    run = play(run, 'kindredFlame');
    expect(run.combat.enemies[0].st.burn).toBe(4);
    run = play(run, 'lastLight');
    expect(run.combat.player.familiar).toBe(0);
  });

  it('powers up the familiar with Bond, Ember Spirit, Legion, Twin Spirit and Ink Sovereign', () => {
    let run = heroCombat('caller', ['bookworm', 'inkling']);
    run.combat.enemies.forEach(enemy => { enemy.hp = 200; enemy.maxHp = 200; });
    run.combat.player.familiar = 5;
    ['bond', 'emberSpirit', 'twinSpirit', 'inkSovereign', 'legion'].forEach(id => { run.combat.energy = 10; run = play(run, id); });
    run.combat.energy = 10;
    run = play(run, 'spiritClaw');
    expect(run.combat.player.familiar).toBe(5 + 1 + 1);
    run.combat.player.ward = 0;
    run = act(run, { type: 'END_TURN' });
    run.combat.enemies.forEach(enemy => expect(enemy.hp).toBeLessThanOrEqual(200 - 7 * 2));
    run.combat.enemies.forEach(enemy => expect(enemy.st.burn).toBeGreaterThanOrEqual(2));
    finishEnemyPhase(run);
    expect(run.combat.player.familiar).toBe(7 - 1 + 2);
  });

  it('unleashes X times with Ink Storm and scales Swarm hits', () => {
    let run = heroCombat('caller', ['bookworm']);
    run.combat.player.familiar = 3;
    run.combat.energy = 3;
    run = play(run, 'inkStorm');
    expect(run.combat.enemies[0].hp).toBe(60 - 9);
    expect(run.combat.energy).toBe(0);
    run.combat.energy = 5;
    run.combat.player.familiar = 6;
    const before = run.combat.enemies[0].hp;
    run = play(run, 'swarm');
    expect(before - run.combat.enemies[0].hp).toBe(3 * 3);
  });
});

describe('echo archive new foes', () => {
  it('lets enemies summon allies up to four and heal themselves', () => {
    let run = heroCombat('scribe', ['inkweaver']);
    run.combat.enemies[0].move = 'brood';
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(run.combat.enemies.map(enemy => enemy.id)).toEqual(['inkweaver', 'inkling']);
    expect(new Set(run.combat.enemies.map(enemy => enemy.uid)).size).toBe(2);
    expect(run.combat.enemies[1].move).toBeTruthy();
    for (let i = 0; i < 5; i++) {
      run.combat.enemies.filter(enemy => enemy.id === 'inkweaver').forEach(enemy => { enemy.move = 'brood'; });
      run.combat.enemies.filter(enemy => enemy.id === 'inkling').forEach(enemy => { enemy.move = 'smear'; });
      run.hero.hp = 70;
      run = act(run, { type: 'END_TURN' });
      finishEnemyPhase(run);
    }
    expect(living(run.combat).length).toBe(4);
    let slick = heroCombat('scribe', ['oilSlick']);
    slick.combat.enemies[0].hp = 40;
    slick.combat.enemies[0].move = 'ooze';
    slick = act(slick, { type: 'END_TURN' });
    finishEnemyPhase(slick);
    expect(slick.combat.enemies[0].hp).toBe(46);
  });

  it('gives every new enemy working moves and art', () => {
    ['candleImp', 'ribbonSerpent', 'inkweaver', 'springJack', 'oilSlick', 'duelist', 'muteBell', 'forgottenScribe', 'choir', 'gatekeeper', 'lastSilence'].forEach(id => {
      const def = ENEMIES[id];
      const enemy = { hp: def.hp[0], maxHp: def.hp[0], turns: 0, history: [], uses: {} };
      for (let turn = 0; turn < 12; turn++) {
        enemy.turns = turn;
        const move = def.next(enemy, (turn * 0.37) % 1);
        expect(def.moves[move], `${id} turn ${turn}`).toBeTruthy();
      }
    });
    const boss = ENEMIES.lastSilence;
    expect(boss.next({ hp: 380, maxHp: 380, turns: 4, history: [], uses: {} })).toBe('oblivion');
    expect(boss.next({ hp: 100, maxHp: 380, turns: 0, history: [], uses: {} })).toBe('lastWord');
  });
});

describe('echo archive keys and the last page', () => {
  it('marks one echoing elite per map in the first three acts', () => {
    for (let seed = 1; seed < 20; seed++) {
      const run = createRun({ seed });
      expect(Object.values(run.map.nodes).filter(node => node.echo)).toHaveLength(1);
      expect(Object.values(run.map.nodes).find(node => node.echo).type).toBe('elite');
    }
  });

  it('trades rest, relic or echo elite for the three keys', () => {
    let run = toMap(41);
    run.screen = 'rest'; run.rest = { done: false };
    run = act(run, { type: 'REST_KEY' });
    expect(run.keys.flame).toBe(true);
    expect(run.rest).toMatchObject({ done: true, key: true });

    run.screen = 'treasure'; run.treasure = { opened: false }; run.rest = null;
    run = act(run, { type: 'OPEN_CHEST' });
    const keyIndex = run.reward.items.findIndex(item => item.kind === 'key');
    const relicIndex = run.reward.items.findIndex(item => item.kind === 'relic');
    expect(run.reward.items[keyIndex].key).toBe('page');
    const relics = run.hero.relics.length;
    run = act(run, { type: 'TAKE_REWARD', index: keyIndex });
    expect(run.keys.page).toBe(true);
    expect(run.reward.items[relicIndex]).toMatchObject({ taken: true, skipped: true });
    expect(run.hero.relics).toHaveLength(relics);

    let fight = toMap(42);
    const echoNode = Object.values(fight.map.nodes).find(node => node.echo);
    fight.screen = 'map';
    fight.pos = null;
    fight.map.nodes[echoNode.id].row = 0;
    fight = act(fight, { type: 'MAP_SELECT', id: echoNode.id });
    expect(fight.combat.echoElite).toBe(true);
    expect(fight.combat.enemies[0].st.might).toBeGreaterThanOrEqual(1);
    fight.combat.enemies.forEach(enemy => { enemy.hp = 1; });
    fight.combat.energy = 10;
    fight = act(fight, { type: 'PLAY_CARD', uid: giveCard(fight, 'cleave'), target: 'e0' });
    expect(fight.combat.reward.items[0]).toMatchObject({ kind: 'key', key: 'echo' });
  });

  it('opens Act IV only with all three keys and ends it with the true ending', () => {
    let plain = toMap(43);
    plain.act = 3; plain.screen = 'bossRelic'; plain.bossRelics = [];
    plain = act(plain, { type: 'BOSS_RELIC' });
    expect(plain.screen).toBe('victory');
    expect(plain.trueEnding).toBe(false);

    let run = toMap(43);
    run.act = 3; run.screen = 'bossRelic'; run.bossRelics = [];
    run.keys = { flame: true, page: true, echo: true };
    expect(hasAllKeys(run)).toBe(true);
    run = act(run, { type: 'BOSS_RELIC' });
    expect(run.act).toBe(4);
    expect(run.screen).toBe('map');
    expect(Object.values(run.map.nodes).map(node => node.type).sort()).toEqual(['boss', 'elite', 'rest', 'shop']);
    run.hero.hp = run.hero.maxHp = 5000;
    run.hero.deck.forEach(card => { card.id = 'slash'; card.up = true; });
    let steps = 0;
    while (!['victory', 'defeat'].includes(run.screen) && steps < 6000) { run = botStep(run, steps); steps++; }
    expect(run.screen).toBe('victory');
    expect(run.trueEnding).toBe(true);
    expect(run.stats.bosses).toBeGreaterThanOrEqual(1);
    expect(shardsForRun(run).parts.some(([label]) => label === '真結局')).toBe(true);
  });
});

describe('echo archive new events and relics', () => {
  it('copies, transforms and gambles through the new events', () => {
    let run = createRun({ seed: 51 });
    run = act(run, { type: 'EVENT_CHOOSE', index: 3 });
    run = act(run, { type: 'EVENT_CONTINUE' });
    run.event = { id: 'scriptorium', result: null, gains: [] }; run.screen = 'event';
    run = act(run, { type: 'EVENT_CHOOSE', index: 0 });
    expect(run.pending.kind).toBe('duplicate');
    run = act(run, { type: 'PICK_CARD', uid: run.hero.deck.find(card => card.id === 'thunder').uid });
    expect(run.hero.deck.filter(card => card.id === 'thunder')).toHaveLength(2);

    run.event = { id: 'emberAltar', result: null, gains: [] };
    run = act(run, { type: 'EVENT_CHOOSE', index: 0 });
    const size = run.hero.deck.length;
    run = act(run, { type: 'PICK_CARD', uid: run.hero.deck[0].uid });
    expect(run.hero.deck).toHaveLength(size);
    expect(run.event.gains.map(gain => gain.type)).toEqual(['removed', 'card']);

    run.event = { id: 'tinker', result: null, gains: [] };
    expect(eventChoices(run)[0].req.potion).toBe(true);
    const blocked = act(run, { type: 'EVENT_CHOOSE', index: 0 });
    expect(blocked.event.result).toBeNull();
    run.hero.potions = ['fireTonic', null, null];
    const gold = run.hero.gold;
    run = act(run, { type: 'EVENT_CHOOSE', index: 0 });
    expect(run.hero.potions[0]).toBeNull();
    expect(run.hero.gold).toBe(gold + 75);

    let wins = 0;
    for (let seed = 0; seed < 30; seed++) {
      let well = createRun({ seed: 600 + seed });
      well.event = { id: 'wishingWell', result: null, gains: [] };
      well = act(well, { type: 'EVENT_CHOOSE', index: 0 });
      if (well.hero.relics.length > 1) wins++;
    }
    expect(wins).toBeGreaterThan(5);
    expect(wins).toBeLessThan(25);
    // Every way through an event ends in a result, leaves for a fight or a
    // card reward, turns to a page that exists, or starts a game.
    const ends = (def, res) => Boolean(res.result || res.effects?.some(effect => ['cardChoice', 'fight'].includes(effect.op)) || (res.goto && def.stages?.[res.goto]) || res.game);
    const settles = (def, choice) => (choice.outcomes ? choice.outcomes.every(item => ends(def, item)) : choice.branch ? ends(def, choice.branch.yes) && ends(def, choice.branch.no) : ends(def, choice));
    Object.values(EVENTS).forEach(def => [...(def.choices || []), ...Object.values(def.stages || {}).flatMap(stage => stage.choices)]
      .forEach(choice => expect(settles(def, choice), `${def.title.en}: ${choice.en}`).toBe(true)));
  });

  it('applies the new relics in combat and in shops', () => {
    let run = heroCombat('scribe', ['bookworm']);
    run.hero.relics.push('bulwark', 'emberHeart', 'metronome', 'bloodInk');
    run.combat.enemies[0].st.burn = 10;
    run.combat.enemies[0].move = 'gnaw';
    for (let i = 0; i < 6; i++) run = play(run, 'slash');
    expect(run.combat.energy).toBe(10 - 6 + 1);
    run.combat.player.ward = 20;
    const hp = run.combat.enemies[0].hp;
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(hp - run.combat.enemies[0].hp).toBe(15);
    expect(run.combat.player.ward).toBe(Math.floor((20 - 9) / 2));
    run.combat.enemies[0].st = {};
    run.combat.enemies[0].hp = 60;
    run.combat.enemies[0].move = 'gnaw';
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(run.combat.player.st.might).toBe(1);

    const shopAt = relics => {
      const r = toMap(52);
      r.hero.relics = relics;
      Object.values(r.map.nodes).forEach(node => { if (node.row === 0) node.type = 'shop'; });
      return act(r, { type: 'MAP_SELECT', id: availableNodes(r)[0] }).shop;
    };
    const full = shopAt(['inkwell']), cheap = shopAt(['inkwell', 'goldLeaf']);
    full.cards.forEach((item, index) => { if (!item.sale) expect(cheap.cards[index].price).toBe(Math.round(item.price * 0.8)); });
    full.potions.forEach((item, index) => expect(cheap.potions[index].price).toBe(Math.round(item.price * 0.8)));
  });
});

describe('echo archive Inkcaller full runs', () => {
  it.each([[61, 'story'], [62, 'standard'], [63, 'heroic']])('seed %i on %s finishes without getting stuck', (seed, difficulty) => {
    let run = createRun({ seed: seed * 7919, difficulty, hero: 'caller', unlocked: ARCHIVE_CARDS });
    let steps = 0;
    while (!['victory', 'defeat'].includes(run.screen) && steps < 8000) {
      const next = botStep(run, seed + steps);
      expect(next).not.toBe(run);
      run = next;
      steps++;
    }
    expect(['victory', 'defeat']).toContain(run.screen);
  });
});

// The Tinker and the Twilight Knight, through both routes of each act. Their
// whole card pool is dealt into the starting deck so every card gets played.
describe('echo archive Tinker and Twilight Knight full runs', () => {
  it.each([[91, 'tinker', 'story'], [92, 'tinker', 'standard'], [93, 'knight', 'story'], [94, 'knight', 'heroic']])('seed %i as %s on %s finishes without getting stuck', (seed, hero, difficulty) => {
    let run = createRun({ seed: seed * 7919, difficulty, hero, unlocked: ARCHIVE_CARDS });
    Object.keys(CARDS).filter(id => CARDS[id].hero === hero).forEach((id, i) => run.hero.deck.push({ uid: `h${i}`, id, up: i % 3 === 0 }));
    let steps = 0;
    while (!['victory', 'defeat'].includes(run.screen) && steps < 9000) {
      const next = botStep(run, seed + steps);
      expect(next).not.toBe(run);
      run = next;
      steps++;
    }
    expect(['victory', 'defeat']).toContain(run.screen);
  });
});

// ───────────── Wave 4: Fold and new tricks for the older play styles ─────────────
const WAVE4 = ['fold', 'crease', 'paperFan', 'confetti', 'origami', 'keenCrease', 'paperArmor', 'finalFold', 'paperPlane', 'thousandCranes', 'honedEdge', 'execute', 'afterimage', 'scorch', 'brand', 'eternalFlame', 'verse', 'spellbook', 'wordsmith', 'epic', 'smear', 'scrub', 'inkTide', 'spiritHowl', 'pounce'];
const bladesIn = run => run.combat.hand.filter(uid => run.combat.cards[uid].id === 'paperBlade');
const foeHp = (run, index = 0) => run.combat.enemies[index].hp;
const withChant = (run, id, ok) => act(run, { type: 'PLAY_CARD', uid: giveCard(run, id), target: 'e0', chant: { word: 'star', meaning: '星星', ok } });
function addJunk(run, pile, n) {
  for (let i = 0; i < n; i++) {
    const uid = `j${pile}${i}`;
    run.combat.cards[uid] = { uid, id: 'smudge', up: false, temp: true };
    run.combat[pile].push(uid);
  }
}

describe('echo archive fold', () => {
  it('folds Paper Blades that hit, fade, power up and feed Final Fold', () => {
    let run = heroCombat('scribe', ['bookworm']);
    run.combat.hand = [];
    run = play(run, 'fold');
    expect(bladesIn(run)).toHaveLength(2);
    run = play(run, 'keenCrease');
    run = play(run, 'paperArmor');
    let hp = foeHp(run);
    const ward = run.combat.player.ward;
    const first = bladesIn(run)[0];
    run = act(run, { type: 'PLAY_CARD', uid: first, target: 'e0' });
    expect(hp - foeHp(run)).toBe(4 + 2);
    expect(run.combat.player.ward).toBe(ward + 2);
    expect(run.combat.faded).toContain(first);
    expect(run.combat.blades).toBe(1);
    hp = foeHp(run);
    run = play(run, 'finalFold');
    expect(hp - foeHp(run)).toBe(6 + 3);
    const left = bladesIn(run)[0];
    run = act(run, { type: 'END_TURN' });
    expect(run.combat.faded).toContain(left);
    expect(run.combat.discard).not.toContain(left);
    expect(run.hero.deck.some(card => card.id === 'paperBlade')).toBe(false);
  });

  it('bursts blades with Confetti, fills the hand with Thousand Cranes and folds each turn with Origami', () => {
    let run = heroCombat('scribe', ['bookworm', 'inkling']);
    run.combat.hand = [];
    run = play(run, 'fold', 'e0', true);
    expect(bladesIn(run)).toHaveLength(3);
    const before = [foeHp(run, 0), foeHp(run, 1)];
    run = play(run, 'confetti');
    expect(before[0] - foeHp(run, 0)).toBe(3 + 3 * 4);
    expect(before[1] - foeHp(run, 1)).toBe(3 + 3 * 4);
    expect(bladesIn(run)).toHaveLength(0);
    run = play(run, 'thousandCranes');
    expect(run.combat.hand).toHaveLength(10);
    expect(bladesIn(run).every(uid => run.combat.cards[uid].up)).toBe(true);
    run.combat.hand = [];
    run = play(run, 'origami');
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(bladesIn(run)).toHaveLength(1);

    let boxed = toMap(9);
    boxed.hero.relics.push('origamiBox');
    boxed = act(boxed, { type: 'MAP_SELECT', id: availableNodes(boxed)[0] });
    expect(bladesIn(boxed)).toHaveLength(2);
    expect(boxed.combat.hand).toHaveLength(7);
  });

  it('keeps Paper Blades out of rewards but lets both heroes build Fold', () => {
    expect(cardPool(createRun({ seed: 4 }))).not.toContain('paperBlade');
    expect(cardPool(createRun({ seed: 4, hero: 'caller' }))).toContain('crease');
    expect(inHeroPool('origami', 'caller')).toBe(true);
    expect(inHeroPool('execute', 'caller')).toBe(false);
    expect(ARCHIVE_CARDS).toEqual(expect.arrayContaining(['paperPlane', 'thousandCranes', 'afterimage']));
    const text = (id, ctx = {}) => JSON.stringify(describeCard({ id, up: false }, ctx));
    expect(text('paperBlade', { keen: 2 })).toContain('"n":6');
    expect(text('finalFold', { blades: 3 })).toContain('"n":15');
    expect(text('smear', { statuses: 2 })).toContain('"n":10');
    expect(text('scrub')).not.toContain('能量');
  });
});

describe('echo archive wave 4 cards', () => {
  it('grows Honed Edge for one combat, doubles Execute on wounded foes and repeats with Afterimage', () => {
    let run = heroCombat('scribe', ['bookworm']);
    const uid = giveCard(run, 'honedEdge');
    let hp = foeHp(run);
    run = act(run, { type: 'PLAY_CARD', uid, target: 'e0' });
    expect(hp - foeHp(run)).toBe(6);
    run.combat.discard = run.combat.discard.filter(item => item !== uid);
    run.combat.hand.push(uid);
    hp = foeHp(run);
    run = act(run, { type: 'PLAY_CARD', uid, target: 'e0' });
    expect(hp - foeHp(run)).toBe(9);
    expect(run.combat.cards[uid].grow).toBe(6);
    expect(run.hero.deck.some(card => card.grow)).toBe(false);

    run.combat.enemies[0].hp = 60;
    run = play(run, 'execute');
    expect(60 - foeHp(run)).toBe(10);
    run.combat.enemies[0].hp = 30;
    run = play(run, 'execute');
    expect(30 - foeHp(run)).toBe(20);

    run.combat.enemies[0].hp = 60;
    run = play(run, 'afterimage');
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(run.combat.echo).toBe(1);
    run.combat.energy = 5;
    run = play(run, 'slash');
    expect(60 - foeHp(run)).toBe(12);
  });

  it('scales Scorch with burn, brands, and keeps burn alive with Eternal Flame', () => {
    let run = heroCombat('scribe', ['bookworm']);
    run.combat.enemies[0].st.burn = 5;
    let hp = foeHp(run);
    run = play(run, 'scorch');
    expect(hp - foeHp(run)).toBe(10);
    run = play(run, 'brand');
    expect(run.combat.enemies[0].st).toMatchObject({ burn: 9, exposed: 1 });
    run = play(run, 'eternalFlame');
    hp = foeHp(run);
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(hp - foeHp(run)).toBe(9);
    expect(run.combat.enemies[0].st.burn).toBe(9);
  });

  it('strengthens Verse, Spellbook, Wordsmith and Epic through chants', () => {
    let run = heroCombat('scribe', ['bookworm', 'inkling']);
    let hp = foeHp(run);
    run = withChant(run, 'verse', false);
    expect(hp - foeHp(run)).toBe(8);
    hp = foeHp(run);
    run = withChant(run, 'verse', true);
    expect(hp - foeHp(run)).toBe(12);
    run = play(run, 'wordsmith');
    run.combat.hand = [];
    const energy = run.combat.energy, ward = run.combat.player.ward;
    run = withChant(run, 'spellbook', true);
    expect(run.combat.energy).toBe(energy - 1 + 1);
    expect(run.combat.hand).toHaveLength(2);
    expect(run.combat.player.ward).toBe(ward + 5);
    const before = [foeHp(run, 0), foeHp(run, 1)];
    run = withChant(run, 'epic', true);
    expect(before[0] - foeHp(run, 0)).toBe(13 + 7);
    expect(before[1] - foeHp(run, 1)).toBe(13 + 7);
  });

  it('turns status cards into damage with Smear and Ink Tide, and fades a card with Scrub', () => {
    let run = heroCombat('scribe', ['bookworm', 'inkling']);
    addJunk(run, 'discard', 2);
    const hp = foeHp(run);
    run = play(run, 'smear');
    expect(hp - foeHp(run)).toBe(6 + 2 * 2);
    run.combat.hand = [];
    addJunk(run, 'hand', 2);
    const before = [foeHp(run, 0), foeHp(run, 1)];
    run = play(run, 'inkTide');
    expect(before[0] - foeHp(run, 0)).toBe(5 + 2 * 5);
    expect(before[1] - foeHp(run, 1)).toBe(5 + 2 * 5);
    expect(run.combat.faded).toEqual(expect.arrayContaining(['jhand0', 'jhand1']));
    expect(run.combat.hand).toHaveLength(0);
    const energy = run.combat.energy;
    run = play(run, 'scrub');
    expect(run.combat.choice?.action).toBe('fade');
    const pick = run.combat.choice.options[0];
    run = act(run, { type: 'CHOOSE_CARD', uid: pick });
    expect(run.combat.faded).toContain(pick);
    expect(run.combat.energy).toBe(energy - 1);
  });

  it('gives the Inkcaller Spirit Howl and Pounce', () => {
    let run = heroCombat('caller', ['bookworm', 'inkling']);
    run = play(run, 'spiritHowl');
    expect(run.combat.enemies.every(enemy => enemy.st.weak === 1)).toBe(true);
    expect(run.combat.player.familiar).toBe(4);
    run.combat.enemies[1].hp = 30;
    const hp = foeHp(run);
    run = play(run, 'pounce');
    expect(hp - foeHp(run)).toBe(5);
    expect(30 - foeHp(run, 1)).toBe(4);
  });

  it.each([[71, 'scribe'], [72, 'caller']])('seed %i with every new card in a %s deck finishes without getting stuck', (seed, hero) => {
    let run = createRun({ seed: seed * 7919, difficulty: 'story', hero, unlocked: ARCHIVE_CARDS });
    WAVE4.filter(id => inHeroPool(id, hero)).forEach((id, index) => run.hero.deck.push({ uid: `w${index}`, id, up: index % 2 === 0 }));
    let steps = 0;
    while (!['victory', 'defeat'].includes(run.screen) && steps < 9000) {
      const next = botStep(run, seed + steps);
      expect(next).not.toBe(run);
      run = next;
      steps++;
    }
    expect(['victory', 'defeat']).toContain(run.screen);
  });
});

// ───────────── Wave 5: a Rare and a Mythic for every play style ─────────────
const WAVE5 = ['mountainCleaver', 'swordSaint', 'flashpoint', 'hellfire', 'mirrorWall', 'colossus', 'finisher', 'perpetualMotion', 'eloquence', 'runeChoir', 'blackout', 'abyssalInk', 'origamiWorkshop', 'paperDragon', 'spiritSurge', 'eternalSpirit'];
const allHp = run => run.combat.enemies.map(enemy => enemy.hp);
const lost = (before, run) => before.map((hp, index) => hp - run.combat.enemies[index].hp);

describe('echo archive power cards', () => {
  it('gives every play style a Rare and a Mythic from the base collection', () => {
    ['blade', 'burn', 'ward', 'combo', 'chant', 'ink', 'fold', 'familiar'].forEach(arch => {
      expect(WAVE5.filter(id => CARDS[id].arch === arch).map(id => CARDS[id].rarity).sort(), arch).toEqual(['mythic', 'rare']);
    });
    WAVE5.forEach(id => expect(CARDS[id].pack, id).toBeFalsy());
    expect(cardPool(createRun({ seed: 5 }))).toEqual(expect.arrayContaining(['swordSaint', 'hellfire', 'colossus', 'paperDragon']));
    expect(cardPool(createRun({ seed: 5, hero: 'caller' }))).toEqual(expect.arrayContaining(['eternalSpirit', 'spiritSurge', 'runeChoir']));
    const text = (id, ctx) => JSON.stringify(describeCard({ id, up: false }, ctx));
    expect(text('mountainCleaver', { might: 2 })).toContain('"n":24');
    expect(text('finisher', { combo: 3 })).toContain('"n":4,"tone":"up"');
    expect(text('blackout', { statuses: 3 })).toContain('"n":5,"tone":"up"');
  });

  it('triples Might on Mountain Cleaver and sweeps every foe with Sword Saint', () => {
    let run = heroCombat('scribe', ['bookworm', 'inkling', 'bookworm']);
    run.combat.player.st.might = 2;
    let before = allHp(run);
    run = play(run, 'mountainCleaver');
    expect(lost(before, run)).toEqual([18 + 2 * 3, 0, 0]);
    run = play(run, 'swordSaint');
    before = allHp(run);
    run = play(run, 'slash', 'e1');
    expect(run.combat.player.st.might).toBe(4);
    expect(lost(before, run)).toEqual([10, 10, 10]);
  });

  it('doubles burn on every foe with Flashpoint and ticks it twice a round with Hellfire', () => {
    let run = heroCombat('scribe', ['bookworm', 'inkling']);
    run.combat.enemies[0].st.burn = 2;
    run = play(run, 'flashpoint');
    expect(run.combat.enemies.map(enemy => enemy.st.burn)).toEqual([10, 6]);
    run = play(run, 'hellfire');
    const before = allHp(run);
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(lost(before, run)).toEqual([10 + (9 + 2), 6 + (5 + 2)]);
  });

  it('reflects blocked damage with Mirror Wall and turns Ward into damage with Colossus', () => {
    let run = heroCombat('scribe', ['bookworm']);
    run.combat.enemies[0].move = 'gnaw';
    run.combat.hand = [];
    run = play(run, 'mirrorWall');
    expect(run.combat.player.st.reflect).toBe(1);
    const ward = run.combat.player.ward;
    const intent = intentOf(run, run.combat.enemies[0]);
    let hp = foeHp(run);
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(hp - foeHp(run)).toBe(Math.min(ward, intent.dmg * intent.hits));
    expect(run.combat.player.st.reflect).toBeUndefined();

    run.combat.energy = 10;
    run = play(run, 'colossus');
    run.combat.player.ward = 20;
    hp = foeHp(run);
    run = act(run, { type: 'END_TURN' });
    expect(hp - foeHp(run)).toBe(10);
  });

  it('hits once per card played with Finisher and refuels every fourth card with Perpetual Motion', () => {
    let run = heroCombat('scribe', ['bookworm']);
    run = play(run, 'perpetualMotion');
    run = play(run, 'guard');
    run = play(run, 'guard');
    const energy = run.combat.energy, hand = run.combat.hand.length;
    run = play(run, 'guard');
    expect(run.combat.energy).toBe(energy - 1 + 1);
    expect(run.combat.hand.length).toBe(hand + 1);
    const hp = foeHp(run);
    run = play(run, 'finisher');
    expect(hp - foeHp(run)).toBe(5 * 5);
  });

  it('blasts every foe on correct chants with Eloquence and deals free chant cards with Rune Choir', () => {
    let run = heroCombat('scribe', ['bookworm', 'inkling']);
    run = play(run, 'eloquence');
    let before = allHp(run);
    run = withChant(run, 'spellbook', true);
    expect(lost(before, run)).toEqual([6, 6]);
    before = allHp(run);
    run = withChant(run, 'spellbook', false);
    expect(lost(before, run)).toEqual([0, 0]);
    run = play(run, 'runeChoir');
    run.combat.hand = [];
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    const gifts = run.combat.hand.filter(uid => run.combat.cards[uid].temp && CARDS[run.combat.cards[uid].id].chant);
    expect(gifts).toHaveLength(2);
    expect(gifts.every(uid => cardCost(run, run.combat.cards[uid]) === 0)).toBe(true);
  });

  it('hits again per status card with Blackout and feeds on fading status cards with Abyssal Ink', () => {
    let run = heroCombat('scribe', ['bookworm', 'inkling']);
    addJunk(run, 'discard', 2);
    let before = allHp(run);
    run = play(run, 'blackout');
    expect(lost(before, run)).toEqual([4 * 4, 4 * 4]);
    expect(run.combat.discard.filter(uid => run.combat.cards[uid].id === 'smudge')).toHaveLength(3);
    run = play(run, 'abyssalInk');
    run.combat.hand = [];
    addJunk(run, 'hand', 1);
    before = allHp(run);
    run = act(run, { type: 'END_TURN' });
    expect(lost(before, run)).toEqual([5, 5]);
    finishEnemyPhase(run);
    expect(run.combat.hand.some(uid => run.combat.cards[uid].id === 'smudge')).toBe(true);
  });

  it('folds a blade for every other card with Origami Workshop and lets Paper Dragon blades hit everyone', () => {
    let run = heroCombat('scribe', ['bookworm', 'inkling', 'bookworm']);
    run.combat.hand = [];
    run = play(run, 'origamiWorkshop');
    expect(bladesIn(run)).toHaveLength(1);
    run = play(run, 'guard');
    expect(bladesIn(run)).toHaveLength(2);
    run = act(run, { type: 'PLAY_CARD', uid: bladesIn(run)[0], target: 'e0' });
    expect(bladesIn(run)).toHaveLength(1);
    run = play(run, 'paperDragon');
    const before = allHp(run);
    run = act(run, { type: 'PLAY_CARD', uid: bladesIn(run)[0], target: 'e1' });
    expect(lost(before, run)).toEqual([6, 6, 6]);
  });

  it('surges the familiar and keeps its stacks with Eternal Spirit', () => {
    let run = heroCombat('caller', ['bookworm', 'inkling']);
    run.combat.enemies[1].hp = 50;
    run = play(run, 'spiritSurge');
    expect(run.combat.player.familiar).toBe(8);
    expect(50 - foeHp(run, 1)).toBe(16);
    run = play(run, 'eternalSpirit');
    expect(run.combat.player.familiar).toBe(8 + 5);
    run = act(run, { type: 'END_TURN' });
    expect(run.combat.player.familiar).toBe(8 + 5);
  });

  it('leans one reward option toward the deck\'s play style and rewards skipping cards', () => {
    let run = createRun({ seed: 12 });
    expect(deckFocus(run)).toBeNull();
    run.hero.deck.push({ uid: 'f1', id: 'fold', up: false }, { uid: 'f2', id: 'crease', up: false }, { uid: 'b1', id: 'cleave', up: false });
    expect(deckFocus(run)).toBe('fold');
    for (let i = 0; i < 40; i++) expect(cardOptions(run, i % 5 ? 'monster' : 'elite', 3).some(id => CARDS[id].arch === 'fold')).toBe(true);
    run.hero.deck.push({ uid: 'b2', id: 'comet', up: false }, { uid: 'b3', id: 'dash', up: false });
    expect(deckFocus(run)).toBe('blade');

    let fight = intoCombat(13, ['bookworm']);
    fight.combat.enemies[0].hp = 1;
    fight = act(fight, { type: 'PLAY_CARD', uid: handCard(fight, 'slash'), target: 'e0' });
    fight = act(fight, { type: 'FINISH_COMBAT' });
    const cards = fight.reward.items.findIndex(item => item.kind === 'cards');
    const maxHp = fight.hero.maxHp, deck = fight.hero.deck.length;
    const skipped = act(fight, { type: 'TAKE_REWARD', index: cards, choice: null });
    expect(skipped.hero.maxHp).toBe(maxHp + SKIP_CARD_HP);
    expect(skipped.hero.deck).toHaveLength(deck);
    expect(skipped.reward.items[cards]).toMatchObject({ taken: true, skipped: true });
    const left = act(fight, { type: 'LEAVE_REWARD' });
    expect(left.hero.maxHp).toBe(maxHp + SKIP_CARD_HP);
    const picked = act(act(fight, { type: 'TAKE_REWARD', index: cards, choice: 0 }), { type: 'LEAVE_REWARD' });
    expect(picked.hero.maxHp).toBe(maxHp);
  });

  it.each([[81, 'scribe'], [82, 'caller']])('seed %i with every power card in a %s deck finishes without getting stuck', (seed, hero) => {
    let run = createRun({ seed: seed * 7919, difficulty: 'standard', hero, unlocked: ARCHIVE_CARDS });
    WAVE5.filter(id => inHeroPool(id, hero)).forEach((id, index) => run.hero.deck.push({ uid: `p${index}`, id, up: index % 2 === 1 }));
    let steps = 0;
    while (!['victory', 'defeat'].includes(run.screen) && steps < 9000) {
      const next = botStep(run, seed + steps);
      expect(next).not.toBe(run);
      run = next;
      steps++;
    }
    expect(['victory', 'defeat']).toContain(run.screen);
  });
});

// ───────────── Wave 6: a second boss for each of the first three acts ─────────────
const KRAKEN = ['tentacle', 'inkKraken', 'tentacle'];
function bossFight(encounter, seed = 61) {
  const run = toMap(seed);
  run.map.boss = encounter;
  run.pos = Object.values(run.map.nodes).find(node => node.next.includes('boss')).id;
  return act(run, { type: 'MAP_SELECT', id: 'boss' });
}
const foe = (run, id) => run.combat.enemies.find(enemy => enemy.id === id && !enemy.dead);

describe('echo archive second bosses', () => {
  it('draws one of two bosses per act, fights the drawn one and keeps old saves on the first', () => {
    const drawn = new Set();
    for (let seed = 1; seed <= 40; seed++) drawn.add(bossOf(actBoss(createRun({ seed }))));
    expect([...drawn].sort()).toEqual(['hollowTome', 'inkKraken']);
    [1, 2, 3].forEach(act => expect(ENCOUNTERS[act].bosses).toHaveLength(2));
    const old = createRun({ seed: 3 });
    delete old.map.boss;
    expect(actBoss(old)).toEqual(['hollowTome']);
    const fight = bossFight(['whisperThief']);
    expect(fight.combat.kind).toBe('boss');
    expect(fight.combat.enemies.map(enemy => enemy.id)).toEqual(['whisperThief']);
    expect(bossName(['tick', 'tock']).zh).toBe('滴答雙子');
    expect(bossName(KRAKEN).zh).toBe('墨池巨怪');
  });

  it('regrows the Kraken\'s arms and drops them all when the head falls', () => {
    let run = bossFight(KRAKEN);
    expect(run.combat.enemies.map(enemy => enemy.id)).toEqual(KRAKEN);
    run.combat.enemies[0].hp = 1;
    foe(run, 'inkKraken').ward = 5;
    run = play(run, 'slash', 'e0');
    expect(run.combat.enemies[0].dead).toBe(true);
    expect(foe(run, 'inkKraken').hp).toBe(foe(run, 'inkKraken').maxHp - ENEMIES.tentacle.severs);
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(foe(run, 'inkKraken').move).toBe('regrow');
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    expect(living(run.combat).filter(enemy => enemy.id === 'tentacle')).toHaveLength(2);
    const head = foe(run, 'inkKraken');
    Object.assign(head, { hp: 1, ward: 0 });
    run.combat.energy = 3;
    run = play(run, 'slash', head.uid);
    expect(living(run.combat)).toHaveLength(0);
    expect(run.combat.phase).toBe('won');
  });

  it('enrages the surviving twin when Tick or Tock falls', () => {
    let run = bossFight(['tick', 'tock']);
    Object.assign(run.combat.enemies[0], { hp: 1, ward: 0 });
    run = play(run, 'slash', 'e0');
    expect(run.combat.enemies[0].dead).toBe(true);
    expect(run.combat.enemies[1].st.might).toBe(4);
    expect(run.combat.phase).toBe('player');
  });

  it('steals the player\'s Ward before the Whisper Thief strikes', () => {
    let run = bossFight(['whisperThief']);
    run.combat.enemies[0].move = 'pilfer';
    run.combat.player.ward = 20;
    const hit = intentOf(run, run.combat.enemies[0]).dmg;
    const hp = run.hero.hp;
    run = act(run, { type: 'END_TURN' });
    run = act(run, { type: 'ENEMY_STEP' });
    expect(run.combat.enemies[0].ward).toBe(10);
    expect(hp - run.hero.hp).toBe(hit);
  });

  it('gives the new bosses working moves and art', () => {
    ['tentacle', 'inkKraken', 'tick', 'tock', 'whisperThief'].forEach(id => {
      const def = ENEMIES[id];
      expect(ENEMY_ART, id).toContain(def.art);
      for (let turn = 0; turn < 12; turn++) {
        const enemy = { hp: turn % 2 ? def.hp[0] : 1, maxHp: def.hp[0], turns: turn, history: [], uses: {} };
        expect(def.moves[def.next(enemy, (turn * 0.37) % 1, { allies: [] })], `${id} turn ${turn}`).toBeTruthy();
      }
    });
  });

  it.each([['kraken', KRAKEN], ['twins', ['tick', 'tock']], ['thief', ['whisperThief']]])('a bot fights the %s to the end without getting stuck', (name, encounter) => {
    // A starter deck against a late boss: plenty of health so the fight runs to its end.
    let run = bossFight(encounter, 70);
    run.hero.hp = run.hero.maxHp = 3000;
    let steps = 0;
    while (run.screen === 'combat' && steps < 4000) {
      const next = botStep(run, steps);
      expect(next).not.toBe(run);
      run = next;
      steps++;
    }
    expect(run.screen).toBe('reward');
  });
});
