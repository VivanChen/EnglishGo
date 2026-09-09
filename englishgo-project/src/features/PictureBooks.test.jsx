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
