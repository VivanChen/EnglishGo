import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 30;
const release = stream => stream?.getTracks().forEach(track => track.stop());

export function useVoiceRecording() {
  const supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const [phase, setPhase] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState(null);
  const [error, setError] = useState('');
  const session = useRef(null), url = useRef(null);

  const cancel = useCallback((update = true) => {
    const current = session.current;
    session.current = null;
    if (current) {
      clearTimeout(current.timeout); clearInterval(current.clock);
      const recorder = current.recorder;
      if (recorder) {
        recorder.onstart = recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch {}
      }
      release(current.stream);
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    if (update) { setPhase('idle'); setSeconds(0); setClip(null); setError(''); }
  }, []);
  useEffect(() => () => cancel(false), [cancel]);

  const stop = useCallback(() => {
    const current = session.current;
    if (!current || current.stopping || current.started === null) return;
    current.stopping = true;
    current.duration = Math.min(MAX_SECONDS, Math.max(0, (performance.now() - current.started) / 1000));
    clearTimeout(current.timeout); clearInterval(current.clock);
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
      // Let the browser choose its supported container (including Safari).
      const recorder = new MediaRecorder(stream);
      current.recorder = recorder;
      recorder.ondataavailable = event => { if (live() && event.data?.size) current.chunks.push(event.data); };
      recorder.onerror = () => current.fail('這次錄音中斷了，請確認麥克風後再試一次。');
      recorder.onstart = () => {
        if (!live()) return;
        clearTimeout(current.timeout);
        current.started = performance.now();
        setPhase('listening');
        current.clock = setInterval(() => { if (live()) setSeconds(Math.min(MAX_SECONDS, Math.floor((performance.now() - current.started) / 1000))); }, 250);
        current.timeout = setTimeout(stop, MAX_SECONDS * 1000);
        onReady?.();
      };
      recorder.onstop = () => {
        if (!live()) return;
        clearTimeout(current.timeout); clearInterval(current.clock);
        release(stream);
        const duration = current.duration ?? (current.started === null ? 0 : Math.min(MAX_SECONDS, Math.max(0, (performance.now() - current.started) / 1000)));
        const blob = new Blob(current.chunks, { type: recorder.mimeType || current.chunks[0]?.type || '' });
        session.current = null;
        recorder.onstart = recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
        setPhase('idle');
        if (blob.size) {
          try { url.current = URL.createObjectURL(blob); setClip({ url: url.current, seconds: duration, blob }); }
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

  return { supported, phase, seconds, clip, error, start, stop, cancel, maxSeconds: MAX_SECONDS };
}
