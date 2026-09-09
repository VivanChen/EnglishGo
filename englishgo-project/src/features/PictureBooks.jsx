import { useEffect, useRef, useState } from 'react';
import { PIP_VOCAB } from '../data/pipBook.js';
import { MILO_VOCAB } from '../data/miloBook.js';
import { DORI_VOCAB, DORI_QUESTIONS, DORI_PATTERNS } from '../data/doriBook.js';
import BookReadingGuide from './BookReadingGuide.jsx';
import './pip-book-host.css';
const BOOKS = [
 {id:'pip-and-the-lost-star',title:'Pip and the Lost Star',zh:'皮皮與迷路的小星星',vocab:PIP_VOCAB,icon:'🦊'},
 {id:'milo-and-the-little-storm',title:'Prince Milo and the Little Storm',zh:'米洛王子的小風暴',vocab:MILO_VOCAB,icon:'👑'},
 {id:'dori-and-the-echo-in-the-mist',title:'Dori and the Echo in the Mist',zh:'小恐龍朵里尋找媽媽',vocab:DORI_VOCAB,icon:'🦕',level:'國小五～六年級',questions:DORI_QUESTIONS,patterns:DORI_PATTERNS}
];

export default function PictureBooks({ onBack, stopSpeech }) {
  const frame = useRef(null);
  const [bookIndex, setBookIndex] = useState(0);
  const book = BOOKS[bookIndex];
  const [height, setHeight] = useState(700);
  useEffect(() => {
    stopSpeech?.();
    function receive(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'pip:height' && Number.isFinite(event.data.height)) setHeight(Math.max(300, Math.min(2200, event.data.height)));
    }
    window.addEventListener('message', receive);
    const node = frame.current;
    const child = node?.contentWindow;
    return () => { window.removeEventListener('message', receive); if (node?.isConnected) child?.postMessage({ type: 'pip:stop' }, window.location.origin); stopSpeech?.(); };
  }, [stopSpeech, bookIndex]);
  function word(key) { frame.current?.contentWindow?.postMessage({ type: 'pip:word', word: key }, window.location.origin); }
  return <section className="pip-book-host" aria-label="互動童書">
    <header><button onClick={onBack}>← 返回學習</button><div><h1>{book.title}</h1><p>{book.zh} · 8 頁互動立體童書{book.level ? ` · ${book.level}` : ''}</p></div></header>
    <nav className="storybook-picker" aria-label="選擇童書">{BOOKS.map((item,i)=><button key={item.id} aria-pressed={bookIndex===i} onClick={()=>{if(i===bookIndex)return;frame.current?.contentWindow?.postMessage({type:'pip:stop'},window.location.origin);setHeight(700);setBookIndex(i);}}>{item.icon} {item.zh}</button>)}</nav>
    <iframe key={book.id} ref={frame} src={`/picture-books/${book.id}.html`} title={`${book.title} 互動立體童書`} style={{ height }} allow="autoplay"/>
    <p className="pip-book-note">每個英文單字都能點讀；有底線的重點單字會顯示中英單字卡。文章與單字使用預先生成的音檔；黃色高亮依播放進度估算。</p>
    {book.questions && <BookReadingGuide key={`guide-${book.id}`} questions={book.questions} patterns={book.patterns}/>}
    <details className="pip-vocabulary"><summary>故事單字表 · {Object.keys(book.vocab).length} 個重點單字</summary><div>{Object.entries(book.vocab).map(([key,[icon,zh]]) => <button key={key} onClick={() => word(key)} aria-label={`朗讀 ${key} ${zh}`}><span aria-hidden="true">{icon}</span><strong lang="en">{key}</strong><span>{zh}</span></button>)}</div></details>
  </section>;
}
