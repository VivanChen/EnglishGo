import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EchoArchive from './EchoArchive.jsx';
import { makeChant } from './chant.js';
import { ARCHIVE_CARDS, CARDS, POWER_TEXT } from './data/cards.js';
import { RELICS } from './data/relics.js';
import { hasGlyph } from './components/Glyph.jsx';

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
    expect(screen.getAllByRole('button', { name: /未解鎖的/ })).toHaveLength(ARCHIVE_CARDS.length - 1);
  }, 15000);

  it('starts today\'s daily challenge once and offers to continue it', async () => {
    localStorage.setItem('eg_echo_archive_meta', JSON.stringify({ runs: 2, tutorialDone: true }));
    render(<EchoArchive lv="elementary" onBack={vi.fn()} deps={deps()}/>);
    const card = screen.getByRole('article', { name: '每日挑戰' });
    expect(within(card).getByText('祝福')).toBeInTheDocument();
    expect(within(card).getByText('今日卡牌')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: /接受挑戰/ }));
    expect(await screen.findByText('The Lantern Keeper')).toBeInTheDocument();
    expect(screen.getByText('每日')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('eg_echo_archive_run'));
    expect(saved.daily.date).toBe(saved.daily.date.match(/^\d{4}-\d{2}-\d{2}$/)[0]);
    expect(saved.difficulty).toBe('standard');
    const meta = JSON.parse(localStorage.getItem('eg_echo_archive_meta'));
    expect(meta.daily).toMatchObject({ date: saved.daily.date, streak: 1, result: null });

    fireEvent.click(screen.getByRole('button', { name: '選單與設定' }));
    fireEvent.click(screen.getByRole('button', { name: '回到標題（保留進度）' }));
    fireEvent.click(within(screen.getByRole('article', { name: '每日挑戰' })).getByRole('button', { name: /繼續今日挑戰/ }));
    expect(screen.getByText('The Lantern Keeper')).toBeInTheDocument();
  });

  it('unlocks Silence levels on Heroic and starts a run at the chosen level', async () => {
    localStorage.setItem('eg_echo_archive_meta', JSON.stringify({ runs: 3, wins: 1, tutorialDone: true, silenceTop: -1 }));
    const view = render(<EchoArchive lv="elementary" onBack={vi.fn()} deps={deps()}/>);
    fireEvent.click(screen.getByRole('button', { name: /開始遠征/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Heroic/ }));
    expect(screen.getByText(/就能解鎖「靜默層級」/)).toBeInTheDocument();
    view.unmount();

    localStorage.setItem('eg_echo_archive_meta', JSON.stringify({ runs: 3, wins: 1, tutorialDone: true, silenceTop: 1 }));
    render(<EchoArchive lv="elementary" onBack={vi.fn()} deps={deps()}/>);
    fireEvent.click(screen.getByRole('button', { name: /開始遠征/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Heroic/ }));
    const raise = screen.getByRole('button', { name: '提高靜默層級' });
    fireEvent.click(raise);
    fireEvent.click(raise);
    expect(screen.getByLabelText('靜默層級 2')).toBeInTheDocument();
    expect(raise).toBeDisabled();
    expect(screen.getByText('沉重打擊')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '出發 →' }));
    expect(await screen.findByText('The Lantern Keeper')).toBeInTheDocument();
    expect(screen.getByText('靜默 2')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_echo_archive_run')).silence).toBe(2);
    expect(JSON.parse(localStorage.getItem('eg_echo_archive_meta')).lastSilence).toBe(2);
  });

  it('locks the Inkcaller until the first boss falls, then starts a run with its familiar', async () => {
    localStorage.setItem('eg_echo_archive_meta', JSON.stringify({ runs: 1, bestAct: 1, tutorialDone: true }));
    const view = render(<EchoArchive lv="elementary" onBack={vi.fn()} deps={deps()}/>);
    fireEvent.click(screen.getByRole('button', { name: /開始遠征/ }));
    expect(screen.getByRole('radio', { name: /The Inkcaller/ })).toBeDisabled();
    view.unmount();

    localStorage.setItem('eg_echo_archive_meta', JSON.stringify({ runs: 3, bestAct: 2, tutorialDone: true }));
    render(<EchoArchive lv="elementary" onBack={vi.fn()} deps={deps()}/>);
    fireEvent.click(screen.getByRole('button', { name: /開始遠征/ }));
    fireEvent.click(screen.getByRole('radio', { name: /The Inkcaller/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Story/ }));
    fireEvent.click(screen.getByRole('button', { name: '出發 →' }));
    expect(await screen.findByText('The Lantern Keeper')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_echo_archive_run')).hero.id).toBe('caller');
    expect(screen.getByLabelText(/鑰匙 0 \/ 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Take the coin purse/ }));
    fireEvent.click(screen.getByRole('button', { name: '踏入書庫 →' }));
    fireEvent.click(screen.getByRole('button', { name: '展開地圖 →' }));
    fireEvent.click(screen.getAllByRole('button', { name: /可以前往/ })[0]);
    expect(await screen.findByLabelText(/墨靈 2 層/)).toBeInTheDocument();
    expect(screen.getByText('喚墨師')).toBeInTheDocument();
  });

  it('writes abandoned runs into the chronicle', async () => {
    await startRun();
    fireEvent.click(screen.getByRole('button', { name: '選單與設定' }));
    const menu = screen.getByRole('dialog', { name: '暫停選單' });
    fireEvent.click(within(menu).getByRole('button', { name: '放棄這次遠征' }));
    act(() => { fireEvent.click(within(menu).getByRole('button', { name: /確定放棄/ })); });
    fireEvent.click(screen.getByRole('button', { name: '打開遠征紀錄' }));
    expect(screen.getByRole('heading', { name: '遠征紀錄' })).toBeInTheDocument();
    expect(screen.getByText('出發前就放棄了')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /查看這次的牌組，共 10 張/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('eg_echo_archive_meta')).history).toHaveLength(1);
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

describe('Echo Archive combat clarity', () => {
  async function seededFight(settings) {
    localStorage.setItem('eg_echo_archive_meta', JSON.stringify({ runs: 3, tutorialDone: true, ...(settings ? { settings } : {}) }));
    const { createRun, runReducer } = await import('./engine/engine.js');
    const { availableNodes } = await import('./engine/map.js');
    let run = createRun({ seed: 5, difficulty: 'standard' });
    run = runReducer(run, { type: 'EVENT_CHOOSE', index: 3 });
    run = runReducer(run, { type: 'EVENT_CONTINUE' });
    run = runReducer(run, { type: 'ACK_ACT' });
    run = runReducer(run, { type: 'MAP_SELECT', id: availableNodes(run)[0] });
    run.combat.enemies = [{ ...run.combat.enemies[0], id: 'bookworm', hp: 40, maxHp: 40, move: 'gnaw', st: {}, ward: 0 }];
    localStorage.setItem('eg_echo_archive_run', JSON.stringify(run));
    render(<EchoArchive lv="elementary" onBack={vi.fn()} deps={deps()}/>);
    fireEvent.click(screen.getByRole('button', { name: /繼續遠征/ }));
  }

  it('shows incoming damage against Ward and asks before ending a turn with playable cards', async () => {
    await seededFight();
    expect(screen.getByLabelText(/敵人這輪預計造成 \d+ 傷害，你會有 0 Ward，將失去 \d+ 生命/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /結束回合/ }));
    expect(screen.getByRole('button', { name: /再按一次結束回合/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('張牌可以打出');
    expect(screen.queryByText('敵人行動中')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /結束回合/ }));
    expect(await screen.findByText('敵人行動中', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('ends the turn at once when the reminder is switched off', async () => {
    await seededFight({ endWarn: false });
    fireEvent.click(screen.getByRole('button', { name: /結束回合/ }));
    expect(await screen.findByText('敵人行動中', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});

describe('Echo Archive art', () => {
  it('ships a painted WebP sprite for every creature, both heroes and the familiar', async () => {
    const { readFileSync } = await import('node:fs');
    const { ENEMY_ART } = await import('./components/Creatures.jsx');
    const { FAMILIAR_IMAGE, PAINTED_CREATURES, creatureImage, heroImage } = await import('./components/paintedArt.js');
    expect([...PAINTED_CREATURES].sort()).toEqual([...ENEMY_ART].sort());
    const files = [...ENEMY_ART.map(creatureImage), heroImage('scribe'), heroImage('caller'), FAMILIAR_IMAGE];
    files.forEach(src => {
      const bytes = readFileSync(`public${src}`);
      expect(bytes.toString('ascii', 0, 4), src).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12), src).toBe('WEBP');
      expect(bytes.length, src).toBeLessThan(120 * 1024);
    });
  });

  it('draws an icon for every card, relic and power', () => {
    Object.entries(CARDS).forEach(([id, card]) => expect(hasGlyph(card.glyph), id).toBe(true));
    Object.entries(RELICS).forEach(([id, relic]) => expect(hasGlyph(relic.glyph), id).toBe(true));
    Object.keys(POWER_TEXT).forEach(id => expect(hasGlyph(id), id).toBe(true));
  });
});
