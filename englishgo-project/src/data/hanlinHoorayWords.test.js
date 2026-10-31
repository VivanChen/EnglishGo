import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { HOORAY_DECKS, HOORAY_WORDS, getHoorayCards } from './hanlinHoorayWords.js';

describe('Hooray ABC review', () => {
  it('covers the 52 source entries with local pictures and bilingual examples', () => {
    expect(HOORAY_WORDS).toHaveLength(52);
    expect(new Set(HOORAY_WORDS.map(card => card.w)).size).toBe(52);
    for (const card of HOORAY_WORDS) {
      expect(card.m).toMatch(/[\u3400-\u9fff]/);
      expect(card.ex.toLowerCase()).toContain(card.w);
      expect(card.ex).not.toMatch(/[\u3400-\u9fff]/);
      expect(card.ez).toMatch(/[\u3400-\u9fff]/);
      expect(existsSync(`public${card.img}`), card.w).toBe(true);
      expect(card.illustration.example).toBe(card.ex);
    }
  });
  it('partitions A–M and N–Z without losing words or including other series', () => {
    const [all, first, second] = HOORAY_DECKS.map(deck => getHoorayCards(deck.id));
    expect([...first, ...second]).toEqual(all);
    expect(first).toHaveLength(26);
    expect(second).toHaveLength(26);
    expect(first[0].w).toBe('ant');
    expect(second.at(-1).w).toBe('zebra');
    expect(getHoorayCards('kanghsuan-elementary-1')).toEqual([]);
  });
});
