import { expect, it, vi } from 'vitest';
import { followPageAnchor, withoutPageAnchor } from './pageAnchors.js';

it('removes only scrolling anchors and preserves query parameters and unrelated hashes', () => {
  expect(withoutPageAnchor('https://example.com/?level=elementary#choose-level')).toBe('https://example.com/?level=elementary');
  expect(withoutPageAnchor('https://example.com/#learning-content')).toBe('https://example.com/');
  expect(withoutPageAnchor('https://example.com/#other')).toBe('https://example.com/#other');
});

it('scrolls and moves keyboard focus without adding a history entry or losing navigation state', () => {
  const state = { englishGoNavigation: { lv: null, depth: 0 } };
  window.history.replaceState(state, '', '/?source=home#choose-level');
  const target = document.createElement('section');
  target.id = 'choose-level'; target.tabIndex = -1; document.body.append(target);
  const scroll = vi.spyOn(target, 'scrollIntoView');
  const preventDefault = vi.fn(), length = window.history.length;
  try {
    followPageAnchor({ button: 0, currentTarget: { hash: '#choose-level' }, preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(target).toHaveFocus(); expect(scroll).toHaveBeenCalled();
    expect(window.location.hash).toBe(''); expect(window.location.search).toBe('?source=home');
    expect(window.history.state).toEqual(state); expect(window.history.length).toBe(length);
  } finally { target.remove(); }
});
