import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const lantern={w:'lantern',m:'燈籠',p:'n.',ex:'Example: lantern.',ez:''};
const apple={w:'apple',m:'蘋果',p:'n.',ex:'I eat an apple after lunch.',ez:'午餐後我吃一顆蘋果。'};
const cached={en:'We carry a lantern at night.',zh:'我們在夜裡提著燈籠。'};
async function openCards(cards=[lantern,apple]) {
  localStorage.setItem('eg_quiet','true');
  window.history.replaceState({englishGoNavigation:{lv:'elementary',mod:'srs',menuGroup:'learn',depth:0,customDeck:{cards,source:'檢查單字卡'}}},'','/');
  const view=render(<App/>);
  await screen.findByTestId('srs-card',{}, {timeout:5000});
  return view;
}
function reveal(){fireEvent.click(screen.getByRole('button',{name:'點卡片看答案'}))}
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()});

describe('vocabulary card audit regressions',()=>{
  it('shares and copies the displayed generated example and its paired translation',async()=>{
    localStorage.setItem('ex_lantern',JSON.stringify(cached));
    const open=vi.spyOn(window,'open').mockImplementation(()=>null);
    const writeText=vi.fn().mockResolvedValue();
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
    await openCards();reveal();
    fireEvent.click(screen.getByRole('button',{name:'📤 LINE'}));
    expect(open).toHaveBeenCalledOnce();
    const share=new URL(open.mock.calls[0][0]);
    expect(share.searchParams.get('text')).toContain(cached.en);
    expect(share.searchParams.get('text')).not.toContain('Example: lantern.');
    fireEvent.click(screen.getByRole('button',{name:'📋 複製'}));
    await screen.findByText('✅ 已複製單字與例句！');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(cached.zh));
  });

  it('shows a clipboard failure without an unhandled rejection',async()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(Error('denied'))}});
    await openCards([apple]);reveal();
    fireEvent.click(screen.getByRole('button',{name:'📋 複製'}));
    expect(await screen.findByText('目前無法複製，請允許剪貼簿權限後重試。')).toBeInTheDocument();
  });

  it('keeps the generated example in the built-in dictionary and prevents background grading while it is open',async()=>{
    localStorage.setItem('ex_lantern',JSON.stringify(cached));
    await openCards();reveal();
    const trigger=screen.getByTestId('srs-dictionary-action');fireEvent.click(trigger);
    const dictionary=await screen.findByRole('complementary',{name:'Dictionary results'});
    expect(dictionary).toHaveFocus();expect(within(dictionary).getByText(cached.en)).toBeInTheDocument();
    fireEvent.keyDown(window,{key:'3'});fireEvent.keyDown(window,{key:' ',code:'Space'});
    fireEvent.click(screen.getByRole('button',{name:/記住了/}));
    expect(screen.getByTestId('srs-back-primary')).toHaveTextContent('lantern');
    fireEvent.keyDown(window,{key:'Escape'});
    expect(screen.queryByRole('complementary',{name:'Dictionary results'})).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(screen.getByRole('button',{name:/記住了/}));reveal();
    expect(screen.getByTestId('srs-card')).toHaveTextContent(apple.ex);
    expect(screen.getByTestId('srs-card')).not.toHaveTextContent(cached.en);
  });

  it('ignores invalid saved examples and does not label word playback as example playback',async()=>{
    localStorage.setItem('ex_auditword',JSON.stringify({en:[],zh:{}}));
    await openCards([{...lantern,w:'auditword',ex:'Example: auditword.'}]);reveal();
    expect(screen.queryByRole('button',{name:'🔊 朗讀例句'})).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'🎤 練單字發音'})).toBeInTheDocument();
    expect(localStorage.getItem('ex_auditword')).toBeNull();
  });

  it('includes relearning attempts in the completion result',async()=>{
    vi.useFakeTimers({toFake:['Date']});
    await openCards([apple]);reveal();
    fireEvent.click(screen.getByRole('button',{name:/再看看/}));
    vi.setSystemTime(new Date(Date.now()+200));reveal();
    fireEvent.click(screen.getByRole('button',{name:/記住了/}));
    expect(await screen.findByText('本輪記住率 50% · 答題 2 次')).toBeInTheDocument();
  });

  it('imports bilingual examples, completes the imported round once and restarts the same imported cards',async()=>{
    const view=await openCards([apple]);
    const file=new File(['word,meaning,pos,example,example_zh\nlantern,燈籠,n.,We carry a lantern at night.,我們在夜裡提著燈籠。'],'words.csv',{type:'text/csv'});
    fireEvent.change(screen.getByLabelText('選擇 CSV 單字卡檔案'),{target:{files:[file]}});
    await screen.findByText('已匯入 1 個單字。');
    expect(screen.getByRole('button',{name:'播放單字 lantern'})).toBeInTheDocument();
    reveal();expect(screen.getByTestId('srs-card')).toHaveTextContent(cached.en);
    fireEvent.click(screen.getByRole('button',{name:/記住了/}));
    await screen.findByText('練習完成！共 1 張');
    expect(JSON.parse(localStorage.getItem('eg_stats')).srsRounds).toBe(1);
    fireEvent.click(screen.getByRole('button',{name:'🔄 新一輪'}));
    expect(await screen.findByRole('button',{name:'播放單字 lantern'})).toBeInTheDocument();
    expect(window.history.state.englishGoNavigation.srsSession.selectedTopic).toBe('imported');
    view.unmount();
  });
});
