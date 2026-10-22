import { useEffect, useRef, useState } from 'react';
import './voice-replay.css';

const time = value => `0:${String(Math.floor(value)).padStart(2, '0')}`;
export default function VoiceReplay({ clip, audioRef, onBeforePlay, onDemo, onRecord, onDiscard }) {
  const [playing, setPlaying] = useState(false), [error, setError] = useState('');
  const recordedSeconds = Number.isFinite(clip.seconds) && clip.seconds > 0 ? Math.min(30, clip.seconds) : 1;
  const duration = Number.isFinite(clip.seconds) ? Math.max(1, Math.min(30, Math.round(clip.seconds))) : 0;
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef({ elapsed: 0, started: null });
  const updateTime = () => {
    const current = clock.current;
    const value = current.elapsed + (current.started === null ? 0 : (performance.now() - current.started) / 1000);
    setElapsed(Math.min(duration, value));
    return value;
  };
  const freeze = () => { clock.current.elapsed = updateTime(); clock.current.started = null; };
  const reset = () => { clock.current = { elapsed: 0, started: null }; setElapsed(0); };
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      // A corrupt duration must not leave the player running for hours either.
      if (updateTime() >= recordedSeconds + .35) {
        audioRef.current?.pause();
        clock.current = { elapsed: duration, started: null };
        setElapsed(duration); setPlaying(false);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [playing, duration, recordedSeconds]);
  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); audio.currentTime = 0; reset(); return; }
    audio.currentTime = 0; reset();
    setError('');
    onBeforePlay();
    try { Promise.resolve(audio.play()).catch(reason => { if (reason?.name !== 'AbortError' && audioRef.current === audio) setError('錄音暫時無法播放，請再按一次，或重新錄音。'); }); }
    catch { setError('錄音暫時無法播放，請再按一次，或重新錄音。'); }
  };
  return <section className="voice-replay" aria-label="我的錄音">
    <div className="voice-replay-heading"><div><span className="practice-eyebrow">說完了，換自己聽聽看</span><h3>我的聲音</h3></div><span className="voice-replay-duration">{Math.max(1, Math.round(duration))} 秒錄音</span></div>
    <p>聽聽每個字的發音，再和示範比較。</p>
    <div className="practice-actions"><button type="button" className="practice-primary" onClick={play}>{playing ? '■ 停止回放' : '▶ 聽我的錄音'}</button><button type="button" onClick={onDemo}>🔊 和示範比較</button></div>
    {/* Some Android recordings expose absolute timestamps or Infinity as their
        media duration. Never feed those values into the visible player. */}
    <div className="voice-replay-progress"><span aria-label="錄音回放時間">{time(elapsed)} / {time(duration)}</span><progress max={duration || 1} value={elapsed} aria-label="錄音回放進度" aria-valuetext={`${time(elapsed)} / ${time(duration)}`} /></div>
    <audio ref={audioRef} src={clip.url} preload="metadata" aria-hidden="true" onPlay={() => { onBeforePlay(); setError(''); setPlaying(true); }} onPlaying={() => { freeze(); clock.current.started = performance.now(); }} onWaiting={freeze} onPause={() => { freeze(); setPlaying(false); }} onSeeked={() => { if (audioRef.current?.currentTime === 0) { reset(); if (!audioRef.current.paused) clock.current.started = performance.now(); } }} onEnded={() => { clock.current = { elapsed: duration, started: null }; setElapsed(duration); setPlaying(false); }} onError={() => { freeze(); setPlaying(false); setError('錄音暫時無法播放，請重新錄一次。'); }} />
    {error && <p role="alert">{error}</p>}
    <div className="voice-replay-footer"><p>回放用的錄音暫存在本頁；重錄、換題或離開時會清除。</p><div><button type="button" onClick={onRecord}>重新錄音</button><button type="button" onClick={onDiscard}>刪除錄音</button></div></div>
  </section>;
}
