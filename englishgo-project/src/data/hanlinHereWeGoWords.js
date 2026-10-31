import courses from './hanlinHereWeGoCourses.json';
import words from './hanlinHereWeGoWords.json';
import coverage from './hanlinHereWeGoCoverage.json';

// Public, cross-edition vocabulary references, with original bilingual examples.
// Coverage is source-specific; this is not a verified complete 115 edition.
// Use book numbers because schools assign these books to different grades.
const byWord = new Map(words.map(card => [card.w.toLowerCase(), card]));
export const HERE_WE_GO_DECKS = courses.map(course => ({
  id: `hanlin-here-we-go-${course.book}`,
  book: course.book,
  label: `第 ${course.book} 冊`,
  series: 'Here We Go!',
  icon: ['📗', '🐣', '🌤️', '🏠', '🏫', '🎒', '🚆', '🌏'][course.book - 1],
  description: course.description,
  scope: course.scope,
  source: course.source,
  coverageNote: coverage.editionNote,
  supplementalSources: [...new Set(coverage.groups.filter(group => group.book === course.book).map(group => group.sourceId))].map(id => ({ id, ...coverage.sources[id] })),
  categories: [...new Set(coverage.groups.filter(group => group.book === course.book).map(group => group.category))],
}));

export const HERE_WE_GO_FILTERS = [
  { id: 'all', label: '全部字詞' },
  { id: 'words', label: '字詞（不含人名）' },
  { id: 'phonics', label: '發音例字（不含人名）' },
  { id: 'culture', label: '節慶與文化' },
  { id: 'names', label: '人名' },
];
const normalizeSearch = value => String(value || '').normalize('NFKC').replace(/[’‘]/g, "'").trim().toLowerCase();
export function hereWeGoSelectionId(bookId, filter = 'all', query = '') {
  const cleanQuery = normalizeSearch(query).slice(0, 80);
  return filter === 'all' && !cleanQuery ? bookId : `${bookId}::${filter}::${encodeURIComponent(cleanQuery)}`;
}
export function getHereWeGoDeck(id) {
  if (typeof id !== 'string') return null;
  const [bookId, filter = 'all', encodedQuery = '', ...extra] = id.split('::');
  const base = HERE_WE_GO_DECKS.find(item => item.id === bookId);
  const option = HERE_WE_GO_FILTERS.find(item => item.id === filter);
  if (!base || !option || extra.length) return null;
  let query;
  try { query = normalizeSearch(decodeURIComponent(encodedQuery)); } catch { return null; }
  if (query.length > 80) return null;
  return { ...base, id, bookId, filter, query, label: `${base.label}${filter === 'all' ? '' : ` · ${option.label}`}${query ? ` · 搜尋「${query}」` : ''}` };
}
export function getHereWeGoCards(id) {
  const deck = getHereWeGoDeck(id);
  if (!deck) return [];
  const course = courses.find(item => item.book === deck.book);
  return course.words.map(word => {
    const base = byWord.get(word.toLowerCase());
    const references = coverage.groups.filter(group => group.book === course.book && group.words.some(item => item.toLowerCase() === word.toLowerCase())).map(group => ({
      unit: group.unit, category: group.category, source: coverage.sources[group.sourceId].url,
    }));
    // Book 3 teaches weather; Book 6 teaches illness. Keep the sense and picture
    // together rather than reusing the weather card for "have a cold".
    const card = course.book === 6 && word === 'cold' ? {
      ...base, m: '感冒', p: 'n.',
      ex: 'I have a cold, so I stay home and rest.', ez: '我感冒了，所以待在家裡休息。',
      img: '/images/vocabulary/here-we-go/cold-illness.svg', imageCredit: 'OpenMoji · CC BY-SA 4.0',
    } : { ...base };
    return {
      ...card, w: word, publisher: '翰林', publisherKey: 'hanlin',
      schoolBook: `Here We Go! ${course.book}`, curriculumSource: references[0]?.source || course.source,
      curriculumReferences: references, curriculumEditionNote: coverage.editionNote,
      illustration: {
        id: `here-we-go-${course.book}-${word}`, level: 'elementary', word,
        image_url: card.img, local_path: card.img, alt_zh: `${card.m}的學習圖片`,
        example: card.ex, example_zh: card.ez, sort_order: 1,
      },
    };
  }).filter(card => {
    const isName = card.m.includes('人名');
    const refs = card.curriculumReferences;
    const inCategory = deck.filter === 'all'
      || (deck.filter === 'words' && !isName)
      || (deck.filter === 'names' && isName)
      || (deck.filter === 'phonics' && !isName && refs.some(ref => ref.category === '發音例字'))
      || (deck.filter === 'culture' && refs.some(ref => ref.category === '節慶／文化' || /festival|easter|christmas/i.test(ref.unit)));
    return inCategory && (!deck.query || [card.w, card.m].some(text => normalizeSearch(text).includes(deck.query)));
  });
}
