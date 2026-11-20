import { describe, expect, it } from 'vitest';
import { ARCHIVE_CARDS, CARDS } from '../data/cards.js';
import { FOIL_CHANCE, FOIL_RULE, REFUND, dismissNotice, emptyCollection, normalizeCollection, pullArchive } from '../archive.js';
import { canUpgrade, createRun, isFoil, runReducer } from './engine.js';

const act = (run, action) => runReducer(run, action);
const owning = ids => ({ ...emptyCollection(), shards: 1000, owned: Object.fromEntries(ids.map(id => [id, 1])) });

describe('echo archive foil cards', () => {
  it('turns only one duplicate in ten into a foil', () => {
    // Every pull lands on an owned card; the last random draw decides the foil.
    const all = owning(ARCHIVE_CARDS);
    const rolls = draw => { let i = 0; return () => (i++ % 3 === 2 ? draw : 0.5); };
    const lucky = pullArchive(all, 1, rolls(FOIL_CHANCE / 100 - 0.001));
    expect(lucky.results[0].outcome).toBe('foil');
    expect(lucky.collection.foils).toHaveLength(1);
    const plain = pullArchive(all, 1, rolls(FOIL_CHANCE / 100 + 0.001));
    expect(plain.results[0].outcome).toBe('refund');
    expect(plain.results[0].refund).toBe(REFUND[plain.results[0].rarity]);
    expect(plain.collection.foils).toHaveLength(0);
    let foils = 0, pulls = 0;
    let collection = { ...all, shards: 1e6 };
    for (let i = 0; i < 100; i++) {
      const result = pullArchive(collection, 10);
      foils += result.results.filter(item => item.outcome === 'foil').length;
      pulls += 10;
      collection = { ...result.collection, foils: [] };
    }
    expect(foils / pulls).toBeGreaterThan(0.05);
    expect(foils / pulls).toBeLessThan(0.15);
  });

  it('trades foils from the old rule back for shards once, with a notice', () => {
    const [common, mythic] = [ARCHIVE_CARDS.find(id => CARDS[id].rarity === 'common'), ARCHIVE_CARDS.find(id => CARDS[id].rarity === 'mythic')];
    const old = { shards: 10, owned: { [common]: 2, [mythic]: 3 }, foils: [common, mythic], welcomed: true };
    const moved = normalizeCollection(old);
    expect(moved.foils).toEqual([]);
    expect(moved.shards).toBe(10 + REFUND.common + REFUND.mythic);
    expect(moved.notice).toEqual({ kind: 'foilRefund', count: 2, shards: REFUND.common + REFUND.mythic });
    expect(moved.foilRule).toBe(FOIL_RULE);
    const again = normalizeCollection({ ...moved, foils: [common] });
    expect(again.foils).toEqual([common]);
    expect(again.shards).toBe(moved.shards);
    expect(dismissNotice(again).notice).toBeNull();
    expect(normalizeCollection({ shards: 5, owned: {}, foils: [] }).notice).toBeNull();
  });

  it('brings foil cards into a run already upgraded', () => {
    const [foil, plain] = ARCHIVE_CARDS.filter(id => ['attack', 'skill'].includes(CARDS[id].type));
    let run = createRun({ seed: 4, unlocked: [foil, plain], foils: [foil, 'notACard'] });
    expect(run.foils).toEqual([foil]);
    expect(isFoil(run, foil)).toBe(true);
    expect(createRun({ seed: 4, unlocked: [plain], foils: [foil] }).foils).toEqual([]);
    run = act(run, { type: 'EVENT_CHOOSE', index: 3 });
    run = act(run, { type: 'EVENT_CONTINUE' });
    run.screen = 'reward';
    run.reward = { kind: 'event', items: [{ kind: 'cards', options: [foil, plain], taken: false }], after: 'map' };
    const tookFoil = act(run, { type: 'TAKE_REWARD', index: 0, choice: 0 });
    const card = tookFoil.hero.deck.at(-1);
    expect(card).toMatchObject({ id: foil, up: true });
    expect(canUpgrade(card)).toBe(false);
    const tookPlain = act(run, { type: 'TAKE_REWARD', index: 0, choice: 1 });
    expect(tookPlain.hero.deck.at(-1)).toMatchObject({ id: plain, up: false });
  });
});
