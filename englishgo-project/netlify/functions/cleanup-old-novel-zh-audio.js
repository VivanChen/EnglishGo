const OLD_NOVEL_CHINESE_VOICE_ID = "r6qgCCGI7RWKXCagm158";
const CLEANUP_CONFIRMATION = `delete-${OLD_NOVEL_CHINESE_VOICE_ID}-novel-zh-cache`;
const DEFAULT_BUCKET = "tts-cache";
const DELETE_BATCH_SIZE = 1000;
const MAX_DELETE_COUNT = 10_000;

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

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function storageHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function listOldVoiceFiles({ supabaseUrl, serviceRoleKey, bucket }) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: storageHeaders(serviceRoleKey),
    body: JSON.stringify({
      prefix: OLD_NOVEL_CHINESE_VOICE_ID,
      limit: DELETE_BATCH_SIZE,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (!response.ok) throw new Error(`Supabase list failed ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const entries = await response.json();
  return Array.isArray(entries)
    ? entries.filter(entry => entry?.id && typeof entry.name === "string" && entry.name.endsWith(".mp3"))
    : [];
}

async function deleteOldVoiceFiles({ supabaseUrl, serviceRoleKey, bucket, paths }) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: storageHeaders(serviceRoleKey),
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!response.ok) throw new Error(`Supabase delete failed ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const deleted = await response.json().catch(() => []);
  return Array.isArray(deleted) ? deleted.length : paths.length;
}

export default async function handler(req) {
  if (req.method !== "DELETE") return jsonResponse(405, { error: "Method not allowed" });
  const confirmation = new URL(req.url).searchParams.get("confirm") || "";
  if (confirmation !== CLEANUP_CONFIRMATION) return jsonResponse(403, { error: "Invalid cleanup confirmation" });

  const supabaseUrl = getFirstEnv("SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = getEnv("SUPABASE_TTS_BUCKET") || DEFAULT_BUCKET;
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(500, { error: "Missing Supabase maintenance credentials" });

  let deleted = 0;
  let batches = 0;
  while (deleted < MAX_DELETE_COUNT) {
    const entries = await listOldVoiceFiles({ supabaseUrl, serviceRoleKey, bucket });
    if (!entries.length) break;
    const paths = entries.map(entry => `${OLD_NOVEL_CHINESE_VOICE_ID}/${entry.name}`);
    const removed = await deleteOldVoiceFiles({ supabaseUrl, serviceRoleKey, bucket, paths });
    deleted += removed;
    batches += 1;
    if (entries.length < DELETE_BATCH_SIZE) break;
  }

  if (deleted >= MAX_DELETE_COUNT) return jsonResponse(500, { error: "Cleanup safety limit reached", deleted, batches });
  const remaining = await listOldVoiceFiles({ supabaseUrl, serviceRoleKey, bucket });
  return jsonResponse(200, {
    ok: true,
    bucket,
    deleted,
    batches,
    remaining: remaining.length,
    oldVoiceId: OLD_NOVEL_CHINESE_VOICE_ID,
  });
}
