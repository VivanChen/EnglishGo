import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PetExpedition, { expeditionStorageKey } from './PetExpedition.jsx';

vi.mock('../components/PetCompanion.jsx', () => ({ default: ({ petId }) => <span>{petId} portrait</span> }));
vi.mock('../components/PetWorldArt.jsx', () => ({ PetHabitatScene: () => <div>森林插畫</div>, PetLandscape: () => <div /> }));
const starter = { petId: 'bunny', rarity: 'N', level: 1, exp: 0, bond: 0, energy: 80, hunger: 80, clean: 80 };
const skill = { id: 'wordSpark', emoji: '✦', zh: '單字火花', name: 'Word Spark', desc: '答對單字增加傷害', power: 10 };
const q = { q: 'Which word means 蘋果?', zh: '找出蘋果的英文', choices: ['apple', 'book'], answer: 0, tip: 'Apple 是蘋果。' };
const makeStages = (count = 1, maxHp = 170) => Array.from({ length: count }, (_, index) => ({ id: `forest-${index}`, zh: `森林 ${index + 1}`, enemy: 'Forest friend', enemyZh: '森林夥伴', questions: [q], attack: 25, maxHp }));
const food = { id: 'apple', emoji: '🍎', name: '蘋果', feed: 30 };
const back = vi.fn();
const createApi = stages => ({
  Hdr: ({ t, onBack }) => <header><button onClick={onBack}>返回</button><h1>{t}</h1></header>,
  PET_ADVENTURE_BOSS_REQUIRED_CLEARS: 3, PET_ADVENTURE_ENEMY_ICONS: {}, PET_ADVENTURE_SKILLS: { wordSpark: skill }, PET_FOODS: [food],
  buildPetAdventureStages: vi.fn(() => stages), choosePetFoodForNeed: (_, inventory) => inventory.apple > 0 ? food : null,
  completePetAdventureProgress: (previous, won) => won ? { ...previous, clears: previous.clears + 1, bossCharge: previous.bossCharge + 1 } : previous,
  createPetAdventureBgm: vi.fn(() => ({ stop: vi.fn() })), getAdventureAnswerLine: () => 'Apple means 蘋果.', getAdventureCorrectSpeech: () => 'Apple means 蘋果.', getAdventurePetDef: p => p && ({ name: '小兔' }), getAdventureQuestionMeta: () => ({ label: '單字挑戰' }), getAdventureQuestionSpeech: question => question.q,
  getPetAdventureDifficulty: () => 1, getPetAdventureFatigue: () => ({ hunger: 8, clean: 6, energy: 12 }), getPetAdventurePower: () => 100, getPetAdventureProgress: () => ({ clears: 0, bossCharge: 0, bossesDefeated: 0 }), getPetAdventureScore: () => 100, getPetAdventureSkillCards: () => [{ skill, unlocked: true }], getPetReadiness: p => ({ label: p.energy < 20 ? '需要休息' : '精神飽滿' }), getPetStage: () => 'baby', getSelectedPetAdventureSkill: () => skill, getTeamAdventureMorale: () => ({ hpMult: 1, rewardMult: 1, damageBonus: 0, label: '精神飽滿', emoji: '☺' }),
  improvePetAfterAdventure: (pet, reward) => ({ ...pet, exp: (pet.exp || 0) + reward.exp, bond: (pet.bond || 0) + reward.bond, energy: Math.max(0, pet.energy - (reward.fatigue?.energy || 0)) }), isPetAdventureBossReady: () => false, loadPetAdventureQuestions: vi.fn(async () => ({})), playPetAdventureSkillSound: vi.fn(), playSound: vi.fn(), savePetAdventureProgress: vi.fn(), speak: vi.fn(), stopSpeech: vi.fn(),
});
function Harness({ api, initial = { pets: [starter], inventory: { apple: 2 }, coins: 10 }, account }) {
  const [pets, setPets] = useState(initial.pets), [inventory, setInventory] = useState(initial.inventory), [coins, setCoins] = useState(initial.coins);
  return <><output data-testid="saved">{JSON.stringify({ pets, inventory, coins })}</output><PetExpedition {...{ pets, setPets, inventory, setInventory, coins, setCoins, api }} onBack={back} onNavigate={back} lv="elementary" petAccount={account} /></>;
}
const saved = () => JSON.parse(screen.getByTestId('saved').textContent);
async function start() {
  fireEvent.click(screen.getByRole('button', { name: '選好夥伴，下一步 →' }));
  fireEvent.click(screen.getByRole('button', { name: '出發，探索森林 →' }));
  await screen.findByRole('heading', { name: q.q });
}
function correct() { fireEvent.click(screen.getByRole('button', { name: /^A apple/ })); }
afterEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('forest expedition flow and rewards', () => {
  it('uses real food during preparation and never fills low energy for free', () => {
    render(<StrictMode><Harness api={createApi(makeStages())} initial={{ pets: [{ ...starter, energy: 10, hunger: 30, clean: 30 }], inventory: { apple: 1 }, coins: 10 }} /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: '選好夥伴，下一步 →' }));
    fireEvent.click(screen.getByRole('button', { name: '餵食與清潔' }));
    expect(saved()).toMatchObject({ pets: [{ hunger: 60, clean: 100, energy: 10, exp: 20 }], inventory: { apple: 0 }, coins: 20 });
    expect(screen.getByRole('button', { name: '出發，探索森林 →' })).toBeDisabled();
  });

  it('does not award a win on the first correct answer of the final stage', async () => {
    const api = createApi(makeStages(1, 170)); render(<StrictMode><Harness api={api} /></StrictMode>); await start();
    correct();
    expect(saved().coins).toBe(10);
    expect(screen.queryByRole('button', { name: '查看冒險成果 →' })).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '關卡生命' })).not.toHaveAttribute('aria-valuenow', '0');
    fireEvent.click(screen.getByRole('button', { name: '下一題 →' })); correct();
    if (screen.queryByRole('button', { name: '下一題 →' })) { fireEvent.click(screen.getByRole('button', { name: '下一題 →' })); correct(); }
    expect(saved().coins).toBeGreaterThan(10);
    const coins = saved().coins;
    fireEvent.click(screen.getByRole('button', { name: '查看冒險成果 →' }));
    expect(screen.getByText('一起走完森林了！')).toBeInTheDocument();
    expect(saved().coins).toBe(coins);
    expect(api.savePetAdventureProgress).toHaveBeenCalledTimes(1);
  });

  it('applies only one camp choice and preserves the next stage', async () => {
    render(<Harness api={createApi(makeStages(3, 1))} />); await start(); correct();
    fireEvent.click(screen.getByRole('button', { name: '前往營地補給 →' }));
    const rest = document.querySelector('[data-camp-choice="rest"]'), focus = document.querySelector('[data-camp-choice="focus"]');
    act(() => { rest.click(); focus.click(); });
    const state = JSON.parse(localStorage.getItem(expeditionStorageKey(null, 'elementary')));
    expect(state.battle).toMatchObject({ stageIndex: 1, campChoice: 'rest', campDamage: 0 });
    expect(state.phase).toBe('battle');
    expect(saved().coins).toBe(10);
  });

  it('restores a completed result without replaying rewards, scoped to account and level', async () => {
    const api = createApi(makeStages(1, 1)), view = render(<Harness api={api} account={{ username: 'Alice' }} />); await start(); correct();
    const firstSaved = saved(), receiptKey = expeditionStorageKey({ username: 'Alice' }, 'elementary');
    expect(JSON.parse(localStorage.getItem(receiptKey)).result.settled).toBe(true);
    view.unmount();
    const restored = render(<Harness api={api} initial={firstSaved} account={{ username: 'Alice' }} />);
    expect(screen.getByText('一起走完森林了！')).toBeInTheDocument(); expect(saved()).toEqual(firstSaved);
    restored.unmount(); render(<Harness api={api} initial={firstSaved} account={{ username: 'Bob' }} />);
    expect(screen.getByText('和夥伴，走進森林')).toBeInTheDocument();
    expect(expeditionStorageKey({ username: 'Alice' }, 'junior')).not.toBe(receiptKey);
  });

  it('pauses on exit and restores the exact unanswered next question', async () => {
    const api = createApi(makeStages(2, 170)), view = render(<Harness api={api} />); await start(); correct();
    fireEvent.click(screen.getByRole('button', { name: '下一題 →' }));
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存進度，回樂園' }));
    expect(back).toHaveBeenCalledTimes(1); view.unmount(); render(<Harness api={api} />);
    expect(screen.getByText('單字挑戰 · 第 2 題')).toBeInTheDocument(); expect(saved().coins).toBe(10);
  });

  it('keeps preparation and balance intact if questions fail to load', async () => {
    const api = createApi(makeStages()); api.loadPetAdventureQuestions.mockRejectedValue(new Error('offline'));
    render(<Harness api={api} />);
    fireEvent.click(screen.getByRole('button', { name: '選好夥伴，下一步 →' }));
    fireEvent.click(screen.getByRole('button', { name: '出發，探索森林 →' }));
    await waitFor(() => expect(screen.getByText(/森林路線還沒準備好/)).toBeInTheDocument());
    expect(saved()).toMatchObject({ coins: 10, inventory: { apple: 2 } });
    expect(screen.getByRole('button', { name: '出發，探索森林 →' })).toBeEnabled();
  });

  it('does not grant farming rewards when a run ends without any correct answers', async () => {
    const stages = makeStages(1, 1000); stages[0].attack = 1000;
    render(<Harness api={createApi(stages)} />); await start();
    const wrong = screen.getByRole('button', { name: /^B book/ });
    act(() => { wrong.click(); wrong.click(); });
    expect(saved()).toMatchObject({ coins: 10, inventory: { apple: 2 }, pets: [{ exp: 0, energy: 68 }] });
    fireEvent.click(screen.getByRole('button', { name: '查看冒險成果 →' }));
    expect(screen.getByText('休息後，再來試試')).toBeInTheDocument();
  });

  it('uses the current care state when entered directly after time away', () => {
    const yesterday = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
    render(<Harness api={createApi(makeStages())} initial={{ pets: [{ ...starter, energy: 5, lastUpdate: yesterday }], inventory: { apple: 2 }, coins: 10 }} />);
    fireEvent.click(screen.getByRole('button', { name: '選好夥伴，下一步 →' }));
    expect(saved().pets[0].energy).toBeGreaterThanOrEqual(37);
    expect(screen.getByRole('button', { name: '出發，探索森林 →' })).toBeEnabled();
  });
});
