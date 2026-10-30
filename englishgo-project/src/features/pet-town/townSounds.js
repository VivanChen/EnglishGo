const names = ['step', 'bubbles', 'water', 'towel', 'toy', 'chime', 'success', 'cat', 'dog', 'rustle'];
export function careSound(type, phase) {
  if (type === 'wash') return ['rinse', 'shake'].includes(phase) ? 'water' : phase === 'dry' ? 'towel' : 'bubbles';
  return { feed: 'rustle', play: 'toy', pet: 'rustle', sleep: 'towel', wake: 'rustle', happy: 'success', groom: 'rustle', stretch: 'rustle', hop: 'toy' }[type];
}
export function createTownSounds() {
  let context, enabled = false, disposed = false, generation = 0;
  const buffers = new Map(), active = new Set(), last = new Map(), controller = new AbortController();
  const stop = () => { for (const source of active) { source.stop(); source.disconnect(); } active.clear(); };
  return {
    async start() {
      if (disposed) return false;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      const request = ++generation;
      if (!context) {
        context = new AudioContext();
        void fetch(`${import.meta.env.BASE_URL}audio/pet-town/manifest.json`, { signal: controller.signal })
          .then(r => { if (!r.ok) throw new Error('Audio unavailable'); return r.json(); })
          .then(manifest => Promise.all(names.map(name => {
          const file = manifest.files?.[name];
          if (!file || !/^[a-z]+\.(mp3|wav)$/.test(file)) return;
          return fetch(`${import.meta.env.BASE_URL}audio/pet-town/${file}`, { signal: controller.signal })
            .then(r => { if (!r.ok) throw new Error('Audio unavailable'); return r.arrayBuffer(); })
            .then(bytes => context.decodeAudioData(bytes))
            .then(buffer => { if (!disposed) buffers.set(name, buffer); }).catch(() => {});
        }))).catch(() => {});
      }
      await context.resume();
      if (disposed || request !== generation) return false;
      enabled = context.state === 'running'; return enabled;
    },
    play(name, volume = .35) {
      if (!enabled || disposed || document.hidden || context?.state !== 'running' || !buffers.has(name)) return false;
      const now = context.currentTime, gap = name === 'step' ? .22 : .16;
      if (now - (last.get(name) ?? -Infinity) < gap || active.size >= 4) return false;
      last.set(name, now);
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers.get(name); gain.gain.value = Math.max(0, Math.min(.65, volume));
      source.connect(gain); gain.connect(context.destination); active.add(source);
      source.onended = () => { active.delete(source); source.disconnect(); gain.disconnect(); };
      source.start(); return true;
    },
    stop,
    pause() { enabled = false; generation++; stop(); if (context?.state === 'running') void context.suspend().catch(() => {}); },
    dispose() { disposed = true; enabled = false; generation++; controller.abort(); stop(); buffers.clear(); if (context && context.state !== 'closed') void context.close().catch(() => {}); },
  };
}
