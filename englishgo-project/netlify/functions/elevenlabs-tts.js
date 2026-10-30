import crypto from "node:crypto";
import { NOVEL_AUDIO_CATALOG, NOVEL_AUDIO_CONFIG } from "./novel-audio-catalog.js";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const ALLOWED_ENGLISH_VOICE_IDS = new Set([
  "21m00Tcm4TlvDq8ikWAM",
  "EXAVITQu4vr4xnSDxMaL",
  "ErXwobaYiN019PkySvjV",
]);
const DEFAULT_BUCKET = "tts-cache";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_ZH_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const MAX_TEXT_LENGTH = 900;
const NOVEL_ENGLISH_SPEED = NOVEL_AUDIO_CONFIG.englishRate;
const NOVEL_CHINESE_SPEED = NOVEL_AUDIO_CONFIG.chineseRate;
const ONE_YEAR_SECONDS = 31536000;
const STORAGE_TIMEOUT_MS = 2000;
const PROVIDER_TIMEOUT_MS = 25000;

function getEnv(name) {
  try {
    const value = globalThis.Netlify?.env?.get?.(name);
    if (value) return value;
  } catch {}
  return process.env[name] || "";
}

function getFirstEnv(...names) {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return "";
}

function getSupabaseUrl() {
  return getFirstEnv("SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/$/, "");
}

function getSupabaseKey() {
  return getFirstEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function safeHeaderValue(value) {
  return String(value ?? "").replace(/[\r\n]/g, " ").slice(0, 240);
}

function audioResponse(audioBuffer, source = "elevenlabs", extraHeaders = {}, fixedAsset = false) {
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": fixedAsset
        ? `public, max-age=${ONE_YEAR_SECONDS}, immutable`
        : "public, max-age=86400",
      ...(fixedAsset
        ? {
            "Netlify-CDN-Cache-Control": `public, durable, max-age=${ONE_YEAR_SECONDS}, immutable`,
            "Netlify-Vary": "query=novel",
          }
        : {}),
      "X-TTS-Source": source,
      ...extraHeaders,
    },
  });
}

function jsonResponse(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function withTimeout(operation, milliseconds) {
  const controller = new AbortController();
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(Object.assign(new Error("Speech request timed out"), { code: "tts_timeout" }));
        controller.abort();
      }, milliseconds);
    });
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function isAudioResponse(response) {
  const type = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  return ["audio/mpeg", "audio/mp3", "audio/x-mp3", "application/octet-stream"].includes(type);
}

async function storageError(response) {
  try { return await response.json(); } catch { return {}; }
}

function isMissingObject(status, error) {
  if (status !== 400 && status !== 404) return false;
  const code = error?.code || error?.error || "";
  const message = error?.message || "";
  return code === "NoSuchKey" || (
    ["", "not_found", "StorageUnknownError"].includes(code)
    && /^Object not found\.?$/i.test(message)
  );
}

function isDuplicateObject(status, error) {
  return status === 409 || (status === 400 && (
    ["ResourceAlreadyExists", "KeyAlreadyExists", "already_exists", "Duplicate"].includes(error?.code || error?.error)
    || /^(?:Asset Already Exists|The resource already exists)\.?$/i.test(error?.message || "")
  ));
}

