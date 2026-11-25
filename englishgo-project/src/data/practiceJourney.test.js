import { describe, expect, it } from 'vitest';
import { buildQuizQuestions, buildListeningQuestions, compareDictation, createPractice, normalizeDictation, practiceReducer, practiceNeedsReview, readPractice, mergeReviewInfo, removeReviewWords, restoreReviewWords, quizCloze } from './practiceJourney.js';

const words = [{ w: 'apple', m: '蘋果' }, { w: 'orange', m: '柳橙' }, { w: 'dog', m: '狗' }, { w: 'hound', m: '狗' }, { w: 'APPLE', m: '蘋果' }];
const rng = () => .5;
const round = () => createPractice('quiz', 'elementary', 'en2zh', buildQuizQuestions(words, { count: 3, random: rng }));

describe('small practice journeys', () => {
  it('uses unique words and unique options, excluding synonyms as reverse distractors', () => {
    for (const mode of ['en2zh', 'zh2en', 'mix']) {
      const questions = buildQuizQuestions(words, { mode, count: 10, random: rng });
      expect(new Set(questions.map(q => q.item.w.toLowerCase())).size).toBe(4);
      for (const question of questions) {
        expect(new Set(question.options.map(x => x.toLowerCase())).size).toBe(question.options.length);
        expect(question.options.filter(x => x === question.answer)).toHaveLength(1);
        if (question.kind === 'zh2en' && question.prompt === '狗') expect(question.options.includes('dog') && question.options.includes('hound')).toBe(false);
      }
    }
  });
  it('does not offer an unanswerable quiz from too few distinct meanings', () => {
    expect(buildQuizQuestions([{ w: 'dog', m: '狗' }, { w: 'hound', m: '狗' }])).toEqual([]);
  });
  it('carries authored forms, collocations and the word illustration into SRS review', () => {
    const item = { w: 'apple', m: '蘋果', p: 'n.', img: '🍎', f: [{ w: 'apples' }], c: ['an apple a day'], ex: 'I eat an apple.', ez: '我吃一顆蘋果。' };
    const question = buildQuizQuestions([item, words[1]], { random: rng }).find(q => q.item.w === 'apple');
    expect(question.item).toMatchObject(item);
  });
  it('prefers distractors with the same part of speech', () => {
    const tagged = [{ w: 'run', m: '跑', p: 'v.' }, { w: 'jump', m: '跳', p: 'v.' }, { w: 'swim', m: '游泳', p: 'v.' }, { w: 'eat', m: '吃', p: 'v./n.' }, { w: 'red', m: '紅色的', p: 'adj.' }, { w: 'cup', m: '杯子', p: 'n.' }];
    for (let seed = 0; seed < 5; seed++) {
      let n = seed; const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
      const question = buildQuizQuestions(tagged, { mode: 'zh2en', count: 6, random }).find(q => q.item.w === 'run');
      expect([...question.options].sort()).toEqual(['eat', 'jump', 'run', 'swim']);
    }
  });
  it('blanks only the exact word in its example and needs a Chinese sentence to stay unambiguous', () => {
    expect(quizCloze({ w: 'apple', ex: 'Apple pie and an apple-shaped apple.', ez: '蘋果派。' })).toBe('___ pie and an apple-shaped ___.');
    expect(quizCloze({ w: 'a few', ex: 'Wait a few minutes.', ez: '等幾分鐘。' })).toBe('Wait ___ minutes.');
    expect(quizCloze({ w: 'play', ex: 'He plays ball.', ez: '他打球。' })).toBeNull();
    expect(quizCloze({ w: 'dog', ex: 'The dog runs.' })).toBeNull();
    const mixed = [{ w: 'dog', m: '狗', ex: 'The dog runs.', ez: '狗在跑。' }, { w: 'cat', m: '貓' }, { w: 'sun', m: '太陽' }, { w: 'cup', m: '杯子' }];
    expect(buildQuizQuestions(mixed, { mode: 'cloze', count: 5, random: rng }).map(q => q.answer)).toEqual(['dog']);
    expect(buildQuizQuestions(mixed, { mode: 'mix', count: 4, random: rng }).map(q => q.kind).sort()).toEqual(['cloze', 'en2zh', 'en2zh', 'zh2en']);
  });
  it('asks only the target words while drawing distractors from the full deck', () => {
    const questions = buildQuizQuestions(words, { mode: 'en2zh', count: 5, random: rng, targets: [{ w: 'dog', m: '狗' }] });
    expect(questions).toHaveLength(1);
    expect(questions[0].options).toHaveLength(3);
    expect(buildQuizQuestions(words, { targets: [] })).toEqual([]);
  });
  it('brings a missed word back once, two questions later, and tracks the streak', () => {
    let state = createPractice('quiz', 'elementary', 'en2zh', buildQuizQuestions([...words, { w: 'cup', m: '杯子' }, { w: 'pen', m: '筆' }], { count: 5, random: rng }));
    state = practiceReducer(state, { type: 'ANSWER', value: state.questions[0].answer });
    expect(state).toMatchObject({ streak: 1, best: 1 });
    state = practiceReducer(state, { type: 'NEXT' });
    const missed = state.queue[1], q = state.questions[missed];
    state = practiceReducer(state, { type: 'ANSWER', value: q.options.find(o => o !== q.answer) });
    expect(state.queue).toEqual([0, 1, 2, 3, 1, 4]);
    expect(state).toMatchObject({ streak: 0, best: 1 });
    expect(readPractice(JSON.parse(JSON.stringify(state)), 'quiz', 'elementary')).toEqual(state);
    expect(readPractice({ ...state, queue: [1, 1, 1, 0] }, 'quiz', 'elementary')).toBeNull();
    for (let i = 2; i < 4; i++) { state = practiceReducer(practiceReducer(state, { type: 'NEXT' }), { type: 'ANSWER', value: state.questions[state.queue[i]].answer }); }
    state = practiceReducer(state, { type: 'NEXT' });
    expect(state.queue[state.index]).toBe(missed);
    state = practiceReducer(state, { type: 'ANSWER', value: q.options.find(o => o !== q.answer) });
    expect(state.queue).toHaveLength(6);
    state = practiceReducer(practiceReducer(state, { type: 'RETRY' }), { type: 'ANSWER', value: q.answer });
    expect(state.records[missed]).toMatchObject({ attempts: 3, firstCorrect: false, earned: true });
  });
  it('accepts punctuation, smart apostrophes, casing and repeated whitespace', () => {
    expect(normalizeDictation('  I   DON’T like apples! ')).toBe(normalizeDictation("I don't like apples."));
    expect(compareDictation('We go to school.', 'WE  go to school!!').correct).toBe(true);
  });
  it('aligns a missing word without marking all following words wrong', () => {
    const result = compareDictation('We go to school every day.', 'We go school every day');
    expect(result.words.filter(w => !w.match)).toEqual([{ word: 'to', match: false }]);
    expect(result.words.filter(w => w.match)).toHaveLength(5);
    expect(compareDictation('We go home.', 'We really go home').extras).toEqual(['really']);
  });
  it('gives repeated words separate tile identities and rejects unavailable tiles', () => {
    let state = createPractice('listening', 'elementary', 'tiles', buildListeningQuestions(['I think I can.'], 3, rng));
    expect(new Set(state.questions[0].tiles.map(t => t.id)).size).toBe(4);
    expect(practiceReducer(state, { type: 'TILE', id: 999 })).toBe(state);
    state = practiceReducer(state, { type: 'TILE', id: 2 });
    state = practiceReducer(state, { type: 'TILE', id: 0 });
    expect(state.answer).toBe('I I');
    state = practiceReducer(state, { type: 'TILE', id: 2 });
    expect(state.answer).toBe('I');
  });
  it('guards repeated answers and awards once when a wrong answer is corrected', () => {
    let state = round(); const q = state.questions[0];
    state = practiceReducer(state, { type: 'ANSWER', value: q.options.find(o => o !== q.answer) });
    expect(practiceReducer(state, { type: 'ANSWER', value: q.answer })).toBe(state);
    state = practiceReducer(state, { type: 'RETRY' });
    state = practiceReducer(state, { type: 'ANSWER', value: q.answer });
    expect(state.records[0]).toMatchObject({ attempts: 2, firstCorrect: false, earned: true });
    expect(practiceNeedsReview(state)).toContain(0);
  });
  it('retains earned rewards and first-attempt results during review and restore', () => {
    let state = round();
    state = practiceReducer(state, { type: 'HINT' });
    for (let i = 0; i < state.questions.length; i++) {
      state = practiceReducer(state, { type: 'ANSWER', value: state.questions[i].answer });
      state = practiceReducer(state, { type: 'NEXT' });
    }
    expect(state.status).toBe('done');
    expect(practiceNeedsReview(state)).toEqual([0]);
    expect(practiceReducer(state, { type: 'NEXT' })).toBe(state);
    state = practiceReducer(state, { type: 'REVIEW' });
    expect(state.queue).toEqual([0]);
    state = practiceReducer(state, { type: 'ANSWER', value: state.questions[0].answer });
    expect(state.records[0].earned).toBe(true);
    expect(readPractice(JSON.parse(JSON.stringify(state)), 'quiz', 'elementary')).toEqual(state);
    expect(state.completedMain).toBe(true);
  });
  it('rejects corrupt or other-grade saves and retains typed input', () => {
    const state = round();
    expect(readPractice({ ...state, index: -1 }, 'quiz', 'elementary')).toBeNull();
    expect(readPractice({ ...state, records: [] }, 'quiz', 'elementary')).toBeNull();
    expect(readPractice(state, 'quiz', 'junior')).toBeNull();
    const listening = practiceReducer(createPractice('listening', 'junior', 'typing', buildListeningQuestions(['We go home.'])), { type: 'INPUT', value: 'We go' });
    expect(readPractice(listening, 'listening', 'junior').answer).toBe('We go');
  });
  it('uses local meanings while keeping unknown review words visible', () => {
    const result = mergeReviewInfo([{ w: 'apple', n: 2 }, { w: 'unknown', n: 1 }], words);
    expect(result[0]).toMatchObject({ w: 'apple', m: '蘋果', n: 2 });
    expect(result[1].m).toBeUndefined();
  });
  it('removes only current-grade words and undo preserves newer practice counts', () => {
    const removed = [{ w: 'apple', level: 'elementary', n: 2 }];
    const other = { w: 'apple', level: 'junior', n: 5 };
    expect(removeReviewWords([...removed, other], removed, 'elementary')).toEqual([other]);
    expect(restoreReviewWords([other, { ...removed[0], n: 4 }], removed)).toEqual([other, { ...removed[0], n: 4 }]);
    expect(restoreReviewWords([other], removed)).toEqual([other, ...removed]);
  });
});
