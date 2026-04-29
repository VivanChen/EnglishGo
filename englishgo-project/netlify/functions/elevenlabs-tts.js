import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const VOICE_ID = "1AKkSX7KMPHIWuz76m0n";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: "Missing ELEVENLABS_API_KEY" };
  }

  const { text } = JSON.parse(event.body || "{}");

  if (!text) {
    return { statusCode: 400, body: "Missing text" };
  }

  try {
    const client = new ElevenLabsClient({ apiKey });

    const response = await client.textToSpeech.convert(VOICE_ID, {
      text: text
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "audio/mpeg" },
      body: Buffer.from(response).toString("base64"),
      isBase64Encoded: true
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
