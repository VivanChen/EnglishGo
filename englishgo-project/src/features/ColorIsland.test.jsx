import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ColorIsland from './ColorIsland.jsx';
import { ISLAND_MODES, colorIslandReducer as reduce, islandStandingTile, makeIslandRounds, startIsland } from '../data/colorIsland.js';
let scene;
vi.mock('../components/ColorIslandScene.jsx', () => ({ default: props => { scene = props; return <div/>; } }));
const tick = (state, ms) => reduce(state, { type: 'TICK', ms });
const deps = { speak: vi.fn(), stopSpeech: vi.fn(), playSound: vi.fn() };
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('Color Survival Island', () => {
  it.each(ISLAND_MODES)('provides safe platforms and completes $title exactly once', mode => {
    const rounds = makeIslandRounds(mode, () => .37);
    let state = tick(startIsland(mode, rounds), 3000);
    rounds.forEach((round, i) => {
      expect(new Set(round.tiles).size).toBe(mode.colors);
      if (i) expect(round.target).not.toBe(rounds[i - 1].target);
      state = reduce(state, { type: 'SELECT', index: round.tiles.indexOf(round.target) });
      state = tick(state, mode.seconds * 1000);
      expect(state.passed).toBe(true);
      state = tick(state, 1700);
    });
    expect(state.phase).toBe('won'); expect(state.earned).toBe(mode.rounds * 10);
    expect(tick(state, 99999)).toBe(state);
  });
  it('judges actual position at deadline and treats gaps as unsafe', () => {
    const mode = ISLAND_MODES[0], rounds = [{ target: 'blue', tiles: Array.from({ length: 16 }, (_, i) => i === 15 ? 'blue' : 'red') }];
    let state = tick(startIsland(mode, rounds), 3000);
    state = tick(state, 7990); state = reduce(state, { type: 'SELECT', index: 15 }); state = tick(state, 5000);
    expect(state.passed).toBe(false); expect(state.lives).toBe(2); expect(state.earned).toBe(0);
    expect(islandStandingTile({ x: .5, z: 1 })).toBe(-1);
    state = tick(state, 1700); expect(state.index).toBe(0);
    state = reduce(state, { type: 'SELECT', index: 15 }); state = tick(state, 8000);
    expect(state.passed).toBe(true);
  });
  it('uses three rescue rings before ending and freezes while paused', () => {
    const mode = ISLAND_MODES[0], rounds = [{ target: 'blue', tiles: Array(16).fill('red') }];
    let state = tick(startIsland(mode, rounds), 3000);
    const paused = reduce(state, { type: 'PAUSE' });
    expect(tick(paused, 99999)).toBe(paused); expect(reduce(paused, { type: 'SELECT', index: 1 })).toBe(paused);
    state = reduce(paused, { type: 'RESUME' });
    for (let i = 0; i < 3; i++) state = tick(tick(state, 8000), 1700);
    expect(state.phase).toBe('lost'); expect(state.mistakes).toBe(3); expect(state.earned).toBe(0);
  });
  it('shows destination feedback and does not replay a fall sound after pause', () => {
    vi.useFakeTimers(); render(<ColorIsland onBack={vi.fn()} onXp={vi.fn()} deps={deps}/>);
    fireEvent.click(screen.getByRole('button', { name: '登島挑戰 →' })); act(() => vi.advanceTimersByTime(3000));
    act(() => scene.onSelect(15)); expect(screen.getByText(/移動中.*第 16 格/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000)); expect(screen.getByText(/已抵達.*第 16 格/)).toBeInTheDocument();
    const round = scene.state.rounds[0]; act(() => scene.onSelect(round.tiles.findIndex(id => id !== round.target)));
    act(() => vi.advanceTimersByTime(7000)); expect(scene.state.passed).toBe(false);
    expect(deps.playSound.mock.calls.filter(([sound]) => sound === 'bad')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ⅱ 暫停' })); fireEvent.click(screen.getByRole('button', { name: '繼續挑戰' }));
    expect(deps.playSound.mock.calls.filter(([sound]) => sound === 'bad')).toHaveLength(1);
  });
  it('speaks instructions, pauses, grants XP once per round and resets replay', () => {
    vi.useFakeTimers(); const onXp = vi.fn();
    render(<ColorIsland onBack={vi.fn()} onXp={onXp} deps={deps}/>);
    fireEvent.click(screen.getByRole('button', { name: '登島挑戰 →' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(deps.speak).toHaveBeenLastCalledWith(`Stand on ${scene.state.rounds[0].target}!`);
    fireEvent.click(screen.getByRole('button', { name: 'Ⅱ 暫停' }));
    const remaining = scene.state.remainingMs; act(() => vi.advanceTimersByTime(10000)); expect(scene.state.remainingMs).toBe(remaining);
    fireEvent.click(screen.getByRole('button', { name: '繼續挑戰' }));
    for (let i = 0; i < 5; i++) {
      const round = scene.state.rounds[i]; act(() => scene.onSelect(round.tiles.indexOf(round.target)));
      act(() => vi.advanceTimersByTime(8000)); act(() => vi.advanceTimersByTime(1700));
    }
    expect(screen.getByText('守住彩虹島！')).toBeInTheDocument(); expect(onXp.mock.calls).toEqual(Array(5).fill([10]));
    fireEvent.click(screen.getByRole('button', { name: '再挑戰一次 →' }));
    expect(scene.state.phase).toBe('ready'); expect(scene.state.lives).toBe(3); expect(scene.state.earned).toBe(0);
  });
});
