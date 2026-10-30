// Quiet local shoreline synthesis. start() is called only from the sound switch.
export function createTownAmbience() {
  let context, gain, noise, tide, tideDepth;
  return {
    async start() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      if (!context) {
        context = new AudioContext();
        const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate), samples = buffer.getChannelData(0);
        let last = 0;
        for (let i=0;i<samples.length;i++) { last = (last + (Math.random()*2-1)*.025)/1.025; samples[i]=last*3; }
        noise=context.createBufferSource(); noise.buffer=buffer; noise.loop=true;
        const lowpass=context.createBiquadFilter(); lowpass.type='lowpass'; lowpass.frequency.value=900;
        gain=context.createGain(); gain.gain.value=.07;
        tide=context.createOscillator(); tide.frequency.value=.14;
        tideDepth=context.createGain(); tideDepth.gain.value=.035;
        tide.connect(tideDepth); tideDepth.connect(gain.gain);
        noise.connect(lowpass); lowpass.connect(gain); gain.connect(context.destination); noise.start(); tide.start();
      }
      await context.resume(); return context.state==='running';
    },
    pause() { if (context?.state==='running') void context.suspend(); },
    dispose() { noise?.stop(); tide?.stop(); if(context && context.state!=='closed') void context.close(); context=null; },
  };
}
