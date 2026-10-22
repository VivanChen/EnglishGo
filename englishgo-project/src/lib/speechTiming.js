export function storyWords(text) {
  return Array.from(text.matchAll(/\S+/g), match => ({ text: match[0], start: match.index, end: match.index + match[0].length }));
}

export function wordAtBoundary(words, charIndex) {
  return words.findIndex(word => charIndex >= word.start && charIndex < word.end);
}

// Cloud audio has playback time rather than word alignment. This is an
// approximate guide; native word boundary events always take precedence.
export function wordAtProgress(words, currentTime, duration) {
  if (!(duration > 0) || !Number.isFinite(duration) || !words.length) return -1;
  const weights = words.map(word => Math.max(2, word.text.replace(/[^a-z]/gi, '').length) + (/[,.!?]$/.test(word.text) ? 2 : 0));
  const position = Math.max(0, Math.min(1, currentTime / duration)) * weights.reduce((a, b) => a + b, 0);
  let sum = 0;
  for (let i = 0; i < words.length; i++) { sum += weights[i]; if (position < sum) return i; }
  return words.length - 1;
}

export function speechHighlightEvents(text, update) {
  const words = storyWords(text);
  let started = false, exact = false;
  return {
    // Preserve the existing cloud provider when requesting word boundaries.
    trackWords: true,
    onstart: () => {
      if (started) return;
      started = true;
      update({ started: true, word: -1, approximate: false });
    },
    onboundary: event => {
      if (!started || (event.name && event.name !== 'word') || !Number.isFinite(event.charIndex)) return;
      const word = wordAtBoundary(words, event.charIndex);
      if (word < 0) return;
      exact = true;
      update({ word, approximate: false });
    },
    onprogress: event => {
      if (!started || exact || !Number.isFinite(event.currentTime) || event.currentTime < 0) return;
      const word = wordAtProgress(words, event.currentTime, event.duration);
      if (word >= 0) update({ word, approximate: true });
    },
  };
}
