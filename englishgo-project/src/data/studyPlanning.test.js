import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveStudyDay, dailyProgress, learningStreak, localDay, studyWeek, achievementProgress } from './studyProgress.js';
import { parseExamDraft, readExamReview, examSignature, resolveExamCards } from './examPlanner.js';
afterEach(() => vi.useRealTimers());
describe('study planning data', () => {
  it('includes live progress today, deduplicates history, and crosses month boundaries', () => {
    const now = new Date(2026, 8, 3, 10), daily = { date: now.toDateString(), done: 4, target: 10 };
    const history = [{ date: '2026-08-31', done: 3 }, { date: '2026-08-31', done: 7 }, { date: '2026-09-03', done: 10 }];
    const week = studyWeek(history, daily, now);
    expect(week).toHaveLength(7); expect(week[0].key).toBe('2026-08-28');
    expect(week.find(day => day.key === '2026-08-31').done).toBe(7);
    expect(week.at(-1).done).toBe(4); expect(week.at(-1).today).toBe(true);
    expect(archiveStudyDay(archiveStudyDay([], daily), daily)).toHaveLength(1);
  });
  it('clamps invalid daily values and requires activity before counting today as a learning day', () => {
    const now = new Date(2026, 8, 3), date = now.toDateString();
    expect(dailyProgress({ done: 100, target: 5 }).percent).toBe(100);
    expect(dailyProgress({ done: -3, target: 0 })).toMatchObject({ done: 0, target: 10 });
    expect(learningStreak(3, { date, done: 0 }, now)).toBe(2);
    expect(learningStreak(3, { date, done: 1 }, now)).toBe(3);
    expect(learningStreak(100, { date: '2026-08-31', done: 10 }, now)).toBe(0);
    expect(localDay('invalid')).toBe('');
  });
  it('keeps collected badges when their current metric drops and ignores unknown badge ids', () => {
    const rows = achievementProgress([{ id: 'days', metric: 'streak', target: 7 }], ['days', 'days', 'unknown'], { streak: 1 });
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ earned: true, remaining: 6, percent: 14 });
  });
  it('distinguishes duplicate words from the 80-word limit without losing the remaining input', () => {
    const words = Array.from({ length: 85 }, (_, i) => `word${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`);
    const parsed = parseExamDraft(`APPLE apple\n${words.join(', ')} --`);
    expect(parsed.words).toHaveLength(80); expect(parsed.overflow).toBe(6); expect(parsed.ignored).toBe(2); expect(parsed.allWords).toHaveLength(86);
    expect(readExamReview({ signature: examSignature(['apple']), cards: [{ w: 'apple', m: '蘋果' }] }, ['book'])).toBeNull();
  });
  it('prefers cloud entries, retains authored local examples, and does not invent missing content', async () => {
    const result = await resolveExamCards(['apple', 'book', 'unknown'], { lookupCloud: async word => word === 'apple' ? { m: '蘋果（雲端）' } : null,
      lookupLocal: async word => word === 'book' ? { m: '書', ex: 'Read a book.', ez: '讀一本書。' } : word === 'apple' ? { m: '蘋果' } : null });
    expect(result[0].m).toBe('蘋果（雲端）'); expect(result[1].ez).toBe('讀一本書。'); expect(result[2]).toMatchObject({ m: '', ex: '', ez: '', customMissing: true });
  });
  it('bounds waiting on unavailable sources and stops progress events after cancellation', async () => {
    vi.useFakeTimers(); const pending = new Promise(() => {}), progress = vi.fn();
    const done = resolveExamCards(['apple'], { lookupCloud: () => pending, lookupLocal: () => pending, onProgress: progress, budget: 50 });
    await vi.advanceTimersByTimeAsync(60); expect((await done)[0].customMissing).toBe(true);
    const controller = new AbortController(); progress.mockClear();
    const cancelled = resolveExamCards(['book', 'apple'], { lookupCloud: () => pending, lookupLocal: () => pending, onProgress: progress, signal: controller.signal });
    controller.abort(); expect(await cancelled).toEqual([]); expect(progress).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
});
