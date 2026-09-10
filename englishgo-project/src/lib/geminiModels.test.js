import { afterEach, expect, it, vi } from 'vitest';
import { GEMINI_MODEL_KEY, getGeminiModels, saveGeminiModelPreference } from './geminiModels.js';
import { requestTutor } from '../features/tutorService.js';

afterEach(() => { vi.unstubAllGlobals(); localStorage.removeItem(GEMINI_MODEL_KEY); });

it('preserves automatic priorities without retired models', () => {
  expect(getGeminiModels()).toEqual(['gemini-2.5-flash-lite', 'gemini-2.5-flash']);
  expect(getGeminiModels(true)).toEqual(['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
});

it('applies a saved choice on the next request and does not fall back after quota errors', async () => {
  saveGeminiModelPreference('gemini-2.5-flash-lite');
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  await expect(requestTutor({ level: { l: '成人', en: 'beginner' }, apiKey: 'test', contents: [] })).rejects.toThrow('429');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain('/gemini-2.5-flash-lite:');
  saveGeminiModelPreference('gemini-2.5-flash');
  expect(getGeminiModels()).toEqual(['gemini-2.5-flash']);
});

it('handles obsolete preferences and unavailable storage safely', () => {
  localStorage.setItem(GEMINI_MODEL_KEY, 'gemini-2.0-flash');
  expect(getGeminiModels()).not.toContain('gemini-2.0-flash');
  vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  expect(getGeminiModels()).toHaveLength(2);
  expect(saveGeminiModelPreference('gemini-2.5-flash')).toBe(false);
});
