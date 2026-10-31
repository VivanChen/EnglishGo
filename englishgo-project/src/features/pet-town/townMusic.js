// Prepare the loop once, overlapping its tail/head to soften the repeat boundary.
export function prepareMusicLoop(context, input) {
  const overlap = Math.min(Math.floor(input.sampleRate * .15), Math.floor(input.length / 4));
  if (!overlap) return input;
  const length = input.length - overlap, output = context.createBuffer(input.numberOfChannels, length, input.sampleRate);
  for (let channel=0;channel<input.numberOfChannels;channel++) {
    const source=input.getChannelData(channel), target=output.getChannelData(channel);
    target.set(source.subarray(0,length));
    for (let i=0;i<overlap;i++) { const blend=i/overlap;target[i]=source[length+i]*(1-blend)+source[i]*blend; }
  }
  return output;
}

export function createTownMusic(context) {
  let buffer, source, gain, offset=0, startedAt=0, volume=.12;
  const pause = () => {
    if (!source) return;
    offset=(offset+Math.max(0,context.currentTime-startedAt))%buffer.duration;
    source.stop();source.disconnect();gain.disconnect();source=null;gain=null;
  };
  return {
    load(input, level=.12) { pause();buffer=prepareMusicLoop(context,input);offset=0;volume=Number.isFinite(level)?Math.max(0,Math.min(.25,level)):.12; },
    start() {
      if (!buffer || source || context.state!=='running') return false;
      source=context.createBufferSource();gain=context.createGain();source.buffer=buffer;source.loop=true;
      gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(volume,context.currentTime+.5);
      source.connect(gain);gain.connect(context.destination);startedAt=context.currentTime;source.start(0,offset);return true;
    },
    pause,
    dispose() { pause();buffer=null;offset=0; },
  };
}
