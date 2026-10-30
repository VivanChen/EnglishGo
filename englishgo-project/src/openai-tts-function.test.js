import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { synthesizeSpeech } = vi.hoisted(() => ({ synthesizeSpeech: vi.fn() }));
vi.mock("../netlify/lib/openai-speech.mjs", () => ({
  synthesizeSpeech,
  OPENAI_SPEECH_MODEL: "gpt-realtime-test",
  OPENAI_SPEECH_PROMPT_REVISION: "learning-v1",
}));

function wav(marker = "audio", size = 64) {
  const audio = Buffer.alloc(size);
  audio.write("RIFF", 0); audio.writeUInt32LE(size - 8, 4); audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(24000, 24); audio.writeUInt32LE(48000, 28);
  audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write("data", 36); audio.writeUInt32LE(size - 44, 40);
  audio.write(marker, 44);
  return audio;
}

function missingObject() {
  return new Response(JSON.stringify({ code: "NoSuchKey", message: "The specified key does not exist." }), {
    status: 404, headers: { "Content-Type": "application/json" },
  });
}

function request(payload = { text: "apple" }, extra = {}) {
  return new Request("https://englishgo.example/.netlify/functions/openai-tts", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://englishgo.example" },
    body: JSON.stringify(payload), ...extra,
  });
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function enableStorage() {
  vi.stubEnv("SUPABASE_URL", "https://storage.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-service-key");
}

