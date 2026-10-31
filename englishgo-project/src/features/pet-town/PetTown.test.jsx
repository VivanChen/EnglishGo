import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./TownScene.jsx', () => ({
  default: ({ pets, placements, scene, activity, onPlacementSelect, onEnvironment }) => <div data-testid="town-scene-mock" data-pets={JSON.stringify(pets)} data-placements={JSON.stringify(placements)} data-scene={scene} data-activity={JSON.stringify(activity)}><button onClick={() => onPlacementSelect?.('placement-harbor-bowl')}>模擬點選餐碗</button>{activity?.type === 'environment' && <button onClick={() => onEnvironment?.({ phase: 'arrived', petId: activity.petId, placementId: activity.placementId, text: '正低頭享用碗裡的點心。' })}>模擬抵達物件</button>}</div>,
  PetPortrait: ({ speciesId }) => <span aria-hidden="true" data-species={speciesId}/>,
}));
vi.mock('./cloudAccount.js', () => ({ hashPin: vi.fn(), legacyPinHash: vi.fn(), requestPetAccount: vi.fn() }));
const audio = vi.hoisted(()=>({start:vi.fn(async()=>true),ready:vi.fn(async()=>{}),setLevels:vi.fn(),play:vi.fn(()=>true),pause:vi.fn(),stop:vi.fn(),dispose:vi.fn()}));
vi.mock('./townSounds.js',async importOriginal=>({...await importOriginal(),createTownSounds:()=>audio}));
vi.mock('./townAmbience.js',()=>({createTownAmbience:()=>({start:async()=>true,setVolume:vi.fn(),pause:vi.fn(),dispose:vi.fn()})}));
import PetTown from './PetTown.jsx';
import { CARE } from './CareInteraction.jsx';
import { CHAPTERS, FURNITURE, PETS } from './worldData.js';
import { hashPin, legacyPinHash, requestPetAccount } from './cloudAccount.js';
import { resetProgressOnce } from '../../data/progressReset.js';
import { createWorld } from './worldState.js';
import { readTownSnapshot } from './townStorage.js';

