import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WordDash from './WordDash.jsx';
import { DASH_COURSES, dashCourseObstacle, dashObstacleHit, dashRaceRank, dashCameraDistance, makeDashRounds } from '../data/wordDash.js';

import { createDashRival, stepDashRival } from '../data/wordDashRace.js';
let scene;
vi.mock('../components/WordDashScene.jsx', () => ({ default: props => { scene = props; return <div data-testid="scene"/>; } }));
const words = [{ w: 'apple', m: '蘋果' }, { w: 'cat', m: '貓' }, { w: 'dog', m: '狗' }, { w: 'book', m: '書' }, { w: 'fish', m: '魚' }];
const deps = { V: { elementary: words }, speak: vi.fn(), stopSpeech: vi.fn(), playSound: vi.fn(), loadExtraWords: async () => ({}), fetchCloudVocab: async () => [] };
async function mount({ ready = true, course } = {}) { vi.useFakeTimers(); const onXp = vi.fn(); render(<WordDash lv="elementary" onBack={vi.fn()} onXp={onXp} deps={deps}/>); await act(async () => {}); if (course) fireEvent.click(screen.getByRole('button', { name: new RegExp(course.title) })); fireEvent.click(screen.getByRole('button', { name: /開始衝衝/ })); if (ready) act(() => vi.advanceTimersByTime(3000)); return onXp; }
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('Word Dash', () => {
  it('keeps rivals moving and the camera steady while the player recoils', () => {
    const course = DASH_COURSES[0];
    const runners = Array.from({ length: 6 }, (_, i) => ({ ...createDashRival(i, course), distance: 18 - i, delay: 0 }));
    const before = runners.map(runner => runner.distance), after = runners.map(runner => stepDashRival(runner, .08, [], 5).distance);
    expect(after.every((distance, i) => distance >= before[i])).toBe(true);
    expect(dashCameraDistance(21, 15)).toBe(21);
    expect(dashCameraDistance(21, 22)).toBe(22);
    expect(dashRaceRank(15, after, 157)).toBeGreaterThan(dashRaceRank(21, before, 157));
    expect(dashRaceRank(157, Array(6).fill(157), 157)).toBe(7);
  });
  it('shows a loss even after completing every word when all rivals finished first', async () => {
    const xp = await mount();
    for (let i = 0; i < 5; i++) { const word = deps.speak.mock.calls.at(-1)[0]; act(() => scene.onGate(scene.choices.findIndex(choice => choice.w === word))); }
    act(() => scene.onFinish(7));
    expect(screen.getByText('第 7 名 / 7 位選手')).toBeInTheDocument();
    expect(screen.getByText('這次未奪冠，再挑戰！')).toBeInTheDocument();
    expect(xp).toHaveBeenCalledTimes(5);
    expect(deps.playSound).toHaveBeenLastCalledWith('bad');
  });
  it('allows every race placing, including second, and counts rivals already finished', () => {
    const rivals = [100, 90, 80, 70, 60, 50];
    [110, 95, 85, 75, 65, 55, 40].forEach((distance, i) => expect(dashRaceRank(distance, rivals, 157)).toBe(i + 1));
    expect(dashRaceRank(157, [157, 150, 140, 130, 120, 110], 157)).toBe(2);

  });
  it('shows the live rank and preserves second place on the results screen', async () => {
    await mount(); act(() => scene.onRank(2));
    expect(screen.getByText('2 / 7')).toBeInTheDocument();
    for (let i = 0; i < 5; i++) { const word = deps.speak.mock.calls.at(-1)[0]; act(() => scene.onGate(scene.choices.findIndex(choice => choice.w === word))); }
    act(() => scene.onFinish(2));
    expect(screen.getByText('第 2 名 / 7 位選手')).toBeInTheDocument();
    expect(screen.getByText('這次未奪冠，再挑戰！')).toBeInTheDocument();
    expect(screen.queryByText('冠軍！你贏了！')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '再衝一次 ↗' }));
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
  });
  it.each(DASH_COURSES)('finishes $title with the correct number of gates and rewards', async course => {
    const xp = await mount({ course });
    expect(scene.course.id).toBe(course.id); expect(scene.total).toBe(course.rounds);
    for (let i = 0; i < course.rounds; i++) {
      const word = deps.speak.mock.calls.at(-1)[0];
      const selected = scene.choices.findIndex(choice => choice.w === word);
      act(() => scene.onGate(selected));
    }
    expect(scene.phase).toBe('finishing'); act(() => scene.onFinish());
    expect(xp).toHaveBeenCalledTimes(course.rounds); expect(xp.mock.calls.every(([amount]) => amount === 10)).toBe(true);
    expect(screen.getByText(new RegExp(`\\+${course.rounds * 10} XP`))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '再衝一次 ↗' }));
    expect(scene.phase).toBe('countdown'); expect(scene.round).toBe(0); expect(scene.course.id).toBe(course.id); expect(scene.total).toBe(course.rounds);
    expect(xp).toHaveBeenCalledTimes(course.rounds);
  });
  it('starts the next course with a fresh clock and lets players change courses from pause', async () => {
    const xp = await mount();
    for (let i = 0; i < 5; i++) { const word = deps.speak.mock.calls.at(-1)[0]; act(() => scene.onGate(scene.choices.findIndex(choice => choice.w === word))); }
    act(() => scene.onFinish()); fireEvent.click(screen.getByRole('button', { name: /下一關：果凍滾球谷/ }));
    expect(scene.course.id).toBe('jelly'); expect(scene.total).toBe(6); expect(screen.getByText('0s')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ⅱ 暫停' })); fireEvent.click(screen.getByRole('button', { name: '重選賽道' }));
    expect(scene.phase).toBe('lobby');
    fireEvent.click(screen.getByRole('button', { name: /星光皇冠賽/ })); fireEvent.click(screen.getByRole('button', { name: /開始衝衝/ }));
    expect(scene.course.id).toBe('starlight'); expect(scene.total).toBe(8); expect(xp).toHaveBeenCalledTimes(5);
  });
  it('fills long courses from a small word pool without consecutive duplicate targets', () => {
    const rounds = makeDashRounds(words.slice(0, 3), () => .5, 8);
    expect(rounds).toHaveLength(8);
    rounds.forEach((round, index) => {
      if (index) expect(round.w).not.toBe(rounds[index - 1].w);
      expect(new Set(round.choices.map(word => word.m)).size).toBe(3);
    });
    expect(new Set(DASH_COURSES.at(-1).pattern)).toEqual(new Set(['bar', 'ball', 'roller', 'piston']));
    expect(dashCourseObstacle(DASH_COURSES[1], 0)).toBe('roller');
  });
  it('collides with raised pistons but allows retracted pistons and high jumps', () => {
    const piston = { type: 'piston', x: 0, z: -10, y: 1, width: 2.5, height: 1.8, depth: 2.5 };
    expect(dashObstacleHit(piston, 0, -10, 0)).toBe(true);
    expect(dashObstacleHit(piston, 0, -10, 2.8)).toBe(false);
    expect(dashObstacleHit(piston, 4.65, -10, 0)).toBe(false);
    expect(dashObstacleHit({ ...piston, y: -1.6 }, 0, -10, 0)).toBe(false);
    const roller = { type: 'roller', x: 4.5, z: -7, y: 1.1, radius: 1.1 };
    expect(dashObstacleHit(roller, 0, -7, 0)).toBe(false);
    expect(dashObstacleHit(roller, 4.5, -7, 0)).toBe(true);
    expect(dashObstacleHit(roller, 4.5, -7, 2.8)).toBe(false);
  });
  it('builds unambiguous doors and handles insufficient vocabulary', () => {
    expect(makeDashRounds(words.slice(0, 2))).toEqual([]);
    for (const round of makeDashRounds([...words, { w: 'kitty', m: '貓' }])) {
      expect(new Set(round.choices.map(word => word.m)).size).toBe(3);
      expect(round.choices.filter(word => word.w === round.w)).toHaveLength(1);
    }
  });
  it('retries wrong doors and grants each completed gate reward only once', async () => {
    const xp = await mount();
    for (let i = 0; i < 5; i++) {
      const word = deps.speak.mock.calls.at(-1)[0];
      const correct = scene.choices.findIndex(choice => choice.w === word);
      if (i === 0) { act(() => scene.onGate((correct + 1) % 3)); expect(xp).not.toHaveBeenCalled(); expect(scene.round).toBe(0); }
      act(() => { const gate = scene.onGate; gate(correct); gate(correct); });
    }
    expect(scene.phase).toBe('finishing');
    expect(screen.queryByText('冠軍！你贏了！')).not.toBeInTheDocument();
    act(() => scene.onFinish());
    expect(screen.getByText('冠軍！你贏了！')).toBeInTheDocument();
    expect(xp.mock.calls).toEqual([[10], [10], [10], [10], [10]]);
    expect(screen.getByText(/1 次重試/)).toBeInTheDocument();
  });
  it('pauses the starting countdown on visibility change and resumes without racing early', async () => {
    const xp = await mount({ ready: false });
    act(() => vi.advanceTimersByTime(1000));
    expect(scene.phase).toBe('countdown'); expect(screen.getByRole('status')).toHaveTextContent('2');
    const descriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    try { fireEvent(document, new Event('visibilitychange')); } finally { if (descriptor) Object.defineProperty(document, 'hidden', descriptor); else delete document.hidden; }
    act(() => { vi.advanceTimersByTime(5000); scene.onGate(0); });
    expect(scene.phase).toBe('paused'); expect(xp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /繼續比賽/ }));
    act(() => vi.advanceTimersByTime(1000)); expect(scene.phase).toBe('countdown');
    act(() => vi.advanceTimersByTime(1000)); expect(scene.phase).toBe('playing'); expect(screen.getByText('0s')).toBeInTheDocument();
  });
  it('keeps space-to-jump working after a lane button has keyboard focus', async () => {
    await mount(); const button = screen.getAllByRole('button', { name: /選擇跑道/ })[0]; button.focus();
    fireEvent.keyDown(button, { key: ' ' }); expect(scene.jump).toBe(1);
    fireEvent.keyDown(button, { key: 'ArrowRight', ctrlKey: true }); expect(scene.lane).toBe(1);
    fireEvent.keyDown(button, { key: 'ArrowLeft' }); expect(scene.lane).toBe(0);
    fireEvent.keyDown(button, { key: 'ArrowLeft' }); expect(scene.lane).toBe(0);
  });
  it('stops the timer when the renderer becomes unavailable', async () => {
    await mount(); act(() => vi.advanceTimersByTime(2000)); act(() => scene.onUnavailable());
    act(() => vi.advanceTimersByTime(6000)); expect(screen.getByText('2s')).toBeInTheDocument(); expect(scene.phase).toBe('unavailable');
  });
  it('lets a jump clear a low bar while respecting the position of bouncing balls', () => {
    const bar = { type: 'bar', x: 0, z: -10, angle: 0 };
    expect(dashObstacleHit(bar, 4, -10, 0)).toBe(true);
    expect(dashObstacleHit(bar, 4, -10, 2)).toBe(false);
    expect(dashObstacleHit({ ...bar, angle: Math.PI / 2 }, 4, -10, 0)).toBe(false);
    const ball = { type: 'ball', x: 0, z: -9, y: 1, radius: .95 };
    expect(dashObstacleHit(ball, 0, -9, 0)).toBe(true);
    expect(dashObstacleHit(ball, 4.65, -9, 0)).toBe(false);
    expect(dashObstacleHit({ ...ball, y: 3.5 }, 0, -9, 0)).toBe(false);
    expect(dashObstacleHit(ball, 0, -9, 2.8)).toBe(false);
  });
  it('freezes time and gate rewards while paused, then resumes', async () => {
    vi.useFakeTimers(); const xp = await mount(); act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button', { name: 'Ⅱ 暫停' }));
    act(() => { vi.advanceTimersByTime(5000); scene.onGate(0); });
    expect(screen.getByText('2s')).toBeInTheDocument(); expect(xp).not.toHaveBeenCalled();
    const resume = screen.getByRole('button', { name: /繼續比賽/ }), leave = screen.getByRole('button', { name: '回遊戲大廳' });
    leave.focus(); fireEvent.keyDown(leave, { key: 'Tab' }); expect(resume).toHaveFocus();
    fireEvent.keyDown(resume, { key: 'Tab', shiftKey: true }); expect(leave).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: /繼續比賽/ }));
    act(() => vi.advanceTimersByTime(1000)); expect(screen.getByText('3s')).toBeInTheDocument();
  });
});
