// Keep the exact example the learner selected, including its paired translation.
export function readCardPractice(value) {
  if (!value || typeof value.word !== 'string' || !value.word.trim()
    || typeof value.en !== 'string' || !/[a-z]/i.test(value.en)
    || typeof value.zh !== 'string' || !['word', 'sentence'].includes(value.type)) return null;
  return { word: value.word.trim(), meaning: typeof value.meaning === 'string' ? value.meaning : '',
    en: value.en.trim(), zh: value.zh.trim(), type: value.type };
}

export function cardPracticeStorageKey(level, practice) {
  return `eg_card_speaking_${level}_${encodeURIComponent(JSON.stringify([practice.word.toLowerCase(), practice.en, practice.zh, practice.type]))}`;
}

export function speakingPhrases(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean), phrases = [];
  let part = [];
  words.forEach((word, index) => {
    part.push(word);
    if (part.length >= 5 || /[,;:.!?]["”']?$/.test(word) || index === words.length - 1) {
      phrases.push(part.join(' ')); part = [];
    }
  });
  return phrases;
}

// Browser history holds this round so a speaking detour can return to the same card.
export function readSrsSession(value, level) {
  if (value?.version !== 1 || value.level !== level || !Array.isArray(value.cards) || !value.cards.length
    || value.cards.some(card => typeof card?.w !== 'string') || typeof value.selectedTopic !== 'string') return null;
  const deck = value.deck, validIndex = index => Number.isInteger(index) && index >= 0 && index < value.cards.length;
  if (!deck || deck.total !== value.cards.length || !Array.isArray(deck.queue) || !Array.isArray(deck.rm)
    || [...deck.queue, ...deck.rm].some(index => !validIndex(index))
    || new Set([...deck.queue, ...deck.rm]).size !== value.cards.length
    || deck.queue.length + deck.rm.length !== value.cards.length
    || ['again', 'hard', 'good', 'easy'].some(key => !Number.isInteger(deck.stats?.[key]) || deck.stats[key] < 0)) return null;
  return { ...value, flip: !!value.flip, combo: Math.max(0, Number(value.combo) || 0), maxCombo: Math.max(0, Number(value.maxCombo) || 0) };
}
