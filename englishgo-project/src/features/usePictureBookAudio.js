import { useEffect, useState } from 'react';
import { pictureBookAudioItem } from '../data/pictureBookAudio.js';

export function usePictureBookAudio(book) {
  const [attempt, retry] = useState(0);
  const [state, setState] = useState({ status: 'idle', ready: 0, total: 0 });
  useEffect(() => {
    if (!book) return;
    let cancelled = false, started = false, loadingTimeout;
    const items = book.pages.map((_, index) => pictureBookAudioItem(book, index));
    setState({ status: 'loading', ready: 0, total: items.length });
    const unavailable = setTimeout(() => {
      if (!cancelled && !started) setState({ status: 'unavailable', ready: 0, total: items.length });
    }, 10000);
    async function preload() {
      const preloadMany = window.EnglishGoTTS?.preloadMany;
      if (started || typeof preloadMany !== 'function') return;
      started = true; clearTimeout(unavailable);
      loadingTimeout = setTimeout(() => {
        if (!cancelled) setState({ status: 'partial', ready: 0, total: items.length });
      }, 30000);
      try {
        const ready = Number(await preloadMany(items, { limit: items.length, concurrency: 2 })) || 0;
        if (!cancelled) setState({ status: ready >= items.length ? 'ready' : 'partial', ready, total: items.length });
      } catch {
        if (!cancelled) setState({ status: 'partial', ready: 0, total: items.length });
      } finally { clearTimeout(loadingTimeout); }
    }
    preload();
    window.addEventListener('englishgo:tts-installed', preload);
    return () => { cancelled = true; clearTimeout(unavailable); clearTimeout(loadingTimeout); window.removeEventListener('englishgo:tts-installed', preload); };
  }, [book, attempt]);
  return { ...state, retry: () => retry(value => value + 1) };
}
