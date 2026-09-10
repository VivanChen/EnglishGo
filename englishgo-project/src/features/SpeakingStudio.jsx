import { serviceErrorMessage } from '../lib/serviceErrors.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { advanceSpeakingRound, createSpeakingRound, readSpeakingRound, recordSpeakingAttempt, reviewSpeakingRound, speechItemKey } from '../data/learningWorkshops.js';
import { useWorkshopStorage } from './workshopStorage.js';

export default function SpeakingStudio({ lv, onBack, onXp, apiKey, onOpenSettings, deps }) {
  const { fallback, fetchSpeakItems, selectSpeakItemsByMode, modes, localPronunciationGuide, generatePronunciationGuide, compareWords, speakPassThreshold, normalizeText, speak, stopSpeech, playSound, Hdr, c } = deps;
  const { book: round, live, save, saveError } = useWorkshopStorage(`eg_speaking_studio_${lv}`, null, readSpeakingRound);
  const [source, setSource] = useState(fallback), [mode, setMode] = useState('mixed'), [count, setCount] = useState(3), [active, setActive] = useState(false);
  const [listening, setListening] = useState(false), [interim, setInterim] = useState(''), [error, setError] = useState('');
  const [result, setResult] = useState(null), [heard, setHeard] = useState(''), [demoError, setDemoError] = useState(false);
  const [guideAI, setGuideAI] = useState(null), [busy, setBusy] = useState(false), [aiError, setAiError] = useState('');
  const capture = useRef(null), attempt = useRef(0), timer = useRef(null), request = useRef(0), demoToken = useRef(0), mounted = useRef(false), title = useRef(null);
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const stopCapture = (update = true) => {
    attempt.current++; clearTimeout(timer.current); timer.current = null;
    const recognition = capture.current; capture.current = null;
    if (recognition) { recognition.onresult = null; recognition.onend = null; recognition.onerror = null; try { recognition.abort(); } catch {} }
    if (update) { setListening(false); setInterim(''); }
  };
  const cancel = () => { stopCapture(); demoToken.current++; stopSpeech(); request.current++; setBusy(false); };
  useEffect(() => {
    mounted.current = true; let current = true;
    Promise.resolve(fetchSpeakItems(lv, 12)).then(items => { if (current && items?.length) setSource(items); }).catch(() => {});
    return () => { current = false; mounted.current = false; stopCapture(false); demoToken.current++; request.current++; stopSpeech(); };
  }, [lv, fetchSpeakItems, stopSpeech]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { cancel(); setActive(false); } };
    document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide);
  }, [stopSpeech]);
  const currentItem = round?.items[round.queue[round.index]];
  const record = currentItem ? round.records[speechItemKey(currentItem)] : null;
  const localGuide = useMemo(() => currentItem ? localPronunciationGuide(currentItem, lv) : null, [currentItem, lv, localPronunciationGuide]);
  const guide = guideAI || localGuide;
  useEffect(() => {
    setGuideAI(null); setAiError(''); setBusy(false); request.current++;
    setResult(null); setHeard(''); setError(''); setDemoError(false);
  }, [currentItem?.en, round?.review]);
  useEffect(() => { title.current?.focus({ preventScroll: true }); title.current?.closest('.practice-world')?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }, [active, round?.index, round?.done]);
  const demo = (text = currentItem?.en, rate = .85) => {
    stopCapture(); demoToken.current++; stopSpeech(); setDemoError(false);
    const token = ++demoToken.current;
    const handle = speak(text, 'en-US', rate, { onerror: () => { if (mounted.current && token === demoToken.current) setDemoError(true); } });
    if (!handle) setDemoError(true);
  };
  const start = () => {
    const next = createSpeakingRound(selectSpeakItemsByMode(source, mode), mode, count);
    if (!next.items.length) return;
    cancel(); save(next); setResult(null); setHeard(''); setActive(true);
  };
  const startListening = () => {
    if (!supported || capture.current || !active || live.current?.done) return;
    cancel(); setResult(null); setHeard(''); setError(''); setGuideAI(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    try { recognition = new SR(); } catch { setError('麥克風目前無法啟動，可以先聽示範跟讀。'); return; }
    const token = ++attempt.current, item = live.current.items[live.current.queue[live.current.index]];
    const finals = new Map(), partials = new Map();
    recognition.lang = 'en-US'; recognition.interimResults = true; recognition.maxAlternatives = 3; recognition.continuous = false;
    capture.current = recognition; setListening(true);
    recognition.onresult = event => {
      if (token !== attempt.current) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i]; let best = row[0];
        for (let j = 1; j < row.length; j++) if ((row[j].confidence || 0) > (best?.confidence || 0)) best = row[j];
        if (row.isFinal) { finals.set(i, best?.transcript || ''); partials.delete(i); } else partials.set(i, best?.transcript || '');
      }
      setInterim([...finals.values(), ...partials.values()].join(' ').trim());
    };
    recognition.onerror = event => {
      if (token !== attempt.current) return;
      stopCapture();
      setError(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? '麥克風尚未獲得允許。請在網址旁的網站設定允許麥克風，再按一次開始。也可以先用跟讀模式。' : event.error === 'audio-capture' ? '找不到可用的麥克風，先聽示範跟讀也可以。' : event.error === 'network' ? '語音辨識暫時連不上，稍後再試，或先聽示範跟讀。' : '這次沒有聽清楚，靠近一點，再試一次。');
    };
    recognition.onend = () => {
      if (token !== attempt.current) return;
      const transcript = [...new Map([...partials, ...finals]).entries()].sort((a, b) => a[0] - b[0]).map(([, text]) => text).join(' ').trim();
      stopCapture();
      if (!transcript) { setError('這次沒有聽到聲音，再試一次，或先聽示範跟讀。'); return; }
      const comparison = compareWords(item.en, transcript);
      const outcome = recordSpeakingAttempt(live.current, comparison, transcript, speakPassThreshold(item));
      save(outcome.round); setResult(comparison); setHeard(transcript);
      if (outcome.reward) onXp?.(outcome.reward);
      playSound(comparison.pct >= speakPassThreshold(item) ? 'good' : 'flip');
    };
    timer.current = setTimeout(() => { if (token === attempt.current) { stopCapture(); setError('這次先停在這裡，準備好可以再說一次。'); } }, 25000);
    try { recognition.start(); } catch { stopCapture(); setError('麥克風沒有順利開始，再按一次試試，或先跟讀。'); }
  };
  const finishSelfPractice = () => {
    cancel(); const current = live.current, item = current.items[current.queue[current.index]], key = speechItemKey(item);
    const old = current.records[key] || { attempts: 0, best: 0, heard: '', passed: false, earned: false };
    save(advanceSpeakingRound({ ...current, records: { ...current.records, [key]: { ...old, selfPracticed: true } } })); setResult(null);
  };
  const next = () => { cancel(); save(advanceSpeakingRound(live.current)); setResult(null); setHeard(''); };
  const pause = () => { cancel(); setActive(false); };
  const leave = () => { cancel(); onBack(); };
  const explain = async () => {
    if (!apiKey?.trim()) { setAiError('請大人先設定 AI，才能分析這次的練習。'); onOpenSettings?.(); return; }
    const comparison = result || record?.comparison, transcript = heard || record?.heard;
    if (!comparison || !transcript) return;
    const token = ++request.current; setBusy(true); setAiError('');
    try {
      const nextGuide = await generatePronunciationGuide(currentItem, lv, apiKey, { heard: transcript, pct: comparison.pct, missing: comparison.result.filter(x => !x.ok).map(x => x.word).slice(0, 6), extra: (comparison.extra || []).slice(0, 6) });
      if (token === request.current) setGuideAI(nextGuide);
    } catch (error) { if (token === request.current) setAiError(serviceErrorMessage(error, '這次的分析暫時沒有回來，先用下面的發音提示練習。')); }
    finally { if (token === request.current) setBusy(false); }
  };
  const header = <Hdr t="🗣️ 勇敢說出口" onBack={leave} cl={c.cl} />;
  const note = <p className="practice-save-note">{saveError ? '這台裝置暫時無法保存，本次仍可繼續練習。' : '題目與練習結果保存在這台裝置；重新整理後不會自動開啟麥克風。'}</p>;
  if (!active || !round) return <div className="practice-world speaking-studio">{header}<section className="practice-intro"><PracticeArt kind="listening" /><div><span className="practice-eyebrow">每次開口，都算進步</span><h2 ref={title} tabIndex={-1}>準備好了，再說給我聽</h2><p>先聽一次，再按麥克風跟讀。</p><p>先開口練 3 題，不計時，也不用一次就完美。</p></div></section>{round && <section className="practice-resume"><div><b>{round.done ? '上次的小練習完成了' : `上次練到 ${round.index + 1} / ${round.queue.length}`}</b><p>已經拿到的獎勵和練習紀錄都還在。</p></div><button className="practice-primary" onClick={() => { setResult(null); setError(''); setActive(true); }}>{round.done ? '看看上次成果' : '繼續上次練習'}</button></section>}<section className="practice-config"><h3>練習模式</h3><div className="practice-choice-row">{modes.map(option => <button key={option.id} aria-label={option.label} aria-pressed={mode === option.id} onClick={() => setMode(option.id)}><b>{option.label}</b><small className="workshop-option-note">{option.desc}</small></button>)}</div><fieldset><legend>這次想練多少？</legend><div className="practice-choice-row">{[3, 5].map(n => <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{n} 題小練習</button>)}</div></fieldset><p>{supported ? '按下「直接開說」才會使用麥克風。第一次請在瀏覽器提示中選擇允許。' : '這個瀏覽器目前無法辨識語音，仍可聽示範、跟讀與保存練習進度。'}</p>{round && <p className="practice-save-note">開始新練習會取代上次這一輪的進度。</p>}<button className="practice-primary" onClick={start}>開始口說小練習 →</button></section>{note}</div>;
  const passedCount = round.items.filter(item => round.records[speechItemKey(item)]?.passed).length;
  const selfCount = round.items.filter(item => round.records[speechItemKey(item)]?.selfPracticed).length;
  if (round.done) return <div className="practice-world speaking-studio">{header}<section className="practice-complete" aria-label="口說練習完成"><PracticeArt kind="listening" complete /><h2 ref={title} tabIndex={-1}>口說練習完成！</h2><p>練過 {round.queue.length} 題，給今天勇敢開口的自己一點鼓勵。</p><div className="practice-metrics"><div><b>{round.items.length}</b><span>這份任務</span></div><div><b>{passedCount}</b><span>辨識通過</span></div><div><b>{selfCount}</b><span>自行跟讀過</span></div></div><div className="practice-actions">{passedCount < round.items.length && <button className="practice-primary" onClick={() => { cancel(); save(reviewSpeakingRound(live.current)); setResult(null); }}>只練還想加強的</button>}<button onClick={pause}>換個小練習</button><button onClick={leave}>回首頁休息</button></div></section><section className="practice-review-list"><h3>這次練過的英文</h3>{round.items.map(item => <div key={item.en}><div><b lang="en">{item.en}</b><p>{item.zh}</p><small>{round.records[speechItemKey(item)]?.passed ? '辨識通過' : round.records[speechItemKey(item)]?.selfPracticed ? '已跟讀，尚未辨識評分' : '下次可以再練'}</small></div><button onClick={() => demo(item.en)} aria-label={`朗讀 ${item.en}`}>♫</button></div>)}</section>{note}</div>;
  const sentence = currentItem.type === 'sentence', threshold = speakPassThreshold(currentItem), comparison = result;
  return <div className="practice-world speaking-studio">{header}<div className="practice-toolbar"><span>{round.review ? '加強練習' : '勇敢說出口'} · {round.index + 1} / {round.queue.length}</span><button onClick={pause}>Ⅱ 先休息一下</button></div><progress className="practice-progress" max={round.queue.length} value={round.index} aria-label="口說練習進度" /><section className="practice-question"><span className="practice-eyebrow">{sentence ? '看中文，唸出完整英文句子' : '看中文，唸出英文單字'}</span><h2 ref={title} tabIndex={-1}>{currentItem.zh}</h2><div className="workshop-spoken-target" lang="en">{currentItem.en}</div>{sentence && <div className="workshop-tips">{normalizeText(currentItem.en).split(' ').map((word, i) => <span key={i} lang="en">{word}</span>)}</div>}<div className="practice-actions"><button onClick={() => demo()}>🔊 聽示範</button><button onClick={() => demo(currentItem.en, .65)}>慢慢聽</button>{supported && <button className="practice-primary" onClick={listening ? () => { try { capture.current?.stop(); } catch { stopCapture(); setError('這次先停在這裡，可以再試一次。'); } } : startListening}>{listening ? '■ 說好了，停止' : '🎤 直接開說'}</button>}</div>{listening && <div className="workshop-microphone" role="status"><b>正在聽，說完可以按停止</b><p>{interim || '慢慢說，我在這裡。'}</p></div>}{error && <div className="practice-hint" role="alert">{error}</div>}{demoError && <p role="status">示範暫時無法播放，可以稍後再試。</p>}{!supported && <div className="practice-hint">目前無法辨識語音。可以先聽示範，跟著念，再記下練習進度。</div>}
      {comparison && <div className={`practice-feedback ${comparison.pct >= threshold ? 'is-correct' : ''}`} role="status"><h3>{comparison.pct >= threshold ? '通過' : '再練一次'}</h3><p>文字符合度 {comparison.pct}% · 通過參考 {threshold}%</p><p className="practice-save-note">依辨識到的文字比對；沒有聽清楚時，可以重說。</p><div className="practice-word-diff">{comparison.result.map((word, i) => <span key={i} className={word.ok ? 'is-match' : 'is-missing'}>{word.word}</span>)}</div><p>你說的是：<span lang="en">{heard}</span></p>{comparison.extra?.length > 0 && <p>另外聽到：{comparison.extra.join(' · ')}</p>}<div className="practice-actions">{comparison.result.filter(word => !word.ok).slice(0, 4).map((word, i) => <button key={i} onClick={() => demo(word.word, .65)}>練 {word.word} ♫</button>)}<button onClick={startListening}>重說一次</button><button className="practice-primary" onClick={next}>{round.index + 1 === round.queue.length ? '完成' : '下一個'}</button></div></div>}
      {record && !comparison && <div><p className="practice-save-note">{record.passed ? `這題已通過，最高文字符合度 ${record.best}%。` : record.selfPracticed ? '這題已經自行跟讀過。' : `上次試過 ${record.attempts} 次，可以再說說看。`}</p>{(record.passed || record.selfPracticed) && <button className="practice-primary" onClick={next}>{round.index + 1 === round.queue.length ? '完成' : '下一個'}</button>}</div>}
      {guide?.target && <section className="workshop-coach" aria-label="發音提示"><h3>發音小老師</h3><div className="workshop-coach-grid">{(sentence ? [['分段跟讀', guide.syllables], ['語調提醒', guide.stress]] : [['音節', guide.syllables], ['重音', guide.stress]]).map(([label, value]) => <div key={label}><b>{label}</b><p>{value}</p></div>)}</div><details><summary>嘴型與練習步驟</summary><p><b>嘴型：</b>{guide.mouth}</p><p><b>常見卡點：</b>{guide.mistake}</p><ol>{guide.steps?.map((step, i) => <li key={i}>{step}</li>)}</ol></details>{(comparison || record?.comparison) && <button onClick={explain} disabled={busy}>{busy ? '正在整理發音提示…' : 'AI 分析這次發音'}</button>}{aiError && <div role="status"><p>{aiError}</p><button onClick={()=>onOpenSettings?.()}>API Key 設定</button></div>}</section>}
      <details className="workshop-extra"><summary>今天想先跟讀，不用麥克風</summary><p>先跟著示範唸一次，再記下練習。這個選項不會算成辨識通過，也不會領取辨識獎勵。</p><button disabled={listening} onClick={finishSelfPractice}>我跟讀過了，繼續 →</button><a href={`https://youglish.com/pronounce/${encodeURIComponent(currentItem.en)}/english`} target="_blank" rel="noreferrer">另開視窗聽真人發音 ↗</a></details></section>{note}</div>;
}
