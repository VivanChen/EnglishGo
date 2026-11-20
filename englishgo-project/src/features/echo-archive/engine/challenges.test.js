import { describe, expect, it } from 'vitest';
import { ELITE_AFFIXES, ENEMIES, affixValue } from '../data/enemies.js';
import { CARDS } from '../data/cards.js';
import { TRIALS, buildMods, dailyChallenge, trialBonus } from '../data/challenges.js';
import { shardsForRun } from '../archive.js';
import { DIFFICULTIES, createRun, finishEnemyPhase, hasAffix, living, restHealAmount, runReducer } from './engine.js';
import { availableNodes } from './map.js';

const act = (run, action) => runReducer(run, action);

function toMap(options = {}) {
  let run = createRun({ seed: 7, ...options });
  run = act(run, { type: 'EVENT_CHOOSE', index: 3 });
  return act(run, { type: 'EVENT_CONTINUE' });
}

// Walks into the first room after turning it into the given kind of fight.
function fight(type, options = {}) {
  const run = toMap(options);
  const id = availableNodes(run)[0];
  run.map.nodes[id].type = type;
  return act(run, { type: 'MAP_SELECT', id });
}

// Replaces the fight with one enemy of our choosing.
function versus(id, extra = {}, options = {}) {
  const run = fight('monster', options);
  const def = ENEMIES[id];
  run.combat.enemies = [{ uid: 'e0', id, hp: def.hp[1], maxHp: def.hp[1], ward: 0, st: {}, move: Object.keys(def.moves)[0], history: [], uses: {}, turns: 0, dead: false, ...extra }];
  return run;
}

function play(run, id, target = 'e0', chant = null) {
  const c = run.combat;
  let uid = c.hand.find(item => c.cards[item].id === id);
  if (!uid) {
    uid = Object.keys(c.cards).find(item => c.cards[item].id === id);
    for (const pile of ['draw', 'discard']) c[pile] = c[pile].filter(item => item !== uid);
    c.hand.push(uid);
  }
  c.energy = Math.max(c.energy, 3);
  return act(run, { type: 'PLAY_CARD', uid, target, chant });
}

describe('echo archive elite affixes', () => {
  it('gives the toughest foe of an elite fight its affixes', () => {
    const run = fight('elite');
    const leader = run.combat.enemies.reduce((top, enemy) => (enemy.maxHp > top.maxHp ? enemy : top));
    expect(leader.affixes).toHaveLength(1);
    expect(Object.keys(ELITE_AFFIXES)).toContain(leader.affixes[0]);
    expect(fight('elite', { trials: ['champions'] }).combat.enemies.some(enemy => enemy.affixes?.length === 2)).toBe(true);
    expect(fight('elite', { difficulty: 'story' }).combat.enemies.every(enemy => !enemy.affixes?.length)).toBe(true);
    expect(fight('monster').combat.enemies.every(enemy => !enemy.affixes)).toBe(true);
  });

  it('makes armored, thorny, vampiric, enraged and splitting foes behave as described', () => {
    let run = versus('bookworm', { affixes: ['armored'] });
    run = act(run, { type: 'END_TURN' });
    finishEnemyPhase(run);
    run = act(run, { type: 'ENEMY_STEP' });
    expect(run.combat.enemies[0].ward).toBeGreaterThanOrEqual(affixValue('armored', 1));

    run = versus('bookworm', { affixes: ['thorny'], st: { spikes: affixValue('thorny', 1) } });
    const hp = run.hero.hp;
    run = play(run, 'slash');
    expect(run.hero.hp).toBe(hp - affixValue('thorny', 1));

    run = versus('bookworm', { affixes: ['vampiric'], move: 'gnaw', hp: 20 });
    run.combat.player.ward = 0;
    run = act(run, { type: 'END_TURN' });
    while (run.combat.phase === 'enemy') run = act(run, { type: 'ENEMY_STEP' });
    expect(run.combat.enemies[0].hp).toBeGreaterThan(20);

    run = versus('bookworm', { affixes: ['enraged'], hp: 24, maxHp: 40 });
    run = play(run, 'slash');
    expect(run.combat.enemies[0].st.might).toBe(affixValue('enraged', 1));

    run = versus('bookworm', { affixes: ['splitting'], hp: 5 });
    run = play(run, 'slash');
    expect(run.combat.enemies[0].dead).toBe(true);
    expect(living(run.combat).map(enemy => enemy.id)).toEqual(['inkling', 'inkling']);
    expect(run.combat.phase).toBe('player');
  });

  it('lets a swift foe act twice on its first turn only', () => {
    let run = versus('inkling', { affixes: ['swift'], move: 'splash' });
    run.hero.hp = 80; run.hero.maxHp = 80; run.combat.player.ward = 0;
    run = act(run, { type: 'END_TURN' });
    expect(run.combat.queue).toEqual(['e0', 'e0']);
    while (run.combat.phase === 'enemy') run = act(run, { type: 'ENEMY_STEP' });
    expect(run.combat.enemies[0].turns).toBe(2);
    run = act(run, { type: 'END_TURN' });
    expect(run.combat.queue).toEqual(['e0']);
    expect(hasAffix(run.combat.enemies[0], 'swift')).toBe(true);
  });
});

