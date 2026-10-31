import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import courses from './hanlinHereWeGoCourses.json';
import { HERE_WE_GO_DECKS, getHereWeGoCards } from './hanlinHereWeGoWords.js';

describe('Here We Go theme vocabulary', () => {
  it('covers all eight reviewed book lists with pictures and bilingual examples', () => {
    expect(HERE_WE_GO_DECKS.map(deck => deck.book)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const all = HERE_WE_GO_DECKS.flatMap(deck => {
      const cards = getHereWeGoCards(deck.id);
      expect(cards.map(card => card.w)).toEqual(courses[deck.book - 1].words);
      expect(new Set(cards.map(card => card.w.toLowerCase())).size).toBe(cards.length);
      for (const card of cards) {
        expect(card.m, card.w).toMatch(/[\u3400-\u9fff]/);
        expect(card.ex.toLowerCase(), card.w).toContain(card.w.toLowerCase());
        expect(card.ex).not.toMatch(/[\u3400-\u9fff]/);
        expect(card.ez, card.w).toMatch(/[\u3400-\u9fff]/);
        expect(existsSync(`public${card.img}`), card.w).toBe(true);
        expect(card.illustration.example).toBe(card.ex);
        expect(card.illustration.example_zh).toBe(card.ez);
        expect(card.curriculumSource).toMatch(/^https:\/\//);
      }
      return cards;
    });
    expect(all).toHaveLength(238);
  });

  it('keeps weather and illness meanings separate across books', () => {
    const weather = getHereWeGoCards('hanlin-here-we-go-3').find(card => card.w === 'cold');
    const illness = getHereWeGoCards('hanlin-here-we-go-6').find(card => card.w === 'cold');
    expect(weather.p).toBe('adj.');
    expect(illness).toMatchObject({ p: 'n.', m: '感冒' });
    expect(illness.img).not.toBe(weather.img);
    expect(illness.ex).toContain('have a cold');
    expect(getHereWeGoCards('hanlin-hooray-all')).toEqual([]);
  });
});
