import { useEffect, useRef, useState } from 'react';
import { PICTURE_BOOKS, validatePictureBookProgress } from '../data/pictureBooks.js';
import { useWorkshopStorage } from './workshopStorage.js';
import { storyWords, usePictureBookNarration } from './pictureBookNarration.js';
import { pictureBookAudioItem } from '../data/pictureBookAudio.js';
import { usePictureBookAudio } from './usePictureBookAudio.js';
import PictureBookArt from '../components/PictureBookArt.jsx';
import PictureBookStage from '../components/PictureBookStage.jsx';
import './picture-books.css';

function AnimatedWords({ text, active, onWord, motion }) {
  return <p className={`pb-sentence ${motion ? '' : 'pb-no-motion'}`} aria-label={text} lang="en">
    {storyWords(text).map((word, i) => <span className="pb-word-space" key={`${word.start}-${word.text}`}><button className={`pb-story-word ${active === i ? 'is-speaking' : ''}`} aria-label={`朗讀單字 ${word.text.replace(/[.!?,]/g, '')}`} aria-current={active === i ? 'true' : undefined} onClick={() => onWord(word, i)} style={{ '--word-order': i }}><span aria-hidden="true">{[...word.text].map((letter, j) => <span className="pb-letter" key={j} style={{ '--letter-order': j }}>{letter}</span>)}</span></button>{' '}</span>)}
  </p>;
}

