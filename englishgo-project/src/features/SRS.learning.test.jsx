import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SRS from './SRS.jsx';

vi.mock('../components/WordIllustrations.jsx', () => ({ useWordIllustrations: () => [], WordIllustrationGallery: () => null }));
const cards = [{ w: 'apple', m: '蘋果', p: 'n.', ex: 'The apple is in my bag.', ez: '蘋果在我的袋子裡。' }];
const buildDeck = items => ({ queue: items.map((_, i) => i), rm: [], stats: { again: 0, hard: 0, good: 0, easy: 0 }, total: items.length, lapses: {} });
const rateDeck = (deck, rating) => {
  const [current, ...queue] = deck.queue;
  return { ...deck, queue: ['again', 'hard'].includes(rating) ? [...queue, current] : queue,
    rm: ['again', 'hard'].includes(rating) ? deck.rm : [...deck.rm, current], stats: { ...deck.stats, [rating]: deck.stats[rating] + 1 } };
};
function setup(overrides = {}) {
  const props = { lv: 'elementary', customCards: cards, onBack: vi.fn(), onXp: vi.fn(), onDone: vi.fn(), onLearningEvent: vi.fn(), trackWeak: vi.fn(), onSessionChange: vi.fn(),
    deps: { V: { elementary: cards }, LV: { elementary: { cl: '#276', ac: '#385', bg: '#fff', l: '國小', ic: '🌱' } }, S: {},
      loadExtraWords: vi.fn(async () => ({})), fetchCloudVocab: vi.fn(async () => null), sortCardsForStudy: items => items, shuffleCopy: items => items,
      createDeck: buildDeck, rateDeck, getWordImg: () => ({ type: 'emoji', value: '🍎' }), preloadImgs: vi.fn(), isPlaceholderExample: () => false, exampleCache: {},
      preloadTts: vi.fn(), speak: vi.fn(), speakWebSpeech: vi.fn(), playSound: vi.fn(), speechTimer: vi.fn(),
      Hdr: ({ t }) => <header>{t}</header>, Confetti: () => null,
    }, ...overrides };
  return props;
}
const labels = { again: /再看看/, hard: /有點難/, good: /記住了/, easy: /很熟悉/ };
async function revealAndRate(rating) {
  fireEvent.click(await screen.findByRole('button', { name: '點卡片看答案' }));
  act(() => vi.setSystemTime(new Date(Date.now() + 250)));
  fireEvent.click(screen.getByRole('button', { name: labels[rating] }));
}
afterEach(() => vi.useRealTimers());

