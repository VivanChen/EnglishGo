import { mkdir, writeFile, readFile, rename, open, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const sounds = {
  step: [0.5, 'One soft tiny animal paw footstep on garden grass. Gentle dry tap and delicate grass rustle. Close up, no other sounds.'],
  bubbles: [1, 'Soft playful soap bubbles popping and foamy gentle scrubbing in a cozy pet bath.'],
  water: [1.5, 'A little warm water gently pouring and splashing into a small pet bathtub.'],
  towel: [1, 'Soft fluffy cotton towel gently rubbing fur, a quiet cozy fabric swish.'],
  toy: [0.7, 'One small soft rubber toy ball bouncing, a warm rounded playful plop.'],
  chime: [2, 'Two delicate wooden and glass garden wind chime notes, airy and relaxing.'],
  success: [1.5, 'A very gentle three note ascending marimba reward sparkle for a cozy children game, soft rounded notes.'],
  cat: [1, 'One gentle happy kitten meow, friendly quiet and close.'],
  dog: [0.8, 'One tiny friendly puppy woof, soft and playful, not alarming.'],
  rustle: [1, 'A tiny rabbit quietly sniffing and rustling soft garden leaves, delicate close up foley.'],
};

export const music = {
  prompt: 'Original cozy seaside garden game background music. Soft marimba, delicate acoustic guitar plucks and warm felt piano. Relaxed 80 BPM, simple C major harmony, sparse gentle melody. No vocals, no speech, no percussion hits, no dramatic buildup. Consistent quiet dynamics, suitable beneath English learning activities. A repeating 16-bar theme with a smooth return to the opening harmony; no intro or final flourish.',
  music_length_ms: 48000, model_id: 'music_v2_5', force_instrumental: true,
};
const hash = value => createHash('sha256').update(value).digest('hex');
const validMp3 = bytes => bytes.length > 100 && (bytes.subarray(0,3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224));
async function atomicWrite(file, bytes) { const temp = new URL(`${file.href}.tmp`); await writeFile(temp, bytes); await rename(temp, file); }

export async function generatePetSounds(key, { output = new URL('../public/audio/pet-town/', import.meta.url), fetchImpl = fetch, log = console.log } = {}) {
  if (!key) throw new Error('ELEVENLABS_API_KEY is required; never put it in the client bundle.');
  await mkdir(output, { recursive: true });
  const lockFile = new URL('.generation.lock', output), lock = await open(lockFile, 'wx').catch(() => { throw new Error('Another generation is running, or a previous interrupted run left .generation.lock.'); });
  const asset = async (name, endpoint, body) => {
    const requestHash = hash(JSON.stringify({ endpoint, body })), fileName = `${name}-${requestHash.slice(0,12)}.mp3`;
    const file = new URL(fileName, output), metadataFile = new URL(`${fileName}.json`, output);
    let bytes;
    try { bytes = await readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (bytes) {
      const metadata = await readFile(metadataFile, 'utf8').then(JSON.parse).catch(() => null);
      if (!metadata || metadata.requestHash !== requestHash || metadata.sha256 !== hash(bytes) || !validMp3(bytes)) throw new Error(`Cached ${name} failed integrity checks; inspect it before regenerating. No paid retry was made.`);
      log(`${name}: cached`); return metadata;
    }
    const response = await fetchImpl(`https://api.elevenlabs.io/v1/${endpoint}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(endpoint === 'music' ? 240000 : 120000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      const knownReasons = ['invalid_api_key','missing_permissions','insufficient_permissions','quota_exceeded','subscription_required','needs_authorization'];
      const reason = knownReasons.includes(detail?.detail?.status) ? ` (${detail.detail.status})` : '';
      throw new Error(`Generation failed for ${name}: HTTP ${response.status}${reason}. Existing playback manifest was preserved.`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
    if (!validMp3(bytes) || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error(`Invalid audio for ${name}; playback manifest was preserved.`);
    const metadata = { file: fileName, requestHash, sha256: hash(bytes), bytes: bytes.length, model: body.model_id, generatedAt: new Date().toISOString() };
    await atomicWrite(file, bytes); await atomicWrite(metadataFile, JSON.stringify(metadata, null, 2)+'\n');
    log(`${name}: ${bytes.length} bytes`); return metadata;
  };
  try {
    const assets = {};
    for (const [name, [duration_seconds, prompt]] of Object.entries(sounds)) {
      assets[name] = await asset(name, 'sound-generation', { text: `${prompt} Isolated sound effect. No speech, no music, no background hum.`, duration_seconds, prompt_influence: .5, model_id: 'eleven_text_to_sound_v2' });
    }
    const background = await asset('bgm', 'music', music);
    const manifest = { provider: 'ElevenLabs', generatedAt: new Date().toISOString(), files: Object.fromEntries(Object.entries(assets).map(([name,data])=>[name,data.file])), music: { file: background.file, volume: .12 }, assets: { ...assets, bgm: background } };
    await atomicWrite(new URL('manifest.json', output), JSON.stringify(manifest, null, 2)+'\n');
    return manifest;
  } finally {
    await lock.close(); await unlink(lockFile);
  }
}
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { loadEnv } = await import('vite');
  const env = loadEnv('development', process.cwd(), 'ELEVENLABS_');
  await generatePetSounds(process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY);
}
