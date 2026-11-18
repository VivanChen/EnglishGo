import { describe, expect, it } from 'vitest';
import { storyWords, wordAtBoundary, wordAtProgress } from './speechTiming.js';

describe('speech word timing', () => {
  it('keeps punctuation and repeated words mapped to their actual character positions', () => {
    const words = storyWords('A fox, a little fox.');
    expect(words.map(w => w.text)).toEqual(['A','fox,','a','little','fox.']);
    expect(wordAtBoundary(words, 16)).toBe(4);
    expect(wordAtBoundary(words, 1)).toBe(-1);
    expect(wordAtProgress(words, 0, 10)).toBe(0);
    expect(wordAtProgress(words, 10, 10)).toBe(4);
    expect(wordAtProgress(words, 2, NaN)).toBe(-1);
  });
});
