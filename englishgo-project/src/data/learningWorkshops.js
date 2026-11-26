export function grammarSignature(rule, drills = []) { return JSON.stringify([rule.t, rule.q, drills]); }
// sentences: the build-step sentences for this lesson; saved built sentences that no longer exist are dropped.
export function grammarRecord(book, rule, drills = [], sentences = null) {
  const signature = grammarSignature(rule, drills), raw = book?.lessons?.[rule.t];
  if (raw?.signature !== signature) return { signature, studied: false, drills: {}, built: [], answer: null, earned: false };
  const valid = (choice, question) => Number.isInteger(choice) && choice >= 0 && choice < question.o.length;
  const built = Array.isArray(raw.built) ? [...new Set(raw.built.filter(s => typeof s === 'string' && (!sentences || sentences.some(x => x.en === s))))] : [];
  return { signature, studied: !!raw.studied, earned: raw.earned === true, built,
    answer: valid(raw.answer, rule.q) ? raw.answer : null,
    drills: Object.fromEntries(drills.flatMap((q, i) => valid(raw.drills?.[i], q) ? [[i, raw.drills[i]]] : [])) };
}
// Steps: 0 learn, 1 drills, 2 build sentences, 3 challenge.
export function grammarStep(record, drillCount, buildCount = 0) {
  return !record.studied ? 0 : Object.keys(record.drills).length < drillCount ? 1 : (record.built?.length || 0) < buildCount ? 2 : 3;
}

const grammarWords = text => String(text || '').trim().split(/\s+/).filter(Boolean);
// Short translated examples make good blocks: long ones are tiring to order on a phone.
export function grammarBuildSentences(examples, max = 2) {
  const seen = new Set();
  return (examples || []).filter(example => {
    const count = grammarWords(example?.en).length;
    if (!String(example?.zh || '').trim() || count < 3 || count > 10 || seen.has(example.en)) return false;
    seen.add(example.en); return true;
  }).slice(0, max).map(example => ({ en: example.en.trim(), zh: example.zh.trim() }));
}
// Same sentence, same shuffle: the tiles stay put across re-renders and reloads, and never start solved.
export function grammarTiles(sentence) {
  const words = grammarWords(sentence);
  let seed = [...String(sentence)].reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const tiles = words.map((text, id) => ({ id, text }));
  for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  if (tiles.length > 1 && tiles.every((tile, i) => tile.text === words[i])) tiles.push(tiles.shift());
  return tiles;
}
export function grammarBuildCheck(sentence, picked) {
  const words = grammarWords(sentence);
  return { correct: picked.length === words.length && picked.every((text, i) => text === words[i]), slots: picked.map((text, i) => text === words[i]) };
}
// Mixed review: every drill and lesson challenge in play, labelled with its lesson, so the learner must spot the rule.
export function grammarMixedQuestions(rules, drillsFor, { count = 8, random = Math.random, lessons = null } = {}) {
  const pool = rules.flatMap((rule, lesson) => (lessons && !lessons.includes(lesson)) ? [] : [...(drillsFor(rule) || []), rule.q]
    .filter(q => typeof q?.s === 'string' && Array.isArray(q.o) && q.o.length > 1 && Number.isInteger(q.a) && q.o[q.a] !== undefined)
    .map(q => ({ s: q.s, o: q.o, a: q.a, e: q.e || '', topic: rule.t, lesson })));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}

