import {afterEach, describe, expect, it, vi} from 'vitest';
import {generateStoryPayload, parseStoryResponse} from './storyGeneration.js';

const story = () => ({
  title:'Bunny Reads', zh_title:'小兔讀書',
  pages:Array.from({length:4},()=>({en:'Bunny reads a book.',zh:'小兔讀一本書。'})),
  questions:Array.from({length:3},()=>({q:'What does Bunny read?',choices:['A book','A bag','A box','A ball'],correct:0})),
});
const response = payload => ({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(payload)}]}}]})});
const options = {apiKey:'qa-stub-key',prompt:'Create a story.',pageCount:4};
afterEach(()=>vi.useRealTimers());

describe('complete story validation',()=>{
  it('accepts a complete wrapped response',()=>expect(parseStoryResponse('```json\n'+JSON.stringify(story())+'\n```',4)).toEqual(story()));
  it.each([
    ['missing pages',value=>delete value.pages],
    ['missing translation',value=>value.pages[2].zh=''],
    ['missing English',value=>value.pages[1].en=null],
    ['too few pages',value=>value.pages.pop()],
    ['missing questions',value=>delete value.questions],
    ['empty questions',value=>value.questions=[]],
    ['missing choices',value=>value.questions[0].choices.pop()],
    ['invalid answer',value=>value.questions[0].correct=4],
  ])('rejects %s instead of sending it to the reader',(_name,mutate)=>{
    const payload=story();mutate(payload);expect(()=>parseStoryResponse(JSON.stringify(payload),4)).toThrow('故事內容不完整');
  });
});

describe('story requests',()=>{
  it('rejects an exhausted malformed response rather than returning the last parsed object',async()=>{
    vi.useFakeTimers();const fetchImpl=vi.fn().mockResolvedValue(response({title:'Incomplete'}));
    const result=expect(generateStoryPayload({...options,fetchImpl})).rejects.toThrow('故事內容不完整');
    await vi.runAllTimersAsync();await result;expect(fetchImpl).toHaveBeenCalledTimes(6);expect(vi.getTimerCount()).toBe(0);
  });
  it('recovers from an incomplete response with a complete retry',async()=>{
    vi.useFakeTimers();const fetchImpl=vi.fn().mockResolvedValueOnce(response({pages:[]})).mockResolvedValue(response(story()));
    const result=expect(generateStoryPayload({...options,fetchImpl})).resolves.toEqual(story());
    await vi.runAllTimersAsync();await result;expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('cancels pending retry timers and sends no further requests',async()=>{
    vi.useFakeTimers();const controller=new AbortController(),fetchImpl=vi.fn().mockResolvedValue(response({}));
    const result=expect(generateStoryPayload({...options,signal:controller.signal,fetchImpl})).rejects.toMatchObject({name:'AbortError'});
    await vi.advanceTimersByTimeAsync(0);controller.abort();await vi.runAllTimersAsync();await result;
    expect(fetchImpl).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts a stalled provider and reports a recoverable timeout',async()=>{
    vi.useFakeTimers();let requestSignal;
    const fetchImpl=vi.fn((_url,{signal})=>{requestSignal=signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}));});
    const result=expect(generateStoryPayload({...options,fetchImpl,timeoutMs:3000})).rejects.toThrow('等待 AI 回覆逾時');
    await vi.advanceTimersByTimeAsync(3000);await result;expect(requestSignal.aborted).toBe(true);expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('ignores a provider that responds after cancellation',async()=>{
    const controller=new AbortController();let release;
    const pending=generateStoryPayload({...options,signal:controller.signal,fetchImpl:()=>new Promise(resolve=>{release=resolve;})});
    controller.abort();release(response(story()));await expect(pending).rejects.toMatchObject({name:'AbortError'});
  });
  it('does not retry an invalid key',async()=>{
    const fetchImpl=vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({error:{code:403}})});
    await expect(generateStoryPayload({...options,fetchImpl})).rejects.toMatchObject({kind:'auth',status:403});expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
