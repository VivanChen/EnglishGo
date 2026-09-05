import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

async function openHome({gift=false}={}){
  if(!gift)localStorage.setItem('eg_loginBonus',JSON.stringify({lastDate:new Date().toDateString(),streak:1,claimed:true}));
  const view=render(<App/>);
  fireEvent.click(screen.getByText('Elementary').closest('button'));
  await screen.findByRole('button',{name:'開始 5 張單字小任務'});
  await waitFor(()=>expect(document.querySelector('[data-module-id="srs"]')).toHaveTextContent(/目前.*個單字可練習/));
  return view;
}

function openReading(){
  fireEvent.click(document.querySelector('[data-group-id="read"]'));
  fireEvent.click(document.querySelector('[data-module-id="reading"]'));
}

describe('child friendly learning journey',()=>{
  it('starts a short mission directly and only records progress after a response',async()=>{
    await openHome();
    fireEvent.click(screen.getByRole('button',{name:'開始 5 張單字小任務'}));
    await screen.findByTestId('srs-card');
    expect(screen.getByText('5 個單字')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_daily')).done).toBe(0);
    fireEvent.click(screen.getByRole('button',{name:'點卡片看答案'}));
    fireEvent.click(screen.getByRole('button',{name:/記住了/}));
    await waitFor(()=>expect(JSON.parse(localStorage.getItem('eg_daily')).done).toBe(1));
    fireEvent.click(screen.getByRole('button',{name:'回到學習首頁'}));
    await waitFor(()=>expect(document.querySelector('[data-module-id="srs"]')).toHaveTextContent(/目前.*個單字可練習/));
    expect(screen.getByRole('progressbar',{name:'今日學習進度'})).toHaveAttribute('aria-valuenow','1');
  });
  it('makes the welcome gift optional and cannot claim it twice',async()=>{
    await openHome({gift:true});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'領取獎勵'}));
    await waitFor(()=>expect(JSON.parse(localStorage.getItem('eg_coins'))).toBe(20));
    expect(screen.queryByRole('button',{name:'領取獎勵'})).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_daily')).done).toBe(0);
  });
  it('finds activities across categories and recovers from an empty search',async()=>{
    await openHome();
    const search=screen.getByRole('textbox',{name:'尋找學習活動'});
    fireEvent.change(search,{target:{value:'歌曲'}});
    expect(document.querySelector('[data-module-id="songs"]')).toBeInTheDocument();
    expect(screen.getByText('找到 1 個學習活動')).toBeInTheDocument();
    expect(document.querySelector('[data-module-id="srs"]')).not.toBeInTheDocument();
    fireEvent.change(search,{target:{value:'沒有這個活動'}});
    fireEvent.click(screen.getByRole('button',{name:'看看全部活動'}));
    expect(document.querySelector('[data-module-id="srs"]')).toBeInTheDocument();
    expect(search).toHaveFocus();
  });
  it('remembers comfort settings and supports arrow-key category navigation',async()=>{
    await openHome();
    fireEvent.click(screen.getByRole('button',{name:'減少動畫'}));
    expect(JSON.parse(localStorage.getItem('eg_calm'))).toBe(true);
    expect(document.documentElement.dataset.egCalm).toBe('true');
    fireEvent.click(screen.getByRole('button',{name:'關閉遊戲音效'}));
    expect(JSON.parse(localStorage.getItem('eg_quiet'))).toBe(true);
    const tab=document.querySelector('[data-group-id="learn"]');
    fireEvent.keyDown(tab,{key:'ArrowRight'});
    expect(document.querySelector('[data-group-id="read"]')).toHaveFocus();
    expect(document.querySelector('[data-group-id="read"]')).toHaveAttribute('aria-selected','true');
    expect(document.querySelector('[data-group-id="learn"]')).toHaveAttribute('tabindex','-1');
    expect(document.querySelector('[data-group-id="read"]')).toHaveAttribute('tabindex','0');
  });
  it('does not let keyboard shortcuts activate while interacting with buttons or text fields',async()=>{
    await openHome();
    fireEvent.click(screen.getByRole('button',{name:'開始 5 張單字小任務'}));
    await screen.findByTestId('srs-card');
    const reveal=screen.getByRole('button',{name:'點卡片看答案'});
    fireEvent.keyDown(reveal,{code:'Space',key:' '});
    expect(screen.getByTestId('srs-card')).toHaveClass('is-front');
    fireEvent.click(reveal);
    const input=document.createElement('input');document.body.append(input);
    fireEvent.keyDown(input,{key:'3',code:'Digit3'});
    expect(screen.getByTestId('srs-card')).toHaveClass('is-back');
    input.remove();
  });
  it('offers a useful built-in dictionary without requiring a key',async()=>{
    await openHome();
    fireEvent.click(screen.getByRole('button',{name:'開始 5 張單字小任務'}));
    fireEvent.click(await screen.findByRole('button',{name:'點卡片看答案'}));
    fireEvent.click(screen.getByTestId('srs-dictionary-action'));
    const dictionary=screen.getByTestId('srs-local-dictionary');
    expect(dictionary).toHaveTextContent('內建字典 · 直接學習');
    expect(dictionary).toHaveTextContent('試著說一句');
    expect(screen.getByRole('button',{name:'播放單字',exact:true})).toBeEnabled();
  });
  it('lets readers choose every article without horizontal scrolling',async()=>{
    await openHome();
    fireEvent.click(document.querySelector('[data-group-id="read"]'));
    fireEvent.click(document.querySelector('[data-module-id="reading"]'));
    const picker=screen.getByRole('combobox',{name:'選擇短文'});
    expect(picker.options).toHaveLength(10);
    fireEvent.change(picker,{target:{value:'4'}});
    expect(screen.getByRole('heading',{name:"Tom's New Bike"})).toBeInTheDocument();
  });
  it('resumes the selected story and answers after remount without awarding duplicate XP',async()=>{
    const view=await openHome();
    openReading();
    fireEvent.change(screen.getByRole('combobox',{name:'選擇短文'}),{target:{value:'4'}});
    fireEvent.click(screen.getByRole('button',{name:'Blue',exact:true}));
    expect(JSON.parse(localStorage.getItem('eg_xp'))).toBe(5);
    view.unmount();
    render(<App/>);
    expect(await screen.findByRole('heading',{name:"Tom's New Bike"})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/^Blue/})).toBeDisabled();
    expect(screen.getByText('已練習 1/2 題')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'For safety',exact:true}));
    expect(screen.getByRole('region',{name:'短文練習完成'})).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_xp'))).toBe(10);
    fireEvent.click(screen.getByRole('button',{name:'重做本篇'}));
    fireEvent.click(screen.getByRole('button',{name:'Blue',exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'For safety',exact:true}));
    expect(JSON.parse(localStorage.getItem('eg_xp'))).toBe(10);
  });
  it('supports a gentle retry and gives each question reward once',async()=>{
    await openHome();openReading();
    fireEvent.click(screen.getByRole('button',{name:'Nini',exact:true}));
    expect(screen.getByText('再找找線索，你可以再試一次。')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_xp'))).toBe(0);
    fireEvent.click(screen.getByRole('button',{name:'再試一次'}));
    expect(screen.getByRole('heading',{name:/What is the cat's name/})).toHaveFocus();
    const answer=screen.getByRole('button',{name:'Mimi',exact:true});
    fireEvent.click(answer);fireEvent.click(answer);
    expect(JSON.parse(localStorage.getItem('eg_xp'))).toBe(5);
    expect(screen.getByText('找到線索了！')).toBeInTheDocument();
  });
  it('offers Chinese support before answering and remembers larger reading text',async()=>{
    await openHome();openReading();
    fireEvent.click(screen.getByRole('button',{name:'看中文提示'}));
    expect(document.getElementById('eg-reading-translation')).toHaveTextContent('我有一隻寵物貓');
    expect(JSON.parse(localStorage.getItem('eg_daily')).done).toBe(0);
    fireEvent.click(screen.getByRole('button',{name:'大字閱讀'}));
    expect(document.querySelector('.eg-reading')).toHaveClass('is-large-text');
    fireEvent.click(screen.getByRole('button',{name:'回到學習首頁'}));
    await screen.findByRole('button',{name:'開始 5 張單字小任務'});
    openReading();
    expect(screen.getByRole('button',{name:'大字閱讀'})).toHaveAttribute('aria-pressed','true');
  });
  it('keeps grade progress separate and discards records for changed stories',async()=>{
    localStorage.setItem('eg_reading_elementary',JSON.stringify({selected:'My Pet Cat',articles:{'My Pet Cat':{signature:'old content',answers:{0:1},earned:{0:true}}}}));
    const view=await openHome();openReading();
    expect(screen.getByRole('button',{name:'Mimi',exact:true})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Mimi',exact:true}));
    expect(JSON.parse(localStorage.getItem('eg_xp'))).toBe(5);
    view.unmount();window.history.replaceState({},'','/');render(<App/>);
    fireEvent.click(screen.getByText('Junior High').closest('button'));
    await screen.findByRole('button',{name:'開始 5 張單字小任務'});
    await waitFor(()=>expect(document.querySelector('[data-module-id="srs"]')).toHaveTextContent(/目前.*個單字可練習/));
    openReading();
    expect(screen.getByRole('heading',{name:'The Power of Reading'})).toBeInTheDocument();
    expect(screen.getByText('已練習 0/2 題')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_reading_elementary')).articles['My Pet Cat'].answers).toEqual({'0':1});
  });
  it('finishes the five-card mission with an explicit rest action',async()=>{
    await openHome();
    fireEvent.click(screen.getByRole('button',{name:'開始 5 張單字小任務'}));
    for(let i=0;i<5;i++){
      fireEvent.click(await screen.findByRole('button',{name:'點卡片看答案'}));
      fireEvent.click(screen.getByRole('button',{name:/記住了/}));
      await act(()=>new Promise(resolve=>setTimeout(resolve,190)));
    }
    expect(await screen.findByRole('heading',{name:'練習完成！共 5 張'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'休息一下，回首頁'}));
    await screen.findByRole('button',{name:'開始 5 張單字小任務'});
    expect(screen.getByRole('progressbar',{name:'今日學習進度'})).toHaveAttribute('aria-valuenow','5');
  });
});
