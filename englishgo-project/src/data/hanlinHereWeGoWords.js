import courses from './hanlinHereWeGoCourses.json';
import words from './hanlinHereWeGoWords.json';

// Reviewed theme vocabulary, not a verbatim textbook transcription. Phonics,
// character names, festivals and additional recognition words are not included.
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
}));

export function getHereWeGoCards(id) {
  const deck = HERE_WE_GO_DECKS.find(item => item.id === id);
  if (!deck) return [];
  const course = courses.find(item => item.book === deck.book);
  return course.words.map(word => {
    const base = byWord.get(word.toLowerCase());
    // Book 3 teaches weather; Book 6 teaches illness. Keep the sense and picture
    // together rather than reusing the weather card for "have a cold".
    const card = course.book === 6 && word === 'cold' ? {
      ...base, m: '感冒', p: 'n.',
      ex: 'I have a cold, so I stay home and rest.', ez: '我感冒了，所以待在家裡休息。',
      img: '/images/vocabulary/here-we-go/cold-illness.svg', imageCredit: 'OpenMoji · CC BY-SA 4.0',
    } : { ...base };
    return {
      ...card, w: word, publisher: '翰林', publisherKey: 'hanlin',
      schoolBook: `Here We Go! ${course.book}`, curriculumSource: course.source,
      illustration: {
        id: `here-we-go-${course.book}-${word}`, level: 'elementary', word,
        image_url: card.img, local_path: card.img, alt_zh: `${card.m}的學習圖片`,
        example: card.ex, example_zh: card.ez, sort_order: 1,
      },
    };
  });
}
