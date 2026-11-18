import { DORI_PAGES, DORI_VOCAB, DORI_QUESTIONS } from '../data/doriBook.js';
import { MILO_PAGES, MILO_VOCAB } from '../data/miloBook.js';
import { OTTO_PAGES, OTTO_VOCAB, OTTO_QUESTIONS } from '../data/ottoBook.js';
import { NOVA_PAGES, NOVA_VOCAB, NOVA_QUESTIONS } from '../data/novaBook.js';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import PictureBooks, { BOOK_READING_GUIDES } from './PictureBooks.jsx';
import { PIP_PAGES, PIP_VOCAB } from '../data/pipBook.js';
import { NOVEL_AUDIO_CATALOG } from '../../netlify/functions/novel-audio-catalog.js';
import { makeNovelAudioAssetId } from '../data/novelAudio.js';

const original=readFileSync(path.join(process.cwd(),'src/content/pip-and-the-lost-star.html'),'utf8');
const sourceData=original.slice(original.indexOf('const VOCAB ='),original.indexOf('/* ================= SVG ART'));
const expected=vm.runInNewContext(sourceData+';({pages:PAGES,vocab:VOCAB})');

describe('the user supplied Pip book',()=>{
  it('preserves all eight original pages, translations, scene keys and 37 vocabulary cards verbatim',()=>{
    expect(PIP_PAGES).toEqual(expected.pages);
    expect(PIP_VOCAB).toEqual(expected.vocab);
    expect(PIP_PAGES).toHaveLength(8);
    expect(Object.keys(PIP_VOCAB)).toHaveLength(37);
  });
  it('embeds the actual supplied HTML book instead of substituting the previous story',()=>{
    render(<PictureBooks onBack={vi.fn()} stopSpeech={vi.fn()}/>);
    expect(screen.getByTitle('Pip and the Lost Star 互動立體童書')).toHaveAttribute('src','/picture-books/pip-and-the-lost-star.html');
    expect(screen.getByText('故事單字表 · 37 個重點單字')).toBeVisible();
    expect(screen.queryByText('A Little Light')).toBeNull();
  });
  it('sends vocabulary pronunciation to the embedded API voice player and returns to learning',()=>{
    const onBack=vi.fn();render(<PictureBooks onBack={onBack} stopSpeech={vi.fn()}/>);
    const frame=screen.getByTitle('Pip and the Lost Star 互動立體童書');
    const send=vi.spyOn(frame.contentWindow,'postMessage');
    fireEvent.click(screen.getByRole('button',{name:'朗讀 owl 貓頭鷹',hidden:true}));
    expect(send).toHaveBeenCalledWith({type:'pip:word',word:'owl'},window.location.origin);
    fireEvent.click(screen.getByRole('button',{name:'← 返回學習'}));expect(onBack).toHaveBeenCalledOnce();
  });
  it('includes a content-addressed API audio entry for every original page',()=>{
    PIP_PAGES.forEach((page,index)=>{
      const id=makeNovelAudioAssetId({novelId:'picture-book-pip-lost-star',chapterNo:index+1,lang:'en-US',text:page.x});
      expect(NOVEL_AUDIO_CATALOG[id]).toEqual({text:page.x,lang:'en-US'});
    });
  });
});

