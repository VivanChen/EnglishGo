import { mkdir, writeFile, access } from 'node:fs/promises';
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

export async function generatePetSounds(key) {
  if (!key) throw new Error('ELEVENLABS_API_KEY is required; never put it in the client bundle.');
  const output = new URL('../public/audio/pet-town/', import.meta.url);
  await mkdir(output, { recursive: true });
  for (const [name, [duration_seconds, prompt]] of Object.entries(sounds)) {
    const file = new URL(`${name}.mp3`, output);
    try { await access(file); console.log(`${name}: cached`); continue; } catch {}
    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${prompt} Isolated sound effect. No speech, no music, no background hum.`, duration_seconds, prompt_influence: .5, model_id: 'eleven_text_to_sound_v2' }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Sound generation failed for ${name}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 100 || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error(`Invalid audio for ${name}`);
    await writeFile(file, bytes); console.log(`${name}: ${bytes.length} bytes`);
  }
  await writeFile(new URL('manifest.json', output), JSON.stringify({ provider: 'ElevenLabs', model: 'eleven_text_to_sound_v2', generatedAt: new Date().toISOString(), files: Object.fromEntries(Object.keys(sounds).map(name=>[name, `${name}.mp3`])), sounds }, null, 2) + '\n');
}
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { loadEnv } = await import('vite');
  const env = loadEnv('development', process.cwd(), 'ELEVENLABS_');
  await generatePetSounds(process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY);
}
