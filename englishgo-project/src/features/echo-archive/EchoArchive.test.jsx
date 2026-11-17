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
