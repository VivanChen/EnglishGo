import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PetMonopoly from './PetMonopoly.jsx';

vi.mock('../components/PetCompanion.jsx',()=>({default:({petId})=><span>{petId}</span>}));
const words=[{w:'apple',m:'蘋果',ex:'I eat an apple.'},{w:'book',m:'書',ex:'I read a book.'},{w:'cat',m:'貓',ex:'I see a cat.'},{w:'dog',m:'狗',ex:'I see a dog.'}];
const deps={Hdr:({onBack,t})=><header><button onClick={onBack}>返回</button><h1>{t}</h1></header>,V:{elementary:words},G:{elementary:[{t:'be 動詞',d:'選正確的 be 動詞',q:{s:'I ___ happy.',o:['am','is','are'],a:0}}]},S:{},escapeRegexSafe:s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),shuffleCopy:list=>[...list],getAdventurePetDef:pet=>({name:pet.petId==='bunny'?'小兔':'小貓'}),levelUpPet:pet=>pet};
function Harness({onBack=vi.fn(),onComplete=vi.fn()}){const [coins,setCoins]=useState(0),[pets,setPets]=useState([{petId:'bunny',level:1,exp:0,bond:0,hunger:80,energy:90}]);return <><output data-testid="saved">{JSON.stringify({coins,pets})}</output><PetMonopoly lv="elementary" {...{coins,setCoins,pets,setPets,deps,onBack,onComplete}} onXp={vi.fn()} c={{cl:'#456947'}}/></>}
const saved=()=>JSON.parse(screen.getByTestId('saved').textContent);
const start=()=>fireEvent.click(screen.getByTestId('pet-monopoly-start'));
const roll=()=>{fireEvent.click(screen.getByRole('button',{name:'擲骰'}));fireEvent.click(screen.getByTestId('pet-island-route-0'))};
async function drainRound(){
  for(let step=0;step<8;step++){
    await act(async()=>{await vi.runAllTimersAsync()});
    const rent=screen.queryByTestId('pet-monopoly-rent-confirm');
    if(rent){fireEvent.click(rent);continue}
    break;
  }
}
beforeEach(()=>{
  vi.useFakeTimers();
  vi.spyOn(globalThis.crypto,'getRandomValues').mockImplementation(array=>{array[0]=0;return array});
  HTMLDialogElement.prototype.showModal=function(){this.open=true};
  HTMLDialogElement.prototype.close=function(){this.open=false};
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks()});

