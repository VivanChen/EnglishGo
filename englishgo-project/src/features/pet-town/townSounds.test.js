import { afterEach, describe, expect, it, vi } from 'vitest';
import { careSound, createTownSounds } from './townSounds.js';

function audioHarness() {
  const sources = [], contexts = [], panners = [];
  class AudioContext {
    state = 'suspended'; currentTime = 1; destination = {};
    constructor() { contexts.push(this); }
    resume = vi.fn(async () => { this.state = 'running'; });
    suspend = vi.fn(async () => { this.state = 'suspended'; });
    close = vi.fn(async () => { this.state = 'closed'; });
    decodeAudioData = vi.fn(async () => ({}));
    createBufferSource() { const source = { connect:vi.fn(), disconnect:vi.fn(), start:vi.fn(), stop:vi.fn() }; sources.push(source); return source; }
    createGain() { return { gain:{value:0}, connect:vi.fn(), disconnect:vi.fn() }; }
    createStereoPanner() { const panner={pan:{value:0},connect:vi.fn(),disconnect:vi.fn()};panners.push(panner);return panner; }
  }
  vi.stubGlobal('AudioContext', AudioContext);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok:true, json:async()=>({files:{step:'step.wav',water:'water.wav',toy:'toy.wav',towel:'towel.wav',chime:'chime.wav'}}), arrayBuffer:async()=>new ArrayBuffer(8) })));
  return { sources, contexts, panners };
}
afterEach(() => vi.unstubAllGlobals());
describe('town sound lifecycle', () => {
  it('starts only on opt-in, caches clips and limits overlapping/repeated sounds', async () => {
    const {sources,contexts}=audioHarness(), audio=createTownSounds();
    expect(audio.play('step')).toBe(false); expect(contexts).toHaveLength(0);
    await audio.start(); await vi.waitFor(()=>expect(contexts[0].decodeAudioData).toHaveBeenCalledTimes(5));
    expect(audio.play('step')).toBe(true); expect(audio.play('step')).toBe(false);
    for (const name of ['water','toy','towel']) expect(audio.play(name)).toBe(true);
    expect(audio.play('chime')).toBe(false);
    audio.pause(); expect(sources.every(s=>s.stop.mock.calls.length===1)).toBe(true);
    expect(audio.play('water')).toBe(false);
    await audio.start(); expect(contexts).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(6);
    audio.dispose(); expect(contexts[0].close).toHaveBeenCalledOnce();
  });
  it('does not enable audio when a pending resume is canceled', async () => {
    const {contexts}=audioHarness(), audio=createTownSounds();
    await audio.start(); audio.pause();
    let resume; contexts[0].resume.mockImplementation(()=>new Promise(resolve=>{resume=resolve;}));
    const pending=audio.start(); audio.pause(); resume();
    expect(await pending).toBe(false); expect(audio.play('step')).toBe(false); audio.dispose();
  });
  it('positions a sound in stereo and releases its panner after playback', async () => {
    const {contexts,sources,panners}=audioHarness(), audio=createTownSounds();
    await audio.start();await vi.waitFor(()=>expect(contexts[0].decodeAudioData).toHaveBeenCalledTimes(5));
    expect(audio.play('water',.25,3)).toBe(true);expect(panners[0].pan.value).toBe(1);
    sources[0].onended();expect(panners[0].disconnect).toHaveBeenCalledOnce();
    audio.dispose();
  });
  it('uses different sounds for wash phases and remains usable after missing media', async () => {
    expect(careSound('wash','scrub')).toBe('bubbles'); expect(careSound('wash','rinse')).toBe('water'); expect(careSound('wash','dry')).toBe('towel');
    audioHarness(); fetch.mockResolvedValue({ok:false}); const audio=createTownSounds();
    await audio.start(); await Promise.resolve(); expect(audio.play('step')).toBe(false); audio.dispose();
  });
});