describe('SRS participation events', () => {
  it('resumes a completed Here We Go round and starts another round in the same book', async () => {
    const props = setup({ customCards: undefined });
    const view = render(<SRS {...props}/>);
    fireEvent.click(await screen.findByRole('button', { name: '開始翰林 Here We Go! 第 8 冊，81 個單字' }));
    await waitFor(() => expect(props.onSessionChange.mock.calls.at(-1)[0].cards).toHaveLength(20));
    const saved = structuredClone(props.onSessionChange.mock.calls.at(-1)[0]);
    expect(saved.selectedTopic).toBe('hanlin-here-we-go-8');
    expect(saved.cards.every(card => card.schoolBook === 'Here We Go! 8')).toBe(true);
    saved.deck = { ...saved.deck, queue: [], rm: saved.cards.map((_, index) => index), stats: { again: 0, hard: 0, good: 20, easy: 0 } };
    view.unmount();
    render(<SRS {...props} resumeSession={saved}/>);
    fireEvent.click(await screen.findByRole('button', { name: /新一輪/ }));
    await screen.findByRole('button', { name: '點卡片看答案' });
    const next = props.onSessionChange.mock.calls.at(-1)[0];
    expect(next.selectedTopic).toBe(saved.selectedTopic);
    expect(next.cards).toHaveLength(20);
    expect(next.cards.every(card => card.schoolBook === 'Here We Go! 8')).toBe(true);
    expect(next.cards.some(card => !saved.cards.some(old => old.w === card.w))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '換分類' }));
    expect(await screen.findByRole('button', { name: '開始翰林 Hooray ABC 全部複習，52 個單字' })).toBeEnabled();
  });

  it('opens the Hooray deck offline, shows its picture and example, and returns to the picker', async () => {
    const props = setup({ customCards: undefined });
    render(<SRS {...props}/>);
    fireEvent.click(await screen.findByRole('button', { name: '開始翰林 Hooray A–M 字母單字，26 個單字' }));
    await screen.findByRole('button', { name: '點卡片看答案' });
    await waitFor(() => expect(props.onSessionChange.mock.calls.at(-1)[0].cards).toHaveLength(20));
    const saved = props.onSessionChange.mock.calls.at(-1)[0];
    expect(saved.selectedTopic).toBe('hanlin-hooray-am');
    expect(saved.cards.every(card => card.publisherKey === 'hanlin' && card.illustration)).toBe(true);
    expect(screen.getByTestId('srs-front-media').querySelector('img').getAttribute('src')).toMatch(/^\/images\/vocabulary\/hooray\//);
    fireEvent.click(screen.getByRole('button', { name: '點卡片看答案' }));
    expect(document.querySelector('.srs-example-en')).toHaveTextContent(saved.cards[saved.deck.queue[0]].ex);
    fireEvent.click(screen.getByRole('button', { name: '換分類' }));
    expect(await screen.findByRole('button', { name: '開始翰林 Hooray ABC 全部複習，52 個單字' })).toBeEnabled();
  });

  it.each(['again', 'hard', 'good', 'easy'])('records one real %s rating without treating self-assessment as mastery', async rating => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T05:00:00Z'));
    const props = setup(); render(<StrictMode><SRS {...props}/></StrictMode>);
    await screen.findByRole('button', { name: '點卡片看答案' });
    fireEvent.click(screen.getByRole('button', { name: '播放單字 apple' }));
    expect(props.onLearningEvent).not.toHaveBeenCalled();
    await revealAndRate(rating);
    expect(props.onLearningEvent).toHaveBeenCalledTimes(1);
    const event = props.onLearningEvent.mock.calls[0][0];
    expect(event).toMatchObject({ source: 'srs', level: 'elementary', contentId: 'apple', kind: 'practice', outcome: 'participated', rating });
    expect(event.id).toBe(`srs:${event.sessionId}:1`);
    expect(props.onXp).toHaveBeenCalledTimes(['good', 'easy'].includes(rating) ? 1 : 0);
    await waitFor(() => expect(props.onSessionChange.mock.calls.at(-1)[0].deck.learningCursor).toBe(1));
  });

  it('persists the event cursor through a speaking detour or reload and does not emit on restore', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T05:00:00Z'));
    const props = setup(); const view = render(<SRS {...props}/>);
    await revealAndRate('again');
    const first = props.onLearningEvent.mock.calls[0][0];
    await waitFor(() => expect(props.onSessionChange.mock.calls.at(-1)[0].deck.learningCursor).toBe(1));
    const saved = structuredClone(props.onSessionChange.mock.calls.at(-1)[0]);
    view.unmount();
    render(<SRS {...props} resumeSession={saved}/>);
    await screen.findByRole('button', { name: '點卡片看答案' });
    expect(props.onLearningEvent).toHaveBeenCalledTimes(1);
    await revealAndRate('hard');
    const second = props.onLearningEvent.mock.calls[1][0];
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.id).toBe(`srs:${first.sessionId}:2`);
    expect(props.onXp).not.toHaveBeenCalled();
  });

  it('creates a new event session for an intentionally restarted round', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T05:00:00Z'));
    const props = setup(); render(<SRS {...props}/>);
    await revealAndRate('good');
    const first = props.onLearningEvent.mock.calls[0][0];
    fireEvent.click(await screen.findByRole('button', { name: /新一輪/ }));
    await revealAndRate('easy');
    const second = props.onLearningEvent.mock.calls[1][0];
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.id).toBe(`srs:${second.sessionId}:1`);
  });

  it('ignores rapid duplicate rating keys and only advances the event cursor after another revealed card', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T05:00:00Z'));
    const props = setup(); render(<SRS {...props}/>);
    fireEvent.click(await screen.findByRole('button', { name: '點卡片看答案' }));
    act(() => {
      fireEvent.keyDown(window, { key: '1' });
      vi.setSystemTime(new Date(Date.now() + 40));
      fireEvent.keyDown(window, { key: '2' });
      fireEvent.keyDown(window, { key: '1', repeat: true });
    });
    expect(props.onLearningEvent).toHaveBeenCalledTimes(1);
    expect(props.onLearningEvent.mock.calls[0][0].rating).toBe('again');
    await waitFor(() => expect(props.onSessionChange.mock.calls.at(-1)[0].deck.learningCursor).toBe(1));
    await revealAndRate('hard');
    expect(props.onLearningEvent).toHaveBeenCalledTimes(2);
    const events = props.onLearningEvent.mock.calls.map(([event]) => event);
    expect(events[1].id).toBe(`srs:${events[0].sessionId}:2`);
    expect(props.onXp).not.toHaveBeenCalled();
  });
});
