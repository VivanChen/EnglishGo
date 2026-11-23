import { describe, expect, it } from 'vitest';
import { ACTS, ENCOUNTERS, ENEMIES, ROUTES } from '../data/enemies.js';
import { ARCHIVE_CARDS, CARDS, describeCard } from '../data/cards.js';
import { EVENTS } from '../data/events.js';
import { HEROES, heroPool, heroUnlocked, inHeroPool, legacyClears, newlyUnlocked } from '../data/heroes.js';
import { OVERHEAT_HP, cardContext, cardPool, createRun, eventFits, finishEnemyPhase, intentOf, isDay, isNight, living, moveBase, runReducer } from './engine.js';
import { availableNodes, generateMap } from './map.js';

const act = (run, action) => runReducer(run, action);
const HERO_PACK = { scribe: ['runeRiposte', 'grandInscription', 'bladeBulwark'], caller: ['frenzy', 'spiritTide', 'spiritKing'], tinker: ['springFist', 'rocketBarrage', 'steamTitan'], knight: ['duskWaltz', 'aurora', 'celestialCrown'] };

function toMap(options = {}) {
  let run = createRun({ seed: 11, ...options });
  run = act(run, { type: 'EVENT_CHOOSE', index: 3 });
  return act(run, { type: 'EVENT_CONTINUE' });
}

function fight(options = {}, type = 'monster') {
  const run = toMap(options);
  const id = availableNodes(run)[0];
  run.map.nodes[id].type = type;
  return act(run, { type: 'MAP_SELECT', id });
}

const foe = (id, uid = 'e0', extra = {}) => ({ uid, id, hp: ENEMIES[id].hp[1], maxHp: ENEMIES[id].hp[1], ward: 0, st: {}, move: Object.keys(ENEMIES[id].moves)[0], history: [], uses: {}, turns: 0, dead: false, ...extra });

function play(run, id, target = 'e0') {
  const c = run.combat;
  const uid = `x${Object.keys(c.cards).length}`;
  c.cards[uid] = { uid, id, up: false };
  c.hand.push(uid);
  c.energy = Math.max(c.energy, 3);
  return act(run, { type: 'PLAY_CARD', uid, target });
}

// Ends the turn and lets the enemies act, keeping the player alive.
function nextTurn(run) {
  let next = act(run, { type: 'END_TURN' });
  next = structuredClone(next);
  finishEnemyPhase(next);
  return next;
}

// Plays a run up to the route choice after the first boss.
function toRoute(options = {}) {
  let run = fight(options, 'boss');
  run.combat.enemies.forEach(enemy => { enemy.hp = 1; });
  run = play(run, options.hero === 'knight' ? 'solarFlare' : options.hero === 'tinker' ? 'spannerSpin' : 'cleave');
  run = act(run, { type: 'FINISH_COMBAT' });
  run = act(run, { type: 'LEAVE_REWARD' });
  return act(run, { type: 'BOSS_RELIC', id: null });
}

