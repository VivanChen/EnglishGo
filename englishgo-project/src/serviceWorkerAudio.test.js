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
