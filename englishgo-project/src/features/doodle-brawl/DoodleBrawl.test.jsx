import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DoodleBrawl from './DoodleBrawl.jsx';
import { newRun, runReducer } from './engine/run.js';
import { SummaryScreen } from './screens/Menus.jsx';

const words = [
  { w: 'apple', m: '蘋果', p: 'n.' }, { w: 'happy', m: '開心的', p: 'adj.' }, { w: 'school', m: '學校', p: 'n.' },
  { w: 'water', m: '水', p: 'n.' }, { w: 'friend', m: '朋友', p: 'n.' }, { w: 'book', m: '書', p: 'n.' },
  { w: 'river', m: '河流', p: 'n.' }, { w: 'cloud', m: '雲', p: 'n.' }, { w: 'green', m: '綠色的', p: 'adj.' },
];
const deps = () => ({ V: { elementary: words }, speak: vi.fn(), stopSpeech: vi.fn(), loadExtraWords: vi.fn(async () => ({})), fetchCloudVocab: vi.fn(async () => []) });
const RUN_KEY = 'eg_doodle_brawl_run';
const META_KEY = 'eg_doodle_brawl_meta';

function shopRun(stars = 200) {
  let run = newRun({ seed: 42, hero: 'sketch', difficulty: 'easy' });
  run = runReducer(run, { type: 'WAVE_DONE', result: { outcome: 'cleared', stars, kills: 20, xp: 3, level: 0, levelsGained: 0, crates: 0, damage: 100 } });
  return run;
}
const save = run => localStorage.setItem(RUN_KEY, JSON.stringify(run));
const view = (props = {}) => render(<DoodleBrawl lv="elementary" onBack={vi.fn()} onXp={vi.fn()} trackWeak={vi.fn()} deps={deps()} {...props}/>);

