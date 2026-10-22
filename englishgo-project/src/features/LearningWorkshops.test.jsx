import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GrammarWorkshop from './GrammarWorkshop.jsx';
import SpeakingStudio from './SpeakingStudio.jsx';
import SongsStudio from './SongsStudio.jsx';
import { cardPracticeStorageKey } from '../data/cardSpeaking.js';
const Hdr = ({ t, onBack }) => <header><button onClick={onBack}>返回</button><h1>{t}</h1></header>;
const common = () => ({ Hdr, c: { cl: '#507364' }, speak: vi.fn(() => ({})), stopSpeech: vi.fn(), playSound: vi.fn() });
const button = name => screen.getByRole('button', { name, exact: true });
const click = name => fireEvent.click(button(name));
const rule = { t: 'Be 動詞', q: { s: 'I ___ ready.', o: ['am', 'is'], a: 0 } };
function grammar(extra = {}) {
  const deps = { ...common(), rules: [rule], grammarDrills: () => [rule.q], grammarGuide: () => ({ pattern: 'I + am', zh: '認識自己', tips: ['I 配 am'], examples: [{ en: 'I am ready.', zh: '我準備好了。' }], mistake: '留意主詞' }), generateGrammarAiExplanation: vi.fn(), ...extra };
  const props = { lv: 'elementary', onBack: vi.fn(), onXp: vi.fn(), deps, apiKey: 'test' };
  return { ...render(<StrictMode><GrammarWorkshop {...props} /></StrictMode>), props, deps };
}
const originals = [window.SpeechRecognition, window.webkitSpeechRecognition];
afterEach(() => { vi.useRealTimers(); [window.SpeechRecognition, window.webkitSpeechRecognition] = originals; Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
function speaking(supported = true, extra = {}, overrides = {}) {
  const instances = [];
  class Recognition {
    constructor() { instances.push(this); }
    start = vi.fn(); abort = vi.fn(); stop = vi.fn(() => this.onend?.());
    answer(text) { const row = Object.assign([{ transcript: text, confidence: 1 }], { isFinal: true }); this.onresult?.({ resultIndex: 0, results: [row] }); this.onend?.(); }
  }
  window.SpeechRecognition = supported ? Recognition : undefined; window.webkitSpeechRecognition = undefined;
  const deps = { ...common(), fallback: [{ en: 'apple', zh: '蘋果', type: 'word' }, { en: 'dog', zh: '狗', type: 'word' }], modes: [{ id: 'mixed', label: '混合練習' }], fetchSpeakItems: vi.fn().mockResolvedValue([]), selectSpeakItemsByMode: items => items, localPronunciationGuide: () => ({ target: 'apple', syllables: 'ap-ple', stress: 'ap', steps: [] }), generatePronunciationGuide: vi.fn(), compareWords: (target, heard) => ({ pct: target === heard ? 100 : 0, result: [{ word: target, ok: target === heard }], extra: [] }), speakPassThreshold: () => 80, normalizeText: s => s, ...extra };
  const props = { lv: 'elementary', onBack: vi.fn(), onXp: vi.fn(), deps, ...overrides };
  return { ...render(<StrictMode><SpeakingStudio {...props} /></StrictMode>), props, deps, instances };
}
const song = { id: 'song', title: 'One Song', audio: '/one.mp3', lines: [{ t: 2, en: 'One apple', zh: '一顆蘋果' }, { t: 5, en: 'Two dogs', zh: '兩隻狗' }], vocab: ['apple', 'dogs'], patterns: [] };
function songs() {
  const props = { lv: 'elementary', onBack: vi.fn(), onXp: vi.fn(), deps: { ...common(), SONGS: { elementary: [song] }, LV: { elementary: { cl: '#507364', ac: '#fff', bg: '#eee' } }, S: {}, readingWords: text => text.split(' '), shuffleCopy: a => a, scrollChildIntoPanel: vi.fn() } };
  const view = render(<StrictMode><SongsStudio {...props} /></StrictMode>), audio = view.container.querySelector('audio');
  Object.defineProperty(audio, 'duration', { configurable: true, value: 10 });
  Object.defineProperty(audio, 'paused', { configurable: true, writable: true, value: true });
  audio.play = vi.fn(() => { audio.paused = false; fireEvent.play(audio); return Promise.resolve(); });
  audio.pause = vi.fn(() => { audio.paused = true; fireEvent.pause(audio); });
  fireEvent.loadedMetadata(audio);
  return { ...view, props, audio };
}
describe('learning workshops', () => {
  const phraseCard={word:'water',meaning:'水',en:'Please drink more water.',zh:'請多喝水。',type:'sentence'};
  it('guides each phrase at the learner pace, then records full-sentence self practice without a recognition reward',()=>{
    const view=speaking(true,{}, {cardPractice:phraseCard});
    click('帶我逐段跟讀 →');
    expect(view.deps.speak).toHaveBeenLastCalledWith('Please drink','en-US',.65,expect.any(Object));
    expect(screen.getByRole('heading',{name:'Please drink'})).toHaveFocus();
    expect(button('← 上一段')).toBeDisabled();
    act(()=>view.deps.speak.mock.lastCall[3].onend());
    expect(screen.getByText('換你跟著唸，準備好再前進。')).toBeInTheDocument();
    expect(view.deps.speak).toHaveBeenCalledOnce();
    expect(view.instances).toHaveLength(0);
    click('這段練好了，下一段 →');
    expect(view.deps.speak).toHaveBeenLastCalledWith('more water.','en-US',.65,expect.any(Object));
    expect(screen.getByRole('progressbar',{name:'分段跟讀進度'})).toHaveAttribute('value','1');
    click('這段練好了，接回整句 →');
    expect(screen.getByRole('heading',{name:'把小段連起來，再說一次整句。'})).toHaveFocus();
    expect(within(screen.getByRole('region',{name:'分段聽說'})).getByText(phraseCard.en)).toHaveAttribute('lang','en');
    expect(view.deps.speak).toHaveBeenCalledTimes(2);
    expect(view.props.onXp).not.toHaveBeenCalled();
    expect(localStorage.getItem(cardPracticeStorageKey('elementary',phraseCard))).toBeNull();
    click('🔊 聽完整句');
    expect(view.deps.speak).toHaveBeenLastCalledWith(phraseCard.en,'en-US',.85,expect.any(Object));
    click('整句也跟讀過了，繼續 →');
    expect(screen.getByRole('region',{name:'口說練習完成'})).toBeInTheDocument();
    const record=Object.values(JSON.parse(localStorage.getItem(cardPracticeStorageKey('elementary',phraseCard))).records)[0];
    expect(record).toMatchObject({selfPracticed:true,passed:false,attempts:0});
    expect(view.props.onXp).not.toHaveBeenCalled();
  });
  it('replays and revisits phrases, ignores an earlier audio finish, and exits with keyboard focus restored',()=>{
    const view=speaking(true,{}, {cardPractice:phraseCard});
    click('帶我逐段跟讀 →');const firstEnd=view.deps.speak.mock.lastCall[3].onend;
    click('這段練好了，下一段 →');act(()=>firstEnd());
    expect(button('■ 停止這段')).toBeInTheDocument();
    click('■ 停止這段');click('再聽這段');expect(view.deps.speak.mock.lastCall[0]).toBe('more water.');
    click('← 上一段');expect(view.deps.speak.mock.lastCall[0]).toBe('Please drink');
    click('■ 停止這段');expect(screen.getByText('換你跟著唸，準備好再前進。')).toBeInTheDocument();
    click('結束分段');expect(button('帶我逐段跟讀 →')).toHaveFocus();
    expect(view.props.onXp).not.toHaveBeenCalled();
    expect(screen.queryByRole('progressbar',{name:'分段跟讀進度'})).not.toBeInTheDocument();
  });
  it('cancels guided audio when hiding English, recording, or pausing, without automatically restarting it',()=>{
    const view=speaking(true,{}, {cardPractice:phraseCard});
    click('帶我逐段跟讀 →');view.deps.stopSpeech.mockClear();click('先聽不看英文');
    expect(view.deps.stopSpeech).toHaveBeenCalledOnce();
    expect(screen.queryByRole('region',{name:'分段聽說'})).not.toBeInTheDocument();
    click('顯示英文');expect(view.deps.speak).toHaveBeenCalledOnce();
    click('帶我逐段跟讀 →');click('🎤 直接開說');
    expect(screen.queryByRole('region',{name:'分段聽說'})).not.toBeInTheDocument();
    click('取消這次錄音');expect(button('帶我逐段跟讀 →')).toBeInTheDocument();
    click('帶我逐段跟讀 →');
    Object.defineProperty(document,'hidden',{configurable:true,value:true});fireEvent(document,new Event('visibilitychange'));
    const plays=view.deps.speak.mock.calls.length;
    click('繼續聽說練習');expect(button('帶我逐段跟讀 →')).toBeInTheDocument();
    expect(view.deps.speak).toHaveBeenCalledTimes(plays);
    expect(view.props.onXp).not.toHaveBeenCalled();
  });
  it('allows guided practice to recover from unavailable audio without starting the microphone',()=>{
    const view=speaking(false,{speak:vi.fn(()=>null)}, {cardPractice:phraseCard});
    click('帶我逐段跟讀 →');
    expect(screen.getByText('示範暫時無法播放，可以再聽一次，或照著文字跟讀。')).toBeInTheDocument();
    view.deps.speak.mockImplementation(()=>({}));click('再聽這段');
    expect(button('■ 停止這段')).toBeInTheDocument();
    click('這段練好了，下一段 →');click('這段練好了，接回整句 →');click('再練分段');
    expect(screen.getByRole('heading',{name:'Please drink'})).toBeInTheDocument();
    expect(view.instances).toHaveLength(0);
    expect(view.props.onXp).not.toHaveBeenCalled();
  });
  it('opens a card example without auto audio or recording, plays its phrases, and preserves normal speaking progress',()=>{
    const normal=JSON.stringify({untouched:true});localStorage.setItem('eg_speaking_studio_elementary',normal);
    const cardPractice={word:'dog',meaning:'狗',en:'My dog likes to run in the park.',zh:'我的狗喜歡在公園裡跑。',type:'sentence'};
    const view=speaking(true,{}, {cardPractice});
    expect(view.instances).toHaveLength(0); expect(view.deps.speak).not.toHaveBeenCalled();
    expect(view.deps.fetchSpeakItems).not.toHaveBeenCalled();
    click('慢慢聽');expect(view.deps.speak).toHaveBeenLastCalledWith(cardPractice.en,'en-US',.65,expect.any(Object));
    const lateFinish=view.deps.speak.mock.lastCall[3].onend;
    click('聽第 1 段：My dog likes to');
    expect(view.deps.speak).toHaveBeenLastCalledWith('My dog likes to','en-US',.65,expect.any(Object));
    expect(button('聽第 1 段：My dog likes to')).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('status')).toHaveTextContent('正在播放 · 第 1 段');
    act(()=>lateFinish());expect(button('■ 停止示範')).toBeInTheDocument();
    click('■ 停止示範');expect(screen.queryByRole('button',{name:'■ 停止示範'})).not.toBeInTheDocument();
    click('先聽不看英文'); expect(screen.queryByText(cardPractice.en)).not.toBeInTheDocument();
    expect(within(screen.getByRole('region',{name:'來自單字卡'})).queryByText('dog')).not.toBeInTheDocument();
    click('🎤 直接開說');act(()=>view.instances[0].answer(cardPractice.en));
    expect(screen.getByText(cardPractice.en,{selector:'.workshop-spoken-target'})).toBeInTheDocument();
    expect(view.props.onXp).toHaveBeenCalledExactlyOnceWith(15);
    expect(localStorage.getItem('eg_speaking_studio_elementary')).toBe(normal);
    view.unmount();
    const resumed=speaking(true,{}, {cardPractice});
    click('🎤 直接開說');act(()=>resumed.instances[0].answer(cardPractice.en));
    expect(resumed.props.onXp).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(cardPracticeStorageKey('elementary',cardPractice))).records).toBeTruthy();
    click('完成');click('回到單字卡繼續複習');expect(resumed.props.onBack).toHaveBeenCalledOnce();
  });
  it('keeps a card practice after hiding the page and supports a microphone-free completion without rewards',()=>{
    const cardPractice={word:'apple',meaning:'蘋果',en:'An apple.',zh:'一顆蘋果。',type:'sentence'};
    const view=speaking(false,{}, {cardPractice});
    Object.defineProperty(document,'hidden',{configurable:true,value:true});fireEvent(document,new Event('visibilitychange'));
    click('繼續聽說練習');click('我跟讀過了，繼續 →');
    expect(screen.getByRole('region',{name:'口說練習完成'})).toBeInTheDocument();
    expect(view.props.onXp).not.toHaveBeenCalled();
    click(`朗讀 ${cardPractice.en}`);
    expect(screen.getByRole('status')).toHaveTextContent('成果重聽');
    click(`停止朗讀 ${cardPractice.en}`);
    expect(screen.queryByText(/正在播放/)).not.toBeInTheDocument();
    click(`朗讀 ${cardPractice.en}`);click('■ 停止示範');
    expect(button(`朗讀 ${cardPractice.en}`)).toHaveAttribute('aria-pressed','false');
    click('再練一次');expect(screen.getByRole('heading',{name:cardPractice.zh})).toBeInTheDocument();
  });
  it('distinguishes microphone startup, listening and processing, and cancels without scoring late results', () => {
    const view = speaking(); click('開始口說小練習 →'); click('🎤 直接開說');
    const recognition = view.instances[0];
    expect(button('準備麥克風…')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('還沒開始收音');
    act(() => recognition.onstart());
    expect(screen.getByRole('status')).toHaveTextContent('正在聽');
    recognition.stop.mockImplementation(() => {});
    click('■ 說好了，停止');
    expect(button('正在整理結果…')).toBeDisabled();
    const lateResult = recognition.onresult, lateEnd = recognition.onend;
    click('取消這次錄音');
    act(() => { lateResult({ resultIndex: 0, results: [Object.assign([{ transcript: 'apple' }], { isFinal: true })] }); lateEnd(); });
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(button('🎤 直接開說')).toBeEnabled();
    expect(view.props.onXp).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('eg_speaking_studio_elementary')).records).toEqual({});
  });
  it('finishes a timed-out capture with confirmed words when the browser never sends an end event', () => {
    vi.useFakeTimers();
    const view = speaking(); click('開始口說小練習 →'); click('🎤 直接開說');
    const recognition = view.instances[0]; recognition.stop.mockImplementation(() => {});
    act(() => { recognition.onstart(); recognition.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'apple' }], { isFinal: true })] }); });
    act(() => vi.advanceTimersByTime(25000));
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(button('正在整理結果…')).toBeDisabled();
    const lateEnd = recognition.onend;
    act(() => vi.advanceTimersByTime(4000));
    expect(view.props.onXp).toHaveBeenCalledExactlyOnceWith(15);
    expect(screen.getByText('文字符合度 100% · 通過參考 80%')).toBeInTheDocument();
    act(() => lateEnd());
    expect(view.props.onXp).toHaveBeenCalledOnce();
    expect(recognition.abort).toHaveBeenCalledOnce();
  });
  it('replaces provisional words and only scores confirmed recognition text', () => {
    const compareWords = vi.fn((target, heard) => ({ pct: target === heard ? 100 : 0, result: [], extra: [] }));
    const view = speaking(true, { compareWords }); click('開始口說小練習 →'); click('🎤 直接開說');
    const recognition = view.instances[0];
    const row = (transcript, isFinal) => Object.assign([{ transcript }], { isFinal });
    act(() => recognition.onresult({ resultIndex: 0, results: [row('wrong', false), row('old words', false)] }));
    expect(screen.getByRole('status')).toHaveTextContent('wrong old words');
    act(() => recognition.onresult({ resultIndex: 0, results: [row('apple', true)] }));
    expect(screen.getByRole('status')).not.toHaveTextContent('old words');
    act(() => recognition.onresult({ resultIndex: 1, results: [row('apple', true), row('unconfirmed', false)] }));
    click('■ 說好了，停止');
    expect(compareWords).toHaveBeenCalledExactlyOnceWith('apple', 'apple');
    click('重說一次');
    act(() => { view.instances[1].onresult({ resultIndex: 0, results: [row('apple', false)] }); view.instances[1].onend(); });
    expect(screen.getByRole('alert')).toHaveTextContent('還沒收到完整的辨識結果');
    expect(compareWords).toHaveBeenCalledOnce();
  });
  it('recovers from a microphone that never starts, and aborts recording when a demo is requested', () => {
    vi.useFakeTimers();
    const view = speaking(); click('開始口說小練習 →'); click('🎤 直接開說');
    const lateStart = view.instances[0].onstart;
    act(() => vi.advanceTimersByTime(25000));
    act(() => lateStart());
    expect(screen.getByRole('alert')).toHaveTextContent('麥克風還沒有啟動');
    expect(button('🎤 直接開說')).toBeEnabled();
    click('🎤 直接開說'); const lateEnd = view.instances[1].onend;
    click('🔊 聽示範'); act(() => lateEnd());
    expect(view.instances[1].abort).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(view.props.onXp).not.toHaveBeenCalled();
    expect(button('🎤 直接開說')).toBeEnabled();
  });
  it('clears pending capture completion when leaving the studio', () => {
    vi.useFakeTimers();
    const view = speaking(); click('開始口說小練習 →'); click('🎤 直接開說');
    const recognition = view.instances[0]; recognition.stop.mockImplementation(() => {});
    act(() => { recognition.onstart(); recognition.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'apple' }], { isFinal: true })] }); });
    click('■ 說好了，停止'); view.unmount();
    act(() => vi.advanceTimersByTime(4000));
    expect(view.props.onXp).not.toHaveBeenCalled();
    expect(recognition.abort).toHaveBeenCalledOnce();
  });
  it('gates grammar stages, persists a wrong answer, then awards only the first correct retry', () => {
    const view = grammar(); click(/第 01 課/);
    expect(screen.getByRole('button', { name: /3.*小挑戰/ })).toBeDisabled();
    click('看懂了，練練看 →'); fireEvent.click(screen.getByTestId('grammar-drill-0-option-0')); click('準備好了，試試小挑戰 →');
    fireEvent.click(screen.getByTestId('grammar-quiz-option-1')); expect(view.props.onXp).not.toHaveBeenCalled(); view.unmount();
    const resumed = grammar(); click('繼續上次這一課 →'); expect(screen.getByText('差一點，一起再看看')).toBeInTheDocument();
    click('再試一次'); fireEvent.click(screen.getByTestId('grammar-quiz-option-0')); expect(resumed.props.onXp).toHaveBeenCalledExactlyOnceWith(5);
    click('看看這一課的收穫 →'); click('回到句型地圖'); click('繼續上次這一課 →');
    expect(screen.getByTestId('grammar-quiz-option-0')).toBeDisabled(); expect(resumed.props.onXp).toHaveBeenCalledTimes(1);
  });
  it('ignores a grammar AI response after leaving the lesson', async () => {
    let resolve; const view = grammar({ generateGrammarAiExplanation: vi.fn(() => new Promise(r => { resolve = r; })) });
    click(/第 01 課/); fireEvent.click(screen.getByText('需要多一點說明？')); click('AI 講解'); click('返回'); click('繼續上次這一課 →');
    await act(async () => resolve({ simple: 'old response' })); expect(screen.queryByText('old response')).not.toBeInTheDocument(); view.unmount();
  });
  it('starts speech only by gesture, ends empty captures, and ignores late events after errors', () => {
    const view = speaking(); expect(view.instances).toHaveLength(0); click('開始口說小練習 →'); expect(view.deps.speak).not.toHaveBeenCalled();
    click('🎤 直接開說'); act(() => view.instances[0].onend()); expect(screen.getByRole('alert')).toHaveTextContent('沒有聽到聲音');
    click('🎤 直接開說'); const recognition = view.instances[1], lateEnd = recognition.onend;
    act(() => recognition.onerror({ error: 'not-allowed' })); act(() => lateEnd());
    expect(screen.getByRole('alert')).toHaveTextContent('麥克風尚未獲得允許'); expect(button('🎤 直接開說')).toBeEnabled(); expect(view.props.onXp).not.toHaveBeenCalled();
  });
  it('saves passed speech before reward and resumes without recording or awarding again', () => {
    const view = speaking(); click('開始口說小練習 →'); click('🎤 直接開說');
    const lateEnd = view.instances[0].onend; act(() => view.instances[0].answer('apple')); act(() => lateEnd());
    expect(view.props.onXp).toHaveBeenCalledExactlyOnceWith(15); view.unmount();
    const resumed = speaking(); click('繼續上次練習'); expect(resumed.instances).toHaveLength(0); click('下一個');
    expect(screen.getByRole('heading', { name: '狗' })).toBeInTheDocument(); expect(resumed.props.onXp).not.toHaveBeenCalled();
  });
  it('aborts recording on hide and allows unsupported browsers to finish by self practice', () => {
    const view = speaking(); click('開始口說小練習 →'); click('🎤 直接開說');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true }); fireEvent(document, new Event('visibilitychange'));
    expect(view.instances[0].abort).toHaveBeenCalled(); expect(button('繼續上次練習')).toBeInTheDocument(); view.unmount();
    const unsupported = speaking(false); click('繼續上次練習');
    for (let i = 0; i < 2; i++) { fireEvent.click(screen.getByText('今天想先跟讀，不用麥克風')); click('我跟讀過了，繼續 →'); }
    expect(screen.getByRole('region', { name: '口說練習完成' })).toBeInTheDocument(); expect(unsupported.props.onXp).not.toHaveBeenCalled();
  });
  it('pauses at the lyric boundary, loops only that lyric, and cancels a loop on navigation', async () => {
    const { audio, props } = songs(); expect(audio.play).not.toHaveBeenCalled(); click('逐句跟唱');
    click('♫ 聽這一句'); await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(1)); expect(audio.currentTime).toBe(2);
    audio.currentTime = 5.2; fireEvent.timeUpdate(audio); expect(audio.paused).toBe(true); expect(audio.currentTime).toBe(5);
    click('循環這一句'); audio.currentTime = 5; fireEvent.timeUpdate(audio); expect(audio.currentTime).toBe(2);
    click('歌詞填空'); expect(audio.paused).toBe(true); audio.currentTime = 7; fireEvent.timeUpdate(audio); expect(audio.currentTime).toBe(7); expect(props.onXp).not.toHaveBeenCalled();
  });
  it('restores song position without autoplay and preserves fill-in rewards across replay', () => {
    const view = songs(); view.audio.currentTime = 3.2; fireEvent.pause(view.audio); click('歌詞填空'); click('dogs'); click('再試一次'); click('apple'); expect(view.props.onXp).toHaveBeenCalledExactlyOnceWith(2); view.unmount();
    const resumed = songs(); expect(resumed.audio.currentTime).toBe(3.2); expect(resumed.audio.play).not.toHaveBeenCalled();
    click('歌詞填空'); expect(button('apple')).toBeDisabled(); click('下一題'); click('dogs'); click('完成'); click('再練一次'); click('apple');
    expect(resumed.props.onXp).toHaveBeenCalledExactlyOnceWith(2);
  });
  it('awards a completed song only once and excludes phrase playback', () => {
    const { audio, props } = songs(); fireEvent.ended(audio); fireEvent.ended(audio); expect(props.onXp).toHaveBeenCalledExactlyOnceWith(10);
    click('逐句跟唱'); click('♫ 聽這一句'); fireEvent.ended(audio); expect(props.onXp).toHaveBeenCalledTimes(1);
  });
  it('keeps the latest requested phrase playing when earlier play promises finish late', async () => {
    const { audio } = songs(), pending = [];
    audio.play = vi.fn(() => new Promise(resolve => pending.push(resolve)));
    click('逐句跟唱'); click('♫ 聽這一句'); click('循環這一句'); audio.pause.mockClear();
    await act(async () => pending[0]()); expect(audio.pause).not.toHaveBeenCalled();
    click('停止循環'); audio.paused = false;
    await act(async () => pending[1]()); expect(audio.paused).toBe(true);
  });
});
