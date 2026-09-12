import {render,screen,fireEvent,act} from '@testing-library/react';
import {expect,it,vi,afterEach} from 'vitest';
import PetCareStudio from './PetCareStudio.jsx';
it('requires all four distinct spots and permits cleaning in any order',()=>{
 const ready=vi.fn();render(<PetCareStudio petId="bunny" action="clean" onReady={ready}/>);
 const last=screen.getByRole('button',{name:'擦洗第 4 處髒污'});fireEvent.click(last);fireEvent.click(last);
 expect(screen.getByRole('progressbar')).toHaveAttribute('value','1');expect(ready).not.toHaveBeenCalledWith(true);
 for(const n of [2,1,3])fireEvent.click(screen.getByRole('button',{name:`擦洗第 ${n} 處髒污`}));
 expect(ready).toHaveBeenLastCalledWith(true);
});

afterEach(()=>vi.useRealTimers());
it('waits for the ball to return, prevents rapid throws, and requires three rounds',()=>{
 vi.useFakeTimers();const ready=vi.fn();render(<PetCareStudio petId="bunny" action="play" onReady={ready}/>);
 for(let n=0;n<3;n++){
  const toss=screen.getByRole('button',{name:'🎾 丟球給夥伴'});fireEvent.click(toss);fireEvent.click(toss);
  expect(screen.getByRole('progressbar')).toHaveAttribute('value',String(n));
  expect(screen.getByRole('button',{name:'正在接球…'})).toBeDisabled();
  act(()=>vi.advanceTimersByTime(1200));
  expect(screen.getByRole('progressbar')).toHaveAttribute('value',String(n+1));
 }
 expect(ready).toHaveBeenLastCalledWith(true);expect(screen.getByRole('button',{name:'三回合完成 ✓'})).toBeDisabled();
});
it('clears a pending throw when care is cancelled',()=>{
 vi.useFakeTimers();const ready=vi.fn();const view=render(<PetCareStudio petId="bunny" action="play" onReady={ready}/>);
 fireEvent.click(screen.getByRole('button',{name:'🎾 丟球給夥伴'}));view.unmount();act(()=>vi.advanceTimersByTime(2000));expect(ready).not.toHaveBeenCalledWith(true);expect(vi.getTimerCount()).toBe(0);
});

it('requires each bedtime step and does not count the previous button twice',()=>{
 const ready=vi.fn();render(<PetCareStudio petId="bunny" action="sleep" onReady={ready}/>);
 const first=screen.getByRole('button',{name:'調暗小夜燈'});fireEvent.click(first);fireEvent.click(first);
 expect(screen.getByRole('progressbar')).toHaveAttribute('value','1');expect(ready).not.toHaveBeenCalledWith(true);
 fireEvent.click(screen.getByRole('button',{name:'蓋好小被被'}));expect(ready).not.toHaveBeenCalledWith(true);
 fireEvent.click(screen.getByRole('button',{name:'輕聲說晚安'}));expect(ready).toHaveBeenLastCalledWith(true);
 expect(screen.getByRole('button',{name:'晚安準備完成 ✓'})).toBeDisabled();
});

