import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../data/events.js';
import { createRun } from '../engine/engine.js';
import EventScreen from './EventScreen.jsx';

const pool = [
  { w: 'apple', m: '蘋果' }, { w: 'happy', m: '開心的' }, { w: 'school', m: '學校' }, { w: 'water', m: '水' },
  { w: 'friend', m: '朋友' }, { w: 'river', m: '河流' }, { w: 'cloud', m: '雲' }, { w: 'green', m: '綠色的' },
];

function runAt(id, game) {
  const run = createRun({ seed: 3 });
  run.event = { id, result: null, gains: [], ...(game ? { game } : {}) };
  run.screen = 'event';
  return run;
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Echo Archive event screen', () => {
  it('shows a painted scene and the opening choices for every event', () => {
    Object.entries(EVENTS).forEach(([id, def]) => {
      const game = def.game === 'climb' ? { kind: 'climb', step: 0, loot: 0 } : def.game === 'wheel' ? { kind: 'wheel', spins: [] } : undefined;
      const view = render(<EventScreen run={{ ...runAt(id, game), event: { ...runAt(id, game).event, riddle: def.riddle ? 0 : null } }} dispatch={vi.fn()} speak={vi.fn()} pool={pool}/>);
      expect(view.container.querySelector('.ea-event-scene img').getAttribute('src'), id).toBe(`/images/echo-archive/events/${id}.webp`);
      expect(screen.getByText(def.title.en)).toBeInTheDocument();
      expect(view.container.querySelectorAll('.ea-choice').length, id).toBeGreaterThan(0);
      view.unmount();
    });
  });

  it('plays the Hall of Echoes without showing the word while it is read', () => {
    vi.useFakeTimers();
    const speak = vi.fn();
    const dispatch = vi.fn();
    render(<EventScreen run={runAt('echoHall', { kind: 'echo' })} dispatch={dispatch} speak={speak} pool={pool} onWord={vi.fn()}/>);
    for (let round = 0; round < 3; round++) {
      act(() => { vi.advanceTimersByTime(400); });
      const [word, opts] = speak.mock.calls.at(-1);
      expect(opts).toEqual({ hideText: true });
      fireEvent.click(screen.getByRole('button', { name: word }));
      act(() => { vi.advanceTimersByTime(1500); });
    }
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'EVENT_GAME', score: 3 }));
    expect(dispatch.mock.calls.at(-1)[0].words).toHaveLength(3);
  });

  it('matches words with their meanings in the librarian card game', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // no shuffling: pairs sit side by side
    const dispatch = vi.fn();
    const onWord = vi.fn();
    const view = render(<EventScreen run={runAt('matching', { kind: 'memory' })} dispatch={dispatch} speak={vi.fn()} voice pool={pool} onWord={onWord}/>);
    const tiles = () => view.container.querySelectorAll('.ea-memory-tile');
    for (let i = 0; i < 8; i += 2) { fireEvent.click(tiles()[i]); fireEvent.click(tiles()[i + 1]); }
    expect(view.container.querySelectorAll('.ea-memory-tile.is-matched')).toHaveLength(8);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'EVENT_GAME', score: 4 }));
    expect(onWord).toHaveBeenCalledTimes(4);
  });
});
