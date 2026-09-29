import { getGeminiModels } from '../lib/geminiModels.js';
import { assertServiceResponse, serviceFetch } from '../lib/serviceErrors.js';

export function normalizeExamMeanings(raw, words) {
  const requested = new Set(words);
  const rows = Array.isArray(raw?.meanings) ? raw.meanings : [];
  const meanings = Object.create(null);
  for (const row of rows) {
    const word = String(row?.word || '').trim().toLowerCase();
    const meaning = String(row?.meaning || '').trim();
    if (requested.has(word) && !meanings[word] && meaning.length <= 120 && /\p{Script=Han}/u.test(meaning)) meanings[word] = meaning;
  }
  return meanings;
}

export async function lookupExamMeanings({ words, apiKey, signal, onProgress }) {
  if (!apiKey?.trim()) throw new Error('請先到設定填入 Gemini API Key。');
  const result = Object.create(null);
  for (let start = 0; start < words.length; start += 20) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const batch = words.slice(start, start + 20);
    const prompt = `你是台灣英文老師。請為以下英文單字提供最常用、適合考試複習的繁體中文字義，每字只要簡短字義。若不確定或不是英文單字，請省略。不得加入未提供的單字。\n單字：${JSON.stringify(batch)}\n只回傳 JSON，例如：{"meanings":[{"word":"apple","meaning":"蘋果"}]}`;
    let lastError, found = null;
    for (const model of getGeminiModels()) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      try {
        const response = await serviceFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2200, temperature: 0.2, responseMimeType: 'application/json' } }),
        });
        const data = await response.json();
        assertServiceResponse(response, data);
        const content = (data?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
        if (!content) continue;
        found = normalizeExamMeanings(JSON.parse(content), batch);
        break;
      } catch (error) {
        lastError = error;
        if (signal?.aborted || error.noRetry) throw error;
      }
    }
    if (!found) throw lastError || new Error('AI 字義暫時沒有回來。');
    Object.assign(result, found);
    onProgress?.(Math.min(start + batch.length, words.length), words.length);
  }
  return result;
}
