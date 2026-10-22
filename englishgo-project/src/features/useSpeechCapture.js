import { useCallback, useEffect, useRef, useState } from 'react';

const START_TIMEOUT = 25000;
const LISTEN_TIMEOUT = 25000;
const FINISH_TIMEOUT = 4000;

export function useSpeechCapture() {
  const [phase, setPhase] = useState('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const capture = useRef(null), token = useRef(0), timer = useRef(null), finish = useRef(null);
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const cancel = useCallback((update = true) => {
    token.current++;
    clearTimeout(timer.current);
    timer.current = null;
    finish.current = null;
    const recognition = capture.current;
    capture.current = null;
    if (recognition) {
      recognition.onstart = recognition.onresult = recognition.onend = recognition.onerror = null;
      try { recognition.abort(); } catch {}
    }
    if (update) { setPhase('idle'); setInterim(''); setError(''); }
  }, []);

  useEffect(() => () => cancel(false), [cancel]);

  const start = onTranscript => {
    if (!supported || capture.current) return;
    cancel();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    try { recognition = new SR(); }
    catch { setError('麥克風目前無法啟動，可以先聽示範跟讀。'); return; }

    const id = ++token.current;
    let started = false, stopping = false, results = [];
    const current = () => id === token.current;
    const complete = () => {
      if (!current()) return;
      // Interim text can change or disappear; only score confirmed results.
      const transcript = results.filter(row => row.final).map(row => row.text).join(' ').trim();
      const hadInterim = results.some(row => row.text.trim());
      cancel();
      if (transcript) onTranscript(transcript);
      else setError(hadInterim ? '還沒收到完整的辨識結果，請再說一次，或先聽示範跟讀。' : '這次沒有聽到聲音，再試一次，或先聽示範跟讀。');
    };
    const requestFinish = () => {
      if (!current() || stopping) return;
      stopping = true;
      clearTimeout(timer.current);
      setPhase('processing');
      // Some browsers never dispatch onend after stop. Keep confirmed words
      // and release the microphone even when that event does not arrive.
      timer.current = setTimeout(complete, FINISH_TIMEOUT);
      try { recognition.stop(); } catch { complete(); }
    };
    const markStarted = () => {
      if (!current() || started || stopping) return;
      started = true;
      clearTimeout(timer.current);
      setPhase('listening');
      timer.current = setTimeout(requestFinish, LISTEN_TIMEOUT);
    };

    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;
    capture.current = recognition;
    finish.current = requestFinish;
    setPhase('starting');
    recognition.onstart = markStarted;
    recognition.onresult = event => {
      if (!current()) return;
      markStarted();
      // The event contains the current result list, including replacements
      // and removals. Rebuild it to avoid retaining stale partial words.
      results = Array.from(event.results, row => {
        let best = row[0];
        for (let i = 1; i < row.length; i++) if ((row[i].confidence || 0) > (best?.confidence || 0)) best = row[i];
        return { text: best?.transcript || '', final: row.isFinal };
      });
      setInterim(results.map(row => row.text).join(' ').trim());
    };
    recognition.onend = complete;
    recognition.onerror = event => {
      if (!current()) return;
      cancel();
      setError(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? '麥克風尚未獲得允許。請在網址旁的網站設定允許麥克風，再按一次開始。也可以先用跟讀模式。' : event.error === 'audio-capture' ? '找不到可用的麥克風，先聽示範跟讀也可以。' : event.error === 'network' ? '語音辨識暫時連不上，稍後再試，或先聽示範跟讀。' : '這次沒有聽清楚，靠近一點，再試一次。');
    };
    timer.current = setTimeout(() => {
      if (!current()) return;
      cancel();
      setError('麥克風還沒有啟動。請確認瀏覽器的麥克風提示，也可以先聽示範跟讀。');
    }, START_TIMEOUT);
    try { recognition.start(); }
    catch { if (current()) { cancel(); setError('麥克風沒有順利開始，再按一次試試，或先跟讀。'); } }
  };

  return { supported, phase, interim, error, start, stop: () => finish.current?.(), cancel };
}
