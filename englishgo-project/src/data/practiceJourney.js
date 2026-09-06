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

export function buildQuizQuestions(words, { mode = 'en2zh', count = 5, random = Math.random } = {}) {
  const seen = new Set();
  const pool = (words || []).filter(item => {
    if (typeof item?.w !== 'string' || typeof item?.m !== 'string' || !item.w.trim() || !item.m.trim() || seen.has(wordKey(item.w))) return false;
    seen.add(wordKey(item.w)); return true;
  });
  return shufflePractice(pool, random).flatMap((item, index) => {
    const kind = mode === 'mix' ? (index % 2 ? 'zh2en' : 'en2zh') : mode;
    const answer = kind === 'en2zh' ? item.m : item.w;
    const options = new Map([[wordKey(answer), answer]]);
    for (const other of shufflePractice(pool, random)) {
      // Synonymous meanings must not create multiple defensible reverse answers.
      if (wordKey(other.w) === wordKey(item.w) || wordKey(other.m) === wordKey(item.m)) continue;
      const option = kind === 'en2zh' ? other.m : other.w;
      options.set(wordKey(option), option);
      if (options.size >= 4) break;
    }
    if (options.size < 2) return [];
    return [{ item: { ...item, ph: item.ph || '', ex: item.ex || '', ez: item.ez || '' }, kind,
      prompt: kind === 'en2zh' ? item.w : item.m, answer, options: shufflePractice([...options.values()], random) }];
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
    status: 'question', feedback: null, answer: '', pickedTiles: [], hintShown: false, completedMain: false };
}

export function readPractice(value, kind, level) {
  if (!value || value.version !== 1 || value.kind !== kind || value.level !== level || !Array.isArray(value.questions)
    || !value.questions.length || value.questions.length > 10 || !Array.isArray(value.records) || value.records.length !== value.questions.length
    || !Array.isArray(value.queue) || !value.queue.length || new Set(value.queue).size !== value.queue.length
    || value.queue.some(i => !Number.isInteger(i) || !value.questions[i]) || !Number.isInteger(value.index)
    || value.index < 0 || value.index >= value.queue.length || !['question', 'done'].includes(value.status)
    || !['main', 'review'].includes(value.round) || !(kind === 'quiz' ? ['en2zh', 'zh2en', 'mix'] : ['tiles', 'typing']).includes(value.mode)
    || ![null, true, false].includes(value.feedback) || typeof value.answer !== 'string'
    || value.records.some(r => !r || !Number.isInteger(r.attempts) || r.attempts < 0 || ![null, true, false].includes(r.firstCorrect) || typeof r.earned !== 'boolean' || typeof r.hinted !== 'boolean')
    || value.questions.some(q => !q || typeof q.answer !== 'string' || (kind === 'quiz'
      ? typeof q.item?.w !== 'string' || typeof q.item?.m !== 'string' || typeof q.prompt !== 'string' || !['en2zh', 'zh2en'].includes(q.kind) || !Array.isArray(q.options) || q.options.some(o => typeof o !== 'string') || !q.options.includes(q.answer)
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
    return queue.length ? { ...state, queue, index: 0, round: 'review', status: 'question', feedback: null, answer: '', pickedTiles: [], hintShown: false } : state;
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
    return { ...state, answer, feedback: correct, records: state.records.map((r, i) => i === qi ? {
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
