const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const DEFAULT_MODEL_ID = "eleven_flash_v2_5";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return json(500, { error: "ELEVENLABS_API_KEY is not configured" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const text = String(body.text || "").trim();
  if (!text) {
    return json(400, { error: "Text is required" });
  }

  if (text.length > 900) {
    return json(400, { error: "Text is too long" });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || body.voiceId || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || body.modelId || DEFAULT_MODEL_ID;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const message = await response.text();
      return json(response.status, { error: "ElevenLabs request failed", detail: message.slice(0, 500) });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
      body: audio.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    return json(500, { error: "TTS proxy failed", detail: error?.message || String(error) });
  }
}