export default function PictureBooks({ onBack, onXp, speak, stopSpeech }) {
  const { book: progress, live, save, saveError } = useWorkshopStorage('eg_pictureBooks_v1', {}, validatePictureBookProgress);
  const [id, setId] = useState(null), [index, setIndex] = useState(0), [translation, setTranslation] = useState(false), [motion, setMotion] = useState(true);
  const [selected, setSelected] = useState(null), [feedback, setFeedback] = useState(''), [answer, setAnswer] = useState(null), [view, setView] = useState(0), [continuous, setContinuous] = useState(false);
  const [cameraReset, setCameraReset] = useState(0);
  const root = useRef(null), heading = useRef(null), continuousRef = useRef(false);
  const narration = usePictureBookNarration(speak, stopSpeech);
  const book = PICTURE_BOOKS.find(b => b.id === id), page = book?.pages[index];
  const audio = usePictureBookAudio(book);
  const saved = progress[id] || { page: 0, found: [], completed: false };
  const words = page ? storyWords(page.en) : [];
  const speaking = narration.status === 'playing', paused = narration.status === 'paused', loading = narration.status === 'loading';
  useEffect(() => { if (narration.error) { continuousRef.current = false; setContinuous(false); } }, [narration.error]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!root.current) return;
      root.current.style.scrollMarginTop = `${(document.querySelector('.eg-app-nav')?.getBoundingClientRect().height || 100) + 12}px`;
      root.current.focus({ preventScroll: true }); root.current.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [id]);
  function update(values, bookId = id) { save({ ...live.current, [bookId]: { ...(live.current[bookId] || { page: 0, found: [], completed: false }), ...values } }); }
  function stop() { continuousRef.current = false; setContinuous(false); narration.stop(); }
  function resetPage() { setSelected(null); setFeedback(''); setAnswer(null); }
  function open(next) { stop(); resetPage(); setId(next.id); setIndex(progress[next.id]?.page || 0); setTranslation(false); setView(0); }
  function turn(next) {
    stop(); resetPage(); setIndex(next); update({ page: next });
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }
  function readPage(readIndex = index, auto = false) {
    const readingBook = book;
    continuousRef.current = auto; setContinuous(auto);
    const item = pictureBookAudioItem(readingBook, readIndex);
    narration.start(item.text, { audioUrl: item.audioUrl, rate: item.rate, onFinish: () => {
      if (!continuousRef.current) return;
      if (readIndex >= readingBook.pages.length - 1) { continuousRef.current = false; setContinuous(false); return; }
      const next = readIndex + 1;
      resetPage(); setIndex(next); update({ page: next }, readingBook.id); readPage(next, true);
    } });
  }
  function pick(object) {
    stop(); setSelected(object.word);
    const foundWord = words.findIndex(word => word.text.replace(/[^a-z]/gi, '').toLowerCase() === object.word);
    narration.start(object.word, { offset: foundWord });
    if (object.word === page.target) {
      const found = live.current[id]?.found || [];
      if (!found.includes(index)) update({ found: [...found, index] });
      setFeedback(`找到了！${object.word} 是${object.zh}。`);
    } else setFeedback(`這是 ${object.word}（${object.zh}）。再找找 ${page.target}！`);
  }
  function readWord(word, position) { stop(); setSelected(word.text.replace(/[^a-z]/gi, '').toLowerCase()); narration.start(word.text, { offset: position }); }
  function choose(option) { setAnswer(option); if (option !== book.quiz.answer || live.current[id]?.completed) return; update({ completed: true }); onXp?.(20); }
  return <section className={`pb-page ${book ? 'pb-reading' : ''} ${motion ? '' : 'pb-no-motion'} ${paused ? 'pb-paused' : ''}`} ref={root} tabIndex={-1} aria-label="互動童書">
    <header className="pb-header"><button onClick={() => { stop(); resetPage(); if (book) setId(null); else onBack(); }}>← {book ? '童書書架' : '返回學習'}</button><span>ENGLISHGO <b>STORYLIGHT</b></span><span className="pb-header-note">讓故事在眼前發生</span></header>
    {saveError && <p role="alert">目前無法儲存進度；離開頁面後可能需要重新閱讀。</p>}
    {!book ? <>
      <div className="pb-intro"><span className="pb-kicker">打開一本書，走進一個世界</span><h1>故事，<br/>在你眼前醒來。</h1><p>翻開立體書，聽故事輕輕說。<br/>跟著跳動的文字，和小夥伴一起冒險。</p><div className="pb-pills"><span>立體書舞台</span><span>文字帶讀</span><span>連續朗讀</span></div><div className="pb-intro-art" aria-hidden="true"><PictureBookArt word="fox"/><span>✦</span></div></div>
      <div className="pb-shelf-heading"><h2>選一本，讓冒險開始</h2><span>2 本原創童書 · 每本 4 幕</span></div>
      <div className="pb-shelf">{PICTURE_BOOKS.map(b => <button className={`pb-cover pb-${b.theme}`} key={b.id} onClick={() => open(b)}><div className="pb-cover-art" aria-hidden="true"><span><PictureBookArt word={b.theme === 'night' ? 'fox' : 'bear'}/></span><i>{b.theme === 'night' ? '☾' : '☀'}</i><div/></div><div className="pb-cover-copy"><small>{b.level} · 約 3 分鐘</small><h3>{b.zh}</h3><p lang="en">{b.title}</p><p>{b.description}</p><strong>{progress[b.id]?.completed ? '已完成 · 再讀一次 ↗' : progress[b.id] ? `繼續第 ${progress[b.id].page + 1} 頁 →` : '翻開故事 →'}</strong></div></button>)}</div>
      <p className="pb-parent-note">親子共讀：先欣賞故事，試著跟讀一句；也可以拖曳看看立體場景，點角色和單字聽發音。</p>
    </> : <>
      <div className="pb-reader-heading"><div><span className="pb-kicker">{book.level} · 立體有聲童書</span><h1 ref={heading} tabIndex={-1}>{book.zh}</h1></div><p lang="en">{book.title}</p><span className="pb-counter">{String(index + 1).padStart(2, '0')} <small>/ 04</small></span></div>
      <article className={`pb-theater ${book.theme}`} aria-label="立體書閱讀舞台">
        <PictureBookStage key={`${id}-${index}`} book={book} page={page} index={index} onPick={pick} selected={selected} spokenWord={words[narration.word]?.text} motion={motion && !paused} view={view} cameraReset={cameraReset}/>
        <div className="pb-stage-caption"><span className="pb-live-dot"/> {continuous ? '故事正在繼續' : '拖曳場景，換個角度看故事'}</div>
        <div className="pb-camera-controls" role="group" aria-label="場景視角"><button aria-label="向左看場景" onClick={() => setView(v => Math.max(-2, v - 1))}>↶</button><button aria-label="回到正面視角" onClick={() => { setView(0); setCameraReset(v => v + 1); }}>◎</button><button aria-label="向右看場景" onClick={() => setView(v => Math.min(2, v + 1))}>↷</button></div>
        <div className="pb-story-card" key={`card-${id}-${index}`}>
          <span className="pb-card-chapter">CHAPTER {String(index + 1).padStart(2, '0')} <span>✧</span></span>
          <AnimatedWords text={page.en} active={narration.word} onWord={readWord} motion={motion}/>
          {translation && <p className="pb-translation">{page.zh}</p>}
          <div className="pb-card-footer"><span>{loading ? '正在準備聲音…' : paused ? '故事暫停中' : speaking ? (narration.approximate ? '依聲音進度帶讀' : '跟著亮起的文字讀') : '點任何單字，聽它怎麼念'}</span><button aria-pressed={translation} onClick={() => setTranslation(!translation)}>{translation ? '隱藏中文' : '顯示中文'}</button></div>
        </div>
        <div className="pb-stage-page" aria-hidden="true">{index + 1}</div>
      </article>
      <div className="pb-reader-controls">
        <button className="pb-round-nav" disabled={index === 0} onClick={() => turn(index - 1)} aria-label="上一頁">←</button>
        <div className="pb-playback"><button className="pb-play" onClick={() => loading ? stop() : paused ? narration.resume() : speaking ? narration.pause() : readPage(index, false)}>{loading ? '■ 取消載入' : paused ? '▶ 繼續朗讀' : speaking ? 'Ⅱ 暫停朗讀' : '▶ 聽這一頁'}</button><button className="pb-auto" aria-pressed={continuous} onClick={() => continuous ? stop() : readPage(index, true)}>{continuous ? '■ 停止連續朗讀' : '♫ 整本讀給我聽'}</button></div>
        <button className="pb-round-nav" disabled={index === book.pages.length - 1} onClick={() => turn(index + 1)} aria-label="下一頁 →">→</button>
        <button className="pb-motion" aria-pressed={motion} onClick={() => setMotion(!motion)}>{motion ? '關閉動畫' : '開啟動畫'}</button>
      </div>
      <div className="pb-audio-download"><span role="status">{audio.status === 'ready' ? `✓ 全本語音已預載 · ${audio.ready} / ${audio.total} 頁` : audio.status === 'loading' ? '↓ 正在預先下載全本語音…' : `語音已準備 ${audio.ready} / ${audio.total} 頁，仍可直接朗讀。`}</span>{['partial', 'unavailable'].includes(audio.status) && <button onClick={audio.retry}>重新下載語音</button>}<small>與小說共用雲端快取；翻頁播放會重用已下載的聲音。</small></div>
      {narration.error && <p className="pb-audio-error" role="alert">{narration.error}</p>}
      <nav className="pb-page-dots" aria-label="童書翻頁">{book.pages.map((_, i) => <button key={i} aria-label={`第 ${i + 1} 頁`} aria-current={index === i ? 'page' : undefined} onClick={() => turn(i)}>{saved.found.includes(i) ? '✓' : String(i + 1).padStart(2, '0')}</button>)}</nav>
      <details className="pb-explore" open><summary>故事小發現 <span>點角色、聽單字</span></summary><div className="pb-explore-body"><div className="pb-word-row">{page.objects.map(o => <button key={o.word} onClick={() => pick(o)} aria-label={`探索 ${o.word}`}><PictureBookArt word={o.word}/><span lang="en">{o.word}</span><small>{o.zh}</small></button>)}</div><div className="pb-mission"><strong>{saved.found.includes(index) ? '✓ 已找到' : '找一找'}</strong><span>{page.prompt}</span></div><p className="pb-feedback" role="status">{feedback || (saved.found.includes(index) ? '這一頁的寶藏已找到，可以再聽聽其他單字。' : '點選立體角色或下方單字，找找故事中的寶藏。')}</p></div></details>
      {index === book.pages.length - 1 && <section className="pb-quiz"><span className="pb-kicker">故事的最後，想一想</span><h2 lang="en">{book.quiz.question}</h2><p>{book.quiz.zh}</p>{saved.found.length < book.pages.length ? <p>已找到 {saved.found.length} / {book.pages.length} 個寶藏。回到還沒有 ✓ 的頁面完成探索，就能挑戰故事問答。</p> : <><div className="pb-answers">{book.quiz.options.map((option, i) => <button key={option} aria-pressed={answer === i} disabled={answer === book.quiz.answer} onClick={() => choose(i)} lang="en">{option}</button>)}</div><p role="status">{answer === null ? (saved.completed ? '你已完成這本童書，歡迎再練一次！' : '答對就完成童書，首次完成可獲得 20 XP。') : answer === book.quiz.answer ? `答對了！${book.quiz.explanation} 童書已完成 ✓` : '再想想故事裡的線索，你可以再試一次。'}</p></>}</section>}
    </>}
  </section>;
}
