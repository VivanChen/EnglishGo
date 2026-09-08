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

describe('learning island journey',()=>{
  it('starts with zero wallet coins and keeps travel money separate from the wallet',async()=>{
    const onComplete=vi.fn();await act(async()=>{render(<Harness onComplete={onComplete}/>)});expect(screen.getByText('不花錢包金幣')).toBeInTheDocument();start();
    expect(screen.getByTestId('pet-monopoly-player-cash')).toHaveTextContent('100');expect(saved().coins).toBe(0);
    fireEvent.click(screen.getByRole('button',{name:'返回'}));expect(screen.getByRole('dialog')).toHaveTextContent('要先結束這趟旅行嗎');
    fireEvent.click(screen.getByRole('button',{name:'結束這局，回準備頁'}));expect(screen.getByTestId('pet-monopoly-setup')).toBeInTheDocument();expect(saved().coins).toBe(0);expect(onComplete).not.toHaveBeenCalled();
  });
  it('freezes a moving token and resumes the same move when leaving is cancelled',async()=>{
    render(<Harness/>);start();fireEvent.click(screen.getByRole('button',{name:'擲骰'}));fireEvent.click(screen.getByRole('button',{name:'返回'}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(30000)});
    expect(screen.queryByTestId('pet-monopoly-choice-correct')).not.toBeInTheDocument();expect(screen.getByTestId('pet-monopoly-tile-start')).toHaveClass('is-active');
    fireEvent.click(screen.getByRole('button',{name:'繼續旅行'}));await drainRound();
    expect(screen.getByTestId('pet-monopoly-choice-correct')).toBeInTheDocument();expect(screen.getByTestId('pet-monopoly-tile-word-market')).toHaveClass('is-active');
  });
  it('lets a wrong answer be reviewed before continuing the round',async()=>{
    render(<Harness/>);start();fireEvent.click(screen.getByRole('button',{name:'擲骰'}));await drainRound();
    const wrong=[...document.querySelectorAll('.pm-choice')].find(button=>!button.dataset.testid);fireEvent.click(wrong);
    expect(screen.getByTestId('pet-monopoly-review-next')).toBeInTheDocument();expect(screen.queryByTestId('pet-monopoly-moving')).not.toBeInTheDocument();expect(saved().coins).toBe(0);
    fireEvent.click(screen.getByTestId('pet-monopoly-review-next'));await drainRound();expect(screen.getByRole('button',{name:'擲骰'})).not.toBeDisabled();
  });
  it('allows one property upgrade before rolling without giving computers an extra turn',async()=>{
    const dice=[1,2,6,2,6,2,6,2,6,2];vi.mocked(globalThis.crypto.getRandomValues).mockImplementation(array=>{array[0]=(dice.shift()||1)-1;return array});
    render(<Harness/>);start();
    for(let round=0;round<5;round++){
      fireEvent.click(screen.getByRole('button',{name:'擲骰'}));await drainRound();fireEvent.click(screen.getByTestId('pet-monopoly-choice-correct'));
      const offer=screen.queryByTestId('pet-monopoly-buy');if(offer)fireEvent.click(round===0?offer:screen.getByTestId('pet-monopoly-skip-buy'));await drainRound();
    }
    fireEvent.click(screen.getByRole('button',{name:/^升級 \d+ 旅費$/}));
    expect(screen.getByTestId('pet-monopoly-tile-word-market')).toHaveAttribute('data-owner-level','2');
    expect(screen.queryByTestId('pet-monopoly-moving')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'擲骰'})).not.toBeDisabled();
    expect(screen.queryByRole('button',{name:/^升級 \d+ 旅費$/})).not.toBeInTheDocument();
  });
  it.each([6,10])('finishes %i rounds, pays the disclosed reward once, and presents a next step',async(rounds)=>{
    const onComplete=vi.fn();render(<StrictMode><Harness onComplete={onComplete}/></StrictMode>);if(rounds===10)fireEvent.click(screen.getByRole('button',{name:'10 回合 · 深度探索'}));start();
    for(let round=0;round<rounds;round++){
      fireEvent.click(screen.getByRole('button',{name:'擲骰'}));await drainRound();fireEvent.click(screen.getByTestId('pet-monopoly-choice-correct'));
      const skip=screen.queryByTestId('pet-monopoly-skip-buy');if(skip)fireEvent.click(skip);await drainRound();
      if(round<rounds-1){expect(saved().coins).toBe(0);expect(onComplete).not.toHaveBeenCalled()}
    }
    expect(screen.getByTestId('pet-monopoly-result')).toHaveTextContent(`${rounds} 回合，順利抵達終點`);expect(saved().coins).toBe(12+rounds*2);expect(screen.getByTestId('pet-monopoly-result')).toHaveTextContent(`答對 ${rounds}/${rounds} 題`);
    fireEvent.click(screen.getByRole('button',{name:'再選一趟旅程'}));expect(saved().coins).toBe(12+rounds*2);expect(screen.getByTestId('pet-monopoly-setup')).toBeInTheDocument();expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
