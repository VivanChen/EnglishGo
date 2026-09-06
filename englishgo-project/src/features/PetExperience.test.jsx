import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PetGachaStudio from './PetGachaStudio.jsx';
import PetPlayground from './PetPlayground.jsx';
vi.mock('../components/PixelPet.jsx',()=>({default:({petId})=><span>{petId} portrait</span>}));
const foods=[{id:'apple',word:'apple',name:'蘋果',emoji:'🍎'},{id:'milk',word:'milk',name:'牛奶',emoji:'🥛'},{id:'bread',word:'bread',name:'麵包',emoji:'🍞'},{id:'fish',word:'fish',name:'魚',emoji:'🐟'},{id:'banana',word:'banana',name:'香蕉',emoji:'🍌'}];
const pet={petId:'bunny',level:1,exp:0,bond:0,energy:80},Hdr=({t,onBack})=><header><button onClick={onBack}>返回</button><h1>{t}</h1></header>;
const sounds={speak:vi.fn(),stopSpeech:vi.fn(),playSound:vi.fn()},c={cl:'#507d5b'};
function useLS(key,initial){const [value,setValue]=useState(()=>JSON.parse(localStorage.getItem(key)||'null')??initial);return [value,next=>setValue(previous=>{const result=typeof next==='function'?next(previous):next;localStorage.setItem(key,JSON.stringify(result));return result})]}
const gachaApi={Hdr,useLS,EGG_COST:50,EGG_HATCH_TASKS:{N:10,R:20,SR:30,SSR:40},GACHA_SR_PITY:20,RARITY_INFO:{N:{color:'#579164',label:'普通',rate:60},R:{color:'#479',label:'稀有',rate:30},SR:{color:'#749',label:'超稀有',rate:9},SSR:{color:'#a73',label:'傳說',rate:1}},PETS:{N:[{id:'bunny'}]},playSound:sounds.playSound,rollRarity:()=> 'N',randomPet:()=>({id:'bunny',name:'小兔',story:'小兔喜歡讀書。'}),RARITY_ORDER:{N:0,R:1,SR:2,SSR:3},DUPLICATE_EGG_PROGRESS:{N:3},getDuplicatePetReward:()=>({exp:20,bond:2,dupes:1}),applyDuplicatePetReward:(pet,reward)=>({...pet,exp:pet.exp+reward.exp,bond:pet.bond+reward.bond})};
function GachaHarness(){const [coins,setCoins]=useState(50),[pets,setPets]=useState([]),[eggs,setEggs]=useState([]);return <><output data-testid="gacha-saved">{JSON.stringify({coins,eggs,pets})}</output><PetGachaStudio onBack={vi.fn()} onNavigate={vi.fn()} c={c} {...{coins,setCoins,pets,setPets,eggs,setEggs}} api={gachaApi}/></>}
function PlayHarness(){const[pets,setPets]=useState([pet]),[coins,setCoins]=useState(0);return <><output data-testid="play-saved">{JSON.stringify({coins,pets})}</output><PetPlayground {...{pets,setPets,setCoins,c,foods,Hdr}} onBack={vi.fn()} getDef={()=>({name:'小兔'})} levelUpPet={value=>value} {...sounds}/></>}
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();localStorage.clear()});
describe('pet experience safeguards',()=>{
  it('settles a gacha immediately, lets children skip the animation and never charges beyond the balance',async()=>{
    vi.useFakeTimers();render(<StrictMode><GachaHarness/></StrictMode>);
    fireEvent.click(screen.getByRole('button',{name:/轉出一顆蛋/}));
    expect(JSON.parse(screen.getByTestId('gacha-saved').textContent)).toMatchObject({coins:0,eggs:[{petId:'bunny'}]});
    expect(JSON.parse(localStorage.getItem('gachaReceipt')).items).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'直接看結果'}));act(()=>vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button',{name:'收下結果'}));expect(screen.getByRole('button',{name:/轉出一顆蛋/})).toBeDisabled();
    expect(JSON.parse(screen.getByTestId('gacha-saved').textContent).eggs).toHaveLength(1);
  });
  it('restores an unacknowledged gacha result after leaving during its animation',()=>{
    vi.useFakeTimers();const view=render(<GachaHarness/>);fireEvent.click(screen.getByRole('button',{name:/轉出一顆蛋/}));view.unmount();act(()=>vi.advanceTimersByTime(2000));
    render(<GachaHarness/>);expect(screen.getByText('把這份相遇帶回家')).toBeInTheDocument();expect(screen.getByText('小兔蛋')).toBeInTheDocument();
  });
  it('allows one partner and saves rewards only after three completed rounds',()=>{
    render(<StrictMode><PlayHarness/></StrictMode>);expect(screen.getByRole('button',{name:'帶夥伴出發 →'})).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'帶夥伴出發 →'}));
    for(let round=0;round<3;round++){
      const prompt=screen.getByRole('heading',{name:/找出「/}).textContent,food=foods.find(f=>prompt.includes(`「${f.name}」`));
      fireEvent.click(document.querySelector(`[data-food="${food.id}"]`));
      expect(screen.getByTestId('play-saved')).toHaveTextContent('"coins":0');
      fireEvent.click(screen.getByRole('button',{name:round===2?'完成野餐，看看成果 →':'前往下一回合 →'}));
    }
    const saved=JSON.parse(screen.getByTestId('play-saved').textContent);expect(saved).toMatchObject({coins:8,pets:[{exp:18,bond:8,journey:{marks:1},playRecords:{'picnic:1':3}}]});
    fireEvent.click(screen.getByRole('button',{name:'回遊樂園'}));expect(screen.getByRole('button',{name:/默契練習/})).not.toBeDisabled();
  });
  it('never replaces a memory question on a timer and resumes its exact place after a tab pause',()=>{
    vi.useFakeTimers();render(<PlayHarness/>);fireEvent.click(screen.getByRole('button',{name:/記憶尋寶/}));fireEvent.click(screen.getByRole('button',{name:'帶夥伴出發 →'}));
    const preview=document.querySelector('.pet-memory-preview').textContent;act(()=>vi.advanceTimersByTime(20000));expect(document.querySelector('.pet-memory-preview')).toHaveTextContent(preview);
    fireEvent.click(screen.getByRole('button',{name:'我記住了，開始尋寶'}));expect(document.querySelector('.pet-memory-preview')).not.toBeInTheDocument();
    Object.defineProperty(document,'hidden',{configurable:true,value:true});fireEvent(document,new Event('visibilitychange'));
    expect(sounds.stopSpeech).toHaveBeenCalled();expect(document.querySelector('.pet-play-puzzle')).toHaveAttribute('inert');
    fireEvent.click(screen.getByText('繼續一起玩'));expect(document.querySelector('.pet-play-puzzle')).not.toHaveAttribute('inert');
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
  });
});