let handler;
let config;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("Netlify", undefined);
  for (const name of ["OPENAI_API_KEY", "SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_TTS_BUCKET"]) vi.stubEnv(name, "");
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  synthesizeSpeech.mockReset().mockResolvedValue(wav());
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => missingObject()));
  ({ default: handler, config } = await import("../netlify/functions/openai-tts.mjs"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenAI pronunciation endpoint", () => {
  it("accepts only same-origin POST requests and declares the IP rate limit", async () => {
    const method = await handler(new Request("https://englishgo.example/.netlify/functions/openai-tts"));
    expect(method.status).toBe(405);
    expect(method.headers.get("Allow")).toBe("POST");
    const crossOrigin = await handler(request({ text: "apple" }, { headers: { Origin: "https://elsewhere.example" } }));
    expect(crossOrigin.status).toBe(403);
    expect(crossOrigin.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(config.rateLimit).toEqual({ action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 60 });
  });

  it.each([
    [null, "invalid_json"], [[], "invalid_json"], ["hello", "invalid_json"],
    [{}, "invalid_text"], [{ text: 42 }, "invalid_text"], [{ text: "  " }, "invalid_text"],
    [{ text: "a".repeat(351) }, "invalid_text"], [{ text: "apple", lang: "fr" }, "invalid_language"],
    [{ text: "apple", lang: {} }, "invalid_language"], [{ text: "apple", voiceId: "legacy-voice" }, "invalid_voice"],
    [{ text: "apple", speed: "fast" }, "invalid_speed"], [{ text: "apple", forceRegenerate: "true" }, "invalid_regeneration"],
    [{ text: "apple", cacheOnly: "true" }, "invalid_cache_only"],
    [{ text: "apple", cacheOnly: true, forceRegenerate: true }, "invalid_cache_request"],
  ])("rejects invalid input %j before calling a paid provider", async (payload, code) => {
    const response = await handler(request(payload));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe(code);
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds the actual body even without Content-Length and rejects malformed JSON", async () => {
    const tooLarge = await handler(request({ text: "a", unused: "x".repeat(4096) }));
    expect(tooLarge.status).toBe(413);
    const malformed = await handler(request({}, { body: "{" }));
    expect(malformed.status).toBe(400);
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("normalizes text while preserving case and clamps speed for English and Chinese", async () => {
    await handler(request({ text: "  Ｄo I take the US bus? \n", speed: 8, voiceId: "cedar", lang: "en-GB" }));
    await handler(request({ text: " i ", speed: 0.1 }));
    await handler(request({ text: "今天一起練習。", lang: "zh-Hant-TW", voiceId: "coral" }));
    expect(synthesizeSpeech.mock.calls.map(([input]) => input)).toEqual([
      { apiKey: "test-key-not-real", text: "Do I take the US bus?", lang: "en-US", voice: "cedar", speed: 1.2 },
      { apiKey: "test-key-not-real", text: "I", lang: "en-US", voice: "marin", speed: 0.7 },
      { apiKey: "test-key-not-real", text: "今天一起練習。", lang: "zh-TW", voice: "coral", speed: 1 },
    ]);
  });

  it("returns sanitized configuration failure only after checking persistent cache", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    enableStorage();
    fetch.mockResolvedValueOnce(new Response(wav(), { headers: { "Content-Type": "audio/wav" } }));
    const cached = await handler(request());
    expect(cached.status).toBe(200);
    expect(cached.headers.get("X-TTS-Source")).toBe("supabase-cache");
    const missing = await handler(request({ text: "uncached" }));
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ code: "speech_not_configured", error: "OpenAI speech is not configured yet." });
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("serves cache-only hits and misses without an OpenAI key or paid generation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    enableStorage();
    fetch.mockResolvedValueOnce(new Response(wav("hit")));
    const hit = await handler(request({ text: "apple", cacheOnly: true }));
    expect(hit.status).toBe(200);
    expect(hit.headers.get("X-TTS-Source")).toBe("supabase-cache");
    const miss = await handler(request({ text: "missing", cacheOnly: true }));
    expect(miss.status).toBe(204);
    expect(miss.headers.get("Cache-Control")).toBe("no-store");
    expect(miss.headers.get("X-TTS-Cache-Read")).toBe("miss");
    expect(await miss.text()).toBe("");
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(fetch.mock.calls.every(([, options]) => options.method !== "POST")).toBe(true);
  });

  it("returns a cache-only miss when storage is disabled and never joins in-flight synthesis", async () => {
    const generated = deferred();
    synthesizeSpeech.mockReturnValue(generated.promise);
    const first = handler(request());
    await vi.waitFor(() => expect(synthesizeSpeech).toHaveBeenCalledOnce());
    const miss = await handler(request({ text: "apple", cacheOnly: true }));
    expect(miss.status).toBe(204);
    expect(synthesizeSpeech).toHaveBeenCalledOnce();
    generated.resolve(wav());
    await first;
    vi.stubEnv("OPENAI_API_KEY", "");
    const warm = await handler(request({ text: "apple", cacheOnly: true }));
    expect(warm.status).toBe(200);
    expect(warm.headers.get("X-TTS-Source")).toBe("memory-cache");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not let a slow cache-only read replace newer regenerated warm audio", async () => {
    enableStorage();
    const read = deferred();
    fetch.mockImplementation(async (_, options = {}) => options.method === "POST"
      ? new Response(null, { status: 200 }) : read.promise);
    const probe = handler(request({ text: "apple", cacheOnly: true }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    synthesizeSpeech.mockResolvedValue(wav("new"));
    await handler(request({ text: "apple", forceRegenerate: true }));
    read.resolve(new Response(wav("old")));
    expect((await probe).status).toBe(200);
    const cached = await handler(request());
    expect(cached.headers.get("X-TTS-Source")).toBe("memory-cache");
    expect(Buffer.from(await cached.arrayBuffer()).subarray(44, 47).toString()).toBe("new");
  });

  it("refreshes warm audio after 60 seconds even when it was played frequently", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T00:00:00Z"));
    enableStorage();
    let persisted = wav("old");
    fetch.mockImplementation(async (_, options = {}) => {
      if (options.method === "POST") {
        persisted = Buffer.from(options.body);
        return new Response(null, { status: 200 });
      }
      return new Response(persisted);
    });
    await handler(request());
    vi.resetModules();
    const { default: otherInstance } = await import("../netlify/functions/openai-tts.mjs");
    synthesizeSpeech.mockResolvedValue(wav("new"));
    await otherInstance(request({ text: "apple", forceRegenerate: true }));
    await vi.advanceTimersByTimeAsync(30_000);
    const beforeTtl = await handler(request());
    expect(Buffer.from(await beforeTtl.arrayBuffer()).subarray(44, 47).toString()).toBe("old");
    await vi.advanceTimersByTimeAsync(30_000);
    const afterTtl = await handler(request());
    expect(afterTtl.headers.get("X-TTS-Source")).toBe("supabase-cache");
    expect(Buffer.from(await afterTtl.arrayBuffer()).subarray(44, 47).toString()).toBe("new");
    expect(synthesizeSpeech).toHaveBeenCalledOnce();
  });

  it("reuses bounded warm cache and namespaces persistent audio by provider, model, voice, speed and case", async () => {
    enableStorage();
    fetch.mockImplementation(async (_, options = {}) => options.method === "POST" ? new Response(null, { status: 200 }) : missingObject());
    const first = await handler(request());
    const repeated = await handler(request());
    await handler(request({ text: "apple", voiceId: "cedar" }));
    await handler(request({ text: "apple", speed: 0.8 }));
    await handler(request({ text: "Apple" }));
    expect(first.headers.get("Content-Type")).toBe("audio/wav");
    expect(first.headers.get("Cache-Control")).toBe("no-store");
    expect(first.headers.get("X-TTS-Provider")).toBe("openai");
    expect(first.headers.get("X-TTS-Cache-Upload")).toBe("ok");
    expect(repeated.headers.get("X-TTS-Source")).toBe("memory-cache");
    expect(synthesizeSpeech).toHaveBeenCalledTimes(4);
    const writes = fetch.mock.calls.filter(([, options]) => options.method === "POST");
    expect(writes).toHaveLength(4);
    expect(new Set(writes.map(([url]) => url)).size).toBe(4);
    expect(writes[0][0]).toMatch(/\/tts-cache\/openai\/learning-v1\/gpt-realtime-test\/marin\/[a-f0-9]{64}\.wav$/);
    expect(writes[1][0]).toContain("/cedar/");
    expect(writes[0][1].headers["Content-Type"]).toBe("audio/wav");
    expect(writes.every(([, options]) => options.headers["x-upsert"] === "false")).toBe(true);
  });

  it("coalesces simultaneous requests without tying shared synthesis to one request's abort signal", async () => {
    const generated = deferred();
    synthesizeSpeech.mockReturnValue(generated.promise);
    const controller = new AbortController();
    const firstRequest = request();
    // jsdom's AbortSignal differs from Node's Request signal constructor.
    Object.defineProperty(firstRequest, "signal", { value: controller.signal });
    const first = handler(firstRequest);
    const second = handler(request());
    await vi.waitFor(() => expect(synthesizeSpeech).toHaveBeenCalledTimes(1));
    controller.abort();
    generated.resolve(wav());
    const responses = await Promise.all([first, second]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(synthesizeSpeech.mock.calls[0][0]).not.toHaveProperty("signal");
  });

  it("does not let an older generation overwrite newly regenerated memory or storage", async () => {
    enableStorage();
    fetch.mockImplementation(async (_, options = {}) => options.method === "POST" ? new Response(null, { status: 200 }) : missingObject());
    const old = deferred();
    synthesizeSpeech.mockReturnValueOnce(old.promise).mockResolvedValueOnce(wav("new"));
    const initial = handler(request());
    await vi.waitFor(() => expect(synthesizeSpeech).toHaveBeenCalledTimes(1));
    const refreshed = await handler(request({ text: "apple", forceRegenerate: true }));
    old.resolve(wav("old"));
    await initial;
    expect(refreshed.headers.get("X-TTS-Cache-Upload")).toBe("ok");
    const cached = await handler(request());
    expect(Buffer.from(await cached.arrayBuffer()).subarray(44, 47).toString()).toBe("new");
    const writes = fetch.mock.calls.filter(([, options]) => options.method === "POST");
    expect(writes).toHaveLength(1);
    expect(writes[0][1].body.subarray(44, 47).toString()).toBe("new");
  });

  it("orders a regeneration after an already running older cache upload", async () => {
    enableStorage();
    const oldUpload = deferred();
    let writeCount = 0;
    fetch.mockImplementation(async (_, options = {}) => {
      if (options.method !== "POST") return missingObject();
      writeCount += 1;
      return writeCount === 1 ? oldUpload.promise : new Response(null, { status: 200 });
    });
    synthesizeSpeech.mockResolvedValueOnce(wav("old")).mockResolvedValueOnce(wav("new"));
    const initial = handler(request());
    await vi.waitFor(() => expect(writeCount).toBe(1));
    const refreshed = handler(request({ text: "apple", forceRegenerate: true }));
    await vi.waitFor(() => expect(synthesizeSpeech).toHaveBeenCalledTimes(2));
    expect(writeCount).toBe(1);
    oldUpload.resolve(new Response(null, { status: 200 }));
    await Promise.all([initial, refreshed]);
    const writes = fetch.mock.calls.filter(([, options]) => options.method === "POST");
    expect(writes.map(([, options]) => options.body.subarray(44, 47).toString())).toEqual(["old", "new"]);
    expect(writes.map(([, options]) => options.headers["x-upsert"])).toEqual(["false", "true"]);
  });

  it("preserves another instance's regenerated audio when an older synthesis finishes later", async () => {
    enableStorage();
    let persisted = null;
    fetch.mockImplementation(async (_, options = {}) => {
      if (options.method !== "POST") return persisted
        ? new Response(persisted, { headers: { "Content-Type": "audio/wav" } })
        : missingObject();
      if (persisted && options.headers["x-upsert"] !== "true") return new Response(null, { status: 409 });
      persisted = Buffer.from(options.body);
      return new Response(null, { status: 200 });
    });
    const old = deferred();
    synthesizeSpeech.mockReturnValueOnce(old.promise).mockResolvedValueOnce(wav("new"));
    const initial = handler(request());
    await vi.waitFor(() => expect(synthesizeSpeech).toHaveBeenCalledTimes(1));
    // A fresh module models a second serverless instance with separate maps.
    vi.resetModules();
    const { default: otherInstance } = await import("../netlify/functions/openai-tts.mjs");
    const refreshed = await otherInstance(request({ text: "apple", forceRegenerate: true }));
    expect(refreshed.headers.get("X-TTS-Cache-Upload")).toBe("ok");
    old.resolve(wav("old"));
    const late = await initial;
    expect(late.headers.get("X-TTS-Cache-Upload")).toBe("preserved");
    expect(late.headers.get("X-TTS-Source")).toBe("supabase-cache");
    expect(persisted.subarray(44, 47).toString()).toBe("new");
    expect(Buffer.from(await late.arrayBuffer()).subarray(44, 47).toString()).toBe("new");
    const cached = await handler(request());
    expect(Buffer.from(await cached.arrayBuffer()).subarray(44, 47).toString()).toBe("new");
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
  });

  it.each([
    [409, null, "preserved"],
    [400, { error: "Duplicate", message: "The resource already exists" }, "preserved"],
    [400, { code: "ResourceAlreadyExists" }, "preserved"],
    [400, { message: "Asset Already Exists" }, "preserved"],
    [400, { code: "InvalidRequest", message: "Invalid upload" }, "failed"],
    [403, { code: "AccessDenied" }, "failed"]
  ])("distinguishes an existing cache object from an upload failure (%i, %j)", async (status, failure, expected) => {
    enableStorage();
    fetch.mockImplementation(async (_, options = {}) => options.method === "POST"
      ? new Response(failure && JSON.stringify(failure), { status })
      : missingObject());
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("X-TTS-Cache-Upload")).toBe(expected);
    if (expected === "preserved") {
      // A failed conflict reread must not leave the losing audio in warm cache.
      await handler(request());
      expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
    }
  });

  it("does not label a failed explicit regeneration as a preserved success", async () => {
    enableStorage();
    fetch.mockResolvedValue(new Response(null, { status: 409 }));
    const response = await handler(request({ text: "apple", forceRegenerate: true }));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-TTS-Cache-Upload")).toBe("failed");
    expect(fetch.mock.calls[0][1].headers["x-upsert"]).toBe("true");
  });

  it("evicts the least recently used warm audio when the entry limit is exceeded", async () => {
    for (let index = 0; index < 65; index += 1) await handler(request({ text: `word ${index}` }));
    await handler(request({ text: "word 64" }));
    expect(synthesizeSpeech).toHaveBeenCalledTimes(65);
    await handler(request({ text: "word 0" }));
    expect(synthesizeSpeech).toHaveBeenCalledTimes(66);
  });

  it("also bounds warm audio by total bytes", async () => {
    synthesizeSpeech.mockImplementation(async () => wav("large", 4 * 1024 * 1024));
    for (let index = 0; index < 5; index += 1) await handler(request({ text: `large ${index}` }));
    await handler(request({ text: "large 4" }));
    expect(synthesizeSpeech).toHaveBeenCalledTimes(5);
    await handler(request({ text: "large 0" }));
    expect(synthesizeSpeech).toHaveBeenCalledTimes(6);
  });

  it("bounds cache downloads including a response body that never finishes", async () => {
    vi.useFakeTimers();
    enableStorage();
    let aborted = false;
    fetch.mockImplementation(async (_, options = {}) => {
      if (options.method === "POST") return new Response(null, { status: 200 });
      options.signal.addEventListener("abort", () => { aborted = true; });
      return new Response(new ReadableStream({ start() {} }), { headers: { "Content-Type": "audio/wav" } });
    });
    const responsePromise = handler(request());
    await vi.advanceTimersByTimeAsync(2001);
    const response = await responsePromise;
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("speech_cache_unavailable");
    expect(aborted).toBe(true);
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("does not turn corrupt cached audio into another paid generation", async () => {
    enableStorage();
    const corrupt = wav("bad");
    corrupt.writeUInt32LE(1000, 40);
    fetch.mockImplementation(async (_, options = {}) => options.method === "POST"
      ? new Response(null, { status: 200 }) : new Response(corrupt));
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("speech_cache_unavailable");
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(fetch.mock.calls.every(([, options]) => options.method !== "POST")).toBe(true);
    // An explicit regeneration is allowed to repair a corrupt object.
    const repaired = await handler(request({ text: "apple", forceRegenerate: true }));
    expect(repaired.status).toBe(200);
    expect(repaired.headers.get("X-TTS-Cache-Upload")).toBe("ok");
    expect(synthesizeSpeech).toHaveBeenCalledOnce();
    expect(fetch.mock.calls.at(-1)[1].headers["x-upsert"]).toBe("true");
  });

  it("does not store invalid provider audio after a confirmed cache miss", async () => {
    enableStorage();
    synthesizeSpeech.mockResolvedValue(Buffer.from("not wav"));
    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(fetch.mock.calls.every(([, options]) => options.method !== "POST")).toBe(true);
    synthesizeSpeech.mockResolvedValue(wav());
    expect((await handler(request())).status).toBe(200);
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
  });

  it("keeps generated audio playable and warm when only its cache upload fails", async () => {
    enableStorage();
    fetch.mockImplementation(async (_, options = {}) => {
      if (options.method === "POST") throw new Error("storage private detail");
      return missingObject();
    });
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("X-TTS-Cache-Upload")).toBe("failed");
    const warm = await handler(request());
    expect(warm.status).toBe(200);
    expect(warm.headers.get("X-TTS-Source")).toBe("memory-cache");
    expect(synthesizeSpeech).toHaveBeenCalledOnce();
    synthesizeSpeech.mockRejectedValueOnce(Object.assign(new Error("Bearer SECRET upstream private payload"), { status: 401, code: "SECRET" }));
    const failed = await handler(request({ text: "another word" }));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ code: "speech_unavailable", error: "Speech is temporarily unavailable. Please try again." });
  });

  it.each([
    [403, { code: "AccessDenied" }],
    [500, { code: "InternalError" }],
    [404, { code: "NoSuchBucket", message: "Bucket not found" }],
    [404, { code: "not_found" }],
    [404, null],
    [400, { code: "InvalidJWT", message: "Object not found" }],
    [400, { error: "StorageUnknownError", message: "Unknown storage failure" }]
  ])("does not synthesize when cache availability is unproven (%i, %j)", async (status, failure) => {
    enableStorage();
    fetch.mockImplementation(async () => new Response(failure && JSON.stringify(failure), { status }));
    for (const cacheOnly of [false, true]) {
      const response = await handler(request({ text: "apple", cacheOnly }));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ code: "speech_cache_unavailable", error: "Speech cache is temporarily unavailable. Please try again." });
    }
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(fetch.mock.calls.every(([, options]) => options.method !== "POST")).toBe(true);
  });

  it("does not synthesize on a cache network outage", async () => {
    enableStorage();
    fetch.mockRejectedValue(new Error("private cache details"));
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "speech_cache_unavailable", error: "Speech cache is temporarily unavailable. Please try again." });
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it.each([
    [404, { code: "NoSuchKey" }],
    [400, { statusCode: "404", error: "not_found", message: "Object not found" }],
    [400, { message: "Object not found" }]
  ])("permits synthesis only for an explicit missing object (%i, %j)", async (status, failure) => {
    enableStorage();
    fetch.mockImplementation(async (_, options = {}) => options.method === "POST"
      ? new Response(null, { status: 200 }) : new Response(JSON.stringify(failure), { status }));
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(synthesizeSpeech).toHaveBeenCalledOnce();
  });

  it("rejects oversized cache responses without starting paid generation", async () => {
    enableStorage();
    fetch.mockResolvedValue(new Response(wav(), { headers: { "Content-Length": String(5 * 1024 * 1024) } }));
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("speech_cache_unavailable");
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it.each([[429, 429, "speech_rate_limited"], [504, 504, "speech_timeout"]])("maps provider status %i to safe failure feedback", async (upstream, status, code) => {
    synthesizeSpeech.mockRejectedValueOnce(Object.assign(new Error("private details"), { status: upstream }));
    const response = await handler(request());
    expect(response.status).toBe(status);
    expect((await response.json()).code).toBe(code);
  });
});
