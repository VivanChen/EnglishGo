// Original deterministic Foley, usable offline when the optional API is unavailable.
import { mkdir, writeFile } from 'node:fs/promises';
const rate = 22050, output = new URL('../public/audio/pet-town/', import.meta.url);
const durations = { step: .2, bubbles: .7, water: 1.2, towel: .6, toy: .4, chime: 1.6, success: 1.2, cat: .6, dog: .35, rustle: .5 };
await mkdir(output, { recursive: true });
let seed = 83742;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const bell = (t, f, length = .4) => t < 0 || t > length ? 0 : Math.sin(2*Math.PI*f*t)*Math.min(1,t/.008)*Math.exp(-t*6/length);
for (const [name, duration] of Object.entries(durations)) {
  const size = Math.ceil(duration*rate), samples = new Float32Array(size); let low = 0;
  for (let i=0;i<size;i++) {
    const t = i/rate, noise = random(); low += .16*(noise-low);
    const fade = Math.min(1,t/.012,(duration-t)/.04), rustle = low * (0.6 + .4*Math.sin(t*33));
    let value = 0;
    if (name==='step') value = bell(t,110,.18)*.65 + low*Math.exp(-t*35)*.7;
    if (name==='bubbles') for (const [at,f] of [[.02,1100],[.18,1550],[.34,900],[.52,1300]]) value += bell(t-at,f,.12)*.55;
    if (name==='water') value = low*.65 + (noise-low)*.08 + bell(t-.25,950,.1)*.12 + bell(t-.7,1400,.12)*.12;
    if (name==='towel') value = rustle*.9*Math.sin(Math.PI*t/duration);
    if (name==='toy') value = Math.sin(2*Math.PI*(650*t-480*t*t))*Math.exp(-t*14)*.6;
    if (name==='chime') value = bell(t,1046,1.2)*.5 + bell(t-.2,1568,1.3)*.3;
    if (name==='success') value = bell(t,523,.6)*.45 + bell(t-.16,659,.6)*.4 + bell(t-.32,784,.8)*.4;
    // Stylized melodic greetings, not recordings of real animals.
    if (name==='cat') value = Math.sin(2*Math.PI*(480*t+90*t*t))*Math.sin(Math.PI*t/duration)*.3;
    if (name==='dog') value = (Math.sin(2*Math.PI*180*t)+.3*Math.sin(2*Math.PI*360*t))*Math.sin(Math.PI*t/duration)*.3;
    if (name==='rustle') value = rustle*.65*Math.sin(Math.PI*t/duration);
    samples[i] = value*fade;
  }
  const wave = Buffer.alloc(44+size*2); wave.write('RIFF'); wave.writeUInt32LE(wave.length-8,4); wave.write('WAVEfmt ',8); wave.writeUInt32LE(16,16); wave.writeUInt16LE(1,20); wave.writeUInt16LE(1,22); wave.writeUInt32LE(rate,24); wave.writeUInt32LE(rate*2,28); wave.writeUInt16LE(2,32); wave.writeUInt16LE(16,34); wave.write('data',36); wave.writeUInt32LE(size*2,40);
  samples.forEach((value,i)=>wave.writeInt16LE(Math.round(Math.max(-.9,Math.min(.9,value))*32767),44+i*2));
  await writeFile(new URL(`${name}.wav`,output),wave);
}
await writeFile(new URL('manifest.json',output),JSON.stringify({provider:'Original procedural Foley',license:'Original EnglishGo assets',files:Object.fromEntries(Object.keys(durations).map(name=>[name,`${name}.wav`])),durations},null,2)+'\n');
console.log('Generated 10 original offline sound effects.');
