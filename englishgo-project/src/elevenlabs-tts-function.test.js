import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../netlify/functions/elevenlabs-tts.js";
import { NOVEL_AUDIO_CATALOG, NOVEL_AUDIO_CONFIG } from "../netlify/functions/novel-audio-catalog.js";

const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_ZH_VOICE_ID",
  "ELEVENLABS_MODEL_ID",
  "ELEVENLABS_ZH_MODEL_ID",
  "ELEVENLABS_OUTPUT_FORMAT",
  "ELEVENLABS_SPEED",
  "ELEVENLABS_STABILITY",
  "ELEVENLABS_SIMILARITY_BOOST",
  "ELEVENLABS_STYLE",
  "ELEVENLABS_USE_SPEAKER_BOOST",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_TTS_BUCKET",
  "TTS_DEBUG_HEADERS",
  "TTS_AWAIT_CACHE_UPLOAD",
];

function request(payload) {
  return new Request("http://localhost/.netlify/functions/elevenlabs-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function novelRequest(assetId) {
  return new Request(`http://localhost/.netlify/functions/elevenlabs-tts?novel=${encodeURIComponent(assetId)}`, {
    method: "GET",
  });
}

function enableStorage() {
  vi.stubEnv("SUPABASE_URL", "https://storage.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-storage-key");
}

function audioResponse(text = "saved-mp3", type = "audio/mp3") {
  return new Response(Buffer.from(text), { headers: { "Content-Type": type } });
}

describe("elevenlabs-tts function voice selection", () => {
  beforeEach(() => {
    vi.stubGlobal("Netlify", undefined);
    for (const key of ENV_KEYS) vi.stubEnv(key, "");
    vi.stubEnv("ELEVENLABS_API_KEY", "test-api-key");
    // Node's Response does not recognize jsdom's Blob and would label it text/plain.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(audioResponse("mp3", "audio/mpeg"))));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires the dedicated Chinese voice env var for Chinese requests", async () => {
    process.env.ELEVENLABS_VOICE_ID = "english-voice";
    delete process.env.ELEVENLABS_ZH_VOICE_ID;

    const res = await handler(request({ text: "這是小說中文朗讀。", lang: "zh-TW", voiceId: "payload-voice" }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/ELEVENLABS_ZH_VOICE_ID/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("uses ELEVENLABS_ZH_VOICE_ID for Chinese requests", async () => {
    process.env.ELEVENLABS_VOICE_ID = "english-voice";
    process.env.ELEVENLABS_ZH_VOICE_ID = "mandarin-voice";
    process.env.ELEVENLABS_MODEL_ID = "eleven_flash_v2_5";
    process.env.ELEVENLABS_ZH_MODEL_ID = "eleven_multilingual_v2";

    const res = await handler(request({ text: "這是小說中文朗讀。", lang: "zh-TW", voiceId: "payload-voice" }));

    expect(res.status).toBe(200);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(String(url)).toBe("https://api.elevenlabs.io/v1/text-to-speech/mandarin-voice?output_format=mp3_44100_128");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).model_id).toBe("eleven_multilingual_v2");
  });

  it("keeps the configured default model for English requests", async () => {
    process.env.ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
    process.env.ELEVENLABS_ZH_VOICE_ID = "mandarin-voice";
    process.env.ELEVENLABS_MODEL_ID = "eleven_flash_v2_5";
    process.env.ELEVENLABS_ZH_MODEL_ID = "eleven_multilingual_v2";

    const res = await handler(request({ text: "This is an English narration.", lang: "en-US" }));

    expect(res.status).toBe(200);
    const [, init] = globalThis.fetch.mock.calls[0];
    expect(JSON.parse(init.body).model_id).toBe("eleven_flash_v2_5");
  });

  it("uses the approved voice selected by the learner instead of the old configured custom voice", async () => {
    process.env.ELEVENLABS_VOICE_ID = "1AKkSX7KMPHIWuz76m0n";

    const res = await handler(request({
      text: "I packed three apples for our train ride this morning.",
      lang: "en-US",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    }));

    expect(res.status).toBe(200);
    const [url] = globalThis.fetch.mock.calls[0];
    expect(String(url)).toContain("/text-to-speech/21m00Tcm4TlvDq8ikWAM?");
  });

  it("defaults English learning audio to the higher-quality multilingual model", async () => {
    delete process.env.ELEVENLABS_VOICE_ID;
    delete process.env.ELEVENLABS_MODEL_ID;

    const res = await handler(request({ text: "The bus arrives at seven thirty.", lang: "en-US" }));

    expect(res.status).toBe(200);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(String(url)).toContain("/text-to-speech/21m00Tcm4TlvDq8ikWAM?");
    const body = JSON.parse(init.body);
    expect(body.model_id).toBe("eleven_multilingual_v2");
    expect(body.voice_settings.speed).toBe(1);
  });

  it("preserves capitalization and punctuation sent to ElevenLabs", async () => {
    const res = await handler(request({ text: "Do I take the US bus?", lang: "en-US" }));

    expect(res.status).toBe(200);
    const [, init] = globalThis.fetch.mock.calls[0];
    expect(JSON.parse(init.body).text).toBe("Do I take the US bus?");
  });

  it("serves fixed English novel narration from a versioned immutable GET URL", async () => {
    process.env.ELEVENLABS_VOICE_ID = "ErXwobaYiN019PkySvjV";
    const [assetId, asset] = Object.entries(NOVEL_AUDIO_CATALOG).find(([, entry]) => entry.lang === "en-US");

    const res = await handler(novelRequest(assetId));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("max-age=31536000");
    expect(res.headers.get("netlify-cdn-cache-control")).toContain("durable");
    expect(res.headers.get("netlify-vary")).toBe("query=novel");
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(String(url)).toContain("/text-to-speech/21m00Tcm4TlvDq8ikWAM?");
    expect(JSON.parse(init.body)).toMatchObject({
      text: asset.text,
      voice_settings: expect.objectContaining({ speed: 0.9 }),
    });
  });

  it("always serves fixed Chinese novel narration with the selected Mandarin voice", async () => {
    process.env.ELEVENLABS_ZH_VOICE_ID = "old-mandarin-voice";
    const [assetId, asset] = Object.entries(NOVEL_AUDIO_CATALOG).find(([, entry]) => entry.lang === "zh-TW");

    const res = await handler(novelRequest(assetId));

    expect(res.status).toBe(200);
    expect(assetId).toMatch(/^v2-.*-zh-/);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(String(url)).toContain(`/text-to-speech/${NOVEL_AUDIO_CONFIG.chineseVoiceId}?`);
    expect(String(url)).not.toContain("old-mandarin-voice");
    expect(JSON.parse(init.body)).toMatchObject({
      text: asset.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: expect.objectContaining({ speed: 1 }),
    });
  });

  it("rejects GET requests for content outside the generated novel catalog", async () => {
    const res = await handler(novelRequest("v1-not-in-the-catalog"));

    expect(res.status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["apple", "d6917b4f131d7d6b7698396bd2c6be48a1fc2790e0935d7bef73230411865567"],
    [" i ", "a6d177ebbb6878d85e36c36fd609efb51cabeb69a201b10bad0bfbcfd77f0e3d"],
  ])("reuses the exact legacy cache path for %j without a provider key", async (text, hash) => {
    enableStorage();
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    fetch.mockResolvedValueOnce(audioResponse());

    const response = await handler(request({ text }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("saved-mp3");
    expect(response.headers.get("X-TTS-Source")).toBe("supabase-cache");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(`https://storage.example/storage/v1/object/tts-cache/21m00Tcm4TlvDq8ikWAM/${hash}.mp3`);
    expect(fetch.mock.calls[0][1].method).toBe("GET");
  });

  it.each([
    ["v1-secret-forest-adventure-c1-en-title-e4c4bb0211ca3532", "21m00Tcm4TlvDq8ikWAM/93aad7e0458feb89145258d2fe7a4005ceed071ff0cf114e5fceb32bd9b2a591.mp3"],
    ["v2-secret-forest-adventure-c1-zh-title-c06b205aca295089", "fQj4gJSexpu8RDE2Ii5m/40f8ecad03d2c942b3903cd293cc36f61390ab8a385199a5d76adb63442d8a7f.mp3"],
  ])("serves existing novel asset %s with its legacy storage key and immutable URL", async (assetId, cacheKey) => {
    enableStorage();
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    fetch.mockResolvedValueOnce(audioResponse());

    const response = await handler(novelRequest(assetId));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-TTS-Source")).toBe("supabase-cache");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("Netlify-CDN-Cache-Control")).toBe("public, durable, max-age=31536000, immutable");
    expect(response.headers.get("Netlify-Vary")).toBe("query=novel");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(`https://storage.example/storage/v1/object/tts-cache/${cacheKey}`);
  });

  it.each(["audio/mp3", "audio/mpeg", "application/octet-stream"])("returns an existing %s object for a cache-only lookup", async type => {
    enableStorage();
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    fetch.mockResolvedValueOnce(audioResponse("saved-mp3", type));

    const response = await handler(request({ text: "apple", cacheOnly: true }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("saved-mp3");
    expect(response.headers.get("X-TTS-Cache-Read")).toBe("hit");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    [404, { code: "NoSuchKey" }],
    [400, { statusCode: "404", error: "not_found", message: "Object not found" }],
    [400, { code: "NoSuchKey" }],
    [404, { error: "StorageUnknownError", message: "Object not found" }],
  ])("returns an empty cache-only miss for a missing object (%i) without synthesis", async (status, body) => {
    enableStorage();
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    fetch.mockResolvedValueOnce(new Response(body && JSON.stringify(body), { status }));

    const response = await handler(request({ text: "apple", cacheOnly: true }));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-TTS-Cache-Read")).toBe("miss");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not generate a cache-only request when storage and the provider are unconfigured", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    expect((await handler(request({ text: "apple", cacheOnly: true }))).status).toBe(204);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["true", 1, null, {}, []])("rejects a non-boolean cacheOnly value %j", async cacheOnly => {
    const response = await handler(request({ text: "apple", cacheOnly }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects combining a cache-only lookup with explicit regeneration", async () => {
    const response = await handler(request({ text: "apple", cacheOnly: true, forceRegenerate: true }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [403, { code: "AccessDenied" }],
    [500, null],
    [404, null],
    [404, { code: "AccessDenied", message: "Object not found" }],
    [500, { code: "NoSuchKey" }],
    [404, { code: "NoSuchBucket", message: "Bucket not found" }],
    [400, { code: "InvalidRequest" }],
  ])("does not turn a storage failure (%i) into paid synthesis or a cache-only miss", async (status, body) => {
    enableStorage();
    fetch.mockImplementation(async () => new Response(body && JSON.stringify(body), { status }));

    for (const cacheOnly of [false, true]) {
      const response = await handler(request({ text: "apple", cacheOnly }));
      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.text()).not.toMatch(/AccessDenied|NoSuchBucket|InvalidRequest/);
    }
    expect(fetch.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  });

  it.each(["text/html", "application/json"])("rejects a successful storage response containing %s", async type => {
    enableStorage();
    fetch.mockResolvedValueOnce(audioResponse("not audio", type));
    expect((await handler(request({ text: "apple" }))).status).toBe(503);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("bounds a stalled storage body to two seconds without generating new audio", async () => {
    vi.useFakeTimers();
    enableStorage();
    fetch.mockResolvedValueOnce(new Response(new ReadableStream({ start() {} }), { headers: { "Content-Type": "audio/mp3" } }));
    const pending = handler(request({ text: "apple" }));
    await vi.advanceTimersByTimeAsync(2001);
    expect((await pending).status).toBe(503);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it.each([
    [200, null, "ok"],
    [409, null, "preserved"],
    [400, { error: "Duplicate", message: "The resource already exists" }, "preserved"],
    [400, { code: "ResourceAlreadyExists" }, "preserved"],
    [400, { code: "InvalidRequest" }, "failed"],
    [403, { code: "AccessDenied" }, "failed"],
  ])("creates ordinary audio without overwriting an existing object (%i, %j)", async (status, body, expected) => {
    enableStorage();
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: "NoSuchKey" }), { status: 404 }))
      .mockResolvedValueOnce(audioResponse("generated"))
      .mockResolvedValueOnce(new Response(body && JSON.stringify(body), { status }));

    const response = await handler(request({ text: "apple" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-TTS-Cache-Upload")).toBe(expected);
    expect(fetch.mock.calls[2][1].headers["x-upsert"]).toBe("false");
    expect(fetch.mock.calls[2][0]).toBe(fetch.mock.calls[0][0]);
  });

  it("bypasses cache reads only for explicit regeneration and replaces the same legacy object", async () => {
    enableStorage();
    fetch.mockResolvedValueOnce(audioResponse("fresh-mp3"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await handler(request({ text: "apple", forceRegenerate: true }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-TTS-Cache-Upload")).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[0][0])).toContain("api.elevenlabs.io/v1/text-to-speech/");
    expect(fetch.mock.calls[1][1].headers["x-upsert"]).toBe("true");
    expect(fetch.mock.calls[1][0]).toBe("https://storage.example/storage/v1/object/tts-cache/21m00Tcm4TlvDq8ikWAM/d6917b4f131d7d6b7698396bd2c6be48a1fc2790e0935d7bef73230411865567.mp3");
  });

  it("bounds the provider response body to twenty-five seconds", async () => {
    vi.useFakeTimers();
    fetch.mockResolvedValueOnce(new Response(new ReadableStream({ start() {} }), { headers: { "Content-Type": "audio/mpeg" } }));
    const pending = handler(request({ text: "apple" }));
    await vi.advanceTimersByTimeAsync(25001);
    expect((await pending).status).toBe(504);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("returns safe provider errors without echoing the upstream response", async () => {
    fetch.mockResolvedValueOnce(new Response("Bearer SECRET upstream detail", { status: 401 }));
    const response = await handler(request({ text: "apple" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Speech is temporarily unavailable. Please try again." });
  });

  it("rejects an empty successful provider response without uploading it", async () => {
    enableStorage();
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: "NoSuchKey" }), { status: 404 }))
      .mockResolvedValueOnce(audioResponse("", "audio/mpeg"));

    const response = await handler(request({ text: "apple" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "ElevenLabs returned empty audio" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.filter(([url, options]) => String(url).includes("storage.example") && options.method === "POST")).toHaveLength(0);
  });
});