describe('echo archive boss second phases', () => {
  it('turns the page once when a boss drops to half health', () => {
    let run = versus('hollowTome', { hp: 64, maxHp: 124, st: { weak: 2 } });
    run = play(run, 'slash');
    const boss = run.combat.enemies[0];
    expect(boss.phased).toBe(true);
    expect(boss.st.might).toBe(2);
    expect(boss.st.weak).toBeUndefined();
    expect(boss.ward).toBe(Math.round(12 * DIFFICULTIES.standard.ward));
    expect(boss.move).toBe('lastChapter');
    const again = play(run, 'slash');
    expect(again.combat.enemies[0].st.might).toBe(2);
  });

  it('calls in help for the kraken and the last silence', () => {
    let run = versus('inkKraken', { hp: 52, maxHp: 100 });
    run = play(run, 'slash');
    expect(living(run.combat).filter(enemy => enemy.id === 'tentacle')).toHaveLength(2);
    run = versus('lastSilence', { hp: 192, maxHp: 380 });
    run = play(run, 'slash');
    expect(living(run.combat).filter(enemy => enemy.id === 'echoShade')).toHaveLength(2);
    expect(Object.values(ENEMIES).filter(def => def.phase2).length).toBeGreaterThanOrEqual(6);
  });
});

describe('echo archive trials', () => {
  it('stores chosen trials, applies their rules and pays more shards', () => {
    const run = createRun({ seed: 3, trials: ['giants', 'narrow', 'sleepless', 'nope', 'giants'] });
    expect(run.trials).toEqual(['giants', 'narrow', 'sleepless']);
    expect(run.mods.enemyHp).toBeCloseTo(1.2);
    expect(run.mods.cardChoices).toBe(2);
    expect(restHealAmount(run)).toBe(0);
    expect(trialBonus(run.trials)).toBe(TRIALS.giants.bonus + TRIALS.narrow.bonus + TRIALS.sleepless.bonus);
    run.stats = { ...run.stats, floors: 10 };
    run.screen = 'defeat';
    expect(shardsForRun(run).mult).toBeCloseTo(1.25 + 0.55);
    expect(createRun({ daily: dailyChallenge('2026-11-20'), trials: ['giants'] }).trials).toEqual([]);
    expect(buildMods({ trials: ['fog', 'bound', 'strictChant', 'champions'] })).toMatchObject({ fog: true, startWard: true, strictChant: true, eliteAffixes: 2 });
  });

  it('offers two cards with Narrow Shelves and gives foes Ward with Bound Covers', () => {
    let run = fight('monster', { trials: ['narrow', 'bound'] });
    run.combat.enemies.forEach(enemy => expect(enemy.ward).toBeGreaterThanOrEqual(Math.round(6 * DIFFICULTIES.standard.ward)));
    run.combat.enemies.forEach(enemy => { enemy.hp = 1; enemy.ward = 0; });
    for (const enemy of [...living(run.combat)]) run = play(run, 'slash', enemy.uid);
    run = act(run, { type: 'FINISH_COMBAT' });
    expect(run.reward.items.find(item => item.kind === 'cards').options).toHaveLength(2);
  });

  it('costs 2 life for a wrong answer under Strict Chant', () => {
    const chantCard = Object.keys(CARDS).find(id => CARDS[id].chant && CARDS[id].target === 'enemy' && !CARDS[id].hero);
    let run = versus('bookworm', {}, { trials: ['strictChant'] });
    const hp = run.hero.hp;
    run = play(run, chantCard, 'e0', { word: 'star', meaning: '星星', ok: false });
    expect(run.hero.hp).toBe(hp - 2);
    let easy = versus('bookworm');
    const before = easy.hero.hp;
    easy = play(easy, chantCard, 'e0', { word: 'star', meaning: '星星', ok: false });
    expect(easy.hero.hp).toBe(before);
  });
});
