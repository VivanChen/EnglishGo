import { useEffect, useRef, useState } from 'react';
import { PICTURE_BOOKS, validatePictureBookProgress } from '../data/pictureBooks.js';
import { useWorkshopStorage } from './workshopStorage.js';
import './picture-books.css';
import PictureBookArt from '../components/PictureBookArt.jsx';

function Scene({ book, page, onPick, selected, motion }) {
  return <div className={`pb-scene pb-${book.theme} ${motion ? '' : 'pb-still'}`} aria-label="互動故事插畫">
    <div className="pb-sky" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <div className="pb-hill pb-far" aria-hidden="true"/><div className="pb-hill pb-near" aria-hidden="true"/>
    <div className="pb-trees" aria-hidden="true"><PictureBookArt word="tree"/><PictureBookArt word="tree"/><PictureBookArt word="tree"/></div>
    {page.objects.map(object => <button key={object.word} className={`pb-object ${selected === object.word ? 'pb-selected' : ''}`} style={{ left: `${object.x}%`, top: `${object.y}%` }} onClick={() => onPick(object)} aria-label={`探索 ${object.word}`}><span aria-hidden="true"><PictureBookArt word={object.word}/></span><small lang="en">{object.word}</small></button>)}
    <div className="pb-grass" aria-hidden="true"/>
    <span className="pb-scene-label">點一點，發現故事裡的單字</span>
  </div>;
}

