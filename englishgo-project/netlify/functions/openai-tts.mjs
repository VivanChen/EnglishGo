import { createHash } from "node:crypto";
import { synthesizeSpeech, OPENAI_SPEECH_MODEL, OPENAI_SPEECH_PROMPT_REVISION } from "../lib/openai-speech.mjs";

const MAX_BODY_BYTES = 4096;
const MAX_TEXT_LENGTH = 350;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_MEMORY_BYTES = 16 * 1024 * 1024;
const MAX_MEMORY_ITEMS = 64;
const MEMORY_TTL_MS = 60_000;
const ALLOWED_VOICES = new Set(["marin", "cedar", "coral"]);
const memoryCache = new Map();
const pending = new Map();
const uploads = new Map();
let memoryBytes = 0;

export const config = {
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 60 },
};

function getEnv(name) {
  try {
    const value = globalThis.Netlify?.env?.get?.(name);
    if (value) return value;
  } catch {}
  return process.env[name] || "";
}

function jsonResponse(status, code, error, extraHeaders = {}) {
  return new Response(JSON.stringify({ code, error }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-TTS-Provider": "openai",
      ...extraHeaders,
    },
  });
}

function audioResponse(result) {
  return new Response(result.audio, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-TTS-Provider": "openai",
      "X-TTS-Source": result.source,
      "X-TTS-Cache-Upload": result.upload || "skipped-hit",
    },
  });
}

async function readLimitedBody(body, maximum) {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        void reader.cancel().catch(() => {});
        throw Object.assign(new Error("Body too large"), { code: "body_too_large" });
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, size);
  } finally {
    reader.releaseLock();
  }
}

function validWav(audio) {
  // This namespace contains the helper's PCM16 mono 24 kHz WAV files. Check the
  // whole container length and format, not merely a RIFF prefix on corrupt bytes.
  return Buffer.isBuffer(audio) && audio.length > 44 && audio.length <= MAX_AUDIO_BYTES
    && audio.toString("ascii", 0, 4) === "RIFF" && audio.readUInt32LE(4) === audio.length - 8
    && audio.toString("ascii", 8, 16) === "WAVEfmt " && audio.readUInt32LE(16) === 16
    && audio.readUInt16LE(20) === 1 && audio.readUInt16LE(22) === 1
    && audio.readUInt32LE(24) === 24_000 && audio.readUInt32LE(28) === 48_000
    && audio.readUInt16LE(32) === 2 && audio.readUInt16LE(34) === 16
    && audio.toString("ascii", 36, 40) === "data" && audio.readUInt32LE(40) === audio.length - 44
    && (audio.length - 44) % 2 === 0;
}

function removeMemory(key) {
  const previous = memoryCache.get(key);
  if (previous) memoryBytes -= previous.audio.length;
  memoryCache.delete(key);
}

function saveMemory(key, audio) {
  removeMemory(key);
  memoryCache.set(key, { audio, expiresAt: Date.now() + MEMORY_TTL_MS });
  memoryBytes += audio.length;
  while (memoryCache.size > MAX_MEMORY_ITEMS || memoryBytes > MAX_MEMORY_BYTES) {
    removeMemory(memoryCache.keys().next().value);
  }
}

function readMemory(key) {
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt <= Date.now()) {
    removeMemory(key);
    return null;
  }
  if (entry) {
    memoryCache.delete(key);
    memoryCache.set(key, entry);
  }
  return entry?.audio;
}