describe('echo archive regions', () => {
  it('lets the player choose the next region after a boss and remembers the boss beaten', () => {
    const run = toRoute();
    expect(run.screen).toBe('route');
    expect(run.routes).toEqual(['2', 'drowned']);
    expect(run.cleared).toEqual(['1']);
    const drowned = act(run, { type: 'CHOOSE_ROUTE', zone: 'drowned' });
    expect(drowned.act).toBe(2);
    expect(drowned.zone).toBe('drowned');
    expect(drowned.screen).toBe('map');
    expect(drowned.map.dive).toBe(true);
    expect(ENCOUNTERS.drowned.bosses.map(String)).toContain(String(drowned.map.boss));
    const clockwork = act(run, { type: 'CHOOSE_ROUTE', zone: '2' });
    expect(clockwork.zone).toBeNull();
    expect(ENCOUNTERS[2].bosses.map(String)).toContain(String(clockwork.map.boss));
    expect(act(run, { type: 'CHOOSE_ROUTE', zone: 'observatory' })).toBe(run);
  });

  it('draws the Drowned Stacks narrow and deep, with pearl clams instead of merchants', () => {
    const holder = { rng: 99 };
    const map = generateMap(holder, 2, 'drowned');
    const nodes = Object.values(map.nodes).filter(node => node.id !== 'boss');
    expect(Math.max(...nodes.map(node => node.col))).toBeLessThan(5);
    expect(Math.max(...nodes.map(node => node.row))).toBe(9);
    expect(nodes.some(node => node.type === 'shop')).toBe(false);
    let pearls = 0;
    for (let seed = 1; seed < 30; seed++) pearls += Object.values(generateMap({ rng: seed }, 2, 'drowned').nodes).filter(node => node.type === 'pearl').length;
    expect(pearls).toBeGreaterThan(10);
  });

  it('opens a pearl clam in a pearl room', () => {
    let run = toRoute();
    run = act(run, { type: 'CHOOSE_ROUTE', zone: 'drowned' });
    run = act(run, { type: 'ACK_ACT' });
    const id = availableNodes(run)[0];
    run.map.nodes[id].type = 'pearl';
    run = act(run, { type: 'MAP_SELECT', id });
    expect(run.screen).toBe('event');
    expect(run.event.id).toBe('pearlClam');
    const gold = run.hero.gold;
    run = act(run, { type: 'EVENT_CHOOSE', index: 1 });
    expect(run.hero.gold).toBe(gold + 80);
  });

  it('floats the Observatory as islands with star gates that leap to the next island', () => {
    let gates = 0;
    for (let seed = 1; seed < 20; seed++) {
      const map = generateMap({ rng: seed }, 3, 'observatory');
      expect(map.islands).toBe(3);
      Object.values(map.nodes).filter(node => node.gate).forEach(node => {
        gates += 1;
        expect(node.next).toContain(node.gate);
        expect(map.nodes[node.gate].row - node.row).toBe(3);
      });
    }
    expect(gates).toBeGreaterThan(15);
  });

  it('keeps region-flavoured events in their own region', () => {
    const drowned = { act: 2, zone: 'drowned' }, clockwork = { act: 2, zone: null }, observatory = { act: 3, zone: 'observatory' };
    expect(eventFits(clockwork, EVENTS.clockworkTea)).toBe(true);
    expect(eventFits(drowned, EVENTS.clockworkTea)).toBe(false);
    expect(eventFits(drowned, EVENTS.mirror)).toBe(true);
    expect(eventFits(observatory, EVENTS.fallingStar)).toBe(true);
    expect(eventFits({ act: 3, zone: null }, EVENTS.fallingStar)).toBe(false);
    expect(eventFits(drowned, EVENTS.pearlClam)).toBe(false);
  });

  it('halves damage to the Drowned Captain while his anchor holds', () => {
    const run = fight();
    run.combat.enemies = [foe('ironAnchor', 'e0'), foe('drownedCaptain', 'e1')];
    const before = run.combat.enemies[1].hp;
    const hit = play(run, 'comet', 'e1');
    const dealt = before - hit.combat.enemies[1].hp;
    hit.combat.enemies[0].hp = 0; hit.combat.enemies[0].dead = true;
    const again = play(hit, 'comet', 'e1');
    expect(hit.combat.enemies[1].hp - again.combat.enemies[1].hp).toBe(dealt * 2);
  });

  it('powers the Supernova up with every Star Mote on the field', () => {
    const run = fight();
    run.combat.enemies = [foe('starEater', 'e0', { move: 'supernova' })];
    const alone = moveBase(run, run.combat.enemies[0]);
    run.combat.enemies.push(foe('starMote', 'e1'), foe('starMote', 'e2'));
    expect(moveBase(run, run.combat.enemies[0])).toBe(alone + 12);
    expect(intentOf(run, run.combat.enemies[0]).dmg).toBeGreaterThan(alone);
  });

  it('gives every new region its own enemies with valid moves and a painted name', () => {
    ['drowned', 'observatory'].forEach(zone => {
      const table = ENCOUNTERS[zone];
      [...table.easy, ...table.normal, ...table.elite, ...table.bosses].flat().forEach(id => {
        const def = ENEMIES[id];
        expect(def, id).toBeTruthy();
        const enemy = foe(id);
        for (let turn = 0; turn < 8; turn++) {
          const move = def.next({ ...enemy, turns: turn }, 0.5, { allies: [] });
          expect(def.moves[move], `${id} ${move}`).toBeTruthy();
        }
      });
      expect(ACTS[zone].route).toBeTruthy();
    });
    expect(ROUTES[2]).toContain('drowned');
    expect(ROUTES[3]).toContain('observatory');
  });
});