const xp = vi.fn(), navigate = vi.fn(), back = vi.fn();
function Harness() {
  const [coins, setCoins] = useState(300), [petAccount, setPetAccount] = useState(null);
  return <><output data-testid="ui-coins">{coins}</output><PetTown {...{ coins, setCoins, petAccount, setPetAccount }} onBack={back} onNavigate={navigate}
    onXp={xp}/></>;
}
const finishStage = label => { const stage = CARE.flatMap(c => c.stages).find(s => s.label === label); for (let i = 0; i < stage.hits; i++) click(label); };
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const tab = label => fireEvent.click(within(screen.getByRole('navigation', { name: '海風小鎮導覽' })).getByRole('button', { name: label }));
const adopt = (index = 0) => {
  const pet = PETS[index];
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${pet.name}.*${pet.trait}`) }));
  click(`和${pet.name}一起回家`);
};
const openFirstChapter = () => {
  tab('出遊'); fireEvent.click(screen.getByRole('button', { name: new RegExp(CHAPTERS[0].title) }));
};
function answerStep(challenge) {
  const options = document.querySelector('.town-answer-options');
  fireEvent.click(within(options).getAllByRole('button')[challenge.answer]);
}
function completeFirstChapter(level = 'elementary') {
  const challenges = CHAPTERS[0].levels[level].challenges;
  answerStep(challenges[0]); click('繼續往前走');
  answerStep(challenges[1]); click('看看這段旅程的收穫');
  click('完成旅程，收進回憶');
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T04:00:00Z'));
  vi.clearAllMocks(); hashPin.mockResolvedValue('a'.repeat(64));
  legacyPinHash.mockReturnValue('1509442');
  requestPetAccount.mockResolvedValue({ ok: false, status: 503, error: '目前離線' });
});
afterEach(() => vi.useRealTimers());

describe('Seabreeze town complete UI flows', () => {
  it('previews volume edits immediately but saves only the completed adjustment and restores it later',()=>{
    const view=render(<Harness/>);click('小鎮設定');
    const slider=screen.getByRole('slider',{name:'背景音樂音量'});
    fireEvent.change(slider,{target:{value:'25'}});expect(readTownSnapshot(null).worldState.settings.musicVolume).toBe(60);
    fireEvent.pointerUp(slider);expect(readTownSnapshot(null).worldState.settings.musicVolume).toBe(25);
    view.unmount();render(<Harness/>);click('小鎮設定');expect(screen.getByRole('slider',{name:'背景音樂音量'})).toHaveValue('25');
    const effects=screen.getByRole('slider',{name:'寵物與環境音量'});fireEvent.change(effects,{target:{value:'0'}});fireEvent.blur(effects);click('設定好了');
    click('試聽凪凪的聲音');expect(audio.play).not.toHaveBeenCalled();expect(screen.getByRole('slider',{name:'寵物與環境音量'})).toHaveValue('0');
  });
  it('can restart after backgrounding during a pending browser resume; the stale request cannot stop new audio',async()=>{
    let finish;audio.start.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    render(<Harness/>);click('開啟小鎮音效');await waitFor(()=>expect(finish).toBeTypeOf('function'));
    const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);
    act(()=>document.dispatchEvent(new Event('visibilitychange')));hidden.mockRestore();
    expect(screen.getByRole('button',{name:'開啟小鎮音效'})).toBeEnabled();
    click('試聽凪凪的聲音');await waitFor(()=>expect(audio.play).toHaveBeenCalledWith('cat',.5));
    const pauses=audio.pause.mock.calls.length;await act(async()=>finish(true));
    expect(audio.pause).toHaveBeenCalledTimes(pauses);expect(screen.getByRole('button',{name:'關閉小鎮音效'})).toBeEnabled();
  });
  it.each([[0,'cat'],[1,'dog'],[2,'rustle']])('previews the selected companion sound from mute with one click (%i)',async(index,voice)=>{
    function MutedTown(){const[quiet,setQuiet]=useState(true);return <PetTown quiet={quiet} onEnableSound={()=>setQuiet(false)}/>;}
    render(<MutedTown/>);
    const pet=PETS[index];click(new RegExp(`${pet.name}.*${pet.trait}`));
    expect(audio.play).not.toHaveBeenCalled();click(`試聽${pet.name}的聲音`);
    await waitFor(()=>expect(audio.play).toHaveBeenCalledWith(voice,.5));
    expect(screen.getByRole('button',{name:'關閉小鎮音效'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByText('小鎮音效已開啟')).toBeInTheDocument();
  });
  it('reports unavailable audio and allows a retry instead of displaying a false playing state',async()=>{
    audio.ready.mockRejectedValueOnce(new Error('offline'));render(<Harness/>);click('開啟小鎮音效');
    await screen.findByText('音檔未能載入，請確認網路後再按一次開啟音效。');
    expect(screen.queryByRole('button',{name:'關閉小鎮音效'})).not.toBeInTheDocument();
    click('開啟小鎮音效');await screen.findByRole('button',{name:'關閉小鎮音效'});
  });
  it('does not play a pending preview after global mute',async()=>{
    let finish;audio.ready.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    function MutedTown(){const[quiet,setQuiet]=useState(false);return <><button onClick={()=>setQuiet(true)}>全域靜音</button><PetTown quiet={quiet} onEnableSound={()=>setQuiet(false)}/></>;}
    render(<MutedTown/>);click('試聽凪凪的聲音');await waitFor(()=>expect(finish).toBeTypeOf('function'));
    click('全域靜音');await act(async()=>finish());expect(audio.play).not.toHaveBeenCalled();
    expect(screen.queryByRole('button',{name:'關閉小鎮音效'})).not.toBeInTheDocument();
  });
  it('offers exactly three distinct free starters and retires old pet entities', () => {
    localStorage.setItem('eg_pets', JSON.stringify([{ petId: 'bunny', level: 99 }]));
    resetProgressOnce(localStorage);
    render(<Harness/>);
    expect(document.querySelectorAll('.town-starter-list button')).toHaveLength(3);
    expect(new Set([...document.querySelectorAll('.town-starter-list [data-species]')].map(node => node.dataset.species))).toEqual(new Set(PETS.map(pet => pet.id)));
    adopt(1);
    expect(readTownSnapshot(null).worldState.ownedPets.map(pet => pet.speciesId)).toEqual(['sunny-dog']);
    expect(screen.getByTestId('ui-coins')).toHaveTextContent('300');
    expect(localStorage.getItem('eg_pets')).toBeNull();
    expect(screen.queryByText(/扭蛋/)).not.toBeInTheDocument();
  });

  it('cancels unfinished care without rewards and completes feeding only after the last step', () => {
    render(<Harness/>); adopt();
    click('餵食'); click('準備好點心'); click('稍後再做');
    expect(readTownSnapshot(null).worldState.ownedPets[0]).toMatchObject({ hunger: 90, bond: 0 });
    click('餵食'); finishStage('準備好點心'); finishStage('餵第一口');
    expect(readTownSnapshot(null).worldState.ownedPets[0].hunger).toBe(90);
    finishStage('餵最後一口');
    expect(readTownSnapshot(null).worldState.ownedPets[0]).toMatchObject({ hunger: 100, bond: 2 });
    expect(xp).not.toHaveBeenCalled(); expect(screen.getByTestId('ui-coins')).toHaveTextContent('300');
  });

  it('completes all bath stages through the scene and settles only once', () => {
    render(<Harness/>); adopt(); click('洗澡');
    const bath = CARE.find(c => c.id === 'wash');
    for (const stage of bath.stages) {
      expect(readTownSnapshot(null).worldState.ownedPets[0].bond).toBe(0);
      const surface = screen.getByRole('button', { name: `凪凪的${stage.label}互動區` });
      for (let i = 0; i < stage.hits; i++) fireEvent.click(surface, { detail: 0 });
    }
    expect(readTownSnapshot(null).worldState.ownedPets[0]).toMatchObject({ clean: 100, bond: 2 });
    expect(screen.queryByRole('progressbar', { name: '照顧進度' })).not.toBeInTheDocument();
    click('洗澡');
    for (const stage of bath.stages) finishStage(stage.label);
    expect(readTownSnapshot(null).worldState.ownedPets[0].bond).toBe(2);
  });

  it('cancels scene care on navigation without awarding progress', () => {
    render(<Harness/>); adopt(); click('洗澡'); finishStage('打出泡泡');
    tab('出遊'); tab('家園');
    expect(screen.queryByRole('progressbar', { name: '照顧進度' })).not.toBeInTheDocument();
    expect(readTownSnapshot(null).worldState.ownedPets[0]).toMatchObject({ clean: 90, bond: 0 });
  });

  it('keeps a completed rest asleep until explicitly waking, without another reward', () => {
    render(<Harness/>); adopt(); click('休息'); finishStage('鋪好小毯子'); finishStage('輕聲說晚安');
    expect(JSON.parse(screen.getByTestId('town-scene-mock').dataset.activity)).toMatchObject({ type: 'sleep', resting: true });
    expect(readTownSnapshot(null).worldState.ownedPets[0]).toMatchObject({ energy: 100, bond: 2 });
    click('輕輕叫醒');
    expect(JSON.parse(screen.getByTestId('town-scene-mock').dataset.activity).type).toBe('wake');
    expect(screen.queryByRole('button', { name: '輕輕叫醒' })).not.toBeInTheDocument();
    expect(readTownSnapshot(null).worldState.ownedPets[0].bond).toBe(2);
  });

  it('calls and stretches a companion without manufacturing care rewards', () => {
    render(<Harness/>); adopt();
    const before = readTownSnapshot(null).worldState;
    click('叫凪凪過來');
    expect(JSON.parse(screen.getByTestId('town-scene-mock').dataset.activity).type).toBe('come');
    click('伸個懶腰');
    expect(JSON.parse(screen.getByTestId('town-scene-mock').dataset.activity).type).toBe('wake');
    expect(readTownSnapshot(null).worldState).toEqual(before);
    click('洗澡'); expect(screen.queryByText(/聽見你了/)).not.toBeInTheDocument();
  });

  it('routes furniture clicks to an interruptible home interaction without granting care rewards', () => {
    render(<Harness/>); adopt(); const before = readTownSnapshot(null).worldState;
    click('模擬點選餐碗');
    expect(JSON.parse(screen.getByTestId('town-scene-mock').dataset.activity)).toMatchObject({ type: 'environment', placementId: 'placement-harbor-bowl' });
    click('模擬抵達物件'); expect(screen.getByText(/正低頭享用碗裡的點心/)).toBeInTheDocument();
    click('停止這次互動'); expect(JSON.parse(screen.getByTestId('town-scene-mock').dataset.activity)).toBeNull();
    expect(readTownSnapshot(null).worldState).toEqual(before);
    click('模擬點選餐碗'); click('洗澡');
    expect(JSON.parse(screen.getByTestId('town-scene-mock').dataset.activity).type).toBe('wash');
    expect(screen.queryByRole('button', { name: '停止這次互動' })).not.toBeInTheDocument();
  });

  it('keeps furniture clicks in decorate mode editing the placement', () => {
    render(<Harness/>); adopt(); tab('布置'); click('模擬點選餐碗');
    expect(screen.getByRole('button', { name: '確認放置' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '停止這次互動' })).not.toBeInTheDocument();
  });

  it('completes and replays a chapter while awarding global XP and story gifts once', () => {
    render(<Harness/>); adopt(); openFirstChapter(); completeFirstChapter();
    const saved = readTownSnapshot(null).worldState;
    expect(saved.completedChapters).toEqual([CHAPTERS[0].id]);
    expect(saved.ownedPets[0].exp).toBe(CHAPTERS[0].petXp);
    expect(saved.ownedDecorations).toEqual(expect.arrayContaining(CHAPTERS[0].rewardItemIds));
    expect(xp).toHaveBeenCalledExactlyOnceWith(15);
    expect(screen.getByTestId('ui-coins')).toHaveTextContent('305');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(CHAPTERS[0].title) }));
    completeFirstChapter();
    expect(xp).toHaveBeenCalledTimes(1);
    expect(readTownSnapshot(null).worldState.ownedPets[0].exp).toBe(CHAPTERS[0].petXp + 10);
    expect(readTownSnapshot(null).worldState.ownedDecorations).toEqual(saved.ownedDecorations);
  });

  it('keeps story answers independent when switching English levels', () => {
    render(<Harness/>); adopt(); openFirstChapter();
    answerStep(CHAPTERS[0].levels.elementary.challenges[0]);
    fireEvent.change(screen.getByRole('combobox', { name: '故事英文程度' }), { target: { value: 'junior' } });
    expect(screen.getByRole('heading', { name: CHAPTERS[0].levels.junior.challenges[0].prompt })).toBeInTheDocument();
    answerStep(CHAPTERS[0].levels.junior.challenges[0]);
    fireEvent.change(screen.getByRole('combobox', { name: '故事英文程度' }), { target: { value: 'elementary' } });
    expect(screen.getByRole('heading', { name: CHAPTERS[0].levels.elementary.challenges[1].prompt })).toBeInTheDocument();
    const progress = readTownSnapshot(null).worldState.chapterProgress;
    expect(progress[`${CHAPTERS[0].id}:elementary`].step).toBe(1);
    expect(progress[`${CHAPTERS[0].id}:junior`].step).toBe(1);
    expect(xp).not.toHaveBeenCalled();
  });

  it('charges once for furniture, previews placement, and saves only on confirmation', () => {
    render(<Harness/>); adopt(); tab('布置');
    const item = FURNITURE.find(furniture => furniture.id === 'harbor-bench');
    let card = screen.getByRole('heading', { name: item.name }).closest('article');
    fireEvent.click(within(card).getByRole('button', { name: '帶回小家' }));
    expect(readTownSnapshot(null).coins).toBe(300 - item.price);
    card = screen.getByRole('heading', { name: item.name }).closest('article');
    fireEvent.click(within(card).getByRole('button', { name: '放進小家' }));
    expect(readTownSnapshot(null).worldState.placements.some(placement => placement.itemId === item.id)).toBe(false);
    click('確認放置');
    expect(readTownSnapshot(null).worldState.placements.find(placement => placement.itemId === item.id)).toMatchObject({ x: 2.5, z: 2.5 });
    expect(readTownSnapshot(null).coins).toBe(300 - item.price);
  });

  it('does not submit a signup after closing the dialog while its PIN is hashing', async () => {
    let finishHash;
    hashPin.mockImplementationOnce(() => new Promise(resolve => { finishHash = resolve; }));
    render(<Harness/>);
    click('已存本機'); click('建立帳號');
    fireEvent.change(screen.getByRole('textbox', { name: '暱稱' }), { target: { value: 'new-child' } });
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '1234' } });
    click('建立小鎮帳號'); click('關閉');
    await act(async () => finishHash('a'.repeat(64)));
    expect(requestPetAccount).not.toHaveBeenCalled();
  });

  it('restores a legacy PIN account only after the SHA-256 login is rejected', async () => {
    const accountId = 'd2d09127-ff55-48ac-b394-a50453b02308';
    requestPetAccount.mockResolvedValueOnce({ ok: false, code: 'unauthorized', error: 'wrong PIN' })
      .mockResolvedValueOnce({ ok: true, accountId, revision: 4, snapshot: { worldState: createWorld(), coins: 41 } });
    render(<Harness/>); click('已存本機');
    fireEvent.change(screen.getByRole('textbox', { name: '暱稱' }), { target: { value: 'legacy-child' } });
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '1234' } }); click('回到我的小島');
    await waitFor(() => expect(screen.getByTestId('ui-coins')).toHaveTextContent('41'));
    expect(requestPetAccount).toHaveBeenCalledTimes(2);
    expect(requestPetAccount.mock.calls[0].slice(0, 2)).toEqual(['login', { credentials: { username: 'legacy-child', pinHash: 'a'.repeat(64) } }]);
    expect(requestPetAccount.mock.calls[1].slice(0, 2)).toEqual(['login', { credentials: { username: 'legacy-child', pinHash: '1509442' } }]);
    expect(readTownSnapshot({ accountId }).coins).toBe(41);
  });

  it('cancels legacy fallback when the login dialog closes during the first request', async () => {
    let finishRequest;
    requestPetAccount.mockImplementationOnce(() => new Promise(resolve => { finishRequest = resolve; }));
    render(<Harness/>); click('已存本機');
    fireEvent.change(screen.getByRole('textbox', { name: '暱稱' }), { target: { value: 'legacy-child' } });
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '1234' } }); click('回到我的小島');
    await act(async () => { await Promise.resolve(); }); click('關閉');
    await act(async () => finishRequest({ ok: false, code: 'unauthorized' }));
    expect(requestPetAccount).toHaveBeenCalledTimes(1); expect(legacyPinHash).not.toHaveBeenCalled();
  });

  it('never creates a new account with a legacy PIN hash', async () => {
    requestPetAccount.mockResolvedValueOnce({ ok: false, code: 'unauthorized', error: 'signup refused' });
    render(<Harness/>); click('已存本機'); click('建立帳號');
    fireEvent.change(screen.getByRole('textbox', { name: '暱稱' }), { target: { value: 'new-child' } });
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '1234' } }); click('建立小鎮帳號');
    expect(await screen.findByRole('alert')).toHaveTextContent('signup refused');
    expect(requestPetAccount).toHaveBeenCalledTimes(1); expect(requestPetAccount.mock.calls[0][0]).toBe('signup');
    expect(legacyPinHash).not.toHaveBeenCalled();
  });
});
