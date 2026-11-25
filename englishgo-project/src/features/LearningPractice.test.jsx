import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LearningPractice from './LearningPractice.jsx';
import ReviewGarden from './ReviewGarden.jsx';

const words = [{ w: 'apple', m: '蘋果', ex: 'I eat an apple.' }, { w: 'dog', m: '狗' }, { w: 'cat', m: '貓' }, { w: 'sun', m: '太陽' }, { w: 'book', m: '書' }];
const Hdr = ({ t, onBack }) => <header><button onClick={onBack}>返回</button><h1>{t}</h1></header>;
function setup(kind = 'quiz', extra = {}) {
  const deps = { words, sentences: ['We go to school.', 'I like apples.', 'She reads a book.'], fetchCloudVocab: vi.fn().mockResolvedValue([]), speak: vi.fn().mockReturnValue({ cancel() {} }), stopSpeech: vi.fn(), playSound: vi.fn(), Hdr, c: { cl: '#507364' }, ...extra };
  const props = { kind, lv: 'elementary', onBack: vi.fn(), onXp: vi.fn(), onDone: vi.fn(), onPerfect: vi.fn(), trackWeak: vi.fn(), deps };
  const view = render(<StrictMode><LearningPractice {...props} /></StrictMode>);
  return { ...view, props, deps };
}
const saved = (kind = 'quiz') => JSON.parse(localStorage.getItem(`eg_practice_${kind}_elementary`));
function choose(correct = true) {
  const state = saved(), q = state.questions[state.queue[state.index]];
  const option = correct ? q.answer : q.options.find(o => o !== q.answer);
  fireEvent.click(within(screen.getByRole('region', { name: '目前題目' })).getByRole('button', { name: new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
}
function next() { fireEvent.click(screen.getByRole('button', { name: /下一題|看看這次的收穫/ })); }

describe('practice experience', () => {
  it('requires an explicit start, keeps the current deck when cloud words arrive, and saves rewards before reload', async () => {
    let resolve; const pending = new Promise(r => { resolve = r; });
    const view = setup('quiz', { fetchCloudVocab: vi.fn().mockReturnValue(pending) });
    expect(screen.queryByRole('region', { name: '目前題目' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '開始新的小任務 →' }));
    const questions = saved().questions;
    resolve([{ w: 'cloud', m: '雲朵' }]);
    await waitFor(() => expect(saved().questions).toEqual(questions));
    choose(); expect(view.props.onXp).toHaveBeenCalledTimes(1);
    view.unmount();
    const resumed = setup();
    fireEvent.click(screen.getByRole('button', { name: '繼續上次練習' }));
    expect(screen.getByText('答對了，收下一點進步！')).toBeInTheDocument();
    expect(resumed.props.onXp).not.toHaveBeenCalled();
    expect(within(screen.getByRole('region', { name: '目前題目' })).getAllByRole('button').filter(b => b.className.includes('is-correct'))[0]).toBeDisabled();
  });
  it('brings a missed word back later in the round, tracks it once, and does not award again in targeted review', () => {
    const { props } = setup(); fireEvent.click(screen.getByRole('button', { name: '開始新的小任務 →' }));
    const missed = saved().queue[0];
    choose(false); expect(props.trackWeak).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '再試一次' })).not.toBeInTheDocument();
    expect(screen.getByText(/過幾題會再出現一次/)).toBeInTheDocument();
    expect(saved().queue).toHaveLength(6); expect(saved().queue[3]).toBe(missed);
    next();
    for (let i = 1; i < 6; i++) {
      if (i === 3) expect(screen.getByText(/剛才的單字，再認識一次/)).toBeInTheDocument();
      choose(); next();
    }
    expect(props.trackWeak).toHaveBeenCalledTimes(1);
    expect(props.onPerfect).not.toHaveBeenCalled();
    expect(props.onXp).toHaveBeenCalledTimes(5);
    fireEvent.click(screen.getByRole('button', { name: '只練需要再看的 1 題' })); choose(); next();
    expect(props.onXp).toHaveBeenCalledTimes(5);
    expect(screen.getByText('複習完成，辛苦了！')).toBeInTheDocument();
  });
  it('answers with number keys, moves on with Enter, and shows the running streak', () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: '開始新的小任務 →' }));
    for (let i = 0; i < 3; i++) {
      const state = saved(), q = state.questions[state.queue[state.index]];
      fireEvent.keyDown(window, { key: String(q.options.indexOf(q.answer) + 1) });
      expect(saved().feedback).toBe(true);
      fireEvent.keyDown(window, { key: '2' });
      expect(saved().index).toBe(i);
      fireEvent.keyDown(window, { key: 'Enter' });
    }
    expect(saved()).toMatchObject({ index: 3, streak: 3, best: 3 });
    expect(screen.getByText(/連對 3/)).toBeInTheDocument();
  });
  it('builds example-sentence blanks and can practise only weak words', () => {
    const clozeWords = [{ w: 'apple', m: '蘋果', p: 'n.', ex: 'I eat an apple.', ez: '我吃一顆蘋果。' }, { w: 'dog', m: '狗', p: 'n.', ex: 'The dog runs.', ez: '狗在跑。' }, { w: 'cat', m: '貓', p: 'n.' }, { w: 'sun', m: '太陽', p: 'n.' }];
    const deps = { words: clozeWords, fetchCloudVocab: vi.fn().mockResolvedValue([]), speak: vi.fn().mockReturnValue({}), stopSpeech: vi.fn(), playSound: vi.fn(), Hdr, c: { cl: '#507364' } };
    render(<LearningPractice kind="quiz" lv="elementary" onBack={vi.fn()} weakWords={[{ w: 'dog', n: 2 }, { w: 'missing', n: 5 }]} deps={deps} />);
    fireEvent.click(screen.getByRole('button', { name: '例句填空' }));
    fireEvent.click(screen.getByRole('button', { name: '待加強單字 · 1 個' }));
    fireEvent.click(screen.getByRole('button', { name: '開始新的小任務 →' }));
    expect(saved().questions).toHaveLength(1);
    expect(saved().questions[0]).toMatchObject({ kind: 'cloze', prompt: 'The ___ runs.', answer: 'dog' });
    expect(screen.getByText('狗在跑。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '♫ 聽例句提示' }));
    expect(deps.speak.mock.lastCall[0]).toBe('The dog runs.');
    expect(saved().records[0].hinted).toBe(true);
  });
  it('keeps listening silent until requested, pauses when hidden, and resumes without auto play', async () => {
    const { deps } = setup('listening');
    fireEvent.click(screen.getByRole('button', { name: '開始新的小任務 →' }));
    expect(deps.speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '▶ 聽這個句子' }));
    expect(deps.speak).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '■ 停止播放' })).toBeInTheDocument();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('button', { name: '繼續上次練習' })).toBeInTheDocument();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    fireEvent.click(screen.getByRole('button', { name: '繼續上次練習' }));
    expect(deps.speak).toHaveBeenCalledTimes(1);
    expect(deps.stopSpeech).toHaveBeenCalled();
  });
  it('uses actual audio lifecycle events for the listening radio and ignores canceled playback', () => {
    const { deps, container } = setup('listening');
    fireEvent.click(screen.getByRole('button', { name: '開始新的小任務 →' }));
    const radio = () => container.querySelector('.listening-radio');
    expect(radio()).toHaveAttribute('data-state', 'idle');
    fireEvent.click(screen.getByRole('button', { name: '▶ 聽這個句子' }));
    const first = deps.speak.mock.lastCall[3];
    expect(radio()).toHaveAttribute('data-state', 'loading');
    act(() => first.onstart()); expect(radio()).toHaveAttribute('data-state', 'playing');
    fireEvent.click(screen.getByRole('button', { name: '慢慢聽' }));
    const second = deps.speak.mock.lastCall[3];
    act(() => { first.onend(); first.onstart(); });
    expect(radio()).toHaveAttribute('data-state', 'loading');
    act(() => second.onstart()); expect(radio()).toHaveAttribute('data-state', 'playing');
    act(() => second.onend()); expect(radio()).toHaveAttribute('data-state', 'idle');
    fireEvent.click(screen.getByRole('button', { name: '▶ 聽這個句子' }));
    const third = deps.speak.mock.lastCall[3];
    fireEvent.click(screen.getByRole('button', { name: '■ 停止播放' }));
    act(() => third.onstart()); expect(radio()).toHaveAttribute('data-state', 'idle');
  });
  it('highlights a revealed sentence while keeping the listening answer hidden until a hint is requested', () => {
    const { deps, container } = setup('listening');
    fireEvent.click(screen.getByRole('button', { name: '開始新的小任務 →' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ 聽這個句子' }));
    const events = deps.speak.mock.lastCall[3], answer = saved('listening').questions[0].answer;
    act(() => { events.onstart(); events.onboundary({ charIndex: 0 }); });
    expect(container.querySelector('.is-current')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '看句子提示' }));
    expect(container.querySelector('.practice-hint .is-current')).toHaveTextContent(answer.split(' ')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ⅱ 先休息一下' }));
    act(() => events.onboundary({ charIndex: 0 }));
    fireEvent.click(screen.getByRole('button', { name: '繼續上次練習' }));
    expect(container.querySelector('.is-current')).toBeNull();
    expect(deps.speak).toHaveBeenCalledOnce();
  });
  it('restores typed answers and accepts extra whitespace without repeating completion', () => {
    let view = setup('listening');
    fireEvent.click(screen.getByRole('button', { name: '自己打字挑戰' }));
    fireEvent.click(screen.getByRole('button', { name: '開始新的小任務 →' }));
    fireEvent.change(screen.getByRole('textbox', { name: '你聽到了什麼？' }), { target: { value: 'We go' } });
    view.unmount(); view = setup('listening');
    fireEvent.click(screen.getByRole('button', { name: '繼續上次練習' }));
    expect(screen.getByRole('textbox')).toHaveValue('We go');
    for (let i = 0; i < 3; i++) {
      const sentence = saved('listening').questions[i].answer;
      fireEvent.change(screen.getByRole('textbox'), { target: { value: sentence.toUpperCase().replace(/ /g, '  ') } });
      fireEvent.click(screen.getByRole('button', { name: '看看我的答案' })); next();
    }
    expect(view.props.onXp).toHaveBeenCalledTimes(3); expect(view.props.onDone).toHaveBeenCalledTimes(1);
    view.unmount(); const restored = setup('listening');
    fireEvent.click(screen.getByRole('button', { name: '看看上次成果' }));
    expect(restored.props.onDone).not.toHaveBeenCalled();
  });
});

