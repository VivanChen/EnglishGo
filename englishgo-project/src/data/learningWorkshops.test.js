import { describe, expect, it } from 'vitest';
import { grammarRecord, grammarStep, grammarBuildSentences, grammarTiles, grammarBuildCheck, grammarMixedQuestions, createSpeakingRound, recordSpeakingAttempt, advanceSpeakingRound, reviewSpeakingRound, readSpeakingRound, songLineRange, songRecord } from './learningWorkshops.js';
const rule = { t: 'Be', q: { s: 'I ___ ready.', o: ['am', 'is'], a: 0 } };
describe('workshop progress', () => {
  it('unlocks grammar steps from valid saved answers and invalidates changed lessons', () => {
    const drills = [rule.q], record = grammarRecord({}, rule, drills);
    expect(grammarStep(record, 1)).toBe(0);
    expect(grammarStep({ ...record, studied: true }, 1)).toBe(1);
    const book = { lessons: { Be: { ...record, studied: true, drills: { 0: 1 }, answer: 0, earned: true } } };
    expect(grammarStep(grammarRecord(book, rule, drills), 1)).toBe(3);
    expect(grammarStep(grammarRecord(book, rule, drills), 1, 1)).toBe(2);
    expect(grammarRecord(book, { ...rule, q: { ...rule.q, a: 1 } }, drills).earned).toBe(false);
    book.lessons.Be.drills[0] = 99;
    expect(grammarStep(grammarRecord(book, rule, drills), 1)).toBe(1);
  });
  it('keeps built sentences that still belong to the lesson and opens the challenge once all are built', () => {
    const drills = [rule.q], sentences = [{ en: 'I am ready.', zh: '我準備好了。' }];
    const book = { lessons: { Be: { ...grammarRecord({}, rule, drills), studied: true, drills: { 0: 0 }, built: ['I am ready.', 'Old sentence.', 3] } } };
    const record = grammarRecord(book, rule, drills, sentences);
    expect(record.built).toEqual(['I am ready.']);
    expect(grammarStep(record, 1, 1)).toBe(3);
    expect(grammarStep({ ...record, built: [] }, 1, 1)).toBe(2);
    expect(grammarRecord({ lessons: { Be: { ...book.lessons.Be, built: 'bad' } } }, rule, drills).built).toEqual([]);
  });
  it('picks short translated examples as blocks and shuffles them the same way every time', () => {
    const examples = [{ en: 'No translation here.', zh: '' }, { en: 'Hi.', zh: '嗨。' }, { en: 'We have finished the project.', zh: '我們完成了專題。' }, { en: 'We have finished the project.', zh: '重複' }, { en: 'She has been to Japan twice.', zh: '她去過日本兩次。' }, { en: 'I have lived here.', zh: '我住在這裡。' }];
    expect(grammarBuildSentences(examples).map(s => s.en)).toEqual(['We have finished the project.', 'She has been to Japan twice.']);
    for (const sentence of ['I am ready.', 'We have finished the project.', 'a b']) {
      const tiles = grammarTiles(sentence);
      expect(tiles).toEqual(grammarTiles(sentence));
      expect(tiles.map(t => t.text)).not.toEqual(sentence.split(' '));
      expect(tiles.map(t => t.text).sort()).toEqual(sentence.split(' ').sort());
    }
    expect(grammarBuildCheck('the cat and the dog', ['the', 'cat', 'and', 'the', 'dog']).correct).toBe(true);
    expect(grammarBuildCheck('I am ready.', ['am', 'I', 'ready.'])).toEqual({ correct: false, slots: [false, false, true] });
  });
  it('mixes drills and challenges from chosen lessons and skips malformed questions', () => {
    const rules = [{ t: 'A', q: { s: 'a ___', o: ['x', 'y'], a: 0 } }, { t: 'B', q: { s: 'b ___', o: ['x', 'y'], a: 1 } }, { t: 'C', q: { s: 'c ___', o: ['x'], a: 0 } }];
    const drills = rule => rule.t === 'A' ? [{ s: 'a2 ___', o: ['x', 'y'], a: 1, e: 'why' }] : [];
    const all = grammarMixedQuestions(rules, drills, { count: 10, random: () => .5 });
    expect(all.map(q => q.s).sort()).toEqual(['a ___', 'a2 ___', 'b ___']);
    expect(all.find(q => q.s === 'a2 ___')).toMatchObject({ topic: 'A', lesson: 0, e: 'why' });
    expect(grammarMixedQuestions(rules, drills, { lessons: [1] }).map(q => q.topic)).toEqual(['B']);
    expect(grammarMixedQuestions(rules, drills, { count: 2 })).toHaveLength(2);
  });
  it('preserves per-item awards across retries and reviews only missed items', () => {
    const round = createSpeakingRound([{ en: 'apple', zh: '蘋果' }, { en: 'dog', zh: '狗' }], 'mixed');
    const comparison = { pct: 100, result: [{ word: 'apple', ok: true }], extra: [] };
    const first = recordSpeakingAttempt(round, comparison, 'apple', 80);
    expect(first.reward).toBe(15);
    expect(recordSpeakingAttempt(first.round, comparison, 'apple', 80).reward).toBe(0);
    const review = reviewSpeakingRound(advanceSpeakingRound(first.round));
    expect(review.queue).toEqual([1]);
    expect(review.records.apple.earned).toBe(true);
    expect(readSpeakingRound(JSON.parse(JSON.stringify(review)))).toEqual(review);
    review.records.apple.comparison.result = null;
    expect(readSpeakingRound(review)).toBeNull();
  });
  it('uses source timestamps across section markers, including the final lyric', () => {
    const lines = [{ sec: 'Verse' }, { t: 10, en: 'One' }, { sec: 'Chorus' }, { t: 17.5, en: 'Two' }];
    expect(songLineRange(lines, 1, 24)).toEqual({ start: 10, end: 17.5 });
    expect(songLineRange(lines, 3, 24)).toEqual({ start: 17.5, end: 24 });
    expect(songLineRange(lines, 3, 0)).toBeNull();
    expect(songLineRange([{ t: null, en: 'Missing' }], 0, 20)).toBeNull();
    expect(songLineRange(lines, 0, 24)).toBeNull();
  });
  it('invalidates song progress when source audio or lyrics change', () => {
    const song = { id: 'one', audio: '/one.mp3', lines: [{ t: 0, en: 'One' }], vocab: ['one'] };
    const book = { songs: { one: { ...songRecord({}, song), position: 10, practiced: [0, 99], listened: true } } };
    expect(songRecord(book, song).practiced).toEqual([0]);
    expect(songRecord(book, { ...song, audio: '/new.mp3' }).listened).toBe(false);
  });
});
