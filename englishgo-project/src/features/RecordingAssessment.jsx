import { useEffect, useRef, useState } from 'react';
import { assessRecording } from './recordingAssessmentService.js';
import { serviceErrorMessage } from '../lib/serviceErrors.js';
import { recordingFeedback } from './recordingFeedback.js';
import SpeechHighlight from '../components/SpeechHighlight.jsx';

export default function RecordingAssessment({ clip, apiKey, autoCheck, target, comparison, threshold, onOpenSettings, onBeforeAnalyze, onResult, onRecord, onNext, nextLabel, onListen, onReadTip, playing, playbackError, children }) {
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
  const title = busy ? '正在聽你剛剛說的…' : feedback?.title || (report?.speechDetected === false ? '這次還沒聽清楚' : error ? '小幫手暫時連不上' : '錄好了，聽聽自己的聲音！');
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
    </> : <p role={error ? 'alert' : undefined}>{report?.speechDetected === false ? '靠近麥克風一點，再說一次吧。' : error ? '錄音還在，可以再檢查一次。' : apiKey?.trim() ? '可以用剛剛這段錄音檢查。' : '請大人開啟語音小幫手，就能幫你檢查。'}</p>}
    {playbackError && <p role="status">示範暫時無法播放，可以稍後再試。</p>}
    {children}
    <div className="practice-actions recording-next-actions">
      <button type="button" className={readyToContinue ? undefined : 'practice-primary'} onClick={() => onRecord(feedback)}>🎤 再說一次</button>
      <button type="button" className={readyToContinue ? 'practice-primary' : undefined} onClick={() => { cancel(); onNext(); }}>{feedback ? nextLabel : '先跳過這題 →'}</button>
    </div>
    <div className="practice-actions recording-recovery-actions">
      {!busy && !report && apiKey?.trim() && <button type="button" onClick={analyze}>{error ? '再檢查一次' : '檢查這段錄音'}</button>}
      {!apiKey?.trim() && <button type="button" onClick={onOpenSettings}>請大人幫忙設定</button>}
    </div>
    {!busy && !report && apiKey?.trim() && <p className="practice-save-note">檢查會將這段錄音傳給 Google Gemini，使用已設定的 API 額度。</p>}
    {(feedback || error) && <details className="recording-adult-details"><summary>給大人看：這次的練習紀錄</summary>
      {feedback && <><p>這段錄音聽到的英文：<span lang="en">{report.transcript}</span></p>{comparison && <><p>文字符合度 {comparison.pct}% · 通過參考 {threshold}%</p><div className="practice-word-diff">{comparison.result.map((word, i) => <span key={i} className={word.ok ? 'is-match' : 'is-missing'}>{word.word}</span>)}</div></>}<p>提示來自這段錄音。百分比只比對聽到的文字，不是發音分數；AI 也可能聽錯。</p></>}
      {error && <><p>{serviceErrorMessage(error, '這次未取得完整回覆，可重試同一段錄音。')}</p><button type="button" onClick={onOpenSettings}>檢查語音設定</button></>}
    </details>}
  </section>;
}
