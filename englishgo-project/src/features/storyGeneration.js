import { getGeminiModels } from '../lib/geminiModels.js';
// Each attempt must return a complete story using the current model preference.


const hasText = value => typeof value === 'string' && value.trim().length > 0;

export function parseStoryResponse(text, pageCount) {
  const source = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = source.indexOf('{'), end = source.lastIndexOf('}');
  const raw = JSON.parse(start >= 0 && end > start ? source.slice(start, end + 1) : source);
  if (!Array.isArray(raw?.pages) || raw.pages.length !== pageCount ||
      raw.pages.some(page => !hasText(page?.en) || !hasText(page?.zh)) ||
      !Array.isArray(raw?.questions) || raw.questions.length !== 3 ||
      raw.questions.some(question => {
        const choices = question?.choices || question?.options;
        const answer = question?.correct ?? question?.answer;
        return !hasText(question?.q || question?.question) || !Array.isArray(choices) ||
          choices.length !== 4 || !choices.every(hasText) ||
          !Number.isInteger(answer) || answer < 0 || answer >= choices.length;
      })) throw new Error('故事內容不完整');
  return raw;
}

function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const finish = () => { signal.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Cancelled', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function generateStoryPayload({ apiKey, prompt, pageCount, signal, fetchImpl = fetch, timeoutMs = 60_000 }) {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; cancel(); }, timeoutMs);
  let lastError = new Error('生成失敗');
  try {
    for (const model of getGeminiModels(true)) {
      for (let attempt = 0; attempt < 3; attempt++) {
        controller.signal.throwIfAborted();
        try {
          const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2500, temperature: 0.85, responseMimeType: 'application/json' } }),
          });
          const data = await response.json();
          controller.signal.throwIfAborted();
          if (!response.ok || data?.error) {
            const status = data?.error?.code || response.status;
            if (status === 400 || status === 401 || status === 403) {
              const error = new Error('API Key 無效，請檢查設定');
              error.noRetry = true;
              throw error;
            }
            throw new Error(status === 429 || status === 503 ? '模型忙碌中' : 'AI 服務暫時無法使用');
          }
          const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
          return parseStoryResponse(text, pageCount);
        } catch (error) {
          controller.signal.throwIfAborted();
          if (error.noRetry) throw error;
          lastError = error;
          if (attempt < 2) await waitForRetry(1000 * 2 ** attempt, controller.signal);
        }
      }
    }
    throw lastError;
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new Error('等待 AI 回覆逾時，請再試一次');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