function normalizeTextForTts(rawText) {
  const normalized = String(rawText || "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^['"“”‘’]+|['"“”‘’]+$/g, "");
  return normalized === "i" ? "I" : normalized;
}

function clampNumber(value, min, max, fallback) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function getBooleanEnv(name, fallback) {
  const value = getEnv(name);
  if (!value) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

function isChineseLang(lang) {
  return /^zh/i.test(String(lang || ""));
}

function getEnglishVoiceId(requestedVoiceId) {
  const requested = String(requestedVoiceId || "").trim();
  if (ALLOWED_ENGLISH_VOICE_IDS.has(requested)) return requested;

  const configured = getEnv("ELEVENLABS_VOICE_ID").trim();
  if (ALLOWED_ENGLISH_VOICE_IDS.has(configured)) return configured;

  return DEFAULT_VOICE_ID;
}

function makeCacheKey({ normalizedText, lang, voiceId, modelId, outputFormat, voiceSettings }) {
  const pronunciationRevision = /^[A-Za-z]{1,3}$/.test(normalizedText) ? "short-words-v2" : "";
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({
      text: normalizedText,
      ...(pronunciationRevision ? { pronunciationRevision } : {}),
      lang,
      voiceId,
      modelId,
      outputFormat,
      voiceSettings,
      format: "mp3",
    }))
    .digest("hex");

  return `${voiceId}/${hash}.mp3`;
}

async function convertTextToSpeech({ apiKey, voiceId, normalizedText, modelId, outputFormat, voiceSettings }) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  if (outputFormat) url.searchParams.set("output_format", outputFormat);

  return withTimeout(async signal => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: normalizedText,
        model_id: modelId,
        voice_settings: voiceSettings,
      }),
      signal,
    });
    if (!res.ok || !isAudioResponse(res)) throw new Error("Speech provider is unavailable");
    return Buffer.from(await res.arrayBuffer());
  }, PROVIDER_TIMEOUT_MS);
}

function supabaseHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