describe('gameplay-first island journey',()=>{
  const cash=()=>Number(screen.getByTestId('pet-monopoly-player-cash').textContent);
  const settle=async(buy=false)=>{
    await drainRound();
    const offer=screen.queryByTestId('pet-monopoly-buy');
    if(offer)fireEvent.click(buy&&!offer.disabled?offer:screen.getByTestId('pet-monopoly-skip-buy'));
    const event=document.querySelector('[data-testid^="pet-island-event-option-"]:not(:disabled)');if(event)fireEvent.click(event);
    await drainRound();
  };
  it('offers land immediately, charges exactly once and never requires English',async()=>{
    render(<Harness/>);start();roll();await drainRound();
    expect(screen.queryByTestId('pet-monopoly-choice-correct')).not.toBeInTheDocument();
    const buy=screen.getByTestId('pet-monopoly-buy');fireEvent.click(buy);fireEvent.click(buy);
    expect(cash()).toBe(76);expect(screen.getByTestId('pet-monopoly-tile-word-market')).toHaveAttribute('data-owner','player');
    await drainRound();expect(cash()).toBe(78);expect(saved().coins).toBe(0);
  });
  it('freezes a moving token and resumes the same move',async()=>{
    render(<Harness/>);start();roll();fireEvent.click(screen.getByRole('button',{name:'返回'}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(30000)});expect(screen.getByTestId('pet-monopoly-tile-start')).toHaveClass('is-active');
    fireEvent.click(screen.getByRole('button',{name:'繼續旅行'}));await drainRound();expect(screen.getByTestId('pet-monopoly-deal')).toBeInTheDocument();
  });
  it('provides six explicit destinations with the remote die and consumes it once',async()=>{
    render(<Harness/>);start();fireEvent.click(screen.getByTestId('pet-monopoly-card-control'));fireEvent.click(screen.getByRole('button',{name:'擲骰'}));
    expect(document.querySelectorAll('[data-testid^="pet-island-route-"]')).toHaveLength(6);
    fireEvent.click(screen.getByTestId('pet-island-route-4'));await drainRound();expect(screen.getByTestId('pet-monopoly-tile-word-harbor')).toHaveClass('is-active');expect(screen.queryByTestId('pet-monopoly-card-active')).not.toBeInTheDocument();
  });
  it('blocks a chosen opponent once and permits cancelling without consuming a card',async()=>{
    render(<Harness/>);start();fireEvent.click(screen.getByTestId('pet-monopoly-card-block'));fireEvent.click(screen.getByRole('button',{name:'取消，保留道具'}));expect(screen.getByTestId('pet-monopoly-card-block')).toHaveTextContent('x1');
    fireEvent.click(screen.getByTestId('pet-monopoly-card-block'));fireEvent.click(screen.getByTestId('pet-island-block-cpu1'));expect(screen.getByTestId('pet-monopoly-card-block')).toHaveTextContent('x0');
    roll();await settle();expect(screen.getByTestId('pet-monopoly-feedback')).toHaveTextContent('輪到');expect(screen.queryByTestId('pet-monopoly-cpu-owner')).not.toBeInTheDocument();
    roll();await settle();expect(screen.getAllByTestId('pet-monopoly-cpu-owner')).toHaveLength(1);
  });
  it('limits shop purchases to one per turn and does not spend the wallet',()=>{
    render(<Harness/>);start();const buy=screen.getByTestId('pet-island-shop-control');fireEvent.click(buy);fireEvent.click(buy);expect(cash()).toBe(90);expect(screen.getByTestId('pet-monopoly-card-control')).toHaveTextContent('x2');expect(screen.getByTestId('pet-island-shop-shield')).toBeDisabled();expect(saved().coins).toBe(0);
  });
  it('draws a choice card without a quiz and resolves a safe option only once',async()=>{
    vi.spyOn(Math,'random').mockReturnValue(.999);vi.mocked(crypto.getRandomValues).mockImplementation(a=>{a[0]=2;return a});
    render(<Harness/>);start();roll();await drainRound();expect(screen.getByTestId('pet-island-event-card')).toHaveTextContent('夜市合夥邀請');
    const choice=screen.getByTestId('pet-island-event-option-0');fireEvent.click(choice);fireEvent.click(choice);expect(cash()).toBe(112);
  });
  it('uses a shield against fate repair costs, separate from the chance deck',async()=>{
    vi.spyOn(Math,'random').mockReturnValue(.999);
    const sequence=[1,1,2,1,6,1];vi.mocked(crypto.getRandomValues).mockImplementation(a=>{a[0]=(sequence.shift()||1)-1;return a});
    render(<Harness/>);start();roll();await settle(true);roll();await settle();fireEvent.click(screen.getByTestId('pet-monopoly-card-shield'));roll();await drainRound();
    expect(screen.getByTestId('pet-island-event-card')).toHaveTextContent('暴風雨後的修繕');const before=cash();fireEvent.click(screen.getByTestId('pet-island-event-option-0'));expect(cash()).toBe(before);expect(screen.getByTestId('pet-monopoly-feedback')).toHaveTextContent('護盾擋下');
  });
  it('lets a failed optional English challenge leave game resources unchanged',()=>{
    render(<Harness/>);fireEvent.click(screen.getByRole('checkbox'));start();const before=cash();fireEvent.click(screen.getByTestId('pet-island-learning'));
    fireEvent.click(document.querySelector('.pm-choice:not([data-testid])'));expect(cash()).toBe(before);expect(screen.getByTestId('pet-monopoly-feedback')).toHaveTextContent('不受影響');expect(screen.getByRole('button',{name:'擲骰'})).toBeEnabled();expect(screen.getByTestId('pet-island-learning')).toBeDisabled();
  });
  it('upgrades a remote property only once per round',async()=>{
    render(<Harness/>);fireEvent.click(screen.getByTestId('pet-monopoly-setup-stake-300'));start();roll();await settle(true);
    fireEvent.click(screen.getByTestId('pet-monopoly-tile-word-market'));fireEvent.click(screen.getByRole('button',{name:/^升級 30/}));expect(screen.getByTestId('pet-monopoly-tile-word-market')).toHaveAttribute('data-owner-level','2');expect(screen.getByRole('button',{name:/下輪再升級/})).toBeDisabled();expect(screen.getByRole('button',{name:'擲骰'})).toBeEnabled();
  });
  it.each([6,10])('finishes %i rounds with no quiz and pays the displayed gameplay reward exactly once',async(rounds)=>{
    const onComplete=vi.fn();render(<StrictMode><Harness onComplete={onComplete}/></StrictMode>);if(rounds===10)fireEvent.click(screen.getByRole('button',{name:'10 回合 · 深度探索'}));start();
    for(let round=0;round<rounds;round++){roll();await settle();if(round<rounds-1)expect(saved().coins).toBe(0)}
    const result=screen.getByTestId('pet-monopoly-result');expect(result).toHaveTextContent(`${rounds} 回合，順利抵達終點`);const expected=12+(result.textContent.includes('冠軍 6')?6:0)+(result.textContent.includes('島主挑戰 8')?8:0);expect(saved().coins).toBe(expected);expect(onComplete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:'再選一趟旅程'}));expect(saved().coins).toBe(expected);
  });
  it('abandons safely without paying completion rewards',()=>{
    const onComplete=vi.fn();render(<Harness onComplete={onComplete}/>);start();fireEvent.click(screen.getByRole('button',{name:'返回'}));fireEvent.click(screen.getByRole('button',{name:'結束這局，回準備頁'}));expect(saved().coins).toBe(0);expect(onComplete).not.toHaveBeenCalled();
  });
});
