import { describe, expect, it } from 'vitest';
import { buildDailyMiniDeck } from './learningJourney.js';
describe('daily mini mission',()=>{
  const words=Array.from({length:12},(_,i)=>({w:`word${i}`,m:`字${i}`}));
  it('offers five unique words without mutating the available catalog',()=>{const original=JSON.stringify(words);const deck=buildDailyMiniDeck([...words,words[0]],[],'2026-09-05');expect(deck).toHaveLength(5);expect(new Set(deck.map(w=>w.w)).size).toBe(5);expect(JSON.stringify(words)).toBe(original)});
  it('uses the same daily deck and prioritizes less familiar words',()=>{const deck=buildDailyMiniDeck(words,[{w:'WORD8',n:4}],'2026-09-05');expect(deck[0].w).toBe('word8');expect(deck).toEqual(buildDailyMiniDeck(words,[{w:'word8',n:4}],'2026-09-05'))});
  it('works offline with a small catalog and skips incomplete cards',()=>{expect(buildDailyMiniDeck([{w:'apple',m:'蘋果'},{w:'bad'},null],[])).toEqual([{w:'apple',m:'蘋果'}]);expect(buildDailyMiniDeck([],[])).toEqual([])});
});
