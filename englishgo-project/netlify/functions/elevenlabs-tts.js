import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const VOICE_ID = "1AKkSX7KMPHIWuz76m0n";

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);

  if (Buffer.isBuffer(stream)) return stream;

  if (stream instanceof ArrayBuffer) {
    return Buffer.from(stream);
  }

  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }

  const chunks = [];

  // Web ReadableStream, which is what the official ElevenLabs SDK returns.
  if (typeof stream.getReader === "function") {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  // Node Readable / async iterable fallback.
  if (stream[Symbol.asyncIterator]) {
    for await (const chunk of stream) {
      if (chunk) chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  return Buffer.from(stream);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: "Missing ELEVENLABS_API_KEY" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON body" };
  }

  const text = String(payload.text || "").trim();

  if (!text) {
    return { statusCode: 400, body: "Missing text" };
  }

  try {
    const client = new ElevenLabsClient({ apiKey });

    const response = await client.textToSpeech.convert(VOICE_ID, {
      text
    });

    const audioBuffer = await streamToBuffer(response);

    if (!audioBuffer.length) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "ElevenLabs returned empty audio" })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400"
      },
      body: audioBuffer.toString("base64"),
      isBase64Encoded: true
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: err?.message || String(err) })
    };
  }
}
