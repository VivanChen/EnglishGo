import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WordDash from './WordDash.jsx';
import { dashObstacleHit, makeDashRounds } from '../data/wordDash.js';

let scene;
vi.mock('../components/WordDashScene.jsx', () => ({ default: props => { scene = props; return <div data-testid="scene"/>; } }));
const words = [{ w: 'apple', m: '蘋果' }, { w: 'cat', m: '貓' }, { w: 'dog', m: '狗' }, { w: 'book', m: '書' }, { w: 'fish', m: '魚' }];
const deps = { V: { elementary: words }, speak: vi.fn(), stopSpeech: vi.fn(), playSound: vi.fn(), loadExtraWords: async () => ({}), fetchCloudVocab: async () => [] };
async function mount({ ready = true } = {}) { vi.useFakeTimers(); const onXp = vi.fn(); render(<WordDash lv="elementary" onBack={vi.fn()} onXp={onXp} deps={deps}/>); await act(async () => {}); fireEvent.click(screen.getByRole('button', { name: /開始衝衝/ })); if (ready) act(() => vi.advanceTimersByTime(3000)); return onXp; }
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('Word Dash', () => {
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
    expect(screen.queryByText('全關衝線成功！')).not.toBeInTheDocument();
    act(() => scene.onFinish());
    expect(screen.getByText('全關衝線成功！')).toBeInTheDocument();
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
