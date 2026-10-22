import { useEffect, useRef, useState } from 'react';

export default function SpeakingPhrases({ phrases, sentenceText, playing, playbackError, onPlay, onStop, onPlaySentence, onComplete }) {
  const [step, setStep] = useState(null);
  const heading = useRef(null), startButton = useRef(null), wasStarted = useRef(false);
  const done = step === phrases.length;
  const isPlaying = step !== null && playing?.label === `第 ${step + 1} 段`;

  useEffect(() => {
    if (step !== null) {
      wasStarted.current = true;
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest('.speaking-guided')?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    } else if (wasStarted.current) startButton.current?.focus({ preventScroll: true });
  }, [step]);

  const playStep = index => { setStep(index); onPlay(phrases[index], .65, `第 ${index + 1} 段`); };
  const advance = () => {
    if (step + 1 < phrases.length) playStep(step + 1);
    else { onStop(); setStep(phrases.length); }
  };
  const exit = () => { onStop(); setStep(null); };

  return <section className="speaking-phrases" aria-label="分段聽說">
    <h3>分小段，慢慢跟讀</h3>
    {step === null ? <>
      <p>一次聽一段，留時間自己唸；準備好再前進，不用開麥克風。</p>
      <button ref={startButton} type="button" className="speaking-guided-start" onClick={() => playStep(0)}>帶我逐段跟讀 →</button>
      <div className="speaking-phrase-buttons">{phrases.map((phrase, index) => <button type="button" key={index}
        aria-pressed={playing?.label === `第 ${index + 1} 段`} onClick={() => onPlay(phrase, .65, `第 ${index + 1} 段`)} aria-label={`聽第 ${index + 1} 段：${phrase}`}>
        <span aria-hidden="true">♫</span><span lang="en">{phrase}</span>
      </button>)}</div>
    </> : <div className="speaking-guided">
      <div className="speaking-guided-toolbar"><span>{done ? '接著練整句' : `第 ${step + 1} / ${phrases.length} 段`}</span><button type="button" onClick={exit}>結束分段</button></div>
      <progress max={phrases.length} value={step} aria-label="分段跟讀進度" />
      <h4 ref={heading} tabIndex={-1} lang={done ? 'zh-Hant' : 'en'}>{done ? '把小段連起來，再說一次整句。' : phrases[step]}</h4>
      {done ? <>
        <p className="speaking-guided-sentence" lang="en">{sentenceText}</p>
        <p>分段練好了！接著唸一次完整例句，再記下今天的練習。</p>
        <div className="practice-actions"><button type="button" onClick={playing ? onStop : onPlaySentence}>{playing ? '■ 停止示範' : '🔊 聽完整句'}</button><button type="button" onClick={() => playStep(0)}>再練分段</button></div>
        <button type="button" className="practice-primary" onClick={onComplete}>整句也跟讀過了，繼續 →</button>
        <p className="practice-save-note">會記為自行跟讀；想看看辨識結果，也可以使用下方的麥克風。</p>
      </> : <>
        <p role="status">{isPlaying ? '先聽這一段，聽完換你唸。' : playing ? '正在聽其他示範；想回來跟讀，可以再聽這段。' : playbackError ? '示範暫時無法播放，可以再聽一次，或照著文字跟讀。' : '換你跟著唸，準備好再前進。'}</p>
        <div className="practice-actions"><button type="button" disabled={step === 0} onClick={() => playStep(step - 1)}>← 上一段</button>
          <button type="button" onClick={playing ? onStop : () => onPlay(phrases[step], .65, `第 ${step + 1} 段`)}>{playing ? (isPlaying ? '■ 停止這段' : '■ 停止示範') : '再聽這段'}</button>
          <button type="button" className="practice-primary" onClick={advance}>{step + 1 === phrases.length ? '這段練好了，接回整句 →' : '這段練好了，下一段 →'}</button></div>
      </>}
    </div>}
  </section>;
}