describe('the Tinker', () => {
  const tinker = () => fight({ hero: 'tinker' });

  it('starts with a warm boiler and a deck of its own', () => {
    const run = tinker();
    expect(run.hero.relics).toEqual(['pocketBoiler']);
    expect(run.combat.player.steam).toBe(2);
    expect(cardContext(run).steam).toBe(2);
    expect(heroPool('tinker').every(id => inHeroPool(id, 'tinker'))).toBe(true);
    expect(heroPool('tinker')).toContain('steamHammer');
    expect(heroPool('scribe')).not.toContain('steamHammer');
    expect(heroPool('tinker')).not.toContain('summonSpirit');
  });

  it('builds Steam with its cards and makes Steam cards hit harder', () => {
    let run = tinker();
    run.combat.enemies = [foe('pageCrab')];
    run = play(run, 'wrench');
    expect(run.combat.player.steam).toBe(3);
    const hp = run.combat.enemies[0].hp;
    run = play(run, 'pistonPunch');
    expect(hp - run.combat.enemies[0].hp).toBe(4 + 3);
  });

  it('vents all its Steam into a Steam Blast, gaining Might at high pressure', () => {
    let run = tinker();
    run.combat.enemies = [foe('reefWarden')];
    run.combat.player.steam = 6;
    const hp = run.combat.enemies[0].hp;
    run = play(run, 'steamBlast');
    expect(hp - run.combat.enemies[0].hp).toBe(4 + 18);
    expect(run.combat.player.steam).toBe(0);
    expect(run.combat.player.st.might).toBe(1);
    run.combat.player.steam = 5;
    run = play(run, 'steamBlast');
    expect(run.combat.player.st.might).toBe(1);
  });

  it('patches itself up after each win with the Pocket Boiler', () => {
    let run = tinker();
    run.combat.enemies = [foe('bubbleSprite', 'e0', { hp: 1 })];
    run.hero.hp = 40;
    run = play(run, 'wrench');
    expect(run.combat.phase).toBe('won');
    expect(run.hero.hp).toBe(45);
  });

  it('overheats at 10 Steam at the end of the turn', () => {
    let run = tinker();
    run.combat.enemies = [foe('pageCrab', 'e0', { move: 'shell' })];
    run.combat.player.steam = 10;
    const hp = run.hero.hp;
    run = act(run, { type: 'END_TURN' });
    expect(run.hero.hp).toBe(hp - OVERHEAT_HP);
    expect(run.combat.player.steam).toBe(0);
  });

  it('turns an overheat into a blast with the Safety Valve, and Heat Sink pays Ward', () => {
    let run = tinker();
    run.combat.enemies = [foe('pageCrab', 'e0', { move: 'shell' })];
    run = play(run, 'safetyValve');
    run = play(run, 'heatSink');
    run.combat.player.steam = 12;
    const hp = run.hero.hp, foeHp = run.combat.enemies[0].hp;
    run = act(run, { type: 'END_TURN' });
    expect(run.hero.hp).toBe(hp);
    expect(foeHp - run.combat.enemies[0].hp).toBeGreaterThanOrEqual(15);
    expect(run.combat.player.ward).toBeGreaterThanOrEqual(7);
  });

  it('describes Steam scaling with the current number', () => {
    const text = describeCard({ id: 'pistonPunch' }, { steam: 5 }).flat().map(seg => (typeof seg === 'string' ? seg : seg.n ?? '')).join('');
    expect(text).toContain('9');
  });
});

