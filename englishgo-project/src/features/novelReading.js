import { novelBlockPairs } from '../data/novelAudio.js';

export const BOOKMARK_LIMIT = 80;
export const NOVEL_READING_VERSION = 2;
export const bookmarkKey = mark => `${mark.chapterNo}:${mark.blockIndex}`;

// Version 1 merged unrelated short English paragraphs to match Chinese counts.
// Each entry is [old block index, extra English paragraphs merged into it].
// Keep old bookmarks on the first original sentence of their former block.
const LEGACY_FOREST_MERGES = {
  4: [[89, 1]],
  6: [[67, 1], [130, 1], [135, 1]],
  7: [[24, 1], [41, 1], [74, 1], [79, 1], [94, 1], [102, 1], [115, 1], [133, 1]],
  8: [[39, 1]],
};

export function resolveReadingBlock(novelId, saved) {
  if (saved?.blockIndex == null) return null;
  const value = Number(saved.blockIndex);
  if (!Number.isFinite(value) || value < 0) return null;
  const index = Math.floor(value);
  if (novelId !== 'secret-forest-adventure' || saved.contentVersion >= NOVEL_READING_VERSION) return index;
  return (LEGACY_FOREST_MERGES[saved.chapterNo] || []).reduce(
    (current, [oldIndex, extra]) => current + (oldIndex < index ? extra : 0), index,
  );
}

// Resolve excerpts from the book so saved locations always use its current bilingual text.
export function resolveBookmarks(novel, saved) {
  if (!novel || !Array.isArray(saved)) return [];
  const seen = new Set();
  return saved.flatMap(mark => {
    if (!mark || !Number.isInteger(mark.blockIndex) || mark.blockIndex < 0) return [];
    const chapterIndex = novel.chapters.findIndex(chapter => chapter.no === mark.chapterNo);
    const chapter = novel.chapters[chapterIndex];
    const blockIndex = resolveReadingBlock(novel.id, mark);
    const block = chapter && novelBlockPairs(chapter.en, chapter.zh)[blockIndex];
    const key = bookmarkKey({ ...mark, blockIndex });
    if (!block || seen.has(key)) return [];
    seen.add(key);
    return [{ chapterNo: chapter.no, blockIndex: block.i, contentVersion: NOVEL_READING_VERSION, createdAt: Number(mark.createdAt) || 0, chapterIndex, chapter, block }];
  }).slice(0, BOOKMARK_LIMIT);
}

export const NOVEL_TONES = {
  paper: { paper: '#FFFEF9', surround: '#E8E4DA', ink: '#293B34', muted: '#59695F', translation: '#FFF8E9', accent: '#0F6E56', active: '#E6F7F0', rule: '#D6B873' },
  leaf: { paper: '#F1F8EF', surround: '#DAE6D7', ink: '#273E2F', muted: '#4D6655', translation: '#E2EEDD', accent: '#2F6946', active: '#D4EACF', rule: '#91AC7C' },
  night: { paper: '#202E30', surround: '#142123', ink: '#E5EDE8', muted: '#B8CBC1', translation: '#2B3C3B', accent: '#A5DFC1', active: '#364E46', rule: '#92AD8B' },
};
