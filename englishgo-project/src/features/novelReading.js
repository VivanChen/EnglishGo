import { novelBlockPairs } from '../data/novelAudio.js';

export const BOOKMARK_LIMIT = 80;
export const bookmarkKey = mark => `${mark.chapterNo}:${mark.blockIndex}`;

// Resolve excerpts from the book so saved locations always use its current bilingual text.
export function resolveBookmarks(novel, saved) {
  if (!novel || !Array.isArray(saved)) return [];
  const seen = new Set();
  return saved.flatMap(mark => {
    if (!mark || !Number.isInteger(mark.blockIndex) || mark.blockIndex < 0) return [];
    const chapterIndex = novel.chapters.findIndex(chapter => chapter.no === mark.chapterNo);
    const chapter = novel.chapters[chapterIndex];
    const block = chapter && novelBlockPairs(chapter.en, chapter.zh)[mark.blockIndex];
    const key = bookmarkKey(mark);
    if (!block || seen.has(key)) return [];
    seen.add(key);
    return [{ chapterNo: chapter.no, blockIndex: block.i, createdAt: Number(mark.createdAt) || 0, chapterIndex, chapter, block }];
  }).slice(0, BOOKMARK_LIMIT);
}

export const NOVEL_TONES = {
  paper: { paper: '#FFFEF9', surround: '#E8E4DA', ink: '#293B34', muted: '#59695F', translation: '#FFF8E9', accent: '#0F6E56', active: '#E6F7F0', rule: '#D6B873' },
  leaf: { paper: '#F1F8EF', surround: '#DAE6D7', ink: '#273E2F', muted: '#4D6655', translation: '#E2EEDD', accent: '#2F6946', active: '#D4EACF', rule: '#91AC7C' },
  night: { paper: '#202E30', surround: '#142123', ink: '#E5EDE8', muted: '#B8CBC1', translation: '#2B3C3B', accent: '#A5DFC1', active: '#364E46', rule: '#92AD8B' },
};