describe('Doodle Brawl', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts a run from the title screen with a chosen hero and difficulty', async () => {
    view();
    expect(screen.getByRole('heading', { name: '塗鴉大亂鬥' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '開始新遊戲' }));
    const heroes = screen.getByRole('radiogroup', { name: '英雄' });
    expect(within(heroes).getAllByRole('radio')).toHaveLength(4);
    expect(within(heroes).getByRole('radio', { name: /Zip/ })).toBeDisabled();
    fireEvent.click(within(heroes).getByRole('radio', { name: /Brick/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Normal/ }));
    fireEvent.click(screen.getByRole('button', { name: '出發！' }));
    expect(await screen.findByText('WAVE 1 / 12')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: '生命' })).toHaveAttribute('aria-valuenow', '23');
    const saved = JSON.parse(localStorage.getItem(RUN_KEY));
    expect(saved).toMatchObject({ hero: 'brick', difficulty: 'normal', wave: 1, phase: 'wave' });
    expect(saved.weapons).toEqual([{ id: 'ruler', tier: 0 }]);
    expect(JSON.parse(localStorage.getItem(META_KEY))).toMatchObject({ runs: 1, lastHero: 'brick' });
  });

  it('pauses the wave and keeps the run when returning to the title', async () => {
    save(newRun({ seed: 1, hero: 'sketch', difficulty: 'easy' }));
    view();
    fireEvent.click(screen.getByRole('button', { name: /繼續：第 1 波/ }));
    fireEvent.click(await screen.findByRole('button', { name: '暫停' }));
    expect(screen.getByRole('dialog', { name: '暫停中' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '回到標題（保留進度）' }));
    expect(screen.getByRole('button', { name: /繼續：第 1 波/ })).toBeInTheDocument();
  });

  it('buys from the shop, then starts the next wave', async () => {
    save(shopRun(200));
    view();
    fireEvent.click(screen.getByRole('button', { name: /繼續：第 1 波/ }));
    expect(screen.getByRole('heading', { name: /文具小舖/ })).toBeInTheDocument();
    const buy = screen.getAllByRole('button', { name: /^買下/ }).find(button => !button.disabled);
    fireEvent.click(buy);
    expect(screen.getByText('已買下 ✓')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(RUN_KEY)).stars).toBeLessThan(200);
    fireEvent.click(screen.getByRole('button', { name: '開始第 2 波 →' }));
    expect(await screen.findByText('WAVE 2 / 12')).toBeInTheDocument();
  });

  it('combines two matching weapons from the build panel', () => {
    save({ ...shopRun(10), weapons: [{ id: 'pencil', tier: 0 }, { id: 'pencil', tier: 0 }] });
    view();
    fireEvent.click(screen.getByRole('button', { name: /繼續/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Pencil I 階，可以合成/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /合成升級/ }));
    expect(JSON.parse(localStorage.getItem(RUN_KEY)).weapons).toEqual([{ id: 'pencil', tier: 1 }]);
  });

  it('asks an optional word question before opening a mystery box', async () => {
    const trackWeak = vi.fn();
    save({ ...shopRun(20), phase: 'crate', crates: 1, crate: null });
    view({ trackWeak });
    fireEvent.click(screen.getByRole('button', { name: /繼續/ }));
    expect(screen.getByText('你撿到了神秘寶箱！')).toBeInTheDocument();
    const prompt = screen.getByText(/這個英文是什麼意思|這個意思的英文是/);
    expect(prompt).toBeInTheDocument();
    const options = screen.getAllByRole('button').filter(button => button.classList.contains('db-word-option'));
    expect(options).toHaveLength(3);
    fireEvent.click(options[0]);
    await screen.findByRole('button', { name: '收下' }, { timeout: 3000 });
    expect(trackWeak).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '收下' }));
    const run = JSON.parse(localStorage.getItem(RUN_KEY));
    expect(run.phase).toBe('shop');
    expect(run.words).toHaveLength(1);
    expect(Object.values(run.items).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('opens boxes straight away when word prompts are turned off', () => {
    localStorage.setItem(META_KEY, JSON.stringify({ settings: { words: false } }));
    save({ ...shopRun(20), phase: 'crate', crates: 1, crate: null });
    view();
    fireEvent.click(screen.getByRole('button', { name: /繼續/ }));
    fireEvent.click(screen.getByRole('button', { name: '打開寶箱' }));
    fireEvent.click(screen.getByRole('button', { name: /回收/ }));
    expect(JSON.parse(localStorage.getItem(RUN_KEY)).phase).toBe('shop');
  });

  it('picks a level-up stat', () => {
    let run = newRun({ seed: 5, hero: 'sketch', difficulty: 'easy' });
    run = runReducer(run, { type: 'WAVE_DONE', result: { outcome: 'cleared', stars: 30, kills: 20, xp: 2, level: 2, levelsGained: 2, crates: 0, damage: 100 } });
    save(run);
    view();
    fireEvent.click(screen.getByRole('button', { name: /繼續/ }));
    expect(screen.getByText(/升到 1 級/)).toBeInTheDocument();
    const choice = run.levelOffer[0];
    fireEvent.click(screen.getAllByRole('button').find(button => button.classList.contains('db-choice')));
    expect(screen.getByText(/升到 2 級/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(RUN_KEY)).bonus[choice.stat]).toBe(choice.value);
  });

  it('sums up a lost run with the crate words to review', () => {
    let run = { ...shopRun(20), words: [{ w: 'apple', m: '蘋果', ok: true, wave: 1 }, { w: 'river', m: '河流', ok: false, wave: 1 }] };
    run = runReducer(runReducer(run, { type: 'NEXT_WAVE' }), { type: 'WAVE_DONE', result: { outcome: 'dead', stars: 2, kills: 5, xp: 1, level: 0, levelsGained: 0, crates: 0, damage: 30 }, at: Date.now() });
    expect(run.phase).toBe('defeat');
    const speak = vi.fn(), onAgain = vi.fn();
    render(<SummaryScreen run={run} unlocked={['zip']} speak={speak} onAgain={onAgain} onTitle={vi.fn()}/>);
    expect(screen.getByText('GAME OVER')).toBeInTheDocument();
    expect(screen.getByText('在第 2 波倒下了')).toBeInTheDocument();
    expect(screen.getByText(/新英雄解鎖/)).toHaveTextContent('Zip');
    expect(screen.getByText(/答對 1 \/ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '聽 river' }));
    expect(speak).toHaveBeenCalledWith('river');
    fireEvent.click(screen.getByRole('button', { name: /再玩一次/ }));
    expect(onAgain).toHaveBeenCalled();
  });
});
