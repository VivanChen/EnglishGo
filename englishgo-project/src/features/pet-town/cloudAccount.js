const ENDPOINT = '/.netlify/functions/pet-account';
const MESSAGES = {
  invalid_credentials: '請輸入暱稱與 4–6 位數字 PIN。',
  unauthorized: '暱稱或 PIN 不正確，請重新登入。',
  account_exists: '這個暱稱已有人使用，請換一個。',
  revision_conflict: '另一台裝置有較新的進度，正在重新整理。',
  mutation_conflict: '這筆存檔的內容已改變，請重新整理後再試。',
  invalid_snapshot: '這份家園資料無法儲存，本機進度仍保留。',
  body_too_large: '這份家園資料過大，暫時無法同步。',
  rate_limited: '同步太頻繁，請稍候再試。',
  cloud_unavailable: '暫時連不上雲端，本機進度仍保留。',
  invalid_request: '請求格式不正確，請重新整理後再試。',
};

export async function hashPin(pin) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) throw new Error(MESSAGES.invalid_credentials);
  if (!globalThis.crypto?.subtle) throw new Error('這個瀏覽器無法安全登入，請使用 HTTPS 或更新瀏覽器。');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Login compatibility only: older clients used this when Web Crypto failed.
// New signups must always use hashPin's SHA-256 result.
export function legacyPinHash(pin) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) throw new Error(MESSAGES.invalid_credentials);
  let hash = 0;
  for (let index = 0; index < pin.length; index++) hash = ((hash << 5) - hash + pin.charCodeAt(index)) | 0;
  return String(hash);
}

export async function requestPetAccount(action, payload = {}, { signal } = {}) {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', cache: 'no-store', signal,
      body: JSON.stringify({ ...payload, action }),
    });
    let result;
    try { result = await response.json(); } catch { result = null; }
    if (response.ok && result?.ok === true && result.accountId && result.snapshot) {
      return { ok: true, accountId: result.accountId, revision: result.revision,
        snapshot: { worldState: result.snapshot.worldState ?? null, coins: result.snapshot.coins }, syncedAt: result.syncedAt };
    }
    const code = response.status === 429 ? 'rate_limited' : Object.hasOwn(MESSAGES, result?.code) ? result.code : 'cloud_unavailable';
    return { ok: false, code, error: MESSAGES[code], status: response.status,
      ...(response.status === 409 && result?.snapshot && result.accountId ? {
        accountId: result.accountId, revision: result.revision,
        snapshot: { worldState: result.snapshot.worldState ?? null, coins: result.snapshot.coins }, syncedAt: result.syncedAt,
      } : {}) };
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    return { ok: false, code: 'cloud_unavailable', error: MESSAGES.cloud_unavailable, status: 0 };
  }
}
