import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EchoArchive from './EchoArchive.jsx';
import { makeChant } from './chant.js';

const words = [
  { w: 'apple', m: '蘋果', p: 'n.' }, { w: 'happy', m: '開心的', p: 'adj.' }, { w: 'school', m: '學校', p: 'n.' },
  { w: 'water', m: '水', p: 'n.' }, { w: 'friend', m: '朋友', p: 'n.' }, { w: 'book', m: '書', p: 'n.' },
  { w: 'river', m: '河流', p: 'n.' }, { w: 'cloud', m: '雲', p: 'n.' }, { w: 'green', m: '綠色的', p: 'adj.' },
];
const deps = () => ({ V: { elementary: words }, speak: vi.fn(), stopSpeech: vi.fn(), loadExtraWords: vi.fn(async () => ({})), fetchCloudVocab: vi.fn(async () => []) });

async function startRun(onXp = vi.fn()) {
  const view = render(<EchoArchive lv="elementary" onBack={vi.fn()} onXp={onXp} deps={deps()}/>);
  fireEvent.click(screen.getByRole('button', { name: /開始遠征/ }));
  fireEvent.click(screen.getByRole('radio', { name: /Story/ }));
  fireEvent.click(screen.getByRole('button', { name: '出發 →' }));
  expect(await screen.findByText('The Lantern Keeper')).toBeInTheDocument();
  return view;
}

