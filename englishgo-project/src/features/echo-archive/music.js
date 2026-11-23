// Background music for Echo Archive: one track per act, looped while a run
// is on screen. The tracks were not written to loop, so each pass fades into
// the next over a few seconds instead of jumping back to the start.
import { sharedAudioContext } from './sound.js';

const TRACKS = { 1: 'act1', 2: 'act2', 3: 'act3', 4: 'act4', drowned: 'drowned', observatory: 'observatory' };
const LEVEL = 0.3;        // music sits well under effects and speech
const DUCKED = 0.35;      // share of LEVEL kept while a word is being read
const FADE_IN = 2.5;      // seconds
const FADE_OUT = 1.2;
const OVERLAP = 4;        // seconds each pass crossfades into the next

export const trackUrl = act => (TRACKS[act] ? `/audio/echo-archive/${TRACKS[act]}.mp3` : null);

let enabled = true;
let wanted = null;        // act whose track should play, or null
let ducked = false;
let master = null;        // GainNode shared by every pass
let session = null;       // { act, gain, sources, timer }
let listening = false;
const buffers = new Map(); // url -> Promise<AudioBuffer>

const quiet = () => typeof document !== 'undefined' && document.documentElement.dataset.egQuiet === 'true';

function context() {
  const ac = sharedAudioContext();
  if (!ac) return null;
  if (!master) {
    master = ac.createGain();
    master.gain.value = LEVEL * (ducked ? DUCKED : 1);
    master.connect(ac.destination);
  }
  return ac;
}

function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // Mobile browsers start audio only from a tap; resume on the next one.
  const unlock = () => { const ac = sharedAudioContext(); if (ac?.state === 'suspended') ac.resume?.(); };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    const ac = sharedAudioContext();
    if (!ac || !session) return;
    if (document.hidden) ac.suspend?.(); else ac.resume?.();
  });
  // The app's own quiet switch silences the music as well as the effects.
  if (typeof MutationObserver === 'function') {
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['data-eg-quiet'] });
  }
}

function load(url) {
  if (!buffers.has(url)) {
    const ac = context();
    const promise = fetch(url)
      .then(res => { if (!res.ok) throw new Error(`music ${res.status}`); return res.arrayBuffer(); })
      .then(data => ac.decodeAudioData(data));
    promise.catch(() => buffers.delete(url));
    buffers.set(url, promise);
    // Keep at most the current and the previous act's track in memory.
    while (buffers.size > 2) buffers.delete(buffers.keys().next().value);
  }
  return buffers.get(url);
}

function playPass(current, buffer, when, first) {
  const ac = context();
  if (!ac || session !== current) return;
  const src = ac.createBufferSource();
  const amp = ac.createGain();
  const length = buffer.duration;
  const fadeIn = first ? FADE_IN : Math.min(OVERLAP, length / 3);
  const fadeOut = Math.min(OVERLAP, length / 3);
  src.buffer = buffer;
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(1, when + fadeIn);
  amp.gain.setValueAtTime(1, when + length - fadeOut);
  amp.gain.linearRampToValueAtTime(0, when + length);
  src.connect(amp).connect(current.gain);
  src.start(when);
  src.onended = () => { current.sources.delete(src); try { amp.disconnect(); } catch { /* already gone */ } };
  current.sources.add(src);
  const next = when + length - fadeOut;
  current.timer = window.setTimeout(() => playPass(current, buffer, Math.max(next, ac.currentTime + 0.05), false), Math.max(0, (next - ac.currentTime - 1) * 1000));
}

function stopSession(fade = FADE_OUT) {
  const old = session;
  session = null;
  if (!old) return;
  window.clearTimeout(old.timer);
  const ac = sharedAudioContext();
  if (!ac) return;
  const now = ac.currentTime;
  old.gain.gain.cancelScheduledValues(now);
  old.gain.gain.setValueAtTime(old.gain.gain.value, now);
  old.gain.gain.linearRampToValueAtTime(0, now + fade);
  old.sources.forEach(src => { try { src.stop(now + fade + 0.05); } catch { /* not started */ } });
  window.setTimeout(() => { try { old.gain.disconnect(); } catch { /* already gone */ } }, (fade + 0.2) * 1000);
}

function apply() {
  const act = enabled && !quiet() ? wanted : null;
  const url = trackUrl(act);
  if ((session?.act ?? null) === (url ? act : null)) return;
  stopSession();
  if (!url) return;
  const ac = context();
  if (!ac) return;
  listen();
  const gain = ac.createGain();
  gain.connect(master);
  const current = { act, gain, sources: new Set(), timer: 0 };
  session = current;
  load(url).then(buffer => {
    if (session !== current) return;
    if (ac.state === 'suspended') ac.resume?.();
    playPass(current, buffer, ac.currentTime + 0.05, true);
  }).catch(() => { if (session === current) session = null; });
}

export function setMusicEnabled(value) { enabled = Boolean(value); apply(); }

// The act whose music should play now, or null for silence.
export function setMusicAct(act) { wanted = act || null; apply(); }

// Lower the music while a word is read aloud, so the voice stays clear.
export function duckMusic(value) {
  ducked = Boolean(value);
  const ac = sharedAudioContext();
  if (!ac || !master) return;
  const now = ac.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(LEVEL * (ducked ? DUCKED : 1), now + 0.3);
}
