import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePictureBookAudio } from './usePictureBookAudio.js';
import { PICTURE_BOOKS } from '../data/pictureBooks.js';
import { pictureBookAudioItem } from '../data/pictureBookAudio.js';
import { NOVEL_AUDIO_CATALOG } from '../../netlify/functions/novel-audio-catalog.js';

afterEach(() => { delete window.EnglishGoTTS; });
it('uses catalogued, content-versioned URLs for every page', () => {
  for (const book of PICTURE_BOOKS) for (let index = 0; index < book.pages.length; index++) {
    const item = pictureBookAudioItem(book, index);
    const id = new URL(item.audioUrl, 'https://example.test').searchParams.get('novel');
    expect(NOVEL_AUDIO_CATALOG[id]).toEqual({ text: book.pages[index].en, lang: 'en-US' });
    expect(pictureBookAudioItem({ ...book, pages: [{ en: 'Changed text.' }] }, 0).audioUrl).not.toBe(item.audioUrl);
  }
});
it('preloads the whole book once, reports partial downloads and retries', async () => {
  const preloadMany = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(4);
  window.EnglishGoTTS = { preloadMany };
  const { result, rerender } = renderHook(() => usePictureBookAudio(PICTURE_BOOKS[0]));
  await waitFor(() => expect(result.current.status).toBe('partial'));
  expect(result.current.ready).toBe(2);
  expect(preloadMany.mock.calls[0][0]).toHaveLength(4);
  rerender(); expect(preloadMany).toHaveBeenCalledTimes(1);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe('ready'));
});
it('waits for the speech patch and ignores a previous book finishing late', async () => {
  let finish;
  const preloadMany = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(3);
  const { result, rerender } = renderHook(({ book }) => usePictureBookAudio(book), { initialProps: { book: PICTURE_BOOKS[0] } });
  window.EnglishGoTTS = { preloadMany };
  act(() => window.dispatchEvent(new Event('englishgo:tts-installed')));
  rerender({ book: PICTURE_BOOKS[1] });
  await waitFor(() => expect(result.current.ready).toBe(3));
  await act(async () => finish(4));
  expect(result.current.ready).toBe(3);
});