describe('Milo storybook',()=>{
 it('switches books, stops the previous reader, and supplies the selected vocabulary',()=>{
  render(<PictureBooks onBack={vi.fn()} stopSpeech={vi.fn()}/>);
  const old=screen.getByTitle('Pip and the Lost Star 互動立體童書');
  const send=vi.spyOn(old.contentWindow,'postMessage');
  fireEvent.click(screen.getByRole('button',{name:/^米洛王子的小風暴/}));
  expect(send).toHaveBeenCalledWith({type:'pip:stop'},window.location.origin);
  expect(screen.getByTitle('Prince Milo and the Little Storm 互動立體童書')).toHaveAttribute('src','/picture-books/milo-and-the-little-storm.html');
  expect(screen.getByRole('button',{name:'朗讀 angry 生氣的',hidden:true})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'朗讀 owl 貓頭鷹',hidden:true})).toBeNull();
 });
 it('aligns every bilingual page, scene and fixed API recording',()=>{
  const built=readFileSync(path.join(process.cwd(),'public/picture-books/milo-and-the-little-storm.html'),'utf8');
  const data=built.slice(built.indexOf('const VOCAB ='),built.indexOf('/* ================= SVG ART'));
  const parsed=vm.runInNewContext(data+';({pages:PAGES,vocab:VOCAB})');
  expect(parsed).toEqual({pages:MILO_PAGES,vocab:MILO_VOCAB});
  expect(new Set(MILO_PAGES.map(p=>p.s)).size).toBe(8);
  MILO_PAGES.forEach((page,index)=>{
   expect(page.z).toMatch(/[\u4e00-\u9fff]/);
   const id=makeNovelAudioAssetId({novelId:'picture-book-milo-little-storm',chapterNo:index+1,lang:'en-US',text:page.x});
   expect(NOVEL_AUDIO_CATALOG[id]).toEqual({text:page.x,lang:'en-US'});
  });
 });
});

describe('Dori upper-elementary storybook',()=>{
 it('offers the new book, bilingual support and evidence-based reading practice',()=>{
  render(<PictureBooks onBack={vi.fn()} stopSpeech={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:/^小恐龍朵里尋找媽媽/}));
  expect(screen.getByTitle('Dori and the Echo in the Mist 互動立體童書')).toHaveAttribute('src','/picture-books/dori-and-the-echo-in-the-mist.html');
  expect(screen.getByText(/國小五～六年級/,{selector:'header p'})).toBeVisible();
  fireEvent.click(screen.getByText('讀後探索 · 4 題推理練習與 3 個句型'));
  fireEvent.click(screen.getByRole('button',{name:DORI_QUESTIONS[0].options[1],hidden:true}));
  expect(screen.getByRole('status',{hidden:true})).toHaveTextContent('再看看故事中的線索');
  fireEvent.click(screen.getByRole('button',{name:DORI_QUESTIONS[0].options[0],hidden:true}));
  expect(screen.getByRole('status',{hidden:true})).toHaveTextContent('答對了');
  expect(screen.getByRole('button',{name:'朗讀 evidence 證據',hidden:true})).toBeInTheDocument();
 });
 it('keeps generated bilingual text, vocabulary and API recordings aligned',()=>{
  const built=readFileSync(path.join(process.cwd(),'public/picture-books/dori-and-the-echo-in-the-mist.html'),'utf8');
  const data=built.slice(built.indexOf('const VOCAB ='),built.indexOf('/* ================= SVG ART'));
  expect(vm.runInNewContext(data+';({pages:PAGES,vocab:VOCAB})')).toEqual({pages:DORI_PAGES,vocab:DORI_VOCAB});
  DORI_PAGES.forEach((page,index)=>{
   expect(page.x.split(/\s+/).length).toBeGreaterThanOrEqual(40);
   expect(page.z).toMatch(/[\u4e00-\u9fff]/);
   const id=makeNovelAudioAssetId({novelId:'picture-book-dori-echo-mist',chapterNo:index+1,lang:'en-US',text:page.x});
   expect(NOVEL_AUDIO_CATALOG[id]).toEqual({text:page.x,lang:'en-US'});
  });
  const words=new Set(DORI_PAGES.flatMap(p=>p.x.toLowerCase().match(/[a-z]+/g)));
  Object.keys(DORI_VOCAB).forEach(word=>expect(words.has(word),word).toBe(true));
 });
});

