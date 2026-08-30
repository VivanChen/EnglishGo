import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NOVEL_AUDIO_CATALOG } from "../netlify/functions/novel-audio-catalog.js";

const args = process.argv.slice(2);
const valueFor = (name, fallback = "") => {
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
const hasFlag = name => args.includes(name);
const baseUrl = valueFor("--base-url", process.env.NOVEL_AUDIO_BASE_URL || "https://englishgo-vevan.netlify.app").replace(/\/$/, "");
const concurrency = Math.max(1, Math.min(4, Number(valueFor("--concurrency", "2")) || 2));
const limit = Math.max(0, Number(valueFor("--limit", "0")) || 0);
const language = valueFor("--lang", "").toLowerCase();
const novelFilter = valueFor("--novel", "").toLowerCase();
const dryRun = hasFlag("--dry-run");
const reset = hasFlag("--reset");
const statePath = resolve(process.cwd(), valueFor("--state", ".novel-audio-prewarm.json"));

let completed = new Set();
if (!reset) {
  try {
    const saved = JSON.parse(await readFile(statePath, "utf8"));
    completed = new Set(Array.isArray(saved.completed) ? saved.completed : []);
  } catch {}
}

let entries = Object.entries(NOVEL_AUDIO_CATALOG)
  .filter(([id, entry]) => !language || entry.lang.toLowerCase().startsWith(language))
  .filter(([id]) => !novelFilter || id.toLowerCase().includes(novelFilter))
  .filter(([id]) => !completed.has(id));
if (limit) entries = entries.slice(0, limit);

console.log(`Novel audio prewarm: ${entries.length} pending, ${completed.size} already complete, concurrency ${concurrency}`);
console.log(`Target: ${baseUrl}`);
if (dryRun) process.exit(0);

let cursor = 0;
let succeeded = 0;
let failed = 0;
let stateWrite = Promise.resolve();

async function saveState() {
  const snapshot = JSON.stringify({ baseUrl, updatedAt: new Date().toISOString(), completed: [...completed] }, null, 2);
  stateWrite = stateWrite.then(() => writeFile(statePath, snapshot, "utf8"));
  return stateWrite;
}

async function warm(id, attempt = 1) {
  const url = `${baseUrl}/.netlify/functions/elevenlabs-tts?novel=${encodeURIComponent(id)}`;
  const response = await fetch(url, { headers: { Accept: "audio/mpeg" } });
  if (response.ok && (response.headers.get("content-type") || "").includes("audio")) {
    await response.arrayBuffer();
    return response.headers.get("x-tts-source") || "cdn";
  }
  const detail = await response.text().catch(() => "");
  if (attempt < 5 && (response.status === 429 || response.status >= 500)) {
    await new Promise(resolvePromise => setTimeout(resolvePromise, Math.min(20_000, 1000 * (2 ** attempt))));
    return warm(id, attempt + 1);
  }
  throw new Error(`${response.status} ${detail.slice(0, 160)}`);
}

async function worker() {
  while (cursor < entries.length) {
    const [id] = entries[cursor++];
    try {
      const source = await warm(id);
      completed.add(id);
      succeeded += 1;
      if (succeeded % 10 === 0 || succeeded === entries.length) {
        await saveState();
        console.log(`[${succeeded + failed}/${entries.length}] ready (${source}) · ${id}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[${succeeded + failed}/${entries.length}] failed · ${id} · ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
await saveState();
console.log(`Prewarm complete: ${succeeded} ready, ${failed} failed, ${completed.size} total cached in state.`);
if (failed) process.exitCode = 1;
