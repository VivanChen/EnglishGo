import { readCardPractice, cardPracticeStorageKey, speakingPhrases } from '../data/cardSpeaking.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { advanceSpeakingRound, createSpeakingRound, readSpeakingRound, recordSpeakingAttempt, reviewSpeakingRound, speechItemKey } from '../data/learningWorkshops.js';
import { useWorkshopStorage } from './workshopStorage.js';
import { useVoiceRecording } from './useVoiceRecording.js';
import VoiceReplay from './VoiceReplay.jsx';
import RecordingAssessment from './RecordingAssessment.jsx';
import SpeakingPhrases from './SpeakingPhrases.jsx';
import ListeningPuzzle from './ListeningPuzzle.jsx';
import ListeningRadio from '../components/ListeningRadio.jsx';
import SpeechHighlight, { SpeechHighlightNote } from '../components/SpeechHighlight.jsx';
import { speechHighlightEvents } from '../lib/speechTiming.js';

export default function SpeakingStudio({ lv, onBack, onXp, apiKey, onOpenSettings, cardPractice = null, deps }) {
  const { fallback, fetchSpeakItems, selectSpeakItemsByMode, modes, localPronunciationGuide, compareWords, speakPassThreshold, speak, stopSpeech, playSound, Hdr, c } = deps;
  const practice = useMemo(() => readCardPractice(cardPractice), [cardPractice]);
  const { book: round, live, save, saveError } = useWorkshopStorage(
    practice ? cardPracticeStorageKey(lv, practice) : `eg_speaking_studio_${lv}`,
    practice ? createSpeakingRound([practice], practice.type, 1) : null,
    value => { const saved = readSpeakingRound(value); return saved && (!practice || (saved.items.length === 1 && saved.items[0].en === practice.en && saved.items[0].zh === practice.zh && saved.items[0].type === practice.type)) ? saved : null; });
  const [source, setSource] = useState(fallback), [mode, setMode] = useState('mixed'), [count, setCount] = useState(3), [active, setActive] = useState(!!practice);
  const voice = useVoiceRecording();
  const voiceAudio = useRef(null), autoCheck = useRef(false);
  const stopVoicePlayback = useCallback(() => { const audio = voiceAudio.current; if (audio) { audio.pause(); audio.currentTime = 0; } }, []);
  const cancelVoice = voice.cancel;
  const phase = voice.phase;
  const listening = phase !== 'idle';
  const [result, setResult] = useState(null), [demoError, setDemoError] = useState(false);
  const [hideEnglish, setHideEnglish] = useState(false), [demoPlaying, setDemoPlaying] = useState(null);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const puzzleButton = useRef(null), returnToPuzzleButton = useRef(false);
  const demoToken = useRef(0), mounted = useRef(false), title = useRef(null);
  const stopDemo = () => { demoToken.current++; stopSpeech(); setDemoPlaying(null); };
  const cancelCapture = () => { stopVoicePlayback(); cancelVoice(); };
  const cancel = () => { cancelCapture(); stopDemo(); setPuzzleOpen(false); };
  const closePuzzle = () => { stopDemo(); returnToPuzzleButton.current = true; setPuzzleOpen(false); };
  useEffect(() => { if (!puzzleOpen && returnToPuzzleButton.current) { returnToPuzzleButton.current = false; puzzleButton.current?.focus({ preventScroll: true }); puzzleButton.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' }); } }, [puzzleOpen]);
  useEffect(() => {
    mounted.current = true; let current = true;
    if (!practice) Promise.resolve(fetchSpeakItems(lv, 12)).then(items => { if (current && items?.length) setSource(items); }).catch(() => {});
    return () => { current = false; mounted.current = false; stopVoicePlayback(); cancelVoice(false); demoToken.current++; stopSpeech(); };
  }, [lv, practice, fetchSpeakItems, stopSpeech]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { cancel(); setActive(false); } };
    document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide);
  }, [stopSpeech]);
  const currentItem = round?.items[round.queue[round.index]];
  const record = currentItem ? round.records[speechItemKey(currentItem)] : null;
  const phrases = useMemo(() => speakingPhrases(currentItem?.en), [currentItem?.en]);
  const localGuide = useMemo(() => currentItem ? localPronunciationGuide(currentItem, lv) : null, [currentItem, lv, localPronunciationGuide]);
  const guide = localGuide;
  useEffect(() => {
    setResult(null); setDemoError(false); setHideEnglish(false); setDemoPlaying(null); setPuzzleOpen(false);
    stopVoicePlayback(); cancelVoice();
  }, [currentItem?.en, round?.review, stopVoicePlayback, cancelVoice]);
  useEffect(() => { title.current?.focus({ preventScroll: true }); title.current?.closest('.practice-world')?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }, [active, round?.index, round?.done]);
  const demo = (text = currentItem?.en, rate = .85, label = '整句示範', context = {}, language = 'en-US') => {
    stopVoicePlayback(); if (voice.phase !== 'idle') cancelVoice(); demoToken.current++; stopSpeech(); setDemoError(false);
    const token = ++demoToken.current;
    setDemoPlaying({ text, label, started: false, word: -1, approximate: false, ...context });
    const finish = () => { if (mounted.current && token === demoToken.current) { demoToken.current++; setDemoPlaying(null); } };
    const fail = () => { if (mounted.current && token === demoToken.current) { finish(); setDemoError(true); } };
    try {
      const handle = speak(text, language, rate, {
        ...speechHighlightEvents(text, update => { if (mounted.current && token === demoToken.current) setDemoPlaying(current => current ? { ...current, ...update } : null); }),
        onend: finish, oncancel: finish, onerror: fail,
      });
      if (!handle) fail();
    } catch { fail(); }
  };
  const start = () => {
    const next = createSpeakingRound(selectSpeakItemsByMode(source, mode), mode, count);
    if (!next.items.length) return;
    cancel(); save(next); setResult(null); setActive(true);
  };
  const scoreTranscript = (item, transcript) => {
    const comparison = compareWords(item.en, transcript);
    const outcome = recordSpeakingAttempt(live.current, comparison, transcript, speakPassThreshold(item));
    save(outcome.round); setResult(comparison); setHideEnglish(false);
    if (outcome.reward) onXp?.(outcome.reward);
    playSound(comparison.pct >= speakPassThreshold(item) ? 'good' : 'flip');
  };
  const startListening = () => {
    if (!voice.supported || listening || !active || live.current?.done) return;
    cancel(); setResult(null);
    autoCheck.current = !!apiKey?.trim();
    voice.start();
  };
  const finishListening = () => voice.stop();
  const replayStart = () => stopDemo();
  const discard = () => { stopVoicePlayback(); cancelVoice(); setResult(null); };
  const finishSelfPractice = () => {
    cancel(); const current = live.current, item = current.items[current.queue[current.index]], key = speechItemKey(item);
    const old = current.records[key] || { attempts: 0, best: 0, heard: '', passed: false, earned: false };
    save(advanceSpeakingRound({ ...current, records: { ...current.records, [key]: { ...old, selfPracticed: true } } })); setResult(null);
  };
  const next = () => { cancel(); save(advanceSpeakingRound(live.current)); setResult(null); };
  const pause = () => { cancel(); setActive(false); };
  const leave = () => { cancel(); onBack(); };
  const header = <><Hdr t={practice ? "🎧 單字聽說練習" : "🗣️ 勇敢說出口"} onBack={leave} cl={c.cl} />
    {practice && <section className="speaking-source" aria-label="來自單字卡"><div><span>從單字卡帶來的{practice.type === 'sentence' ? '例句' : '單字'}</span>{!hideEnglish && !puzzleOpen && <strong lang="en">{practice.word}</strong>}<p>{practice.meaning}</p></div><button type="button" onClick={leave}>← 回到單字卡</button></section>}</>;
  const playback = <>{demoPlaying && <div className="speaking-playback"><p role="status">♫ {demoPlaying.started ? '正在播放' : '準備播放'} · {demoPlaying.label}</p><button type="button" onClick={stopDemo}>■ 停止示範</button></div>}{demoError && <p role="status">示範暫時無法播放，可以稍後再試。</p>}</>;
  const note = <p className="practice-save-note">{saveError ? '這台裝置暫時無法保存，本次仍可繼續練習。' : '題目與練習結果保存在這台裝置；重新整理後不會自動開啟麥克風。'}</p>;
  if (practice && !active) return <div className="practice-world speaking-studio">{header}<section className="practice-config"><h2 ref={title} tabIndex={-1}>準備好了，接著練{practice.type === 'word' ? '這個單字' : '這一句'}</h2><p lang="en">{practice.en}</p><p>{practice.zh}</p><button className="practice-primary" onClick={() => setActive(true)}>{round?.done ? '看看這次成果' : '繼續聽說練習'}</button></section>{note}</div>;
  if (!active || !round) return <div className="practice-world speaking-studio">{header}<section className="practice-intro"><PracticeArt kind="listening" /><div><span className="practice-eyebrow">每次開口，都算進步</span><h2 ref={title} tabIndex={-1}>準備好了，再說給我聽</h2><p>先聽一次，再按麥克風跟讀。</p><p>先開口練 3 題，不計時，也不用一次就完美。</p></div></section>{round && <section className="practice-resume"><div><b>{round.done ? '上次的小練習完成了' : `上次練到 ${round.index + 1} / ${round.queue.length}`}</b><p>已經拿到的獎勵和練習紀錄都還在。</p></div><button className="practice-primary" onClick={() => { setResult(null); setActive(true); }}>{round.done ? '看看上次成果' : '繼續上次練習'}</button></section>}<section className="practice-config"><h3>練習模式</h3><div className="practice-choice-row">{modes.map(option => <button key={option.id} aria-label={option.label} aria-pressed={mode === option.id} onClick={() => setMode(option.id)}><b>{option.label}</b><small className="workshop-option-note">{option.desc}</small></button>)}</div><fieldset><legend>這次想練多少？</legend><div className="practice-choice-row">{[3, 5].map(n => <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{n} 題小練習</button>)}</div></fieldset><p>{voice.supported ? '先聽示範，再錄下你的聲音。說好了，就用這段錄音檢查。' : '這個瀏覽器目前無法錄音，仍可聽示範、跟讀與保存練習進度。'}</p>{round && <p className="practice-save-note">開始新練習會取代上次這一輪的進度。</p>}<button className="practice-primary" onClick={start}>開始口說小練習 →</button></section>{note}</div>;
  const passedCount = round.items.filter(item => round.records[speechItemKey(item)]?.passed).length;
  const selfCount = round.items.filter(item => round.records[speechItemKey(item)]?.selfPracticed).length;
  if (round.done) return <div className="practice-world speaking-studio">{header}<section className="practice-complete" aria-label="口說練習完成"><PracticeArt kind="listening" complete /><h2 ref={title} tabIndex={-1}>口說練習完成！</h2><p>練過 {round.queue.length} 題，給今天勇敢開口的自己一點鼓勵。</p><div className="practice-metrics"><div><b>{round.items.length}</b><span>這份任務</span></div><div><b>{passedCount}</b><span>完成檢查</span></div><div><b>{selfCount}</b><span>自行跟讀過</span></div></div><div className="practice-actions">{!practice && passedCount < round.items.length && <button className="practice-primary" onClick={() => { cancel(); save(reviewSpeakingRound(live.current)); setResult(null); }}>只練還想加強的</button>}{practice ? <button onClick={() => { cancel(); save({ ...live.current, index: 0, done: false }); setResult(null); }}>再練一次</button> : <button onClick={pause}>換個小練習</button>}<button onClick={leave}>{practice ? '回到單字卡繼續複習' : '回首頁休息'}</button></div></section><section className="practice-review-list"><h3>這次練過的英文</h3>{playback}{round.items.map(item => <div key={item.en}><div><b lang="en"><SpeechHighlight text={item.en} playback={demoPlaying} /></b><p>{item.zh}</p><small>{round.records[speechItemKey(item)]?.passed ? '完成檢查' : round.records[speechItemKey(item)]?.selfPracticed ? '已跟讀' : '下次可以再練'}</small></div><button aria-pressed={demoPlaying?.text === item.en} onClick={() => demoPlaying?.text === item.en ? stopDemo() : demo(item.en, .85, '成果重聽')} aria-label={`${demoPlaying?.text === item.en ? '停止朗讀' : '朗讀'} ${item.en}`}>{demoPlaying?.text === item.en ? '■' : '♫'}</button></div>)}</section>{note}</div>;
  const sentence = currentItem.type === 'sentence', threshold = speakPassThreshold(currentItem), comparison = result;
  return <div className="practice-world speaking-studio">{header}<div className="practice-toolbar"><span>{round.review ? '加強練習' : practice ? '單字卡聽說' : '勇敢說出口'} · {round.index + 1} / {round.queue.length}</span><button onClick={pause}>Ⅱ 先休息一下</button></div>{!practice && <progress className="practice-progress" max={round.queue.length} value={round.index} aria-label="口說練習進度" />}<section className="practice-question"><span className="practice-eyebrow">{sentence ? '看中文，唸出完整英文句子' : '看中文，唸出英文單字'}</span><h2 ref={title} tabIndex={-1}>{currentItem.zh || "聽一聽，再跟著說。"}</h2><div className="speaking-listen-heading"><span>1 · 先聽，熟悉聲音</span>{!puzzleOpen && <button type="button" aria-pressed={hideEnglish} onClick={() => { stopDemo(); setHideEnglish(hidden => !hidden); }}>{hideEnglish ? '顯示英文' : '先聽不看英文'}</button>}</div>
      {puzzleOpen ? <ListeningPuzzle key={currentItem.en} sentence={currentItem.en} playing={demoPlaying} playbackError={demoError} onPlay={demo} onStop={stopDemo} onExit={closePuzzle} /> : <>
      {hideEnglish ? <div className="speaking-listen-cover"><p>先聽示範，試著說出你聽到的英文。</p></div> : <div className="workshop-spoken-target" lang="en"><SpeechHighlight text={currentItem.en} playback={demoPlaying} /></div>}
      {!hideEnglish && <SpeechHighlightNote playback={demoPlaying} />}
      <ListeningRadio state={demoPlaying ? demoPlaying.started ? 'playing' : 'loading' : 'idle'} />
      <div className="practice-actions"><button onClick={() => demo(currentItem.en, .85, sentence ? '整句示範' : '單字示範')}>🔊 聽示範</button><button onClick={() => demo(currentItem.en, .65, '慢速示範')}>慢慢聽</button>{sentence && currentItem.en.trim().split(/\s+/).length > 1 && !listening && <button ref={puzzleButton} type="button" className="speaking-puzzle-launch" onClick={() => { stopDemo(); setDemoError(false); setHideEnglish(false); setPuzzleOpen(true); }}>🧩 聽音拼句</button>}</div>{playback}{sentence && !hideEnglish && !listening && phrases.length > 1 && <SpeakingPhrases key={currentItem.en} phrases={phrases} sentenceText={currentItem.en} playing={demoPlaying} playbackError={demoError} onPlay={demo} onStop={stopDemo} onPlaySentence={() => demo(currentItem.en, .85, '整句示範')} onComplete={finishSelfPractice} />}</>}{!voice.clip && <p className="speaking-step-note">2 · 換你說，說完幫你聽。</p>}
      {!voice.clip && <>
        <div className="practice-actions">{voice.supported && <button className="practice-primary" disabled={phase === 'starting' || phase === 'processing'} onClick={phase === 'listening' ? finishListening : startListening}>{phase === 'starting' ? '準備麥克風…' : phase === 'processing' ? '正在收好錄音…' : phase === 'listening' ? '■ 說好了' : apiKey?.trim() ? '🎤 錄音並檢查' : '🎤 開始錄音'}</button>}{listening && <button type="button" onClick={cancelCapture}>取消這次錄音</button>}</div>
        {listening && <div className="workshop-microphone" data-phase={phase} role="status"><b>{phase === 'starting' ? '準備麥克風，還沒開始收音' : phase === 'processing' ? '正在收好這段錄音' : '正在錄音，慢慢說就好'}</b>{phase === 'starting' && <p>第一次使用，請允許麥克風。</p>}{voice.phase === 'listening' && <span className="voice-recording-time">● 錄音中 · {voice.seconds} / {voice.maxSeconds} 秒</span>}</div>}
        {voice.error && <div className="practice-hint" role="alert">{voice.error}</div>}
        {voice.supported ? <><p className="voice-capture-note">{apiKey?.trim() ? '說完按「說好了」，就會檢查這段錄音。' : '可以先錄音回聽；請大人設定後，就能幫你檢查。'}最長 {voice.maxSeconds} 秒。</p>{!apiKey?.trim() && <button type="button" onClick={onOpenSettings}>請大人幫忙設定</button>}{apiKey?.trim() && <p className="practice-save-note">錄音會傳給 Google Gemini 檢查，使用已設定的 API 額度。</p>}</> : <p className="practice-hint">這個瀏覽器暫時不能錄音，可以先聽示範，跟著唸。</p>}
      </>}
      {voice.clip && <>
        <RecordingAssessment key={`assessment:${voice.clip.url}`} clip={voice.clip} apiKey={apiKey} autoCheck={autoCheck.current} target={currentItem.en} comparison={comparison} threshold={threshold} onOpenSettings={onOpenSettings} onBeforeAnalyze={() => { stopDemo(); stopVoicePlayback(); }} onResult={transcript => scoreTranscript(currentItem, transcript)} onRecord={startListening} onNext={next} nextLabel={round.index + 1 === round.queue.length ? '完成' : '下一個'} onListen={text => demo(text, .65, '跟著唸')} onReadTip={text => demo(text, .85, '小提示', {}, 'zh-TW')} />
        <VoiceReplay key={voice.clip.url} clip={voice.clip} audioRef={voiceAudio} onBeforePlay={replayStart} onDemo={() => demo()} onDiscard={discard} />
      </>}
      {record && !comparison && !voice.clip && !listening && <div><p className="practice-save-note">{record.passed ? '這題已經練得很棒了。' : record.selfPracticed ? '這題已經自行跟讀過。' : `上次試過 ${record.attempts} 次，可以再說說看。`}</p>{(record.passed || record.selfPracticed) && <button className="practice-primary" onClick={next}>{round.index + 1 === round.queue.length ? '完成' : '下一個'}</button>}</div>}
      <details className="workshop-extra" open={!voice.supported || undefined}><summary>今天想先跟讀，不用麥克風</summary><p>先跟著示範唸一次，再記下練習。這個選項不會算成完成檢查，也不會領取檢查獎勵。</p><button disabled={listening} onClick={finishSelfPractice}>我跟讀過了，繼續 →</button><a href={`https://youglish.com/pronounce/${encodeURIComponent(currentItem.en)}/english`} target="_blank" rel="noreferrer">另開視窗聽真人發音 ↗</a></details>
      {guide?.target && !hideEnglish && !puzzleOpen && <details className="workshop-coach" aria-label="發音提示"><summary>給大人看：發音練習方法</summary><h3>發音小老師</h3><div className="workshop-coach-grid">{(sentence ? [['分段跟讀', guide.syllables], ['語調提醒', guide.stress]] : [['音節', guide.syllables], ['重音', guide.stress]]).map(([label, value]) => <div key={label}><b>{label}</b><p>{value}</p></div>)}</div><details><summary>嘴型與練習步驟</summary><p><b>嘴型：</b>{guide.mouth}</p><p><b>常見卡點：</b>{guide.mistake}</p><ol>{guide.steps?.map((step, i) => <li key={i}>{step}</li>)}</ol></details></details>}
</section>{note}</div>;
}