function storageConfig(cacheKey) {
  const baseUrl = (getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL")).replace(/\/$/, "");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceKey) return null;
  const bucket = getEnv("SUPABASE_TTS_BUCKET") || "tts-cache";
  return {
    url: `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${cacheKey}`,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  };
}

async function storageOperation(operation) {
  const controller = new AbortController();
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Storage timeout"));
      }, 2000);
    });
    return await Promise.race([operation(controller.signal), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readStorage(key) {
  const storage = storageConfig(key);
  if (!storage) return { status: "disabled" };
  const result = await storageOperation(async signal => {
    const response = await fetch(storage.url, {
      headers: { ...storage.headers, "Cache-Control": "no-cache" }, signal,
    });
    if (!response.ok) {
      // A generic 404/not_found can mean an absent bucket or denied access.
      // Only an explicit missing object permits new paid synthesis.
      if (response.status === 400 || response.status === 404) {
        try {
          const failure = JSON.parse((await readLimitedBody(response.body, 4096)).toString("utf8"));
          const code = failure.code || failure.error;
          if (code === "NoSuchKey" || ((!code || code === "not_found" || code === "StorageUnknownError")
            && /^Object not found\.?$/i.test(failure.message || ""))) return { status: "missing" };
        } catch {}
      }
      return { status: "unavailable" };
    }
    if (Number(response.headers.get("content-length")) > MAX_AUDIO_BYTES) {
      void response.body?.cancel().catch(() => {});
      return { status: "corrupt" };
    }
    try {
      const audio = await readLimitedBody(response.body, MAX_AUDIO_BYTES);
      return validWav(audio) ? { status: "hit", audio } : { status: "corrupt" };
    } catch (error) {
      return { status: error?.code === "body_too_large" ? "corrupt" : "unavailable" };
    }
  });
  return result || { status: "unavailable" };
}

function requireReadableCache(result) {
  if (result.status === "unavailable" || result.status === "corrupt") {
    throw Object.assign(new Error("Speech cache is unavailable"), { code: "speech_cache_unavailable" });
  }
}

async function uploadStorage(key, audio, state, forceRegenerate) {
  const storage = storageConfig(key);
  if (!storage) return "disabled";
  // Serialize writes within this instance. Ordinary synthesis is create-only,
  // so a slower instance cannot overwrite an already saved regeneration.
  // Explicit regenerations on separate instances still use last-completed-write
  // semantics; global last-request ordering would require shared version/CAS state.
  const previous = uploads.get(key) || Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    if (pending.get(key) !== state) return "superseded";
    const saved = await storageOperation(async signal => {
      const response = await fetch(storage.url, {
        method: "POST",
        headers: { ...storage.headers, "Content-Type": "audio/wav", "Cache-Control": "0", "x-upsert": forceRegenerate ? "true" : "false" },
        body: audio,
        signal,
      });
      if (response.ok) return "ok";
      if (!forceRegenerate && response.status === 409) return "preserved";
      // Standard uploads can also return the legacy 400 duplicate-object error.
      // Do not mistake malformed uploads or permission failures for cache hits.
      if (!forceRegenerate && response.status === 400) {
        try {
          const failure = JSON.parse((await readLimitedBody(response.body, 4096)).toString("utf8"));
          if (["ResourceAlreadyExists", "KeyAlreadyExists", "already_exists", "Duplicate"].includes(failure.code || failure.error)
            || /^(?:Asset Already Exists|The resource already exists)\.?$/i.test(failure.message || "")) return "preserved";
        } catch {}
      }
      return "failed";
    });
    return saved || "failed";
  });
  uploads.set(key, write);
  try {
    return await write;
  } finally {
    if (uploads.get(key) === write) uploads.delete(key);
  }
}

function cacheKeyFor(input) {
  const hash = createHash("sha256").update(JSON.stringify({
    text: input.text, lang: input.lang, speed: input.speed,
  })).digest("hex");
  return `openai/${encodeURIComponent(OPENAI_SPEECH_PROMPT_REVISION)}/${encodeURIComponent(OPENAI_SPEECH_MODEL)}/${input.voice}/${hash}.wav`;
}

async function cachedSpeechResult(input) {
  const key = cacheKeyFor(input);
  const audio = readMemory(key);
  if (audio) return { audio, source: "memory-cache" };
  // Never join paid work or populate memory: a slow read must not replace audio
  // from a regeneration that completes while this speculative lookup is pending.
  const cached = await readStorage(key);
  requireReadableCache(cached);
  return cached.status === "hit" ? { audio: cached.audio, source: "supabase-cache" } : null;
}

