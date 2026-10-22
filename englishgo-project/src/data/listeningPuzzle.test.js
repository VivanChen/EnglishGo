import { describe, expect, it } from 'vitest';
import { createListeningPuzzle, matchesListeningPiece } from './listeningPuzzle.js';

describe('listening puzzle from an exact example', () => {
  it('keeps repeated words and punctuation and does not leave an already solved bank', () => {
    const sentence = "I think I can, and I will.";
    const puzzle = createListeningPuzzle(sentence, () => .999);
    expect(puzzle.pieces.join(' ')).toBe(sentence);
    expect(puzzle.tiles.map(tile => tile.text)).not.toEqual(puzzle.pieces);
    expect(new Set(puzzle.tiles.map(tile => tile.id)).size).toBe(puzzle.pieces.length);
    expect(puzzle.tiles.filter(tile => tile.text === 'I')).toHaveLength(3);
    expect(matchesListeningPiece('I', 'I')).toBe(true);
    expect(matchesListeningPiece('can,', 'CAN')).toBe(true);
    expect(matchesListeningPiece("don't", 'do')).toBe(false);
  });
  it('uses readable phrase tiles for long examples without losing or inventing words', () => {
    const sentence = 'We went to the park after school, and we played with our friends until dinner.';
    const puzzle = createListeningPuzzle(sentence);
    expect(puzzle.unit).toBe('小段');
    expect(puzzle.pieces.join(' ')).toBe(sentence);
    expect(puzzle.pieces.length).toBeLessThanOrEqual(6);
    expect(puzzle.tiles.map(tile => tile.id).sort((a, b) => a - b)).toEqual(puzzle.pieces.map((_, id) => id));
    expect(createListeningPuzzle('  ')).toEqual({ pieces: [], tiles: [], unit: '單字' });
  });
});
