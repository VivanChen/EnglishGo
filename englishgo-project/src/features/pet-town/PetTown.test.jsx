import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./TownScene.jsx', () => ({
  default: ({ pets, placements, scene }) => <div data-testid="town-scene-mock" data-pets={JSON.stringify(pets)} data-placements={JSON.stringify(placements)} data-scene={scene}/>,
  PetPortrait: ({ speciesId }) => <span aria-hidden="true" data-species={speciesId}/>,
}));
vi.mock('./cloudAccount.js', () => ({ hashPin: vi.fn(), legacyPinHash: vi.fn(), requestPetAccount: vi.fn() }));
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