describe('storybook reading-guide participation',()=>{
 const selectCorrect=questions=>questions.forEach(question=>fireEvent.click(screen.getByRole('button',{name:question.options[question.answer],hidden:true})));
 it('requires both grounded Pip answers, saves before the event, and never awards on a passive visit',()=>{
  const key='eg_pictureBookGuide:pip-and-the-lost-star:v1';
  const onLearningEvent=vi.fn(()=>expect(JSON.parse(localStorage.getItem(key)).completed).toBe(true));
  const props={onBack:vi.fn(),stopSpeech:vi.fn(),onLearningEvent,onXp:vi.fn()};
  const view=render(<PictureBooks {...props}/>);
  const questions=BOOK_READING_GUIDES['pip-and-the-lost-star'].questions;
  expect(PIP_PAGES[1].x).toContain('garden');expect(PIP_PAGES[6].x).toContain('At the top');
  expect(onLearningEvent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:questions[0].options[2],hidden:true}));
  fireEvent.click(screen.getByRole('button',{name:questions[1].options[questions[1].answer],hidden:true}));
  expect(onLearningEvent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:questions[0].options[questions[0].answer],hidden:true}));
  expect(onLearningEvent).toHaveBeenCalledTimes(1);
  expect(onLearningEvent.mock.calls[0][0]).toMatchObject({id:'pictureBooks:pip-and-the-lost-star:guide:v1',source:'pictureBooks',level:'elementary',contentId:'pip-and-the-lost-star',kind:'complete',outcome:'participated',activity:'reading-guide',questionCount:2});
  selectCorrect(questions);expect(onLearningEvent).toHaveBeenCalledTimes(1);
  view.unmount();render(<PictureBooks {...props}/>);selectCorrect(questions);
  expect(onLearningEvent).toHaveBeenCalledTimes(1);expect(props.onXp).not.toHaveBeenCalled();
 });
 it('keeps each book’s answers and completion separate, including Dori’s four questions',()=>{
  const onLearningEvent=vi.fn();const view=render(<PictureBooks onBack={vi.fn()} stopSpeech={vi.fn()} onLearningEvent={onLearningEvent}/>);
  const pip=BOOK_READING_GUIDES['pip-and-the-lost-star'].questions,milo=BOOK_READING_GUIDES['milo-and-the-little-storm'].questions;
  selectCorrect(pip);fireEvent.click(screen.getByRole('button',{name:/^米洛王子的小風暴/}));
  expect(MILO_PAGES[1].x).toContain('caught a block');expect(MILO_PAGES[4].x).toContain('breathed in slowly');
  fireEvent.click(screen.getByRole('button',{name:milo[0].options[milo[0].answer],hidden:true}));
  expect(onLearningEvent).toHaveBeenCalledTimes(1);
  view.unmount();render(<PictureBooks onBack={vi.fn()} stopSpeech={vi.fn()} onLearningEvent={onLearningEvent}/>);
  fireEvent.click(screen.getByRole('button',{name:/^米洛王子的小風暴/}));
  expect(screen.getByRole('button',{name:milo[0].options[milo[0].answer],hidden:true})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:milo[1].options[milo[1].answer],hidden:true}));
  expect(onLearningEvent).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button',{name:/^小恐龍朵里尋找媽媽/}));
  selectCorrect(DORI_QUESTIONS.slice(0,3));expect(onLearningEvent).toHaveBeenCalledTimes(2);
  selectCorrect(DORI_QUESTIONS.slice(3));expect(onLearningEvent).toHaveBeenCalledTimes(3);
  expect(onLearningEvent.mock.calls[2][0]).toMatchObject({contentId:'dori-and-the-echo-in-the-mist',questionCount:4,outcome:'participated'});
 });
 it('retains the iframe origin and source checks and ignores claimed completion messages',()=>{
  const onLearningEvent=vi.fn();render(<PictureBooks onBack={vi.fn()} stopSpeech={vi.fn()} onLearningEvent={onLearningEvent}/>);
  const frame=screen.getByTitle('Pip and the Lost Star 互動立體童書');
  fireEvent(window,new MessageEvent('message',{origin:'https://example.com',source:frame.contentWindow,data:{type:'pip:height',height:999}}));
  expect(frame.style.height).toBe('700px');
  fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:window,data:{type:'pip:height',height:999}}));
  expect(frame.style.height).toBe('700px');
  fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:frame.contentWindow,data:{type:'pip:height',height:999}}));
  expect(frame.style.height).toBe('999px');
  fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:frame.contentWindow,data:{type:'pip:guide-complete',completed:true}}));
  expect(onLearningEvent).not.toHaveBeenCalled();
 });
});

