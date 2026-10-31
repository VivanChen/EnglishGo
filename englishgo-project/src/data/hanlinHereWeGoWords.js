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

export function getHereWeGoCards(id) {
  const deck = HERE_WE_GO_DECKS.find(item => item.id === id);
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
  });
}
