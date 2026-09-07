import { afterEach, describe, expect, it, vi } from 'vitest';
import { deskRequest, readExplorer, readTutorBook, tutorContents, tutorError, wordIdentity } from './learningDesk.js';
import { requestTutor } from '../features/tutorService.js';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('learning desk storage and requests', () => {
  it('keeps separate word identities and safely reads saved explorer data', () => {
    const word = { w: 'apple', m: '蘋果', level: 'elementary', ex: 'An apple falls from the tree.' };
    const result = readExplorer({ query: 'x'.repeat(100), favorites: [word, word, { ...word, level: 'junior' }, null], recent: ['apple', 'apple', null], selected: word });
    expect(result.query).toHaveLength(80); expect(result.favorites).toHaveLength(2); expect(result.recent).toEqual(['apple']); expect(result.selected.ex).toBe(word.ex);
    expect(wordIdentity(result.favorites[0])).not.toBe(wordIdentity(result.favorites[1]));
  });
  it('restores unfinished requests as stopped without losing their question', () => {
    const book = readTutorBook({ activeId: 'invalid', sessions: [{ id: 'a', draft: 'keep me', turns: [{ id: 't', question: 'Hello', status: 'pending' }] }, { id: 'a' }] });
    expect(book.sessions).toHaveLength(1); expect(book.activeId).toBe('a'); expect(book.sessions[0].draft).toBe('keep me'); expect(book.sessions[0].turns[0]).toMatchObject({ question: 'Hello', status: 'stopped' });
    expect(readTutorBook({ sessions: [] }).sessions).toHaveLength(1);
  });
  it('sends only completed conversation pairs followed by the current question', () => {
    const turns = [{ question: 'failed', status: 'failed', answer: 'Do not send this error' }, ...Array.from({ length: 7 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}`, status: 'done' }))];
    const contents = tutorContents(turns, 'now');
    expect(contents).toHaveLength(11); expect(contents[0].parts[0].text).toBe('Q2'); expect(contents.at(-1)).toEqual({ role: 'user', parts: [{ text: 'now' }] });
    expect(JSON.stringify(contents)).not.toContain('failed');
  });
  it('settles timeouts and cancellation even if the source never resolves, with no timers left', async () => {
    vi.useFakeTimers(); const pending = new Promise(() => {}), controller = new AbortController();
    const timeout = deskRequest(() => pending, { timeout: 10 }).catch(error => error.name);
    await vi.advanceTimersByTimeAsync(11); expect(await timeout).toBe('TimeoutError');
    const cancelled = deskRequest(() => pending, { signal: controller.signal }).catch(error => error.name); controller.abort(); expect(await cancelled).toBe('AbortError'); expect(vi.getTimerCount()).toBe(0);
  });
  it('uses the existing fallback order for a busy tutor provider', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) }).mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '**Hello**，你好。' }] } }] }) });
    vi.stubGlobal('fetch', fetchMock); const answer = await requestTutor({ level: { l: '小學', en: 'Elementary' }, apiKey: 'test-key', contents: tutorContents([], 'hello') });
    expect(answer).toContain('Hello'); expect(fetchMock.mock.calls[0][0]).toContain('gemini-2.5-flash:'); expect(fetchMock.mock.calls[1][0]).toContain('gemini-2.5-flash-lite:');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body); expect(body.systemInstruction.parts[0].text).toContain('Elementary'); expect(body.contents).toHaveLength(1);
  });
  it('does not request after cancellation or expose raw provider errors to children', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); const controller = new AbortController(); controller.abort();
    await expect(requestTutor({ signal: controller.signal, apiKey: 'test', level: { l: '小學' } })).rejects.toHaveProperty('name', 'AbortError'); expect(fetchMock).not.toHaveBeenCalled();
    expect(tutorError(new Error('403 API_KEY secret=anything'))).toBe('AI 設定需要檢查，請大人到設定頁幫忙。');
    expect(tutorError(new Error('secret internals'))).not.toContain('secret');
  });
});
