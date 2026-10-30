import { describe, expect, it } from 'vitest';
import { findVocabularyWord } from './vocabularyLookup.js';

describe('vocabulary lookup spelling priority', () => {
  it('opens demographics rather than the earlier demographic illustration', () => {
    const extra = { senior: [{ w: 'demographic', m: '人口的' }, { w: 'demographics', m: '人口統計' }] };
    expect(findVocabularyWord({}, extra, ['senior'], ['demographics', 'demographic'])).toMatchObject({ w: 'demographics', m: '人口統計' });
  });
  it('prefers an exact supplemental headword over a built-in inflection candidate', () => {
    expect(findVocabularyWord({ senior: [{ w: 'custom' }] }, { senior: [{ w: 'customs' }] }, ['senior'], ['customs', 'custom'])).toMatchObject({ w: 'customs', source: '補充重點單字' });
  });
  it('keeps the preferred level and built-in card when the spelling is the same', () => {
    const card = { w: 'bridge', m: '橋' };
    const hit = findVocabularyWord({ senior: [card], junior: [{ w: 'bridge', m: 'other' }] }, { senior: [{ w: 'bridge', m: 'extra' }] }, ['senior', 'junior'], ['bridge']);
    expect(hit).toMatchObject({ w: 'bridge', m: '橋', level: 'senior', source: '本地單字卡' });
    expect(hit).not.toBe(card);
  });
  it('still finds an inflected fallback when the exact spelling is absent', () => {
    expect(findVocabularyWord({ junior: [{ w: 'bridge' }] }, {}, ['senior', 'junior'], ['bridges', 'bridg', 'bridge'])).toMatchObject({ w: 'bridge', level: 'junior' });
    expect(findVocabularyWord({}, {}, ['senior'], ['missing'])).toBeNull();
  });
});
