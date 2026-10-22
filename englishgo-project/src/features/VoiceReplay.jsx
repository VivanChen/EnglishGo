import { useState } from 'react';
import './voice-replay.css';

export default function VoiceReplay({ clip, audioRef, onBeforePlay, onDemo, onRecord, onDiscard }) {
  const [playing, setPlaying] = useState(false), [error, setError] = useState('');
  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); audio.currentTime = 0; return; }
    setError('');
    onBeforePlay();
    try { Promise.resolve(audio.play()).catch(reason => { if (reason?.name !== 'AbortError' && audioRef.current === audio) setError('錄音暫時無法播放，請再按一次，或重新錄音。'); }); }
    catch { setError('錄音暫時無法播放，請再按一次，或重新錄音。'); }
  };
  return <section className="voice-replay" aria-label="我的錄音">
    <div className="voice-replay-heading"><div><span className="practice-eyebrow">說完了，換自己聽聽看</span><h3>我的聲音</h3></div><span className="voice-replay-duration">{Math.max(1, Math.round(clip.seconds))} 秒錄音</span></div>
    <p>聽聽每個字的發音，再和示範比較。</p>
    <div className="practice-actions"><button type="button" className="practice-primary" onClick={play}>{playing ? '■ 停止回放' : '▶ 聽我的錄音'}</button><button type="button" onClick={onDemo}>🔊 和示範比較</button></div>
    <audio ref={audioRef} src={clip.url} controls preload="metadata" aria-label="我的聲音回放" onPlay={() => { onBeforePlay(); setError(''); setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setError('錄音暫時無法播放，請重新錄一次。'); }} />
    {error && <p role="alert">{error}</p>}
    <div className="voice-replay-footer"><p>錄音只暫存在這一頁；重錄、換題或離開時會清除。</p><div><button type="button" onClick={onRecord}>重新錄音</button><button type="button" onClick={onDiscard}>刪除錄音</button></div></div>
  </section>;
}