describe('storybook progress, stars and rewards',()=>{
 const KEY='eg_pictureBookProgress:v1',origin=window.location.origin;
 const saved=()=>JSON.parse(localStorage.getItem(KEY))['pip-and-the-lost-star'];
 const fromFrame=(frame,data)=>fireEvent(window,new MessageEvent('message',{origin,source:frame.contentWindow,data}));
 function open(props={}){
  const handlers={onBack:vi.fn(),stopSpeech:vi.fn(),onXp:vi.fn(),trackWeak:vi.fn(),onLearningEvent:vi.fn(),...props};
  render(<PictureBooks {...handlers}/>);
  const frame=screen.getByTitle('Pip and the Lost Star 互動立體童書');
  const send=vi.spyOn(frame.contentWindow,'postMessage');
  return {...handlers,frame,send,book:data=>fromFrame(frame,data)};
 }
 function withPhone(run){
  const original=Object.getOwnPropertyDescriptor(window,'matchMedia');
  Object.defineProperty(window,'matchMedia',{configurable:true,writable:true,value:vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))});
  try{run();}finally{if(original)Object.defineProperty(window,'matchMedia',original);else delete window.matchMedia;}
 }

 it('shows saved progress on the shelf and resumes the book where the reader stopped',()=>{
  localStorage.setItem(KEY,JSON.stringify({'pip-and-the-lost-star':{page:3,seen:[0,1,2,3],stars:[0,2],completed:false}}));
  const {book,send}=open();
  expect(screen.getByRole('button',{name:'皮皮與迷路的小星星，國小低年級，讀到第 4 頁，星星 2 / 8'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('button',{name:'米洛王子的小風暴，國小中年級，新故事，星星 0 / 8'})).toHaveAttribute('aria-pressed','false');
  book({type:'pip:ready'});
  expect(send).toHaveBeenCalledWith({type:'pip:immersive',active:false},origin);
  expect(send).toHaveBeenCalledWith({type:'pip:init',page:3,stars:[0,2],completed:false,autoOpen:false},origin);
 });

 it('awards each found star once on an opened page and sends missed targets to weak-word review',()=>{
  const {book,onXp,trackWeak}=open();
  book({type:'pip:star',page:0,word:'house',firstTry:true});
  expect(onXp).not.toHaveBeenCalled();
  book({type:'pip:page',page:0});
  book({type:'pip:miss',page:0,word:'house'});
  expect(trackWeak).toHaveBeenCalledWith('house',1);
  book({type:'pip:star',page:0,word:'fox',firstTry:true});
  book({type:'pip:star',page:0,word:'house',firstTry:false});
  book({type:'pip:star',page:0,word:'house',firstTry:true});
  expect(onXp).toHaveBeenCalledTimes(1);expect(onXp).toHaveBeenCalledWith(2);
  expect(trackWeak).toHaveBeenCalledTimes(1);
  book({type:'pip:page',page:1});
  book({type:'pip:star',page:1,word:'garden',firstTry:true});
  expect(trackWeak).toHaveBeenLastCalledWith('garden',-1);
  expect(saved()).toMatchObject({page:1,seen:[0,1],stars:[0,1]});
  expect(screen.getByRole('button',{name:'皮皮與迷路的小星星，國小低年級，讀到第 2 頁，星星 2 / 8'})).toBeInTheDocument();
  book({type:'pip:review',word:'owl'});book({type:'pip:review',word:'dinosaur'});
  expect(trackWeak).toHaveBeenCalledTimes(3);expect(trackWeak).toHaveBeenLastCalledWith('owl',1);
 });

 it('rewards finishing once, only after every page was opened, and saves before the event',()=>{
  const onLearningEvent=vi.fn(()=>expect(saved().completed).toBe(true));
  const {book,send,onXp}=open({onLearningEvent});
  for(let page=0;page<7;page++)book({type:'pip:page',page});
  book({type:'pip:finish'});
  expect(onXp).not.toHaveBeenCalled();
  expect(send).toHaveBeenLastCalledWith({type:'pip:reward',xp:0,first:false,missing:1},origin);
  book({type:'pip:page',page:7});book({type:'pip:finish'});
  expect(onXp).toHaveBeenCalledWith(20);
  expect(onLearningEvent).toHaveBeenCalledTimes(1);
  expect(onLearningEvent.mock.calls[0][0]).toMatchObject({id:'pictureBooks:pip-and-the-lost-star:read:v1',source:'pictureBooks',contentId:'pip-and-the-lost-star',kind:'complete',outcome:'participated',activity:'storybook',pageCount:8});
  expect(send).toHaveBeenLastCalledWith({type:'pip:reward',xp:20,first:true,missing:0},origin);
  book({type:'pip:finish'});
  expect(onXp).toHaveBeenCalledTimes(1);expect(onLearningEvent).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button',{name:'皮皮與迷路的小星星，國小低年級，已讀完，星星 0 / 8'})).toBeInTheDocument();
 });

 it('ignores progress and rewards claimed by other windows',()=>{
  const {frame,onXp}=open();
  fireEvent(window,new MessageEvent('message',{origin:'https://example.com',source:frame.contentWindow,data:{type:'pip:page',page:0}}));
  fireEvent(window,new MessageEvent('message',{origin,source:window,data:{type:'pip:finish'}}));
  expect(localStorage.getItem(KEY)).toBeNull();expect(onXp).not.toHaveBeenCalled();
 });

 it('opens the reading guide when the last page asks for it',()=>{
  const {book}=open();
  const details=screen.getByText(/^讀後探索 · 2 題推理練習/).closest('details');
  expect(details.open).toBe(false);
  book({type:'pip:guide'});
  expect(details.open).toBe(true);
 });

 it('reads full screen on a phone and carries the reader straight into the next book',()=>withPhone(()=>{
  const {book,send}=open();
  const host=screen.getByRole('region',{name:'互動童書'});
  expect(host).not.toHaveClass('is-immersive');
  book({type:'pip:reading',open:true});
  expect(host).toHaveClass('is-immersive');
  expect(document.documentElement.style.overflow).toBe('hidden');
  expect(send).toHaveBeenLastCalledWith({type:'pip:immersive',active:true},origin);
  book({type:'pip:next-book'});
  const next=screen.getByTitle('Otto and the Lantern Boat 互動立體童書');
  expect(host).toHaveClass('is-immersive');
  const nextSend=vi.spyOn(next.contentWindow,'postMessage');
  fromFrame(next,{type:'pip:ready'});
  expect(nextSend).toHaveBeenCalledWith({type:'pip:immersive',active:true},origin);
  expect(nextSend).toHaveBeenCalledWith(expect.objectContaining({type:'pip:init',autoOpen:true}),origin);
  fromFrame(next,{type:'pip:reading',open:false});
  expect(host).not.toHaveClass('is-immersive');
  expect(document.documentElement.style.overflow).toBe('');
 }));
});

