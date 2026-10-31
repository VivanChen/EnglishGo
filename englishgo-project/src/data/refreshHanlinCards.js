import { getHereWeGoCards, getHereWeGoDeck } from './hanlinHereWeGoWords.js';
import { getHoorayCards, HOORAY_DECKS } from './hanlinHoorayWords.js';

// Refresh content without changing card indices, the review queue, or ratings.
export function refreshHanlinCards(cards, topic) {
  const current = getHereWeGoDeck(topic) ? getHereWeGoCards(topic)
    : HOORAY_DECKS.some(deck => deck.id === topic) ? getHoorayCards(topic) : [];
  if (!current.length) return cards;
  const byWord = new Map(current.map(card => [card.w.toLowerCase(), card]));
  return cards.map(card => {
    const latest = byWord.get(String(card.w).toLowerCase());
    return latest ? { ...card, ...latest } : card;
  });
}
