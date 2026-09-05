import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ArcadeGames from './ArcadeGames.jsx';

const words=[{w:'cat',m:'貓'},{w:'dog',m:'狗'},{w:'sun',m:'太陽'},{w:'book',m:'書'},{w:'fish',m:'魚'},{w:'tree',m:'樹'}];
const deps={V:{elementary:words},SCRAM:{elementary:[{s:'I like cats',h:'我喜歡貓'},{s:'We play games',h:'我們玩遊戲'},{s:'The sun shines',h:'太陽照耀'}]},LV:{elementary:{cl:'#287957'}},loadExtraWords:async()=>({}),fetchCloudVocab:async()=>[],speak:vi.fn(),stopSpeech:vi.fn(),playSound:vi.fn(),Hdr:({t,onBack})=><header><button onClick={onBack}>返回</button><h2>{t}</h2></header>};
async function mount(game='bomb') {
  const onXp=vi.fn(),onDone=vi.fn();
  const view=render(<StrictMode><ArcadeGames game={game} lv="elementary" onXp={onXp} onDone={onDone} onBack={vi.fn()} deps={deps}/></StrictMode>);
  await act(async()=>{});return {...view,onXp,onDone};
}
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks()});

describe('illustrated arcade play flow',()=>{
  it('waits for a deliberate start and keeps advanced stages locked',async()=>{
    await mount();
    expect(screen.getByRole('button',{name:/月球補給/})).toBeDisabled();
    expect(screen.queryByTestId('arcade-clock')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'開始第 1 關 →'}));
    expect(screen.getByTestId('arcade-clock')).toHaveTextContent('不計時');
    expect(screen.getByRole('textbox',{name:'拼出英文單字'})).toBeInTheDocument();
  });
  it('pauses the countdown and resumes the same puzzle',async()=>{
    vi.useFakeTimers();await mount();
    fireEvent.click(screen.getByRole('button',{name:/挑戰模式/}));
    fireEvent.click(screen.getByRole('button',{name:'開始第 1 關 →'}));
    act(()=>vi.advanceTimersByTime(2000));
    expect(screen.getByTestId('arcade-clock')).toHaveTextContent('88 秒');
    fireEvent.click(screen.getByRole('button',{name:'Ⅱ 暫停'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(()=>vi.advanceTimersByTime(10000));
    expect(screen.getByTestId('arcade-clock')).toHaveTextContent('88 秒');
    fireEvent.click(screen.getByRole('button',{name:'繼續冒險'}));
    act(()=>vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('arcade-clock')).toHaveTextContent('87 秒');
  });
  it('automatically pauses when the browser tab is hidden',async()=>{
    await mount('whack');fireEvent.click(screen.getByRole('button',{name:'開始第 1 關 →'}));
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    fireEvent(document,new Event('visibilitychange'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
  });
  it('pays each solved spelling puzzle once under StrictMode and unlocks the next stage',async()=>{
    const {onXp}=await mount();fireEvent.click(screen.getByRole('button',{name:'開始第 1 關 →'}));
    for(let i=0;i<3;i++){
      const meaning=document.querySelector('.arcade-clue h3').textContent;
      const word=words.find(item=>item.m===meaning).w;
      fireEvent.change(screen.getByRole('textbox',{name:'拼出英文單字'}),{target:{value:word}});
      const submit=screen.getByRole('button',{name:'發射能量 ↗'});fireEvent.click(submit);fireEvent.click(submit);
      fireEvent.click(screen.getByRole('button',{name:i===2?'看看冒險成果 →':'下一個任務 →'}));
    }
    expect(screen.getByRole('heading',{name:'冒險完成！'})).toBeInTheDocument();
    expect(onXp.mock.calls).toEqual([[10],[10],[10]]);
    expect(JSON.parse(localStorage.getItem('eg_arcade_progress')).elementary.bomb.practice[1].stars).toBe(3);
    fireEvent.click(screen.getByRole('button',{name:'關卡地圖'}));
    expect(screen.getByRole('button',{name:/月球補給/})).toBeEnabled();
  });
  it('hides both visible text and accessible answers after the memory preview',async()=>{
    vi.useFakeTimers();await mount('match');
    fireEvent.click(screen.getByRole('button',{name:/挑戰模式/}));
    fireEvent.click(screen.getByRole('button',{name:'開始第 1 關 →'}));
    expect(screen.getAllByRole('button',{name:/英文：/})).toHaveLength(3);
    act(()=>vi.advanceTimersByTime(3000));
    expect(screen.queryByRole('button',{name:/英文：/})).not.toBeInTheDocument();
    expect(screen.getAllByRole('button',{name:/翻開第/})).toHaveLength(6);
    fireEvent.click(screen.getByRole('button',{name:'翻開第 1 張牌'}));
    expect(screen.getAllByRole('button',{name:/翻開第/})).toHaveLength(5);
  });
  it('lets children return a train carriage and rebuild without duplicate tiles',async()=>{
    await mount('scramble');fireEvent.click(screen.getByRole('button',{name:'開始第 1 關 →'}));
    const bank=screen.getByLabelText('候車區單字'),word=within(bank).getAllByRole('button')[0].textContent;
    fireEvent.click(within(bank).getByRole('button',{name:word,exact:true}));
    expect(within(bank).getByRole('button',{name:word,exact:true})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:`取回車廂 ${word}`}));
    expect(within(bank).getByRole('button',{name:word,exact:true})).toBeEnabled();
    expect(screen.queryByRole('button',{name:`取回車廂 ${word}`})).not.toBeInTheDocument();
  });
});
