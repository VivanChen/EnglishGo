import {StrictMode, useState} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PetsGuard} from './PetsModule.jsx';

vi.mock('./PetExpedition.jsx', () => ({default: () => null}));
vi.mock('./PetGachaStudio.jsx', () => ({default: () => null}));
vi.mock('../components/PetWorldArt.jsx', () => ({PetHabitatScene: () => <span>家園插畫</span>}));
vi.mock('./PetSanctuary.jsx', () => ({default: ({eggs, setEggs, onAccount}) => <div data-testid="local-home"><button onClick={() => setEggs([...eggs, {id: 'new-local-egg', petId: 'bunny', rarity: 'N', progress: 7}])}>領養測試蛋</button><button onClick={onAccount}>小帳號設定</button></div>}));

const cloud = {username: 'cloudfriend', pets: [], eggs: [], coins: 0, inventory: {}};
const empty = {pets: [], eggs: [], coins: 0, inventory: {}, petAccount: null};
const deps = {Hdr: ({t, onBack}) => <header><button onClick={onBack}>返回</button><h1>{t}</h1></header>, S: {}, playSound: vi.fn(), petCloudLogin: vi.fn(), petCloudSignup: vi.fn(), hashPin: vi.fn()};
function Harness({initial = empty, onMutate = () => {}}) {
  const [saved, setSaved] = useState({...empty, ...initial});
  const update = key => value => {onMutate(key); setSaved(previous => ({...previous, [key]: typeof value === 'function' ? value(previous[key]) : value}));};
  return <><output data-testid="saved">{JSON.stringify(saved)}</output><PetsGuard {...saved} deps={deps} c={{cl: '#365', bg: '#eee'}} onBack={vi.fn()} setPets={update('pets')} setEggs={update('eggs')} setCoins={update('coins')} setInventory={update('inventory')} setPetAccount={update('petAccount')}/></>;
}
function deferred() {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};}
const saved = () => JSON.parse(screen.getByTestId('saved').textContent);
const finish = (pending, value) => act(async () => {pending.resolve(value);});
async function enter(mode = 'login', username = 'friend') {
  fireEvent.click(screen.getByRole('button', {name: mode === 'login' ? '登入小帳號' : '建立小帳號'}));
  fireEvent.change(screen.getByLabelText('暱稱'), {target: {value: username}});
  fireEvent.change(screen.getByLabelText('PIN'), {target: {value: '1234'}});
  if (mode === 'signup') fireEvent.change(screen.getByLabelText('再次輸入 PIN'), {target: {value: '1234'}});
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: mode === 'login' ? '🔑 登入' : '✨ 建立帳號'}));});
}
function backToLocal() {
  fireEvent.click(screen.getByRole('button', {name: '返回'}));
  fireEvent.click(screen.getByRole('button', {name: '先在這台裝置養寵物 →'}));
  fireEvent.click(screen.getByRole('button', {name: '領養測試蛋'}));
}
beforeEach(() => {
  vi.resetAllMocks();
  deps.petCloudLogin.mockResolvedValue({ok: true, data: cloud});
  deps.petCloudSignup.mockResolvedValue({ok: true, data: cloud});
  deps.hashPin.mockResolvedValue('test-hash');
});
afterEach(() => localStorage.clear());

