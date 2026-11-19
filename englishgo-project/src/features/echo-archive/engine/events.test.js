import { describe, expect, it } from 'vitest';
import { EVENTS } from '../data/events.js';
import { createRun, eventChoices, living, runReducer } from './engine.js';
import { availableNodes } from './map.js';

const act = (run, action) => runReducer(run, action);

function toMap(seed = 7) {
  let run = createRun({ seed });
  run = act(run, { type: 'EVENT_CHOOSE', index: 3 });
  return act(run, { type: 'EVENT_CONTINUE' });
}

// Puts the run on an event of our choosing.
function atEvent(id, seed = 5) {
  const run = toMap(seed);
  run.event = { id, result: null, gains: [] };
  if (EVENTS[id].game === 'climb') run.event.game = { kind: 'climb', step: 0, loot: 0 };
  if (EVENTS[id].game === 'wheel') run.event.game = { kind: 'wheel', spins: [] };
  run.screen = 'event';
  return run;
}

// Steps into an unknown room (the act's first room, or a later one).
function enterUnknown(seed, firstRoom = false) {
  const run = toMap(seed);
  const id = availableNodes(run)[0];
  run.map.nodes[id].type = 'event';
  if (!firstRoom) run.path = ['earlier'];
  return act(run, { type: 'MAP_SELECT', id });
}

