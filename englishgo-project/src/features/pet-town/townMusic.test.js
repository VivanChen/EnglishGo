import { expect, it } from 'vitest';
import { prepareMusicLoop } from './townMusic.js';
it('reduces the loop seam without changing the original decoded audio',()=>{
  const data=Float32Array.from({length:100},(_,i)=>i/100), original=data.slice();
  const make=(values)=>({sampleRate:100,length:values.length,numberOfChannels:1,getChannelData:()=>values});
  const output=prepareMusicLoop({createBuffer:(_,length)=>make(new Float32Array(length))},make(data)).getChannelData(0);
  expect(Math.abs(output[0]-output.at(-1))).toBeLessThan(.02);expect(data).toEqual(original);
  expect(output.every(Number.isFinite)).toBe(true);
});
