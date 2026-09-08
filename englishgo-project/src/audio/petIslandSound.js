// Short synthesized effects; no downloads and no changes to speech playback.
export function createIslandSound(){
  let context,master;
  const nodes=new Set();
  const silent=()=>typeof document==='undefined'||document.hidden||document.documentElement.dataset.egQuiet==='true';
  return {
    unlock(){try{if(silent())return;const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;context??=new Audio();if(!master){master=context.createGain();master.gain.value=.12;master.connect(context.destination)}context.resume()?.catch(()=>{})}catch{/* Audio is optional on unsupported devices. */}},
    play(kind){if(!context||context.state!=='running'||silent())return;
      const notes=({dice:[180,260,200,330],buy:[392,494,587],upgrade:[392,523,659,784],event:[330,440,660],card:[523,784], 'rent-in':[660,880], 'rent-out':[294,220],win:[523,659,784,1046],step:[280]})[kind]||[440,550];
      notes.forEach((frequency,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.075;oscillator.type=kind==='dice'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.65,at+.009);gain.gain.exponentialRampToValueAtTime(.001,at+.13);oscillator.connect(gain);gain.connect(master);nodes.add(oscillator);oscillator.onended=()=>{nodes.delete(oscillator);oscillator.disconnect();gain.disconnect()};oscillator.start(at);oscillator.stop(at+.15)});
    },
    stop(){for(const node of nodes){try{node.stop()}catch{}}nodes.clear()},
    dispose(){this.stop();context?.close()?.catch(()=>{});context=undefined;master=undefined},
  };
}
