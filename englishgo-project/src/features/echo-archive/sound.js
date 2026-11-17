// Tiny synthesized sound kit. No audio files: every effect is a few
// oscillators or a filtered noise burst, so it costs nothing to load.
let context = null;
let enabled = true;

export function setSoundEnabled(value) { enabled = Boolean(value); }

function audio() {
  if (!enabled || typeof window === 'undefined') return null;
  if (document.documentElement.dataset.egQuiet === 'true') return null;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context ||= new Ctor();
    if (context.state === 'suspended') context.resume?.();
    return context;
  } catch {
    return null;
  }
}

function tone(freq, { at = 0, dur = 0.18, type = 'sine', gain = 0.07, to = null } = {}) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator(), amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noise({ at = 0, dur = 0.16, gain = 0.12, freq = 1200, q = 0.8, type = 'bandpass' } = {}) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + at;
  const length = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), amp = ac.createGain();
  src.buffer = buffer;
  filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(start);
}

export const sfx = {
  select: () => tone(660, { dur: 0.06, gain: 0.03, type: 'triangle' }),
  card: () => { noise({ dur: 0.12, gain: 0.06, freq: 2600, q: 0.6 }); tone(420, { dur: 0.1, gain: 0.03, to: 720, type: 'triangle' }); },
  hit: (heavy = false) => { noise({ dur: heavy ? 0.24 : 0.14, gain: heavy ? 0.22 : 0.15, freq: heavy ? 500 : 900, q: 0.9 }); tone(heavy ? 90 : 140, { dur: 0.16, gain: 0.12, to: 50, type: 'sine' }); },
  hurt: () => { noise({ dur: 0.2, gain: 0.16, freq: 380, q: 1.2 }); tone(180, { dur: 0.22, gain: 0.08, to: 70, type: 'sawtooth' }); },
  block: () => { tone(980, { dur: 0.22, gain: 0.05, type: 'triangle' }); tone(1470, { at: 0.02, dur: 0.18, gain: 0.03, type: 'sine' }); },
  burn: () => noise({ dur: 0.3, gain: 0.08, freq: 3200, q: 0.4, type: 'highpass' }),
  heal: () => [523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.24, gain: 0.04 })),
  buff: () => tone(330, { dur: 0.3, gain: 0.05, to: 660, type: 'triangle' }),
  debuff: () => tone(520, { dur: 0.3, gain: 0.05, to: 220, type: 'triangle' }),
  coin: () => { tone(1320, { dur: 0.08, gain: 0.04, type: 'square' }); tone(1760, { at: 0.07, dur: 0.14, gain: 0.03, type: 'square' }); },
  turn: () => tone(392, { dur: 0.25, gain: 0.04, to: 523, type: 'sine' }),
  deny: () => tone(160, { dur: 0.14, gain: 0.05, type: 'square' }),
  chantOk: () => [659, 880, 1175, 1568].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.3, gain: 0.045, type: 'triangle' })),
  chantMiss: () => tone(440, { dur: 0.3, gain: 0.04, to: 330, type: 'sine' }),
  victory: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.1, dur: 0.4, gain: 0.05, type: 'triangle' })),
  defeat: () => [392, 330, 262, 196].forEach((f, i) => tone(f, { at: i * 0.18, dur: 0.5, gain: 0.05, type: 'sine' })),
  map: () => tone(587, { dur: 0.12, gain: 0.035, type: 'triangle' }),
};