export const speechItemKey = item => String(item?.en || '').trim().toLowerCase();
export function createSpeakingRound(items, mode, count = 3) {
  const seen = new Set();
  const selected = items.filter(item => {
    const key = speechItemKey(item);
    if (!key || typeof item.zh !== 'string' || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, count);
  return { version: 1, mode, items: selected, queue: selected.map((_, i) => i), index: 0, records: {}, done: false, review: false };
}
export function readSpeakingRound(raw) {
  if (raw?.version !== 1 || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > 5
    || raw.items.some(item => typeof item?.en !== 'string' || typeof item?.zh !== 'string')
    || !Array.isArray(raw.queue) || !raw.queue.length || raw.queue.some(i => !Number.isInteger(i) || !raw.items[i])
    || !Number.isInteger(raw.index) || raw.index < 0 || raw.index >= raw.queue.length || !raw.records || typeof raw.records !== 'object'
    || Object.values(raw.records).some(r => !r || typeof r.heard !== 'string' || !Number.isFinite(r.best) || !Number.isInteger(r.attempts)
      || (r.comparison && (!Number.isFinite(r.comparison.pct) || !Array.isArray(r.comparison.result) || r.comparison.result.some(w => typeof w?.word !== 'string') || !Array.isArray(r.comparison.extra))))) return null;
  return raw;
}
export function recordSpeakingAttempt(round, comparison, heard, threshold) {
  const item = round.items[round.queue[round.index]], key = speechItemKey(item), old = round.records[key];
  const passed = comparison.pct >= threshold;
  const reward = passed && !old?.earned ? comparison.pct >= 90 ? 15 : 10 : 0;
  return { reward, round: { ...round, records: { ...round.records, [key]: {
    ...old, attempts: (old?.attempts || 0) + 1, best: Math.max(old?.best || 0, comparison.pct), passed: old?.passed || passed,
    earned: !!old?.earned || passed, heard, comparison, selfPracticed: !!old?.selfPracticed,
  } } } };
}
// Without the AI check, a learner can still finish an item by recording, comparing with the
// demo and judging it themselves. This is a small practice reward, separate from the check reward.
export const SELF_CHECK_REWARD = 3;
export function recordSelfCheck(round) {
  const item = round.items[round.queue[round.index]], key = speechItemKey(item), old = round.records[key];
  const reward = old?.earned || old?.practiceEarned ? 0 : SELF_CHECK_REWARD;
  return { reward, round: { ...round, records: { ...round.records, [key]: {
    attempts: 0, best: 0, heard: '', passed: false, earned: false, ...old, selfPracticed: true, recorded: true, practiceEarned: !!old?.practiceEarned || reward > 0,
  } } } };
}
// "Word + sentence" mode: warm up on a word, then say it inside its own example sentence.
// A word without its sentence borrows the next sentence that belongs to no listed word.
export function pairSpeakItems(items) {
  const list = (items || []).filter(Boolean), used = new Set(), out = [];
  const words = new Set(list.filter(item => item.type !== 'sentence').map(speechItemKey));
  const owner = item => speechItemKey({ en: item.keyword });
  const take = item => { if (item && !used.has(item)) { used.add(item); out.push(item); } };
  for (const item of list) {
    if (used.has(item) || item.type === 'sentence') continue;
    take(item);
    take(list.find(other => !used.has(other) && other.type === 'sentence' && owner(other) === speechItemKey(item))
      || list.find(other => !used.has(other) && other.type === 'sentence' && !words.has(owner(other))));
  }
  list.forEach(take);
  return out;
}
export function advanceSpeakingRound(round) {
  return round.index + 1 >= round.queue.length ? { ...round, done: true } : { ...round, index: round.index + 1 };
}
export function reviewSpeakingRound(round) {
  const queue = round.items.flatMap((item, i) => !round.records[speechItemKey(item)]?.passed ? [i] : []);
  return queue.length ? { ...round, queue, index: 0, review: true, done: false } : round;
}

// Source timestamps are never adjusted by learner playback controls.
export function songLineRange(lines, index, duration) {
  const lyric = lines[index], start = lyric?.t;
  if (!lyric?.en || !Number.isFinite(start) || start < 0) return null;
  const next = lines.slice(index + 1).find(line => line.en && Number.isFinite(line.t) && line.t > start);
  const end = next ? Number(next.t) : Number(duration);
  return Number.isFinite(end) && end > start ? { start, end } : null;
}
export function songRecord(book, song) {
  const signature = JSON.stringify([song.audio, song.lines, song.vocab]), old = book?.songs?.[song.id];
  if (old?.signature !== signature) return { signature, position: 0, practiced: [], practice: {}, earned: {}, listened: false };
  return { signature, position: Math.max(0, Number(old.position) || 0), practiced: Array.isArray(old.practiced) ? old.practiced.filter(i => Number.isInteger(i) && song.lines[i]?.en) : [],
    practice: old.practice && typeof old.practice === 'object' ? old.practice : {}, earned: old.earned && typeof old.earned === 'object' ? old.earned : {}, listened: old.listened === true };
}
