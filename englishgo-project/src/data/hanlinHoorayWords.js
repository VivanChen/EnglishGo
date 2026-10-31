import words from './hanlinHoorayWords.json';

// Hooray 1–2 ABC Review, entries 1–52 only. The rest of the source
// belongs to other series. These are original EnglishGo example sentences.
export const HOORAY_SOURCE = 'https://www.zjps.tp.edu.tw/uploads/1757130761548Jc6n3VhF.pdf';
export const HOORAY_DECKS = [
  { id: 'hanlin-hooray-all', label: 'ABC 全部複習', icon: '📚', start: 0, end: 52 },
  { id: 'hanlin-hooray-am', label: 'A–M 字母單字', icon: '🌱', start: 0, end: 26 },
  { id: 'hanlin-hooray-nz', label: 'N–Z 字母單字', icon: '🌟', start: 26, end: 52 },
];
export const HOORAY_WORDS = words.map(card => ({
  ...card, publisher: '翰林', publisherKey: 'hanlin', schoolBook: 'Hooray 1–2 · ABC Review', curriculumSource: HOORAY_SOURCE,
  illustration: {
    id: `hooray-${card.w}`, level: 'elementary', word: card.w,
    image_url: card.img, local_path: card.img, alt_zh: `${card.m}的學習圖片`,
    example: card.ex, example_zh: card.ez, sort_order: 1,
  },
}));
export function getHoorayCards(id) {
  const deck = HOORAY_DECKS.find(item => item.id === id);
  return deck ? HOORAY_WORDS.slice(deck.start, deck.end) : [];
}