describe('the Twilight Knight', () => {
  const knight = () => fight({ hero: 'knight' });

  it('fights by Day first, then Night, taking turns', () => {
    let run = knight();
    run.combat.enemies = [foe('pageCrab', 'e0', { move: 'shell' })];
    expect(isDay(run.combat)).toBe(true);
    expect(run.combat.player.ward).toBe(0);
    run = nextTurn(run);
    expect(isNight(run.combat)).toBe(true);
    expect(run.combat.player.ward).toBe(2); // the Twilight Locket
    run = nextTurn(run);
    expect(isDay(run.combat)).toBe(true);
  });

  it('adds the Day bonus to Sunblade and the Night bonus to Moonguard', () => {
    let run = knight();
    run.combat.enemies = [foe('reefWarden')];
    const hp = run.combat.enemies[0].hp;
    run = play(run, 'sunblade');
    expect(hp - run.combat.enemies[0].hp).toBe(8);
    run = play(run, 'moonguard');
    expect(run.combat.player.ward).toBe(4);
    run = play(run, 'eclipse');
    expect(isNight(run.combat)).toBe(true);
    const ward = run.combat.player.ward;
    run = play(run, 'moonguard');
    expect(run.combat.player.ward - ward).toBe(6);
  });

  it('counts as both halves of the day under a Total Eclipse', () => {
    let run = knight();
    run.combat.enemies = [foe('reefWarden')];
    run = play(run, 'totalEclipse');
    expect(isDay(run.combat) && isNight(run.combat)).toBe(true);
    const hp = run.combat.enemies[0].hp;
    run = play(run, 'meteorLance');
    expect(hp - run.combat.enemies[0].hp).toBe(20);
  });

  it('holds the sky for a turn with Solstice', () => {
    let run = knight();
    run.combat.enemies = [foe('pageCrab', 'e0', { move: 'shell' })];
    run = play(run, 'solstice');
    run = nextTurn(run);
    expect(isDay(run.combat)).toBe(true);
    run = nextTurn(run);
    expect(isNight(run.combat)).toBe(true);
  });

  it('strikes every foe on each change with Twin Orbit', () => {
    let run = knight();
    run.combat.enemies = [foe('reefWarden', 'e0'), foe('pageCrab', 'e1')];
    run = play(run, 'twinOrbit');
    const hps = living(run.combat).map(enemy => enemy.hp);
    run = play(run, 'eclipse');
    living(run.combat).forEach((enemy, i) => expect(hps[i] - enemy.hp).toBe(5));
  });
});

describe('hero unlocks', () => {
  it('needs a boss beaten in the right region', () => {
    expect(heroUnlocked('tinker', {})).toBe(false);
    expect(heroUnlocked('tinker', { clears: { drowned: 2 } })).toBe(false);
    expect(heroUnlocked('tinker', { clears: { 2: 1 } })).toBe(true);
    expect(heroUnlocked('knight', { clears: { 3: 4 } })).toBe(false);
    expect(heroUnlocked('knight', { clears: { observatory: 1 } })).toBe(true);
    expect(heroUnlocked('caller', { clears: { 1: 1 } })).toBe(true);
  });

  it('credits old saves from their best act and reports new heroes', () => {
    expect(legacyClears({ bestAct: 3 })).toEqual({ 1: 1, 2: 1 });
    expect(heroUnlocked('tinker', { bestAct: 3 })).toBe(true);
    expect(newlyUnlocked({ clears: { 1: 1 } }, { clears: { 1: 1, observatory: 1 } })).toEqual(['knight']);
  });

  it('gives every hero three power cards in the Archive Gacha, playable only by that hero once pulled', () => {
    expect(ARCHIVE_CARDS).toHaveLength(49);
    Object.entries(HERO_PACK).forEach(([hero, ids]) => {
      expect(ids.map(id => CARDS[id].rarity)).toEqual(['uncommon', 'rare', 'mythic']);
      const other = hero === 'scribe' ? 'caller' : 'scribe';
      ids.forEach(id => {
        expect(ARCHIVE_CARDS).toContain(id);
        expect(CARDS[id].hero).toBe(hero);
        expect(cardPool(createRun({ seed: 3, hero }))).not.toContain(id);
        expect(cardPool(createRun({ seed: 3, hero, unlocked: [id] }))).toContain(id);
        expect(cardPool(createRun({ seed: 3, hero: other, unlocked: [id] }))).not.toContain(id);
        [false, true].forEach(up => describeCard({ id, up }).flat().forEach(seg => expect(seg, id).not.toBeUndefined()));
      });
    });
  });

  it('gives each new hero a full set of cards with text for every effect', () => {
    ['tinker', 'knight'].forEach(hero => {
      const own = Object.keys(CARDS).filter(id => CARDS[id].hero === hero);
      expect(own.length).toBeGreaterThanOrEqual(20);
      HEROES[hero].deck.forEach(id => expect(CARDS[id].hero).toBe(hero));
      own.forEach(id => [false, true].forEach(up => {
        const lines = describeCard({ id, up });
        expect(lines.length, id).toBeGreaterThan(0);
        lines.flat().forEach(seg => expect(seg, id).not.toBeUndefined());
      }));
    });
  });
});

// A tough training dummy: plenty of health, no Ward or special rules.
const dummy = (uid = 'e0') => foe('reefWarden', uid, { hp: 300, maxHp: 300 });
const lost = (run, uid = 'e0') => 300 - run.combat.enemies.find(enemy => enemy.uid === uid).hp;
const text = (id, ctx) => describeCard({ id, up: false }, ctx).flat().map(seg => (typeof seg === 'string' ? seg : seg.n ?? '')).join('');

