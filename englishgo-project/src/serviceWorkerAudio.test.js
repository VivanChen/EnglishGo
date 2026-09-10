import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const workerSource = readFileSync(resolve(process.cwd(), "public", "sw.js"), "utf8");

function loadWorker(fetchImpl) {
  const listeners = {};
  const cache = {
    put: vi.fn(async () => {}),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    addAll: vi.fn(async () => {}),
  };
  const cacheStorage = {
    open: vi.fn(async () => cache),
    match: vi.fn(async () => undefined),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  };

  runInNewContext(workerSource, {
    URL,
    Response,
    Promise,
    fetch: fetchImpl,
    caches: cacheStorage,
    location: { origin: "https://englishgo-vevan.netlify.app" },
    self: {
      addEventListener: (type, handler) => { listeners[type] = handler; },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
  });

  return { listeners, cacheStorage, cache };
}

async function dispatchFetch(handler, request) {
  let responsePromise;
  handler({
    request,
    waitUntil: () => {},
    respondWith: value => { responsePromise = Promise.resolve(value); },
  });
  return responsePromise;
}

describe("EnglishGo service worker audio streaming", () => {
  it("passes audio range requests directly to the network without caching", async () => {
    const networkResponse = new Response(new Uint8Array([73, 68, 51]), {
      status: 206,
      headers: { "Content-Type": "audio/mpeg", "Content-Range": "bytes 0-2/10" },
    });
    const fetchImpl = vi.fn(async () => networkResponse);
    const { listeners, cacheStorage } = loadWorker(fetchImpl);
    const request = {
      method: "GET",
      url: "https://englishgo-vevan.netlify.app/audio/songs/test.mp3",
      destination: "audio",
      headers: new Headers({ Range: "bytes=0-1023" }),
    };

    const response = await dispatchFetch(listeners.fetch, request);

    expect(response.status).toBe(206);
    expect(fetchImpl).toHaveBeenCalledWith(request);
    expect(cacheStorage.open).not.toHaveBeenCalled();
  });

  it("does not cache a partial response even when the request is not marked as media", async () => {
    const networkResponse = new Response(new Uint8Array([1]), { status: 206 });
    const fetchImpl = vi.fn(async () => networkResponse);
    const { listeners, cacheStorage } = loadWorker(fetchImpl);
    const request = {
      method: "GET",
      url: "https://englishgo-vevan.netlify.app/assets/partial.bin",
      destination: "script",
      headers: new Headers(),
    };

    const response = await dispatchFetch(listeners.fetch, request);

    expect(response.status).toBe(206);
    expect(cacheStorage.open).not.toHaveBeenCalled();
  });
});


describe("deployment chunk caching", () => {
  const request = { method: "GET", url: "https://englishgo-vevan.netlify.app/assets/old.js", destination: "script", headers: new Headers() };
  it("rejects HTML returned for a missing chunk without caching it", async () => {
    const { listeners, cache } = loadWorker(vi.fn(async () => new Response("<html>fallback</html>", { headers: { "Content-Type": "text/html" } })));
    const response = await dispatchFetch(listeners.fetch, request);
    expect(response.status).toBe(404);
    expect(cache.put).not.toHaveBeenCalled();
  });
  it("uses a previously cached chunk when a deployment removes the network file", async () => {
    const fetchImpl = vi.fn();
    const { listeners, cacheStorage } = loadWorker(fetchImpl);
    cacheStorage.match.mockResolvedValue(new Response("export default 1", { headers: { "Content-Type": "text/javascript" } }));
    expect(await (await dispatchFetch(listeners.fetch, request)).text()).toBe("export default 1");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("replaces a poisoned HTML cache entry with the real script", async () => {
    const { listeners, cacheStorage } = loadWorker(vi.fn(async () => new Response("export default 2", { headers: { "Content-Type": "text/javascript" } })));
    cacheStorage.match.mockResolvedValue(new Response("<html/>", { headers: { "Content-Type": "text/html" } }));
    expect(await (await dispatchFetch(listeners.fetch, request)).text()).toBe("export default 2");
  });
});

describe("service worker font responses", () => {
  const fontRequest = { method: "GET", url: "https://englishgo-vevan.netlify.app/fonts/font.woff2", destination: "font", headers: new Headers() };

  it("lets the browser load external fonts under font-src instead of worker connect-src", async () => {
    const fetchImpl = vi.fn();
    const { listeners, cacheStorage } = loadWorker(fetchImpl);
    expect(await dispatchFetch(listeners.fetch, { ...fontRequest, url: 'https://fonts.gstatic.com/font.woff2' })).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cacheStorage.match).not.toHaveBeenCalled();
  });

  it("leaves extension font requests to the browser", async () => {
    const fetchImpl = vi.fn();
    const { listeners, cacheStorage } = loadWorker(fetchImpl);
    const response = await dispatchFetch(listeners.fetch, { ...fontRequest, url: "chrome-extension://adobe/browser/css/fonts/AdobeClean-Regular.otf" });
    expect(response).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cacheStorage.match).not.toHaveBeenCalled();
  });

  it("never substitutes the PNG icon for an unavailable font", async () => {
    const { listeners, cacheStorage } = loadWorker(vi.fn(async () => { throw new TypeError("Network unavailable"); }));
    cacheStorage.match.mockImplementation(async key => key === '/icon-192.png'
      ? new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } })
      : undefined);
    const response = await dispatchFetch(listeners.fetch, fontRequest);
    expect(response.type).toBe('error');
    expect(cacheStorage.match).not.toHaveBeenCalledWith('/icon-192.png');
  });

  it("returns downloaded fonts even when cache storage is full", async () => {
    const { listeners, cache } = loadWorker(vi.fn(async () => new Response('wOF2', { headers: { 'Content-Type': 'font/woff2' } })));
    cache.put.mockRejectedValue(new Error('QuotaExceededError'));
    const response = await dispatchFetch(listeners.fetch, fontRequest);
    expect(response.headers.get('content-type')).toBe('font/woff2');
    expect(await response.text()).toBe('wOF2');
  });

  it("uses an available cached font when the network is offline", async () => {
    const { listeners, cacheStorage } = loadWorker(vi.fn(async () => { throw new TypeError('Offline'); }));
    cacheStorage.match.mockResolvedValue(new Response('cached font', { headers: { 'Content-Type': 'font/woff2' } }));
    expect(await (await dispatchFetch(listeners.fetch, fontRequest)).text()).toBe('cached font');
  });
});
