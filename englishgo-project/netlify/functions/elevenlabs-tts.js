import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import crypto from "node:crypto";

const DEFAULT_VOICE_ID = "1AKkSX7KMPHIWuz76m0n";
const DEFAULT_BUCKET = "tts-cache";
const MAX_TEXT_LENGTH = 900;

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
}

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
}

function audioResponse(audioBuffer, source = "elevenlabs") {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
      "X-TTS-Source": source,
    },
    body: audioBuffer.toString("base64"),
    isBase64Encoded: true,
  };
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

function makeCacheKey({ text, voiceId }) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ text, voiceId, format: "mp3" }))
    .digest("hex");

  return `${voiceId}/${hash}.mp3`;
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  if (Buffer.isBuffer(stream)) return stream;
  if (stream instanceof ArrayBuffer) return Buffer.from(stream);
  if (stream instanceof Uint8Array) return Buffer.from(stream);

  const chunks = [];

  if (typeof stream.getReader === "function") {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  if (stream[Symbol.asyncIterator]) {
    for await (const chunk of stream) {
      if (chunk) chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  return Buffer.from(stream);
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
    return null;
  }

  try {
    const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${cacheKey}`;
    const res = await fetch(url, {
      method: "GET",
      headers: supabaseHeaders(supabaseKey),
    });

    if (!res.ok) return null;

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    return audioBuffer.length ? audioBuffer : null;
  } catch {
    return null;
  }
}

async function tryUploadToSupabaseStorage({ bucket, cacheKey, audioBuffer }) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey || !audioBuffer?.length) {
    return false;
  }

  try {
    const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${cacheKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders(supabaseKey, {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "86400",
        "x-upsert": "true",
      }),
      body: audioBuffer,
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "Missing ELEVENLABS_API_KEY" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const text = String(payload.text || "").trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID || payload.voiceId || DEFAULT_VOICE_ID;
  const bucket = process.env.SUPABASE_TTS_BUCKET || DEFAULT_BUCKET;

  if (!text) {
    return jsonResponse(400, { error: "Missing text" });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return jsonResponse(400, { error: `Text is too long. Max length is ${MAX_TEXT_LENGTH} characters.` });
  }

  const cacheKey = makeCacheKey({ text, voiceId });

  const cachedAudio = await tryReadFromSupabaseStorage({ bucket, cacheKey });
  if (cachedAudio) {
    return audioResponse(cachedAudio, "supabase-cache");
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    const response = await client.textToSpeech.convert(voiceId, { text });
    const audioBuffer = await streamToBuffer(response);

    if (!audioBuffer.length) {
      return jsonResponse(502, { error: "ElevenLabs returned empty audio" });
    }

    await tryUploadToSupabaseStorage({ bucket, cacheKey, audioBuffer });

    return audioResponse(audioBuffer, "elevenlabs");
  } catch (err) {
    return jsonResponse(500, { error: err?.message || String(err) });
  }
}