describe('review garden', () => {
  function garden() {
    const deps = { words, loadExtraWords: vi.fn().mockResolvedValue({}), fetchWeakWords: vi.fn().mockResolvedValue([]), speak: vi.fn().mockReturnValue({}), stopSpeech: vi.fn(), Hdr, c: { cl: '#507364' }, levelName: '小學' };
    function Fixture() {
      const [weak, setWeak] = useState([{ w: 'apple', n: 3, level: 'elementary' }, { w: 'dog', n: 2, level: 'elementary' }, { w: 'unknown', n: 1, level: 'elementary' }]);
      return <ReviewGarden lv="elementary" onBack={vi.fn()} weakWords={weak} setWeakWords={setWeak} onCards={vi.fn()} onSearch={vi.fn()} deps={deps} />;
    }
    return render(<StrictMode><Fixture /></StrictMode>);
  }
  it('shows local meanings without cloud and keeps a frozen queue when remembered words are removed', async () => {
    garden(); await waitFor(() => expect(screen.getByText('蘋果')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '先複習 3 個 →' }));
    expect(screen.getByRole('button', { name: '記住了，移出清單' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '翻開看看意思' }));
    fireEvent.click(screen.getByRole('button', { name: '記住了，移出清單' }));
    expect(screen.getByRole('heading', { name: 'dog' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '還想再練，留著' }));
    expect(screen.getByRole('heading', { name: 'unknown' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '翻開看看意思' }));
    expect(screen.getByText('這個單字暫時沒有可用的字義，先留在清單，稍後再查。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '記住了，移出清單' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '還想再練，留著' }));
    expect(screen.getByRole('region', { name: '複習完成' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '復原剛才的移除' }));
    fireEvent.click(screen.getByRole('button', { name: '回到複習清單' }));
    expect(screen.getByText('小學 · 共 3 個正在練習的單字')).toBeInTheDocument();
  });
});
