import { expect, it, vi } from 'vitest';
import { prepareMusicLoop, createTownMusic } from './townMusic.js';
it('ducks foreground sounds, keeps mute through automatic restoration, and clears ducking on pause',()=>{
  const params=[],context={state:'running',currentTime:1,destination:{},createBufferSource:()=>({connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()}),createGain:()=>{const gain={value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),cancelAndHoldAtTime:vi.fn()};params.push(gain);return {gain,connect:vi.fn(),disconnect:vi.fn()};}};
  const music=createTownMusic(context);music.load({sampleRate:100,length:0,duration:10});music.start();music.duck(2);
  expect(params[0].linearRampToValueAtTime).toHaveBeenCalledWith(.03,1.08);
  expect(params[0].linearRampToValueAtTime).toHaveBeenLastCalledWith(.12,3.5);
  music.setVolume(0);expect(params[0].linearRampToValueAtTime).toHaveBeenLastCalledWith(0,3.5);
  music.pause();music.setVolume(.5);music.start();expect(params[1].linearRampToValueAtTime).toHaveBeenLastCalledWith(.06,1.5);music.dispose();
});
it('reduces the loop seam without changing the original decoded audio',()=>{
  const data=Float32Array.from({length:100},(_,i)=>i/100), original=data.slice();
  const make=(values)=>({sampleRate:100,length:values.length,numberOfChannels:1,getChannelData:()=>values});
  const output=prepareMusicLoop({createBuffer:(_,length)=>make(new Float32Array(length))},make(data)).getChannelData(0);
  expect(Math.abs(output[0]-output.at(-1))).toBeLessThan(.02);expect(data).toEqual(original);
  expect(output.every(Number.isFinite)).toBe(true);
});
