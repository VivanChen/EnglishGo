import { useEffect, useRef, useState } from 'react';
import { PIP_PAGES, PIP_VOCAB } from '../data/pipBook.js';
import { MILO_PAGES, MILO_VOCAB } from '../data/miloBook.js';
import { DORI_PAGES, DORI_VOCAB, DORI_QUESTIONS, DORI_PATTERNS } from '../data/doriBook.js';
import { bookWords } from '../data/storybookAudio.js';
import { STORYBOOK_QUESTS } from '../data/storybookQuests.js';
import BookReadingGuide from './BookReadingGuide.jsx';
import { BOOK_FINISH_XP, STAR_XP, readPictureBookProgress, recordFinish, recordPage, recordStar, writePictureBookProgress } from './pictureBookProgress.js';
import './pip-book-host.css';
export const BOOK_READING_GUIDES = {
 'pip-and-the-lost-star': {
  questions: [
   {q:'Where does the falling star land?',zh:'掉下來的星星落在哪裡？',options:['In Pip’s garden.','Inside the owl’s tree.','On the roof of a shop.'],answer:0,explanation:'The star lands in the garden with a soft “plop.” 星星「噗通」一聲落在皮皮的花園裡。'},
   {q:'Where can the star finally jump back into the sky?',zh:'星星最後在哪裡跳回天空？',options:['At the bottom of the forest.','At the top of the mountain.','Inside Pip’s small house.'],answer:1,explanation:'At the mountain top, the sky is close and the star jumps up. 到了山頂，天空變得好近，星星便跳了上去。'},
  ],
  patterns: [['Pip put the star in a basket.','put ... in ...：把……放進……。皮皮把星星放進籃子裡。'],['The star grew brighter and brighter.','brighter and brighter：越來越亮。用比較級的重複描述逐漸發生的變化。']],
 },
 'milo-and-the-little-storm': {
  questions: [
   {q:'Why does Milo’s block castle fall?',zh:'米洛的積木城堡為什麼倒了？',options:['Milo asks Ruby to kick it.','A bird carries the blocks away.','Ruby’s ribbon catches a block.'],answer:2,explanation:'Ruby’s long ribbon catches one of the wooden blocks. 露比的長緞帶勾住了一塊木頭積木，城堡因此倒下。'},
   {q:'What helps Milo choose a calmer action?',zh:'什麼幫助米洛採取比較平靜的行動？',options:['Stopping, breathing slowly, and saying how he feels.','Kicking all the blocks across the room.','Pretending he never feels angry.'],answer:0,explanation:'Milo pauses by a tree, takes slow breaths, and explains that he feels sad and angry. 米洛先在樹旁停下、慢慢呼吸，再說出難過與生氣的感受。'},
  ],
  patterns: [['I need some space.','I need ...：我需要……。可以清楚說明自己目前的需要。'],['Next time, I can stop, breathe, and use my words.','Next time, I can ...：下次，我可以……。把練過的方法變成下一次的選擇。']],
 },
};
const BOOKS = [
 {id:'pip-and-the-lost-star',title:'Pip and the Lost Star',zh:'皮皮與迷路的小星星',pages:PIP_PAGES,vocab:PIP_VOCAB,icon:'🦊',...BOOK_READING_GUIDES['pip-and-the-lost-star']},
 {id:'milo-and-the-little-storm',title:'Prince Milo and the Little Storm',zh:'米洛王子的小風暴',pages:MILO_PAGES,vocab:MILO_VOCAB,icon:'👑',...BOOK_READING_GUIDES['milo-and-the-little-storm']},
 {id:'dori-and-the-echo-in-the-mist',title:'Dori and the Echo in the Mist',zh:'小恐龍朵里尋找媽媽',pages:DORI_PAGES,vocab:DORI_VOCAB,icon:'🦕',level:'國小五～六年級',questions:DORI_QUESTIONS,patterns:DORI_PATTERNS}
].map(book=>({...book,pageCount:book.pages.length,quests:STORYBOOK_QUESTS[book.id],words:new Set(bookWords(book))}));

