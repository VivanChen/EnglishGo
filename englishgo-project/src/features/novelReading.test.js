import { describe, expect, it } from 'vitest';
import { NOVELS } from '../data/novels.js';
import { NOVEL_READING_VERSION, resolveBookmarks, resolveReadingBlock } from './novelReading.js';

const book = NOVELS.elementary[0];
describe('reading locations saved before translation realignment', () => {
  it.each([
    [4, 89, 89, 'The shadow pulled back.'],
    [4, 90, 91, 'Coco shouted, “The light hurts it!”'],
    [6, 67, 67, 'Glow!'],
    [6, 68, 69, '“Pebble helped!” Coco laughed.'],
    [6, 135, 137, '“No.”'],
    [6, 169, 172, 'The Star Crystal.'],
    [7, 24, 24, 'The moment she touched it—'],
    [7, 28, 29, 'Not the cave.'],
    [7, 30, 31, 'A memory.'],
    [7, 133, 140, 'Sad.'],
    [7, 156, 164, 'The forest was safe.'],
    [8, 39, 39, 'It was still a shadow,'],
    [8, 40, 41, 'Coco gasped.'],
    [8, 122, 123, 'the forest whispered softly.'],
  ])('chapter %i old block %i resolves to %i without losing its English sentence', (chapterNo, blockIndex, expectedIndex, en) => {
    const old = { chapterNo, blockIndex, createdAt: 123 };
    expect(resolveReadingBlock(book.id, old)).toBe(expectedIndex);
    const marks = resolveBookmarks(book, [old]);
    expect(marks[0]).toMatchObject({ blockIndex: expectedIndex, createdAt: 123, contentVersion: NOVEL_READING_VERSION, block: { en } });
    expect(resolveBookmarks(book, marks)).toEqual(marks);
  });

  it('deduplicates legacy/current bookmarks after resolving and leaves other books untouched', () => {
    const old = { chapterNo: 7, blockIndex: 28 };
    const current = { chapterNo: 7, blockIndex: 29, contentVersion: NOVEL_READING_VERSION };
    expect(resolveBookmarks(book, [old, current])).toHaveLength(1);
    expect(resolveReadingBlock(book.id, current)).toBe(29);
    expect(resolveReadingBlock('clock-tower-magic-school', old)).toBe(28);
    expect(resolveReadingBlock(book.id, { chapterNo: 1, blockIndex: 28 })).toBe(28);
    expect(resolveReadingBlock(book.id, { chapterNo: 7 })).toBeNull();
    expect(resolveReadingBlock(book.id, { blockIndex: -1 })).toBeNull();
  });
});
