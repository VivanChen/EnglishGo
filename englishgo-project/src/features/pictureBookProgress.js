// Reading progress for the embedded storybooks. The host owns this record; the book
// only reports what happened, and every report is checked against the book's own shape.
export const PICTURE_BOOK_PROGRESS_KEY = 'eg_pictureBookProgress:v1';
export const BOOK_FINISH_XP = 20;
export const STAR_XP = 2;

const pageList = (value, pageCount) => Array.isArray(value)
  ? [...new Set(value.filter(page => Number.isInteger(page) && page >= 0 && page < pageCount))].sort((a, b) => a - b)
  : [];

export function emptyBookProgress() {
  return { page: 0, seen: [], stars: [], completed: false, reads: 0 };
}

export function cleanBookProgress(saved, pageCount) {
  if (!saved || typeof saved !== 'object') return emptyBookProgress();
  return {
    page: Number.isInteger(saved.page) && saved.page >= 0 && saved.page < pageCount ? saved.page : 0,
    seen: pageList(saved.seen, pageCount),
    stars: pageList(saved.stars, pageCount),
    completed: saved.completed === true,
    reads: Number.isInteger(saved.reads) && saved.reads > 0 ? saved.reads : 0,
  };
}

export function readPictureBookProgress(books, storage = globalThis.localStorage) {
  let stored = {};
  try { stored = JSON.parse(storage?.getItem(PICTURE_BOOK_PROGRESS_KEY)) || {}; } catch { stored = {}; }
  return Object.fromEntries(books.map(book => [book.id, cleanBookProgress(stored[book.id], book.pageCount)]));
}

export function writePictureBookProgress(progress, storage = globalThis.localStorage) {
  try { storage?.setItem(PICTURE_BOOK_PROGRESS_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}

export function recordPage(entry, page, pageCount) {
  if (!Number.isInteger(page) || page < 0 || page >= pageCount) return entry;
  const seen = entry.seen.includes(page) ? entry.seen : [...entry.seen, page].sort((a, b) => a - b);
  return { ...entry, page, seen };
}

// A star counts once, and only on a page the reader actually opened.
export function recordStar(entry, page, pageCount) {
  if (!Number.isInteger(page) || page < 0 || page >= pageCount || !entry.seen.includes(page) || entry.stars.includes(page)) return { entry, added: false };
  return { entry: { ...entry, stars: [...entry.stars, page].sort((a, b) => a - b) }, added: true };
}

// Reaching "The End" restarts the next visit from the cover. The first finish after
// every page has been opened is the one that earns the book's reward.
export function recordFinish(entry, pageCount) {
  const missing = Math.max(0, pageCount - entry.seen.length);
  const allSeen = missing === 0;
  const first = allSeen && !entry.completed;
  return {
    entry: { ...entry, page: 0, completed: entry.completed || allSeen, reads: entry.reads + (allSeen ? 1 : 0) },
    first,
    missing,
  };
}
