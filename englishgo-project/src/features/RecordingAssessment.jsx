import { useEffect, useRef, useState } from 'react';
import { assessRecording } from './recordingAssessmentService.js';
import { serviceErrorMessage } from '../lib/serviceErrors.js';
import { recordingFeedback } from './recordingFeedback.js';
import SpeechHighlight from '../components/SpeechHighlight.jsx';

export default function RecordingAssessment({ clip, apiKey, autoCheck, target, comparison, threshold, onOpenSettings, onBeforeAnalyze, onResult, onRecord, onNext, nextLabel, onListen, onReadTip, playing, playbackError, onCompare, onSelfCheck, quiet = false, children }) {
  const [report, setReport] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(!!autoCheck && !!apiKey?.trim());
  const pending = useRef(null), heading = useRef(null), latest = useRef(null);
  const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); };
  const analyze = async () => {
    if (pending.current) return;
    if (!apiKey?.trim()) { setBusy(false); return; }
    onBeforeAnalyze();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(null); setReport(null);
    try {
      const result = await assessRecording({ blob: clip.blob, apiKey, signal: controller.signal });
      if (controller.signal.aborted) return;
      setReport(result);
      if (result.speechDetected) onResult(result.transcript);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      if (pending.current === controller) {
        pending.current = null; setBusy(false);
      }
    }
  };
  latest.current = analyze;
  useEffect(() => {
    let disposed = false;
    heading.current?.focus({ preventScroll: true });
    // Defer until mount is committed so StrictMode cannot upload twice.
    // autoCheck is captured when the child presses "record and check".
    if (autoCheck) Promise.resolve().then(() => { if (!disposed) latest.current(); });
    return () => { disposed = true; pending.current?.abort(); pending.current = null; };
  }, [clip, autoCheck]);
  const feedback = report?.speechDetected ? recordingFeedback(report, comparison, target, threshold) : null;
  const readyToContinue = feedback?.readyToContinue;
  const focusLabel = feedback?.focus.trim().split(/\s+/).length === 1 ? '聽這個字' : feedback?.focus === target ? '慢慢聽整句' : '聽這一段';
  // Without a key the learner checks themselves: demo and own take back to back, then a judgement.
  const selfMode = !apiKey?.trim() && !!onSelfCheck;
  const comparing = playing?.label === '對照聽';
  const title = busy ? '正在聽你剛剛說的…' : feedback?.title || (report?.speechDetected === false ? '這次還沒聽清楚' : error ? '小幫手暫時連不上' : selfMode ? quiet ? '聲音有點小喔' : '錄好了！和示範比一比' : '錄好了，聽聽自己的聲音！');
  return <section className="recording-assessment" aria-label="這次錄音的小提示" aria-busy={busy}>
    <h3 ref={heading} tabIndex={-1} aria-live="polite">{title}</h3>
    {busy ? <p role="status">等一下，小提示就來了。</p> : feedback ? <>
      <p className="recording-child-tip">{feedback.tip}</p>
      <div className="practice-actions recording-tip-actions">
        <button type="button" onClick={() => onReadTip(`${feedback.title}${feedback.tip}`)}>{playing?.label === '小提示' ? '■ 停止小提示' : '🔊 聽小提示'}</button>
        {!readyToContinue && <button type="button" className="recording-focus-play" aria-label={playing?.label === '跟著唸' ? '停止跟讀' : `${focusLabel}：${feedback.focus}`} onClick={() => onListen(feedback.focus, feedback.wordOffset)}>
          <span>{playing?.label === '跟著唸' ? '■ 停止跟讀' : `♫ ${focusLabel}`}</span>
          {feedback.focus !== target && <b lang="en"><SpeechHighlight text={feedback.focus} playback={playing?.label === '跟著唸' ? playing : null} /></b>}
        </button>}
      </div>
    </> : selfMode ? <div className="recording-self-check">
      <p className="recording-child-tip">{quiet ? '這段錄音很安靜，靠近麥克風、大聲一點再錄一次會更清楚。' : '先聽示範，再聽自己的錄音。聽起來像嗎？'}</p>
      {onCompare && <button type="button" className="recording-compare" aria-pressed={comparing} onClick={onCompare}>{comparing ? '■ 停止對照' : '▶ 示範 → 我的錄音，輪流聽'}</button>}
    </div> : <p role={error ? 'alert' : undefined}>{report?.speechDetected === false ? '靠近麥克風一點，再說一次吧。' : error ? '錄音還在，可以再檢查一次。' : apiKey?.trim() ? quiet ? '這段錄音很安靜，可以靠近麥克風再錄一次，或直接檢查。' : '可以用剛剛這段錄音檢查。' : '請大人開啟語音小幫手，就能幫你檢查。'}</p>}
    {playbackError && <p role="status">示範暫時無法播放，可以稍後再試。</p>}
    {children}
    {selfMode ? <div className="practice-actions recording-next-actions">
      <button type="button" className={quiet ? undefined : 'practice-primary'} onClick={() => { cancel(); onSelfCheck(); }}>👍 很像了，{nextLabel === '完成' ? '完成' : '下一個'}</button>
      <button type="button" className={quiet ? 'practice-primary' : undefined} onClick={() => onRecord(null)}>🎤 再說一次</button>
      <button type="button" className="recording-skip" onClick={() => { cancel(); onNext(); }}>先跳過這題 →</button>
    </div> : <div className="practice-actions recording-next-actions">
      <button type="button" className={readyToContinue ? undefined : 'practice-primary'} onClick={() => onRecord(feedback)}>🎤 再說一次</button>
      <button type="button" className={readyToContinue ? 'practice-primary' : undefined} onClick={() => { cancel(); onNext(); }}>{feedback ? nextLabel : '先跳過這題 →'}</button>
    </div>}
    <div className="practice-actions recording-recovery-actions">
      {!busy && !report && apiKey?.trim() && <button type="button" onClick={analyze}>{error ? '再檢查一次' : '檢查這段錄音'}</button>}
      {!apiKey?.trim() && <button type="button" onClick={onOpenSettings}>請大人幫忙設定</button>}
    </div>
    {selfMode && <p className="practice-save-note">請大人開啟語音小幫手，就能幫你檢查。</p>}
    {!busy && !report && apiKey?.trim() && <p className="practice-save-note">檢查會將這段錄音傳給 Google Gemini，使用已設定的 API 額度。</p>}
    {(feedback || error) && <details className="recording-adult-details"><summary>給大人看：這次的練習紀錄</summary>
      {feedback && <><p>這段錄音聽到的英文：<span lang="en">{report.transcript}</span></p>{comparison && <><p>文字符合度 {comparison.pct}% · 通過參考 {threshold}%</p><div className="practice-word-diff">{comparison.result.map((word, i) => <span key={i} className={word.ok ? 'is-match' : 'is-missing'}>{word.word}</span>)}</div></>}<p>提示來自這段錄音。百分比只比對聽到的文字，不是發音分數；AI 也可能聽錯。</p></>}
      {error && <><p>{serviceErrorMessage(error, '這次未取得完整回覆，可重試同一段錄音。')}</p><button type="button" onClick={onOpenSettings}>檢查語音設定</button></>}
    </details>}
  </section>;
}
