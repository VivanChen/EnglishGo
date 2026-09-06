import { useEffect, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { buildQuizQuestions, buildListeningQuestions, createPractice, readPractice, practiceReducer, practiceNeedsReview, compareDictation } from '../data/practiceJourney.js';

const LABELS = { quiz: ['小小單字挑戰', '選一選，讓單字留下來', '每次一小步，答錯也能再試一次。'], listening: ['小耳朵練習', '聽一聽，把句子接起來', '準備好了再播放，用自己的速度慢慢聽。'] };
const QUIZ_MODES = [['en2zh', '看英文，選中文'], ['zh2en', '看中文，選英文'], ['mix', '兩種交替練習']];
const EMPTY_WORDS = [];

export default function LearningPractice({ kind, lv, onBack, onXp, onPerfect, onDone, trackWeak, onReviewWords, deps }) {
  const { words: built = EMPTY_WORDS, sentences = [], fetchCloudVocab, speak, stopSpeech, playSound, Hdr, c } = deps;
  const storageKey = `eg_practice_${kind}_${lv}`;
  const [saved, setSaved] = useState(() => { try { return readPractice(JSON.parse(localStorage.getItem(storageKey)), kind, lv); } catch { return null; } });
  const live = useRef(saved), [active, setActive] = useState(false), [words, setWords] = useState(built);
  const [mode, setMode] = useState(kind === 'quiz' ? 'en2zh' : lv === 'elementary' ? 'tiles' : 'typing');
  const [count, setCount] = useState(kind === 'quiz' ? 5 : 3), [rate, setRate] = useState(.75);
  const [speaking, setSpeaking] = useState(false), [audioError, setAudioError] = useState(false), [storageError, setStorageError] = useState(false);
  const heading = useRef(null), audioToken = useRef(0), input = useRef(null);
  const [title, headline, description] = LABELS[kind];

  useEffect(() => {
    let mounted = true;
    if (kind === 'quiz') Promise.resolve(fetchCloudVocab?.(lv, 40)).then(cloud => {
      if (mounted && cloud?.length) setWords([...cloud, ...built]);
    }).catch(() => {});
    return () => { mounted = false; audioToken.current++; stopSpeech(); };
  }, [kind, lv, built, fetchCloudVocab, stopSpeech]);

  const stop = () => { audioToken.current++; stopSpeech(); setSpeaking(false); };
  useEffect(() => {
    const hide = () => { if (document.hidden) { stop(); setActive(false); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [stopSpeech]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }, [active, saved?.index, saved?.round, saved?.status]);

  const save = next => {
    live.current = next;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(false); } catch { setStorageError(true); }
    setSaved(next);
  };
  const act = action => {
    const before = live.current, next = practiceReducer(before, action);
    if (next === before) return;
    save(next);
    const qi = before.queue[before.index];
    if (action.type === 'ANSWER') {
      if (!before.records[qi].earned && next.records[qi].earned) onXp?.(10);
      if (next.feedback === false && !before.records[qi].attempts && kind === 'quiz') trackWeak?.(before.questions[qi].item.w);
      playSound(next.feedback ? 'good' : 'flip');
    }
    if (!before.completedMain && next.completedMain) {
      if (kind === 'listening') onDone?.();
      else if (next.records.every(r => r.firstCorrect && !r.hinted)) onPerfect?.();
      playSound('done');
    }
    if (['NEXT', 'RETRY', 'REVIEW'].includes(action.type)) { stop(); setAudioError(false); }
  };
  const start = () => {
    const questions = kind === 'quiz' ? buildQuizQuestions(words, { mode, count }) : buildListeningQuestions(sentences, count);
    if (!questions.length) return;
    stop(); setAudioError(false); save(createPractice(kind, lv, mode, questions)); setActive(true);
  };
  const listen = (text, speed = rate) => {
    stop(); setAudioError(false); setSpeaking(true);
    const token = ++audioToken.current;
    const settle = () => { if (token === audioToken.current) setSpeaking(false); };
    const speech = speak(text, 'en-US', speed, { onend: settle, oncancel: settle, onerror: () => { if (token === audioToken.current) { setSpeaking(false); setAudioError(true); } } });
    if (!speech) { setSpeaking(false); setAudioError(true); }
  };
  const exit = () => { stop(); onBack(); };
  const pause = () => { stop(); setActive(false); };
  const note = <p className="practice-save-note" role={storageError ? 'status' : undefined}>{storageError ? '這台裝置暫時無法保存，這次仍可繼續練習。' : '進度保存在這台裝置，隨時休息、下次再繼續。'}</p>;
  const header = <Hdr t={`${kind === 'quiz' ? '✧' : '♫'} ${title}`} onBack={exit} cl={c.cl} />;
  const hasContent = kind === 'quiz' ? buildQuizQuestions(words, { count: 1, random: () => .5 }).length > 0 : sentences.length > 0;
  if (!active || !saved) return <div className="practice-world" data-practice-kind={kind}>{header}
    <section className="practice-intro"><PracticeArt kind={kind} /><div><span className="practice-eyebrow">一小段專心，一點點進步</span><h2 ref={heading} tabIndex={-1}>{headline}</h2><p>{description}</p><ol className="practice-steps"><li>選個小任務</li><li>慢慢練習</li><li>帶走新收穫</li></ol></div></section>
    {saved && <section className="practice-resume" aria-label="已保存的練習"><div><b>{saved.status === 'done' ? '上次的小任務已完成' : `還記得上次的練習 · 第 ${saved.index + 1} / ${saved.queue.length} 題`}</b><p>{saved.status === 'done' ? '看看收穫，或只複習需要再練的地方。' : '題目、答案和已領取的獎勵都還在。'}</p></div><button className="practice-primary" onClick={() => { setAudioError(false); setActive(true); }}>{saved.status === 'done' ? '看看上次成果' : '繼續上次練習'}</button></section>}
    <section className="practice-config" aria-label="設定新任務"><h3>{saved ? '也可以換個新任務' : '今天想怎麼練習？'}</h3><fieldset><legend>練習方式</legend><div className="practice-choice-row">{(kind === 'quiz' ? QUIZ_MODES : [['tiles', '點單字，接句子'], ['typing', '自己打字挑戰']]).map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div></fieldset><fieldset><legend>這次練多少？</legend><div className="practice-choice-row">{(kind === 'quiz' ? [5, 10] : [3, 5]).map(n => <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{n} {kind === 'quiz' ? '個單字' : '個句子'}{n === (kind === 'quiz' ? 5 : 3) ? ' · 輕輕開始' : ' · 多練一點'}</button>)}</div></fieldset><p>{kind === 'quiz' ? '不計時。每題都會告訴你意思，答錯可以再試。' : '不會自動播放。可以重聽、放慢，也能看句子提示。'}</p>{saved && <p className="practice-save-note">開始新任務會取代上次的練習進度。</p>}<button className="practice-primary" disabled={!hasContent} onClick={start}>開始新的小任務 →</button>{!hasContent && <p role="status">教材還沒準備好，可以先回首頁選其他活動。</p>}</section>{note}
  </div>;

  const qi = saved.queue[saved.index], question = saved.questions[qi], record = saved.records[qi];
  const review = practiceNeedsReview(saved), firstScore = saved.records.filter(r => r.firstCorrect).length;
  const learned = saved.records.filter(r => r.earned).length;
  if (saved.status === 'done') return <div className="practice-world">{header}<section className="practice-complete" aria-label="小任務完成"><PracticeArt kind={kind} complete /><span className="practice-eyebrow">今天又多學會了一點</span><h2 ref={heading} tabIndex={-1}>{saved.round === 'review' ? '複習完成，辛苦了！' : '小任務完成了！'}</h2><p>留下這次的收穫，也留一點時間休息。</p><div className="practice-metrics"><div><b>{saved.questions.length}</b><span>練習過</span></div><div><b>{firstScore}</b><span>第一次就答對</span></div><div><b>{learned}</b><span>已答對過</span></div></div><div className="practice-actions">{review.length > 0 && <button className="practice-primary" onClick={() => act({ type: 'REVIEW' })}>只練需要再看的 {review.length} 題</button>}<button onClick={pause}>換個小任務</button><button onClick={exit}>回首頁休息</button></div><p className="practice-save-note">同一份任務，每題只領一次獎勵；複習不會重複領取。</p></section>
    <section className="practice-review-list"><h3>把這些帶走</h3><p>點喇叭再聽一次，跟著念也很好。</p>{saved.questions.map((q, index) => <div key={index}><span className={`practice-leaf ${saved.records[index].firstCorrect && !saved.records[index].hinted ? 'is-learned' : ''}`} aria-hidden="true">♧</span><div><b lang="en">{kind === 'quiz' ? q.item.w : q.answer}</b>{kind === 'quiz' && <p>{q.item.m}</p>}<small>{saved.records[index].firstCorrect && !saved.records[index].hinted ? '第一次就做到了' : '值得再認識一次'}</small></div><button aria-label={`朗讀 ${kind === 'quiz' ? q.item.w : q.answer}`} onClick={() => listen(kind === 'quiz' ? q.item.w : q.answer)}>♫</button></div>)}{kind === 'quiz' && review.length > 0 && onReviewWords && <button onClick={() => { stop(); onReviewWords(review.map(i => saved.questions[i].item)); }}>用單字卡慢慢複習 →</button>}</section>{audioError && <p role="status">目前無法播放，稍後可以再試。</p>}{note}</div>;

  const comparison = kind === 'listening' && saved.feedback !== null ? compareDictation(question.answer, saved.answer) : null;
  return <div className="practice-world" data-practice-kind={kind}>{header}<div className="practice-toolbar"><span>{saved.round === 'review' ? '再認識一次' : title} · {saved.index + 1} / {saved.queue.length}</span><button onClick={pause}>Ⅱ 先休息一下</button></div><progress className="practice-progress" aria-label="小任務進度" max={saved.queue.length} value={saved.index + Number(saved.feedback !== null)} />
    <section className="practice-question" aria-label="目前題目"><div className="practice-question-number">第 {saved.index + 1} 題 · {kind === 'quiz' ? '想一想，再選答案' : '先聽，再慢慢組成句子'}</div>
      <h2 ref={heading} tabIndex={-1} className={kind === 'quiz' ? 'practice-word' : ''} lang={kind === 'quiz' && question.kind === 'en2zh' ? 'en' : undefined}>{kind === 'quiz' ? question.prompt : '小耳朵，準備好了嗎？'}</h2>
      {kind === 'quiz' ? <><p>{question.kind === 'en2zh' ? '選出這個單字的中文意思' : '選出對應的英文單字'}</p><div className="practice-audio-tools"><button onClick={() => { if (question.kind === 'zh2en') act({ type: 'HINT' }); listen(question.item.w); }}>♫ {question.kind === 'en2zh' ? '聽單字' : '聽單字提示'}</button>{question.item.ex && <button aria-expanded={saved.hintShown} disabled={saved.feedback !== null} onClick={() => act({ type: 'HINT' })}>看例句線索</button>}</div>{saved.hintShown && question.item.ex && <aside className="practice-hint"><b>例句線索</b><p lang="en">{question.item.ex}</p>{question.item.ez && <p>{question.item.ez}</p>}</aside>}<div className="practice-answer-options">{question.options.map((option, i) => <button key={option} disabled={saved.feedback !== null} className={saved.feedback !== null ? option === question.answer ? 'is-correct' : saved.answer === option ? 'is-retry' : '' : ''} onClick={() => act({ type: 'ANSWER', value: option })}><span aria-hidden="true">{String.fromCharCode(65 + i)}</span><b>{option}</b>{saved.feedback !== null && option === question.answer && <small>正解</small>}</button>)}</div></> : <>
        <div className={`practice-radio ${speaking ? 'is-speaking' : ''}`} aria-hidden="true"><span>♫</span><i /><i /><i /><i /><i /></div><div className="practice-audio-tools"><button className="practice-primary" onClick={() => speaking ? stop() : listen(question.answer)}>{speaking ? '■ 停止播放' : '▶ 聽這個句子'}</button><div className="practice-speed" role="group" aria-label="朗讀速度">{[[.6, '慢慢聽'], [.75, '正常速度']].map(([value, label]) => <button key={value} aria-pressed={rate === value} onClick={() => { setRate(value); if (speaking) listen(question.answer, value); }}>{label}</button>)}</div></div>
        {saved.mode === 'tiles' ? <div className="practice-tiles-area"><p id="practice-tile-instruction">依序點選下面的單字。點上方已選的單字，可以放回去。</p><div className="practice-sentence" aria-label="你組成的句子">{saved.pickedTiles.length ? saved.pickedTiles.map(id => <button key={id} disabled={saved.feedback !== null} aria-label={`放回 ${question.tiles.find(t => t.id === id).text}`} onClick={() => act({ type: 'TILE', id })}>{question.tiles.find(t => t.id === id).text}</button>) : <span>句子會出現在這裡…</span>}</div><div className="practice-tile-bank" aria-describedby="practice-tile-instruction">{question.tiles.map(tile => <button key={tile.id} disabled={saved.feedback !== null || saved.pickedTiles.includes(tile.id)} onClick={() => act({ type: 'TILE', id: tile.id })}>{tile.text}</button>)}</div></div> : <div className="practice-writing"><label htmlFor="practice-listening-input">你聽到了什麼？</label><textarea ref={input} id="practice-listening-input" value={saved.answer} disabled={saved.feedback !== null} autoCapitalize="off" autoCorrect="off" spellCheck={false} rows={3} maxLength={500} placeholder="把聽到的英文寫在這裡…" onChange={e => act({ type: 'INPUT', value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !e.repeat) { e.preventDefault(); act({ type: 'ANSWER' }); } }} /><small>大小寫、標點和多餘空格不影響答案。</small></div>}
        {saved.feedback === null && <div className="practice-actions"><button className="practice-primary" disabled={!saved.answer.trim()} onClick={() => { stop(); act({ type: 'ANSWER' }); }}>看看我的答案</button><button aria-expanded={saved.hintShown} onClick={() => act({ type: 'HINT' })}>看句子提示</button></div>}{saved.hintShown && <aside className="practice-hint"><b>先跟著念，再試一次</b><p lang="en">{question.answer}</p></aside>}
      </>}
      {audioError && <p className="practice-audio-error" role="status">目前無法播放，可以稍後重試，或先看提示練習。</p>}
      {saved.feedback !== null && <div className={`practice-feedback ${saved.feedback ? 'is-correct' : ''}`} role="status"><h3>{saved.feedback ? record.attempts > 1 ? '再試一次，就做到了！' : '答對了，收下一點進步！' : '差一點點，一起再看看'}</h3>{kind === 'quiz' ? <><p><b lang="en">{question.item.w}</b> · {question.item.m}</p>{question.item.ex && <p lang="en">{question.item.ex}</p>}{question.item.ez && <p>{question.item.ez}</p>}</> : <><p>對照句子：綠色是已寫對的字，底線是需要再聽的地方。</p><div className="practice-word-diff" lang="en">{comparison.words.map((word, i) => <span key={i} className={word.match ? 'is-match' : 'is-missing'}>{word.word}</span>)}</div>{comparison.extras.length > 0 && <p>這些字可以再檢查：<b lang="en">{comparison.extras.join(' · ')}</b></p>}<button onClick={() => listen(question.answer, .6)}>♫ 再慢慢聽一次</button></>}
        <div className="practice-actions">{!saved.feedback && <button className="practice-primary" onClick={() => { act({ type: 'RETRY' }); input.current?.focus(); }}>再試一次</button>}<button className={saved.feedback ? 'practice-primary' : ''} onClick={() => act({ type: 'NEXT' })}>{saved.index + 1 === saved.queue.length ? '看看這次的收穫 →' : saved.feedback ? '準備好了，下一題 →' : '先記下來，下一題 →'}</button></div></div>}
    </section>{note}</div>;
}