export default function PictureBooks({ onBack, onXp, speak, stopSpeech }) {
  const { book: progress, live, save, saveError } = useWorkshopStorage('eg_pictureBooks_v1', {}, validatePictureBookProgress);
  const [id, setId] = useState(null), [index, setIndex] = useState(0), [translation, setTranslation] = useState(false), [motion, setMotion] = useState(true);
  const [selected, setSelected] = useState(null), [feedback, setFeedback] = useState(''), [answer, setAnswer] = useState(null), [reading, setReading] = useState(false), [audioError, setAudioError] = useState('');
  const heading = useRef(null), root = useRef(null);
  const book = PICTURE_BOOKS.find(b => b.id === id), page = book?.pages[index], saved = progress[id] || { page: 0, found: [], completed: false };
  useEffect(() => () => stopSpeech(), [stopSpeech]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!root.current) return;
      root.current.style.scrollMarginTop = `${(document.querySelector('.eg-app-nav')?.getBoundingClientRect().height || 100) + 12}px`;
      root.current.focus({ preventScroll: true });
      root.current.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [id]);
  function silence() { stopSpeech(); setReading(false); }
  function resetPage() { silence(); setSelected(null); setFeedback(''); setAnswer(null); setAudioError(''); }
  function update(values) { save({ ...live.current, [id]: { ...(live.current[id] || { page: 0, found: [], completed: false }), ...values } }); }
  function open(next) { resetPage(); setId(next.id); setIndex(progress[next.id]?.page || 0); setTranslation(false); }
  function turn(next) { resetPage(); setIndex(next); update({ page: next }); heading.current?.focus(); }
  function say(text) {
    silence(); setAudioError(''); setReading(true);
    try {
      const utterance = speak(text, 'en-US', 0.8, { onend: () => setReading(false), oncancel: () => setReading(false), onerror: () => { setReading(false); setAudioError('朗讀暫時無法播放，請再試一次。'); } });
      if (!utterance) { setReading(false); setAudioError('這個瀏覽器目前無法朗讀，仍可看圖閱讀與完成任務。'); }
    } catch { setReading(false); setAudioError('朗讀暫時無法播放，請再試一次。'); }
  }
  function pick(object) {
    setSelected(object.word); say(object.word);
    if (object.word === page.target) {
      const found = live.current[id]?.found || [];
      if (!found.includes(index)) update({ found: [...found, index] });
      setFeedback(`找到了！${object.word} 是${object.zh}。`);
    } else setFeedback(`這是 ${object.word}（${object.zh}）。再找找 ${page.target}！`);
  }
  function choose(option) {
    setAnswer(option);
    if (option !== book.quiz.answer || live.current[id]?.completed) return;
    update({ completed: true });
    onXp?.(20);
  }
  return <section className="pb-page" ref={root} tabIndex={-1} aria-label="互動童書">
    <header className="pb-header"><button onClick={() => { resetPage(); if (book) setId(null); else onBack(); }}>← {book ? '童書書架' : '返回學習'}</button><span>ENGLISHGO <b>STORYTIME</b></span></header>
    {saveError && <p role="alert">目前無法儲存進度；離開頁面後可能需要重新閱讀。</p>}
    {!book ? <>
      <div className="pb-intro"><span className="pb-kicker">小小讀者，大大冒險</span><h1>把故事，<br/>變成你的冒險。</h1><p>聽一句、點一點、找一找。<br/>每翻一頁，都多懂一點英文。</p><div className="pb-pills"><span>雙語閱讀</span><span>有聲探索</span><span>互動找物</span></div><div className="pb-intro-art" aria-hidden="true">📖<span>✦</span></div></div>
      <div className="pb-shelf-heading"><h2>今天想走進哪個故事？</h2><span>2 本原創童書 · 每本 4 頁</span></div>
      <div className="pb-shelf">{PICTURE_BOOKS.map(b => <button className={`pb-cover pb-${b.theme}`} key={b.id} onClick={() => open(b)}><div className="pb-cover-art" aria-hidden="true"><span><PictureBookArt word={b.theme === 'night' ? 'fox' : 'bear'}/></span><i>{b.theme === 'night' ? '☾' : '☀'}</i><div/></div><div className="pb-cover-copy"><small>{b.level} · 約 3 分鐘</small><h3>{b.zh}</h3><p lang="en">{b.title}</p><p>{b.description}</p><strong>{progress[b.id]?.completed ? '已完成 · 再讀一次 ↗' : progress[b.id] ? `繼續第 ${progress[b.id].page + 1} 頁 →` : '翻開故事 →'}</strong></div></button>)}</div>
      <p className="pb-parent-note">親子共讀小提示：先聽英文，再讓孩子指一指畫面；需要時再打開中文。</p>
    </> : <>
      <div className="pb-reader-heading"><div><span className="pb-kicker">{book.level} · 互動童書</span><h1 ref={heading} tabIndex={-1}>{book.zh}</h1><p lang="en">{book.title}</p></div><span className="pb-counter">{index + 1} / {book.pages.length}</span></div>
      <div className="pb-toolbar"><button aria-pressed={translation} onClick={() => setTranslation(!translation)}>{translation ? '隱藏中文' : '顯示中文'}</button><button aria-pressed={motion} onClick={() => setMotion(!motion)}>{motion ? '關閉動畫' : '開啟動畫'}</button><button onClick={() => reading ? silence() : say(page.en)}>{reading ? '■ 停止朗讀' : '▶ 聽這一頁'}</button></div>
      <article className="pb-book" key={`${id}-${index}`}><Scene book={book} page={page} onPick={pick} selected={selected} motion={motion}/><div className="pb-paper"><p className="pb-sentence" lang="en">{page.en}</p>{translation && <p className="pb-translation">{page.zh}</p>}<div className="pb-word-row">{page.objects.map(o => <button key={o.word} onClick={() => pick(o)}><span lang="en">{o.word}</span><small>{o.zh}</small></button>)}</div><div className="pb-mission"><span>{saved.found.includes(index) ? '✓' : '⌕'}</span><div><strong>小小探索任務</strong><p>{page.prompt}</p></div></div><p className="pb-feedback" role="status">{feedback || (saved.found.includes(index) ? '這一頁的寶藏已找到，可以再聽聽其他單字。' : '點選插畫中的角色或物品，聽聽它的英文。')}</p>{audioError && <p role="alert">{audioError}</p>}</div></article>
      <nav className="pb-pagination" aria-label="童書翻頁"><button disabled={index === 0} onClick={() => turn(index - 1)}>← 上一頁</button><div>{book.pages.map((_, i) => <button key={i} aria-label={`第 ${i + 1} 頁`} aria-current={index === i ? 'page' : undefined} onClick={() => turn(i)}>{saved.found.includes(i) ? '✓' : i + 1}</button>)}</div><button disabled={index === book.pages.length - 1} onClick={() => turn(index + 1)}>下一頁 →</button></nav>
      {index === book.pages.length - 1 && <section className="pb-quiz"><span className="pb-kicker">故事的最後，想一想</span><h2 lang="en">{book.quiz.question}</h2><p>{book.quiz.zh}</p>{saved.found.length < book.pages.length ? <p>已找到 {saved.found.length} / {book.pages.length} 個寶藏。回到還沒有 ✓ 的頁面完成探索，就能挑戰故事問答。</p> : <><div className="pb-answers">{book.quiz.options.map((option, i) => <button key={option} aria-pressed={answer === i} disabled={answer === book.quiz.answer} onClick={() => choose(i)} lang="en">{option}</button>)}</div><p role="status">{answer === null ? (saved.completed ? '你已完成這本童書，歡迎再練一次！' : '答對就完成童書，首次完成可獲得 20 XP。') : answer === book.quiz.answer ? `答對了！${book.quiz.explanation} 童書已完成 ✓` : '再想想故事裡的線索，你可以再試一次。'}</p></>}</section>}
    </>}
  </section>;
}
