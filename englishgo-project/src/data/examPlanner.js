export function parseExamDraft(text) {
  const raw = String(text || '').split(/[^A-Za-z'-]+/).filter(Boolean), seen = new Set();
  let ignored = 0;
  for (const token of raw) {
    const word = token.replace(/^[-']+|[-']+$/g, '').toLowerCase();
    if (!/^[a-z][a-z'-]*$/.test(word) || seen.has(word)) ignored++;
    else seen.add(word);
  }
  const all = [...seen];
  return { words: all.slice(0, 80), allWords: all, ignored, overflow: Math.max(0, all.length - 80) };
}
export const examSignature = words => JSON.stringify(words);
export function readExamReview(raw, words) {
  if (!raw || raw.signature !== examSignature(words) || !Array.isArray(raw.cards) || raw.cards.length !== words.length
    || raw.cards.some((card, i) => card?.w !== words[i] || typeof card.m !== 'string')) return null;
  return { ...raw, excluded: Array.isArray(raw.excluded) ? raw.excluded.filter(w => words.includes(w)) : [] };
}
export function readExamWorkspace(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return { text: typeof raw.text === 'string' ? raw.text : '', name: typeof raw.name === 'string' ? raw.name.slice(0, 50) : '', selected: typeof raw.selected === 'string' ? raw.selected : null,
    size: [5, 10, 80].includes(raw.size) ? raw.size : 5, review: raw.review || null,
    lists: Array.isArray(raw.lists) ? raw.lists.filter(item => typeof item?.id === 'string' && typeof item.name === 'string' && typeof item.text === 'string').slice(0, 12) : [] };
}
function bounded(promise, timeout, signal) {
  return new Promise(resolve => {
    let ended = false, timer;
    const finish = value => { if (ended) return; ended = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); resolve(value); };
    const abort = () => finish(null);
    if (signal?.aborted) { finish(null); return; }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(null), Math.max(0, timeout));
    Promise.resolve(promise).then(finish, () => finish(null));
  });
}
export async function resolveExamCards(words, { lookupCloud, lookupLocal, onProgress, signal, budget = 12000 }) {
  const deadline = Date.now() + budget, cards = Array(words.length); let cursor = 0, done = 0;
  const lookup = async (fn, word) => { try { return await bounded(fn(word), Math.min(4000, Math.max(0, deadline - Date.now())), signal); } catch { return null; } };
  const worker = async () => {
    while (cursor < words.length && !signal?.aborted) {
      const index = cursor++, word = words[index];
      const [cloud, local] = await Promise.all([Date.now() < deadline ? lookup(lookupCloud, word) : null, lookup(lookupLocal, word)]);
      if (signal?.aborted) return;
      const usable = value => value && typeof value.m === 'string' && value.m.trim() && !value.customMissing;
      const found = usable(cloud) ? cloud : usable(local) ? local : null;
      cards[index] = found ? { ...found, w: word } : { w: word, m: '', ph: '', p: '', f: [], c: [], ex: '', ez: '', customMissing: true };
      onProgress?.(++done, words.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, words.length) }, worker));
  return signal?.aborted ? [] : cards;
}