describe('easier new heroes and the hero gacha cards', () => {
  it('starts the Tinker with a Release Valve, and overheating costs 4 health', () => {
    expect(HEROES.tinker.deck).toContain('releaseValve');
    expect(OVERHEAT_HP).toBe(4);
    let run = fight({ hero: 'tinker' });
    run.combat.enemies = [dummy()];
    run.combat.player.steam = 7;
    const ward = run.combat.player.ward;
    run = play(run, 'releaseValve');
    expect(run.combat.player.ward - ward).toBe(4 + 7);
    expect(run.combat.player.steam).toBe(0);
  });

  it('halves Steam with Spring Fist, fires a rocket per Steam and never overheats with the Steam Titan', () => {
    let run = fight({ hero: 'tinker' });
    run.combat.enemies = [dummy()];
    run.combat.player.steam = 6;
    run = play(run, 'springFist');
    expect(lost(run)).toBe(5 + 2 * 6);
    expect(run.combat.player.steam).toBe(3);
    const before = lost(run);
    run = play(run, 'rocketBarrage');
    expect(lost(run) - before).toBe(3 * 4);
    expect(run.combat.player.steam).toBe(0);
    run = play(run, 'steamTitan');
    expect(run.combat.player.steam).toBe(4);
    run.combat.player.steam = 12;
    const hp = run.hero.hp, dealt = lost(run);
    run = act(run, { type: 'END_TURN' });
    expect(run.hero.hp).toBe(hp);
    expect(lost(run) - dealt).toBe(12);
    expect(run.combat.player.steam).toBe(12);
  });

  it('doubles Day and Night bonuses with the Celestial Crown and flips the sky twice with Aurora', () => {
    let run = fight({ hero: 'knight' });
    run.combat.enemies = [dummy()];
    expect(isDay(run.combat)).toBe(true);
    run = play(run, 'sunblade');
    expect(lost(run)).toBe(5 + 3);
    run = play(run, 'celestialCrown');
    let before = lost(run);
    run = play(run, 'sunblade');
    expect(lost(run) - before).toBe(5 + 6);
    before = lost(run);
    run = play(run, 'duskWaltz');
    expect(lost(run) - before).toBe(5 * 3);
    expect(text('sunblade', { day: true, celestial: true })).toContain('11');
    run = play(run, 'twinOrbit');
    before = lost(run);
    run = play(run, 'aurora');
    expect(isDay(run.combat)).toBe(true);
    expect(lost(run) - before).toBe(5 * 2);
  });

  it('sharpens the Scribe with Sword & Shield and makes the hand stronger for good with Grand Inscription', () => {
    let run = fight({});
    run.combat.enemies = [dummy()];
    run = play(run, 'bladeBulwark');
    run = play(run, 'guard');
    expect(run.combat.player.st.edge).toBe(4);
    expect(text('slash', { edge: 4 })).toContain('10');
    const ward = run.combat.player.ward;
    run = play(run, 'slash');
    expect(lost(run)).toBe(6 + 4);
    expect(run.combat.player.st.edge).toBeUndefined();
    expect(run.combat.player.ward - ward).toBe(3);
    const kept = run.hero.deck.find(card => card.id === 'slash').uid;
    ['draw', 'discard'].forEach(pile => { run.combat[pile] = run.combat[pile].filter(uid => uid !== kept); });
    run.combat.hand = [kept];
    run = play(run, 'grandInscription');
    expect(run.hero.deck.find(card => card.uid === kept).bonus).toBe(2);
  });

  it('spends the familiar on every foe with Spirit Tide and doubles its bite with the Spirit King', () => {
    let run = fight({ hero: 'caller' });
    run.combat.enemies = [dummy('e0'), dummy('e1')];
    run.combat.player.familiar = 6;
    run = play(run, 'spiritTide');
    expect([lost(run, 'e0'), lost(run, 'e1')]).toEqual([9, 9]);
    expect(run.combat.player.familiar).toBe(3);
    run = play(run, 'spiritKing');
    expect(run.combat.player.familiar).toBe(7);
    const before = lost(run, 'e0') + lost(run, 'e1');
    run = play(run, 'frenzy');
    expect(run.combat.player.familiar).toBe(10);
    expect(lost(run, 'e0') + lost(run, 'e1') - before).toBe(20);
  });
});
