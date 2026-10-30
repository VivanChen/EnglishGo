import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CareInteraction from './CareInteraction.jsx';

describe('direct scene care gestures', () => {
  it('supports keyboard and assistive activation without counting the synthetic mouse click twice', () => {
    const onInteract = vi.fn();
    render(<CareInteraction care={{ type: 'wash', step: 0, count: 0 }} name="凪凪" onInteract={onInteract}/>);
    const target = screen.getByRole('button', { name: '凪凪的打出泡泡互動區' });
    fireEvent.click(target, { detail: 1 });
    expect(onInteract).not.toHaveBeenCalled();
    fireEvent.click(target, { detail: 0 });
    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it('counts intentional movement, ignores tiny jitter, and stops after cancellation', () => {
    const onInteract = vi.fn();
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    render(<CareInteraction care={{ type: 'wash', step: 0, count: 0 }} name="凪凪" onInteract={onInteract}/>);
    const target = screen.getByRole('button', { name: '凪凪的打出泡泡互動區' });
    target.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 200 });
    const pointer = (type, x) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 80 });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      fireEvent(target, event);
    };
    pointer('pointerdown', 100);
    now.mockReturnValue(150); pointer('pointermove', 105);
    expect(onInteract).toHaveBeenCalledTimes(1);
    pointer('pointermove', 150);
    expect(onInteract).toHaveBeenCalledTimes(2);
    pointer('pointercancel', 150);
    now.mockReturnValue(300); pointer('pointermove', 200);
    expect(onInteract).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
  it('tracks aiming without awarding taps for every movement and ignores a second pointer release', () => {
    const onInteract = vi.fn(), onAim = vi.fn();
    render(<CareInteraction care={{ type: 'feed', step: 0, count: 0 }} name="凪凪" onInteract={onInteract} onAim={onAim} motion/>);
    const target = screen.getByRole('button', { name: '凪凪的準備好點心互動區' });
    target.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 200 });
    const pointer = (type, x, id = 1) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 80 });
      Object.defineProperty(event, 'pointerId', { value: id }); fireEvent(target, event);
    };
    pointer('pointerdown', 100); pointer('pointerup', 100, 2); pointer('pointermove', 200);
    expect(onInteract).toHaveBeenCalledTimes(1);
    expect(onAim).toHaveBeenLastCalledWith({ x: 2 / 3, y: .4 });
    expect(target).toHaveClass('is-pressed');
    pointer('pointerup', 200); pointer('pointermove', 250);
    expect(onAim).toHaveBeenCalledTimes(2);
    expect(target).not.toHaveClass('is-pressed');
  });

});
