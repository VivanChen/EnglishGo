import crypto from "node:crypto";

const DEFAULT_VOICE_ID = "1AKkSX7KMPHIWuz76m0n";
const DEFAULT_BUCKET = "tts-cache";
const DEFAULT_MODEL_ID = "eleven_flash_v2_5";
const DEFAULT_ZH_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const MAX_TEXT_LENGTH = 900;

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

function audioResponse(audioBuffer, source = "elevenlabs", extraHeaders = {}) {
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
      "X-TTS-Source": source,
      ...extraHeaders,
    },
  });
}

function jsonResponse(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeTextForTts(rawText) {
  return String(rawText || "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^['"“”‘’]+|['"“”‘’.,!?;:，。！？；：]+$/g, "")
    .toLowerCase();
}

function clampNumber(value, min, max, fallback) {
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

function makeCacheKey({ normalizedText, lang, voiceId, modelId, outputFormat, voiceSettings }) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ text: normalizedText, lang, voiceId, modelId, outputFormat, voiceSettings, format: "mp3" }))
    .digest("hex");

  return `${voiceId}/${hash}.mp3`;
}

async function convertTextToSpeech({ apiKey, voiceId, normalizedText, modelId, outputFormat, voiceSettings }) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  if (outputFormat) url.searchParams.set("output_format", outputFormat);

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
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed ${res.status}: ${detail.slice(0, 240)}`);
  }

  return Buffer.from(await res.arrayBuffer());
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
    return { ok: false, audioBuffer: null, reason: "missing_supabase_env" };
  }

  try {
    const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${cacheKey}`;
    const res = await fetch(url, {
      method: "GET",
      headers: supabaseHeaders(supabaseKey),
    });

    if (!res.ok) {
      return { ok: false, audioBuffer: null, reason: `read_${res.status}` };
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    return audioBuffer.length
      ? { ok: true, audioBuffer, reason: "hit" }
      : { ok: false, audioBuffer: null, reason: "empty_cache_file" };
  } catch (err) {
    return { ok: false, audioBuffer: null, reason: `read_error_${err?.message || String(err)}` };
  }
}

async function tryUploadToSupabaseStorage({ bucket, cacheKey, audioBuffer }) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey || !audioBuffer?.length) {
    return { ok: false, reason: "missing_supabase_env_or_audio" };
  }

  try {
    const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${cacheKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders(supabaseKey, {
        "Content-Type": "audio/mp3",
        "Cache-Control": "86400",
        "x-upsert": "true",
      }),
      body: audioBuffer,
    });

    if (res.ok) return { ok: true, reason: "uploaded" };

    const detail = await res.text().catch(() => "");
    return { ok: false, reason: `upload_${res.status}_${detail.slice(0, 180)}` };
  } catch (err) {
    return { ok: false, reason: `upload_error_${err?.message || String(err)}` };
  }
}

export default async function handler(req, context = {}) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const apiKey = getEnv("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return jsonResponse(500, { error: "Missing ELEVENLABS_API_KEY" });
  }

  let payload;
  try {
    const body = await req.text();
    payload = JSON.parse(body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const originalText = String(payload.text || "").trim();
  const normalizedText = normalizeTextForTts(originalText);
  const lang = String(payload.lang || "en-US").trim();
  const voiceId = isChineseLang(lang)
    ? getEnv("ELEVENLABS_ZH_VOICE_ID")
    : getEnv("ELEVENLABS_VOICE_ID") || payload.voiceId || DEFAULT_VOICE_ID;
  const modelId = isChineseLang(lang)
    ? getEnv("ELEVENLABS_ZH_MODEL_ID") || DEFAULT_ZH_MODEL_ID
    : getEnv("ELEVENLABS_MODEL_ID") || DEFAULT_MODEL_ID;
  const outputFormat = getEnv("ELEVENLABS_OUTPUT_FORMAT") || DEFAULT_OUTPUT_FORMAT;
  const playbackSpeed = clampNumber(payload.speed ?? getEnv("ELEVENLABS_SPEED"), 0.7, 1.2, 1);
  const bucket = getEnv("SUPABASE_TTS_BUCKET") || DEFAULT_BUCKET;
  const hasSupabaseUrl = Boolean(getSupabaseUrl());
  const hasSupabaseKey = Boolean(getSupabaseKey());
  const voiceSettings = {
    stability: clampNumber(getEnv("ELEVENLABS_STABILITY"), 0, 1, 0.55),
    similarity_boost: clampNumber(getEnv("ELEVENLABS_SIMILARITY_BOOST"), 0, 1, 0.85),
    style: clampNumber(getEnv("ELEVENLABS_STYLE"), 0, 1, 0),
    use_speaker_boost: getBooleanEnv("ELEVENLABS_USE_SPEAKER_BOOST", false),
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
      }
    : {};

  const cached = await tryReadFromSupabaseStorage({ bucket, cacheKey });
  if (cached.ok && cached.audioBuffer) {
    return audioResponse(cached.audioBuffer, "supabase-cache", {
      ...debugHeaders,
      "X-TTS-Cache-Read": "hit",
      "X-TTS-Cache-Upload": "skipped-hit",
    });
  }

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

    const awaitUpload = getEnv("TTS_AWAIT_CACHE_UPLOAD") === "true";
    if (awaitUpload) {
      const upload = await tryUploadToSupabaseStorage({ bucket, cacheKey, audioBuffer });
      return audioResponse(audioBuffer, "elevenlabs", {
        ...debugHeaders,
        "X-TTS-Cache-Read": safeHeaderValue(cached.reason),
        "X-TTS-Cache-Upload": upload.ok ? "ok" : "failed",
        "X-TTS-Cache-Upload-Detail": safeHeaderValue(upload.reason),
      });
    }

    const uploadPromise = tryUploadToSupabaseStorage({ bucket, cacheKey, audioBuffer })
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
    });
  } catch (err) {
    return jsonResponse(500, { error: err?.message || String(err) });
  }
}