describe('echo archive livelier events', () => {
  it('turns some unknown rooms into ambushes, chests and merchants, never the first room', () => {
    const seen = { event: 0, combat: 0, treasure: 0, shop: 0 };
    for (let seed = 0; seed < 300; seed++) {
      const run = enterUnknown(seed);
      seen[run.screen] += 1;
      if (run.screen === 'combat') expect(run.combat.ambush).toBe(true);
      if (run.screen === 'treasure') expect(run.treasure.surprise).toBe(true);
      if (run.screen === 'shop') expect(run.shop.surprise).toBe(true);
    }
    expect(seen.combat).toBeGreaterThan(15);
    expect(seen.treasure).toBeGreaterThan(8);
    expect(seen.shop).toBeGreaterThan(5);
    expect(seen.event).toBeGreaterThan(180);
    for (let seed = 0; seed < 40; seed++) expect(enterUnknown(seed, true).screen).toBe('event');
  });

  it('applies event blessings at the start of the next fights and counts them down', () => {
    const plain = toMap(9);
    const base = act(plain, { type: 'MAP_SELECT', id: availableNodes(plain)[0] }).combat;
    const blessed = toMap(9);
    blessed.hero.boons = [{ id: 'sun', fights: 3 }, { id: 'moon', fights: 1 }, { id: 'star', fights: 2 }, { id: 'comet', fights: 2 }, { id: 'omen', fights: 1 }];
    const run = act(blessed, { type: 'MAP_SELECT', id: availableNodes(blessed)[0] });
    const c = run.combat;
    expect(c.player.st.might || 0).toBe((base.player.st.might || 0) + 2);
    expect(c.player.ward).toBe(base.player.ward + 8);
    expect(c.hand.length).toBe(base.hand.length + 2);
    expect(c.energy).toBe(base.energy + 1);
    living(c).forEach((enemy, index) => expect(enemy.st.might || 0).toBe((living(base)[index].st.might || 0) + 1));
    expect(run.hero.boons).toEqual([{ id: 'sun', fights: 2 }, { id: 'star', fights: 1 }, { id: 'comet', fights: 1 }]);
  });

  it('gives a blessing from the fortune teller, by chance or by paying', () => {
    const drawn = new Set();
    for (let seed = 0; seed < 40; seed++) {
      const run = act(atEvent('fortuneTeller', seed), { type: 'EVENT_CHOOSE', index: 0 });
      expect(run.event.result).toBeTruthy();
      drawn.add(run.hero.boons[0].id);
    }
    expect([...drawn].sort()).toEqual(['moon', 'omen', 'star', 'sun']);
    let run = atEvent('fortuneTeller');
    run.hero.gold = 100;
    run = act(run, { type: 'EVENT_CHOOSE', index: 1 });
    expect(run.event.stage).toBe('choose');
    expect(run.hero.gold).toBe(55);
    expect(eventChoices(run).map(choice => choice.en)).toEqual(['The Sun', 'The Moon', 'The Star']);
    run = act(run, { type: 'EVENT_CHOOSE', index: 2 });
    expect(run.hero.boons).toEqual([{ id: 'star', fights: 3 }]);
    expect(run.event.gains).toEqual([{ type: 'boon', id: 'star', fights: 3 }]);
  });

  it('lets a poke reveal whether the grinning chest bites', () => {
    const run = atEvent('mimicChest');
    run.event.flags = { mimic: true };
    const hp = run.hero.hp;
    const poked = act(run, { type: 'EVENT_CHOOSE', index: 1 });
    expect(poked.hero.hp).toBe(hp - 3);
    expect(poked.event.stage).toBe('growl');
    expect(act(poked, { type: 'EVENT_CHOOSE', index: 0 }).combat.kind).toBe('elite');
    expect(act(run, { type: 'EVENT_CHOOSE', index: 0 }).screen).toBe('combat');
    run.event.flags = { mimic: false };
    const safe = act(run, { type: 'EVENT_CHOOSE', index: 1 });
    expect(safe.event.stage).toBe('safe');
    const opened = act(safe, { type: 'EVENT_CHOOSE', index: 0 });
    expect(opened.event.result.en).toMatch(/Real treasure/);
    expect(opened.hero.relics.length).toBe(run.hero.relics.length + 1);
  });

  it('climbs the teetering tower for more gold until it stops or falls', () => {
    let run = atEvent('tower');
    const gold = run.hero.gold;
    run = act(run, { type: 'EVENT_CHOOSE', index: 0 });
    expect(run.event.game).toMatchObject({ step: 1, loot: 25 });
    run = act(run, { type: 'EVENT_CHOOSE', index: 1 });
    expect(run.hero.gold).toBe(gold + 25);
    expect(run.event.result.en).toMatch(/climb down/);
    let falls = 0, tops = 0;
    for (let seed = 0; seed < 60; seed++) {
      let climb = atEvent('tower', seed);
      const before = climb.hero.gold, relics = climb.hero.relics.length;
      while (!climb.event.result) climb = act(climb, { type: 'EVENT_CHOOSE', index: 0 });
      if (climb.event.game.fell) { falls++; expect(climb.hero.gold).toBe(before); } else { tops++; expect(climb.hero.gold).toBeGreaterThanOrEqual(before + 205); expect(climb.hero.relics.length).toBe(relics + 1); } // some relics add gold of their own
    }
    expect(falls).toBeGreaterThan(30);
    expect(tops).toBeGreaterThan(0);
  });

  it('spins the wheel up to twice, paying each time', () => {
    let run = atEvent('fortuneWheel');
    run.hero.gold = 100;
    run = act(run, { type: 'EVENT_CHOOSE', index: 0 });
    expect(run.event.game.spins).toHaveLength(1);
    expect(run.event.result).toBeNull();
    expect(eventChoices(run)[0].en).toBe('Spin again (35 gold)');
    run = act(run, { type: 'EVENT_CHOOSE', index: 0 });
    expect(run.event.game.spins).toHaveLength(2);
    expect(run.event.result).toBeTruthy();
    const landed = new Set();
    for (let seed = 0; seed < 120; seed++) {
      const wheel = atEvent('fortuneWheel', seed);
      wheel.hero.gold = 50;
      landed.add(act(wheel, { type: 'EVENT_CHOOSE', index: 0 }).event.game.spins[0]);
    }
    expect(landed.size).toBe(EVENTS.fortuneWheel.wheel.segments.length);
    const broke = atEvent('fortuneWheel');
    broke.hero.gold = 5;
    expect(act(broke, { type: 'EVENT_CHOOSE', index: 0 }).event.game.spins).toHaveLength(0);
  });

  it('turns word-game scores into rewards and keeps the words for the summary', () => {
    let run = act(atEvent('matching'), { type: 'EVENT_CHOOSE', index: 0 });
    expect(run.event.game).toEqual({ kind: 'memory' });
    expect(eventChoices(run)).toEqual([]);
    const relics = run.hero.relics.length;
    run = act(run, { type: 'EVENT_GAME', score: 4, words: [{ w: 'apple', m: '蘋果', ok: true }, { w: 'cloud', m: '雲', ok: false }] });
    expect(run.hero.relics.length).toBe(relics + 1);
    expect(run.stats.words.slice(-2)).toEqual([{ w: 'apple', m: '蘋果', ok: true }, { w: 'cloud', m: '雲', ok: false }]);
    expect(act(run, { type: 'EVENT_GAME', score: 4, words: [] })).toEqual(run);
    let echo = act(atEvent('echoHall'), { type: 'EVENT_CHOOSE', index: 0 });
    const gold = echo.hero.gold;
    echo = act(echo, { type: 'EVENT_GAME', score: 1, words: [] });
    expect(echo.hero.gold).toBe(gold + 25);
    const perfect = act(act(atEvent('echoHall'), { type: 'EVENT_CHOOSE', index: 0 }), { type: 'EVENT_GAME', score: 3, words: [] });
    expect(perfect.pending.kind).toBe('upgrade');
    expect(perfect.hero.boons[0].id).toBe('star');
  });

  it('plays sword, shield, scroll to two wins', () => {
    const outcomes = { win: 0, lose: 0 };
    for (let seed = 0; seed < 30; seed++) {
      let run = act(atEvent('knightDuel', seed), { type: 'EVENT_CHOOSE', index: 0 });
      const hp = run.hero.hp, relics = run.hero.relics.length;
      while (!run.event.result) run = act(run, { type: 'EVENT_DUEL', move: 'shield' });
      const { you, foe, rounds } = run.event.game;
      rounds.forEach(round => expect(round.outcome).toBe(round.foe === 'sword' ? 'win' : round.foe === 'scroll' ? 'lose' : 'draw'));
      if (you > foe) { outcomes.win++; expect(run.hero.relics.length).toBe(relics + 1); }
      if (foe > you) { outcomes.lose++; expect(run.hero.hp).toBe(Math.max(1, hp - 8)); }
    }
    expect(outcomes.win).toBeGreaterThan(5);
    expect(outcomes.lose).toBeGreaterThan(5);
  });

  it('sells the bottle when a potion arrives with no free slot', () => {
    const run = atEvent('clockworkTea');
    run.hero.potions = ['fireTonic', 'fireTonic', 'fireTonic'];
    let hurt = null;
    for (let seed = 0; seed < 40 && !hurt; seed++) {
      const tea = atEvent('clockworkTea', seed);
      tea.hero.potions = ['fireTonic', 'fireTonic', 'fireTonic'];
      const sipped = act(tea, { type: 'EVENT_CHOOSE', index: 0 });
      if (sipped.event.result.en.startsWith('Too hot')) hurt = { before: tea, after: sipped };
    }
    expect(hurt).toBeTruthy();
    expect(hurt.after.hero.gold).toBe(hurt.before.hero.gold + 20);
    expect(hurt.after.event.gains).toContainEqual({ type: 'gold', amount: 20 });
  });
});
