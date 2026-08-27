// EnglishGo Service Worker - offline-first PWA
const CACHE_VERSION = 'englishgo-v1.2.1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const DYNAMIC_CACHE_LIMIT = 160;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/elevenlabs-tts-patch.js',
];

async function trimCache(cacheName, maxEntries = DYNAMIC_CACHE_LIMIT) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;
  if (overflow > 0) await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}

async function cacheDynamicResponse(request, response) {
  if (!response?.ok) return;
  const cache = await caches.open(DYNAMIC_CACHE);
  await cache.put(request, response.clone());
  await trimCache(DYNAMIC_CACHE);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Never cache API/database calls
  const isAPI = url.hostname.includes('supabase.co') ||
                url.hostname.includes('googleapis.com') ||
                url.hostname.includes('generativelanguage') ||
                url.hostname.includes('giphy.com') ||
                url.hostname.includes('loremflickr.com') ||
                url.pathname.startsWith('/api/');
  if (isAPI) return;

  // Images/fonts: stale-while-revalidate so same-path media can still be updated.
  if (request.destination === 'image' || request.destination === 'font') {
    const networkResponse = fetch(request).then(async (response) => {
      await cacheDynamicResponse(request, response);
      return response;
    });
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          event.waitUntil(networkResponse.catch(() => null));
          return cached;
        }
        return networkResponse.catch(() => caches.match('/icon-192.png'));
      })
    );
    return;
  }

  // HTML/JS/CSS: network-first
  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (response.ok && url.origin === location.origin) {
          await cacheDynamicResponse(request, response);
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});
