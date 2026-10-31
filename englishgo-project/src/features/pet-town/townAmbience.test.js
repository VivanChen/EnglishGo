import {afterEach,expect,it,vi} from 'vitest';
import {createTownAmbience} from './townAmbience.js';
afterEach(()=>vi.unstubAllGlobals());
it('mutes both shoreline noise and its tide modulation, including before first start',async()=>{
  const gains=[];const node=()=>({connect:vi.fn(),start:vi.fn(),stop:vi.fn(),frequency:{value:0}});
  class AudioContext {
    state='running';sampleRate=10;destination={};
    resume=async()=>{};suspend=async()=>{};close=async()=>{};
    createBuffer=()=>({getChannelData:()=>new Float32Array(40)});
    createBufferSource=node;createBiquadFilter=node;createOscillator=node;
    createGain(){const result={...node(),gain:{value:0}};gains.push(result);return result;}
  }
  vi.stubGlobal('AudioContext',AudioContext);const ambience=createTownAmbience();ambience.setVolume(0);await ambience.start();
  expect(gains.map(g=>g.gain.value)).toEqual([0,0]);ambience.setVolume(.5);expect(gains.map(g=>g.gain.value)).toEqual([.035,.0175]);
  ambience.setVolume(0);expect(gains.map(g=>g.gain.value)).toEqual([0,0]);ambience.dispose();
});
