// Synthesized sound kit: a few oscillators and noise bursts per effect, so
// nothing has to download. Busy effects are throttled so a crowded wave
// doesn't turn into static.
let context = null;
let enabled = true;
let haptics = true;
const lastPlayed = new Map();
const GAP = { hit: 45, pop: 38, star: 32, shoot: 60, staple: 70, swing: 70, spit: 120, whoosh: 120, glob: 90, beam: 90, splash: 120, boom: 80, heal: 120, dodge: 150 };

export function setSoundEnabled(value) { enabled = Boolean(value); }
export function setHapticsEnabled(value) { haptics = Boolean(value); }

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

export const hasHaptics = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

function buzz(pattern) {
  if (!haptics || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch { /* blocked until the first tap */ }
}

function tone(freq, { at = 0, dur = 0.16, type = 'sine', gain = 0.06, to = null } = {}) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator(), amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noise({ at = 0, dur = 0.12, gain = 0.08, freq = 1400, q = 0.8, type = 'bandpass' } = {}) {
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

const starNotes = [988, 1047, 1175, 1319, 1397, 1568];
let starStep = 0;

const SOUNDS = {
  shoot: () => tone(880, { dur: 0.05, gain: 0.018, to: 520, type: 'triangle' }),
  staple: () => noise({ dur: 0.03, gain: 0.03, freq: 4200, q: 2 }),
  swing: () => noise({ dur: 0.12, gain: 0.05, freq: 1800, q: 0.6 }),
  whoosh: () => noise({ dur: 0.18, gain: 0.04, freq: 900, q: 0.5, type: 'lowpass' }),
  beam: () => tone(1200, { dur: 0.16, gain: 0.03, to: 2400, type: 'sawtooth' }),
  glob: () => tone(320, { dur: 0.12, gain: 0.04, to: 160, type: 'sine' }),
  splash: () => noise({ dur: 0.14, gain: 0.04, freq: 600, q: 1 }),
  hit: () => noise({ dur: 0.05, gain: 0.04, freq: 1100, q: 1 }),
  pop: () => { tone(420, { dur: 0.08, gain: 0.04, to: 880, type: 'triangle' }); noise({ dur: 0.06, gain: 0.03, freq: 2400, q: 1 }); },
  star: () => { tone(starNotes[starStep++ % starNotes.length], { dur: 0.07, gain: 0.022, type: 'square' }); },
  heal: () => [660, 880].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.14, gain: 0.04, type: 'triangle' })),
  crate: () => [523, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.18, gain: 0.05, type: 'triangle' })),
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.22, gain: 0.05, type: 'triangle' })),
  hurt: () => { noise({ dur: 0.18, gain: 0.12, freq: 380, q: 1.2 }); tone(200, { dur: 0.2, gain: 0.06, to: 80, type: 'sawtooth' }); buzz(40); },
  dodge: () => tone(1500, { dur: 0.1, gain: 0.03, to: 2200, type: 'sine' }),
  dead: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, { at: i * 0.16, dur: 0.4, gain: 0.05 })); buzz([40, 60, 80]); },
  clear: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.24, gain: 0.045, type: 'triangle' })),
  victory: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.11, dur: 0.45, gain: 0.05, type: 'triangle' })); buzz([30, 60, 40]); },
  elite: () => [0, 0.22].forEach(at => tone(440, { at, dur: 0.18, gain: 0.05, to: 330, type: 'square' })),
  boss: () => { tone(110, { dur: 0.9, gain: 0.09, to: 55, type: 'sawtooth' }); noise({ dur: 0.7, gain: 0.1, freq: 200, q: 0.7 }); },
  phase: () => { noise({ dur: 0.5, gain: 0.12, freq: 220, q: 0.7 }); tone(130, { dur: 0.6, gain: 0.07, to: 60, type: 'sawtooth' }); buzz(60); },
  spit: () => tone(260, { dur: 0.1, gain: 0.03, to: 140, type: 'sine' }),
  boom: () => { noise({ dur: 0.22, gain: 0.1, freq: 300, q: 0.8 }); tone(90, { dur: 0.2, gain: 0.06, to: 45 }); },
  summon: () => tone(200, { dur: 0.4, gain: 0.05, to: 400, type: 'triangle' }),
  bossdown: () => { noise({ dur: 0.9, gain: 0.14, freq: 260, q: 0.6 }); [262, 392, 523].forEach((f, i) => tone(f, { at: 0.2 + i * 0.12, dur: 0.5, gain: 0.05, type: 'triangle' })); },
  elitedown: () => { noise({ dur: 0.4, gain: 0.1, freq: 400, q: 0.7 }); tone(660, { at: 0.1, dur: 0.3, gain: 0.04, to: 1320, type: 'triangle' }); },
  buy: () => { tone(1320, { dur: 0.07, gain: 0.04, type: 'square' }); tone(1760, { at: 0.06, dur: 0.12, gain: 0.03, type: 'square' }); },
  deny: () => tone(170, { dur: 0.14, gain: 0.05, type: 'square' }),
  select: () => tone(700, { dur: 0.05, gain: 0.025, type: 'triangle' }),
  reroll: () => [600, 760, 900].forEach((f, i) => tone(f, { at: i * 0.04, dur: 0.07, gain: 0.025, type: 'triangle' })),
  right: () => [659, 880, 1175, 1568].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.28, gain: 0.045, type: 'triangle' })),
  wrong: () => tone(440, { dur: 0.3, gain: 0.04, to: 300, type: 'sine' }),
  go: () => [392, 523, 784].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.2, gain: 0.05, type: 'triangle' })),
};

export function play(name) {
  const sound = SOUNDS[name];
  if (!sound) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const gap = GAP[name] || 0;
  if (gap && now - (lastPlayed.get(name) || -1e9) < gap) return;
  lastPlayed.set(name, now);
  sound();
}
