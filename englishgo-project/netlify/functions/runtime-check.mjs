import crypto from "node:crypto";
import { constants } from "node:zlib";

export default async function handler(req, context) {
  const token = req.headers.get("X-EnglishGo-Runtime-Check") || "";
  if (crypto.createHash("sha256").update(token).digest("hex") !== "8581279f73870d4ed5b893f5c6a19efdaae3e6a59849996e3e354a9681e58a64") {
    return new Response("Not found", { status: 404 });
  }
  return new Response(JSON.stringify({
    node: process.version,
    brotli: process.versions.brotli,
    brotliBlockSwitchError: constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH ?? null,
    deployId: context.deploy?.id ?? null,
  }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