describe('Echo Archive', () => {
  it('builds chant questions with exactly one right answer', () => {
    const question = makeChant(words, [], () => 0.1);
    expect(question.options).toHaveLength(3);
    expect(question.options.filter(option => option.ok)).toHaveLength(1);
  });

  it('plays from the title screen through the keeper, the map and a first fight', async () => {
    await startRun();
    fireEvent.click(screen.getByRole('button', { name: /Take the coin purse/ }));
    fireEvent.click(screen.getByRole('button', { name: '踏入書庫 →' }));
    fireEvent.click(screen.getByRole('button', { name: '展開地圖 →' }));
    const first = screen.getAllByRole('button', { name: /可以前往/ })[0];
    fireEvent.click(first);
    expect(await screen.findByRole('button', { name: /結束回合/ })).toBeInTheDocument();
    const hand = screen.getAllByRole('button', { name: /費用/ });
    expect(hand).toHaveLength(5);
    expect(JSON.parse(localStorage.getItem('eg_echo_archive_run')).screen).toBe('combat');

    const guard = hand.find(card => /Guard/.test(card.getAttribute('aria-label')));
    if (guard) {
      fireEvent.click(guard);
      fireEvent.click(guard);
      await waitFor(() => expect(screen.getAllByRole('button', { name: /費用/ })).toHaveLength(4));
    }
    fireEvent.click(screen.getByRole('button', { name: /結束回合/ }));
    expect(await screen.findByText('敵人行動中', {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /結束回合/ })).toBeEnabled(), { timeout: 8000 });
  }, 20000);

  it('keeps the run in storage so it can be continued', async () => {
    const view = await startRun();
    fireEvent.click(screen.getByRole('button', { name: /Take the coin purse/ }));
    view.unmount();
    render(<EchoArchive lv="elementary" onBack={vi.fn()} deps={deps()}/>);
    fireEvent.click(screen.getByRole('button', { name: /繼續遠征/ }));
    expect(screen.getByRole('button', { name: '踏入書庫 →' })).toBeInTheDocument();
  });

  it('coaches a new player through the first battle and remembers when it is skipped', async () => {
    await startRun();
    fireEvent.click(screen.getByRole('button', { name: /Take the coin purse/ }));
    fireEvent.click(screen.getByRole('button', { name: '踏入書庫 →' }));
    fireEvent.click(screen.getByRole('button', { name: '展開地圖 →' }));
    fireEvent.click(screen.getAllByRole('button', { name: /可以前往/ })[0]);
    expect(await screen.findByRole('dialog', { name: '能量 Energy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('dialog', { name: '看懂敵人的意圖' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('dialog', { name: '出牌攻擊' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '跳過教學' }));
    expect(screen.queryByRole('dialog', { name: '出牌攻擊' })).toBeNull();
    expect(JSON.parse(localStorage.getItem('eg_echo_archive_meta')).tutorialDone).toBe(true);
  });

  it('sends rune words to the weak-word list and shows relic notes on tap', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const trackWeak = vi.fn();
    localStorage.setItem('eg_echo_archive_meta', JSON.stringify({ runs: 3, tutorialDone: true }));
    const { createRun, runReducer } = await import('./engine/engine.js');
    const { availableNodes } = await import('./engine/map.js');
    let run = createRun({ seed: 5, difficulty: 'story' });
    run = runReducer(run, { type: 'EVENT_CHOOSE', index: 3 });
    run = runReducer(run, { type: 'EVENT_CONTINUE' });
    run = runReducer(run, { type: 'ACK_ACT' });
    run = runReducer(run, { type: 'MAP_SELECT', id: availableNodes(run)[0] });
    const c = run.combat;
    c.enemies = [c.enemies[0]];
    const thunder = Object.keys(c.cards).find(uid => c.cards[uid].id === 'thunder');
    c.draw = c.draw.filter(uid => uid !== thunder);
    c.discard = c.discard.filter(uid => uid !== thunder);
    if (!c.hand.includes(thunder)) c.hand = [thunder, ...c.hand.slice(0, 4)];
    localStorage.setItem('eg_echo_archive_run', JSON.stringify(run));
    window.matchMedia = vi.fn(query => ({ matches: query === '(hover: none)', media: query, addEventListener() {}, removeEventListener() {} }));

    render(<EchoArchive lv="elementary" onBack={vi.fn()} trackWeak={trackWeak} deps={deps()}/>);
    fireEvent.click(screen.getByRole('button', { name: /繼續遠征/ }));
    fireEvent.click(screen.getByLabelText(/Endless Inkwell/));
    expect(screen.getByRole('tooltip')).toHaveTextContent('戰鬥勝利後回復 6 生命');

    const card = screen.getByRole('button', { name: /Thunder 雷鳴/ });
    fireEvent.click(card);
    fireEvent.click(card);
    const option = await screen.findByRole('button', { name: /蘋果/ });
    fireEvent.click(option);
    await waitFor(() => expect(trackWeak).toHaveBeenCalledWith('apple', -1), { timeout: 3000 });
    random.mockRestore();
    delete window.matchMedia;
  });

  it('claims the welcome gift, pulls from the Archive Gacha and shows new cards in the codex', async () => {
    render(<EchoArchive lv="elementary" onBack={vi.fn()} deps={deps()}/>);
    fireEvent.click(screen.getByRole('button', { name: /書頁扭蛋/ }));
    expect(screen.getByRole('button', { name: /單抽/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '領取' }));
    expect(screen.getByLabelText('墨晶 100')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /單抽/ }));
    expect(await screen.findByText('NEW', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByLabelText('墨晶 80')).toBeInTheDocument();
    const meta = JSON.parse(localStorage.getItem('eg_echo_archive_meta'));
    const owned = Object.keys(meta.collection.owned);
    expect(owned).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '打開卡牌圖鑑' }));
    expect(screen.getByRole('heading', { name: '卡牌圖鑑' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '未解鎖' }));
    expect(screen.getAllByRole('button', { name: /未解鎖的/ })).toHaveLength(27);
  }, 15000);

  it('lets the player abandon a run from the menu', async () => {
    await startRun();
    fireEvent.click(screen.getByRole('button', { name: '選單與設定' }));
    const menu = screen.getByRole('dialog', { name: '暫停選單' });
    fireEvent.click(within(menu).getByRole('button', { name: '放棄這次遠征' }));
    act(() => { fireEvent.click(within(menu).getByRole('button', { name: /確定放棄/ })); });
    expect(screen.getByRole('button', { name: /開始遠征/ })).toBeInTheDocument();
    expect(localStorage.getItem('eg_echo_archive_run')).toBeNull();
  });
});
