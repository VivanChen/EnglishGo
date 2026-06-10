import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../netlify/functions/elevenlabs-tts.js";

const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_ZH_VOICE_ID",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] == null) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

function request(payload) {
  return new Request("http://localhost/.netlify/functions/elevenlabs-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("elevenlabs-tts function voice selection", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.ELEVENLABS_API_KEY = "test-api-key";
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(new Blob(["mp3"], { type: "audio/mpeg" }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
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

    const res = await handler(request({ text: "這是小說中文朗讀。", lang: "zh-TW" }));

    expect(res.status).toBe(200);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(String(url)).toBe("https://api.elevenlabs.io/v1/text-to-speech/mandarin-voice?output_format=mp3_44100_128");
    expect(init.method).toBe("POST");
  });
});
