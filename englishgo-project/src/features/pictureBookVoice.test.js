import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { PIP_PAGES } from '../data/pipBook.js';
import { NOVA_PAGES } from '../data/novaBook.js';

// Loads a generated storybook with its real speech adapter and enhancement scripts inlined.
function loadBook(id, { provider = 'elevenlabs', voice = 'EXAVITQu4vr4xnSDxMaL', fetchImpl }) {
  const root = process.cwd();
  const html = readFileSync(path.join(root, `public/picture-books/${id}.html`), 'utf8')
    .replace(/<script src="(\/[^"]+)"><\/script>/g, (_, src) => `<script>${readFileSync(path.join(root, 'public', src), 'utf8')}</script>`);
  const nativeSpeak = vi.fn();
  const fetch = vi.fn(fetchImpl);
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://localhost/picture-books/${id}.html`,
    beforeParse(window) {
      window.localStorage.setItem('eg_tts_provider', provider);
      if (voice) window.localStorage.setItem('eg_tts_voice_id', voice);
      window.speechSynthesis = { speak: nativeSpeak, cancel() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} };
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.lang = 'en-US'; this.rate = 1; } };
      window.fetch = fetch;
      window.Audio = class { constructor(src) { this.src = src; } play() { return Promise.resolve(); } pause() {} };
      window.Image = class { set src(value) { this._src = value; setTimeout(() => this.onload?.(), 0); } get src() { return this._src; } decode() { return Promise.resolve(); } };
      window.ResizeObserver = class { observe() {} disconnect() {} };
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      window.URL.createObjectURL = () => 'blob:book-audio';
      window.URL.revokeObjectURL = () => {};
    },
  });
  return { window: dom.window, fetch, nativeSpeak };
}
const audio = () => new Response('mp3', { headers: { 'Content-Type': 'audio/mpeg' } });
const bodyOf = call => (call[1]?.body ? JSON.parse(call[1].body) : null);
const narrationRequests = (fetch, text) => fetch.mock.calls.filter(call => bodyOf(call)?.text === text && bodyOf(call).cacheOnly === false);

describe('storybook narration follows the learner\'s voice settings', () => {
  it('reads pages and tapped words with the chosen cloud voice, including long junior-high pages', async () => {
    const { window, fetch } = loadBook('nova-and-the-silent-lighthouse', {
      fetchImpl: (url, init) => Promise.resolve(JSON.parse(init?.body || '{}').cacheOnly ? new Response(null, { status: 204 }) : audio()),
    });
    window.document.getElementById('openBook').click();
    await vi.waitFor(() => expect(narrationRequests(fetch, NOVA_PAGES[0].x)).toHaveLength(1));
    const [url, init] = narrationRequests(fetch, NOVA_PAGES[0].x)[0];
    expect(url).toBe('/.netlify/functions/elevenlabs-tts');
    expect(JSON.parse(init.body)).toMatchObject({ voiceId: 'EXAVITQu4vr4xnSDxMaL', modelId: 'eleven_v4', lang: 'en-US' });
    expect(NOVA_PAGES[0].x.length).toBeGreaterThan(350);
    expect(fetch.mock.calls.some(([request]) => String(request).startsWith('/audio/picture-books/'))).toBe(false);
    window.say('lighthouse');
    await vi.waitFor(() => expect(narrationRequests(fetch, 'lighthouse')).toHaveLength(1));
    expect(bodyOf(narrationRequests(fetch, 'lighthouse')[0]).voiceId).toBe('EXAVITQu4vr4xnSDxMaL');
  });

  it('plays the prerecorded page when the cloud voice cannot be reached', async () => {
    const { window, fetch, nativeSpeak } = loadBook('pip-and-the-lost-star', {
      fetchImpl: request => String(request).startsWith('/audio/picture-books/') ? Promise.resolve(audio()) : Promise.reject(new Error('offline')),
    });
    window.document.getElementById('openBook').click();
    await vi.waitFor(() => expect(fetch.mock.calls.some(([request]) => /^\/audio\/picture-books\/pages\/v1-picture-book-pip-lost-star-c1-/.test(String(request)))).toBe(true));
    expect(narrationRequests(fetch, PIP_PAGES[0].x)).toHaveLength(1);
    expect(nativeSpeak).not.toHaveBeenCalled();
  });

  it('uses the device voice when Settings choose device speech', async () => {
    const { window, fetch, nativeSpeak } = loadBook('pip-and-the-lost-star', { provider: 'device', voice: '', fetchImpl: () => Promise.resolve(audio()) });
    window.document.getElementById('openBook').click();
    await vi.waitFor(() => expect(nativeSpeak).toHaveBeenCalled());
    expect(nativeSpeak.mock.calls[0][0].text).toBe(PIP_PAGES[0].x);
    expect(fetch).not.toHaveBeenCalled();
  });
});