describe('new storybooks for younger and older readers',()=>{
 const builtData=id=>{
  const built=readFileSync(path.join(process.cwd(),`public/picture-books/${id}.html`),'utf8');
  return vm.runInNewContext(built.slice(built.indexOf('const VOCAB ='),built.indexOf('/* ================= SVG ART'))+';({pages:PAGES,vocab:VOCAB})');
 };
 const books=[
  {id:'otto-and-the-lantern-boat',novelId:'picture-book-otto-lantern-boat',pages:OTTO_PAGES,vocab:OTTO_VOCAB,questions:OTTO_QUESTIONS,maxWords:25},
  {id:'nova-and-the-silent-lighthouse',novelId:'picture-book-nova-silent-lighthouse',pages:NOVA_PAGES,vocab:NOVA_VOCAB,questions:NOVA_QUESTIONS,minWords:55}
 ];
 it('keeps generated bilingual pages, vocabulary, recordings and reading level aligned',()=>{
  books.forEach(({id,novelId,pages,vocab,questions,maxWords,minWords})=>{
   expect(builtData(id)).toEqual({pages,vocab});
   expect(pages).toHaveLength(8);expect(new Set(pages.map(p=>p.s)).size).toBe(8);
   const words=new Set(pages.flatMap(p=>p.x.toLowerCase().match(/[a-z']+/g)));
   Object.keys(vocab).forEach(word=>expect(words.has(word),`${id}: ${word}`).toBe(true));
   pages.forEach((page,index)=>{
    const count=page.x.split(/\s+/).length;
    if(maxWords)expect(count,`${id} page ${index+1}`).toBeLessThanOrEqual(maxWords);
    if(minWords)expect(count,`${id} page ${index+1}`).toBeGreaterThanOrEqual(minWords);
    expect(page.z).toMatch(/[一-鿿]/);
    expect(NOVEL_AUDIO_CATALOG[makeNovelAudioAssetId({novelId,chapterNo:index+1,lang:'en-US',text:page.x})]).toEqual({text:page.x,lang:'en-US'});
   });
   questions.forEach(question=>expect(question.options[question.answer]).toBeTruthy());
  });
 });
 it('puts the gentle books first for elementary learners and the junior-high book first for older learners',()=>{
  const {unmount}=render(<PictureBooks lv="elementary" onBack={vi.fn()} stopSpeech={vi.fn()}/>);
  const names=()=>screen.getAllByRole('button',{name:/，星星 \d+ \/ 8$/}).map(button=>button.getAttribute('aria-label').split('，')[0]);
  expect(names()).toEqual(['皮皮與迷路的小星星','小水獺奧圖的燈籠船','米洛王子的小風暴','小恐龍朵里尋找媽媽','諾娃與沉默的燈塔']);
  unmount();
  render(<PictureBooks lv="junior" onBack={vi.fn()} stopSpeech={vi.fn()}/>);
  expect(names()[0]).toBe('諾娃與沉默的燈塔');
  expect(screen.getByTitle('Nova and the Silent Lighthouse 互動立體童書')).toHaveAttribute('src','/picture-books/nova-and-the-silent-lighthouse.html');
  expect(screen.getByText(/國中/,{selector:'header p'})).toBeVisible();
  expect(screen.getByText('讀後探索 · 4 題推理練習與 3 個句型')).toBeInTheDocument();
 });
 it('records the junior-high reading guide at the junior stage',()=>{
  const onLearningEvent=vi.fn();
  render(<PictureBooks lv="junior" onBack={vi.fn()} stopSpeech={vi.fn()} onLearningEvent={onLearningEvent}/>);
  NOVA_QUESTIONS.forEach(question=>fireEvent.click(screen.getByRole('button',{name:question.options[question.answer],hidden:true})));
  expect(onLearningEvent).toHaveBeenCalledTimes(1);
  expect(onLearningEvent.mock.calls[0][0]).toMatchObject({id:'pictureBooks:nova-and-the-silent-lighthouse:guide:v1',level:'junior',questionCount:4});
 });
});
