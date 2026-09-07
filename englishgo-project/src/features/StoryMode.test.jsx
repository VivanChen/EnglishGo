import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {StoryMode} from '../App.jsx';
import {generateStoryPayload} from './storyGeneration.js';
vi.mock('./storyGeneration.js',()=>({generateStoryPayload:vi.fn()}));
const story=()=>({title:'Bunny Reads',zh_title:'小兔讀書',pages:Array.from({length:4},()=>({en:'Bunny reads a book.',zh:'小兔讀一本書。',word:'book',meaning:'書'})),questions:Array.from({length:3},(_,i)=>({q:`Question ${i+1}`,choices:['A book','A bag','A box','A ball'],correct:0,explain:'小兔讀書。'}))});
const props=()=>({lv:'elem',pets:[{petId:'bunny',rarity:'N',level:3,exp:0,bond:8}],apiKey:'qa-stub-key',c:{cl:'#0f766e',bg:'#effaf6',ac:'#2c9b88'},onXp:vi.fn(),onBack:vi.fn()});
const click=name=>fireEvent.click(screen.getByRole('button',{name,exact:true}));
const readToQuiz=()=>{for(let i=0;i<3;i++)click('下一頁 →');click('📝 開始測驗');};
beforeEach(()=>{generateStoryPayload.mockReset();});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});

it('cancels generation, ignores a late result, and allows a new story',async()=>{
  let resolve;generateStoryPayload.mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValue(story());
  render(<StoryMode {...props()}/>);click('✨ 開始生成故事');const signal=generateStoryPayload.mock.calls[0][0].signal;
  click('← 返回');expect(signal.aborted).toBe(true);await act(async()=>resolve(story()));
  expect(screen.queryByText('Bunny reads a book.')).not.toBeInTheDocument();click('✨ 開始生成故事');
  expect(await screen.findByText('Bunny reads a book.')).toBeInTheDocument();expect(generateStoryPayload).toHaveBeenCalledTimes(2);
});
it('aborts generation when leaving the module',()=>{
  generateStoryPayload.mockImplementation(()=>new Promise(()=>{}));const view=render(<StoryMode {...props()}/>);
  click('✨ 開始生成故事');const signal=generateStoryPayload.mock.calls[0][0].signal;view.unmount();expect(signal.aborted).toBe(true);
});
it('shows an incomplete-response error and permits retry',async()=>{
  generateStoryPayload.mockRejectedValueOnce(new Error('故事內容不完整')).mockResolvedValue(story());
  render(<StoryMode {...props()}/>);click('✨ 開始生成故事');expect(await screen.findByRole('alert')).toHaveTextContent('故事內容不完整');
  click('✨ 開始生成故事');expect(await screen.findByText('Bunny reads a book.')).toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('restarts all three questions after rereading without duplicating XP',async()=>{
  generateStoryPayload.mockResolvedValue(story());const settings=props();render(<StoryMode {...settings}/>);
  click('✨ 開始生成故事');await screen.findByText('Bunny reads a book.');
  for(let round=0;round<2;round++){
    readToQuiz();
    for(let i=0;i<3;i++){
      expect(screen.getByText(`Question ${i+1}`)).toBeInTheDocument();expect(screen.getByRole('button',{name:'A. A book',exact:true})).toBeEnabled();
      click('A. A book');click(i<2?'下一題 →':'🏁 查看結果');
    }
    expect(screen.getByText(/答對 3 \/ 3 題/)).toBeInTheDocument();expect(settings.onXp).toHaveBeenCalledTimes(3);
    if(round===0)click('🔁 重讀故事');
  }
});

it('continues whole-story narration through every automatic page turn',async()=>{
  vi.useFakeTimers();const utterances=[];
  vi.stubGlobal('SpeechSynthesisUtterance',class{constructor(text){this.text=text;}});
  vi.stubGlobal('speechSynthesis',{getVoices:()=>[],addEventListener(){},removeEventListener(){},cancel(){},resume(){},speak:utterance=>utterances.push(utterance)});
  generateStoryPayload.mockResolvedValue(story());render(<StoryMode {...props()}/>);
  await act(async()=>click('✨ 開始生成故事'));click('🎙️ 整本朗讀');
  for(let i=0;i<4;i++){
    expect(screen.getByText(`第 ${i+1} 頁 / 共 4 頁`)).toBeInTheDocument();
    expect(utterances).toHaveLength(i+1);
    await act(async()=>{utterances[i].onend();await vi.advanceTimersByTimeAsync(450);});
  }
  expect(screen.getByRole('button',{name:'🎙️ 整本朗讀',exact:true})).toBeEnabled();
});