async function tryReadFromSupabaseStorage({ bucket, cacheKey }) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, audioBuffer: null, reason: "missing_supabase_env", state: "disabled" };
  }

  try {
    return await withTimeout(async signal => {
      const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${cacheKey}`;
      const res = await fetch(url, {
        method: "GET",
        headers: supabaseHeaders(supabaseKey, { "Cache-Control": "no-cache" }),
        signal,
      });

      if (!res.ok) {
        const missing = isMissingObject(res.status, await storageError(res));
        return { ok: false, audioBuffer: null, reason: `read_${res.status}`, state: missing ? "miss" : "unavailable" };
      }
      if (!isAudioResponse(res)) return { ok: false, audioBuffer: null, reason: "invalid_cache_type", state: "unavailable" };
      const audioBuffer = Buffer.from(await res.arrayBuffer());
      return audioBuffer.length
        ? { ok: true, audioBuffer, reason: "hit", state: "hit" }
        : { ok: false, audioBuffer: null, reason: "empty_cache_file", state: "unavailable" };
    }, STORAGE_TIMEOUT_MS);
  } catch (err) {
    return { ok: false, audioBuffer: null, reason: err?.code === "tts_timeout" ? "read_timeout" : "read_error", state: "unavailable" };
  }
}

async function tryUploadToSupabaseStorage({ bucket, cacheKey, audioBuffer, fixedAsset = false, forceRegenerate = false }) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey || !audioBuffer?.length) {
    return { ok: false, reason: "missing_supabase_env_or_audio" };
  }

  try {
    return await withTimeout(async signal => {
      const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${cacheKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: supabaseHeaders(supabaseKey, {
          "Content-Type": "audio/mp3",
          "Cache-Control": fixedAsset ? String(ONE_YEAR_SECONDS) : forceRegenerate ? "0" : "86400",
          "x-upsert": forceRegenerate ? "true" : "false",
        }),
        body: audioBuffer,
        signal,
      });
      if (res.ok) return { ok: true, reason: "uploaded" };
      if (!forceRegenerate && isDuplicateObject(res.status, await storageError(res))) return { ok: true, reason: "preserved" };
      return { ok: false, reason: `upload_${res.status}` };
    }, STORAGE_TIMEOUT_MS);
  } catch (err) {
    return { ok: false, reason: err?.code === "tts_timeout" ? "upload_timeout" : "upload_error" };
  }
}

export default async function handler(req, context = {}) {
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const isFixedNovelAsset = req.method === "GET";
  let novelAssetId = "";
  let payload;

  if (isFixedNovelAsset) {
    try {
      novelAssetId = new URL(req.url).searchParams.get("novel") || "";
    } catch {
      return jsonResponse(400, { error: "Invalid novel audio URL" });
    }
    payload = NOVEL_AUDIO_CATALOG[novelAssetId];
    if (!payload) return jsonResponse(404, { error: "Unknown novel audio asset" });
  }

  if (!isFixedNovelAsset) {
    try {
      const body = await req.text();
      payload = JSON.parse(body || "{}");
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return jsonResponse(400, { error: "Invalid JSON body" });
    if (Object.hasOwn(payload, "cacheOnly") && typeof payload.cacheOnly !== "boolean") return jsonResponse(400, { error: "cacheOnly must be a boolean" });
    if (payload.cacheOnly === true && payload.forceRegenerate === true) return jsonResponse(400, { error: "cacheOnly cannot be combined with forceRegenerate" });
  }

  const originalText = String(payload.text || "").trim();
  const normalizedText = normalizeTextForTts(originalText);
  const forceRegenerate = !isFixedNovelAsset && payload.forceRegenerate === true;
  const cacheOnly = !isFixedNovelAsset && payload.cacheOnly === true;
  const lang = String(payload.lang || "en-US").trim();
  const voiceId = isChineseLang(lang)
    ? (isFixedNovelAsset ? NOVEL_AUDIO_CONFIG.chineseVoiceId : getEnv("ELEVENLABS_ZH_VOICE_ID"))
    : isFixedNovelAsset
      ? DEFAULT_VOICE_ID
      : getEnglishVoiceId(payload.voiceId);
  const modelId = isChineseLang(lang)
    ? getEnv("ELEVENLABS_ZH_MODEL_ID") || DEFAULT_ZH_MODEL_ID
    : getEnv("ELEVENLABS_MODEL_ID") || DEFAULT_MODEL_ID;
  const outputFormat = getEnv("ELEVENLABS_OUTPUT_FORMAT") || DEFAULT_OUTPUT_FORMAT;
  const playbackSpeed = isFixedNovelAsset
    ? (isChineseLang(lang) ? NOVEL_CHINESE_SPEED : NOVEL_ENGLISH_SPEED)
    : clampNumber(payload.speed ?? getEnv("ELEVENLABS_SPEED"), 0.7, 1.2, 1);
  const bucket = getEnv("SUPABASE_TTS_BUCKET") || DEFAULT_BUCKET;
  const hasSupabaseUrl = Boolean(getSupabaseUrl());
  const hasSupabaseKey = Boolean(getSupabaseKey());
  const voiceSettings = {
    stability: clampNumber(getEnv("ELEVENLABS_STABILITY"), 0, 1, 0.65),
    similarity_boost: clampNumber(getEnv("ELEVENLABS_SIMILARITY_BOOST"), 0, 1, 0.75),
    style: clampNumber(getEnv("ELEVENLABS_STYLE"), 0, 1, 0),
    use_speaker_boost: getBooleanEnv("ELEVENLABS_USE_SPEAKER_BOOST", false),
    speed: playbackSpeed,
  };

  if (!normalizedText) {
    return jsonResponse(400, { error: "Missing text" });
  }

  if (isChineseLang(lang) && !voiceId) {
    return jsonResponse(500, { error: "Missing ELEVENLABS_ZH_VOICE_ID for Chinese TTS" });
  }

  if (normalizedText.length > MAX_TEXT_LENGTH) {
    return jsonResponse(400, { error: `Text is too long. Max length is ${MAX_TEXT_LENGTH} characters.` });
  }

  const cacheKey = makeCacheKey({ normalizedText, lang, voiceId, modelId, outputFormat, voiceSettings });
  const debugHeaders = getBooleanEnv("TTS_DEBUG_HEADERS", false)
    ? {
        "X-TTS-Bucket": safeHeaderValue(bucket),
        "X-TTS-Cache-Key": safeHeaderValue(cacheKey),
        "X-TTS-Normalized-Text": safeHeaderValue(normalizedText),
        "X-TTS-Voice-Id": safeHeaderValue(voiceId),
        "X-TTS-Lang": safeHeaderValue(lang),
        "X-TTS-Model-Id": safeHeaderValue(modelId),
        "X-TTS-Output-Format": safeHeaderValue(outputFormat),
        "X-TTS-Speaker-Boost": String(voiceSettings.use_speaker_boost),
        "X-TTS-Playback-Speed": safeHeaderValue(playbackSpeed),
        "X-TTS-Has-Supabase-Url": String(hasSupabaseUrl),
        "X-TTS-Has-Supabase-Key": String(hasSupabaseKey),
        "X-TTS-Force-Regenerate": String(forceRegenerate),
        ...(isFixedNovelAsset ? { "X-TTS-Novel-Asset": safeHeaderValue(novelAssetId) } : {}),
      }
    : {};

  const cached = forceRegenerate
    ? { ok: false, audioBuffer: null, reason: "forced_regeneration" }
    : await tryReadFromSupabaseStorage({ bucket, cacheKey });
  if (cached.ok && cached.audioBuffer) {
    return audioResponse(cached.audioBuffer, "supabase-cache", {
      ...debugHeaders,
      "X-TTS-Cache-Read": "hit",
      "X-TTS-Cache-Upload": "skipped-hit",
    }, isFixedNovelAsset);
  }

  if (cached.state === "unavailable") return jsonResponse(503, { error: "Saved speech is temporarily unavailable. Please try again." });
  if (cacheOnly) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", "X-TTS-Cache-Read": "miss" } });

  const apiKey = getEnv("ELEVENLABS_API_KEY");
  if (!apiKey) return jsonResponse(500, { error: "Missing ELEVENLABS_API_KEY" });

  try {
    const audioBuffer = await convertTextToSpeech({
      apiKey,
      voiceId,
      normalizedText,
      modelId,
      outputFormat,
      voiceSettings,
    });

    if (!audioBuffer.length) {
      return jsonResponse(502, { error: "ElevenLabs returned empty audio" });
    }

    const awaitUpload = forceRegenerate || getEnv("TTS_AWAIT_CACHE_UPLOAD") === "true" || typeof context.waitUntil !== "function";
    if (awaitUpload) {
      const upload = await tryUploadToSupabaseStorage({ bucket, cacheKey, audioBuffer, fixedAsset: isFixedNovelAsset, forceRegenerate });
      return audioResponse(audioBuffer, "elevenlabs", {
        ...debugHeaders,
        ...(forceRegenerate ? { "Cache-Control": "no-store" } : {}),
        "X-TTS-Cache-Read": safeHeaderValue(cached.reason),
        "X-TTS-Cache-Upload": upload.ok ? upload.reason === "preserved" ? "preserved" : "ok" : "failed",
        "X-TTS-Cache-Upload-Detail": safeHeaderValue(upload.reason),
      }, isFixedNovelAsset);
    }

    const uploadPromise = tryUploadToSupabaseStorage({ bucket, cacheKey, audioBuffer, fixedAsset: isFixedNovelAsset })
      .then((upload) => {
        if (!upload.ok) console.warn("TTS cache upload failed:", upload.reason);
        return upload;
      })
      .catch((err) => {
        console.warn("TTS cache upload error:", err?.message || String(err));
      });

    if (typeof context.waitUntil === "function") {
      context.waitUntil(uploadPromise);
    }

    return audioResponse(audioBuffer, "elevenlabs", {
      ...debugHeaders,
      "X-TTS-Cache-Read": safeHeaderValue(cached.reason),
      "X-TTS-Cache-Upload": "queued",
      "X-TTS-Cache-Upload-Detail": typeof context.waitUntil === "function" ? "waitUntil" : "best-effort",
    }, isFixedNovelAsset);
  } catch (err) {
    return err?.code === "tts_timeout"
      ? jsonResponse(504, { error: "Speech took too long. Please try again." })
      : jsonResponse(502, { error: "Speech is temporarily unavailable. Please try again." });
  }
}
