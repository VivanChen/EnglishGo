import { createTownMusic } from './townMusic.js';
const voiceGroups={catHappy:['cathappya','cathappyb'],catCuddle:['catcuddle'],dogHappy:['doghappya','doghappyb'],dogCuddle:['dogcuddle'],rabbitHappy:['rabbithappya','rabbithappyb'],rabbitCuddle:['rabbitcuddle']};
const names = ['step', 'bubbles', 'water', 'towel', 'toy', 'chime', 'success', 'cat', 'dog', 'rustle',...Object.values(voiceGroups).flat()];
const safeFile = file => typeof file === 'string' && /^[a-z]+(?:-[a-f0-9]{12})?\.(mp3|wav)$/.test(file);
export const petVoice = (speciesId,mood='greet') => {
  const animal={'harbor-cat':'cat','sunny-dog':'dog','garden-rabbit':'rabbit'}[speciesId];
  if(!animal)return;
  return mood==='happy'?`${animal}Happy`:mood==='cuddle'?`${animal}Cuddle`:animal==='rabbit'?'rustle':animal;
};
export const voiceMood = (type,phase) => phase==='happy'||['happy','hop','spin'].includes(type)?'happy':['pet','groom','sleep'].includes(type)?'cuddle':['greet','come'].includes(type)?'greet':null;
export function careSound(type, phase) {
  if (type === 'wash') return ['rinse', 'shake'].includes(phase) ? 'water' : phase === 'dry' ? 'towel' : 'bubbles';
  return { feed: 'rustle', play: 'toy', pet: 'rustle', sleep: 'towel', wake: 'rustle', happy: 'success', groom: 'rustle', stretch: 'rustle', hop: 'toy' }[type];
}
export function createTownSounds() {
  let context, music, effectsGain, loading, enabled = false, disposed = false, generation = 0;
  let levels={music:60,effects:80},scene='home',library,loadAudio,currentMusic,musicRequest=0;
  const trackLoads=new Map(),voiceTurns=new Map();
  const activateScene=async()=>{
    const track=library?.scenes?.[scene]||library?.music;
    if(!safeFile(track?.file)||currentMusic===track.file)return;
    const request=++musicRequest;
    try {
      if(!trackLoads.has(track.file))trackLoads.set(track.file,loadAudio(track.file).catch(error=>{trackLoads.delete(track.file);throw error;}));
      const buffer=await trackLoads.get(track.file);
      if(disposed||request!==musicRequest)return;
      trackLoads.delete(track.file);trackLoads.set(track.file,Promise.resolve(buffer));
      while(trackLoads.size>3)trackLoads.delete(trackLoads.keys().next().value);
      currentMusic=track.file;music.load(buffer,track.volume,true);
      if(enabled&&!document.hidden)music.start();
    }catch { /* Keep the previous track if this scene is unavailable. */ }
  };
  const buffers = new Map(), active = new Set(), last = new Map(), controller = new AbortController();
  const stop = () => { for (const source of active) { source.stop(); source.disconnect(); } active.clear(); music?.releaseDuck(); };
  return {
    setScene(next) { if(scene===next)return;scene=next||'home';musicRequest++;if(library)void activateScene(); },
    setLevels(next) {
      for(const name of ['music','effects'])if(Number.isFinite(next?.[name]))levels[name]=Math.max(0,Math.min(100,next[name]));
      music?.setVolume(levels.music/60);if(effectsGain)effectsGain.gain.value=levels.effects/80;
    },
    async start() {
      if (disposed) return false;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      const request = ++generation;
      if (!context) {
        context = new AudioContext();
        music = createTownMusic(context);
        music.setVolume(levels.music/60);
        effectsGain=context.createGain();effectsGain.gain.value=levels.effects/80;effectsGain.connect(context.destination);
      }
      if (!loading) {
        loadAudio = file => fetch(`${import.meta.env.BASE_URL}audio/pet-town/${file}`, { signal: controller.signal })
          .then(r => { if (!r.ok) throw new Error('Audio unavailable'); return r.arrayBuffer(); })
          .then(bytes => context.decodeAudioData(bytes));
        loading = fetch(`${import.meta.env.BASE_URL}audio/pet-town/manifest.json`, { signal: controller.signal })
          .then(r => { if (!r.ok) throw new Error('Audio unavailable'); return r.json(); })
          .then(manifest => {
          library=manifest;const musicLoad=activateScene();
          return Promise.all([musicLoad, ...names.map(name => {
          const file = manifest.files?.[name];
          if (!safeFile(file)) return;
          return loadAudio(file)
            .then(buffer => { if (!disposed) buffers.set(name, buffer); }).catch(() => {});
        })]); }).then(() => { if (!buffers.size) throw new Error('Audio files could not be loaded'); });
        void loading.catch(() => { loading = null; });
      }
      await context.resume();
      if (disposed || request !== generation) return false;
      enabled = context.state === 'running'; if (enabled && !document.hidden) music.start(); return enabled;
    },
    async ready() { if (!loading) throw new Error('Audio files could not be loaded'); await loading; },
    play(name, volume = .35, pan = 0) {
      const group=voiceGroups[name],fallback=name?.startsWith('rabbit')?'rustle':name?.startsWith('cat')?'cat':'dog';
      const choices=group?.filter(key=>buffers.has(key));
      const sound=group?(choices.length?choices[(voiceTurns.get(name)||0)%choices.length]:fallback):name;
      if (!enabled || disposed || !levels.effects || document.hidden || context?.state !== 'running' || !buffers.has(sound)) return false;
      const now = context.currentTime, gap = group ? 2 : name === 'step' ? .22 : .16;
      if (now - (last.get(name) ?? -Infinity) < gap || active.size >= 4) return false;
      last.set(name, now);if(group)voiceTurns.set(name,(voiceTurns.get(name)||0)+1);
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers.get(sound); gain.gain.value = Math.max(0, Math.min(.65, volume));
      const panner = context.createStereoPanner?.();
      source.connect(gain);
      if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); gain.connect(panner); panner.connect(effectsGain); }
      else gain.connect(effectsGain);
      active.add(source);
      source.onended = () => { active.delete(source); source.disconnect(); gain.disconnect(); panner?.disconnect(); };
      if(!['step','chime'].includes(name) && volume>0)music.duck(source.buffer.duration);
      source.start(); return true;
    },
    stop,
    pause() { enabled = false; generation++; stop(); music?.pause(); if (context?.state === 'running') void context.suspend().catch(() => {}); },
    dispose() { disposed = true; enabled = false; generation++; controller.abort();musicRequest++;trackLoads.clear(); stop(); music?.dispose(); effectsGain?.disconnect(); buffers.clear(); if (context && context.state !== 'closed') void context.close().catch(() => {}); },
  };
}
