import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GrammarWorkshop from './GrammarWorkshop.jsx';
import SpeakingStudio from './SpeakingStudio.jsx';
import SongsStudio from './SongsStudio.jsx';
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
afterEach(() => { [window.SpeechRecognition, window.webkitSpeechRecognition] = originals; Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
function speaking(supported = true, extra = {}) {
  const instances = [];
  class Recognition {
    constructor() { instances.push(this); }
    start = vi.fn(); abort = vi.fn(); stop = vi.fn(() => this.onend?.());
    answer(text) { const row = Object.assign([{ transcript: text, confidence: 1 }], { isFinal: true }); this.onresult?.({ resultIndex: 0, results: [row] }); this.onend?.(); }
  }
  window.SpeechRecognition = supported ? Recognition : undefined; window.webkitSpeechRecognition = undefined;
  const deps = { ...common(), fallback: [{ en: 'apple', zh: '蘋果', type: 'word' }, { en: 'dog', zh: '狗', type: 'word' }], modes: [{ id: 'mixed', label: '混合練習' }], fetchSpeakItems: vi.fn().mockResolvedValue([]), selectSpeakItemsByMode: items => items, localPronunciationGuide: () => ({ target: 'apple', syllables: 'ap-ple', stress: 'ap', steps: [] }), generatePronunciationGuide: vi.fn(), compareWords: (target, heard) => ({ pct: target === heard ? 100 : 0, result: [{ word: target, ok: target === heard }], extra: [] }), speakPassThreshold: () => 80, normalizeText: s => s, ...extra };
  const props = { lv: 'elementary', onBack: vi.fn(), onXp: vi.fn(), deps };
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
