export function grammarSignature(rule, drills = []) { return JSON.stringify([rule.t, rule.q, drills]); }
export function grammarRecord(book, rule, drills = []) {
  const signature = grammarSignature(rule, drills), raw = book?.lessons?.[rule.t];
  if (raw?.signature !== signature) return { signature, studied: false, drills: {}, answer: null, earned: false };
  const valid = (choice, question) => Number.isInteger(choice) && choice >= 0 && choice < question.o.length;
  return { signature, studied: !!raw.studied, earned: raw.earned === true,
    answer: valid(raw.answer, rule.q) ? raw.answer : null,
    drills: Object.fromEntries(drills.flatMap((q, i) => valid(raw.drills?.[i], q) ? [[i, raw.drills[i]]] : [])) };
}
export function grammarStep(record, drillCount) {
  return !record.studied ? 0 : Object.keys(record.drills).length < drillCount ? 1 : 2;
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