describe('pet account save protection', () => {
  it('asks to reconcile food-only saves and preserves both inventories after merging', async () => {
    deps.petCloudLogin.mockResolvedValue({ok: true, data: {...cloud, inventory: {fish: 2}}});
    render(<Harness initial={{inventory: {apple: 3}}}/>);
    await enter();
    expect(screen.getByRole('heading', {name: '⚠️ 資料衝突'})).toBeInTheDocument();
    expect(saved()).toMatchObject({inventory: {apple: 3}, petAccount: null});
    expect(screen.getByText(/3 份食物/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /合併（推薦）/}));
    expect(saved()).toMatchObject({inventory: {apple: 3, fish: 2}, petAccount: {username: 'cloudfriend'}});
  });
  it('loads cloud food even when that account has no coins, pets or eggs', async () => {
    deps.petCloudLogin.mockResolvedValue({ok: true, data: {...cloud, inventory: {apple: 4}}});
    render(<Harness/>); await enter();
    expect(saved()).toMatchObject({inventory: {apple: 4}, petAccount: {username: 'cloudfriend'}});
    expect(screen.queryByRole('heading', {name: '⚠️ 資料衝突'})).not.toBeInTheDocument();
  });
  it('treats zero stock as empty instead of opening a false conflict', async () => {
    render(<Harness initial={{inventory: {apple: 0}}}/>); await enter();
    expect(screen.getByTestId('local-home')).toBeInTheDocument();
  });

  it.each(['login', 'signup'])('ignores a %s network response after returning and adopting locally', async mode => {
    const request = deferred(); deps[mode === 'login' ? 'petCloudLogin' : 'petCloudSignup'].mockReturnValue(request.promise);
    render(<StrictMode><Harness/></StrictMode>); await enter(mode); backToLocal();
    await finish(request, {ok: true, data: {...cloud, eggs: [{id: 'old-cloud-egg'}], coins: 70}});
    expect(saved()).toMatchObject({eggs: [{id: 'new-local-egg'}], coins: 0, petAccount: null});
    expect(saved().eggs).toHaveLength(1); expect(deps.hashPin).not.toHaveBeenCalled();
    expect(screen.getByTestId('local-home')).toBeInTheDocument();
  });
  it.each(['login', 'signup'])('ignores a %s result when returning during PIN hashing', async mode => {
    const hash = deferred(); deps.hashPin.mockReturnValue(hash.promise);
    render(<Harness/>); await enter(mode); expect(deps.hashPin).toHaveBeenCalledOnce(); backToLocal();
    await finish(hash, 'obsolete-hash');
    expect(saved()).toMatchObject({eggs: [{id: 'new-local-egg'}], petAccount: null});
    expect(deps.playSound).not.toHaveBeenCalled();
  });
  it.each([['login', 'network'], ['signup', 'network'], ['login', 'hash'], ['signup', 'hash']])('ignores %s completion after unmounting during %s', async (mode, stage) => {
    const pending = deferred(), onMutate = vi.fn();
    if (stage === 'network') deps[mode === 'login' ? 'petCloudLogin' : 'petCloudSignup'].mockReturnValue(pending.promise);
    else deps.hashPin.mockReturnValue(pending.promise);
    const view = render(<Harness onMutate={onMutate}/>); await enter(mode); view.unmount();
    await finish(pending, stage === 'network' ? {ok: true, data: cloud} : 'late-hash');
    expect(onMutate).not.toHaveBeenCalled(); expect(deps.playSound).not.toHaveBeenCalled();
  });
  it.each(['login', 'signup'])('keeps the latest %s attempt active when an earlier response arrives', async mode => {
    const first = deferred(), second = deferred(), service = deps[mode === 'login' ? 'petCloudLogin' : 'petCloudSignup'];
    service.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<Harness/>); await enter(mode, 'first');
    fireEvent.click(screen.getByRole('button', {name: '返回'})); await enter(mode, 'second');
    await finish(first, {ok: true, data: {...cloud, username: 'first'}});
    expect(screen.getByRole('button', {name: mode === 'login' ? '登入中...' : '建立中...'})).toBeDisabled();
    expect(deps.hashPin).not.toHaveBeenCalled();
    await finish(second, {ok: true, data: {...cloud, username: 'second'}});
    expect(saved().petAccount).toMatchObject({username: 'second'}); expect(deps.playSound).toHaveBeenCalledOnce();
  });
  it('keeps duplicate submissions locked while the successful login is still hashing', async () => {
    const hash = deferred(); deps.hashPin.mockReturnValue(hash.promise);
    render(<Harness/>); await enter();
    fireEvent.keyDown(screen.getByLabelText('PIN'), {key: 'Enter'});
    expect(deps.petCloudLogin).toHaveBeenCalledOnce();
    await finish(hash, 'test-hash'); expect(saved().petAccount).toMatchObject({pinHash: 'test-hash'});
  });
  it('allows a retry after a hashing error without leaving the form', async () => {
    deps.hashPin.mockRejectedValueOnce(new Error('hash failed')).mockResolvedValueOnce('new-hash');
    render(<Harness/>); await enter();
    expect(screen.getByRole('button', {name: '🔑 登入'})).toBeEnabled();
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: '🔑 登入'}));});
    expect(saved().petAccount).toMatchObject({pinHash: 'new-hash'});
  });
});
