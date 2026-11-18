import { describe, expect, it } from 'vitest';
import { ARCHIVE_CARDS, CARDS, describeCard } from '../data/cards.js';
import { ENEMIES } from '../data/enemies.js';
import { claimWelcome, emptyCollection, pullArchive, shardsForRun } from '../archive.js';
import { canUpgrade, cardOptions, createRun, canPlay, eventChoices, finishEnemyPhase, living, runReducer } from './engine.js';
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
});
