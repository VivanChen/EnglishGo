import { afterEach, describe, expect, it, vi } from 'vitest';
import { careSound, createTownSounds } from './townSounds.js';

function audioHarness(withMusic=false) {
  const sources = [], contexts = [], panners = [];
  class AudioContext {
    state = 'suspended'; currentTime = 1; destination = {};
    constructor() { contexts.push(this); }
    resume = vi.fn(async () => { this.state = 'running'; });
    suspend = vi.fn(async () => { this.state = 'suspended'; });
    close = vi.fn(async () => { this.state = 'closed'; });
    createBuffer(channels,length,sampleRate) { const data=Array.from({length:channels},()=>new Float32Array(length));return {length,sampleRate,numberOfChannels:channels,duration:length/sampleRate,getChannelData:i=>data[i]}; }
    decodeAudioData = vi.fn(async () => this.createBuffer(1,100,100));
    createBufferSource() { const source = { connect:vi.fn(), disconnect:vi.fn(), start:vi.fn(), stop:vi.fn() }; sources.push(source); return source; }
    createGain() { return { gain:{value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()}, connect:vi.fn(), disconnect:vi.fn() }; }
    createStereoPanner() { const panner={pan:{value:0},connect:vi.fn(),disconnect:vi.fn()};panners.push(panner);return panner; }
  }
  vi.stubGlobal('AudioContext', AudioContext);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok:true, json:async()=>({files:{step:'step.wav',water:'water.wav',toy:'toy.wav',towel:'towel.wav',chime:'chime.wav'},...(withMusic?{music:{file:'bgm-abcdef123456.mp3',volume:.12}}:{})}), arrayBuffer:async()=>new ArrayBuffer(8) })));
  return { sources, contexts, panners };
}
afterEach(() => vi.unstubAllGlobals());
describe('town sound lifecycle', () => {
  it('loops cached music independently of care cancellation and resumes without downloads', async()=>{
    const {sources,contexts}=audioHarness(true), audio=createTownSounds();
    expect(fetch).not.toHaveBeenCalled();await audio.start();await vi.waitFor(()=>expect(sources.filter(s=>s.loop)).toHaveLength(1));
    const music=sources.find(s=>s.loop);expect(audio.play('water')).toBe(true);audio.stop();expect(music.stop).not.toHaveBeenCalled();
    contexts[0].currentTime+=.4;audio.pause();expect(music.stop).toHaveBeenCalledOnce();
    await audio.start();const next=sources.filter(s=>s.loop)[1];expect(next.start).toHaveBeenCalledWith(0,expect.closeTo(.4));
    expect(fetch).toHaveBeenCalledTimes(7);expect(fetch.mock.calls.every(([url])=>url.startsWith('/audio/pet-town/'))).toBe(true);
    audio.dispose();expect(next.stop).toHaveBeenCalledOnce();expect(next.disconnect).toHaveBeenCalledOnce();
  });
  it('does not start late-loading music after mute or disposal',async()=>{
    const {sources}=audioHarness(true), original=fetch.getMockImplementation();let finish;
    fetch.mockImplementation(async url=>url.endsWith('.mp3')?{ok:true,arrayBuffer:()=>new Promise(resolve=>{finish=resolve;})}:original(url));
    const audio=createTownSounds();await audio.start();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
    audio.pause();finish(new ArrayBuffer(8));await new Promise(resolve=>setTimeout(resolve,0));expect(sources).toHaveLength(0);
    await audio.start();expect(sources.filter(s=>s.loop)).toHaveLength(1);audio.dispose();
    expect(await audio.start()).toBe(false);expect(sources.filter(s=>s.loop)).toHaveLength(1);
  });
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
