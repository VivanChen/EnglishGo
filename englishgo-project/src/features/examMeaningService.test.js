import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupExamMeanings, normalizeExamMeanings } from './examMeaningService.js';

afterEach(() => vi.unstubAllGlobals());

describe('exam AI meanings', () => {
  it('accepts only requested words with short Traditional Chinese meanings', () => {
    const values = normalizeExamMeanings({ meanings: [
      { word: 'APPLE', meaning: '蘋果' }, { word: 'extra', meaning: '額外' },
      { word: 'book', meaning: 'book' }, { word: 'cat', meaning: '很'.repeat(121) },
    ] }, ['apple', 'book', 'cat']);
    expect(Object.entries(values)).toEqual([['apple', '蘋果']]);
  });
  it('queries missing meanings in bounded batches and reports progress', async () => {
    const words = Array.from({ length: 21 }, (_, index) => `word${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`);
    const requests = [], progress = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      const batch = JSON.parse(options.body).contents[0].parts[0].text.match(/單字：(\[[^\n]+\])/)[1];
      requests.push(JSON.parse(batch));
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ meanings: JSON.parse(batch).map(word => ({ word, meaning: '單字' })) }) }] } }] }) };
    }));
    const result = await lookupExamMeanings({ words, apiKey: 'test', onProgress: progress });
    expect(requests.map(batch => batch.length)).toEqual([20, 1]);
    expect(Object.keys(result)).toHaveLength(21);
    expect(progress.mock.calls).toEqual([[20, 21], [21, 21]]);
  });
});
