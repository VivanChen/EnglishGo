import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 30;
const release = stream => stream?.getTracks().forEach(track => track.stop());
// Level 0..1 from the microphone's loudness. Below this peak, a whole recording is treated as near silence.
export const QUIET_PEAK = 0.06;

// Reads loudness straight from the live stream so the child sees the microphone hearing them.
// Returns null where Web Audio is missing; recording itself never depends on it.
function createLevelMeter(stream, onLevel) {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) return null;
  try {
    const context = new Context(), source = context.createMediaStreamSource(stream), analyser = context.createAnalyser();
    analyser.fftSize = 1024; source.connect(analyser);
    context.resume?.()?.catch?.(() => {});
    const data = new Uint8Array(analyser.fftSize);
    let peak = 0;
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) { const x = (value - 128) / 128; sum += x * x; }
      const level = Math.min(1, Math.sqrt(sum / data.length) * 5);
      peak = Math.max(peak, level); onLevel(level, peak);
    }, 100);
    return { peak: () => peak, stop: () => { clearInterval(timer); try { source.disconnect(); } catch {} try { context.close?.()?.catch?.(() => {}); } catch {} } };
  } catch { return null; }
}

export function useVoiceRecording() {
  const supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const [phase, setPhase] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState(null);
  const [error, setError] = useState('');
  // level: current loudness; heard: whether this take has reached speaking volume (null without Web Audio).
  const [meter, setMeter] = useState({ level: 0, heard: null });
  const session = useRef(null), url = useRef(null);

  const cancel = useCallback((update = true) => {
    const current = session.current;
    session.current = null;
    if (current) {
      clearTimeout(current.timeout); clearInterval(current.clock); current.meter?.stop();
      const recorder = current.recorder;
      if (recorder) {
        recorder.onstart = recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch {}
      }
      release(current.stream);
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    if (update) { setPhase('idle'); setSeconds(0); setClip(null); setError(''); setMeter({ level: 0, heard: null }); }
  }, []);
  useEffect(() => () => cancel(false), [cancel]);

  const stop = useCallback(() => {
    const current = session.current;
    if (!current || current.stopping || current.started === null) return;
    current.stopping = true;
    current.duration = Math.min(MAX_SECONDS, Math.max(0, (performance.now() - current.started) / 1000));
    clearTimeout(current.timeout); clearInterval(current.clock); current.meter?.stop();
    setMeter(value => ({ ...value, level: 0 }));
    setPhase('processing');
    // Stop tracks immediately; wait for the final dataavailable event before
    // building the Blob. A missing stop event must not leave the UI locked.
    current.timeout = setTimeout(() => current.fail('錄音沒有順利完成，請重新錄一次。'), 4000);
    try { if (current.recorder.state !== 'inactive') current.recorder.stop(); }
    catch { current.fail('錄音沒有順利完成，請重新錄一次。'); }
    release(current.stream);
    current.notifyStop();
  }, []);

  const start = (onReady, onStop) => {
    if (!supported || session.current) return;
    cancel();
    const current = { recorder: null, stream: null, chunks: [], onStop, started: null, stopping: false };
    current.notifyStop = () => { const callback = current.onStop; current.onStop = null; callback?.(); };
    session.current = current;
    const live = () => session.current === current;
    current.fail = message => {
      if (!live()) return;
      cancel(); setError(message); current.notifyStop();
    };
    setPhase('starting');
    current.timeout = setTimeout(() => current.fail('還沒取得麥克風。請確認瀏覽器的允許提示，再按一次開始。'), 25000);
    let pending;
    try { pending = navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { current.fail('錄音目前無法啟動，可以先聽示範跟讀，稍後再試。'); return; }
    Promise.resolve(pending).then(stream => {
      if (!live()) { release(stream); return; }
      current.stream = stream;
      current.meter = createLevelMeter(stream, (level, peak) => { if (live() && current.started !== null && !current.stopping) setMeter({ level, heard: peak >= QUIET_PEAK }); });
      // Let the browser choose its supported container (including Safari).
      const recorder = new MediaRecorder(stream);
      current.recorder = recorder;
      recorder.ondataavailable = event => { if (live() && event.data?.size) current.chunks.push(event.data); };
      recorder.onerror = () => current.fail('這次錄音中斷了，請確認麥克風後再試一次。');
      recorder.onstart = () => {
        if (!live()) return;
        clearTimeout(current.timeout);
        current.started = performance.now();
        setMeter({ level: 0, heard: current.meter ? false : null });
        setPhase('listening');
        current.clock = setInterval(() => { if (live()) setSeconds(Math.min(MAX_SECONDS, Math.floor((performance.now() - current.started) / 1000))); }, 250);
        current.timeout = setTimeout(stop, MAX_SECONDS * 1000);
        onReady?.();
      };
      recorder.onstop = () => {
        if (!live()) return;
        clearTimeout(current.timeout); clearInterval(current.clock); current.meter?.stop();
        release(stream);
        const peak = current.meter ? current.meter.peak() : null;
        const duration = current.duration ?? (current.started === null ? 0 : Math.min(MAX_SECONDS, Math.max(0, (performance.now() - current.started) / 1000)));
        const blob = new Blob(current.chunks, { type: recorder.mimeType || current.chunks[0]?.type || '' });
        session.current = null;
        recorder.onstart = recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
        setPhase('idle');
        if (blob.size) {
          try { url.current = URL.createObjectURL(blob); setClip({ url: url.current, seconds: duration, blob, quiet: peak === null ? null : peak < QUIET_PEAK }); }
          catch { setError('這個瀏覽器暫時無法準備錄音回放，請重新錄一次。'); }
        } else setError('這次沒有留下可播放的錄音，請重新錄一次。');
        current.notifyStop();
      };
      recorder.start();
    }).catch(reason => {
      current.fail(reason?.name === 'NotAllowedError' || reason?.name === 'SecurityError'
        ? '麥克風尚未獲得允許。請在網址旁的網站設定允許麥克風，再按一次開始。'
        : reason?.name === 'NotFoundError' || reason?.name === 'NotReadableError'
          ? '找不到可用的麥克風，或麥克風正被其他程式使用。請確認後再試一次。'
          : '錄音目前無法啟動，可以先聽示範跟讀，稍後再試。');
    });
  };

  return { supported, phase, seconds, clip, error, start, stop, cancel, level: meter.level, heard: meter.heard, maxSeconds: MAX_SECONDS };
}
