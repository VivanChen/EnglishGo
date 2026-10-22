import { speakingPhrases } from './cardSpeaking.js';
import { normalizeDictation, shufflePractice } from './practiceJourney.js';

export function createListeningPuzzle(sentence, random = Math.random) {
  const words = String(sentence || '').trim().split(/\s+/).filter(Boolean);
  // Longer examples use the same small phrases as guided speaking.
  const pieces = words.length > 12 ? speakingPhrases(sentence) : words;
  let tiles = shufflePractice(pieces.map((text, id) => ({ text, id })), random);
  if (tiles.length > 1 && tiles.every((tile, i) => tile.text === pieces[i])) tiles = [...tiles.slice(1), tiles[0]];
  return { pieces, tiles, unit: words.length > 12 ? '小段' : '單字' };
}

// Identical words are interchangeable even when their tile IDs differ.
export const matchesListeningPiece = (expected, actual) => normalizeDictation(expected) === normalizeDictation(actual);
