const DEFAULT_VOICE_ID = "1AKkSX7KMPHIWuz76m0n";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

function parseElevenLabsError(raw) {
  try {
    const obj = JSON.parse(raw);
    const detail = obj?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    if (detail?.status) return `${detail.status}: ${detail.message || ""}`.trim();
    return JSON.stringify(obj).slice(0, 800);
  } catch {
    return String(raw || "").slice(0, 800);
  }
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

  try {
    // Keep this request aligned with the official SDK minimal payload:
    // client.textToSpeech.convert(voiceId, { text })
    // Avoid forcing model_id / voice_settings because some free-plan voices reject them.
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      const raw = await response.text();
      return json(response.status, {
        error: "ElevenLabs request failed",
        status: response.status,
        detail: parseElevenLabsError(raw),
      });
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
