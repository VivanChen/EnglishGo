import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

const cards = [
  { w:'apple',m:'蘋果',p:'n.',ex:'I eat an apple after lunch.',ez:'午餐後我吃一顆蘋果。' },
  { w:'dog',m:'狗',p:'n.',ex:'My dog likes to run in the park.',ez:'我的狗喜歡在公園裡跑。' },
  { w:'cat',m:'貓',p:'n.',ex:'The cat is sleeping.',ez:'貓正在睡覺。' },
];
const click = name => fireEvent.click(screen.getByRole('button',{name,exact:true}));
async function openCards(items=cards){
  window.history.replaceState({englishGoNavigation:{lv:'elementary',mod:'srs',menuGroup:'learn',depth:0,customDeck:{cards:items,source:'測試複習'}}},'','/');
  const view=render(<App/>); await screen.findByTestId('srs-card',{}, {timeout:5000}); return view;
}

describe('word cards to listening and speaking',()=>{
  it('does not grant round completion again when a completed card session is restored',async()=>{
    const view=await openCards([cards[0]]);click('點卡片看答案');
    fireEvent.click(screen.getByRole('button',{name:/記住了/}));
    await screen.findByText('練習完成！共 1 張');
    expect(JSON.parse(localStorage.getItem('eg_stats')).srsRounds).toBe(1);
    view.unmount();render(<App/>);await screen.findByText('練習完成！共 1 張');
    expect(JSON.parse(localStorage.getItem('eg_stats')).srsRounds).toBe(1);
    expect(JSON.parse(localStorage.getItem('eg_daily')).done).toBe(1);
  });
  it('carries the generated example being shown instead of the placeholder on the card',async()=>{
    localStorage.setItem('ex_lantern',JSON.stringify({en:'We carry a lantern at night.',zh:'我們在夜裡提著燈籠。'}));
    await openCards([{w:'lantern',m:'燈籠',p:'n.',ex:'Example: lantern.',ez:'占位文字'}]);
    click('點卡片看答案');click('🎧 練這句聽說 →');
    await screen.findByRole('region',{name:'來自單字卡'});
    expect(document.querySelector('.workshop-spoken-target')).toHaveTextContent('We carry a lantern at night.');
    expect(screen.getByRole('heading',{name:'我們在夜裡提著燈籠。'})).toBeInTheDocument();
  });
  it('carries the selected example and returns to the same flipped card and rated deck, including after reload',async()=>{
    let view=await openCards();
    click('點卡片看答案'); fireEvent.click(screen.getByRole('button',{name:/記住了/}));
    click('點卡片看答案');
    const before=structuredClone(window.history.state.englishGoNavigation.srsSession);
    expect(before.deck.rm).toEqual([0]);
    click('🎧 練這句聽說 →');
    await screen.findByRole('region',{name:'來自單字卡'});
    expect(document.querySelector('.workshop-spoken-target')).toHaveTextContent(cards[1].ex);
    expect(screen.getByRole('heading',{name:cards[1].ez})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'開始口說小練習 →'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('想多練一下？')); click('先聽不看英文'); expect(document.querySelector('.workshop-spoken-target')).not.toBeInTheDocument();
    click('顯示英文');
    click('← 回到單字卡');
    await screen.findByTestId('srs-back-primary');
    expect(screen.getByTestId('srs-back-primary')).toHaveTextContent('dog');
    expect(window.history.state.englishGoNavigation.srsSession.deck).toEqual(before.deck);
    expect(JSON.parse(localStorage.getItem('eg_daily')).done).toBe(1);
    view.unmount(); view=render(<App/>); await screen.findByTestId('srs-back-primary');
    expect(window.history.state.englishGoNavigation.srsSession.deck).toEqual(before.deck);
    fireEvent.click(screen.getByRole('button',{name:/記住了/}));
    await waitFor(()=>expect(window.history.state.englishGoNavigation.srsSession.deck.rm).toEqual([0,1]));
    expect(JSON.parse(localStorage.getItem('eg_daily')).done).toBe(2);
    view.unmount(); render(<App/>); await screen.findByTestId('srs-card');
    expect(screen.getByRole('button',{name:'播放單字 cat'})).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_daily')).done).toBe(2);
  });

  it('takes the exact illustration sentence and keeps word-only practice available without an example',async()=>{
    const view=await openCards([cards[0]]); click('點卡片看答案');
    const illustration=screen.getByRole('button',{name:/^練插畫例句聽說：/});
    const sentence=illustration.getAttribute('aria-label').split('：')[1];
    fireEvent.click(illustration);
    await screen.findByRole('region',{name:'來自單字卡'});
    expect(document.querySelector('.workshop-spoken-target')).toHaveTextContent(sentence);
    expect(window.history.state.englishGoNavigation.cardPractice.zh).toBeTruthy();
    view.unmount();
    await openCards([{w:'testword',m:'測試單字',p:'n.',ex:'',ez:''}]); click('點卡片看答案');
    expect(screen.queryByRole('button',{name:'🎧 練這句聽說 →',exact:true})).not.toBeInTheDocument();
    click('🎤 練單字發音'); await screen.findByRole('region',{name:'來自單字卡'});
    expect(document.querySelector('.workshop-spoken-target')).toHaveTextContent('testword');
    expect(screen.queryByRole('region',{name:'分段聽說'})).not.toBeInTheDocument();
  });
});
