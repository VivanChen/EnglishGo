/** Rotate a small offline-ready practice deck each day, putting less familiar words first. */
export function buildDailyMiniDeck(words, weakWords = [], date = '', count = 5) {
  const unique = [...new Map((words || []).filter(w => w?.w && w?.m).map(w => [w.w.toLowerCase(), w])).values()];
  if (!unique.length) return [];
  const seed = [...String(date)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
  const offset = seed % unique.length;
  const rotated = [...unique.slice(offset), ...unique.slice(0, offset)];
  const weakness = new Map(weakWords.map(w => [String(w.w).toLowerCase(), Number(w.n) || 0]));
  return rotated.sort((a, b) => (weakness.get(b.w.toLowerCase()) || 0) - (weakness.get(a.w.toLowerCase()) || 0)).slice(0, Math.max(1, count));
}
