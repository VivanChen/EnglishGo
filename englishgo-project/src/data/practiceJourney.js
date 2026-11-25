export const wordKey = value => String(value || '').trim().toLowerCase();

export function shufflePractice(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function normalizeDictation(text) {
  return String(text || '').normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

// Align words, so a missing word does not make the rest of the sentence look wrong.
export function compareDictation(expected, actual) {
  const target = normalizeDictation(expected).split(' ').filter(Boolean);
  const input = normalizeDictation(actual).split(' ').filter(Boolean);
  const grid = Array.from({ length: target.length + 1 }, () => Array(input.length + 1).fill(0));
  for (let i = target.length - 1; i >= 0; i--) for (let j = input.length - 1; j >= 0; j--)
    grid[i][j] = target[i] === input[j] ? 1 + grid[i + 1][j + 1] : Math.max(grid[i + 1][j], grid[i][j + 1]);
  const words = [], extras = [];
  let i = 0, j = 0;
  while (i < target.length || j < input.length) {
    if (i < target.length && j < input.length && target[i] === input[j]) { words.push({ word: target[i++], match: true }); j++; }
    else if (i < target.length && (j >= input.length || grid[i + 1][j] >= grid[i][j + 1])) words.push({ word: target[i++], match: false });
    else extras.push(input[j++]);
  }
  return { correct: normalizeDictation(expected) === normalizeDictation(actual), words, extras };
}

export const QUIZ_KINDS = ['en2zh', 'zh2en', 'cloze'];
export const QUIZ_BLANK = '___';
const QUIZ_MODES = [...QUIZ_KINDS, 'mix'];
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const posKey = item => String(item?.p || '').trim().toLowerCase().split(/[/,;\s]/)[0];

function uniqueQuizWords(words) {
  const seen = new Set();
  return (words || []).filter(item => {
    if (typeof item?.w !== 'string' || typeof item?.m !== 'string' || !item.w.trim() || !item.m.trim() || seen.has(wordKey(item.w))) return false;
    seen.add(wordKey(item.w)); return true;
  });
}

// Only the exact word is blanked, so the options always fit the sentence as written.
// The Chinese sentence is required: it makes the one right answer clear among same-POS options.
export function quizCloze(item) {
  const word = String(item?.w || '').trim(), sentence = String(item?.ex || '');
  if (!word || !sentence.trim() || !String(item?.ez || '').trim()) return null;
  const pattern = () => new RegExp(`(^|[^A-Za-z'’-])${escapeRegExp(word)}(?=$|[^A-Za-z'’-])`, 'gi');
  return pattern().test(sentence) ? sentence.replace(pattern(), (_, lead) => `${lead}${QUIZ_BLANK}`) : null;
}

// targets: the words to ask about (for example weak words); distractors still come from the whole pool.
export function buildQuizQuestions(words, { mode = 'en2zh', count = 5, random = Math.random, targets = null } = {}) {
  const askable = uniqueQuizWords(targets || words);
  const pool = uniqueQuizWords([...askable, ...(words || [])]);
  const used = { en2zh: 0, zh2en: 0, cloze: 0 };
  return shufflePractice(askable, random).flatMap(item => {
    const cloze = mode === 'cloze' || mode === 'mix' ? quizCloze(item) : null;
    if (mode === 'cloze' && !cloze) return [];
    // Mixed rounds keep the three kinds balanced, giving the blank to words that have an example.
    const kind = mode !== 'mix' ? mode : (cloze ? ['cloze', 'en2zh', 'zh2en'] : ['en2zh', 'zh2en']).reduce((best, k) => used[k] < used[best] ? k : best);
    const english = kind !== 'en2zh', answer = english ? item.w : item.m, same = posKey(item);
    // Synonymous meanings must not create multiple defensible answers.
    const others = shufflePractice(pool, random).filter(other => wordKey(other.w) !== wordKey(item.w) && wordKey(other.m) !== wordKey(item.m));
    // Same part of speech first, so the answer cannot be guessed from the shape of the word alone.
    const ranked = same ? [...others.filter(other => posKey(other) === same), ...others.filter(other => posKey(other) !== same)] : others;
    const options = new Map([[wordKey(answer), answer]]);
    for (const other of ranked) {
      const option = english ? other.w : other.m;
      if (!options.has(wordKey(option))) options.set(wordKey(option), option);
      if (options.size >= 4) break;
    }
    if (options.size < 2) return [];
    used[kind]++;
    return [{ item: { ...item, ph: item.ph || '', ex: item.ex || '', ez: item.ez || '' }, kind,
      prompt: kind === 'cloze' ? cloze : kind === 'en2zh' ? item.w : item.m, answer, options: shufflePractice([...options.values()], random) }];
  }).slice(0, count);
}

export function buildListeningQuestions(sentences, count = 3, random = Math.random) {
  return shufflePractice([...new Set(sentences.filter(s => typeof s === 'string' && s.trim()))], random).slice(0, count).map(sentence => ({
    answer: sentence, tiles: shufflePractice(sentence.split(/\s+/).map((text, id) => ({ text, id })), random),
  }));
}

export function createPractice(kind, level, mode, questions) {
  return { version: 1, kind, level, mode, questions, queue: questions.map((_, i) => i), index: 0, round: 'main',
    records: questions.map(() => ({ attempts: 0, firstCorrect: null, hinted: false, earned: false })),
    status: 'question', feedback: null, answer: '', pickedTiles: [], hintShown: false, completedMain: false, streak: 0, best: 0 };
}

export function readPractice(value, kind, level) {
  if (!value || value.version !== 1 || value.kind !== kind || value.level !== level || !Array.isArray(value.questions)
    || !value.questions.length || value.questions.length > 10 || !Array.isArray(value.records) || value.records.length !== value.questions.length
    || !Array.isArray(value.queue) || !value.queue.length || value.queue.some(i => value.queue.filter(j => j === i).length > 2)
    || value.queue.some(i => !Number.isInteger(i) || !value.questions[i]) || !Number.isInteger(value.index)
    || value.index < 0 || value.index >= value.queue.length || !['question', 'done'].includes(value.status)
    || !['main', 'review'].includes(value.round) || !(kind === 'quiz' ? QUIZ_MODES : ['tiles', 'typing']).includes(value.mode)
    || ![null, true, false].includes(value.feedback) || typeof value.answer !== 'string'
    || [value.streak, value.best].some(n => n !== undefined && (!Number.isInteger(n) || n < 0))
    || value.records.some(r => !r || !Number.isInteger(r.attempts) || r.attempts < 0 || ![null, true, false].includes(r.firstCorrect) || typeof r.earned !== 'boolean' || typeof r.hinted !== 'boolean')
    || value.questions.some(q => !q || typeof q.answer !== 'string' || (kind === 'quiz'
      ? typeof q.item?.w !== 'string' || typeof q.item?.m !== 'string' || typeof q.prompt !== 'string' || !QUIZ_KINDS.includes(q.kind) || !Array.isArray(q.options) || q.options.some(o => typeof o !== 'string') || !q.options.includes(q.answer)
      : !Array.isArray(q.tiles) || q.tiles.some(t => typeof t.text !== 'string' || !Number.isInteger(t.id))))) return null;
  if (!Array.isArray(value.pickedTiles) || value.pickedTiles.some(id => !Number.isInteger(id) || !value.questions[value.queue[value.index]].tiles?.some(t => t.id === id))) return null;
  return value;
}

export function practiceNeedsReview(state) {
  return state.records.flatMap((record, i) => record.firstCorrect !== true || record.hinted ? [i] : []);
}

export function practiceReducer(state, action) {
  if (!state) return state;
  if (action.type === 'REVIEW' && state.status === 'done') {
    const queue = practiceNeedsReview(state);
    return queue.length ? { ...state, queue, index: 0, round: 'review', status: 'question', feedback: null, answer: '', pickedTiles: [], hintShown: false, streak: 0 } : state;
  }
  if (state.status !== 'question') return state;
  const qi = state.queue[state.index], question = state.questions[qi], record = state.records[qi];
  if (action.type === 'INPUT' && state.feedback === null) return { ...state, answer: String(action.value).slice(0, 500) };
  if (action.type === 'TILE' && state.feedback === null && question.tiles?.some(t => t.id === action.id)) {
    const pickedTiles = state.pickedTiles.includes(action.id) ? state.pickedTiles.filter(id => id !== action.id) : [...state.pickedTiles, action.id];
    return { ...state, pickedTiles, answer: pickedTiles.map(id => question.tiles.find(t => t.id === id).text).join(' ') };
  }
  if (action.type === 'HINT' && state.feedback === null) return { ...state, hintShown: true, records: state.records.map((r, i) => i === qi ? { ...r, hinted: true } : r) };
  if (action.type === 'ANSWER' && state.feedback === null) {
    const answer = action.value ?? state.answer;
    if (!String(answer).trim() || (state.kind === 'quiz' && !question.options.includes(answer))) return state;
    const correct = state.kind === 'quiz' ? answer === question.answer : normalizeDictation(answer) === normalizeDictation(question.answer);
    const streak = correct ? (state.streak || 0) + 1 : 0;
    // A missed quiz word comes back a couple of questions later in the same round, once.
    let queue = state.queue;
    if (!correct && state.kind === 'quiz' && !queue.slice(state.index + 1).includes(qi) && queue.filter(i => i === qi).length < 2) {
      const at = Math.min(queue.length, state.index + 3);
      queue = [...queue.slice(0, at), qi, ...queue.slice(at)];
    }
    return { ...state, queue, answer, feedback: correct, streak, best: Math.max(state.best || 0, streak), records: state.records.map((r, i) => i === qi ? {
      ...r, attempts: r.attempts + 1, firstCorrect: r.firstCorrect ?? correct, earned: r.earned || correct,
    } : r) };
  }
  if (action.type === 'RETRY' && state.feedback === false) return { ...state, feedback: null, answer: '', pickedTiles: [], hintShown: false };
  if (action.type === 'NEXT' && state.feedback !== null) {
    if (state.index + 1 === state.queue.length) return { ...state, status: 'done', completedMain: true };
    return { ...state, index: state.index + 1, feedback: null, answer: '', pickedTiles: [], hintShown: false };
  }
  return state;
}

export function mergeReviewInfo(weakWords, localWords, extraWords = []) {
  const catalog = new Map([...extraWords, ...localWords].filter(w => w?.w).map(w => [wordKey(w.w), w]));
  return [...weakWords].sort((a, b) => b.n - a.n).map(w => ({ ...w, ...(catalog.get(wordKey(w.w)) || {}), w: w.w, n: w.n }));
}

export function removeReviewWords(words, removed, level) {
  const keys = new Set(removed.map(item => wordKey(item.w)));
  return words.filter(item => !keys.has(wordKey(item.w)) || (item.level && item.level !== level));
}

export function restoreReviewWords(words, removed) {
  const result = [...words];
  for (const item of removed) {
    const index = result.findIndex(current => wordKey(current.w) === wordKey(item.w) && current.level === item.level);
    if (index === -1) result.push(item);
    else result[index] = { ...item, ...result[index], n: Math.max(item.n || 0, result[index].n || 0) };
  }
  return result;
}
