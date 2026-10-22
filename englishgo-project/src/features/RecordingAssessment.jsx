import { useEffect, useRef, useState } from 'react';
import { assessRecording } from './recordingAssessmentService.js';
import { serviceErrorMessage } from '../lib/serviceErrors.js';

export default function RecordingAssessment({ clip, apiKey, onOpenSettings, onBeforeAnalyze, onResult, onRecognize, recognitionAvailable, textMatched, disabled }) {
  const [report, setReport] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(null), heading = useRef(null);
  const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); };
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  const analyze = async () => {
    if (pending.current || disabled) return;
    if (!apiKey?.trim()) { setError('請先設定 Gemini API Key，才能分析這段錄音。也可以用下方的文字比對。'); return; }
    onBeforeAnalyze();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setReport(null);
    try {
      const result = await assessRecording({ blob: clip.blob, apiKey, signal: controller.signal });
      if (controller.signal.aborted) return;
      setReport(result);
      if (result.speechDetected) onResult(result.transcript);
    } catch (reason) {
      if (!controller.signal.aborted) setError(serviceErrorMessage(reason, '這次沒有取得完整的錄音分析，請稍後重試。'));
    } finally {
      if (pending.current === controller) {
        pending.current = null; setBusy(false);
        heading.current?.focus({ preventScroll: true });
        heading.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
      }
    }
  };
  return <section className="recording-assessment" aria-label="這段錄音的練習回饋">
    <h3 ref={heading} tabIndex={-1}>{report?.speechDetected ? '這段錄音的發音建議' : textMatched ? '文字已比對，也可以聽聲音給建議' : '這段錄音尚未評分'}</h3>
    {report?.speechDetected ? <><dl>{[['發音清晰度', report.clarity], ['停頓與節奏', report.rhythm], ['下一步練習', report.practice]].map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl><p className="practice-save-note">AI 依錄音提供練習建議，並非標準化發音測驗。下方的百分比只代表辨識文字與題目的符合度。</p></> : <p>{report?.speechDetected === false ? '這段錄音未辨識到清楚的人聲，這次不評分。請先回聽確認音量，再重新錄音。' : '回放能聽見聲音，不代表瀏覽器已完成辨識。分析錄音可以取得發音、節奏與練習建議。'}</p>}
    <div className="practice-actions"><button type="button" disabled={busy || disabled} onClick={analyze}>{busy ? '正在聽錄音並分析…' : report ? '重新分析這段錄音' : '分析這段錄音'}</button>{busy && <button type="button" onClick={cancel}>取消分析</button>}</div>
    <p className="practice-save-note">按「分析」才會將這段錄音傳給 Google Gemini，使用你設定的 API Key 與額度；一般回放不會傳送錄音。</p>
    {busy && <p role="status">正在分析這段聲音，請稍等。</p>}
    {error && <p role="alert">{error}</p>}
    {(!apiKey?.trim() || error.includes('Key')) && <button type="button" onClick={onOpenSettings}>設定 Gemini API Key</button>}
    {recognitionAvailable && <><p className="practice-save-note">也可以再說一次做文字比對；會保留上方錄音，這次只使用語音辨識。</p><button type="button" disabled={disabled || busy} onClick={() => { cancel(); onRecognize(); }}>再說一次做文字比對</button></>}
  </section>;
}