it('reads distinct pages only after confirmation and stops speech on leaving',()=>{
 const ready=vi.fn(),speak=vi.fn(),stop=vi.fn();const view=render(<PetCareStudio petId="bunny" action="study" words={['rabbit','carrot','hop']} onReady={ready} speak={speak} stopSpeech={stop}/>);
 expect(speak).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'♫ 聽這一頁'}));expect(speak).toHaveBeenCalledWith('rabbit');expect(screen.getByRole('progressbar')).toHaveAttribute('value','0');
 const first=screen.getByRole('button',{name:'這頁讀好了，翻下一頁'});fireEvent.click(first);fireEvent.click(first);expect(screen.getByText('carrot')).toBeInTheDocument();expect(screen.getByRole('progressbar')).toHaveAttribute('value','1');
 fireEvent.click(screen.getByRole('button',{name:'這頁讀好了，翻下一頁'}));expect(ready).not.toHaveBeenCalledWith(true);fireEvent.click(screen.getByRole('button',{name:'這頁讀好了，夾上書籤'}));expect(ready).toHaveBeenLastCalledWith(true);expect(screen.getByRole('button',{name:'書籤已夾好 ✓'})).toBeDisabled();view.unmount();expect(stop).toHaveBeenCalled();
});
it('uses the existing care sentence when a pet has no vocabulary',()=>{
 const ready=vi.fn();render(<PetCareStudio petId="bunny" action="study" words={['',null]} prompt="Let’s read." onReady={ready}/>);expect(screen.getByText('Let’s read.')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'這頁讀好了，夾上書籤'}));expect(ready).toHaveBeenLastCalledWith(true);
});

it('moves keyboard focus between food and mouth and counts three deliberate bites',()=>{
 const ready=vi.fn();render(<PetCareStudio petId="kitty" action="feed" food={{emoji:'🍎',name:'蘋果'}} onReady={ready}/>);
 for(let n=0;n<3;n++){fireEvent.click(screen.getByRole('button',{name:/拿起蘋果/}));const mouth=screen.getByRole('button',{name:'餵一口'});expect(mouth).toHaveFocus();fireEvent.click(mouth);fireEvent.click(mouth);expect(screen.getByRole('progressbar')).toHaveAttribute('value',String(n+1));expect(screen.getByLabelText(`第 ${n+1} 口已吃完`)).toBeInTheDocument();if(n<2)expect(screen.getByRole('button',{name:/拿起蘋果/})).toHaveFocus();}
 expect(ready).toHaveBeenLastCalledWith(true);expect(screen.getByRole('button',{name:'三口都吃完了 ✓'})).toBeDisabled();
});

it('keeps a wipe on one pointer, stops on cancellation, and can resume without duplicate spots',()=>{
 const ready=vi.fn();render(<PetCareStudio petId="kitty" action="clean" onReady={ready}/>);const area=screen.getByLabelText('清潔四處泡泡'),spots=[1,2,3,4].map(n=>screen.getByRole('button',{name:`擦洗第 ${n} 處髒污`}));area.setPointerCapture=vi.fn();
 const old=document.elementFromPoint;let hit=spots[0].querySelector('span');document.elementFromPoint=()=>hit;
 const pointer=(type,id=7)=>{const event=new Event(type,{bubbles:true});Object.assign(event,{pointerId:id,button:0,clientX:10,clientY:10});fireEvent(area,event)};
 try{pointer('pointerdown');expect(screen.getByRole('progressbar')).toHaveAttribute('value','1');hit=spots[1];pointer('pointermove',8);expect(screen.getByRole('progressbar')).toHaveAttribute('value','1');pointer('pointercancel',8);pointer('pointermove');expect(screen.getByRole('progressbar')).toHaveAttribute('value','2');pointer('pointercancel');hit=spots[2];pointer('pointermove');expect(screen.getByRole('progressbar')).toHaveAttribute('value','2');pointer('pointerdown',9);hit=spots[3];pointer('pointermove',9);pointer('pointermove',9);expect(ready).toHaveBeenLastCalledWith(true);expect(screen.getByRole('progressbar')).toHaveAttribute('value','4');}
 finally{if(old)document.elementFromPoint=old;else delete document.elementFromPoint}
});
it('moves keyboard cleaning to an unfinished spot without repeating a washed one',()=>{
 render(<PetCareStudio petId="kitty" action="clean"/>);fireEvent.click(screen.getByRole('button',{name:'擦洗第 1 處髒污'}));expect(screen.getByRole('button',{name:'擦洗第 2 處髒污'})).toHaveFocus();expect(screen.getByRole('button',{name:'擦洗第 1 處髒污'})).toBeDisabled();
});
