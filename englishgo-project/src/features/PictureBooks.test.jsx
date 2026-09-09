import { DORI_PAGES, DORI_VOCAB, DORI_QUESTIONS } from '../data/doriBook.js';
import { MILO_PAGES, MILO_VOCAB } from '../data/miloBook.js';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import PictureBooks from './PictureBooks.jsx';
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
  fireEvent.click(screen.getByRole('button',{name:'👑 米洛王子的小風暴'}));
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
  fireEvent.click(screen.getByRole('button',{name:'🦕 小恐龍朵里尋找媽媽'}));
  expect(screen.getByTitle('Dori and the Echo in the Mist 互動立體童書')).toHaveAttribute('src','/picture-books/dori-and-the-echo-in-the-mist.html');
  expect(screen.getByText(/國小五～六年級/)).toBeVisible();
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