function speechResult(input) {
  const key = cacheKeyFor(input);
  if (!input.forceRegenerate) {
    const audio = readMemory(key);
    if (audio) return Promise.resolve({ audio, source: "memory-cache" });
    if (pending.has(key)) return pending.get(key).promise;
  } else {
    removeMemory(key);
  }

  const state = {};
  pending.set(key, state);
  state.promise = (async () => {
    if (!input.forceRegenerate) {
      const cached = await readStorage(key);
      requireReadableCache(cached);
      if (cached.status === "hit") {
        if (pending.get(key) === state) saveMemory(key, cached.audio);
        return { audio: cached.audio, source: "supabase-cache" };
      }
    }
    const apiKey = getEnv("OPENAI_API_KEY");
    if (!apiKey) throw Object.assign(new Error("Speech is not configured"), { code: "speech_not_configured" });
    // The helper bounds shared synthesis to 25 seconds. A single client's
    // cancellation must not abort work awaited by other coalesced requests.
    const audio = await synthesizeSpeech({ apiKey, text: input.text, lang: input.lang, voice: input.voice, speed: input.speed });
    if (!validWav(audio)) throw new Error("Invalid speech audio");
    if (pending.get(key) !== state) return { audio, source: "openai", upload: "superseded" };
    saveMemory(key, audio);
    const upload = await uploadStorage(key, audio, state, input.forceRegenerate);
    if (upload === "preserved") {
      // Adopt the winning instance's audio instead of retaining our older local
      // result. A failed reread leaves no stale warm entry and can retry later.
      if (pending.get(key) === state) removeMemory(key);
      const cached = await readStorage(key);
      if (cached.status === "hit") {
        if (pending.get(key) === state) saveMemory(key, cached.audio);
        return { audio: cached.audio, source: "supabase-cache", upload };
      }
    }
    return { audio, source: "openai", upload };
  })().finally(() => {
    if (pending.get(key) === state) pending.delete(key);
  });
  return state.promise;
}

export default async function handler(request) {
  if (request.method !== "POST") return jsonResponse(405, "method_not_allowed", "Only POST is supported.", { Allow: "POST" });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return jsonResponse(403, "origin_not_allowed", "This origin is not allowed.");
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return jsonResponse(413, "body_too_large", "The request is too large.");

  let payload;
  try {
    payload = JSON.parse((await readLimitedBody(request.body, MAX_BODY_BYTES)).toString("utf8"));
  } catch (error) {
    return error?.code === "body_too_large"
      ? jsonResponse(413, "body_too_large", "The request is too large.")
      : jsonResponse(400, "invalid_json", "A valid JSON object is required.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return jsonResponse(400, "invalid_json", "A valid JSON object is required.");
  if (typeof payload.text !== "string") return jsonResponse(400, "invalid_text", "Text must be a string.");
  let text = payload.text.normalize("NFKC").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim();
  if (text === "i") text = "I";
  if (!text || text.length > MAX_TEXT_LENGTH) return jsonResponse(400, "invalid_text", "Text must contain 1 to 350 characters.");
  const rawLang = payload.lang ?? "en-US";
  if (typeof rawLang !== "string" || !/^(en|zh)(?:-[a-z0-9]{2,8})*$/i.test(rawLang)) return jsonResponse(400, "invalid_language", "English or Chinese is supported.");
  const voice = payload.voiceId ?? "marin";
  if (!ALLOWED_VOICES.has(voice)) return jsonResponse(400, "invalid_voice", "Select a supported voice.");
  const rawSpeed = payload.speed ?? 1;
  if (typeof rawSpeed !== "number" || !Number.isFinite(rawSpeed)) return jsonResponse(400, "invalid_speed", "Speed must be a number.");
  if (payload.forceRegenerate != null && typeof payload.forceRegenerate !== "boolean") return jsonResponse(400, "invalid_regeneration", "Regeneration must be a boolean.");
  if (payload.cacheOnly != null && typeof payload.cacheOnly !== "boolean") return jsonResponse(400, "invalid_cache_only", "Cache-only must be a boolean.");
  if (payload.cacheOnly === true && payload.forceRegenerate === true) return jsonResponse(400, "invalid_cache_request", "Cache-only cannot regenerate audio.");
  const input = {
    text, voice, lang: /^zh/i.test(rawLang) ? "zh-TW" : "en-US",
    speed: Math.max(0.7, Math.min(1.2, rawSpeed)), forceRegenerate: payload.forceRegenerate === true,
  };

  try {
    if (payload.cacheOnly === true) {
      const cached = await cachedSpeechResult(input);
      return cached ? audioResponse(cached) : new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store", "X-TTS-Provider": "openai", "X-TTS-Cache-Read": "miss" },
      });
    }
    return audioResponse(await speechResult(input));
  } catch (error) {
    if (error?.code === "speech_cache_unavailable") return jsonResponse(503, "speech_cache_unavailable", "Speech cache is temporarily unavailable. Please try again.");
    if (error?.code === "speech_not_configured") return jsonResponse(503, "speech_not_configured", "OpenAI speech is not configured yet.");
    if (error?.status === 429) return jsonResponse(429, "speech_rate_limited", "Speech is busy. Please try again shortly.");
    if (error?.status === 408 || error?.status === 504) return jsonResponse(504, "speech_timeout", "Speech took too long. Please try again.");
    return jsonResponse(502, "speech_unavailable", "Speech is temporarily unavailable. Please try again.");
  }
}
