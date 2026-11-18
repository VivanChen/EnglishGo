import { describe, expect, it } from 'vitest';
import { PICTURE_BOOK_PROGRESS_KEY, cleanBookProgress, emptyBookProgress, readPictureBookProgress, recordFinish, recordPage, recordStar } from './pictureBookProgress.js';

const books = [{ id: 'a', pageCount: 8 }, { id: 'b', pageCount: 8 }];

describe('picture book progress', () => {
  it('reads only well-formed progress for known books', () => {
    localStorage.setItem(PICTURE_BOOK_PROGRESS_KEY, JSON.stringify({
      a: { page: 9, seen: [0, 1, 1, 12, -1, 'x'], stars: [1, 3], completed: 'yes', reads: -2 },
      ghost: { page: 2 },
    }));
    expect(readPictureBookProgress(books)).toEqual({
      a: { page: 0, seen: [0, 1], stars: [1, 3], completed: false, reads: 0 },
      b: emptyBookProgress(),
    });
    localStorage.setItem(PICTURE_BOOK_PROGRESS_KEY, '{broken');
    expect(readPictureBookProgress(books).a).toEqual(emptyBookProgress());
    expect(cleanBookProgress(null, 8)).toEqual(emptyBookProgress());
  });

  it('awards a star once, and only on a page that was opened', () => {
    let entry = recordPage(emptyBookProgress(), 2, 8);
    expect(entry).toMatchObject({ page: 2, seen: [2] });
    expect(recordStar(entry, 3, 8).added).toBe(false);
    const first = recordStar(entry, 2, 8);
    expect(first.added).toBe(true);
    entry = first.entry;
    expect(recordStar(entry, 2, 8).added).toBe(false);
    expect(recordPage(entry, 8, 8)).toBe(entry);
  });

  it('finishes a book only after every page has been opened', () => {
    let entry = emptyBookProgress();
    for (let page = 0; page < 7; page++) entry = recordPage(entry, page, 8);
    const early = recordFinish(entry, 8);
    expect(early).toMatchObject({ first: false, missing: 1 });
    expect(early.entry).toMatchObject({ completed: false, page: 0, reads: 0 });
    entry = recordPage(early.entry, 7, 8);
    const done = recordFinish(entry, 8);
    expect(done).toMatchObject({ first: true, missing: 0 });
    expect(done.entry).toMatchObject({ completed: true, page: 0, reads: 1 });
    const again = recordFinish(done.entry, 8);
    expect(again.first).toBe(false);
    expect(again.entry.reads).toBe(2);
  });
});
