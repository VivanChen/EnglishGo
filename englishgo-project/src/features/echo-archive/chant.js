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
