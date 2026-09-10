import { serviceFetch, assertServiceResponse } from './serviceErrors.js';
const cache = new Map();

export function forgetGif(word, apiKey) {
  cache.delete(`${String(apiKey || '').trim()}:${String(word || '').trim().toLowerCase()}`);
}

export async function fetchGif(word, apiKey, signal) {
  const key = String(apiKey || '').trim(), query = String(word || '').trim().toLowerCase();
  if (!key || !query) return null;
  const cacheKey = `${key}:${query}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await serviceFetch(`https://api.giphy.com/v1/gifs/translate?api_key=${encodeURIComponent(key)}&s=${encodeURIComponent(query)}&rating=g&lang=en`, { signal });
  const data = await response.json().catch(() => ({}));
  assertServiceResponse(response, data);
  const url = data?.data?.images?.fixed_height_small?.url || data?.data?.images?.fixed_height?.url || null;
  // Cache successful media only. A failed/no-result lookup remains retryable.
  if (url) cache.set(cacheKey, url);
  return url;
}
