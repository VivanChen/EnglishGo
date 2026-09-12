import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import PetSanctuary from './PetSanctuary.jsx';
const now=new Date().toISOString(),today=new Date().toDateString();
const bunny={petId:'bunny',rarity:'N',level:2,exp:0,bond:0,hunger:30,clean:10,energy:10,lastUpdate:now};
const foods=[{id:'apple',word:'apple',name:'蘋果',emoji:'🍎',feed:25,cost:10}];
function useLS(key,value){return useState(()=>JSON.parse(localStorage.getItem(key)||'null')??value)}
const api={Hdr:({t,onBack,extra})=><header><button onClick={onBack}>返回</button><h1>{t}</h1>{extra}</header>,useLS,PETS:{N:[{id:'bunny',name:'小兔',words:['rabbit'],story:'小兔喜歡讀書'},{id:'chick',name:'小雞',words:['chick']}]},EGG_HATCH_TASKS:{N:10},RARITY_INFO:{N:{label:'普通'}},DAILY_TASK_DEFS:[{id:'srs_5',name:'複習5字',icon:'📖',statKey:'srsToday',target:5,reward:{coins:20,exp:15}}],PET_FOODS:foods,ACTION_PROMPTS:{feed:['Eat an apple.'],clean:['Wash together.'],sleep:['Good night.'],study:['Let’s read.']},levelUpPet:p=>p,calcDecay:p=>p,speak:vi.fn(),stopSpeech:vi.fn(),playSound:vi.fn(),getDuplicatePetReward:()=>({exp:40,bond:4,dupes:1}),applyDuplicatePetReward:(p,r)=>({...p,exp:(p.exp||0)+r.exp,bond:(p.bond||0)+r.bond,dupes:(p.dupes||0)+r.dupes})};
const navigate=vi.fn();
function Harness({initial={pets:[],eggs:[],coins:0,inventory:{}},initialTab='home'}){
  const [pets,setPets]=useState(initial.pets),[eggs,setEggs]=useState(initial.eggs),[coins,setCoins]=useState(initial.coins),[inventory,setInventory]=useState(initial.inventory);
  return <><output data-testid="saved">{JSON.stringify({pets,eggs,coins,inventory})}</output><PetSanctuary {...{pets,setPets,eggs,setEggs,coins,setCoins,inventory,setInventory,api,initialTab}} c={{cl:'#365'}} petTasks={{date:today,counts:{srsToday:5}}} onBack={vi.fn()} onNavigate={navigate}/></>;
}
const saved=()=>JSON.parse(screen.getByTestId('saved').textContent);
beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
afterEach(()=>{vi.useRealTimers();localStorage.clear();vi.clearAllMocks()});
describe('the complete pet home flow',()=>{
  it('lets a child with zero coins adopt one egg and routes to learning',()=>{
    render(<Harness initialTab="eggs"/>);
    const adopt=screen.getByRole('button',{name:'領養這位夥伴的蛋 →'});fireEvent.click(adopt);fireEvent.click(adopt);
    expect(saved()).toMatchObject({coins:0,eggs:[{petId:'bunny',progress:7,starter:true}],inventory:{apple:3}});
    expect(saved().eggs).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'學單字，陪蛋長大 →'}));expect(navigate).toHaveBeenCalledWith('srs');
  });
  it('hatches a full egg and applies its reserved duplicate rewards exactly once',()=>{
    render(<Harness initialTab="eggs" initial={{pets:[],eggs:[{id:'egg1',petId:'bunny',rarity:'N',progress:10,pendingDuplicateReward:{exp:40,bond:4,dupes:1}}],coins:0,inventory:{}}}/>);
    const hatch=screen.getByRole('button',{name:'🎉 可以孵化了！點我'});fireEvent.click(hatch);fireEvent.click(hatch);
    expect(saved()).toMatchObject({pets:[{petId:'bunny',exp:40,bond:4,dupes:1}],eggs:[]});
    fireEvent.click(screen.getByRole('button',{name:'帶回小家，認識你 →'}));expect(screen.getByTestId('pet-growth-panel')).toBeInTheDocument();
  });
  it('limits task claims and shop purchases to the available balance',()=>{
    render(<Harness initialTab="tasks" initial={{pets:[bunny],eggs:[],coins:0,inventory:{}}}/>);
    const claim=screen.getByRole('button',{name:'🎁 領取'});fireEvent.click(claim);fireEvent.click(claim);
    expect(saved()).toMatchObject({coins:20,pets:[{exp:15}]});
    fireEvent.click(screen.getByRole('button',{name:'補給商店'}));const buy=screen.getByRole('button',{name:'買 1 份 · 10 金幣'});fireEvent.click(buy);fireEvent.click(buy);fireEvent.click(buy);
    expect(saved()).toMatchObject({coins:0,inventory:{apple:2}});
  });
  it('requires a food selection and only spends it when care is completed',()=>{
    render(<Harness initial={{pets:[bunny],eggs:[],coins:0,inventory:{apple:2}}}/>);
    fireEvent.click(screen.getByRole('button',{name:'陪陪我的夥伴 →'}));fireEvent.click(screen.getByTestId('pet-primary-care-action'));
    fireEvent.click(screen.getByRole('button',{name:/選這份食物/}));expect(saved().inventory.apple).toBe(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'查看小兔'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:/拿起蘋果|食物拿好了/}));fireEvent.click(screen.getByRole('button',{name:'餵一口'}));
    expect(screen.getByTestId('pet-action-complete')).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'稍後再做'}));expect(saved().inventory.apple).toBe(2);
    fireEvent.click(screen.getByTestId('pet-primary-care-action'));fireEvent.click(screen.getByRole('button',{name:/選這份食物/}));
    expect(screen.getByTestId('pet-action-complete')).toBeDisabled();
    for(let i=0;i<3;i++){fireEvent.click(screen.getByRole('button',{name:/拿起蘋果|食物拿好了/}));fireEvent.click(screen.getByRole('button',{name:'餵一口'}));}
    fireEvent.click(screen.getByTestId('pet-action-complete'));
    expect(saved()).toMatchObject({coins:5,inventory:{apple:1},pets:[{hunger:55,journey:{marks:1}}]});
  });
  it('switches the showcase and applies care to the selected companion only',()=>{
    render(<Harness initial={{pets:[bunny,{...bunny,petId:'chick',clean:20}],eggs:[],coins:0,inventory:{apple:2}}}/>);
    fireEvent.click(screen.getByRole('button',{name:'陪陪我的夥伴 →'}));
    fireEvent.click(screen.getByRole('button',{name:'查看小雞'}));
    expect(screen.getByRole('button',{name:'查看小雞'})).toHaveAttribute('aria-pressed','true');
    fireEvent.click(within(screen.getByTestId('pet-showcase')).getByRole('button',{name:'洗澡'}));
    for(const n of [4,2,3,1])fireEvent.click(screen.getByRole('button',{name:`擦洗第 ${n} 處髒污`}));
    fireEvent.click(screen.getByTestId('pet-action-complete'));
    expect(saved().pets.find(p=>p.petId==='bunny').clean).toBe(10);
    expect(saved().pets.find(p=>p.petId==='chick').clean).toBe(100);
  });

  it('keeps an empty food choice on the showcase and opens the shop without a reward',()=>{
    render(<Harness initial={{pets:[bunny],eggs:[],coins:20,inventory:{}}}/>);
    fireEvent.click(screen.getByRole('button',{name:'陪陪我的夥伴 →'}));
    fireEvent.click(within(screen.getByTestId('pet-showcase')).getByRole('button',{name:'餵食'}));
    expect(screen.getByTestId('pet-showcase')).toBeInTheDocument();
    expect(screen.queryByTestId('pet-action-complete')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'去補食物 →'}));
    expect(screen.getByRole('button',{name:'買 1 份 · 10 金幣'})).toBeInTheDocument();
    expect(saved().coins).toBe(20);expect(saved().pets[0].hunger).toBe(30);
  });

  it('settles fetch only after three returns, and repeats without charging energy again',()=>{
    vi.useFakeTimers();render(<Harness initial={{pets:[bunny],eggs:[],coins:0,inventory:{}}}/>);
    fireEvent.click(screen.getByRole('button',{name:'陪陪我的夥伴 →'}));
    const start=()=>fireEvent.click(within(screen.getByTestId('pet-showcase')).getByRole('button',{name:'玩耍'}));
    start();fireEvent.click(screen.getByRole('button',{name:'🎾 丟球給夥伴'}));
    fireEvent.click(screen.getByRole('button',{name:'稍後再做'}));act(()=>vi.advanceTimersByTime(2000));
    expect(saved().pets[0].energy).toBe(10);expect(saved().coins).toBe(0);
    for(let round=0;round<2;round++){
      start();expect(screen.getByTestId('pet-action-complete')).toBeDisabled();
      for(let i=0;i<3;i++){fireEvent.click(screen.getByRole('button',{name:'🎾 丟球給夥伴'}));act(()=>vi.advanceTimersByTime(1200));}
      fireEvent.click(screen.getByTestId('pet-action-complete'));
      expect(saved().pets[0]).toMatchObject({energy:5,bond:10});expect(saved().coins).toBe(5);
    }
  });

  it.each([[10,35],[90,100]])('settles bedtime once with starting energy %i and caps at %i',(energy,expected)=>{
    render(<Harness initial={{pets:[{...bunny,energy}],eggs:[],coins:0,inventory:{}}}/>);
    fireEvent.click(screen.getByRole('button',{name:'陪陪我的夥伴 →'}));
    const start=()=>fireEvent.click(within(screen.getByTestId('pet-showcase')).getByRole('button',{name:'休息'}));
    start();fireEvent.click(screen.getByRole('button',{name:'調暗小夜燈'}));
    expect(screen.getByTestId('pet-action-complete')).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'稍後再做'}));expect(saved().pets[0].energy).toBe(energy);expect(saved().coins).toBe(0);
    for(let repeat=0;repeat<2;repeat++){
      start();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      for(const name of ['調暗小夜燈','蓋好小被被','輕聲說晚安'])fireEvent.click(screen.getByRole('button',{name}));
      expect(saved().pets[0].energy).toBe(repeat?expected:energy);
      fireEvent.click(screen.getByTestId('pet-action-complete'));
      expect(saved().pets[0].energy).toBe(expected);expect(saved().coins).toBe(5);
      expect(within(screen.getByTestId('pet-showcase')).getByText('休息完成')).toBeInTheDocument();
    }
  });

});
