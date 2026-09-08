import {StrictMode, useState} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import PetGachaStudio from './PetGachaStudio.jsx';

vi.mock('../components/PetCompanion.jsx', () => ({default: ({petId}) => <span>{petId} portrait</span>}));
const navigate = vi.fn();
const pet = {id: 'bunny', name: '小兔', story: '小兔喜歡讀書。'};
const Hdr = ({t, onBack}) => <header><button onClick={onBack}>返回</button><h1>{t}</h1></header>;
function useLS(key, initial) {
  const [value, setValue] = useState(() => JSON.parse(localStorage.getItem(key) || 'null') ?? initial);
  return [value, next => setValue(previous => {
    const result = typeof next === 'function' ? next(previous) : next;
    localStorage.setItem(key, JSON.stringify(result));
    return result;
  })];
}
const api = {Hdr, useLS, EGG_COST: 50, EGG_HATCH_TASKS: {N: 10, R: 15, SR: 25, SSR: 40}, GACHA_SR_PITY: 20, RARITY_INFO: {N: {color: '#579164', label: '普通', rate: 60}, R: {color: '#479', label: '稀有', rate: 25}, SR: {color: '#749', label: '超稀有', rate: 12}, SSR: {color: '#a73', label: '極稀有', rate: 3}}, playSound: vi.fn(), rollRarity: () => 'N', randomPet: rarity => ({...pet, id: rarity === 'N' ? 'bunny' : `pet-${rarity}`}), RARITY_ORDER: {N: 0, R: 1, SR: 2, SSR: 3}, DUPLICATE_EGG_PROGRESS: {N: 4, R: 6}, getDuplicatePetReward: () => ({exp: 40, bond: 4, dupes: 1}), applyDuplicatePetReward: (pet, reward) => ({...pet, exp: (pet.exp || 0) + reward.exp, bond: (pet.bond || 0) + reward.bond, dupes: (pet.dupes || 0) + reward.dupes})};
function Harness({balance = 50, initialPets = [], initialEggs = []}) {
  const [coins, setCoins] = useState(balance), [pets, setPets] = useState(initialPets), [eggs, setEggs] = useState(initialEggs);
  return <><output data-testid="saved">{JSON.stringify({coins, pets, eggs})}</output><PetGachaStudio c={{cl: '#507d5b'}} api={api} onBack={vi.fn()} onNavigate={navigate} {...{coins, setCoins, pets, setPets, eggs, setEggs}}/></>;
}
const saved = () => JSON.parse(screen.getByTestId('saved').textContent);
afterEach(() => {vi.useRealTimers(); vi.clearAllMocks(); localStorage.clear();});

describe('gacha choices, receipts, and next steps', () => {
  it('charges a rapid repeat click only once and saves the exact cost before skipping', () => {
    vi.useFakeTimers(); render(<StrictMode><Harness balance={500}/></StrictMode>);
    const draw = screen.getByRole('button', {name: /轉出一顆蛋/});
    act(() => {fireEvent.click(draw); fireEvent.click(draw);});
    expect(saved()).toMatchObject({coins: 450, eggs: [{petId: 'bunny'}]});
    expect(JSON.parse(localStorage.getItem('gachaReceipt'))).toMatchObject({cost: 50, balanceBefore: 500, balanceAfter: 450});
    fireEvent.click(screen.getByRole('button', {name: '直接看結果'}));
    act(() => vi.advanceTimersByTime(2000));
    expect(api.playSound.mock.calls.filter(([sound]) => sound === 'good')).toHaveLength(1);
    expect(saved().coins).toBe(450);
  });
  it('shows batch affordability before purchase and takes insufficient funds to tasks', () => {
    render(<Harness balance={60}/>);
    fireEvent.click(screen.getByRole('button', {name: '十顆蛋 500 金幣'}));
    expect(screen.getByRole('button', {name: /轉出十顆蛋/})).toBeDisabled();
    expect(screen.getByText('440')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '去做任務，賺金幣 →'}));
    expect(navigate).toHaveBeenCalledWith('pets', 'tasks'); expect(saved().coins).toBe(60);
    fireEvent.click(screen.getByRole('button', {name: '一顆蛋 50 金幣'}));
    expect(screen.getByRole('button', {name: /轉出一顆蛋/})).toBeEnabled();
  });
  it('keeps acknowledged results available across visits without paying or awarding again', () => {
    vi.useFakeTimers(); const view = render(<Harness/>);
    fireEvent.click(screen.getByRole('button', {name: /轉出一顆蛋/})); fireEvent.click(screen.getByRole('button', {name: '直接看結果'}));
    fireEvent.click(screen.getByRole('button', {name: '收下結果'}));
    expect(JSON.parse(localStorage.getItem('gachaReceipt')).acknowledged).toBe(true);
    fireEvent.click(screen.getByRole('button', {name: '查看上次結果 →'})); expect(saved().coins).toBe(0); expect(saved().eggs).toHaveLength(1);
    view.unmount(); render(<Harness balance={0} initialEggs={[{petId: 'bunny', rarity: 'N', progress: 0}]}/>);
    expect(screen.getByRole('button', {name: '查看上次結果 →'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '查看上次結果 →'}));
    expect(saved().coins).toBe(0); expect(saved().eggs).toHaveLength(1);
  });
  it('takes an existing-pet reward back to companions instead of the nursery', () => {
    vi.useFakeTimers(); render(<Harness initialPets={[{petId: 'bunny', exp: 0, bond: 0}]}/>);
    fireEvent.click(screen.getByRole('button', {name: /轉出一顆蛋/})); fireEvent.click(screen.getByRole('button', {name: '直接看結果'}));
    expect(saved()).toMatchObject({coins: 0, pets: [{exp: 40, bond: 4}], eggs: []});
    fireEvent.click(screen.getByRole('button', {name: '看看我的夥伴 →'})); expect(navigate).toHaveBeenCalledWith('pets', 'pets');
  });
  it('clearly preserves a growth gift when a repeated egg is already ready to hatch', () => {
    vi.useFakeTimers(); render(<Harness initialEggs={[{id: 'old', petId: 'bunny', rarity: 'N', progress: 10}]}/>);
    fireEvent.click(screen.getByRole('button', {name: /轉出一顆蛋/})); fireEvent.click(screen.getByRole('button', {name: '直接看結果'}));
    expect(screen.getByText('成長禮物已保留')).toBeInTheDocument();
    expect(saved().eggs[0]).toMatchObject({pendingDuplicateReward: {exp: 40, bond: 4, dupes: 1}});
    fireEvent.click(screen.getByRole('button', {name: '去孵化，迎接夥伴 →'})); expect(navigate).toHaveBeenCalledWith('pets', 'eggs');
  });
  it('sends a historical egg receipt to companions after that egg has already hatched', () => {
    localStorage.setItem('gachaReceipt', JSON.stringify({items: [{id: 'past', petId: 'bunny', pet, rarity: 'N', resultType: 'newEgg'}], acknowledged: true}));
    render(<Harness balance={0} initialPets={[{petId: 'bunny', exp: 0, bond: 0}]}/>);
    fireEvent.click(screen.getByRole('button', {name: '查看上次結果 →'}));
    fireEvent.click(screen.getByRole('button', {name: '看看我的夥伴 →'}));
    expect(navigate).toHaveBeenCalledWith('pets', 'pets');
    expect(saved()).toMatchObject({coins: 0, pets: [{exp: 0}], eggs: []});
  });
});