// Phones (and short landscape phones) read the book full screen once it is opened.
const PHONE_QUERY='(max-width: 600px), (max-height: 520px) and (pointer: coarse)';
function usePhoneLayout(){
  const [phone,setPhone]=useState(()=>typeof window.matchMedia==='function'&&window.matchMedia(PHONE_QUERY).matches);
  useEffect(()=>{
    if(typeof window.matchMedia!=='function')return undefined;
    const query=window.matchMedia(PHONE_QUERY),sync=()=>setPhone(query.matches);
    sync();query.addEventListener?.('change',sync);
    return ()=>query.removeEventListener?.('change',sync);
  },[]);
  return phone;
}

function shelfStatus(entry){
  if(entry.completed)return '已讀完';
  if(entry.seen.length)return `讀到第 ${entry.page+1} 頁`;
  return '新故事';
}

export default function PictureBooks({ onBack, stopSpeech, onLearningEvent, onXp, trackWeak }) {
  const frame = useRef(null), guideBox = useRef(null);
  const [bookIndex, setBookIndex] = useState(0);
  const book = BOOKS[bookIndex];
  const [height, setHeight] = useState(700);
  const [progress, setProgress] = useState(() => readPictureBookProgress(BOOKS));
  const live = useRef(progress);
  const [reading, setReading] = useState(false);
  const [guideRequest, setGuideRequest] = useState(0);
  const phone = usePhoneLayout();
  const immersive = reading && phone;
  const immersiveNow = useRef(immersive); immersiveNow.current = immersive;
  const autoOpen = useRef(false), openTimer = useRef(null), guideHandled = useRef(0);
  const handle = useRef(() => {});

  const send = message => frame.current?.contentWindow?.postMessage(message, window.location.origin);
  // Save before rewarding, so a reload can never award the same star or finish twice.
  function update(id, change) {
    const next = { ...live.current, [id]: change(live.current[id]) };
    live.current = next; writePictureBookProgress(next); setProgress(next);
  }
  function selectBook(index, { openNext = false } = {}) {
    if (index === bookIndex) return;
    send({ type: 'pip:stop' }); setHeight(700); setBookIndex(index);
    clearTimeout(openTimer.current); autoOpen.current = openNext;
    if (openNext) openTimer.current = setTimeout(() => { autoOpen.current = false; setReading(false); }, 12000);
    else setReading(false);
  }
  const validQuest = data => Number.isInteger(data.page) && typeof data.word === 'string' && book.quests?.[data.page] === data.word && live.current[book.id].seen.includes(data.page);

  handle.current = data => {
    const id = book.id;
    switch (data?.type) {
      case 'pip:height': if (Number.isFinite(data.height)) setHeight(Math.max(300, Math.min(2200, data.height))); break;
      case 'pip:ready': {
        clearTimeout(openTimer.current);
        const entry = live.current[id];
        send({ type: 'pip:immersive', active: immersiveNow.current });
        send({ type: 'pip:init', page: entry.page, stars: entry.stars, completed: entry.completed, autoOpen: autoOpen.current });
        autoOpen.current = false; break;
      }
      case 'pip:reading': setReading(data.open === true); break;
      case 'pip:page': update(id, entry => recordPage(entry, data.page, book.pageCount)); break;
      case 'pip:star': {
        if (!validQuest(data)) break;
        let added = false;
        update(id, entry => { const result = recordStar(entry, data.page, book.pageCount); added = result.added; return result.entry; });
        if (added) { onXp?.(STAR_XP); if (data.firstTry === true) trackWeak?.(data.word, -1); }
        break;
      }
      case 'pip:miss': if (validQuest(data)) trackWeak?.(data.word, 1); break;
      case 'pip:review': if (typeof data.word === 'string' && book.words.has(data.word)) trackWeak?.(data.word, 1); break;
      case 'pip:finish': {
        let result;
        update(id, entry => { result = recordFinish(entry, book.pageCount); return result.entry; });
        const xp = result.first ? BOOK_FINISH_XP : 0;
        if (result.first) {
          onXp?.(xp);
          onLearningEvent?.({id:`pictureBooks:${id}:read:v1`,source:'pictureBooks',level:'elementary',contentId:id,kind:'complete',outcome:'participated',activity:'storybook',pageCount:book.pageCount,starCount:live.current[id].stars.length,occurredAt:new Date().toISOString()});
        }
        send({ type: 'pip:reward', xp, first: result.first, missing: result.missing });
        break;
      }
      case 'pip:guide': setGuideRequest(n => n + 1); break;
      case 'pip:next-book': selectBook((bookIndex + 1) % BOOKS.length, { openNext: true }); break;
      default: break;
    }
  };

  useEffect(() => {
    stopSpeech?.();
    function receive(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      handle.current(event.data);
    }
    window.addEventListener('message', receive);
    const node = frame.current;
    const child = node?.contentWindow;
    return () => { window.removeEventListener('message', receive); if (node?.isConnected) child?.postMessage({ type: 'pip:stop' }, window.location.origin); stopSpeech?.(); };
  }, [stopSpeech, bookIndex]);
  useEffect(() => () => clearTimeout(openTimer.current), []);

  // Tell the book whether it fills the phone screen, and keep the page behind it still.
  useEffect(() => { send({ type: 'pip:immersive', active: immersive }); }, [immersive]);
  useEffect(() => {
    if (!immersive) return undefined;
    const html = document.documentElement, previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = previous; };
  }, [immersive]);
  // "讀後探索" from the last page opens the guide once the full-screen book has closed.
  useEffect(() => {
    if (!guideRequest || immersive || guideHandled.current === guideRequest) return;
    guideHandled.current = guideRequest;
    const details = guideBox.current?.querySelector('details');
    if (details) { details.open = true; details.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }
  }, [guideRequest, immersive]);

  function word(key) { send({ type: 'pip:word', word: key }); }
  function completeGuide({questionCount}) {
    onLearningEvent?.({id:`pictureBooks:${book.id}:guide:v1`,source:'pictureBooks',level:'elementary',contentId:book.id,kind:'complete',outcome:'participated',activity:'reading-guide',questionCount,occurredAt:new Date().toISOString()});
  }
  return <section className={`pip-book-host${immersive ? ' is-immersive' : ''}`} aria-label="互動童書">
    <header><button className="pip-back" onClick={onBack}>← 返回學習</button><div><h1>{book.title}</h1><p>{book.zh} · {book.pageCount} 頁互動立體童書{book.level ? ` · ${book.level}` : ''}</p></div></header>
    <nav className="storybook-shelf" aria-label="選擇童書">{BOOKS.map((item,i)=>{
      const entry=progress[item.id],status=shelfStatus(entry),percent=entry.completed?100:Math.round(entry.seen.length/item.pageCount*100);
      return <button key={item.id} type="button" aria-pressed={bookIndex===i} aria-label={`${item.zh}，${status}，星星 ${entry.stars.length} / ${item.pageCount}`} onClick={()=>selectBook(i)}>
        <span className="shelf-icon" aria-hidden="true">{item.icon}</span>
        <span className="shelf-text">
          <strong>{item.zh}</strong><small lang="en">{item.title}</small>
          <span className="shelf-meta"><span className="shelf-stars">★ {entry.stars.length}/{item.pageCount}</span><span className={entry.completed?'shelf-done':''}>{entry.completed?'✓ ':''}{status}</span></span>
          <span className="shelf-bar" aria-hidden="true"><i style={{width:`${percent}%`}}/></span>
        </span>
      </button>;})}</nav>
    <div className="pip-book-frame">
      <iframe key={book.id} ref={frame} src={`/picture-books/${book.id}.html`} title={`${book.title} 互動立體童書`} style={{ height }} allow="autoplay"/>
    </div>
    <p className="pip-book-note">點任何英文單字都能聽發音，有底線的重點單字會跳出中英單字卡。每頁聽完故事後玩「找找看」，在圖中找到單字就能收集星星；讀完整本書可以領取 XP。</p>
    {book.questions && <div ref={guideBox}><BookReadingGuide key={`guide-${book.id}`} storageKey={`eg_pictureBookGuide:${book.id}:v1`} questions={book.questions} patterns={book.patterns} onComplete={completeGuide}/></div>}
    <details className="pip-vocabulary"><summary>故事單字表 · {Object.keys(book.vocab).length} 個重點單字</summary><div>{Object.entries(book.vocab).map(([key,[icon,zh]]) => <button key={key} onClick={() => word(key)} aria-label={`朗讀 ${key} ${zh}`}><span aria-hidden="true">{icon}</span><strong lang="en">{key}</strong><span>{zh}</span></button>)}</div></details>
  </section>;
}
