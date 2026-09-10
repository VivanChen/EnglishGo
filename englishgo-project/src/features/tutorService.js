import { serviceFetch, responseError } from '../lib/serviceErrors.js';
import { getGeminiModels } from '../lib/geminiModels.js';
// Resolve the parent-selected model for each new request.
export async function requestTutor({ level, apiKey, contents, signal }) {
  const systemText = `You are EnglishGo AI Tutor for a Taiwanese ${level.l} student.
Reply mainly in Traditional Chinese, with target English words or phrases in **bold**.
Keep answers short, warm, accurate, and age-appropriate.
Adjust difficulty to ${level.en}: use simple words for elementary, add grammar detail for older students.
When teaching, prefer this structure:
重點:
例句:
小練習:
Use natural English examples with Traditional Chinese translation.
For correction requests, show 原句, 修正版, 原因, 再練一句.
Ask only one follow-up question at a time.
Do not imitate copyrighted songs, books, or specific artists.`;
  const models = getGeminiModels(true);
  let lastError;
  for (const model of models) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    const response = await serviceFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemText }] }, contents, generationConfig: { maxOutputTokens: 900, temperature: .65, topP: .9 } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      const code = data.error?.code || response.status;
      lastError = responseError(response, data);
      if (!lastError.noRetry && (code === 503 || code === 404)) continue;
      throw lastError;
    }
    const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (answer) return answer;
    lastError = new Error('Empty answer');
  }
  throw lastError || new Error('No answer');
}
