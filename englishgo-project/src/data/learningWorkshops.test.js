import { describe, expect, it } from 'vitest';
import { grammarRecord, grammarStep, createSpeakingRound, recordSpeakingAttempt, advanceSpeakingRound, reviewSpeakingRound, readSpeakingRound, songLineRange, songRecord } from './learningWorkshops.js';
const rule = { t: 'Be', q: { s: 'I ___ ready.', o: ['am', 'is'], a: 0 } };
describe('workshop progress', () => {
  it('unlocks grammar steps from valid saved answers and invalidates changed lessons', () => {
    const drills = [rule.q], record = grammarRecord({}, rule, drills);
    expect(grammarStep(record, 1)).toBe(0);
    expect(grammarStep({ ...record, studied: true }, 1)).toBe(1);
    const book = { lessons: { Be: { ...record, studied: true, drills: { 0: 1 }, answer: 0, earned: true } } };
    expect(grammarStep(grammarRecord(book, rule, drills), 1)).toBe(2);
    expect(grammarRecord(book, { ...rule, q: { ...rule.q, a: 1 } }, drills).earned).toBe(false);
    book.lessons.Be.drills[0] = 99;
    expect(grammarStep(grammarRecord(book, rule, drills), 1)).toBe(1);
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
