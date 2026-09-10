export class ServiceError extends Error {
  constructor(kind, status = 0) {
    super(`External service ${kind}${status ? ` (${status})` : ''}`);
    this.name = 'ServiceError';
    this.kind = kind;
    this.status = status;
    this.noRetry = ['auth', 'limited', 'request', 'network', 'timeout'].includes(kind);
  }
}

export function responseError(response, data) {
  const status = Number(data?.error?.code || data?.meta?.status || response?.status || 0);
  // Inspect provider diagnostics to classify only; never display them or the Key.
  const reason = String(data?.error?.message || data?.meta?.msg || '');
  if (status === 429) return new ServiceError('limited', status);
  if (status === 401 || status === 403 || /API.?key.*(?:invalid|not valid)|API_KEY_INVALID/i.test(reason)) return new ServiceError('auth', status);
  if (status === 404) return new ServiceError('model', status);
  if (status >= 500) return new ServiceError('unavailable', status);
  return new ServiceError('request', status);
}

export function assertServiceResponse(response, data) {
  if (response?.ok === false || data?.error || Number(data?.meta?.status) >= 400) throw responseError(response, data);
}

export function serviceErrorMessage(error, fallback = 'AI 暫時無法完成回覆，請稍後重試。', service = 'Gemini') {
  const status = Number(error?.status || error?.details?.status || 0);
  const kind = error?.kind || error?.details?.kind || (status ? responseError({ status }).kind : '');
  if (kind === 'limited') return `${service} 目前達到使用限制，可能是呼叫太頻繁或額度不足。請稍後重試，或請家長查看帳號額度。`;
  if (kind === 'auth') return `${service} API Key 無效或權限不足，請到設定檢查。`;
  if (kind === 'model') return service === 'Giphy' ? 'Giphy 動圖服務目前不可用，請稍後重試。' : `${service} 所選模型目前不可用，請到設定檢查模型，或稍後重試。`;
  if (kind === 'request') return service === 'Giphy' ? 'Giphy 無法接受這次動圖查詢，請檢查單字或 Key 設定。' : `${service} 無法接受這次請求，請檢查輸入或模型設定後重試。`;
  if (kind === 'unavailable') return `${service} 服務暫時異常，請稍後重試。`;
  if (kind === 'network' || error instanceof TypeError || /failed to fetch|network|fetch failed/i.test(error?.details?.message || error?.message || '')) return `${service} 暫時無法連線，請檢查網路後重試。`;
  if (kind === 'timeout' || error?.name === 'TimeoutError' || /逾時/.test(error?.details?.message || error?.message || '')) return `${service} 等候回覆逾時，請稍後重試。`;
  return fallback;
}

// Bound requests so a stalled connection does not leave the loading UI forever.
export async function serviceFetch(url, options = {}, fetchImpl = fetch, timeoutMs = 20000) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let timer;
  const aborted = new Promise((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(options.signal?.aborted
      ? new DOMException('Cancelled', 'AbortError') : new ServiceError('timeout')), { once: true });
    timer = setTimeout(cancel, timeoutMs);
  });
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    const request = async () => {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      let data;
      try { data = await response.json(); }
      catch (error) {
        if (error?.name === 'AbortError') throw error;
        if (response.ok === false) data = {};
        else throw new ServiceError('invalid');
      }
      return { ok: response.ok, status: response.status, json: async () => data };
    };
    return await Promise.race([options.signal?.aborted ? aborted : request(), aborted]);
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (error?.name === 'AbortError') throw error;
    if (error?.kind) throw error;
    if (controller.signal.aborted) throw new ServiceError('timeout');
    throw new ServiceError('network');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
