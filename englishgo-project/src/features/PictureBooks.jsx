import { useEffect, useRef, useState } from 'react';
import { PIP_VOCAB } from '../data/pipBook.js';
import { MILO_VOCAB } from '../data/miloBook.js';
import { DORI_VOCAB, DORI_QUESTIONS, DORI_PATTERNS } from '../data/doriBook.js';
import BookReadingGuide from './BookReadingGuide.jsx';
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
 {id:'pip-and-the-lost-star',title:'Pip and the Lost Star',zh:'皮皮與迷路的小星星',vocab:PIP_VOCAB,icon:'🦊',...BOOK_READING_GUIDES['pip-and-the-lost-star']},
 {id:'milo-and-the-little-storm',title:'Prince Milo and the Little Storm',zh:'米洛王子的小風暴',vocab:MILO_VOCAB,icon:'👑',...BOOK_READING_GUIDES['milo-and-the-little-storm']},
 {id:'dori-and-the-echo-in-the-mist',title:'Dori and the Echo in the Mist',zh:'小恐龍朵里尋找媽媽',vocab:DORI_VOCAB,icon:'🦕',level:'國小五～六年級',questions:DORI_QUESTIONS,patterns:DORI_PATTERNS}
];

export default function PictureBooks({ onBack, stopSpeech, TtsQuickSpeed, onLearningEvent }) {
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
  function completeGuide({questionCount}) {
    onLearningEvent?.({id:`pictureBooks:${book.id}:guide:v1`,source:'pictureBooks',level:'elementary',contentId:book.id,kind:'complete',outcome:'participated',activity:'reading-guide',questionCount,occurredAt:new Date().toISOString()});
  }
  return <section className="pip-book-host" aria-label="互動童書">
    <header><button onClick={onBack}>← 返回學習</button><div><h1>{book.title}</h1><p>{book.zh} · 8 頁互動立體童書{book.level ? ` · ${book.level}` : ''}</p></div>{TtsQuickSpeed&&<TtsQuickSpeed/>}</header>
    <nav className="storybook-picker" aria-label="選擇童書">{BOOKS.map((item,i)=><button key={item.id} aria-pressed={bookIndex===i} onClick={()=>{if(i===bookIndex)return;frame.current?.contentWindow?.postMessage({type:'pip:stop'},window.location.origin);setHeight(700);setBookIndex(i);}}>{item.icon} {item.zh}</button>)}</nav>
    <iframe key={book.id} ref={frame} src={`/picture-books/${book.id}.html`} title={`${book.title} 互動立體童書`} style={{ height }} allow="autoplay"/>
    <p className="pip-book-note">每個英文單字都能點讀；有底線的重點單字會顯示中英單字卡。文章與單字使用預先生成的音檔；黃色高亮依播放進度估算。</p>
    {book.questions && <BookReadingGuide key={`guide-${book.id}`} storageKey={`eg_pictureBookGuide:${book.id}:v1`} questions={book.questions} patterns={book.patterns} onComplete={completeGuide}/>}
    <details className="pip-vocabulary"><summary>故事單字表 · {Object.keys(book.vocab).length} 個重點單字</summary><div>{Object.entries(book.vocab).map(([key,[icon,zh]]) => <button key={key} onClick={() => word(key)} aria-label={`朗讀 ${key} ${zh}`}><span aria-hidden="true">{icon}</span><strong lang="en">{key}</strong><span>{zh}</span></button>)}</div></details>
  </section>;
}
