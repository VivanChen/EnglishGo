import { arcadeWords, shortMeaning } from '../../data/arcade.js';

// Words of power used when the player casts a Chant card. The level's own
// vocabulary is preferred; this small themed list keeps the game playable
// before the vocabulary finishes loading.
export const FALLBACK_RUNES = [
  ['fire', '火'], ['water', '水'], ['light', '光'], ['star', '星星'], ['moon', '月亮'], ['book', '書'],
  ['sword', '劍'], ['shield', '盾牌'], ['dream', '夢'], ['brave', '勇敢的'], ['dark', '黑暗的'], ['wind', '風'],
  ['stone', '石頭'], ['magic', '魔法'], ['king', '國王'], ['dragon', '龍'], ['heart', '心'], ['gold', '金子'],
  ['night', '夜晚'], ['tree', '樹'], ['door', '門'], ['key', '鑰匙'], ['bird', '鳥'], ['snow', '雪'],
].map(([w, m]) => ({ w, m }));

export function buildRunePool(words) {
  const pool = arcadeWords(words).filter(word => word.w.length <= 12);
  return pool.length >= 8 ? pool : arcadeWords([...pool, ...FALLBACK_RUNES]);
}

function shuffled(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

// Distinct words with distinct short meanings, for the event word games.
export function pickRunes(pool, count, random = Math.random) {
  const source = pool?.length >= count * 2 ? pool : [...(pool || []), ...FALLBACK_RUNES];
  const out = [];
  for (const word of shuffled(source, random)) {
    const meaning = shortMeaning(word.m);
    if (!meaning || out.some(item => item.w === word.w || item.meaning === meaning)) continue;
    out.push({ w: word.w, m: word.m, meaning });
    if (out.length === count) break;
  }
  return out;
}

// One round of the Hall of Echoes: a word to hear and two look-alikes
// (same first letter or a similar length) to tell it apart from.
export function echoRound(pool, used = [], random = Math.random) {
  const source = pool?.length >= 6 ? pool : [...(pool || []), ...FALLBACK_RUNES];
  const fresh = source.filter(word => !used.includes(word.w));
  const target = (fresh.length ? fresh : source)[Math.floor(random() * (fresh.length || source.length))];
  const closeness = word => (word.w[0] === target.w[0] ? 0 : 2) + Math.abs(word.w.length - target.w.length) * 0.5;
  const distractors = shuffled(source.filter(word => word.w !== target.w), random)
    .sort((a, b) => closeness(a) - closeness(b))
    .filter((word, index, list) => list.findIndex(other => other.w === word.w) === index)
    .slice(0, 2);
  return { word: target.w, m: target.m, meaning: shortMeaning(target.m), options: shuffled([target, ...distractors].map(word => word.w), random) };
}

export function makeChant(pool, recent = [], random = Math.random) {
  const source = pool?.length >= 3 ? pool : FALLBACK_RUNES;
  const fresh = source.filter(word => !recent.includes(word.w));
  const word = (fresh.length ? fresh : source)[Math.floor(random() * (fresh.length ? fresh : source).length)];
  const meaning = shortMeaning(word.m);
  const distractors = shuffled(source.filter(other => other.w !== word.w && shortMeaning(other.m) !== meaning), random)
    .filter((other, index, list) => list.findIndex(item => shortMeaning(item.m) === shortMeaning(other.m)) === index)
    .slice(0, 2);
  const direction = random() < 0.7 ? 'en' : 'zh';
  const options = shuffled([word, ...distractors].map(item => ({
    label: direction === 'en' ? shortMeaning(item.m) : item.w,
    ok: item.w === word.w,
  })), random);
  return { word: word.w, meaning, direction, options, img: word.img || null };
}
