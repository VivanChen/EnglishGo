import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SpeechHighlight from './SpeechHighlight.jsx';
import { speechHighlightEvents } from '../lib/speechTiming.js';

describe('spoken word highlighting', () => {
  it('preserves exact whitespace and punctuation and maps repeated phrases to the requested occurrence', () => {
    const text = 'Go now.  Go now.';
    const playback = { text: 'Go now.', sourceText: text, wordOffset: 2, started: true, word: 0 };
    const view = render(<SpeechHighlight text={text} playback={playback} />);
    const words = view.container.querySelectorAll('.speech-highlight-word');
    expect(view.container.textContent).toBe(text);
    expect(words[0]).not.toHaveClass('is-current');
    expect(words[2]).toHaveClass('is-current');
    view.rerender(<SpeechHighlight text={text} playback={{ ...playback, word: 1 }} />);
    expect(words[3]).toHaveClass('is-current');
    view.rerender(<SpeechHighlight text={text} playback={null} />);
    expect(view.container.querySelector('.is-current')).toBeNull();
    expect(view.container.textContent).toBe(text);
  });
  it('highlights the phrase only after playback starts when no word timing is available', () => {
    const playback = { text: "Don't stop.", started: false, word: -1 };
    const view = render(<SpeechHighlight text={playback.text} playback={playback} />);
    expect(view.container.querySelector('.is-reading')).toBeNull();
    view.rerender(<SpeechHighlight text={playback.text} playback={{ ...playback, started: true }} />);
    expect(view.container.querySelectorAll('.is-active-phrase')).toHaveLength(2);
    expect(view.container.querySelector('.is-current')).toBeNull();
    view.rerender(<SpeechHighlight text="A different sentence." playback={{ ...playback, started: true }} />);
    expect(view.container.querySelector('.is-reading')).toBeNull();
  });
  it('waits for sound, uses real media progress, and gives native boundaries precedence', () => {
    const update = vi.fn(), events = speechHighlightEvents('Go, go home.', update);
    expect(events.trackWords).toBe(true);
    events.onboundary({ name: 'word', charIndex: 4 });
    events.onprogress({ currentTime: 2, duration: 4 });
    expect(update).not.toHaveBeenCalled();
    events.onstart(); events.onprogress({ currentTime: 3.9, duration: 4 });
    expect(update).toHaveBeenLastCalledWith({ word: 2, approximate: true });
    events.onboundary({ name: 'word', charIndex: 4 });
    expect(update).toHaveBeenLastCalledWith({ word: 1, approximate: false });
    update.mockClear();
    events.onstart();
    events.onprogress({ currentTime: 0, duration: 4 });
    events.onboundary({ name: 'sentence', charIndex: 0 });
    events.onboundary({ charIndex: NaN });
    events.onboundary({ charIndex: 3 });
    expect(update).not.toHaveBeenCalled();
  });
  it('does not invent a word position from unavailable or invalid timing', () => {
    const update = vi.fn(), events = speechHighlightEvents('Hello again.', update);
    events.onstart(); update.mockClear();
    [NaN, Infinity, -1].forEach(currentTime => events.onprogress({ currentTime, duration: 4 }));
    [NaN, Infinity, 0, -1].forEach(duration => events.onprogress({ currentTime: 1, duration }));
    expect(update).not.toHaveBeenCalled();
  });
});
