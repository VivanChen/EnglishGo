import { useEffect, useRef, useState } from 'react';

export function storyWords(text) {
  return Array.from(text.matchAll(/\S+/g), match => ({ text: match[0], start: match.index, end: match.index + match[0].length }));
}

export function wordAtBoundary(words, charIndex) {
  return words.findIndex(word => charIndex >= word.start && charIndex < word.end);
}

// Cloud audio supplies playback time, not forced alignment. Weighting by word length
// gives an approximate reading guide; native speech word boundaries take precedence.
export function wordAtProgress(words, currentTime, duration) {
  if (!(duration > 0) || !Number.isFinite(duration) || !words.length) return -1;
  const weights = words.map(word => Math.max(2, word.text.replace(/[^a-z]/gi, '').length) + (/[,.!?]$/.test(word.text) ? 2 : 0));
  const position = Math.max(0, Math.min(1, currentTime / duration)) * weights.reduce((a, b) => a + b, 0);
  let sum = 0;
  for (let i = 0; i < words.length; i++) { sum += weights[i]; if (position < sum) return i; }
  return words.length - 1;
}

export function usePictureBookNarration(speak, stopSpeech) {
  const [state, setState] = useState({ status: 'idle', word: -1, error: '', approximate: false });
  const session = useRef(0), pending = useRef(null), mounted = useRef(true);
  function clearPending() { clearTimeout(pending.current); pending.current = null; }
  function stop() {
    session.current++; clearPending(); stopSpeech();
    if (mounted.current) setState({ status: 'idle', word: -1, error: '', approximate: false });
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; session.current++; clearPending(); stopSpeech(); };
  }, [stopSpeech]);
  function start(text, { offset = 0, onFinish, audioUrl, rate = .8 } = {}) {
    stop();
    const run = session.current, words = storyWords(text);
    let exact = false, finished = false;
    const valid = () => mounted.current && session.current === run;
    const fail = message => {
      if (!valid()) return;
      session.current++; clearPending(); stopSpeech();
      setState({ status: 'idle', word: -1, error: message, approximate: false });
    };
    setState({ status: 'loading', word: -1, error: '', approximate: false });
    pending.current = setTimeout(() => fail('語音準備時間較久，請再按一次朗讀。你也可以點單字試聽。'), 20000);
    try {
      const utterance = speak(text, 'en-US', rate, {
        ...(audioUrl ? { audioUrl } : {}),
        trackWords: true,
        onstart: () => { if (!valid()) return; clearPending(); setState(s => ({ ...s, status: 'playing', word: offset })); },
        onboundary: event => {
          if (!valid() || (event.name && event.name !== 'word')) return;
          const word = wordAtBoundary(words, event.charIndex);
          if (word < 0) return;
          exact = true; clearPending(); setState(s => s.status === 'paused' ? s : { ...s, status: 'playing', word: word + offset, approximate: false });
        },
        onprogress: event => {
          if (!valid() || exact) return;
          const word = wordAtProgress(words, event.currentTime, event.duration);
          if (word >= 0) setState(s => s.status === 'playing' ? { ...s, word: word + offset, approximate: true } : s);
        },
        onend: () => {
          if (!valid() || finished) return;
          finished = true;
          clearPending(); setState({ status: 'idle', word: -1, error: '', approximate: false });
          if (onFinish) pending.current = setTimeout(() => { if (valid()) onFinish(); }, 800);
        },
        oncancel: () => { if (valid()) { session.current++; clearPending(); setState({ status: 'idle', word: -1, error: '', approximate: false }); } },
        onerror: () => fail('這次朗讀沒有播放成功，請再試一次。'),
      });
      if (!utterance) fail('這個瀏覽器目前無法朗讀，仍可看圖閱讀與完成任務。');
    } catch { fail('這次朗讀沒有播放成功，請再試一次。'); }
  }
  function pause() {
    if (state.status !== 'playing') return;
    window.speechSynthesis?.pause?.(); setState(s => ({ ...s, status: 'paused' }));
  }
  function resume() {
    if (state.status !== 'paused') return;
    window.speechSynthesis?.resume?.(); setState(s => ({ ...s, status: 'playing' }));
  }
  return { ...state, start, stop, pause, resume };
}
